// Checking a won campaign battle against your General's Mastery challenges (session 5E). Pure.

import { masteryId } from '../campaign/mastery';
import type { GeneralId } from '../data/generals';
import { MASTERY, type MasteryGoal, type MasteryId } from '../data/mastery';
import type { BattleFacts } from './battleFacts';

/** True if the battle meets the goal. Every goal needs a win. */
export function meets(goal: MasteryGoal, facts: BattleFacts): boolean {
  if (!facts.won) return false;
  switch (goal.kind) {
    case 'fewCards':
      return facts.cards <= goal.max;
    case 'noLosses':
      return facts.lost === 0;
    case 'comeback':
      return facts.lost >= goal.lost;
    case 'perfects':
      return facts.perfects >= goal.min;
    case 'combos':
      return facts.combos >= goal.min;
    case 'ultimates':
      return facts.ultimates >= goal.min;
    case 'finisher':
      return facts.finishers > 0;
    case 'fast':
      return facts.seconds < goal.seconds;
    case 'patient':
      return facts.firstCardSeconds === null || facts.firstCardSeconds >= goal.seconds;
  }
}

/** The challenges of the General you led with that this battle meets. */
export function metChallenges(general: GeneralId, facts: BattleFacts): MasteryId[] {
  return MASTERY[general].flatMap((c, i) => (meets(c.goal, facts) ? [masteryId(general, i)] : []));
}
