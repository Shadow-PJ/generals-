import { describe, expect, it } from 'vitest';
import { recruitedGenerals } from '../data/bosses';
import { BOON_IDS, BOONS, boonClasses } from '../data/boons';
import { EVENT_IDS, EVENTS } from '../data/events';
import { RARITIES, RARITY_RULES, type Rarity } from '../data/rarity';
import { STARTER_CLASSES } from '../data/regions';
import { RUN_RULES } from '../data/runs';
import { createRng } from '../sim';
import { offerPrice, rollOffers, rollStock } from './offers';
import { rollRarity } from './random';
import {
  abandonRun,
  buy,
  buyProblem,
  chooseEvent,
  closeRun,
  enterNode,
  eventChoiceProblem,
  finishFight,
  healAtMerchant,
  healProblem,
  leaveStop,
  merchantPrices,
  newRun,
  pickSpoils,
  reroll,
  setOutProblem,
} from './run';
import { nextChoices } from './runMap';
import { freshCampaign, runOf, runThrough } from './testing';
import type { Campaign } from './types';

const won = (fighters: { id: number; hp: number | null }[] = [], xp = 50) => ({ won: true, fighters, xp });

describe('setting out', () => {
  it('opens Deep Forest and Void Ruins first, and one more region for each ruler beaten', () => {
    expect(setOutProblem(freshCampaign(), 'deepForest')).toBeNull();
    expect(setOutProblem(freshCampaign(), 'voidRuins')).toBeNull();
    expect(setOutProblem(freshCampaign(), 'redCanyon')).toMatch(/Locked/);
    expect(setOutProblem(freshCampaign(['hiveMother']), 'redCanyon')).toBeNull();
    expect(setOutProblem(freshCampaign(['hiveMother']), 'ironFortress')).toMatch(/Locked/);
    expect(setOutProblem(runThrough(['battle']), 'deepForest')).toMatch(/run/);
    expect(() => newRun(freshCampaign(), 'glassPlains', 1)).toThrow();
  });

  it('starts with no gold, at no node, with every first-floor node to choose from', () => {
    const run = runOf(newRun(freshCampaign(), 'voidRuins', 77));
    expect(run).toMatchObject({ region: 'voidRuins', gold: RUN_RULES.startingGold, path: [], stop: null, level: 0 });
    expect(nextChoices(run)).toEqual(run.map[0]!.map((_, i) => i));
    expect(runOf(newRun(freshCampaign(['hiveMother', 'strategist']), 'redCanyon', 1)).level).toBe(2);
  });

  it('plays out the same for the same seed and the same choices', () => {
    const play = () => {
      let c = newRun(freshCampaign(), 'deepForest', 1234);
      c = enterNode(c, 0);
      c = finishFight(c, won([{ id: 1, hp: 0.4 }]));
      c = pickSpoils(c, 1);
      c = enterNode(c, nextChoices(runOf(c))[0]!);
      return c;
    };
    expect(play()).toEqual(play());
  });
});

