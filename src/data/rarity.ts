// Rarity (sessions 5B and 5C): every fighter and boon a run offers is Common, Rare, Epic or
// Legendary. Each offer rolls its rarity with these chances, which shift toward the rare ones
// deeper in a run and after an elite fight. Rarer fighters have better stats and perks.
// Starting values to tune.

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RarityRules {
  name: string;
  /** Chance an offer rolls this rarity, in percent; the four add up to 100. */
  chance: number;
  /** A fighter of this rarity has this much more max HP and damage (0.1 = 10%). */
  statBonus: number;
  /** How many perks a fighter of this rarity has. */
  perks: number;
}

export const RARITY_RULES: Readonly<Record<Rarity, RarityRules>> = {
  common: { name: 'Common', chance: 60, statBonus: 0, perks: 0 },
  rare: { name: 'Rare', chance: 28, statBonus: 0.1, perks: 1 },
  epic: { name: 'Epic', chance: 10, statBonus: 0.2, perks: 1 },
  legendary: { name: 'Legendary', chance: 2, statBonus: 0.35, perks: 2 },
};

/**
 * How the chances move, in percentage points: for each floor of a run past the first, and once
 * more for the spoils of an elite fight. A chance never drops below 0.
 */
export const RARITY_SHIFT: Readonly<{ perFloor: Record<Rarity, number>; elite: Record<Rarity, number> }> = {
  perFloor: { common: -4, rare: 2.5, epic: 1.2, legendary: 0.3 },
  elite: { common: -15, rare: 8, epic: 5, legendary: 2 },
};

/** The chance of each rarity, in percent, on this floor (0 is the first), after an elite fight or not. */
export function rarityChances(floor: number, elite = false): Record<Rarity, number> {
  const chances = {} as Record<Rarity, number>;
  for (const r of RARITIES) {
    const shifted = RARITY_RULES[r].chance + RARITY_SHIFT.perFloor[r] * Math.max(0, floor) + (elite ? RARITY_SHIFT.elite[r] : 0);
    chances[r] = Math.max(0, shifted);
  }
  return chances;
}

/** The next rarity up, or null at Legendary. */
export function rarityAbove(rarity: Rarity): Rarity | null {
  return RARITIES[RARITIES.indexOf(rarity) + 1] ?? null;
}
