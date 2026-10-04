// Boons (session 5B): buffs that last the rest of a run, picked from the spoils after a fight or
// bought from the merchant. Troop boons make a class (or every troop) stronger; Command boons
// give pips and Momentum. Session 5C brings the full set of 30, faction boons among them.
// Starting values to tune.

import type { Rarity } from './rarity';
import type { UnitClass } from './units';

/** The troop stats a boon can raise, each as a share (0.15 = 15% more). */
export type BoonStat = 'damage' | 'maxHp' | 'moveSpeed' | 'attacksPerSecond';

export type BoonEffect =
  /** A class's troops (every troop when `cls` is null) get `bonus` more of a stat. */
  | { kind: 'stat'; cls: UnitClass | null; stat: BoonStat; bonus: number }
  /** Every battle starts with this many more pips. */
  | { kind: 'startPips'; amount: number }
  /** Pips refill this much faster (0.25 = 25%). */
  | { kind: 'pipRate'; bonus: number }
  /** Every battle starts with this much Momentum. */
  | { kind: 'startMomentum'; amount: number };

export interface BoonData {
  name: string;
  rarity: Rarity;
  text: string;
  effects: readonly BoonEffect[];
}

export const BOON_IDS = [
  'whetstones',
  'fletching',
  'thickPlating',
  'focusCrystals',
  'poisonedBlades',
  'fieldRations',
  'quickMarch',
  'drillSergeant',
  'headStart',
  'warDrums',
  'frontLine',
  'supplyLines',
  'veteranCore',
  'conquerorsBanner',
] as const;
export type BoonId = (typeof BOON_IDS)[number];

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
  conquerorsBanner: {
    name: "Conqueror's Banner",
    rarity: 'legendary',
    text: 'Every troop deals 20% more damage, and every battle starts with 50 Momentum',
    effects: [
      { kind: 'stat', cls: null, stat: 'damage', bonus: 0.2 },
      { kind: 'startMomentum', amount: 50 },
    ],
  },
};

/** The classes a boon helps, or null when it helps every troop or the Command bar. */
export function boonClasses(id: BoonId): UnitClass[] | null {
  const classes = BOONS[id].effects.flatMap((e) => (e.kind === 'stat' && e.cls ? [e.cls] : []));
  const general = BOONS[id].effects.some((e) => e.kind !== 'stat' || e.cls === null);
  return general ? null : classes;
}
