import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readEpicConfig } from '../../desktop/epic';
import {
  buildVersion,
  epicConfigFromEnv,
  epicConfigPath,
  epicConfigText,
  parseDeployments,
  stageProblems,
  uploadArgs,
  uploadProblems,
  type BinaryUpload,
} from './epicBuild';

const ENV = {
  EOS_PRODUCT_ID: 'prod0123456789abcdef0123456789ab',
  EOS_CLIENT_ID: 'xyza7891AbCdEf',
  EOS_CLIENT_SECRET: 'Sec+ret/Value=',
  EOS_DEPLOYMENTS: 'liveSandbox:liveDeployment, p-devSandbox:devDeployment',
};

describe('epic.json from the Developer Portal’s ids', () => {
  it('reads each sandbox and its deployment, Live first', () => {
    expect(parseDeployments('a:1,b:2')).toEqual({ a: '1', b: '2' });
    expect(Object.keys(parseDeployments(' b:2 , a:1 ')!)).toEqual(['b', 'a']);
    for (const bad of ['', 'a', 'a:', ':1', 'a:1:2', 'a:1,a:2']) expect(parseDeployments(bad), bad).toBeNull();
  });

  it('makes the settings the app reads back, and says what is missing', () => {
    const made = epicConfigFromEnv(ENV);
    expect('config' in made && made.config).toEqual({
      productId: ENV.EOS_PRODUCT_ID,
      clientId: ENV.EOS_CLIENT_ID,
      clientSecret: ENV.EOS_CLIENT_SECRET,
      deployments: { liveSandbox: 'liveDeployment', 'p-devSandbox': 'devDeployment' },
    });
    if ('config' in made) expect(readEpicConfig(epicConfigText(made.config))).toEqual(made.config);
    const missing = epicConfigFromEnv({ EOS_PRODUCT_ID: 'x' });
    expect('problems' in missing && missing.problems.map((p) => p.split(' ')[1])).toEqual(['EOS_CLIENT_ID', 'EOS_CLIENT_SECRET', 'EOS_DEPLOYMENTS']);
    const wrong = epicConfigFromEnv({ ...ENV, EOS_CLIENT_ID: 'has a space' });
    expect('problems' in wrong).toBe(true);
  });
});

describe('staging the Epic build', () => {
  const windowsApp = new Set([path.join('release', 'win-unpacked', 'Generals.exe'), path.join('release', 'win-unpacked', 'resources', 'app.asar')]);
  const source = path.join('release', 'win-unpacked');
  const dll = new Uint8Array([0x4d, 0x5a, 0x90, 0]);

  it('needs the unpacked Windows app and the Windows SDK library', () => {
    expect(stageProblems(source, dll, (f) => windowsApp.has(f))).toEqual([]);
    expect(stageProblems(source, null, (f) => windowsApp.has(f))[0]).toMatch(/SDK library is missing/);
    expect(stageProblems(source, new Uint8Array([0x7f, 0x45, 0x4c, 0x46]), (f) => windowsApp.has(f))[0]).toMatch(/not a Windows library/);
    expect(stageProblems(path.join('release', 'linux-unpacked'), dll, (f) => windowsApp.has(f))[0]).toMatch(/not the unpacked Windows app/);
  });

  it('puts epic.json in the app’s resources, where the app looks', () => {
    expect(epicConfigPath(path.join('release', 'epic', 'Generals'))).toBe(path.join('release', 'epic', 'Generals', 'resources', 'eos', 'epic.json'));
  });
});

describe('uploading with BuildPatchTool', () => {
  const root = path.join('release', 'epic', 'Generals');
  const upload: BinaryUpload = {
    organizationId: 'o-abc',
    productId: 'prod',
    artifactId: 'art',
    clientId: 'bpt',
    secretVariable: 'EPIC_BPT_CLIENT_SECRET',
    buildRoot: root,
    cloudDir: path.join('release', 'epic', 'cloud'),
    buildVersion: buildVersion('0.1.0', 'abc1234', '202610081200'),
    appLaunch: 'Generals.exe',
    appArgs: '',
  };
  const staged = new Set([path.join(root, 'Generals.exe'), path.join(root, 'resources', 'eos', 'epic.json'), path.join(root, 'resources', 'eos', 'EOSSDK-Win64-Shipping.dll')]);

  it('uploads the staged folder as a new binary, with the secret left in the environment', () => {
    expect(upload.buildVersion).toBe('0.1.0-abc1234-202610081200');
    const args = uploadArgs(upload);
    expect(args).toContain('-mode=UploadBinary');
    expect(args).toContain('-ClientSecretEnvVar=EPIC_BPT_CLIENT_SECRET');
    expect(args).toContain(`-BuildRoot=${root}`);
    expect(args).toContain('-AppLaunch=Generals.exe');
    expect(args.some((arg) => /^-ClientSecret=/.test(arg))).toBe(false);
    expect(uploadProblems(upload, (f) => staged.has(f))).toEqual([]);
  });

  it('stops before uploading when an id is missing, the folder isn’t staged, or the cloud folder is inside it', () => {
    expect(uploadProblems({ ...upload, artifactId: '' }, (f) => staged.has(f))).toEqual(['Set EPIC_ARTIFACT_ID (Developer Portal; see docs/store/epic/README.md).']);
    expect(uploadProblems(upload, (f) => f.endsWith('Generals.exe'))[0]).toMatch(/no Epic SDK or epic.json/);
    expect(uploadProblems(upload, () => false)[0]).toMatch(/run npm run epic:stage first/);
    expect(uploadProblems({ ...upload, cloudDir: path.join(root, 'cloud') }, (f) => staged.has(f))).toEqual(['The cloud folder must be outside the build folder.']);
  });
});