describe('fights', () => {
  it('a fight waits at its node; nothing else can be entered until it is done', () => {
    const c = enterNode(runThrough(['battle', 'battle', 'boss']), 0);
    expect(runOf(c).stop).toMatchObject({ kind: 'fight', encounter: { kind: 'battle', general: 'hiveMother', map: 'deepForest' } });
    expect(() => enterNode(c, 0)).toThrow();
    expect(() => leaveStop(c)).toThrow();
  });

  it('a won fight carries wounds over, gets fallen fighters back up hurt, and pays gold and spoils', () => {
    const c = finishFight(enterNode(runThrough(['battle', 'boss']), 0), won([{ id: 1, hp: 0.4 }, { id: 2, hp: null }, { id: 3, hp: 1 }], 64));
    const run = runOf(c);
    expect(run.roster.find((f) => f.id === 1)!.hp).toBe(0.4);
    expect(run.roster.find((f) => f.id === 2)!.hp).toBe(RUN_RULES.fallenHp);
    expect(run.roster.find((f) => f.id === 6)!.hp).toBe(1);
    expect(run).toMatchObject({ fightsWon: 1, xp: 64 });
    const stop = run.stop!;
    if (stop.kind !== 'spoils') throw new Error('expected spoils');
    expect(stop.gold).toBeGreaterThanOrEqual(RUN_RULES.gold.battle);
    expect(stop.gold).toBeLessThanOrEqual(RUN_RULES.gold.battle + RUN_RULES.gold.spread);
    expect(run.gold).toBe(stop.gold);
    expect(stop.offers).toHaveLength(RUN_RULES.offers);
    expect(stop.artifact).toBeNull();
  });

  it('the spoils: take one offer, or skip it for gold', () => {
    const c = finishFight(enterNode(runThrough(['battle', 'boss']), 0), won());
    const stop = runOf(c).stop as Extract<NonNullable<Campaign['run']>['stop'], { kind: 'spoils' }>;
    const offer = stop.offers[0]!;
    const picked = runOf(pickSpoils(c, 0));
    expect(picked.stop).toBeNull();
    if (offer.kind === 'fighter') expect(picked.roster.at(-1)).toMatchObject({ cls: offer.cls, rarity: offer.rarity, hp: 1 });
    else expect(picked.boons).toEqual([offer.boon]);
    const skipped = runOf(pickSpoils(c, null));
    expect(skipped.gold).toBe(runOf(c).gold + RUN_RULES.skipGold);
    expect(skipped.roster).toHaveLength(8);
    expect(nextChoices(skipped)).toEqual([0]);
  });

  it('an elite fight pays more and brings an artifact, carried until it is banked', () => {
    const c = finishFight(enterNode(runThrough(['elite', 'boss']), 0), won());
    const run = runOf(c);
    expect(run.stop).toMatchObject({ kind: 'spoils' });
    expect(run.gold).toBeGreaterThanOrEqual(RUN_RULES.gold.elite);
    expect(run.artifacts).toHaveLength(1);
    expect(c.artifacts).toEqual([]);
  });

  it('a lost fight ends the run and loses the artifacts you carry; you keep the XP', () => {
    let c = finishFight(enterNode(runThrough(['elite', 'battle', 'boss']), 0), won());
    c = enterNode(pickSpoils(c, null), 0);
    const carried = runOf(c).artifacts;
    c = finishFight(c, { won: false, fighters: [], xp: 20 });
    expect(runOf(c).stop).toMatchObject({ kind: 'end', won: false, lost: carried, banked: [] });
    expect(runOf(c).xp).toBe(70);
    expect(c.artifacts).toEqual([]);
    expect(closeRun(c).run).toBeNull();
  });

  it('beating the ruler wins the run: it banks your artifacts, recruits them, teaches their action, unlocks a class and opens a region', () => {
    let c = finishFight(enterNode(runThrough(['elite', 'boss']), 0), won());
    const carried = runOf(c).artifacts;
    c = enterNode(pickSpoils(c, null), 0);
    expect(runOf(c).stop).toMatchObject({ kind: 'fight', encounter: { kind: 'boss', general: 'hiveMother' } });
    c = finishFight(c, won());
    expect(runOf(c).stop).toMatchObject({ kind: 'end', won: true, banked: carried, lost: [], learned: 'hijack', opened: ['redCanyon'], unlocked: 'assassin', died: [] });
    expect(c.bossesBeaten).toEqual(['hiveMother']);
    expect(recruitedGenerals(c.bossesBeaten)).toContain('hiveMother');
    expect(c.artifacts).toEqual(carried);
    expect(closeRun(c)).toMatchObject({ run: null, bossesBeaten: ['hiveMother'], artifacts: carried });
  });

  it('beating a ruler again brings nothing new', () => {
    const c = finishFight(enterNode(runThrough(['boss'], { bossesBeaten: ['hiveMother'] }), 0), won());
    expect(runOf(c).stop).toMatchObject({ kind: 'end', won: true, learned: null, opened: [], unlocked: null });
    expect(c.bossesBeaten).toEqual(['hiveMother']);
  });

  it('abandoning a run is a loss', () => {
    const c = abandonRun(runThrough(['battle', 'boss']));
    expect(runOf(c).stop).toMatchObject({ kind: 'end', won: false });
    expect(closeRun(c).run).toBeNull();
  });
});

