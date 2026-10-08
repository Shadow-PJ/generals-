// The Epic build (session 7B), made from the same unpacked Windows app as Steam's: the folder
// gets Epic's SDK library and the game's EOS settings (epic.json) in resources/eos, where the
// app looks for them (desktop/epic.ts), and BuildPatchTool uploads it. These are the pure parts
// of `npm run epic:stage` and `npm run epic:upload`.

import path from 'node:path';
import { EPIC_CONFIG_FILE, EPIC_FOLDER, readEpicConfig, type EpicConfig } from '../../desktop/epic';
import { SDK_LIBRARY } from '../../desktop/eos';

/** The Windows SDK library: the Epic Games Store sells the Windows build. */
export const WINDOWS_SDK_LIBRARY = SDK_LIBRARY.win32!;
/** The app's executable, which the Epic Games Launcher starts. */
export const APP_EXECUTABLE = 'Generals.exe';

/** "sandbox:deployment,sandbox:deployment", Live first, as EOS_DEPLOYMENTS gives them. */
export function parseDeployments(text: string): Record<string, string> | null {
  const deployments: Record<string, string> = {};
  for (const pair of text.split(',').map((part) => part.trim()).filter(Boolean)) {
    const [sandbox, deployment, ...rest] = pair.split(':').map((part) => part.trim());
    if (!sandbox || !deployment || rest.length > 0 || Object.hasOwn(deployments, sandbox)) return null;
    deployments[sandbox] = deployment;
  }
  return Object.keys(deployments).length > 0 ? deployments : null;
}

/** epic.json's settings from the environment, or what is missing or wrong. */
export function epicConfigFromEnv(env: Readonly<Record<string, string | undefined>>): { config: EpicConfig } | { problems: string[] } {
  const problems: string[] = [];
  const need = (name: string, what: string) => {
    const value = env[name]?.trim();
    if (!value) problems.push(`Set ${name} to ${what}.`);
    return value ?? '';
  };
  const productId = need('EOS_PRODUCT_ID', 'the product id (Developer Portal > Product Settings)');
  const clientId = need('EOS_CLIENT_ID', 'the game client’s id (Product Settings > Clients)');
  const clientSecret = need('EOS_CLIENT_SECRET', 'the game client’s secret');
  const deploymentsText = need('EOS_DEPLOYMENTS', 'each sandbox and its deployment, Live first: "<sandbox id>:<deployment id>,..."');
  const deployments = deploymentsText ? parseDeployments(deploymentsText) : null;
  if (deploymentsText && !deployments) problems.push('EOS_DEPLOYMENTS must look like "<sandbox id>:<deployment id>,<sandbox id>:<deployment id>".');
  if (problems.length > 0) return { problems };
  // The app reads it back with its own checks, so a value it would refuse is caught here.
  const text = JSON.stringify({ productId, clientId, clientSecret, deployments });
  const config = readEpicConfig(text);
  return config ? { config } : { problems: ['An id has characters the app won’t accept; copy them again from the Developer Portal.'] };
}

/** epic.json's text. */
export function epicConfigText(config: EpicConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** Where the SDK and epic.json go inside the app folder. */
export function epicResourceFolder(appFolder: string): string {
  return path.join(appFolder, 'resources', EPIC_FOLDER);
}

export function epicConfigPath(appFolder: string): string {
  return path.join(epicResourceFolder(appFolder), EPIC_CONFIG_FILE);
}

/** What is wrong with the unpacked Windows app and the SDK library before staging, if anything. */
export function stageProblems(source: string, library: Uint8Array | null, exists: (file: string) => boolean): string[] {
  const problems: string[] = [];
  if (!exists(path.join(source, APP_EXECUTABLE)) || !exists(path.join(source, 'resources', 'app.asar'))) {
    problems.push(`${source} is not the unpacked Windows app: build it with npm run desktop:steam on Windows, or take Generals-Steam-Windows from Actions > Store builds.`);
  }
  if (library === null) problems.push(`The SDK library is missing: copy ${WINDOWS_SDK_LIBRARY} from the EOS SDK's SDK/Bin folder into desktop/eos/, or set EOS_SDK_DLL to it.`);
  else if (library[0] !== 0x4d || library[1] !== 0x5a) problems.push(`${WINDOWS_SDK_LIBRARY} is not a Windows library; take it from the SDK's SDK/Bin folder.`);
  return problems;
}

/** A version for BuildPatchTool, unique for each upload of the artifact. */
export function buildVersion(version: string, commit: string, stamp: string): string {
  return [version, commit, stamp].filter(Boolean).join('-').replace(/[^A-Za-z0-9.\-_+]/g, '');
}

export interface BinaryUpload {
  organizationId: string;
  productId: string;
  artifactId: string;
  /** BuildPatchTool's own client (Developer Portal > Product Settings > BPT Credentials). */
  clientId: string;
  /** The name of the environment variable holding that client's secret; the secret never goes on the command line. */
  secretVariable: string;
  buildRoot: string;
  cloudDir: string;
  buildVersion: string;
  appLaunch: string;
  appArgs: string;
}

/** BuildPatchTool's arguments to upload the folder as a new binary of the artifact. */
export function uploadArgs(upload: BinaryUpload): string[] {
  return [
    '-mode=UploadBinary',
    `-OrganizationId=${upload.organizationId}`,
    `-ProductId=${upload.productId}`,
    `-ArtifactId=${upload.artifactId}`,
    `-ClientId=${upload.clientId}`,
    `-ClientSecretEnvVar=${upload.secretVariable}`,
    `-BuildRoot=${upload.buildRoot}`,
    `-CloudDir=${upload.cloudDir}`,
    `-BuildVersion=${upload.buildVersion}`,
    `-AppLaunch=${upload.appLaunch}`,
    `-AppArgs=${upload.appArgs}`,
  ];
}

/** What is wrong with an upload before it starts, if anything. */
export function uploadProblems(upload: BinaryUpload, exists: (file: string) => boolean): string[] {
  const problems: string[] = [];
  for (const [name, value] of [
    ['EPIC_ORGANIZATION_ID', upload.organizationId],
    ['EOS_PRODUCT_ID', upload.productId],
    ['EPIC_ARTIFACT_ID', upload.artifactId],
    ['EPIC_BPT_CLIENT_ID', upload.clientId],
  ] as const) {
    if (!value) problems.push(`Set ${name} (Developer Portal; see docs/store/epic/README.md).`);
  }
  if (!exists(path.join(upload.buildRoot, upload.appLaunch))) problems.push(`${upload.buildRoot} has no ${upload.appLaunch}: run npm run epic:stage first.`);
  else if (!exists(epicConfigPath(upload.buildRoot)) || !exists(path.join(epicResourceFolder(upload.buildRoot), WINDOWS_SDK_LIBRARY))) {
    problems.push(`${upload.buildRoot} has no Epic SDK or epic.json: run npm run epic:stage first.`);
  }
  // BuildPatchTool keeps its working files in CloudDir, which must not be inside the build.
  const inside = path.relative(upload.buildRoot, upload.cloudDir);
  if (inside === '' || (!inside.startsWith('..') && !path.isAbsolute(inside))) problems.push('The cloud folder must be outside the build folder.');
  return problems;
}
