import { beforeEach, describe, expect, it } from 'vitest';
import { RANK_XP } from '../data/progression';
import type { FileName, Platform } from '../platform';
import { readProfile } from '../save/profile';
import { readSettings } from '../save/settings';
import {
  applyWindowSettings,
  availableWindowScales,
  changeSettings,
  chosenWindowScale,
  currentXp,
  foundCombos,
  gainXp,
  recordCombo,
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
    speech: null,
  };
  return { platform, files, log, failNextWrites: (on: boolean) => (failWrites = on) };
}

describe('the session', () => {
  let fake: ReturnType<typeof fakePlatform>;

  beforeEach(async () => {
    fake = fakePlatform({ desktop: true });
    await startSession(fake.platform);
  });

  it('remembers your cards, troops, bosses beaten and Tactical mode in saves/profile.json', async () => {
    const setup = savedSetup();
    setup.loadout.slots[1] = { condition: null, steps: [{ action: 'hold', actors: { kind: 'all' } }], auto: false };
    setup.bossesBeaten = ['hiveMother'];
    setup.tactical = true;
    setup.general = 'conductor';
    await remember(setup);
    const profile = readProfile(fake.files.get('saves/profile.json') ?? null);
    expect(profile.loadout.slots[1]?.steps[0]?.action).toBe('hold');
    expect(profile.bossesBeaten).toEqual(['hiveMother']);
    expect(profile.tactical).toBe(true);
    expect(profile.general).toBe('conductor');

    // The next start picks it all up again.
    await startSession(fake.platform);
    expect(savedSetup()).toEqual(setup);
  });

  it('starts a new player at Rank I; only Command XP raises the rank', async () => {
    expect(savedSetup().rank).toBe(1);
    await remember({ ...savedSetup(), rank: 5 });
    expect(savedSetup().rank).toBe(1);
    await gainXp(RANK_XP[2]);
    expect(currentXp()).toBe(RANK_XP[2]);
    expect(savedSetup().rank).toBe(2);
    expect(readProfile(fake.files.get('saves/profile.json') ?? null).xp).toBe(RANK_XP[2]);
  });

  it('brings an older save up to date, keeping the old file as a backup', async () => {
    const v1 = JSON.stringify({ version: 1, rank: 4, tactical: true, loadout: { slots: [], legendary: null } });
    fake.files.set('saves/profile.json', v1);
    await startSession(fake.platform);
    expect(savedSetup()).toMatchObject({ rank: 4, tactical: true, bossesBeaten: [] });
    expect(fake.files.get('saves/profile-backup.json')).toBe(v1);
    expect(JSON.parse(fake.files.get('saves/profile.json')!)).toMatchObject({ version: 2, xp: RANK_XP[4] });
    // Already up to date: no new backup.
    fake.files.delete('saves/profile-backup.json');
    await startSession(fake.platform);
    expect(fake.files.has('saves/profile-backup.json')).toBe(false);
  });

  it('adds a combo to the Codex once, saves it, and keeps it when your cards change', async () => {
    expect(foundCombos()).toEqual([]);
    await recordCombo('ironShell');
    expect(recordCombo('ironShell')).toBeNull();
    await recordCombo('feignedRetreat');
    expect(foundCombos()).toEqual(['feignedRetreat', 'ironShell']);
    await remember({ ...savedSetup(), tactical: true });
    expect(readProfile(fake.files.get('saves/profile.json') ?? null).codex).toEqual(['feignedRetreat', 'ironShell']);
    await startSession(fake.platform);
    expect(foundCombos()).toEqual(['feignedRetreat', 'ironShell']);
  });

  it('keeps saves in order and skips writing a file that did not change', async () => {
    const setup = savedSetup();
    const generals = ['warlord', 'engineer', 'hiveMother', 'strategist', 'conductor'] as const;
    const saves = generals.map((general) => remember({ ...setup, general }));
    await Promise.all(saves);
    expect(readProfile(fake.files.get('saves/profile.json') ?? null).general).toBe('conductor');
    const writes = fake.log.length;
    await remember({ ...setup, general: 'conductor' });
    expect(fake.log.length).toBe(writes);
  });

  it('reports a failed save, and the next save still goes through', async () => {
    fake.failNextWrites(true);
    await expect(remember({ ...savedSetup(), general: 'warlord' })).rejects.toThrow('disk full');
    fake.failNextWrites(false);
    await remember({ ...savedSetup(), general: 'engineer' });
    expect(readProfile(fake.files.get('saves/profile.json') ?? null).general).toBe('engineer');
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
