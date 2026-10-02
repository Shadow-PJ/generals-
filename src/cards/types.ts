// The Command card format. Cards are plain data: they can be saved, replayed and sent over
// the network. A card has an optional condition, one or more steps, and Auto or manual.
// Its cost is worked out from its steps (see cost.ts), so it can never disagree with them.

import type { TroopClass } from '../data/units';

export type ActionName = 'focus' | 'move' | 'fallBack' | 'overcharge' | 'protect' | 'hold' | 'callReserve';

export const ACTIONS: readonly ActionName[] = ['focus', 'move', 'fallBack', 'overcharge', 'protect', 'hold', 'callReserve'];

/** Which of your troops carry out a step. */
export type Actors = { kind: 'all' } | { kind: 'class'; cls: TroopClass } | { kind: 'named'; name: string };

/**
 * What a step aims at. Whose troops a class means depends on the action: Focus aims at the
 * enemy, Protect at your own. 'trigger' is the unit that set off the card's condition.
 */
export type Target =
  | { kind: 'class'; cls: TroopClass }
  | { kind: 'named'; name: string }
  | { kind: 'nearest' }
  | { kind: 'weakest' }
  | { kind: 'trigger' };

/** Where a Move goes. */
export type Place = { kind: 'forward' } | { kind: 'back' } | { kind: 'behindEnemies' } | { kind: 'ally'; ally: Target };

export type Step = StepAction & {
  /**
   * Set on steps your General added (personality rules). They skip your rank's step limit and
   * may use any action, but still cost pips. A card you write never has it.
   */
  byGeneral?: true;
};

export type StepAction =
  | { action: 'focus'; actors: Actors; target: Target }
  | { action: 'move'; actors: Actors; to: Place }
  /** Fall back toward an ally, or just away from the enemy when `to` is null. */
  | { action: 'fallBack'; actors: Actors; to: Target | null }
  /** The troops fire their skill now. */
  | { action: 'overcharge'; actors: Actors }
  | { action: 'protect'; actors: Actors; target: Target }
  | { action: 'hold'; actors: Actors }
  /** Bring in a reserve troop: one of this class, or the next one when null. */
  | { action: 'callReserve'; reserve: TroopClass | null };

export type Trigger =
  | { kind: 'enemyReachesBackline'; enemy: TroopClass | 'any' }
  | { kind: 'allyBelowHp'; ally: TroopClass | 'any'; hpPercent: number }
  | { kind: 'enemiesGrouped'; count: number }
  | { kind: 'enemyUltimateCharging' };

export type TriggerKind = Trigger['kind'];
export const TRIGGER_KINDS: readonly TriggerKind[] = [
  'enemyReachesBackline',
  'allyBelowHp',
  'enemiesGrouped',
  'enemyUltimateCharging',
];

/** "When X" or "when X and Y"; `repeat` makes it "every time X". */
export interface Condition {
  triggers: Trigger[];
  repeat: boolean;
}

export interface Card {
  /** The order as it was written, when it was typed. */
  text?: string;
  condition: Condition | null;
  steps: Step[];
  /** Fires by itself the moment its condition is met. Needs a condition. */
  auto: boolean;
}

/** Your card slots: 4 regular slots plus the Legendary slot (unlocked by the first boss win). */
export interface Loadout {
  slots: (Card | null)[];
  legendary: Card | null;
}

export function emptyLoadout(): Loadout {
  return { slots: [null, null, null, null], legendary: null };
}
