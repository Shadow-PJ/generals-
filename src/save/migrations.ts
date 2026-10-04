// Save migrations: each step turns a save of one version into the next, so a save from any
// older version of the game still loads after an update. A save is read as plain data first;
// readProfile then keeps only the parts that read correctly.
//
// Version 1 (sessions 2C to 4D): the rank was a debug switch on the Orders screen.
// Version 2 (session 5A): the rank is earned with Command XP; boss wins open the Legendary slot.
// Version 3 (session 5B): the campaign: the run you are on, and the artifacts you have banked.

import { RANK_XP } from '../data/progression';
import { RANKS, type RankNumber } from '../data/ranks';

export type SaveData = Record<string, unknown>;

/** The rank a version 1 save had when it set none: the debug switch's default. */
const V1_DEFAULT_RANK: RankNumber = 3;

const MIGRATIONS: Readonly<Record<number, (save: SaveData) => SaveData>> = {
  /** The debug rank becomes the XP that earns it, so nobody loses the rank they were playing at. */
  1: (save) => {
    const { rank, ...rest } = save;
    const kept = RANKS.find((r) => r.rank === rank)?.rank ?? V1_DEFAULT_RANK;
    return { ...rest, version: 2, xp: RANK_XP[kept], bossesBeaten: [] };
  },
  /** No run yet, and nothing banked. */
  2: (save) => ({ ...save, version: 3, run: null, artifacts: [] }),
};

/** The save's version: 1 when it has none (the first saves wrote 1, but be forgiving). */
export function saveVersion(save: SaveData): number {
  const v = save.version;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1;
}

/**
 * The save brought up to `target`, one version at a time. A save from a newer game than this
 * one is returned as it is: readProfile keeps what it understands.
 */
export function migrate(save: SaveData, target: number): SaveData {
  let data = save;
  for (let v = saveVersion(save); v < target; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration from save version ${v}`);
    data = step(data);
  }
  return data;
}
