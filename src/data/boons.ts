// Boons (sessions 5B and 5C): buffs that last the rest of a run, picked from the spoils after a
// fight or bought from the merchant. Troop boons make a class (or every troop) stronger or bring
// its skill back sooner; Command boons give pips and Momentum; faction boons count as more
// fighters of a faction; Plunder brings more gold. 30 in all. Starting values to tune.

import type { FactionId } from './factions';
import type { PerkStat } from './perks';
import type { Rarity } from './rarity';
import type { UnitClass } from './units';

/** The troop stats a boon can raise, each as a share (0.15 = 15% more). */
export type BoonStat = PerkStat;

export type BoonEffect =
  /** A class's troops (every troop when `cls` is null) get `bonus` more of a stat. */
  | { kind: 'stat'; cls: UnitClass | null; stat: BoonStat; bonus: number }
  /** A class's skill (every troop's when `cls` is null) comes back this much sooner. */
  | { kind: 'skillHaste'; cls: UnitClass | null; cut: number }
  /** A class's troops (every troop when `cls` is null) heal this share of the damage their attacks deal. */
  | { kind: 'lifesteal'; cls: UnitClass | null; share: number }
  /** Every battle starts with this many more pips. */
  | { kind: 'startPips'; amount: number }
  /** You can hold this many more pips. */
  | { kind: 'maxPips'; amount: number }
  /** Pips refill this much faster (0.25 = 25%). */
  | { kind: 'pipRate'; bonus: number }
  /** Every battle starts with this much Momentum. */
  | { kind: 'startMomentum'; amount: number }
  /** Counts as this many more fighters of a faction. */
  | { kind: 'faction'; faction: FactionId; count: number }
  /** Counts as this many more fighters of the faction you field most of. */
  | { kind: 'largestFaction'; count: number }
  /** This much more gold from every won fight (the run's, not the battle's). */
  | { kind: 'gold'; amount: number };

export interface BoonData {
  name: string;
  rarity: Rarity;
  text: string;
  effects: readonly BoonEffect[];
}

export const BOON_IDS = [
  // Common
  'whetstones',
  'fletching',
  'thickPlating',
  'focusCrystals',
  'poisonedBlades',
  'fieldRations',
  'quickMarch',
  'shoveDrills',
  'markingChalk',
  'barrierRunes',
  'riftLenses',
  'shadowCloaks',
  'plunder',
  // Rare
  'drillSergeant',
  'headStart',
  'warDrums',
  'frontLine',
  'bloodOath',
  'forgeBrand',
  'hiveSpawn',
  'voidSigil',
  'tuningFork',
  // Epic
  'supplyLines',
  'veteranCore',
  'bloodthirst',
  'quartermaster',
  'battleHymn',
  // Legendary
  'conquerorsBanner',
  'legionStandard',
  'endlessSupply',
] as const;
export type BoonId = (typeof BOON_IDS)[number];

const SKILL_BOON_CUT = 0.25;

