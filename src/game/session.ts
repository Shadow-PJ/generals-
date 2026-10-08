// The running game's link to the computer: the platform, your saved profile and this
// computer's settings. Screens read from here and call remember() when your cards, troops or
// rank change, so closing the game at any moment keeps them. Every change to your profile also
// tells the store about achievements it earned (session 7A).

import type { Campaign } from '../campaign/types';
import { windowScales, type FileName, type Platform } from '../platform';
import { CODEX_ENTRY_IDS, type CodexEntryId } from '../data/combos';
import { AchievementReporter } from './achievements';
import { rankForXp } from './progress';
import {
  newProfile,
  PROFILE_BACKUP_FILE,
  PROFILE_FILE,
  PROFILE_VERSION,
  profileVersion,
  readProfile,
  writeProfile,
  type Profile,
  type Tutorial,
} from '../save/profile';
import { defaultSettings, readSettings, SETTINGS_FILE, writeSettings, type Settings } from '../save/settings';
import { recruitedGenerals } from '../data/bosses';
import type { RankNumber } from '../data/ranks';
import type { MatchSetup } from './match';
import { GAME_HEIGHT, GAME_WIDTH } from './theme';

let platform: Platform | null = null;
let profile: Profile = newProfile();
let settings: Settings = defaultSettings();
/** The last text written to each file, so unchanged saves aren't written again. */
const written = new Map<FileName, string>();
/** Writes go one after another, so an older save can never land after a newer one. */
let writeQueue: Promise<void> = Promise.resolve();
/** Tells the store about achievements as your profile earns them. */
let achievements: AchievementReporter | null = null;

export async function startSession(p: Platform): Promise<void> {
  platform = p;
  const [profileText, settingsText] = await Promise.all([p.files.read(PROFILE_FILE), p.files.read(SETTINGS_FILE)]);
  profile = readProfile(profileText);
  settings = readSettings(settingsText);
  written.clear();
  // Achievements earned before the game ran in a store unlock there now.
  achievements = new AchievementReporter((id) => p.store.unlockAchievement(id));
  achievements.report(profile);
  if (profileText !== null) written.set(PROFILE_FILE, profileText);
  if (settingsText !== null) written.set(SETTINGS_FILE, settingsText);
  // An older save was brought up to date: keep the old file as a backup, then save the new one.
  const version = profileVersion(profileText);
  if (profileText !== null && version !== null && version < PROFILE_VERSION) {
    await write(PROFILE_BACKUP_FILE, profileText).catch(() => undefined);
    await write(PROFILE_FILE, writeProfile(profile)).catch(() => undefined);
  }
}

export function currentPlatform(): Platform {
  if (!platform) throw new Error('The session has not started');
  return platform;
}

/** Your troops, cards, rank, Tactical mode and General as last saved. */
export function savedSetup(): MatchSetup {
  const { placement, loadout, xp, bossesBeaten, practiceRank, tactical, general, reserves, specs, map, enemyArmy, enemyGeneral, enemyCommander } =
    structuredClone(profile);
  const rank = practiceRank ?? rankForXp(xp);
  // You lead with a General you have recruited; the Captain until then.
  return {
    placement,
    loadout,
    rank,
    practiceRank,
    bossesBeaten,
    tactical,
    general: recruitedGenerals(bossesBeaten).includes(general) ? general : 'captain',
    reserves,
    specs,
    map,
    enemyArmy,
    enemyGeneral,
    enemyCommander,
    fight: null,
  };
}

/** The rank your Command XP has earned. */
export function earnedRank(): RankNumber {
  return rankForXp(profile.xp);
}

/**
 * Saves your cards, Tactical mode and General, and in a skirmish your troops and the skirmish
 * itself. A campaign fight's army belongs to the run, and a versus match's map and rank to its
 * host, so neither replaces your skirmish. Resolves once the file is written. Your rank isn't
 * taken from the setup: only Command XP raises it (gainXp), and only the campaign beats bosses.
 */
export function remember(setup: MatchSetup): Promise<void> {
  const skirmish: Partial<Profile> =
    setup.fight === null && !setup.versus
      ? {
          placement: setup.placement.map(({ cls, x, y }) => ({ cls, x, y })),
          practiceRank: setup.practiceRank,
          reserves: [...setup.reserves],
          specs: { ...setup.specs },
          map: setup.map,
          enemyArmy: setup.enemyArmy,
          enemyGeneral: setup.enemyGeneral,
          enemyCommander: setup.enemyCommander,
        }
      : {};
  profile = {
    ...profile,
    version: PROFILE_VERSION,
    loadout: structuredClone(setup.loadout),
    tactical: setup.versus ? profile.tactical : setup.tactical,
    general: setup.general,
    ...skirmish,
  };
  return write(PROFILE_FILE, writeProfile(profile));
}

