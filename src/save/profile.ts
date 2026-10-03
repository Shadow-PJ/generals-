// Your saved progress: the cards in your slots, your troops and where they stand, your rank,
// Tactical mode, your General and the combos you have found. It is plain JSON in
// saves/profile.json. Reading is forgiving: anything missing or damaged falls back to the
// default, so a bad file never stops the game from starting.
// Phase 5 grows this into the full save with migrations; `version` is there for that.

import { readCard } from '../cards/schema';
import { emptyLoadout, type Loadout } from '../cards/types';
import { ENEMY_ARMIES, RESERVE_COUNT, STARTER_ARMY, STARTER_RESERVES, type EnemyArmy, type TroopPlacement } from '../data/armies';
import { CODEX_ENTRY_IDS, type CodexEntryId } from '../data/combos';
import { MAP_IDS, OPEN_FIELD, type MapId } from '../data/maps';
import { GENERAL_IDS, STARTING_GENERAL, type GeneralId } from '../data/generals';
import { DEBUG_DEFAULT_RANK, RANKS, type RankNumber } from '../data/ranks';
import { SPECIALIZATIONS, type SpecChoice, type SpecializationId } from '../data/specializations';
import { TROOP_CLASSES, type UnitClass } from '../data/units';
import type { FileName } from '../platform';
import { isArmyPlaced } from '../sim';

export const PROFILE_VERSION = 1;
export const PROFILE_FILE: FileName = 'saves/profile.json';

export interface Profile {
  version: typeof PROFILE_VERSION;
  loadout: Loadout;
  placement: TroopPlacement[];
  rank: RankNumber;
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
}

export function newProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    loadout: emptyLoadout(),
    placement: STARTER_ARMY.map((t) => ({ ...t })),
    rank: DEBUG_DEFAULT_RANK,
    tactical: false,
    general: STARTING_GENERAL,
    codex: [],
    reserves: [...STARTER_RESERVES],
    specs: {},
    map: 'openField',
    enemyArmy: 'starter',
    enemyGeneral: STARTING_GENERAL,
    enemyCommander: null,
  };
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
  if (typeof data !== 'object' || data === null) return profile;
  const saved = data as Record<string, unknown>;
  profile.loadout = readLoadout(saved.loadout);
  profile.placement = readPlacement(saved.placement) ?? profile.placement;
  if (RANKS.some((r) => r.rank === saved.rank)) profile.rank = saved.rank as RankNumber;
  if (typeof saved.tactical === 'boolean') profile.tactical = saved.tactical;
  if ((GENERAL_IDS as readonly unknown[]).includes(saved.general)) profile.general = saved.general as GeneralId;
  if (Array.isArray(saved.codex)) profile.codex = CODEX_ENTRY_IDS.filter((id) => (saved.codex as unknown[]).includes(id));
  profile.reserves = readReserves(saved.reserves) ?? profile.reserves;
  profile.specs = readSpecs(saved.specs);
  if ((ENEMY_ARMIES as readonly unknown[]).includes(saved.enemyArmy)) profile.enemyArmy = saved.enemyArmy as EnemyArmy;
  if ((MAP_IDS as readonly unknown[]).includes(saved.map)) profile.map = saved.map as MapId;
  if ((GENERAL_IDS as readonly unknown[]).includes(saved.enemyGeneral)) profile.enemyGeneral = saved.enemyGeneral as GeneralId;
  if (RANKS.some((r) => r.rank === saved.enemyCommander)) profile.enemyCommander = saved.enemyCommander as RankNumber;
  return profile;
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
