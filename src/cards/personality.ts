// Personality rules: each General edits a finished, validated card by fixed rules. This is the
// last step of the order pipeline (translator, validator, personality). The rules are pure and
// deterministic, so the battle engine runs them too and replays stay exact.
// Steps a General adds are marked `byGeneral`: they skip the step limit but still cost pips.

import {
  GENERALS,
  HIVE_MOTHER_RULES,
  STRATEGIST_RULES,
  WARLORD_RULES,
  type GeneralId,
  type SuggestedTrigger,
} from '../data/generals';
import { rankRules, type RankNumber } from '../data/ranks';
import { signatureCombos } from './combos';
import type { Card, Condition, Place, Step, Target, Trigger } from './types';
import { validateCard } from './validator';

/** A rule that shaped or judged a card; each has its own reply lines in src/data/replies.ts. */
export type PersonalityRule =
  | 'counterAttack'
  | 'heldBack'
  | 'holdBeforeMove'
  | 'dropSteps'
  | 'simplifyTargets'
  | 'suggestCondition'
  | 'reorderForCombo'
  | 'alreadyCombo';

export interface Reading {
  general: GeneralId;
  /** The card as your General will carry it out. */
  card: Card;
  /** The rules that applied, in order; empty when the card stays exactly as written. */
  rules: PersonalityRule[];
  /** The Strategist's suggested condition, for you to accept or ignore. */
  suggestion: Condition | null;
}

/** How your General reads a card that already passed the validator. */
export function applyPersonality(general: GeneralId, card: Card, rank: RankNumber): Reading {
  const written = structuredClone(card);
  switch (general) {
    case 'captain':
      return { general, card: written, rules: [], suggestion: null };
    case 'warlord':
      return { general, ...warlord(written), suggestion: null };
    case 'engineer':
      return { general, ...engineer(written), suggestion: null };
    case 'hiveMother':
      return { general, ...hiveMother(written), suggestion: null };
    case 'strategist':
      return strategist(written, rank);
    case 'conductor':
      return { general, ...conductor(written), suggestion: null };
  }
}

type Edit = { card: Card; rules: PersonalityRule[] };

/** Warlord: every Fall Back gets a counter-attack (Focus the nearest enemy) unless you write "hold back". */
function warlord(card: Card): Edit {
  const text = card.text?.toLowerCase() ?? '';
  const insisted = WARLORD_RULES.insistWords.some((w) => text.includes(w));
  const steps: Step[] = [];
  let added = false;
  let heldBack = false;
  card.steps.forEach((step, i) => {
    steps.push(step);
    if (step.action !== 'fallBack' || card.steps[i + 1]?.action === 'focus') return;
    if (insisted) {
      heldBack = true;
      return;
    }
    steps.push({ action: 'focus', actors: step.actors, target: { kind: 'nearest' }, byGeneral: true });
    added = true;
  });
  return { card: { ...card, steps }, rules: added ? ['counterAttack'] : heldBack ? ['heldBack'] : [] };
}

/** Engineer: a Hold by the same troops before every Move, for 1 extra pip. */
function engineer(card: Card): Edit {
  const steps: Step[] = [];
  let added = false;
  for (const step of card.steps) {
    const before = steps[steps.length - 1];
    const alreadyHeld = before?.action === 'hold' && step.action === 'move' && sameJson(before.actors, step.actors);
    if (step.action === 'move' && !alreadyHeld) {
      steps.push({ action: 'hold', actors: step.actors, byGeneral: true });
      added = true;
    }
    steps.push(step);
  }
  return { card: { ...card, steps }, rules: added ? ['holdBeforeMove'] : [] };
}

/** Hive Mother: at most 2 steps (the last ones go), and specific targets become the nearest of their class. */
function hiveMother(card: Card): Edit {
  const rules: PersonalityRule[] = [];
  let steps = card.steps;
  if (steps.length > HIVE_MOTHER_RULES.maxSteps) {
    steps = steps.slice(0, HIVE_MOTHER_RULES.maxSteps);
    rules.push('dropSteps');
  }
  const simple = steps.map((step) => simplifyStep(step, card.condition));
  if (!sameJson(simple, steps)) rules.push('simplifyTargets');
  return { card: { ...card, steps: simple }, rules };
}

