import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPresence } from './presence';
import { startSteam, steamAppId, steamworksLoadProblem, SteamStore, type SteamClient } from './steam';

function fakeClient(turnDown = 0) {
  const unlocked: string[] = [];
  const presence = new Map<string, string>();
  let refusals = turnDown;
  const client: SteamClient = {
    achievement: {
      activate(name) {
        if (refusals > 0) {
          refusals -= 1;
          return false;
        }
        unlocked.push(name);
        return true;
      },
    },
    localplayer: {
      setRichPresence(key, value) {
        if (value === null || value === undefined) presence.delete(key);
        else presence.set(key, value);
      },
    },
  };
  return { client, unlocked, presence };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('which Steam app the desktop app runs as', () => {
  const none = () => null;
  it('takes the App ID Steam sets for the games it starts, then a test one given by hand', () => {
    expect(steamAppId({ SteamAppId: '2468100' }, [], none, [])).toBe(2468100);
    expect(steamAppId({}, ['generals', '--steam-app-id=480'], none, [])).toBe(480);
    expect(steamAppId({}, [], (file) => (file.endsWith('steam_appid.txt') ? '480\n' : null), ['C:\\Games\\Generals'])).toBe(480);
    expect(steamAppId({ SteamAppId: '2468100' }, ['--steam-app-id=480'], none, [])).toBe(2468100);
  });

  it('runs without Steam when nothing names an app, or what does is not a number', () => {
    expect(steamAppId({}, ['generals', '--smoke-test=play'], none, ['/opt/generals'])).toBeNull();
    expect(steamAppId({ SteamAppId: '' }, ['--steam-app-id=abc'], () => 'spacewar', ['/x'])).toBeNull();
    expect(steamAppId({ SteamAppId: '0' }, [], none, [])).toBeNull();
  });
});

describe('Steam achievements', () => {
  it('unlocks each once, and tries again while Steam is still loading the player’s stats', () => {
    vi.useFakeTimers();
    const fake = fakeClient(2);
    const store = new SteamStore(fake.client, { retryMs: 1000 });
    store.unlock('RANK_2');
    store.unlock('RANK_2');
    expect(fake.unlocked).toEqual([]);
    expect(store.pending).toEqual(['RANK_2']);
    vi.advanceTimersByTime(1000);
    expect(fake.unlocked).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(fake.unlocked).toEqual(['RANK_2']);
    expect(store.pending).toEqual([]);
    store.stop();
  });

  it('gives up on one Steam keeps turning down, and ignores names Steam can’t have', () => {
    vi.useFakeTimers();
    const lines: string[] = [];
    const fake = fakeClient(Infinity);
    const store = new SteamStore(fake.client, { retryMs: 10, tries: 3, log: (line) => lines.push(line) });
    store.unlock('NOT_SET_UP');
    store.unlock('lower case');
    store.unlock(42);
    vi.advanceTimersByTime(100);
    expect(store.pending).toEqual([]);
    expect(lines).toEqual(['Steam turned down the achievement NOT_SET_UP; is it set up in Steamworks?']);
  });
});

describe('Steam rich presence', () => {
  it('shows a line from the rich presence file with its words, and clears what the next one leaves out', () => {
    const fake = fakeClient();
    const store = new SteamStore(fake.client);
    store.presence({ line: 'Run', params: { region: 'Red Canyon' } });
    expect(Object.fromEntries(fake.presence)).toEqual({ steam_display: '#Run', region: 'Red Canyon' });
    store.presence({ line: 'Capital', params: {} });
    expect(Object.fromEntries(fake.presence)).toEqual({ steam_display: '#Capital' });
    store.presence(null);
    expect(fake.presence.size).toBe(0);
  });

  it('drops anything that isn’t a well-formed presence', () => {
    expect(readPresence({ line: 'Run', params: { region: 'Red Canyon' } })).toEqual({ line: 'Run', params: { region: 'Red Canyon' } });
    for (const bad of [
      'Run',
      { line: '#Run', params: {} },
      { line: 'Run' },
      { line: 'Run', params: { steam_display: 'x' } },
      { line: 'Run', params: { Region: 'x' } },
      { line: 'Run', params: { region: 'x'.repeat(257) } },
      { line: 'Run', params: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, 'v'])) },
    ]) {
      expect(readPresence(bad)).toBeNull();
    }
    const fake = fakeClient();
    new SteamStore(fake.client).presence({ line: 'Run', params: { region: 7 } });
    expect(fake.presence.size).toBe(0);
  });
});

describe('starting Steam', () => {
  it('runs without Steam when the module or Steam itself won’t start', () => {
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    expect(startSteam(480, log, () => {
      throw new Error('no native module');
    })).toBeNull();
    const notRunning = { init: () => { throw new Error('Steam is not running'); }, electronEnableSteamOverlay: () => undefined };
    expect(startSteam(480, log, () => notRunning)).toBeNull();
    expect(lines).toEqual(['Steam is off: steamworks.js did not load (Error: no native module).', 'Steam is off: it did not start (Error: Steam is not running).']);
  });

  it('turns the overlay on once Steam is running', () => {
    const fake = fakeClient();
    const overlay = vi.fn();
    const store = startSteam(480, () => undefined, () => ({ init: () => fake.client, electronEnableSteamOverlay: overlay }));
    expect(store).not.toBeNull();
    expect(overlay).toHaveBeenCalledOnce();
    store!.unlock('RANK_2');
    expect(fake.unlocked).toEqual(['RANK_2']);
  });

  it('can tell whether steamworks.js loads, without starting Steam', () => {
    expect(steamworksLoadProblem()).toBeNull();
    expect(steamworksLoadProblem(() => {
      throw new Error('libsteam_api.so: cannot open shared object file');
    })).toMatch(/libsteam_api/);
  });
});
