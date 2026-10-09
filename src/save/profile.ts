// Your saved progress: the cards in your slots, your troops and where they stand, your Command
// XP (which sets your rank), the bosses you have beaten, Tactical mode, your General, the
// combos you have found, the run you are on, the artifacts you have banked, your company, your
// Insight and Tech Web, Ironman mode, the Mastery challenges you have met, the Captain's tips you
// have seen, and your Oaths of Command and Fear records. It is plain JSON in
// saves/profile.json. An older save is first brought up to this version (migrations.ts). Reading is forgiving: anything missing or damaged falls
// back to the default, so a bad file never stops the game from starting.

import { newCampaign } from '../campaign/company';
import type { RunState, TechWeb, Veteran } from '../campaign/types';
import { readCard } from '../cards/schema';
import { emptyLoadout, type Loadout } from '../cards/types';
import type { ArtifactId } from '../data/artifacts';
import { ENEMY_ARMIES, RESERVE_COUNT, STARTER_ARMY, STARTER_ORDERS, STARTER_RESERVES, type EnemyArmy, type TroopPlacement } from '../data/armies';
import { CODEX_ENTRY_IDS, type CodexEntryId } from '../data/combos';
import { MAP_IDS, OPEN_FIELD, type MapId } from '../data/maps';
import { GENERAL_IDS, STARTING_GENERAL, type GeneralId } from '../data/generals';
import { BOSS_ORDER } from '../data/legendary';
import type { MasteryId } from '../data/mastery';
import type { OathRanks } from '../data/oaths';
import type { RegionId } from '../data/regions';
import { RANKS, type RankNumber } from '../data/ranks';
import { SPECIALIZATIONS, type SpecChoice, type SpecializationId } from '../data/specializations';
import { TIP_IDS, type TipId } from '../data/tutorial';
import { TROOP_CLASSES, type UnitClass } from '../data/units';
import type { FileName } from '../platform/types';
import { isArmyPlaced } from '../sim';
import { migrate, saveVersion } from './migrations';
import { readArtifacts, readCompany, readFearRecords, readMastery, readOaths, readRun, readTech } from './run';

export const PROFILE_VERSION = 10;
export const PROFILE_FILE: FileName = 'saves/profile.json';
/** The save as it was before the last migration, in case an update ever goes wrong. */
export const PROFILE_BACKUP_FILE: FileName = 'saves/profile-backup.json';

export interface Profile {
  version: typeof PROFILE_VERSION;
  loadout: Loadout;
  placement: TroopPlacement[];
  /** Command XP from every battle; your Command Rank follows from it. */
  xp: number;
  /** Boss Generals you have beaten, in the order the campaign meets them; the first opens the Legendary slot. */
  bossesBeaten: GeneralId[];
  /** A rank to practise at in skirmish, earning no XP; null to fight at your own rank. */
  practiceRank: RankNumber | null;
  tactical: boolean;
  /** Your cards are stored as you wrote them; the General's rules are applied when they are read. */
  general: GeneralId;
  /** Combos you have landed at least once, for the Combo Codex. Older saves have none yet. */
  codex: CodexEntryId[];
  /** Your reserves, specializations and the skirmish (map, enemy army, General and commander). Older saves have the starter ones. */
  reserves: UnitClass[];
  specs: SpecChoice;
  map: MapId;
  enemyArmy: EnemyArmy;
  enemyGeneral: GeneralId;
  enemyCommander: RankNumber | null;
  /** The campaign run you are on, if any (session 5B). A run that doesn't read correctly is dropped. */
  run: RunState | null;
  /** Artifacts banked for good, at a rest camp or by winning a run. */
  artifacts: ArtifactId[];
  /** Your company (session 5E): the troops you set out with, with their names, records and artifacts. */
  company: Veteran[];
  /** Insight to spend on the Tech Web, and what each class has bought. */
  insight: number;
  tech: TechWeb;
  /** Ironman mode for the next run. */
  ironman: boolean;
  /** General Mastery challenges met. */
  mastery: MasteryId[];
  /** Oaths of Command for your next run, and the highest Fear won in each region (session 5F). */
  oaths: OathRanks;
  fearRecords: Partial<Record<RegionId, number>>;
  /** Your best endless score (session 7G). */
  endlessBest: number;
  /** The Captain's tips (session 6A). */
  tutorial: Tutorial;
}

/** The Captain's tutorial: are tips on, and which you have seen. */
export interface Tutorial {
  on: boolean;
  seen: TipId[];
}

export function newTutorial(): Tutorial {
  return { on: true, seen: [] };
}

/** A new profile's slots: the starter orders first (session 7E), the rest empty. */
export function starterLoadout(): Loadout {
  const loadout = emptyLoadout();
  STARTER_ORDERS.forEach((card, i) => (loadout.slots[i] = structuredClone(card)));
  return loadout;
}

export function newProfile(): Profile {
  const { run, artifacts, company, insight, tech, ironman, mastery, oaths, fearRecords, endlessBest } = newCampaign();
  return {
    version: PROFILE_VERSION,
    loadout: starterLoadout(),
    placement: STARTER_ARMY.map((t) => ({ ...t })),
    xp: 0,
    bossesBeaten: [],
    practiceRank: null,
    tactical: false,
    general: STARTING_GENERAL,
    codex: [],
    reserves: [...STARTER_RESERVES],
    specs: {},
    map: 'openField',
    enemyArmy: 'starter',
    enemyGeneral: STARTING_GENERAL,
    enemyCommander: null,
    run,
    artifacts,
    company,
    insight,
    tech,
    ironman,
    mastery,
    oaths,
    fearRecords,
    endlessBest,
    tutorial: newTutorial(),
  };
}