function simplifyStep(step: Step, condition: Condition | null): Step {
  switch (step.action) {
    case 'focus':
      return { ...step, target: simplifyTarget(step.target, 'enemy', condition) };
    case 'protect':
      return { ...step, target: simplifyTarget(step.target, 'ally', condition) };
    case 'fallBack':
      return step.to ? { ...step, to: simplifyTarget(step.to, 'ally', condition) } : step;
    case 'move':
      return { ...step, to: simplifyPlace(step.to, condition) };
    default:
      return step;
  }
}

function simplifyPlace(place: Place, condition: Condition | null): Place {
  return place.kind === 'ally' ? { kind: 'ally', ally: simplifyTarget(place.ally, 'ally', condition) } : place;
}

/** A class target already means the nearest of that class; anything more specific becomes that. */
function simplifyTarget(target: Target, side: 'enemy' | 'ally', condition: Condition | null): Target {
  switch (target.kind) {
    case 'class':
    case 'nearest':
      return target;
    case 'trigger': {
      // "Him" (the one that set off the condition) becomes the nearest of his class.
      const cls = triggerClass(condition?.triggers ?? [], side);
      return cls ? { kind: 'class', cls } : { kind: 'nearest' };
    }
    case 'weakest':
    case 'named':
      // Named veterans arrive in phase 5; until the Hive Mother knows their class, the nearest troop.
      return { kind: 'nearest' };
  }
}

function triggerClass(triggers: readonly Trigger[], side: 'enemy' | 'ally') {
  for (const t of triggers) {
    if (side === 'enemy' && t.kind === 'enemyReachesBackline') return t.enemy === 'any' ? null : t.enemy;
    if (side === 'ally' && t.kind === 'allyBelowHp') return t.ally === 'any' ? null : t.ally;
  }
  return null;
}

/** Strategist: a card without a condition gets a suggested one, if your rank allows it. The card itself stays. */
function strategist(card: Card, rank: RankNumber): Reading {
  const plain: Reading = { general: 'strategist', card, rules: [], suggestion: null };
  const first = card.steps[0];
  if (card.condition || !first || rankRules(rank).conditions === 'none') return plain;
  const suggestion: Condition = {
    triggers: [resolveSuggestion(STRATEGIST_RULES.suggestions[first.action], first)],
    repeat: false,
  };
  if (!validateCard({ ...card, condition: suggestion }, rank).ok) return plain;
  return { ...plain, rules: ['suggestCondition'], suggestion };
}

function resolveSuggestion(suggested: SuggestedTrigger, step: Step): Trigger {
  const aimed = step.action === 'focus' || step.action === 'protect' ? step.target : null;
  const cls = aimed?.kind === 'class' ? aimed.cls : null;
  switch (suggested.kind) {
    case 'enemyReachesBackline': {
      if (suggested.enemy !== 'target') return { kind: suggested.kind, enemy: suggested.enemy };
      return { kind: suggested.kind, enemy: cls && STRATEGIST_RULES.divers.includes(cls) ? cls : 'any' };
    }
    case 'allyBelowHp':
      return { kind: suggested.kind, ally: suggested.ally === 'target' ? (cls ?? 'any') : suggested.ally, hpPercent: suggested.hpPercent };
    default:
      return { ...suggested };
  }
}

/** Conductor: reorders the steps into a signature combo when some order of them makes one. */
function conductor(card: Card): Edit {
  if (signatureCombos(card.steps).length > 0) return { card, rules: ['alreadyCombo'] };
  let best: { steps: Step[]; combos: number; moved: number } | null = null;
  for (const order of permutations(card.steps.map((_, i) => i))) {
    const steps = order.map((i) => card.steps[i]!);
    const combos = signatureCombos(steps).length;
    const moved = order.reduce((sum, from, to) => sum + Math.abs(from - to), 0);
    // Most combos first, then the smallest change to what you wrote.
    if (combos > 0 && (!best || combos > best.combos || (combos === best.combos && moved < best.moved))) {
      best = { steps, combos, moved };
    }
  }
  return best ? { card: { ...card, steps: best.steps }, rules: ['reorderForCombo'] } : { card, rules: [] };
}

/** Every order of the items, starting with the original. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** "The Warlord", for screens. */
export function generalName(general: GeneralId): string {
  return GENERALS[general].name;
}
