import { describe, expect, it } from 'vitest';
import { CROSSROADS_RULES, DEAL_IDS, DEALS, type DealId } from '../data/crossroads';
import { RUN_RULES } from '../data/runs';
import { createRng } from '../sim';
import { dealProblem, markCrossroads, rollDeals } from './crossroads';
import { dealTakeProblem, enterNode, finishFight, leaveStop, newRun, takeDeal } from './run';
import { generateRunMap } from './runMap';
import { freshCampaign, runOf, runThrough } from './testing';
import type { Campaign } from './types';

const won = { won: true, fighters: [], xp: 50 };
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7 + 1);

/** A run on a straight path whose first battle is a crossroads. */
function atCrossroads(seed = 5): Campaign {
  const c = runThrough(['battle', 'battle', 'boss'], { seed });
  const run = runOf(c);
  return { ...c, run: { ...run, map: run.map.map((floor, f) => (f === 0 ? floor.map((n) => ({ ...n, crossroads: true as const })) : floor)) } };
}

describe('crossroads on the run map (session 7F)', () => {
  it('marks some battles past the first floor, the same for the same seed, and nothing else on the map', () => {
    let marked = 0;
    let battles = 0;
    for (const seed of SEEDS) {
      const plain = generateRunMap(createRng(seed));
      const map = markCrossroads(plain, seed);
      expect(markCrossroads(plain, seed)).toEqual(map);
      // Only the flag is new: every node keeps its kind and its paths.
      expect(map.map((f) => f.map(({ kind, next }) => ({ kind, next })))).toEqual(plain);
      map.forEach((floor, f) =>
        floor.forEach((node) => {
          if (!node.crossroads) return;
          expect(node.kind).toBe('battle');
          expect(f).toBeGreaterThan(0);
          expect(f).toBeLessThan(RUN_RULES.floors - 1);
        }),
      );
      marked += map.flat().filter((n) => n.crossroads).length;
      battles += map.slice(1, RUN_RULES.floors - 1).flat().filter((n) => n.kind === 'battle').length;
    }
    // About a quarter of the battles that can be one.
    expect(marked / battles).toBeGreaterThan(CROSSROADS_RULES.chance - 0.07);
    expect(marked / battles).toBeLessThan(CROSSROADS_RULES.chance + 0.07);
  });

  it('takes nothing from the run’s generator: a new run rolls on as before', () => {
    const c = newRun(freshCampaign(), 'deepForest', 77);
    const rng = createRng(77);
    const plain = generateRunMap(rng);
    expect(runOf(c).map).toEqual(markCrossroads(plain, 77));
    expect(runOf(c).rng).toEqual(rng);
  });
});

describe('crossroads deals (session 7F)', () => {
  it('each pair a gain with a cost, written out for the screen', () => {
    for (const id of DEAL_IDS) {
      const deal = DEALS[id];
      expect(deal.gain.length).toBeGreaterThan(0);
      expect(deal.cost.length).toBeGreaterThan(0);
      expect(deal.gainText.length).toBeGreaterThan(0);
      expect(deal.costText.length).toBeGreaterThan(0);
    }
    // Every kind of cost has deals, so a crossroads can always find two that differ.
    expect(new Set(DEAL_IDS.map((id) => DEALS[id].costKind))).toEqual(new Set(['blood', 'gold', 'loss']));
  });

  it('a crossroads offers two you can pay for, never costing the same kind of thing', () => {
    const run = { ...runOf(atCrossroads()), gold: 200, boons: ['whetstones' as const] };
    for (let seed = 1; seed <= 50; seed++) {
      const deals = rollDeals(createRng(seed), run)!;
      expect(deals).toHaveLength(CROSSROADS_RULES.deals);
      expect(DEALS[deals[0]!].costKind).not.toBe(DEALS[deals[1]!].costKind);
      for (const id of deals) expect(dealProblem(run, id)).toBeNull();
    }
  });

  it('offers no gold deal you can’t afford, and none at all when only one kind can be paid', () => {
    const poor = { ...runOf(atCrossroads()), gold: 0 };
    for (let seed = 1; seed <= 30; seed++) {
      for (const id of rollDeals(createRng(seed), poor)!) expect(DEALS[id].costKind).not.toBe('gold');
    }
    // No gold, no boon and a single fighter: only blood can pay.
    const bare = { ...poor, roster: poor.roster.slice(0, 1), field: [poor.roster[0]!.id], reserves: [] };
    expect(rollDeals(createRng(1), bare)).toBeNull();
  });
});

describe('a won crossroads battle (session 7F)', () => {
  it('pays its gold and offers two deals instead of the spoils’ pick', () => {
    const c = finishFight(enterNode(atCrossroads(), 0), won);
    const stop = runOf(c).stop;
    expect(stop).toMatchObject({ kind: 'crossroads', chosen: null, outcome: [] });
    if (stop?.kind !== 'crossroads') throw new Error('no crossroads');
    expect(stop.deals).toHaveLength(2);
    expect(stop.gold).toBeGreaterThan(0);
    expect(runOf(c).gold).toBe(stop.gold);
  });

  it('an ordinary battle still offers the pick of three', () => {
    const c = finishFight(enterNode(runThrough(['battle', 'battle', 'boss']), 0), won);
    expect(runOf(c).stop).toMatchObject({ kind: 'spoils' });
  });

  it('taking a deal brings its gain and its cost; you leave only once you have chosen', () => {
    let c = finishFight(enterNode(atCrossroads(), 0), won);
    expect(() => leaveStop(c)).toThrow();
    const stop = runOf(c).stop as { deals: DealId[] };
    const blood = stop.deals.findIndex((id) => DEALS[id].costKind === 'blood');
    const index = blood >= 0 ? blood : 0;
    const before = runOf(c);
    c = takeDeal(c, index);
    const after = runOf(c);
    expect(after.stop).toMatchObject({ kind: 'crossroads', chosen: index });
    expect((after.stop as { outcome: string[] }).outcome.length).toBeGreaterThan(0);
    if (blood >= 0) {
      // Paid in blood: every fighter is hurt (never below the events' floor).
      after.roster.filter((f) => before.roster.some((b) => b.id === f.id)).forEach((f) => expect(f.hp).toBeLessThan(1));
    }
    // One deal only.
    expect(dealTakeProblem(after, 1 - index)).not.toBeNull();
    expect(() => takeDeal(c, 1 - index)).toThrow();
    c = leaveStop(c);
    expect(runOf(c).stop).toBeNull();
  });

  it('a gold deal spends the gold, and the same choices give the same run', () => {
    // Gold before the fight, so the deals rolled after it can include ones paid in gold.
    const rich = (seed: number): Campaign => {
      const c = atCrossroads(seed);
      return finishFight(enterNode({ ...c, run: { ...runOf(c), gold: 300 } }, 0), won);
    };
    for (let seed = 1; seed <= 40; seed++) {
      const c = rich(seed);
      const deals = (runOf(c).stop as { deals: DealId[] }).deals;
      const i = deals.findIndex((id) => DEALS[id].costKind === 'gold');
      if (i < 0) continue;
      const cost = DEALS[deals[i]!].cost.reduce((sum, e) => sum + (e.kind === 'gold' ? -e.amount : 0), 0);
      const gain = DEALS[deals[i]!].gain.reduce((sum, e) => sum + (e.kind === 'gold' ? e.amount : 0), 0);
      const before = runOf(c).gold;
      const after = takeDeal(c, i);
      expect(runOf(after).gold).toBe(before - cost + gain);
      expect(takeDeal(rich(seed), i)).toEqual(after);
      return;
    }
    throw new Error('no gold deal came up');
  });
});