describe('camps', () => {
  it('heal every fighter and bank the artifacts you carry', () => {
    let c = finishFight(enterNode(runThrough(['elite', 'camp', 'boss']), 0), won([{ id: 1, hp: 0.2 }, { id: 2, hp: 0.9 }]));
    const carried = runOf(c).artifacts;
    c = enterNode(pickSpoils(c, null), 0);
    const run = runOf(c);
    expect(run.stop).toEqual({ kind: 'camp', healed: RUN_RULES.campHeal, banked: carried });
    expect(run.roster.find((f) => f.id === 1)!.hp).toBeCloseTo(0.2 + RUN_RULES.campHeal);
    expect(run.roster.find((f) => f.id === 2)!.hp).toBe(1);
    expect(run.artifacts).toEqual([]);
    expect(c.artifacts).toEqual(carried);
    // Banked artifacts stay yours even if the run is lost later.
    c = finishFight(enterNode(leaveStop(c), 0), { won: false, fighters: [], xp: 0 });
    expect(c.artifacts).toEqual(carried);
  });
});

describe('the merchant', () => {
  const atMerchant = (gold: number) => {
    const c = enterNode(runThrough(['merchant', 'boss']), 0);
    return { ...c, run: { ...runOf(c), gold } };
  };

  it('sells fighters and boons priced by rarity; you need the gold, and each sells once', () => {
    const c = atMerchant(1000);
    const stop = runOf(c).stop!;
    if (stop.kind !== 'merchant') throw new Error('expected the merchant');
    expect(stop.stock).toHaveLength(RUN_RULES.merchant.fighters + RUN_RULES.merchant.boons);
    for (const item of stop.stock) expect(item.price).toBe(offerPrice(item.offer));
    const bought = buy(c, 0);
    expect(runOf(bought).gold).toBe(1000 - stop.stock[0]!.price);
    expect(runOf(bought).roster).toHaveLength(9);
    expect(buyProblem(runOf(bought), 0)).toBe('Sold');
    expect(buyProblem(runOf(atMerchant(0)), 0)).toBe('Not enough gold');
    expect(() => buy(atMerchant(0), 0)).toThrow();
  });

  it('heals every fighter fully for gold, once anyone is hurt', () => {
    const c = atMerchant(100);
    expect(healProblem(runOf(c))).toBe('Nobody is hurt');
    const hurt = { ...c, run: { ...runOf(c), roster: runOf(c).roster.map((f) => ({ ...f, hp: 0.3 })) } };
    const healed = runOf(healAtMerchant(hurt));
    expect(healed.roster.every((f) => f.hp === 1)).toBe(true);
    expect(healed.gold).toBe(100 - RUN_RULES.merchant.healPrice);
  });

  it('rerolls the stock, a little dearer each time, and lets you leave', () => {
    const c = atMerchant(100);
    const once = reroll(c);
    expect(runOf(once).gold).toBe(100 - RUN_RULES.merchant.rerollPrice);
    expect(merchantPrices(runOf(once)).reroll).toBe(RUN_RULES.merchant.rerollPrice + RUN_RULES.merchant.rerollStep);
    expect(runOf(leaveStop(once)).stop).toBeNull();
  });
});