export const BOONS: Readonly<Record<BoonId, BoonData>> = {
  whetstones: {
    name: 'Whetstones',
    rarity: 'common',
    text: 'Vanguards deal 15% more damage',
    effects: [{ kind: 'stat', cls: 'vanguard', stat: 'damage', bonus: 0.15 }],
  },
  fletching: {
    name: 'Fine Fletching',
    rarity: 'common',
    text: 'Rangers deal 15% more damage',
    effects: [{ kind: 'stat', cls: 'ranger', stat: 'damage', bonus: 0.15 }],
  },
  thickPlating: {
    name: 'Thick Plating',
    rarity: 'common',
    text: 'Guardians have 20% more HP',
    effects: [{ kind: 'stat', cls: 'guardian', stat: 'maxHp', bonus: 0.2 }],
  },
  focusCrystals: {
    name: 'Focus Crystals',
    rarity: 'common',
    text: 'Invokers deal 15% more damage',
    effects: [{ kind: 'stat', cls: 'invoker', stat: 'damage', bonus: 0.15 }],
  },
  poisonedBlades: {
    name: 'Poisoned Blades',
    rarity: 'common',
    text: 'Assassins deal 15% more damage',
    effects: [{ kind: 'stat', cls: 'assassin', stat: 'damage', bonus: 0.15 }],
  },
  fieldRations: {
    name: 'Field Rations',
    rarity: 'common',
    text: 'Every troop has 8% more HP',
    effects: [{ kind: 'stat', cls: null, stat: 'maxHp', bonus: 0.08 }],
  },
  quickMarch: {
    name: 'Quick March',
    rarity: 'common',
    text: 'Every troop moves 10% faster',
    effects: [{ kind: 'stat', cls: null, stat: 'moveSpeed', bonus: 0.1 }],
  },
  shoveDrills: {
    name: 'Shove Drills',
    rarity: 'common',
    text: `Vanguards Shove ${percent(SKILL_BOON_CUT)} sooner`,
    effects: [{ kind: 'skillHaste', cls: 'vanguard', cut: SKILL_BOON_CUT }],
  },
  markingChalk: {
    name: 'Marking Chalk',
    rarity: 'common',
    text: `Rangers Mark ${percent(SKILL_BOON_CUT)} sooner`,
    effects: [{ kind: 'skillHaste', cls: 'ranger', cut: SKILL_BOON_CUT }],
  },
  barrierRunes: {
    name: 'Barrier Runes',
    rarity: 'common',
    text: `Guardians raise a Barrier ${percent(SKILL_BOON_CUT)} sooner`,
    effects: [{ kind: 'skillHaste', cls: 'guardian', cut: SKILL_BOON_CUT }],
  },
  riftLenses: {
    name: 'Rift Lenses',
    rarity: 'common',
    text: `Invokers open a Rift ${percent(SKILL_BOON_CUT)} sooner`,
    effects: [{ kind: 'skillHaste', cls: 'invoker', cut: SKILL_BOON_CUT }],
  },
  shadowCloaks: {
    name: 'Shadow Cloaks',
    rarity: 'common',
    text: `Assassins Shadowstep ${percent(SKILL_BOON_CUT)} sooner`,
    effects: [{ kind: 'skillHaste', cls: 'assassin', cut: SKILL_BOON_CUT }],
  },
  plunder: {
    name: 'Plunder',
    rarity: 'common',
    text: '10 more gold from every won fight',
    effects: [{ kind: 'gold', amount: 10 }],
  },
  drillSergeant: {
    name: 'Drill Sergeant',
    rarity: 'rare',
    text: 'Every troop attacks 10% faster',
    effects: [{ kind: 'stat', cls: null, stat: 'attacksPerSecond', bonus: 0.1 }],
  },
  headStart: {
    name: 'Head Start',
    rarity: 'rare',
    text: 'Every battle starts with 1 more pip',
    effects: [{ kind: 'startPips', amount: 1 }],
  },
  warDrums: {
    name: 'War Drums',
    rarity: 'rare',
    text: 'Every battle starts with 30 Momentum',
    effects: [{ kind: 'startMomentum', amount: 30 }],
  },
  frontLine: {
    name: 'Shield Wall',
    rarity: 'rare',
    text: 'Vanguards and Guardians have 15% more HP',
    effects: [
      { kind: 'stat', cls: 'vanguard', stat: 'maxHp', bonus: 0.15 },
      { kind: 'stat', cls: 'guardian', stat: 'maxHp', bonus: 0.15 },
    ],
  },
  bloodOath: {
    name: 'Blood Oath',
    rarity: 'rare',
    text: 'Counts as 1 more Bloodbound fighter',
    effects: [{ kind: 'faction', faction: 'bloodbound', count: 1 }],
  },
  forgeBrand: {
    name: 'Forge Brand',
    rarity: 'rare',
    text: 'Counts as 1 more Forgeborn fighter',
    effects: [{ kind: 'faction', faction: 'forgeborn', count: 1 }],
  },
  hiveSpawn: {
    name: 'Hive Spawn',
    rarity: 'rare',
    text: 'Counts as 1 more Hive fighter',
    effects: [{ kind: 'faction', faction: 'hive', count: 1 }],
  },
  voidSigil: {
    name: 'Void Sigil',
    rarity: 'rare',
    text: 'Counts as 1 more Voidweavers fighter',
    effects: [{ kind: 'faction', faction: 'voidweavers', count: 1 }],
  },
  tuningFork: {
    name: 'Tuning Fork',
    rarity: 'rare',
    text: 'Counts as 1 more Resonance fighter',
    effects: [{ kind: 'faction', faction: 'resonance', count: 1 }],
  },
  supplyLines: {
    name: 'Supply Lines',
    rarity: 'epic',
    text: 'Pips refill 25% faster',
    effects: [{ kind: 'pipRate', bonus: 0.25 }],
  },
  veteranCore: {
    name: 'Veteran Core',
    rarity: 'epic',
    text: 'Every troop deals 12% more damage and has 12% more HP',
    effects: [
      { kind: 'stat', cls: null, stat: 'damage', bonus: 0.12 },
      { kind: 'stat', cls: null, stat: 'maxHp', bonus: 0.12 },
    ],
  },
  bloodthirst: {
    name: 'Bloodthirst',
    rarity: 'epic',
    text: 'Every troop heals 8% of the damage its attacks deal',
    effects: [{ kind: 'lifesteal', cls: null, share: 0.08 }],
  },
  quartermaster: {
    name: 'Quartermaster',
    rarity: 'epic',
    text: 'You can hold 1 more pip',
    effects: [{ kind: 'maxPips', amount: 1 }],
  },
  battleHymn: {
    name: 'Battle Hymn',
    rarity: 'epic',
    text: "Every troop's skill comes back 20% sooner",
    effects: [{ kind: 'skillHaste', cls: null, cut: 0.2 }],
  },
  conquerorsBanner: {
    name: "Conqueror's Banner",
    rarity: 'legendary',
    text: 'Every troop deals 20% more damage, and every battle starts with 50 Momentum',
    effects: [
      { kind: 'stat', cls: null, stat: 'damage', bonus: 0.2 },
      { kind: 'startMomentum', amount: 50 },
    ],
  },
  legionStandard: {
    name: "Legion's Standard",
    rarity: 'legendary',
    text: 'Counts as 2 more fighters of the faction you field most of',
    effects: [{ kind: 'largestFaction', count: 2 }],
  },
  endlessSupply: {
    name: 'Endless Supply',
    rarity: 'legendary',
    text: 'You can hold 1 more pip, and pips refill 20% faster',
    effects: [
      { kind: 'maxPips', amount: 1 },
      { kind: 'pipRate', bonus: 0.2 },
    ],
  },
};

/** The classes a boon helps, or null when it helps every troop, the Command bar, a faction or the run. */
export function boonClasses(id: BoonId): UnitClass[] | null {
  const effects = BOONS[id].effects;
  const classes = effects.flatMap((e) => ('cls' in e && e.cls ? [e.cls] : []));
  const general = effects.some((e) => !('cls' in e) || e.cls === null);
  return general ? null : classes;
}

/** The factions a boon counts for: one faction, any faction ('largest'), or none. */
export function boonFaction(id: BoonId): FactionId | 'largest' | null {
  for (const e of BOONS[id].effects) {
    if (e.kind === 'faction') return e.faction;
    if (e.kind === 'largestFaction') return 'largest';
  }
  return null;
}

/** Extra gold from every won fight. */
export function boonGold(boons: readonly BoonId[]): number {
  return boons.reduce((sum, id) => sum + BOONS[id].effects.reduce((s, e) => s + (e.kind === 'gold' ? e.amount : 0), 0), 0);
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
