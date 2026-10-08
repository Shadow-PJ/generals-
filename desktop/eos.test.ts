import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { EOS_RESULT, koffiLoadProblem, loadEos, loadKoffi } from './eos';

const { koffi, types } = loadKoffi();

describe('Epic SDK structs', () => {
  // Sizes and member offsets as the SDK's headers give them on 64-bit Windows and Linux (8-byte
  // pointers, members on their natural alignment), worked out by hand from the headers.
  const layouts: [keyof typeof types, number, Record<string, number>][] = [
    ['InitializeOptions', 72, { ProductName: 32, ProductVersion: 40, OverrideThreadAffinity: 64 }],
    ['PlatformOptions', 144, { ProductId: 16, SandboxId: 24, ClientCredentials: 32, bIsServer: 48, DeploymentId: 80, Flags: 88, CacheDirectory: 96, TickBudgetInMilliseconds: 104, TaskNetworkTimeoutSeconds: 136 }],
    ['AuthCredentials', 48, { Id: 8, Token: 16, Type: 24, SystemAuthCredentialsOptions: 32, ExternalType: 40 }],
    ['AuthLoginOptions', 32, { Credentials: 8, ScopeFlags: 16, LoginFlags: 24 }],
    ['AuthLoginCallbackInfo', 56, { ClientData: 8, LocalUserId: 16, ContinuanceToken: 32, SelectedAccountId: 48 }],
    ['AuthCopyIdTokenOptions', 16, { AccountId: 8 }],
    ['AuthIdToken', 24, { AccountId: 8, JsonWebToken: 16 }],
    ['ConnectCredentials', 24, { Token: 8, Type: 16 }],
    ['ConnectLoginOptions', 24, { Credentials: 8, UserLoginInfo: 16 }],
    ['ConnectLoginCallbackInfo', 32, { ClientData: 8, LocalUserId: 16, ContinuanceToken: 24 }],
    ['ConnectCreateUserOptions', 16, { ContinuanceToken: 8 }],
    ['ConnectCreateUserCallbackInfo', 24, { LocalUserId: 16 }],
    ['UnlockAchievementsOptions', 32, { UserId: 8, AchievementIds: 16, AchievementsCount: 24 }],
    ['UnlockAchievementsCallbackInfo', 32, { UserId: 16, AchievementsCount: 24 }],
    ['CreatePresenceModificationOptions', 16, { LocalUserId: 8 }],
    ['SetStatusOptions', 8, { Status: 4 }],
    ['SetRawRichTextOptions', 16, { RichText: 8 }],
    ['SetPresenceOptions', 24, { LocalUserId: 8, PresenceModificationHandle: 16 }],
    ['SetPresenceCallbackInfo', 32, { LocalUserId: 16, RichPresenceResultCode: 24 }],
  ];

  it.runIf(koffi.sizeof('void *') === 8).each(layouts)('lays out %s as the SDK does', (name, size, offsets) => {
    expect(koffi.sizeof(types[name])).toBe(size);
    for (const [member, offset] of Object.entries(offsets)) expect(koffi.offsetof(types[name], member), member).toBe(offset);
  });

  it('loads koffi in this build, as the desktop smoke test checks', () => {
    expect(koffiLoadProblem()).toBeNull();
    expect(koffiLoadProblem(() => { throw new Error('missing'); })).toBe('Error: missing');
  });

  it('turns down a library that isn’t there', () => {
    expect(() => loadEos(path.join(tmpdir(), 'no-such-EOSSDK.dll'))).toThrow();
  });
});

// The binding called for real, against a stand-in for the SDK built from testing/fakeEos.c where
// the computer has a C compiler (Linux and macOS CI; Windows CI has none, so it skips).
const work = mkdtempSync(path.join(tmpdir(), 'generals-eos-'));
const library = path.join(work, process.platform === 'darwin' ? 'libfake.dylib' : 'libfake.so');
const built =
  process.platform !== 'win32' &&
  spawnSync('cc', ['-shared', '-fPIC', '-o', library, path.join(import.meta.dirname, 'testing', 'fakeEos.c')], { encoding: 'utf8' }).status === 0;

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe.runIf(built)('the binding, against a stand-in SDK', () => {
  it('passes every option, signs in, unlocks and shows presence through the SDK’s callbacks', () => {
    const sdk = loadEos(library);
    const fake = koffi.load(library);
    const notes = fake.func('Fake_Last', 'const char *', []);
    const said: string[] = [];
    expect(sdk.initialize('Generals', '0.1.0')).toBe(EOS_RESULT.Success);
    const platform = sdk.createPlatform({
      productId: 'prod',
      sandboxId: 'sandbox',
      deploymentId: 'deployment',
      clientId: 'client',
      clientSecret: 'secret',
      cacheDirectory: '/tmp/eos',
      overlay: false,
    });
    expect(platform).not.toBeNull();
    sdk.authLogin(platform!, { kind: 'exchangeCode', code: 'CODE' }, (result, account) => {
      said.push(`login ${sdk.resultName(result)}`);
      const token = sdk.copyIdToken(platform!, account!);
      sdk.connectLogin(platform!, token!, (connected, user, continuance) => {
        said.push(`connect ${sdk.resultName(connected)} ${user === null}`);
        sdk.createUser(platform!, continuance!, (created, newUser) => {
          said.push(`created ${sdk.resultName(created)}`);
          sdk.unlockAchievements(platform!, newUser!, ['RANK_2', 'FINISHER'], (unlocked) => said.push(`unlocked ${sdk.resultName(unlocked)}`));
          const started = sdk.setPresence(platform!, account!, 'On a run in Red Canyon', (shown) => said.push(`presence ${sdk.resultName(shown)}`));
          said.push(`presence started ${started}`);
        });
      });
    });
    for (let i = 0; i < 5; i++) sdk.tick(platform!);
    sdk.authLogin(platform!, { kind: 'developer', host: 'localhost:6547', name: 'Ali' }, () => said.push('developer'));
    sdk.tick(platform!);
    sdk.releasePlatform(platform!);
    sdk.shutdown();
    expect(said).toEqual([
      'login EOS_Success',
      'connect EOS_InvalidUser true',
      'created EOS_Success',
      'presence started 0',
      'unlocked EOS_Success',
      'presence EOS_Success',
      'developer',
    ]);
    expect((notes() as string).split(';').filter(Boolean)).toEqual([
      'init 5 Generals 0.1.0 null',
      'platform 15 prod sandbox client secret deployment 0 2 /tmp/eos 0 null',
      'login 3 4 (null) CODE 1 scopes 5 flags 0',
      'copy token',
      'token released',
      'connect 2 1 header.payload.signature 16 null',
      'create user',
      'unlock 1 user 2: RANK_2 FINISHER',
      'modify',
      'status 1 1',
      'text 1 On a run in Red Canyon',
      'set presence',
      'modification released',
      'login 3 4 localhost:6547 Ali 4 scopes 5 flags 0',
      'release',
      'shutdown',
    ]);
  });
});
