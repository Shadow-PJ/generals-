// The world map (session 5B): the Capital is your hub, with five regions around it. Each region
// has its own map and is ruled by one General; entering it starts a run that ends at its ruler.
// Deep Forest and Void Ruins are open from the start, and each ruler you beat opens the next
// region, so the Glass Plains come last.

import type { GeneralId } from './generals';
import type { MapId } from './maps';
import type { TroopClass, UnitClass } from './units';

export const REGION_IDS = ['deepForest', 'voidRuins', 'redCanyon', 'ironFortress', 'glassPlains'] as const;
export type RegionId = (typeof REGION_IDS)[number];

export interface RegionData {
  name: string;
  /** The battle map every fight in the region is fought on. */
  map: MapId;
  /** The General who rules it: the boss at the end of its runs, and the enemy General of its fights. */
  ruler: GeneralId;
  /** What beating the ruler brings, for the world map. */
  reward: string;
  /** A troop class that beating the ruler unlocks, so runs can offer it. */
  unlocksClass: TroopClass | null;
  /** How often each class shows up in the region's enemy armies, by weight. */
  enemyClasses: Readonly<Record<UnitClass, number>>;
  /** The ruler's own army at the boss fight: 5 troops, then 3 reserves. */
  bossArmy: readonly UnitClass[];
}

export const REGION_RULES = {
  /** Regions open before any boss is beaten; each boss beaten opens one more. */
  openAtStart: 2,
} as const;

/** The classes every new player has. The regions unlock the other two. */
export const STARTER_CLASSES: readonly TroopClass[] = ['vanguard', 'ranger', 'guardian'];

export const REGIONS: Readonly<Record<RegionId, RegionData>> = {
  deepForest: {
    name: 'Deep Forest',
    map: 'deepForest',
    ruler: 'hiveMother',
    reward: 'The Hive Mother, the Assassin class and Hijack',
    unlocksClass: 'assassin',
    enemyClasses: { vanguard: 3, ranger: 2, guardian: 1, invoker: 0, assassin: 3 },
    bossArmy: ['assassin', 'assassin', 'vanguard', 'ranger', 'guardian', 'assassin', 'vanguard', 'ranger'],
  },
  voidRuins: {
    name: 'Void Ruins',
    map: 'voidRuins',
    ruler: 'strategist',
    reward: 'The Strategist, the Invoker class and Swap',
    unlocksClass: 'invoker',
    enemyClasses: { vanguard: 2, ranger: 2, guardian: 1, invoker: 3, assassin: 1 },
    bossArmy: ['vanguard', 'invoker', 'invoker', 'ranger', 'guardian', 'invoker', 'vanguard', 'assassin'],
  },
  redCanyon: {
    name: 'Red Canyon',
    map: 'redCanyon',
    ruler: 'warlord',
    reward: 'The Warlord and Blood Pact',
    unlocksClass: null,
    enemyClasses: { vanguard: 4, ranger: 1, guardian: 3, invoker: 1, assassin: 1 },
    bossArmy: ['vanguard', 'vanguard', 'guardian', 'vanguard', 'ranger', 'guardian', 'assassin', 'vanguard'],
  },
  ironFortress: {
    name: 'Iron Fortress',
    map: 'ironFortress',
    ruler: 'engineer',
    reward: 'The Engineer and Fortify',
    unlocksClass: null,
    enemyClasses: { vanguard: 2, ranger: 3, guardian: 3, invoker: 2, assassin: 1 },
    bossArmy: ['guardian', 'vanguard', 'ranger', 'ranger', 'invoker', 'guardian', 'invoker', 'vanguard'],
  },
  glassPlains: {
    name: 'Glass Plains',
    map: 'glassPlains',
    ruler: 'conductor',
    reward: 'The Conductor and Echo',
    unlocksClass: null,
    enemyClasses: { vanguard: 2, ranger: 4, guardian: 2, invoker: 3, assassin: 1 },
    bossArmy: ['vanguard', 'guardian', 'ranger', 'ranger', 'invoker', 'ranger', 'invoker', 'guardian'],
  },
};

/** The region a General rules, if any. */
export function regionOf(general: GeneralId): RegionId | null {
  return REGION_IDS.find((id) => REGIONS[id].ruler === general) ?? null;
}

/** The regions you may enter, in unlock order. */
export function openRegions(bossesBeaten: readonly GeneralId[]): RegionId[] {
  const beaten = REGION_IDS.filter((id) => bossesBeaten.includes(REGIONS[id].ruler)).length;
  return REGION_IDS.slice(0, Math.min(REGION_IDS.length, REGION_RULES.openAtStart + beaten));
}

/** The troop classes you have: the starter three, plus each class a beaten ruler unlocked. */
export function unlockedClasses(bossesBeaten: readonly GeneralId[]): TroopClass[] {
  const won = REGION_IDS.filter((id) => bossesBeaten.includes(REGIONS[id].ruler)).flatMap((id) => REGIONS[id].unlocksClass ?? []);
  return [...STARTER_CLASSES, ...won];
}
