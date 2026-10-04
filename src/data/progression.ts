// Command XP and Ranks (session 5A): every battle earns Command XP, with bonuses for Perfect
// timings, signature combos and Finishers; enough XP raises your Command Rank. Expect about one
// rank per region. Starting values to tune; Battle IQ grades add XP from session 5D.

import type { RankNumber } from './ranks';

export const COMMAND_XP = {
  /** For the battle itself, by how it ended. */
  win: 50,
  draw: 30,
  loss: 20,
  /** Each Perfect timing, up to `maxPerfects` a battle. */
  perfect: 5,
  maxPerfects: 6,
  /** Each signature combo landed, up to `maxCombos` a battle. */
  combo: 10,
  maxCombos: 5,
  /** Each Finisher. */
  finisher: 15,
} as const;

/** Total Command XP needed for each rank, Rank I first. */
export const RANK_XP: Readonly<Record<RankNumber, number>> = { 1: 0, 2: 300, 3: 800, 4: 1500, 5: 2500 };
