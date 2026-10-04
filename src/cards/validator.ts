// The validator: the only gate for rank rules. Every card is checked against your Command Rank
// before it reaches a slot, whether it was built from menus, typed or written by a model, so
// no order can break balance. It also finds the lowest rank that would allow a rejected card.
// It guards the Legendary slot too: a Legendary action only on that slot's card, and only once
// a boss has taught it.

import { CARD_RULES } from '../data/cards';
import { CONDITION_LEVELS, RANKS, rankRules, unlockedActions, type ConditionLevel, type RankNumber } from '../data/ranks';
import { cardCost } from './cost';
import { isLegendaryAction, type ActionName, type Card, type LegendaryAction, type Step, type Target } from './types';

export type Problem =
  | { kind: 'noSteps' }
  | { kind: 'actionLocked'; action: ActionName }
  | { kind: 'tooManySteps'; steps: number; max: number }
  | { kind: 'conditionLocked'; level: ConditionLevel }
  | { kind: 'autoLocked' }
  | { kind: 'autoNeedsCondition' }
  | { kind: 'namedLocked' }
  | { kind: 'tooExpensive'; cost: number; maxPips: number }
  | { kind: 'tooManyTriggers'; triggers: number; max: number }
  /** A step aims at "the one that set off the condition", but no trigger names such a unit. */
  | { kind: 'triggerTargetMismatch'; stepIndex: number }
  | { kind: 'numberOutOfRange'; what: 'hpPercent' | 'count'; value: number }
  /** A Legendary action on a card for a regular slot. */
  | { kind: 'legendaryOutsideSlot'; action: LegendaryAction }
  /** The Legendary slot's card has no Legendary action. */
  | { kind: 'legendaryMissing' }
  /** More than one Legendary action on a card. */
  | { kind: 'tooManyLegendary'; count: number }
  /** A Legendary action no boss has taught you yet. */
  | { kind: 'legendaryNotLearned'; action: LegendaryAction };

/** Which slot the card is for, and the Legendary actions you have learned. */
export interface SlotContext {
  legendarySlot: boolean;
  learned: readonly LegendaryAction[];
}

/** A regular slot, before any boss is beaten. */
export const REGULAR_SLOT: SlotContext = { legendarySlot: false, learned: [] };

export interface Verdict {
  ok: boolean;
  cost: number;
  problems: Problem[];
  /** The lowest higher rank that would accept the card, or null if no rank would. */
  unlockRank: RankNumber | null;
}

/** How complex the card's condition is. */
export function conditionLevel(card: Card): ConditionLevel {
  if (!card.condition || card.condition.triggers.length === 0) return 'none';
  if (card.condition.repeat) return 'repeating';
  return card.condition.triggers.length > 1 ? 'combined' : 'simple';
}

/** Everything wrong with the card at this rank, for this slot; empty when it is legal. */
export function cardProblems(card: Card, rank: RankNumber, slot: SlotContext = REGULAR_SLOT): Problem[] {
  const rules = rankRules(rank);
  const problems: Problem[] = [];
  const cost = cardCost(card);

  // Steps your General added skip the step limit and may use any action (they still cost pips).
  const written = card.steps.filter((s) => !s.byGeneral);
  if (written.length === 0) problems.push({ kind: 'noSteps' });
  const allowed = new Set<ActionName>(unlockedActions(rank));
  for (const step of written) {
    if (isLegendaryAction(step.action)) continue;
    if (!allowed.has(step.action) && !problems.some((p) => p.kind === 'actionLocked' && p.action === step.action)) {
      problems.push({ kind: 'actionLocked', action: step.action });
    }
  }
  problems.push(...legendaryProblems(written, slot));
  if (written.length > rules.stepsPerCard) {
    problems.push({ kind: 'tooManySteps', steps: written.length, max: rules.stepsPerCard });
  }

  const level = conditionLevel(card);
  if (CONDITION_LEVELS.indexOf(level) > CONDITION_LEVELS.indexOf(rules.conditions)) {
    problems.push({ kind: 'conditionLocked', level });
  }
  const triggers = card.condition?.triggers ?? [];
  if (triggers.length > CARD_RULES.maxTriggers) {
    problems.push({ kind: 'tooManyTriggers', triggers: triggers.length, max: CARD_RULES.maxTriggers });
  }
  for (const t of triggers) {
    if (t.kind === 'allyBelowHp' && !inRange(t.hpPercent, CARD_RULES.hpPercentRange)) {
      problems.push({ kind: 'numberOutOfRange', what: 'hpPercent', value: t.hpPercent });
    }
    if (t.kind === 'enemiesGrouped' && !inRange(t.count, CARD_RULES.groupedCountRange)) {
      problems.push({ kind: 'numberOutOfRange', what: 'count', value: t.count });
    }
  }

  if (card.auto && level === 'none') problems.push({ kind: 'autoNeedsCondition' });
  else if (card.auto && !rules.autoMode) problems.push({ kind: 'autoLocked' });

  if (!rules.namedTargets && card.steps.some(namesAVeteran)) problems.push({ kind: 'namedLocked' });

  card.steps.forEach((step, stepIndex) => {
    const needs = triggerNeeded(step);
    if (!needs) return;
    const ok = triggers.some((t) =>
      needs === 'enemy' ? t.kind === 'enemyReachesBackline' || t.kind === 'enemiesGrouped' : t.kind === 'allyBelowHp',
    );
    if (!ok) problems.push({ kind: 'triggerTargetMismatch', stepIndex });
  });

  if (cost > rules.maxPips) problems.push({ kind: 'tooExpensive', cost, maxPips: rules.maxPips });
  return problems;
}

