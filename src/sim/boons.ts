// Run fighters and boons in battle (session 5B): a troop's rarity raises its HP and damage, and a
// side's boons raise its troops' stats and give its Command bar pips and Momentum. The battle reads
// them from the setup as plain ids and looks every number up in src/data.

import { BOONS, type BoonEffect, type BoonId, type BoonStat } from '../data/boons';
import { RARITY_RULES, type Rarity } from '../data/rarity';
import type { UnitClass, UnitStats } from '../data/units';

function effects(boons: readonly BoonId[]): BoonEffect[] {
  return boons.flatMap((id) => [...(BOONS[id]?.effects ?? [])]);
}

/** A troop's stats with its rarity and its side's boons added. Boons for the same stat add up. */
export function boostedStats(stats: UnitStats, cls: UnitClass, rarity: Rarity, boons: readonly BoonId[]): UnitStats {
  const boosted = { ...stats };
  const rarityBonus = RARITY_RULES[rarity].statBonus;
  const bonus: Record<BoonStat, number> = { damage: rarityBonus, maxHp: rarityBonus, moveSpeed: 0, attacksPerSecond: 0 };
  for (const effect of effects(boons)) {
    if (effect.kind === 'stat' && (effect.cls === null || effect.cls === cls)) bonus[effect.stat] += effect.bonus;
  }
  for (const stat of Object.keys(bonus) as BoonStat[]) boosted[stat] *= 1 + bonus[stat];
  boosted.maxHp = Math.round(boosted.maxHp);
  return boosted;
}

/** Extra pips every battle starts with. */
export function extraStartingPips(boons: readonly BoonId[]): number {
  return effects(boons).reduce((sum, e) => sum + (e.kind === 'startPips' ? e.amount : 0), 0);
}

/** Momentum every battle starts with. */
export function startingMomentum(boons: readonly BoonId[]): number {
  return effects(boons).reduce((sum, e) => sum + (e.kind === 'startMomentum' ? e.amount : 0), 0);
}

/** How much faster pips refill (0.25 = 25%). */
export function pipRateBonus(boons: readonly BoonId[]): number {
  return effects(boons).reduce((sum, e) => sum + (e.kind === 'pipRate' ? e.bonus : 0), 0);
}
