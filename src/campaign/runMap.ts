// A run's map, made from its seed: floors of nodes side by side, each leading on to one or two
// nodes of the next floor, with no paths crossing. The first floor is all battles, the floor
// before the boss all rest camps, and the boss stands alone at the end.

import { RUN_RULES, type NodeKind } from '../data/runs';
import { nextInt, type RngState } from '../sim';
import { chance, weighted } from './random';
import type { RunNode, RunState } from './types';

export function generateRunMap(rng: RngState): RunNode[][] {
  const floors: RunNode[][] = [];
  for (let f = 0; f < RUN_RULES.floors; f++) {
    const width = RUN_RULES.minWidth + nextInt(rng, RUN_RULES.maxWidth - RUN_RULES.minWidth + 1);
    floors.push(Array.from({ length: width }, () => ({ kind: nodeKind(rng, f), next: [] })));
  }
  // One floor always has a merchant on one of its paths.
  const market = floors[RUN_RULES.merchantFloor];
  if (market && !market.some((n) => n.kind === 'merchant')) market[nextInt(rng, market.length)]!.kind = 'merchant';
  floors.push([{ kind: 'boss', next: [] }]);
  for (let f = 0; f + 1 < floors.length; f++) connect(rng, floors[f]!, floors[f + 1]!.length);
  return floors;
}

function nodeKind(rng: RngState, floor: number): NodeKind {
  if (floor === 0) return 'battle';
  if (floor === RUN_RULES.floors - 1) return 'camp';
  const { battle, event, elite, merchant, camp } = RUN_RULES.nodeWeights;
  const special = floor >= RUN_RULES.firstSpecialFloor;
  return weighted(rng, { battle, event, elite: special ? elite : 0, merchant: special ? merchant : 0, camp: special ? camp : 0 });
}

/**
 * Paths from one floor to the next. Each node leads to the node at the same height on the next
 * floor; any node left without a way in gets one from the node just above it; then some nodes
 * get a second path to a neighbour, where it crosses no other path.
 */
function connect(rng: RngState, from: RunNode[], toCount: number): void {
  const n = from.length;
  const target = (i: number) => (n === 1 ? Math.floor((toCount - 1) / 2) : Math.round((i * (toCount - 1)) / (n - 1)));
  from.forEach((node, i) => (node.next = [target(i)]));
  for (let j = 0; j < toCount; j++) {
    if (from.some((node) => node.next.includes(j))) continue;
    let i = n - 1;
    while (i > 0 && target(i) > j) i--;
    from[i]!.next.push(j);
  }
  from.forEach((node, i) => {
    if (!chance(rng, RUN_RULES.extraPathChance)) return;
    const up = chance(rng, 0.5);
    const low = Math.min(...node.next);
    const high = Math.max(...node.next);
    if (up && low > 0 && (i === 0 || Math.max(...from[i - 1]!.next) <= low - 1)) node.next.push(low - 1);
    else if (!up && high < toCount - 1 && (i === n - 1 || Math.min(...from[i + 1]!.next) >= high + 1)) node.next.push(high + 1);
  });
  for (const node of from) node.next.sort((a, b) => a - b);
}

/** The nodes you may go to next: any on the first floor, then those your node leads to. */
export function nextChoices(run: RunState): number[] {
  if (run.path.length === 0) return run.map[0]!.map((_, i) => i);
  const floor = run.path.length - 1;
  if (floor + 1 >= run.map.length) return [];
  return [...run.map[floor]![run.path[floor]!]!.next];
}

/** The node you are on, if you have set out. */
export function currentNode(run: RunState): { floor: number; index: number; node: RunNode } | null {
  const floor = run.path.length - 1;
  if (floor < 0) return null;
  const index = run.path[floor]!;
  return { floor, index, node: run.map[floor]![index]! };
}
