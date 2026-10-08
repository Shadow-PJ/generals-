import { afterEach, describe, expect, it, vi } from 'vitest';
import { EOS_RESULT, type EosCredentials, type EosSdk } from './eos';
import { epicLaunch, epicTarget, EpicStore, findEpicFiles, readEpicConfig, startEpic, type EpicConfig, type EpicLaunch } from './epic';

const CODE = 'a1b2c3d4e5f6exchange';

/**
 * A stand-in for Epic's SDK: each call's callback waits for the next tick, as the real SDK's
 * do, and every call is written down.
 */
function fakeSdk(options: { login?: number; firstTime?: boolean; createUser?: number; turnDown?: Record<string, number[]> } = {}) {
  const calls: string[] = [];
  let queue: (() => void)[] = [];
  const later = (fn: () => void) => void queue.push(fn);
  const refusals = new Map(Object.entries(options.turnDown ?? {}).map(([id, results]) => [id, [...results]]));
  const sdk: EosSdk = {
    initialize: () => EOS_RESULT.Success,
    createPlatform: () => 1n,
    tick() {
      const now = queue;
      queue = [];
      for (const fn of now) fn();
    },
    releasePlatform: () => void calls.push('release'),
    shutdown: () => void calls.push('shutdown'),
    authLogin(_platform, credentials: EosCredentials, done) {
      calls.push(`login ${credentials.kind}`);
      const result = options.login ?? EOS_RESULT.Success;
      later(() => done(result, result === EOS_RESULT.Success ? 10n : null));
    },
    copyIdToken: (_platform, account) => (account === 10n ? 'id.token.jwt' : null),
    connectLogin(_platform, token, done) {
      calls.push(`connect ${token}`);
      later(() => (options.firstTime ? done(EOS_RESULT.InvalidUser, null, 30n) : done(EOS_RESULT.Success, 20n, null)));
    },
    createUser(_platform, continuance, done) {
      calls.push(`create user ${continuance}`);
      const result = options.createUser ?? EOS_RESULT.Success;
      later(() => done(result, result === EOS_RESULT.Success ? 21n : null));
    },
    unlockAchievements(_platform, user, ids, done) {
      calls.push(`unlock ${ids.join(',')} as ${user}`);
      const result = refusals.get(ids[0]!)?.shift() ?? EOS_RESULT.Success;
      later(() => done(result));
    },
    setPresence(_platform, account, text, done) {
      calls.push(`presence "${text}" for ${account}`);
      later(() => done(EOS_RESULT.Success));
      return EOS_RESULT.Success;
    },
    resultName: (result) => `result ${result}`,
  };
  return { sdk, calls };
}

const exchange: EosCredentials = { kind: 'exchangeCode', code: CODE };

afterEach(() => {
  vi.useRealTimers();
});

describe('how the Epic Games Launcher started the app', () => {
  it('reads the launcher’s one-time code and sandbox, whatever their case', () => {
    const argv = ['Generals.exe', '-AUTH_LOGIN=unused', `-AUTH_PASSWORD=${CODE}`, '-AUTH_TYPE=exchangecode', '-epicapp=abc', '-epicenv=Prod', '-EpicPortal', '-epicsandboxid=live123', '-epiclocale=en-US'];
    expect(epicLaunch(argv)).toEqual({ credentials: { kind: 'exchangeCode', code: CODE }, sandboxId: 'live123', deploymentId: null, overlay: true });
    expect(epicLaunch(['x', `-auth_password=${CODE}`, '-auth_type=ExchangeCode', '-epicdeploymentid=dep9', '--eos-no-overlay'])).toEqual({
      credentials: { kind: 'exchangeCode', code: CODE },
      sandboxId: null,
      deploymentId: 'dep9',
      overlay: false,
    });
  });

  it('signs a developer in with Epic’s Developer Authentication Tool', () => {
    expect(epicLaunch(['x', '--eos-dev-auth=localhost:6547/Ali', '-epicsandboxid=dev1'])?.credentials).toEqual({ kind: 'developer', host: 'localhost:6547', name: 'Ali' });
  });

  it('is not Epic otherwise: no code, another kind of sign-in, or a half-given developer one', () => {
    expect(epicLaunch(['Generals.exe'])).toBeNull();
    expect(epicLaunch(['Generals.exe', '--smoke-test=play', '--steam-app-id=480'])).toBeNull();
    expect(epicLaunch(['x', '-AUTH_TYPE=exchangecode'])).toBeNull();
    expect(epicLaunch(['x', `-AUTH_PASSWORD=${CODE}`, '-AUTH_TYPE=password'])).toBeNull();
    expect(epicLaunch(['x', '--eos-dev-auth=localhost:6547'])).toBeNull();
    expect(epicLaunch(['x', '--eos-dev-auth=/Ali'])).toBeNull();
  });
});

const CONFIG: EpicConfig = {
  productId: 'prod0123456789abcdef',
  clientId: 'xyza7891abcdef',
  clientSecret: 'Secret+Value/With=Signs',
  deployments: { live123: 'depLive', stage456: 'depStage' },
};

