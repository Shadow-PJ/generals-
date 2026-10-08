// Makes the Epic build (session 7B) from the unpacked Windows app: copies release/win-unpacked
// to release/epic/Generals and adds Epic's SDK library and the game's EOS settings (epic.json)
// in its resources/eos folder. Get the Windows folder from Actions > Store builds (the
// Generals-Steam-Windows artifact; nothing in it is Steam-only) or `npm run desktop:steam` on a
// Windows PC. Then:
//
//   npm run epic:stage
//
// It reads EOS_PRODUCT_ID, EOS_CLIENT_ID, EOS_CLIENT_SECRET and EOS_DEPLOYMENTS (from Epic's
// Developer Portal; see docs/store/epic/README.md), and EOS_SDK_DLL, the SDK library's path
// (desktop/eos/EOSSDK-Win64-Shipping.dll by default). The secret goes into epic.json, never into
// the log.

import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { epicConfigFromEnv, epicConfigPath, epicConfigText, epicResourceFolder, stageProblems, WINDOWS_SDK_LIBRARY } from './epicBuild';

const root = path.resolve(import.meta.dirname, '..', '..');
const source = path.join(root, 'release', 'win-unpacked');
const target = path.join(root, 'release', 'epic', 'Generals');
const libraryPath = process.env.EOS_SDK_DLL || path.join(root, 'desktop', 'eos', WINDOWS_SDK_LIBRARY);

function fail(problems: readonly string[]): never {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

const settings = epicConfigFromEnv(process.env);
if ('problems' in settings) fail(settings.problems);
const library = existsSync(libraryPath) ? readFileSync(libraryPath) : null;
const problems = stageProblems(source, library, existsSync);
if (problems.length > 0) fail(problems);

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
mkdirSync(epicResourceFolder(target), { recursive: true });
copyFileSync(libraryPath, path.join(epicResourceFolder(target), WINDOWS_SDK_LIBRARY));
writeFileSync(epicConfigPath(target), epicConfigText(settings.config));

const sandboxes = Object.keys(settings.config.deployments);
console.log(`Made ${path.relative(root, target)}: the Windows app with Epic's SDK and epic.json.`);
console.log(`Sandboxes: ${sandboxes.join(', ')} (${sandboxes[0]} is used when the launcher names none).`);
console.log('Upload it with npm run epic:upload.');
