// Runs (session 5B): entering a region starts a run, a branching path of battles, elite fights,
// events, a merchant and rest camps that ends at the region's ruler. A run starts small and
// grows with every fight: the first fights are small, later ones bring full armies and enemy
// commanders of rising rank. All numbers are starting values to tune in playtests.

import type { RankNumber } from './ranks';
import type { Rarity } from './rarity';

export const NODE_KINDS = ['battle', 'elite', 'event', 'merchant', 'camp', 'boss'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** The enemy army of a fight. */
export interface FightTier {
  troops: number;
  reserves: number;
  /** The enemy commander's rank, or null for none (no enemy cards or ultimate). */
  commander: RankNumber | null;
  /** How many enemy troops (field first, then reserves) are Epic, then how many Rare; the rest are Common. */
  epic: number;
  rare: number;
}

export const RUN_RULES = {
  /** Floors before the boss, who stands alone on one more floor. */
  floors: 7,
  /** Nodes on a floor, side by side: each is a path you may take. */
  minWidth: 2,
  maxWidth: 4,
  /** What a floor's nodes are, by weight. The first floor is all battles, the last before the boss all camps. */
  nodeWeights: { battle: 46, event: 26, elite: 12, merchant: 8, camp: 8 } as Readonly<Record<'battle' | 'event' | 'elite' | 'merchant' | 'camp', number>>,
  /** No elite fight, merchant or camp before this floor. */
  firstSpecialFloor: 2,
  /** This floor always has a merchant on one of its paths. */
  merchantFloor: 3,
  /** Each node gets a second path forward with this chance, where one fits without crossing. */
  extraPathChance: 0.5,
  startingGold: 0,
  /** Gold for a won fight: the base for its kind, plus `perFloor` for each floor, plus up to `spread` more by chance. */
  gold: { battle: 18, elite: 40, boss: 0, perFloor: 3, spread: 9 },
  /** Gold for skipping the spoils pick. */
  skipGold: 15,
  /** Spoils: how many offers, and the chance each one is a fighter rather than a boon. */
  offers: 3,
  fighterChance: 0.5,
  /** A fighter who falls in a won fight gets back up with this share of their HP. */
  fallenHp: 0.25,
  /** A rest camp heals every fighter this share of their max HP. */
  campHeal: 0.5,
  merchant: {
    fighters: 3,
    boons: 2,
    fighterPrice: { common: 30, rare: 55, epic: 90, legendary: 140 } as Readonly<Record<Rarity, number>>,
    boonPrice: { common: 35, rare: 60, epic: 95, legendary: 150 } as Readonly<Record<Rarity, number>>,
    /** Heals every fighter to full. */
    healPrice: 25,
    /** A new stock; each reroll costs `rerollStep` more than the last. */
    rerollPrice: 15,
    rerollStep: 10,
  },
} as const;

/** The enemy army on each floor before the camps, first floor first. */
export const FIGHT_TIERS: readonly FightTier[] = [
  { troops: 3, reserves: 0, commander: null, epic: 0, rare: 0 },
  { troops: 4, reserves: 0, commander: null, epic: 0, rare: 0 },
  { troops: 5, reserves: 0, commander: null, epic: 0, rare: 1 },
  { troops: 5, reserves: 1, commander: 1, epic: 0, rare: 1 },
  { troops: 5, reserves: 2, commander: 2, epic: 0, rare: 2 },
  { troops: 5, reserves: 3, commander: 2, epic: 1, rare: 2 },
];

/** An elite fight is its floor's army with a stronger commander and rarer troops. */
export const ELITE_FIGHT = {
  /** Its commander is this many ranks higher than the floor's, and at least `minCommander`. */
  commanderBonus: 1,
  minCommander: 2 as RankNumber,
  epic: 1,
  rare: 1,
} as const;

/** The ruler's army at the end of the run (session 5D gives each boss their own fight). */
export const BOSS_FIGHT: FightTier = { troops: 5, reserves: 3, commander: 2, epic: 2, rare: 3 };

/** Each boss you had beaten before a run makes its fights harder: a commander one rank higher, one more Rare troop. */
export const RUN_LEVEL_STEP = { commander: 1, rare: 1 } as const;
