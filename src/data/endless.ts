// Endless (session 7G; from 9 Kings, see docs/inspiration.md). Once every region's ruler has
// fallen, beating a ruler offers to march on: the run goes on past its ruler onto a fresh map of
// the same region, a lap, with stronger armies on every lap, for a high score. Starting values
// to tune.

export const ENDLESS_RULES = {
  /** What each lap past the ruler adds to every enemy army, on top of the run's own difficulty. */
  perLap: { rare: 1, epic: 1, commander: 1 },
  /** From the lap after this one, each lap also makes one more enemy troop Legendary. */
  legendaryAfterLap: 2,
  /** A fight won past the ruler scores this much; a ruler beaten again, this much more. */
  score: { fight: 1, ruler: 5 },
} as const;