describe('the Epic build’s settings (epic.json)', () => {
  it('reads well-formed settings and refuses anything else', () => {
    expect(readEpicConfig(JSON.stringify(CONFIG))).toEqual(CONFIG);
    expect(readEpicConfig(null)).toBeNull();
    expect(readEpicConfig('{')).toBeNull();
    expect(readEpicConfig(JSON.stringify({ ...CONFIG, deployments: {} }))).toBeNull();
    expect(readEpicConfig(JSON.stringify({ ...CONFIG, clientId: '' }))).toBeNull();
    expect(readEpicConfig(JSON.stringify({ ...CONFIG, productId: 'has spaces' }))).toBeNull();
    expect(readEpicConfig(JSON.stringify({ ...CONFIG, deployments: { live123: 7 } }))).toBeNull();
  });

  it('starts in the sandbox the launcher names, else the first (Live), with its deployment', () => {
    const launch = (sandboxId: string | null, deploymentId: string | null = null): EpicLaunch => ({ credentials: exchange, sandboxId, deploymentId, overlay: true });
    expect(epicTarget(CONFIG, launch('stage456'))).toEqual({ sandboxId: 'stage456', deploymentId: 'depStage' });
    expect(epicTarget(CONFIG, launch(null))).toEqual({ sandboxId: 'live123', deploymentId: 'depLive' });
    expect(epicTarget(CONFIG, launch('other', 'given'))).toEqual({ sandboxId: 'other', deploymentId: 'given' });
    expect(epicTarget(CONFIG, launch('other'))).toBeNull();
    expect(epicTarget(CONFIG, launch('constructor'))).toBeNull();
  });

  it('finds the SDK and epic.json together in the build’s resources, or in desktop/eos', () => {
    const files = new Map([
      ['/repo/desktop/eos/epic.json', JSON.stringify(CONFIG)],
      ['/repo/desktop/eos/EOSSDK-Win64-Shipping.dll', 'MZ'],
      ['/app/resources/eos/epic.json', JSON.stringify(CONFIG)],
    ]);
    const read = (file: string) => files.get(file.replaceAll('\\', '/')) ?? null;
    const exists = (file: string) => files.has(file.replaceAll('\\', '/'));
    const found = findEpicFiles(['/app/resources/eos', '/repo/desktop/eos'], read, exists, 'win32');
    expect(found?.library.replaceAll('\\', '/')).toBe('/repo/desktop/eos/EOSSDK-Win64-Shipping.dll');
    expect(found?.config).toEqual(CONFIG);
    expect(findEpicFiles(['/app/resources/eos'], read, exists, 'win32')).toBeNull();
    expect(findEpicFiles(['/repo/desktop/eos'], read, exists, 'aix')).toBeNull();
  });
});

