// Oaths of Command (session 5F; after Hades II's Oath of the Unseen and Thronefall's mutators):
// vows you take before a run to make it harder. Each rank of an oath adds Fear; Fear raises the
// Insight every battle of the run earns, and winning a region at a new highest Fear pays a
// bounty. A run keeps the oaths it began with. Starting values to tune.

export const OATH_IDS = [
  'veteranFoes',
  'eliteGuard',
  'cunningCommanders',
  'tyrantsWrath',
  'leanPurse',
  'lastingWounds',
  'shortSupply',
  'noQuarter',
] as const;
export type OathId = (typeof OATH_IDS)[number];

/** The rank of each oath taken; an oath left out is not taken. */
export type OathRanks = Partial<Record<OathId, number>>;

export interface OathData {
  name: string;
  /** What each rank does, first rank first; the screen shows the one taken (or the first). */
  ranks: readonly string[];
  /** Fear each rank adds. */
  fearPerRank: number;
}

/** What the oaths do, rank by rank: index 0 is rank 1. */
export const OATH_RULES = {
  /** More Rare troops in every enemy army. */
  veteranFoes: { rare: [1, 2, 3] },
  /** More Epic troops in every enemy army. */
  eliteGuard: { epic: [1, 2] },
  /** Enemy commanders this many ranks higher (up to V); a fight with no commander keeps none. */
  cunningCommanders: { ranks: [1, 2] },
  /** The ruler's own army: more Epic troops and a sharper commander. */
  tyrantsWrath: { epic: [2, 4], commander: [1, 2] },
  /** Gold from fights, and for skipping the spoils, is cut by this share. */
  leanPurse: { cut: [0.25, 0.5] },
  /** A fighter who falls gets back up with this share of HP (25% without), and camps heal this share of what they would. */
  lastingWounds: { fallenHp: [0.1], campHealShare: [0.5] },
  /** The merchant asks this much more for everything. */
  shortSupply: { priceRise: [0.5] },
  /** The spoils offer this many fewer picks. */
  noQuarter: { fewerOffers: [1] },
  /** Insight each battle earns grows by this share for every point of Fear. */
  insightPerFear: 0.1,
  /** Winning a region's run above its highest Fear yet pays this much Insight for each point above it. */
  bountyPerFear: 3,
} as const;

export const OATHS: Readonly<Record<OathId, OathData>> = {
  veteranFoes: {
    name: 'Veteran Foes',
    ranks: ['Every enemy army has 1 more Rare troop', '2 more Rare troops', '3 more Rare troops'],
    fearPerRank: 1,
  },
  eliteGuard: {
    name: 'Elite Guard',
    ranks: ['Every enemy army has 1 more Epic troop', '2 more Epic troops'],
    fearPerRank: 2,
  },
  cunningCommanders: {
    name: 'Cunning Commanders',
    ranks: ['Enemy commanders are 1 rank higher', '2 ranks higher'],
    fearPerRank: 2,
  },
  tyrantsWrath: {
    name: "Tyrant's Wrath",
    ranks: ["The ruler brings 2 more Epic troops and a commander 1 rank higher", '4 more Epic troops and a commander 2 ranks higher'],
    fearPerRank: 2,
  },
  leanPurse: {
    name: 'Lean Purse',
    ranks: ['25% less gold from fights', '50% less gold from fights'],
    fearPerRank: 1,
  },
  lastingWounds: {
    name: 'Lasting Wounds',
    ranks: ['Fallen fighters get back up with 10% HP, and camps heal half as much'],
    fearPerRank: 2,
  },
  shortSupply: {
    name: 'Short Supply',
    ranks: ['The merchant asks 50% more'],
    fearPerRank: 1,
  },
  noQuarter: {
    name: 'No Quarter',
    ranks: ['The spoils offer 2 picks instead of 3'],
    fearPerRank: 1,
  },
};

/** An oath's highest rank. */
export function maxRank(id: OathId): number {
  return OATHS[id].ranks.length;
}

/** The rank taken of an oath: 0 when not taken. */
export function rankOf(oaths: OathRanks, id: OathId): number {
  return Math.max(0, Math.min(maxRank(id), Math.floor(oaths[id] ?? 0)));
}

/** The Fear of a set of oaths. */
export function fearOf(oaths: OathRanks): number {
  return OATH_IDS.reduce((sum, id) => sum + rankOf(oaths, id) * OATHS[id].fearPerRank, 0);
}

/** The value of an oath's rule at its rank, or `none` when it is not taken. */
export function oathValue(oaths: OathRanks, values: readonly number[], id: OathId, none = 0): number {
  const rank = rankOf(oaths, id);
  return rank === 0 ? none : (values[Math.min(rank, values.length) - 1] ?? none);
}

/** The highest Fear there is: every oath at its highest rank. */
export const MAX_FEAR = OATH_IDS.reduce((sum, id) => sum + maxRank(id) * OATHS[id].fearPerRank, 0);
