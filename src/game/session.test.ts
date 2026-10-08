import { beforeEach, describe, expect, it } from 'vitest';
import { newCampaign } from '../campaign/company';
import { fieldPlacement, withRole } from '../campaign/army';
import { enterNode, newRun } from '../campaign/run';
import { STARTER_ORDERS } from '../data/armies';
import { MAPS } from '../data/maps';
import { RANK_XP } from '../data/progression';
import { NO_STORE, type FileName, type Platform, type Store } from '../platform';
import { newProfile, readProfile, writeProfile } from '../save/profile';
import { readSettings } from '../save/settings';
import {
  applyWindowSettings,
  availableWindowScales,
  changeSettings,
  chosenWindowScale,
  currentCampaign,
  currentTutorial,
  currentXp,
  earnedRank,
  foundCombos,
  gainXp,
  recordCombo,
  remember,
  saveCampaign,
  saveTutorial,
  savedSetup,
  startSession,
  toggleFullscreen,
} from './session';

/** A platform that keeps files in memory and records what it was asked to do. */
function fakePlatform(options: { desktop: boolean; files?: Partial<Record<FileName, string>>; store?: Store }) {
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
    network: { defaultRelay: 'ws://localhost:8787', connect: () => Promise.reject(new Error('offline')) },
    store: options.store ?? NO_STORE,
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
    await saveCampaign({ ...currentCampaign(), bossesBeaten: ['hiveMother'] });
    const setup = savedSetup();
    setup.loadout.slots[1] = { condition: null, steps: [{ action: 'hold', actors: { kind: 'all' } }], auto: false };
    setup.tactical = true;
    setup.general = 'hiveMother';
    await remember(setup);
    const profile = readProfile(fake.files.get('saves/profile.json') ?? null);
    expect(profile.loadout.slots[1]?.steps[0]?.action).toBe('hold');
    expect(profile.bossesBeaten).toEqual(['hiveMother']);
    expect(profile.tactical).toBe(true);
    expect(profile.general).toBe('hiveMother');

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

  it('lets you practise at any rank in skirmish, and goes back to your earned rank after', async () => {
    await gainXp(RANK_XP[2]);
    await remember({ ...savedSetup(), practiceRank: 5 });
    expect(savedSetup()).toMatchObject({ rank: 5, practiceRank: 5 });
    expect(earnedRank()).toBe(2);
    await startSession(fake.platform);
    expect(savedSetup().rank).toBe(5);
    await remember({ ...savedSetup(), practiceRank: null });
    expect(savedSetup()).toMatchObject({ rank: 2, practiceRank: null });
  });

  it('brings an older save up to date, keeping the old file as a backup', async () => {
    const v1 = JSON.stringify({ version: 1, rank: 4, tactical: true, loadout: { slots: [], legendary: null } });
    fake.files.set('saves/profile.json', v1);
    await startSession(fake.platform);
    expect(savedSetup()).toMatchObject({ rank: 4, tactical: true, bossesBeaten: [] });
    expect(fake.files.get('saves/profile-backup.json')).toBe(v1);
    expect(JSON.parse(fake.files.get('saves/profile.json')!)).toMatchObject({ version: 8, xp: RANK_XP[4], run: null, artifacts: [], tutorial: { on: false, seen: [] }, oaths: {}, fearRecords: {} });
    // Already up to date: no new backup.
    fake.files.delete('saves/profile-backup.json');
    await startSession(fake.platform);
    expect(fake.files.has('saves/profile-backup.json')).toBe(false);
  });

  it("saves the Captain's tips you have seen, and picks them up after a restart", async () => {
    expect(currentTutorial()).toEqual({ on: true, seen: [] });
    await saveTutorial({ on: true, seen: ['capital', 'battleStart'] });
    await startSession(fake.platform);
    expect(currentTutorial()).toEqual({ on: true, seen: ['capital', 'battleStart'] });
  });

  it('leads with a General you have recruited by beating them, else the Captain', async () => {
    await remember({ ...savedSetup(), general: 'warlord' });
    expect(savedSetup().general).toBe('captain');
    await saveCampaign({ ...currentCampaign(), bossesBeaten: ['warlord'] });
    expect(savedSetup().general).toBe('warlord');
  });

  it('saves the run you are on and your banked artifacts, and picks them up after a restart', async () => {
    expect(currentCampaign()).toEqual(newCampaign());
    let campaign = enterNode(newRun(currentCampaign(), 'deepForest', 99), 0);
    campaign = { ...campaign, artifacts: ['warHorn'], run: withRole(campaign.run!, 8, 'rest') };
    await saveCampaign(campaign);
    await startSession(fake.platform);
    expect(currentCampaign()).toEqual(campaign);
  });

  it('tells the store about achievements as your save earns them, each once, starting with those earned before', async () => {
    const unlocked: string[] = [];
    const store: Store = { name: 'steam', unlockAchievement: (id) => unlocked.push(id), setPresence: () => undefined };
    const steam = fakePlatform({ desktop: true, store, files: { 'saves/profile.json': writeProfile({ ...newProfile(), bossesBeaten: ['hiveMother'] }) } });
    await startSession(steam.platform);
    expect(unlocked).toEqual(['BOSS_HIVE_MOTHER']);
    await gainXp(1_000_000);
    expect(unlocked).toEqual(['BOSS_HIVE_MOTHER', 'RANK_2', 'RANK_3', 'RANK_4', 'RANK_5']);
    await gainXp(10);
    expect(unlocked).toHaveLength(5);
  });

  it('a campaign fight keeps your cards and General, but never replaces your skirmish army or practice rank', async () => {
    await saveCampaign({ ...currentCampaign(), bossesBeaten: ['warlord'] });
    await remember({ ...savedSetup(), practiceRank: 4 });
    const skirmish = savedSetup();
    const campaign = enterNode(newRun(currentCampaign(), 'voidRuins', 5), 0);
    const run = campaign.run!;
    const stop = run.stop;
    const encounter = stop?.kind === 'fight' ? stop.encounter : null;
    await remember({
      ...skirmish,
      general: 'warlord',
      practiceRank: null,
      placement: fieldPlacement(run, MAPS.voidRuins),
      map: 'voidRuins',
      fight: { encounter: encounter!, reserves: [], boons: [], tech: {} },
    });
    expect(savedSetup()).toEqual({ ...skirmish, general: 'warlord' });
  });

  it('drops a run that doesn’t read, and keeps the rest of the save', async () => {
    await saveCampaign(newRun(currentCampaign(), 'deepForest', 3));
    const damaged = JSON.parse(fake.files.get('saves/profile.json')!);
    damaged.run.roster[0].cls = 'dragon';
    damaged.tactical = true;
    fake.files.set('saves/profile.json', JSON.stringify(damaged));
    await startSession(fake.platform);
    expect(currentCampaign().run).toBeNull();
    expect(savedSetup().tactical).toBe(true);
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
    expect(savedSetup().loadout.slots[0]).toEqual(STARTER_ORDERS[0]);
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
