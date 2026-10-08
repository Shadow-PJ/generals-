// Uploads the Epic build (session 7B) with Epic's BuildPatchTool, as a new binary of the game's
// artifact. Make the folder first with `npm run epic:stage`, then:
//
//   npm run epic:upload                 uploads release/epic/Generals
//   npm run epic:upload -- --dry-run    checks it and prints the command, uploading nothing
//   npm run epic:upload -- --no-overlay starts the game with Epic's overlay off
//
// It reads EPIC_ORGANIZATION_ID, EOS_PRODUCT_ID, EPIC_ARTIFACT_ID and EPIC_BPT_CLIENT_ID (from
// the Developer Portal), EPIC_BPT_CLIENT_SECRET (BuildPatchTool reads it from the environment
// itself, so it is never on the command line) and BUILD_PATCH_TOOL (BuildPatchTool's path, if it
// isn't on the PATH). Labelling the binary for a sandbox happens in the Developer Portal after.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_EXECUTABLE, buildVersion, uploadArgs, uploadProblems, type BinaryUpload } from './epicBuild';

const root = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const SECRET_VARIABLE = 'EPIC_BPT_CLIENT_SECRET';

function fail(problems: readonly string[]): never {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

const version = (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version;
const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() ?? '';
const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '');
const env = (name: string) => process.env[name]?.trim() ?? '';
const upload: BinaryUpload = {
  organizationId: env('EPIC_ORGANIZATION_ID'),
  productId: env('EOS_PRODUCT_ID'),
  artifactId: env('EPIC_ARTIFACT_ID'),
  clientId: env('EPIC_BPT_CLIENT_ID'),
  secretVariable: SECRET_VARIABLE,
  buildRoot: path.join(root, 'release', 'epic', 'Generals'),
  cloudDir: path.join(root, 'release', 'epic', 'cloud'),
  buildVersion: buildVersion(version, commit, stamp),
  appLaunch: APP_EXECUTABLE,
  appArgs: flag('no-overlay') ? '--eos-no-overlay' : '',
};
const problems = uploadProblems(upload, existsSync);
if (problems.length > 0) fail(problems);

const tool = process.env.BUILD_PATCH_TOOL || 'BuildPatchTool';
const command = [tool, ...uploadArgs(upload)];
console.log(`Uploading Generals ${upload.buildVersion} from ${path.relative(root, upload.buildRoot)}.`);
if (flag('dry-run')) {
  console.log(`Upload with: ${command.map((part) => (part.includes(' ') || part.endsWith('=') ? `"${part}"` : part)).join(' ')}`);
  process.exit(0);
}
if (!env(SECRET_VARIABLE)) fail([`Set ${SECRET_VARIABLE} to BuildPatchTool's client secret (or pass --dry-run).`]);
mkdirSync(upload.cloudDir, { recursive: true });
const run = spawnSync(command[0]!, command.slice(1), { stdio: 'inherit' });
if (run.error) fail([`Could not run BuildPatchTool (${run.error.message}). Download it from the Developer Portal, or set BUILD_PATCH_TOOL to its path.`]);
if (run.status === 0) console.log('Uploaded. Label the binary in the Developer Portal (Artifacts and Binaries) to put it in a sandbox.');
process.exit(run.status ?? 1);
