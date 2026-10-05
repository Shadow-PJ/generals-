// Save migrations: each step turns a save of one version into the next, so a save from any
// older version of the game still loads after an update. A save is read as plain data first;
// readProfile then keeps only the parts that read correctly.
//
// Version 1 (sessions 2C to 4D): the rank was a debug switch on the Orders screen.
// Version 2 (session 5A): the rank is earned with Command XP; boss wins open the Legendary slot.
// Version 3 (session 5B): the campaign: the run you are on, and the artifacts you have banked.
// Version 4 (session 5C): run fighters have a faction and perks; those from version 3 have none.
// Version 5 (session 5E): your company, Insight, Tech Web, Ironman and Mastery; run fighters have
// a name, a record, an artifact slot and a wounded flag.
// Version 6 (session 6A): the Captain's tips. A save that has already earned XP has played its
// first battles, so tips start off there (Settings turns them back on).

import { defaultKeep, freshName, NO_RECORD, startingCompany } from '../campaign/company';
import type { Fighter } from '../campaign/types';
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
  /** The fighters of a run in progress, and those on offer, join no faction and have no perks. */
  3: (save) => ({ ...save, version: 4, run: plainFighters(save.run) }),
  /** The starting company, no Insight or Tech Web yet; a run in progress names its fighters, who start their records now. */
  4: (save) => ({ ...save, version: 5, company: startingCompany(), insight: 0, tech: {}, ironman: false, mastery: [], run: namedFighters(save.run) }),
  /** The Captain's tips: on for a save that has earned no XP yet, off for one that has played. */
  5: (save) => ({ ...save, version: 6, tutorial: { on: !(typeof save.xp === 'number' && save.xp > 0), seen: [] } }),
};

/** A version 4 run: every fighter named, with a fresh record, no artifact and fit; a won end lets the usual fighters stay. */
function namedFighters(run: unknown): unknown {
  if (typeof run !== 'object' || run === null || Array.isArray(run)) return run;
  const r = run as SaveData;
  if (!Array.isArray(r.roster)) return run;
  const seed = typeof r.seed === 'number' ? r.seed : 0;
  const used: string[] = [];
  const roster = r.roster.map((f) => {
    if (typeof f !== 'object' || f === null) return f;
    const id = typeof (f as SaveData).id === 'number' ? ((f as SaveData).id as number) : 0;
    const name = freshName(used, seed + id * 37);
    used.push(name);
    return { ...(f as SaveData), name, record: { ...NO_RECORD }, artifact: null, veteranId: null, wounded: false };
  });
  let stop = r.stop;
  if (typeof stop === 'object' && stop !== null && (stop as SaveData).kind === 'end') {
    const s = stop as SaveData;
    const keep = s.won === true ? defaultKeep(roster.filter((f): f is Fighter => typeof f === 'object' && f !== null) as Fighter[]) : [];
    stop = { ...s, keep, died: [] };
  }
  return { ...r, roster, stop, insight: 0, ironman: false };
}

/** A version 3 run with every fighter, and every fighter on offer, given no faction and no perks. */
function plainFighters(run: unknown): unknown {
  if (typeof run !== 'object' || run === null || Array.isArray(run)) return run;
  const r = run as SaveData;
  const plain = (f: unknown) => (typeof f === 'object' && f !== null ? { faction: null, perks: [], ...(f as SaveData) } : f);
  const plainOffer = (o: unknown) => (typeof o === 'object' && o !== null && (o as SaveData).kind === 'fighter' ? plain(o) : o);
  const stop = typeof r.stop === 'object' && r.stop !== null ? { ...(r.stop as SaveData) } : r.stop;
  if (stop && typeof stop === 'object') {
    const s = stop as SaveData;
    if (Array.isArray(s.offers)) s.offers = s.offers.map(plainOffer);
    if (Array.isArray(s.stock)) s.stock = s.stock.map((i) => (typeof i === 'object' && i !== null ? { ...(i as SaveData), offer: plainOffer((i as SaveData).offer) } : i));
  }
  return { ...r, roster: Array.isArray(r.roster) ? r.roster.map(plain) : r.roster, stop };
}

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
