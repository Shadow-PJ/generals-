// Finds signature combos in a card: certain steps in a row (docs/DESIGN.md, Combos). The
// Conductor uses this to reorder steps; phase 4 uses it to give combos their bonuses.

import { SIGNATURE_COMBOS, type SignatureCombo, type SignatureComboId } from '../data/combos';
import type { Actors, Step } from './types';

function sameActors(a: Actors, b: Actors): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function actorsOf(step: Step): Actors | null {
  return step.action === 'callReserve' ? null : step.actors;
}

/** True if `first` then `next` make this combo. */
export function makesCombo(combo: SignatureCombo, first: Step, next: Step): boolean {
  if (first.action !== combo.first || next.action !== combo.then) return false;
  const a = actorsOf(first);
  const b = actorsOf(next);
  if (combo.sameActors && (!a || !b || !sameActors(a, b))) return false;
  if (combo.actorClass && (a?.kind !== 'class' || a.cls !== combo.actorClass)) return false;
  if (combo.firstPlace && (first.action !== 'move' || first.to.kind !== combo.firstPlace)) return false;
  return true;
}

/** The signature combos made by neighbouring steps, in order. */
export function signatureCombos(steps: readonly Step[]): SignatureComboId[] {
  const found: SignatureComboId[] = [];
  for (let i = 0; i + 1 < steps.length; i++) {
    const combo = SIGNATURE_COMBOS.find((c) => makesCombo(c, steps[i]!, steps[i + 1]!));
    if (combo) found.push(combo.id);
  }
  return found;
}
