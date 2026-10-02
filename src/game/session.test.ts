import { beforeEach, describe, expect, it } from 'vitest';
import type { FileName, Platform } from '../platform';
import { readProfile } from '../save/profile';
import { readSettings } from '../save/settings';
import {
  applyWindowSettings,
  availableWindowScales,
  changeSettings,
  chosenWindowScale,
  remember,
  savedSetup,
  startSession,
  toggleFullscreen,
} from './session';

/** A platform that keeps files in memory and records what it was asked to do. */
function fakePlatform(options: { desktop: boolean; files?: Partial<Record<FileName, string>> }) {
  const files = new Map<FileName, string>(Object.entries(options.files ?? {}) as [FileName, string][]);
  const log: string[] = [];
  let fullscreen = false;
  let failWrites = false;
  const platform: Platform = {
    kind: options.desktop ? 'desktop' : 'browser',
    files: {
      read: async (name) => files.get(name) ?? null,
      write: async (name, text) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));
        if (failWrites) throw new Error('disk full');
        log.push(`write ${name}`);
        files.set(name, text);
      },
    },
    display: {
      canSizeWindow: options.desktop,
      canFullscreen: true,
      isFullscreen: () => fullscreen,
      setFullscreen: async (on) => {
        fullscreen = on;
        log.push(`fullscreen ${on}`);
      },
      workArea: () => (options.desktop ? { width: 1920, height: 1040 } : null),
      setWindowSize: async (w, h) => void log.push(`size ${w}x${h}`),
      onFullscreenChange: () => undefined,
    },
    saveFolder: null,
    openSaveFolder: null,
    quit: null,
    ready: () => undefined,
    loadModel: async () => {
      throw new Error('no model in tests');
    },
  };
  return { platform, files, log, failNextWrites: (on: boolean) => (failWrites = on) };
}

describe('the session', () => {
  let fake: ReturnType<typeof fakePlatform>;

  beforeEach(async () => {
    fake = fakePlatform({ desktop: true });
    await startSession(fake.platform);
  });

  it('remembers your cards, troops, rank and Tactical mode in saves/profile.json', async () => {
    const setup = savedSetup();
    setup.loadout.slots[1] = { condition: null, steps: [{ action: 'hold', actors: { kind: 'all' } }], auto: false };
    setup.rank = 4;
    setup.tactical = true;
    setup.general = 'conductor';
    await remember(setup);
    const profile = readProfile(fake.files.get('saves/profile.json') ?? null);
    expect(profile.loadout.slots[1]?.steps[0]?.action).toBe('hold');
    expect(profile.rank).toBe(4);
    expect(profile.tactical).toBe(true);
    expect(profile.general).toBe('conductor');

    // The next start picks it all up again.
    await startSession(fake.platform);
    expect(savedSetup()).toEqual(setup);
  });

  it('keeps saves in order and skips writing a file that did not change', async () => {
    const setup = savedSetup();
    const saves = [1, 2, 3, 4, 5].map((rank) => remember({ ...setup, rank: rank as 1 | 2 | 3 | 4 | 5 }));
    await Promise.all(saves);
    expect(readProfile(fake.files.get('saves/profile.json') ?? null).rank).toBe(5);
    const writes = fake.log.length;
    await remember({ ...setup, rank: 5 });
    expect(fake.log.length).toBe(writes);
  });

  it('reports a failed save, and the next save still goes through', async () => {
    fake.failNextWrites(true);
    await expect(remember({ ...savedSetup(), rank: 2 })).rejects.toThrow('disk full');
    fake.failNextWrites(false);
    await remember({ ...savedSetup(), rank: 4 });
    expect(readProfile(fake.files.get('saves/profile.json') ?? null).rank).toBe(4);
  });

  it('gives each screen its own copy of the saved setup', () => {
    savedSetup().loadout.slots[0] = { condition: null, steps: [], auto: false };
    expect(savedSetup().loadout.slots[0]).toBeNull();
  });

  it('keeps settings in settings.json, apart from the saves', async () => {
    await changeSettings({ resolution: 1.5 });
    expect(readSettings(fake.files.get('settings.json') ?? null).resolution).toBe(1.5);
    expect(fake.files.has('saves/profile.json')).toBe(false);
  });

  it('sizes the desktop window to the largest size that fits, or to the saved one', async () => {
    expect(availableWindowScales()).toEqual([1, 1.25]);
    expect(chosenWindowScale()).toBe(1.25);
    await applyWindowSettings();
    expect(fake.log).toEqual(['size 1200x880']);
    await changeSettings({ windowScale: 1 });
    expect(chosenWindowScale()).toBe(1);
    // A saved size bigger than this screen allows shrinks to what fits.
    await changeSettings({ windowScale: 2 });
    expect(chosenWindowScale()).toBe(1.25);
  });

  it('restores fullscreen on the desktop, and remembers F11', async () => {
    await toggleFullscreen();
    expect(readSettings(fake.files.get('settings.json') ?? null).fullscreen).toBe(true);
    await startSession(fake.platform);
    fake.log.length = 0;
    await applyWindowSettings();
    expect(fake.log).toEqual(['size 1200x880', 'fullscreen true']);
  });

  it('leaves the window alone in a browser, and does not save fullscreen there', async () => {
    const browser = fakePlatform({ desktop: false });
    await startSession(browser.platform);
    expect(availableWindowScales()).toEqual([]);
    expect(chosenWindowScale()).toBeNull();
    await applyWindowSettings();
    await toggleFullscreen();
    expect(browser.log).toEqual(['fullscreen true']);
    expect(browser.files.has('settings.json')).toBe(false);
  });
});