/** Problems a higher rank can fix. The rest make a card illegal at every rank. */
const RANK_PROBLEMS = new Set<Problem['kind']>([
  'actionLocked',
  'tooManySteps',
  'conditionLocked',
  'autoLocked',
  'namedLocked',
  'tooExpensive',
]);

export function validateCard(card: Card, rank: RankNumber, slot: SlotContext = REGULAR_SLOT): Verdict {
  const problems = cardProblems(card, rank, slot);
  const cost = cardCost(card);
  if (problems.length === 0) return { ok: true, cost, problems, unlockRank: null };
  let unlockRank: RankNumber | null = null;
  if (problems.every((p) => RANK_PROBLEMS.has(p.kind))) {
    unlockRank = RANKS.find((r) => r.rank > rank && cardProblems(card, r.rank, slot).length === 0)?.rank ?? null;
  }
  return { ok: false, cost, problems, unlockRank };
}

/**
 * The Legendary slot's card carries exactly one Legendary action, one you have learned; no other
 * card carries any.
 */
function legendaryProblems(written: readonly Step[], slot: SlotContext): Problem[] {
  const legendary = written.map((s) => s.action).filter(isLegendaryAction);
  if (!slot.legendarySlot) return legendary.slice(0, 1).map((action) => ({ kind: 'legendaryOutsideSlot', action }));
  if (legendary.length === 0) return written.length > 0 ? [{ kind: 'legendaryMissing' }] : [];
  const problems: Problem[] = [];
  if (legendary.length > 1) problems.push({ kind: 'tooManyLegendary', count: legendary.length });
  for (const action of new Set(legendary)) {
    if (!slot.learned.includes(action)) problems.push({ kind: 'legendaryNotLearned', action });
  }
  return problems;
}

/** Slot numbers start at 0. A slot beyond your rank's count is locked. */
export function slotUnlockRank(slotIndex: number, rank: RankNumber): RankNumber | null {
  if (slotIndex < rankRules(rank).slots) return null;
  return RANKS.find((r) => r.slots > slotIndex)?.rank ?? null;
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}

function isNamed(target: Target | null): boolean {
  return target?.kind === 'named';
}

function namesAVeteran(step: Step): boolean {
  if ('actors' in step && step.actors.kind === 'named') return true;
  switch (step.action) {
    case 'focus':
    case 'protect':
      return isNamed(step.target);
    case 'fallBack':
      return isNamed(step.to);
    case 'move':
      return step.to.kind === 'ally' && isNamed(step.to.ally);
    case 'hijack':
    case 'swap':
    case 'bloodPact':
      return isNamed(step.target);
    case 'fortify':
      return step.at.kind === 'ally' && isNamed(step.at.ally);
    default:
      return false;
  }
}

/** Whether the step aims at the unit that set off the condition, and on which side it must be. */
function triggerNeeded(step: Step): 'enemy' | 'ally' | null {
  switch (step.action) {
    case 'focus':
      return step.target.kind === 'trigger' ? 'enemy' : null;
    case 'protect':
      return step.target.kind === 'trigger' ? 'ally' : null;
    case 'fallBack':
      return step.to?.kind === 'trigger' ? 'ally' : null;
    case 'move':
      return step.to.kind === 'ally' && step.to.ally.kind === 'trigger' ? 'ally' : null;
    case 'hijack':
      return step.target.kind === 'trigger' ? 'enemy' : null;
    case 'swap':
    case 'bloodPact':
      return step.target.kind === 'trigger' ? 'ally' : null;
    case 'fortify':
      return step.at.kind === 'ally' && step.at.ally.kind === 'trigger' ? 'ally' : null;
    default:
      return null;
  }
}
