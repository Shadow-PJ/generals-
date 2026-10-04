// Rolls for a run, all from the run's seeded generator (the battle engine's own), so the same
// seed and the same choices always give the same run.

import { RARITIES, RARITY_RULES, type Rarity } from '../data/rarity';
import { nextFloat, nextInt, type RngState } from '../sim';

/** True with chance `p` (0 to 1). */
export function chance(rng: RngState, p: number): boolean {
  return nextFloat(rng) < p;
}

/** One item of a list that isn't empty. */
export function pick<T>(rng: RngState, list: readonly T[]): T {
  if (list.length === 0) throw new Error('Nothing to pick from');
  return list[nextInt(rng, list.length)]!;
}

/** One key, by weight; keys with no weight never come up. Keys are tried in the order written. */
export function weighted<K extends string>(rng: RngState, weights: Readonly<Record<K, number>>): K {
  const keys = (Object.keys(weights) as K[]).filter((k) => weights[k] > 0);
  const total = keys.reduce((sum, k) => sum + weights[k], 0);
  let roll = nextFloat(rng) * total;
  for (const k of keys) {
    roll -= weights[k];
    if (roll < 0) return k;
  }
  return keys[keys.length - 1]!;
}

/** A rarity, with the chances in RARITY_RULES. */
export function rollRarity(rng: RngState): Rarity {
  const weights = Object.fromEntries(RARITIES.map((r) => [r, RARITY_RULES[r].chance])) as Record<Rarity, number>;
  return weighted(rng, weights);
}

/** The list in a random order. */
export function shuffled<T>(rng: RngState, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
