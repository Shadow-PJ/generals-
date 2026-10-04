// Rarity (session 5B): every fighter and boon a run offers is Common, Rare, Epic or Legendary.
// Each offer rolls its rarity with these chances, and rarer fighters have better stats.
// Starting values to tune; session 5C adds perks and shifts the chances deeper in a run.

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RarityRules {
  name: string;
  /** Chance an offer rolls this rarity, in percent; the four add up to 100. */
  chance: number;
  /** A fighter of this rarity has this much more max HP and damage (0.1 = 10%). */
  statBonus: number;
}

export const RARITY_RULES: Readonly<Record<Rarity, RarityRules>> = {
  common: { name: 'Common', chance: 60, statBonus: 0 },
  rare: { name: 'Rare', chance: 28, statBonus: 0.1 },
  epic: { name: 'Epic', chance: 10, statBonus: 0.2 },
  legendary: { name: 'Legendary', chance: 2, statBonus: 0.35 },
};

/** The next rarity up, or null at Legendary. */
export function rarityAbove(rarity: Rarity): Rarity | null {
  return RARITIES[RARITIES.indexOf(rarity) + 1] ?? null;
}
