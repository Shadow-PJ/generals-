// Uploads a build to Steam with SteamPipe (session 7A). First build the folders Steam takes:
// `npm run desktop:steam` on Windows gives release/win-unpacked, on Linux release/linux-unpacked
// (or download both from the "Store builds" workflow and unpack them into release/ with
// `tar -xzf <file> -C release`). Then:
//
//   npm run steam:upload                 writes release/steam/app_build.vdf and uploads with steamcmd
//   npm run steam:upload -- --preview    checks the build without uploading
//   npm run steam:upload -- --live beta  also sets it live on the beta branch
//   npm run steam:upload -- --dry-run    only writes the script and prints the command
//
// It reads STEAM_APP_ID, STEAM_DEPOT_WINDOWS and STEAM_DEPOT_LINUX (the ids from Steamworks;
// leave a depot's out to skip it), STEAM_USERNAME (the build account) and STEAMCMD (steamcmd's
// path, if it isn't on the PATH). steamcmd asks for the password and Steam Guard code itself.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { appBuildProblems, appBuildVdf, type AppBuild, type Depot } from './appBuild';

const root = path.resolve(import.meta.dirname, '..', '..');
const release = path.join(root, 'release');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const number = (name: string) => {
  const text = process.env[name];
  return text ? Number(text) : null;
};

const appId = number('STEAM_APP_ID') ?? fail('Set STEAM_APP_ID to the game’s App ID from Steamworks.');
const depots: Depot[] = [];
for (const [name, folder] of [
  ['STEAM_DEPOT_WINDOWS', 'win-unpacked'],
  ['STEAM_DEPOT_LINUX', 'linux-unpacked'],
] as const) {
  const id = number(name);
  if (id === null) continue;
  if (!existsSync(path.join(release, folder))) fail(`${name} is set, but release/${folder} is missing: build it with npm run desktop:steam.`);
  depots.push({ id, folder });
}

const version = (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version;
const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const build: AppBuild = {
  appId,
  description: `Generals ${version}${commit ? ` (${commit})` : ''}`,
  contentRoot: release,
  buildOutput: path.join(release, 'steam', 'output'),
  depots,
  setLive: option('live'),
  preview: flag('preview'),
};
const problems = appBuildProblems(build);
if (problems.length > 0) fail(problems.join('\n'));

const script = path.join(release, 'steam', 'app_build.vdf');
mkdirSync(build.buildOutput, { recursive: true });
writeFileSync(script, appBuildVdf(build));
console.log(`Wrote ${path.relative(root, script)}: ${build.description}, depots ${depots.map((d) => `${d.id} (${d.folder})`).join(', ')}.`);

const username = process.env.STEAM_USERNAME;
const steamcmd = process.env.STEAMCMD || 'steamcmd';
const command = [steamcmd, '+login', username ?? '<build account>', '+run_app_build', script, '+quit'];
if (flag('dry-run')) {
  console.log(`Upload with: ${command.map((part) => (part.includes(' ') ? `"${part}"` : part)).join(' ')}`);
  process.exit(0);
}
if (!username) fail('Set STEAM_USERNAME to the Steamworks build account (or pass --dry-run).');
const run = spawnSync(command[0]!, command.slice(1), { stdio: 'inherit' });
if (run.error) fail(`Could not run steamcmd (${run.error.message}). Install it, or set STEAMCMD to its path.`);
process.exit(run.status ?? 1);