/** The version of the save in the text, or null when there is none to read. */
export function profileVersion(text: string | null): number | null {
  if (text === null) return null;
  try {
    const data: unknown = JSON.parse(text);
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? saveVersion(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function writeProfile(profile: Profile): string {
  return `${JSON.stringify(profile, null, 2)}\n`;
}

/** The profile in the text, keeping every part that reads correctly. Null text gives a new profile. */
export function readProfile(text: string | null): Profile {
  const profile = newProfile();
  if (text === null) return profile;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return profile;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return profile;
  const saved = migrate(data as Record<string, unknown>, PROFILE_VERSION);
  profile.loadout = readLoadout(saved.loadout);
  profile.placement = readPlacement(saved.placement) ?? profile.placement;
  if (typeof saved.xp === 'number' && Number.isFinite(saved.xp) && saved.xp >= 0) profile.xp = Math.floor(saved.xp);
  if (Array.isArray(saved.bossesBeaten)) profile.bossesBeaten = BOSS_ORDER.filter((g) => (saved.bossesBeaten as unknown[]).includes(g));
  if (RANKS.some((r) => r.rank === saved.practiceRank)) profile.practiceRank = saved.practiceRank as RankNumber;
  if (typeof saved.tactical === 'boolean') profile.tactical = saved.tactical;
  if ((GENERAL_IDS as readonly unknown[]).includes(saved.general)) profile.general = saved.general as GeneralId;
  if (Array.isArray(saved.codex)) profile.codex = CODEX_ENTRY_IDS.filter((id) => (saved.codex as unknown[]).includes(id));
  profile.reserves = readReserves(saved.reserves) ?? profile.reserves;
  profile.specs = readSpecs(saved.specs);
  if ((ENEMY_ARMIES as readonly unknown[]).includes(saved.enemyArmy)) profile.enemyArmy = saved.enemyArmy as EnemyArmy;
  if ((MAP_IDS as readonly unknown[]).includes(saved.map)) profile.map = saved.map as MapId;
  if ((GENERAL_IDS as readonly unknown[]).includes(saved.enemyGeneral)) profile.enemyGeneral = saved.enemyGeneral as GeneralId;
  if (RANKS.some((r) => r.rank === saved.enemyCommander)) profile.enemyCommander = saved.enemyCommander as RankNumber;
  profile.run = readRun(saved.run);
  profile.artifacts = readArtifacts(saved.artifacts);
  profile.company = readCompany(saved.company, profile.artifacts);
  if (typeof saved.insight === 'number' && Number.isInteger(saved.insight) && saved.insight >= 0) profile.insight = saved.insight;
  profile.tech = readTech(saved.tech);
  if (typeof saved.ironman === 'boolean') profile.ironman = saved.ironman;
  profile.mastery = readMastery(saved.mastery);
  profile.oaths = readOaths(saved.oaths);
  profile.fearRecords = readFearRecords(saved.fearRecords);
  if (typeof saved.endlessBest === 'number' && Number.isInteger(saved.endlessBest) && saved.endlessBest >= 0) profile.endlessBest = saved.endlessBest;
  profile.tutorial = readTutorial(saved.tutorial);
  return profile;
}

/** The tutorial as saved; anything damaged gets its default. */
function readTutorial(value: unknown): Tutorial {
  const tutorial = newTutorial();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return tutorial;
  const saved = value as Record<string, unknown>;
  if (typeof saved.on === 'boolean') tutorial.on = saved.on;
  if (Array.isArray(saved.seen)) tutorial.seen = TIP_IDS.filter((id) => (saved.seen as unknown[]).includes(id));
  return tutorial;
}

function isClass(value: unknown): value is UnitClass {
  return (TROOP_CLASSES as readonly unknown[]).includes(value);
}

function readReserves(value: unknown): UnitClass[] | null {
  return Array.isArray(value) && value.length === RESERVE_COUNT && value.every(isClass) ? [...value] : null;
}

/** The specializations that belong to their class; the rest are dropped. */
function readSpecs(value: unknown): SpecChoice {
  const specs: SpecChoice = {};
  if (typeof value !== 'object' || value === null) return specs;
  for (const cls of TROOP_CLASSES) {
    const id = (value as Record<string, unknown>)[cls];
    if (typeof id === 'string' && SPECIALIZATIONS[id as SpecializationId]?.cls === cls) specs[cls] = id as SpecializationId;
  }
  return specs;
}

function readLoadout(value: unknown): Loadout {
  const loadout = emptyLoadout();
  if (typeof value !== 'object' || value === null) return loadout;
  const saved = value as Record<string, unknown>;
  const slots = saved.slots;
  if (Array.isArray(slots)) loadout.slots = loadout.slots.map((_, i) => readCard(slots[i]));
  loadout.legendary = readCard(saved.legendary);
  return loadout;
}

/** Your troops as saved, if there are 5 of real classes and every one still stands somewhere it may. */
function readPlacement(value: unknown): TroopPlacement[] | null {
  if (!Array.isArray(value) || value.length !== STARTER_ARMY.length) return null;
  const placement: TroopPlacement[] = [];
  for (const t of value) {
    if (typeof t !== 'object' || t === null) return null;
    const { cls, x, y } = t as Record<string, unknown>;
    if (!isClass(cls) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    placement.push({ cls, x: x as number, y: y as number });
  }
  return isArmyPlaced(OPEN_FIELD, 'player', placement) ? placement : null;
}
