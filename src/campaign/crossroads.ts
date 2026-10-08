// Crossroads (session 7F): which battles of a run's map are crossroads, the two deals a won one
// offers, and what a deal does to your run. See src/data/crossroads.ts.

import { CROSSROADS_RULES, DEAL_IDS, DEALS, type DealId } from '../data/crossroads';
import type { EventChoice } from '../data/events';
import { RUN_RULES } from '../data/runs';
import { createRng, nextFloat, type RngState } from '../sim';
import { choiceProblem } from './events';
import { shuffled } from './random';
import type { RunNode, RunState } from './types';

/**
 * A node's own roll for being a crossroads, from the run's seed alone: marking the crossroads
 * takes nothing from the run's generator, so the rest of the map and the run roll as before.
 */
function crossroadsRoll(seed: number, floor: number, index: number): number {
  return nextFloat(createRng((seed ^ ((floor + 1) * 0x27d4eb2d) ^ ((index + 1) * 0x165667b1)) | 0));
}

/** The map with its crossroads marked: some battles past the first floor. */
export function markCrossroads(map: RunNode[][], seed: number): RunNode[][] {
  return map.map((floor, f) =>
    floor.map((node, i) =>
      node.kind === 'battle' && f > 0 && f < RUN_RULES.floors - 1 && crossroadsRoll(seed, f, i) < CROSSROADS_RULES.chance ? { ...node, crossroads: true } : node,
    ),
  );
}

/** A deal as a choice: its gain, then its cost. */
export function dealChoice(id: DealId): EventChoice {
  const deal = DEALS[id];
  return { label: deal.name, text: `${deal.gainText}; ${deal.costText}`, effects: [...deal.gain, ...deal.cost] };
}

/** Why you can't take this deal now (not enough gold, no boon to give up...), or null if you can. */
export function dealProblem(run: RunState, id: DealId): string | null {
  return choiceProblem(run, dealChoice(id));
}

/**
 * The deals a won crossroads offers: two you can pay for, costing different kinds of things, or
 * null when there aren't two (then the spoils are the usual pick).
 */
export function rollDeals(rng: RngState, run: RunState): DealId[] | null {
  const deals: DealId[] = [];
  for (const id of shuffled(rng, DEAL_IDS)) {
    if (deals.length === CROSSROADS_RULES.deals) break;
    if (dealProblem(run, id) !== null || deals.some((d) => DEALS[d].costKind === DEALS[id].costKind)) continue;
    deals.push(id);
  }
  return deals.length === CROSSROADS_RULES.deals ? deals : null;
}