describe('events', () => {
  const atEvent = (gold: number) => {
    const c = enterNode(runThrough(['event', 'boss']), 0);
    return { ...c, run: { ...runOf(c), gold, boons: ['whetstones' as const] } };
  };

  it('every choice of every event works, says what happened, and then lets you move on', () => {
    for (const id of EVENT_IDS) {
      EVENTS[id].choices.forEach((choice, i) => {
        const c = atEvent(500);
        const at = { ...c, run: { ...runOf(c), stop: { kind: 'event' as const, event: id, chosen: null, outcome: [] } } };
        expect(eventChoiceProblem(runOf(at), i), `${id} ${choice.label}`).toBeNull();
        const done = chooseEvent(at, i);
        const stop = runOf(done).stop!;
        expect(stop).toMatchObject({ kind: 'event', chosen: i });
        if (stop.kind === 'event') expect(stop.outcome.length, `${id} ${choice.label}`).toBeGreaterThan(0);
        expect(runOf(done).roster.every((f) => f.hp > 0 && f.hp <= 1)).toBe(true);
        expect(() => chooseEvent(done, i)).toThrow();
        expect(runOf(leaveStop(done)).stop).toBeNull();
      });
    }
  });

  it('a choice you can’t pay for, or that needs what you don’t have, can’t be made', () => {
    const c = atEvent(0);
    const at = (event: (typeof EVENT_IDS)[number]) => ({ ...runOf(c), stop: { kind: 'event' as const, event, chosen: null, outcome: [] } });
    expect(eventChoiceProblem(at('sellswords'), 0)).toBe('Needs 60 gold');
    expect(eventChoiceProblem({ ...at('quartermaster'), boons: [] }, 0)).toBe('Needs a boon to give up');
    expect(eventChoiceProblem({ ...at('wanderingTactician'), boons: [] }, 1)).toBe('Needs a boon to give up');
    expect(eventChoiceProblem(at('stormOnThePass'), 0)).toBeNull();
  });

  it('no event takes a bet, so the game has no simulated gambling for age ratings', () => {
    for (const id of EVENT_IDS) expect(JSON.stringify(EVENTS[id]), id).not.toMatch(/\b(bet|bets|gambl\w*|dice|wager\w*|odds|double or nothing)\b/i);
  });

  it('a run meets each event at most once until it has seen them all', () => {
    const start = runThrough(EVENT_IDS.map(() => 'event' as const));
    let c: Campaign = start;
    for (let i = 0; i < EVENT_IDS.length; i++) {
      c = enterNode(c, 0);
      const stop = runOf(c).stop;
      if (stop?.kind !== 'event') throw new Error('expected an event');
      // The last choice of every event asks for nothing.
      c = leaveStop(chooseEvent(c, EVENTS[stop.event].choices.length - 1));
    }
    expect([...runOf(c).eventsSeen].sort()).toEqual([...EVENT_IDS].sort());
  });
});

describe('offers', () => {
  const run = runOf(runThrough(['battle', 'boss']));

  it('roll rarities with the chances in the data', () => {
    const rng = createRng(3);
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
    const n = 20_000;
    for (let i = 0; i < n; i++) counts[rollRarity(rng)] += 1;
    for (const r of RARITIES) expect(counts[r] / n).toBeCloseTo(RARITY_RULES[r].chance / 100, 1);
  });

  it('offer fighters of unlocked classes only, and boons you don’t have yet that help your army', () => {
    const rng = createRng(8);
    const withBoon = { ...run, boons: ['fieldRations' as const] };
    for (let i = 0; i < 300; i++) {
      const offers = rollOffers(rng, withBoon, []);
      const boons = offers.flatMap((o) => (o.kind === 'boon' ? [o.boon] : []));
      expect(new Set(boons).size).toBe(boons.length);
      for (const o of offers) {
        if (o.kind === 'fighter') expect(STARTER_CLASSES).toContain(o.cls);
        else {
          expect(o.boon).not.toBe('fieldRations');
          const helps = boonClasses(o.boon);
          expect(helps === null || helps.some((c) => run.roster.some((f) => f.cls === c))).toBe(true);
        }
      }
    }
    const unlocked = new Set(Array.from({ length: 200 }, () => rollOffers(rng, run, ['hiveMother'])).flat().flatMap((o) => (o.kind === 'fighter' ? [o.cls] : [])));
    expect(unlocked.has('assassin')).toBe(true);
    expect(unlocked.has('invoker')).toBe(false);
  });

  it('turn to fighters when no boon is left for you', () => {
    const everything = { ...run, boons: [...BOON_IDS] };
    expect(rollOffers(createRng(1), everything, []).every((o) => o.kind === 'fighter')).toBe(true);
    expect(rollStock(createRng(1), everything, []).every((s) => s.offer.kind === 'fighter')).toBe(true);
    expect(Object.keys(BOONS)).toEqual([...BOON_IDS]);
  });
});
