// The six Generals and the numbers behind how each one writes your cards. The rules
// themselves live in src/cards/personality.ts; their reply lines in replies.ts.

import type { ActionName, Trigger } from '../cards/types';
import type { TroopClass } from './units';

export const GENERAL_IDS = ['captain', 'warlord', 'engineer', 'hiveMother', 'strategist', 'conductor'] as const;
export type GeneralId = (typeof GENERAL_IDS)[number];

export interface GeneralInfo {
  name: string;
  /** The faction the General leads; the Captain has none. */
  faction: string | null;
  /** How the General writes your cards, in a few words. */
  writes: string;
}

export const GENERALS: Readonly<Record<GeneralId, GeneralInfo>> = {
  captain: { name: 'The Captain', faction: null, writes: 'Literally, exactly as written' },
  warlord: { name: 'The Warlord', faction: 'Bloodbound', writes: 'Aggressively: retreats get a counter-attack' },
  engineer: { name: 'The Engineer', faction: 'Forgeborn', writes: 'Carefully: a Hold before every Move' },
  hiveMother: { name: 'The Hive Mother', faction: 'Hive', writes: 'On instinct: 2 steps at most, simple targets' },
  strategist: { name: 'The Strategist', faction: 'Voidweavers', writes: 'Precisely: suggests a condition you can accept' },
  conductor: { name: 'The Conductor', faction: 'Resonance', writes: 'As a perfectionist: reorders steps into combos' },
};

/** You start with the Captain and recruit the others by beating them (phase 5). */
export const STARTING_GENERAL: GeneralId = 'captain';

export const WARLORD_RULES = {
  /** Writing any of these keeps a Fall Back a plain retreat. */
  insistWords: ['hold back'],
} as const;

export const HIVE_MOTHER_RULES = {
  /** Steps past this many are dropped from the end of the card. */
  maxSteps: 2,
} as const;

/**
 * A suggested trigger. 'target' means the class the card's first step aims at, when it aims at
 * a class; otherwise any troop.
 */
export type SuggestedTrigger =
  | { kind: 'enemyReachesBackline'; enemy: TroopClass | 'any' | 'target' }
  | { kind: 'allyBelowHp'; ally: TroopClass | 'any' | 'target'; hpPercent: number }
  | Extract<Trigger, { kind: 'enemiesGrouped' | 'enemyUltimateCharging' }>;

export const STRATEGIST_RULES = {
  /** The condition the Strategist suggests for a card without one, by its first step's action. */
  suggestions: {
    focus: { kind: 'enemyReachesBackline', enemy: 'target' },
    move: { kind: 'enemiesGrouped', count: 3 },
    fallBack: { kind: 'allyBelowHp', ally: 'any', hpPercent: 50 },
    protect: { kind: 'allyBelowHp', ally: 'target', hpPercent: 50 },
    // Not "when their ultimate charges": enemy Generals don't fire ultimates until session 4D.
    hold: { kind: 'enemiesGrouped', count: 3 },
    overcharge: { kind: 'enemiesGrouped', count: 3 },
    callReserve: { kind: 'allyBelowHp', ally: 'any', hpPercent: 50 },
  } satisfies Record<ActionName, SuggestedTrigger>,
  /** Only these classes dive at your backline, so "wait for them to reach it" fits only them. */
  divers: ['vanguard', 'assassin'] as readonly TroopClass[],
} as const;