/** The campaign as saved: your run, banked artifacts, the bosses you have beaten, your company, Insight, Tech Web, Ironman, Mastery, oaths, Fear records and endless best. */
export function currentCampaign(): Campaign {
  const { run, artifacts, bossesBeaten, company, insight, tech, ironman, mastery, oaths, fearRecords, endlessBest } = profile;
  return structuredClone({ run, artifacts, bossesBeaten, company, insight, tech, ironman, mastery, oaths, fearRecords, endlessBest });
}

/** Saves the campaign after a step of a run. Resolves once the file is written. */
export function saveCampaign(campaign: Campaign): Promise<void> {
  profile = { ...profile, ...structuredClone(campaign) };
  return write(PROFILE_FILE, writeProfile(profile));
}

/** Your Command XP. */
export function currentXp(): number {
  return profile.xp;
}

/** Adds Command XP from a battle and saves it. Resolves once the file is written. */
export function gainXp(amount: number): Promise<void> {
  profile = { ...profile, xp: profile.xp + Math.max(0, Math.round(amount)) };
  return write(PROFILE_FILE, writeProfile(profile));
}

/** The combos you have found so far, in Codex order. */
export function foundCombos(): CodexEntryId[] {
  return [...profile.codex];
}

/** Adds a combo to the Codex and saves it; null when it was already there. */
export function recordCombo(id: CodexEntryId): Promise<void> | null {
  if (profile.codex.includes(id)) return null;
  profile = { ...profile, codex: CODEX_ENTRY_IDS.filter((e) => e === id || profile.codex.includes(e)) };
  return write(PROFILE_FILE, writeProfile(profile));
}

/** The Captain's tips: on or off, and which you have seen. */
export function currentTutorial(): Tutorial {
  return structuredClone(profile.tutorial);
}

/** Saves the tutorial: a tip seen, tips turned off, or played again. */
export function saveTutorial(tutorial: Tutorial): Promise<void> {
  profile = { ...profile, tutorial: structuredClone(tutorial) };
  return write(PROFILE_FILE, writeProfile(profile));
}

export function currentSettings(): Settings {
  return { ...settings };
}

export function changeSettings(change: Partial<Omit<Settings, 'version'>>): Promise<void> {
  settings = { ...settings, ...change };
  return write(SETTINGS_FILE, writeSettings(settings));
}

function write(name: FileName, text: string): Promise<void> {
  const p = currentPlatform();
  if (name === PROFILE_FILE) achievements?.report(profile);
  const next = writeQueue.then(async () => {
    if (written.get(name) === text) return;
    await p.files.write(name, text);
    written.set(name, text);
  });
  // A failed write is reported to the caller; it must not block the writes after it.
  writeQueue = next.catch(() => undefined);
  return next;
}

/** Window sizes this screen fits, as multiples of the base size; empty in a browser. */
export function availableWindowScales(): number[] {
  const area = currentPlatform().display.workArea();
  return area ? windowScales(area, { width: GAME_WIDTH, height: GAME_HEIGHT }) : [];
}

/** The saved window size if it still fits, else the largest size that does. */
export function chosenWindowScale(): number | null {
  const scales = availableWindowScales();
  if (scales.length === 0) return null;
  const wanted = settings.windowScale;
  const fitting = wanted === null ? scales : scales.filter((s) => s <= wanted);
  return fitting[fitting.length - 1] ?? scales[0]!;
}

/** Sizes the window and restores fullscreen as saved. A browser tab can do neither by itself. */
export async function applyWindowSettings(): Promise<void> {
  const display = currentPlatform().display;
  if (!display.canSizeWindow) return;
  const scale = chosenWindowScale();
  if (scale !== null) await display.setWindowSize(Math.round(GAME_WIDTH * scale), Math.round(GAME_HEIGHT * scale));
  if (settings.fullscreen) await display.setFullscreen(true);
}

export async function toggleFullscreen(): Promise<void> {
  const display = currentPlatform().display;
  if (!display.canFullscreen) return;
  const on = !display.isFullscreen();
  await display.setFullscreen(on);
  // Only the desktop app can start in fullscreen, so only it remembers the choice.
  if (display.canSizeWindow) await changeSettings({ fullscreen: on });
}
