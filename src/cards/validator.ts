// The validator: the only gate for rank rules. Every card is checked against your Command Rank
// before it reaches a slot, whether it was built from menus, typed or written by a model, so
// no order can break balance. It also finds the lowest rank that would allow a rejected card.

import { CARD_RULES } from '../data/cards';
import { CONDITION_LEVELS, RANKS, rankRules, unlockedActions, type ConditionLevel, type RankNumber } from '../data/ranks';
import { cardCost } from './cost';
import type { ActionName, Card, Step, Target } from './types';

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
  | { kind: 'numberOutOfRange'; what: 'hpPercent' | 'count'; value: number };

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

/** Everything wrong with the card at this rank; empty when it is legal. */
export function cardProblems(card: Card, rank: RankNumber): Problem[] {
  const rules = rankRules(rank);
  const problems: Problem[] = [];
  const cost = cardCost(card);

  if (card.steps.length === 0) problems.push({ kind: 'noSteps' });
  const allowed = new Set(unlockedActions(rank));
  for (const step of card.steps) {
    if (!allowed.has(step.action) && !problems.some((p) => p.kind === 'actionLocked' && p.action === step.action)) {
      problems.push({ kind: 'actionLocked', action: step.action });
    }
  }
  if (card.steps.length > rules.stepsPerCard) {
    problems.push({ kind: 'tooManySteps', steps: card.steps.length, max: rules.stepsPerCard });
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

export function validateCard(card: Card, rank: RankNumber): Verdict {
  const problems = cardProblems(card, rank);
  const cost = cardCost(card);
  if (problems.length === 0) return { ok: true, cost, problems, unlockRank: null };
  let unlockRank: RankNumber | null = null;
  if (problems.every((p) => RANK_PROBLEMS.has(p.kind))) {
    unlockRank = RANKS.find((r) => r.rank > rank && cardProblems(card, r.rank).length === 0)?.rank ?? null;
  }
  return { ok: false, cost, problems, unlockRank };
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
    default:
      return null;
  }
}
