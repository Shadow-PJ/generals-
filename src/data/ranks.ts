// Command Ranks: what your orders are allowed to say. Each rank keeps everything below it.

import type { ActionName } from '../cards/types';

export type RankNumber = 1 | 2 | 3 | 4 | 5;

/** How complex a card's condition may be, from none up to repeating. */
export type ConditionLevel = 'none' | 'simple' | 'combined' | 'repeating';
export const CONDITION_LEVELS: readonly ConditionLevel[] = ['none', 'simple', 'combined', 'repeating'];

export interface RankRules {
  rank: RankNumber;
  numeral: string;
  name: string;
  slots: number;
  maxPips: number;
  stepsPerCard: number;
  /** The most complex condition allowed. */
  conditions: ConditionLevel;
  /** Cards with a condition may be set to fire by themselves. */
  autoMode: boolean;
  /** Actions first unlocked at this rank. */
  newActions: ActionName[];
  /** Orders may name a veteran ("Raven, take their healer"). */
  namedTargets: boolean;
  chains: boolean;
  signatureCombos: boolean;
  finishers: boolean;
}

export const RANKS: readonly RankRules[] = [
  {
    rank: 1,
    numeral: 'I',
    name: 'Squad Leader',
    slots: 2,
    maxPips: 4,
    stepsPerCard: 1,
    conditions: 'none',
    autoMode: false,
    newActions: ['focus', 'move', 'fallBack'],
    namedTargets: false,
    chains: false,
    signatureCombos: false,
    finishers: false,
  },
  {
    rank: 2,
    numeral: 'II',
    name: 'Field Commander',
    slots: 3,
    maxPips: 4,
    stepsPerCard: 1,
    conditions: 'simple',
    autoMode: true,
    newActions: ['overcharge', 'protect'],
    namedTargets: false,
    chains: false,
    signatureCombos: false,
    finishers: false,
  },
  {
    rank: 3,
    numeral: 'III',
    name: 'Tactician',
    slots: 3,
    maxPips: 5,
    stepsPerCard: 2,
    conditions: 'simple',
    autoMode: true,
    newActions: ['callReserve', 'hold'],
    namedTargets: true,
    chains: true,
    signatureCombos: true,
    finishers: false,
  },
  {
    rank: 4,
    numeral: 'IV',
    name: 'Warmaster',
    slots: 4,
    maxPips: 5,
    stepsPerCard: 3,
    conditions: 'combined',
    autoMode: true,
    newActions: [],
    namedTargets: true,
    chains: true,
    signatureCombos: true,
    finishers: true,
  },
  {
    rank: 5,
    numeral: 'V',
    name: 'Legend',
    slots: 4,
    maxPips: 6,
    stepsPerCard: 3,
    conditions: 'repeating',
    autoMode: true,
    newActions: [],
    namedTargets: true,
    chains: true,
    signatureCombos: true,
    finishers: true,
  },
];

export function rankRules(rank: RankNumber): RankRules {
  return RANKS[rank - 1]!;
}

/** Every action unlocked at or below this rank. */
export function unlockedActions(rank: RankNumber): ActionName[] {
  return RANKS.filter((r) => r.rank <= rank).flatMap((r) => r.newActions);
}

/** The rank a new player starts at, and the debug switch's default in session 2A. */
export const STARTING_RANK: RankNumber = 1;
export const DEBUG_DEFAULT_RANK: RankNumber = 3;
