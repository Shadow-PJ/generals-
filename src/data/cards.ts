// Numbers for Command cards.

import type { ActionName } from '../cards/types';

/** Pips each step costs. A card costs the sum of its steps. */
export const ACTION_COSTS: Record<ActionName, number> = {
  focus: 1,
  move: 1,
  fallBack: 1,
  protect: 1,
  hold: 1,
  overcharge: 2,
  callReserve: 2,
};

/** Legendary actions (session 5A) cost this much. */
export const LEGENDARY_ACTION_COST = 3;

export const CARD_RULES = {
  /** "When X and Y": at most this many triggers in one condition. */
  maxTriggers: 2,
  /** The legendary slot holds one card; the regular slots are 1 to 4. */
  maxRegularSlots: 4,
  /** A repeating card fires again at most this often. */
  repeatMinSeconds: 10,
  /** "3 or more enemies close together" when the order gives no number. */
  groupedDefaultCount: 3,
  groupedCountRange: { min: 2, max: 5 },
  /** Ally HP thresholds an order may name, in percent. */
  hpPercentRange: { min: 5, max: 95 },
  /** HP thresholds the card builder offers. */
  builderHpChoices: [25, 50, 75],
  builderGroupedChoices: [3, 4, 5],
} as const;

export const TRANSLATOR_RULES = {
  /** If the small model hasn't read an order by then, the rule parser's answer is used. */
  modelTimeoutSeconds: 20,
} as const;

/** What words like "hurt" or "low" mean as an HP threshold, in percent. */
export const HURT_WORDS: Readonly<Record<string, number>> = {
  hurt: 50,
  wounded: 50,
  'in trouble': 40,
  'in danger': 40,
  low: 30,
  'low on health': 30,
  'low on hp': 30,
  'low hp': 30,
  'low health': 30,
  weak: 30,
  dying: 20,
  'almost dead': 20,
  'nearly dead': 20,
};