describe('the Epic store', () => {
  it('signs in to the Epic account, then the game’s services, then unlocks what waited', () => {
    vi.useFakeTimers();
    const fake = fakeSdk();
    const store = new EpicStore(fake.sdk, 1n, { tickMs: 100 });
    store.start(exchange);
    store.unlock('RANK_2');
    store.unlock('RANK_2');
    store.unlock('not an id');
    expect(store.pending).toEqual(['RANK_2']);
    expect(fake.calls).toEqual(['login exchangeCode']);
    vi.advanceTimersByTime(100);
    expect(fake.calls).toEqual(['login exchangeCode', 'connect id.token.jwt']);
    expect(store.ready).toBe(false);
    vi.advanceTimersByTime(100);
    expect(store.ready).toBe(true);
    expect(fake.calls.at(-1)).toBe('unlock RANK_2 as 20');
    vi.advanceTimersByTime(100);
    expect(store.pending).toEqual([]);
    store.unlock('FINISHER');
    expect(fake.calls.at(-1)).toBe('unlock FINISHER as 20');
    store.stop();
    expect(fake.calls.slice(-2)).toEqual(['release', 'shutdown']);
  });

  it('creates the player’s user in the game’s services the first time', () => {
    vi.useFakeTimers();
    const fake = fakeSdk({ firstTime: true });
    const store = new EpicStore(fake.sdk, 1n);
    store.start(exchange);
    store.unlock('BOSS_WARLORD');
    vi.advanceTimersByTime(300);
    expect(fake.calls).toEqual(['login exchangeCode', 'connect id.token.jwt', 'create user 30', 'unlock BOSS_WARLORD as 21']);
    store.stop();
  });

  it('tries an achievement again a few times, then gives up on one Epic doesn’t have', () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const fake = fakeSdk({ turnDown: { RANK_3: [8], NOT_SET_UP: [18, 18, 18] } });
    const store = new EpicStore(fake.sdk, 1n, { tickMs: 100, retryMs: 1000, tries: 3, log: (line) => log.push(line) });
    store.start(exchange);
    store.unlock('RANK_3');
    store.unlock('NOT_SET_UP');
    vi.advanceTimersByTime(300);
    expect(store.pending).toEqual(['RANK_3', 'NOT_SET_UP']);
    vi.advanceTimersByTime(1100);
    expect(store.pending).toEqual(['NOT_SET_UP']);
    vi.advanceTimersByTime(1100);
    expect(store.pending).toEqual([]);
    expect(fake.calls.filter((c) => c.startsWith('unlock'))).toEqual([
      'unlock RANK_3 as 20',
      'unlock NOT_SET_UP as 20',
      'unlock RANK_3 as 20',
      'unlock NOT_SET_UP as 20',
      'unlock NOT_SET_UP as 20',
    ]);
    expect(log.at(-1)).toBe('Epic turned down the achievement NOT_SET_UP (result 18); is it set up in the Developer Portal?');
    store.stop();
  });

  it('shows presence as text once signed in, only when it changes, one at a time', () => {
    vi.useFakeTimers();
    const fake = fakeSdk();
    const store = new EpicStore(fake.sdk, 1n, { tickMs: 100 });
    store.presence({ line: 'Capital', params: {} });
    store.start(exchange);
    expect(fake.calls).toEqual(['login exchangeCode']);
    vi.advanceTimersByTime(100);
    expect(fake.calls).toContain('presence "In the Capital" for 10');
    store.presence({ line: 'Run', params: { region: 'Red Canyon' } });
    store.presence({ line: 'Boss', params: { ruler: 'The Warlord', region: 'Red Canyon' } });
    store.presence({ line: 'Unknown', params: {} });
    vi.advanceTimersByTime(300);
    store.presence({ line: 'Boss', params: { ruler: 'The Warlord', region: 'Red Canyon' } });
    store.presence(null);
    vi.advanceTimersByTime(300);
    expect(fake.calls.filter((c) => c.startsWith('presence'))).toEqual([
      'presence "In the Capital" for 10',
      'presence "Facing The Warlord in Red Canyon" for 10',
      'presence "" for 10',
    ]);
    store.stop();
  });

  it('keeps presence when only the game’s services refuse the player, and drops achievements', () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const fake = fakeSdk({ firstTime: true, createUser: 35 });
    const store = new EpicStore(fake.sdk, 1n, { log: (line) => log.push(line) });
    store.start(exchange);
    store.unlock('RANK_2');
    store.presence({ line: 'Versus', params: {} });
    vi.advanceTimersByTime(500);
    expect(store.pending).toEqual([]);
    expect(log).toContain('Epic achievements are off: creating the player’s user failed (result 35).');
    store.unlock('RANK_3');
    expect(store.pending).toEqual([]);
    expect(fake.calls).toContain('presence "In a versus match" for 10');
    store.stop();
  });
});

describe('starting Epic', () => {
  const launch: EpicLaunch = { credentials: exchange, sandboxId: 'live123', deploymentId: null, overlay: true };
  const base = { launch, config: CONFIG, library: 'EOSSDK-Win64-Shipping.dll', productVersion: '0.1.0', cacheDirectory: '/cache/eos' };

  it('creates the platform with the build’s ids and the launcher’s sandbox, and signs in', () => {
    vi.useFakeTimers();
    const fake = fakeSdk();
    const created: unknown[] = [];
    const log: string[] = [];
    const store = startEpic({
      ...base,
      log: (line) => log.push(line),
      load: () => ({ ...fake.sdk, createPlatform: (options) => (created.push(options), 1n) }),
    });
    expect(store).not.toBeNull();
    expect(created).toEqual([
      { productId: CONFIG.productId, sandboxId: 'live123', deploymentId: 'depLive', clientId: CONFIG.clientId, clientSecret: CONFIG.clientSecret, cacheDirectory: '/cache/eos', overlay: true },
    ]);
    expect(log).toEqual(['Epic is on, in sandbox live123.']);
    store!.stop();
  });

  it('runs without Epic when the SDK won’t load or start, or the sandbox is unknown', () => {
    const log: string[] = [];
    const quiet = { ...base, log: (line: string) => log.push(line) };
    expect(startEpic({ ...quiet, load: () => { throw new Error('no such file'); } })).toBeNull();
    expect(startEpic({ ...quiet, load: () => ({ ...fakeSdk().sdk, initialize: () => 1 }) })).toBeNull();
    expect(startEpic({ ...quiet, load: () => ({ ...fakeSdk().sdk, createPlatform: () => null }) })).toBeNull();
    expect(startEpic({ ...quiet, launch: { ...launch, sandboxId: 'unknown' }, load: () => fakeSdk().sdk })).toBeNull();
    expect(log).toHaveLength(4);
    for (const line of log) expect(line).toMatch(/^Epic is off/);
  });

  it('never writes the launcher’s code into the log', () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const fake = fakeSdk({ login: 1040 });
    const store = startEpic({ ...base, log: (line) => log.push(line), load: () => fake.sdk });
    vi.advanceTimersByTime(500);
    expect(log.at(-1)).toBe('Epic is off: signing in to the Epic account failed (result 1040).');
    store?.stop();
    const failing = startEpic({ ...base, log: (line) => log.push(line), load: () => { throw new Error('bad library'); } });
    expect(failing).toBeNull();
    expect(log.join('\n')).not.toContain(CODE);
  });
});
