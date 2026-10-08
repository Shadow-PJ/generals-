// A run, step by step: set out into a region, take a node, fight, pick the spoils (and after an
// elite fight, perhaps a decree), trade with the merchant, rest at a camp, face an event, and end
// at the ruler. Each step takes the campaign and
// returns the next one; nothing is changed in place, and every roll comes from the run's
// generator, so a run is the same for the same seed and the same choices.

import type { Card } from '../cards/types';
import { boonGold } from '../data/boons';
import { EVENT_IDS, EVENTS } from '../data/events';
import type { GeneralId } from '../data/generals';
import { BOSS_ORDER, learnedActions } from '../data/legendary';
import { rarityChances } from '../data/rarity';
import type { RankNumber } from '../data/ranks';
import { openRegions, REGIONS, type RegionId } from '../data/regions';
import { ENDLESS_RULES } from '../data/endless';
import { RUN_RULES } from '../data/runs';
import { COMPANY_RULES } from '../data/veterans';
import { createRng, nextInt, type RngState } from '../sim';
import { benchWounded, joined, removeFighter } from './army';
import { afterBattle, defaultKeep, fighterFromVeteran, filledCompany, veteranFromFighter } from './company';
import { decreeOffers } from './decrees';
import { nodeEncounter } from './encounters';
import { dealChoice, dealProblem, markCrossroads, rollDeals } from './crossroads';
import { applyChoice, choiceProblem, newArtifact } from './events';
import { campHeal, fallenHp, fearBounty, fearOf, oathGold, oathInsight, oathPrice, spoilsOffers } from './oaths';
import { rollOffers, rollStock, takeOffer } from './offers';
import { pick } from './random';
import { currentNode, generateRunMap, nextChoices } from './runMap';
import type { Campaign, Encounter, RunState, Stop } from './types';

/** How a fight went, for the run: who is left standing, with how much HP, and what they did. */
export interface FightOutcome {
  won: boolean;
  /** Each fighter who took the field: their share of HP left, or null if they fell, and the enemies they killed (none when left out). Reserves never called in are left out. */
  fighters: { id: number; hp: number | null; kills?: number }[];
  /** The Command XP the battle earned, for the run's tally. */
  xp: number;
  /** The Insight it earned, for the Tech Web; none when left out. */
  insight?: number;
}

/** Why you can't set out into a region now, or null if you can. */
export function setOutProblem(campaign: Campaign, region: RegionId): string | null {
  if (campaign.run) return 'Finish or abandon your run first';
  if (!openRegions(campaign.bossesBeaten).includes(region)) return 'Locked: beat another region’s ruler first';
  return null;
}

/**
 * A new run into `region`, with your company: 5 troops on the field and 3 in reserve. Empty places
 * in the company are filled with fresh Recruits first, who join it for good.
 */
export function newRun(campaign: Campaign, region: RegionId, seed: number): Campaign {
  const problem = setOutProblem(campaign, region);
  if (problem) throw new Error(problem);
  const rng = createRng(seed);
  const company = filledCompany(campaign.company, seed);
  let run: RunState = {
    region,
    level: BOSS_ORDER.filter((g) => campaign.bossesBeaten.includes(g)).length,
    seed,
    rng,
    // Crossroads (session 7F) come from the seed alone, leaving the generator's rolls as they were.
    map: markCrossroads(generateRunMap(rng), seed),
    path: [],
    stop: null,
    gold: RUN_RULES.startingGold,
    roster: [],
    nextFighterId: 1,
    field: [],
    reserves: [],
    boons: [],
    artifacts: [],
    eventsSeen: [],
    fightsWon: 0,
    xp: 0,
    insight: 0,
    ironman: campaign.ironman,
    oaths: { ...campaign.oaths },
    decree: null,
    endless: null,
  };
  for (const v of company) run = joined(run, fighterFromVeteran(v, 0));
  return { ...campaign, company, run: { ...run, rng: { ...rng } } };
}

function runOf(campaign: Campaign): RunState {
  if (!campaign.run) throw new Error('No run');
  return campaign.run;
}

/** Runs a step with a copy of the run's generator, and keeps where the generator got to. */
function rolling(run: RunState, step: (rng: RngState) => RunState): RunState {
  const rng = { ...run.rng };
  return { ...step(rng), rng };
}

/** Takes the next node: one of `nextChoices`. What waits there becomes the run's stop. */
export function enterNode(campaign: Campaign, index: number): Campaign {
  const run = runOf(campaign);
  if (run.stop) throw new Error('Finish this node first');
  if (!nextChoices(run).includes(index)) throw new Error(`Node ${index} is not a way on`);
  const floor = run.path.length;
  const kind = run.map[floor]![index]!.kind;
  const moved: RunState = { ...run, path: [...run.path, index] };
  if (kind === 'camp') {
    // Rest heals (less under Lasting Wounds), and what you carry is banked for good.
    const heal = campHeal(moved.oaths);
    const camp: RunState = {
      ...moved,
      roster: moved.roster.map((f) => ({ ...f, hp: Math.min(1, f.hp + heal) })),
      artifacts: [],
      stop: { kind: 'camp', healed: heal, banked: [...moved.artifacts] },
    };
    return { ...campaign, artifacts: banked(campaign, moved), run: camp };
  }
  const next = rolling(moved, (rng): RunState => {
    switch (kind) {
      case 'battle':
      case 'elite':
      case 'boss':
        // The fight was fixed when the map was made, so the map could scout it (session 5F).
        return { ...moved, stop: { kind: 'fight', encounter: nodeEncounter(moved, floor, index)! } };
      case 'event': {
        const fresh = EVENT_IDS.filter((id) => !moved.eventsSeen.includes(id));
        const event = pick(rng, fresh.length > 0 ? fresh : EVENT_IDS);
        return { ...moved, eventsSeen: [...moved.eventsSeen, event], stop: { kind: 'event', event, chosen: null, outcome: [] } };
      }
      case 'merchant':
        return { ...moved, stop: { kind: 'merchant', stock: rollStock(rng, moved, campaign.bossesBeaten, rarityChances(floor)), rerolls: 0 } };
    }
  });
  return { ...campaign, run: next };
}

/** Your banked artifacts, with the ones the run carries added. */
function banked(campaign: Campaign, run: RunState) {
  return [...campaign.artifacts, ...run.artifacts.filter((a) => !campaign.artifacts.includes(a))];
}

/** The fight waiting at your node, if there is one. */
export function currentFight(campaign: Campaign) {
  const stop = campaign.run?.stop;
  return stop?.kind === 'fight' ? stop.encounter : null;
}

/** After a fight: wounds carry over and the spoils wait; a lost fight, or a won boss fight, ends the run. */
export function finishFight(campaign: Campaign, outcome: FightOutcome): Campaign {
  const run = runOf(campaign);
  if (run.stop?.kind !== 'fight') throw new Error('No fight to finish');
  const encounter = run.stop.encounter;
  // Fear makes every battle earn more Insight (session 5F).
  const insight = oathInsight(Math.max(0, outcome.insight ?? 0), run.oaths);
  const earned: Campaign = { ...campaign, insight: campaign.insight + insight };
  // Every fighter who fought adds the battle to their record, and may rank up.
  const recorded = rolling(run, (rng) => {
    const fought = new Map(outcome.fighters.map((f) => [f.id, f.kills ?? 0]));
    const roster = run.roster.map((f) => (fought.has(f.id) ? afterBattle(rng, f, fought.get(f.id)!, encounter.kind === 'boss') : f));
    return { ...run, roster, xp: run.xp + Math.max(0, outcome.xp), insight: run.insight + insight };
  });
  const fell = new Set(outcome.fighters.filter((f) => f.hp === null || f.hp <= 0).map((f) => f.id));
  // An endless run (session 7G) ends at its first lost fight, as the win it already was.
  if (!outcome.won) return endRun(earned, recorded, run.endless !== null, fell);

  const hp = new Map(outcome.fighters.map((f) => [f.id, f.hp]));
  // A fighter who fell gets back up hurt and sits the next fight out (in Ironman, it dies); the
  // others keep the HP they ended with, and last fight's wounded are fit again.
  let healed: RunState = {
    ...recorded,
    fightsWon: run.fightsWon + 1,
    endless: run.endless && { ...run.endless, score: run.endless.score + endlessPoints(encounter.kind) },
    roster: recorded.roster.map((f) => {
      if (!hp.has(f.id)) return { ...f, wounded: false };
      const left = hp.get(f.id)!;
      return fell.has(f.id) ? { ...f, hp: fallenHp(run.oaths), wounded: true } : { ...f, hp: Math.min(1, left!), wounded: false };
    }),
  };
  if (run.ironman) for (const id of fell) healed = removeFighter(healed, id);
  healed = benchWounded(healed);
  if (encounter.kind === 'boss') {
    // Once every ruler has fallen, a ruler beaten offers to march on past it (session 7G).
    if (endlessOpen(campaign, run)) return { ...earned, run: { ...healed, stop: { kind: 'endless', lap: run.endless?.lap ?? 0 } } };
    return endRun(earned, healed, true);
  }

  const floor = run.path.length - 1;
  const next = rolling(healed, (rng) => {
    const rules = RUN_RULES.gold;
    // Plunder (a boon) adds to every won fight's gold; Lean Purse (an oath) takes some away.
    const gold = oathGold(
      (encounter.kind === 'elite' ? rules.elite : rules.battle) + rules.perFloor * floor + nextInt(rng, rules.spread + 1) + boonGold(healed.boons),
      healed.oaths,
    );
    const artifact = encounter.kind === 'elite' ? newArtifact(rng, healed, campaign.artifacts) : null;
    // Deeper in the run, and after an elite fight, the offers are rarer.
    const offers = rollOffers(rng, healed, campaign.bossesBeaten, rarityChances(floor, encounter.kind === 'elite'), spoilsOffers(healed.oaths));
    // A beaten elite commander's orders are offered next, as a decree (session 7D).
    const commander = encounter.kind === 'elite' && encounter.commander !== null ? { general: encounter.general, rank: encounter.commander } : null;
    const paid: RunState = { ...healed, gold: healed.gold + gold, artifacts: artifact ? [...healed.artifacts, artifact] : healed.artifacts };
    // A won crossroads offers two deals instead of the pick (session 7F).
    const deals = currentNode(run)?.node.crossroads ? rollDeals(rng, paid) : null;
    if (deals) return { ...paid, stop: { kind: 'crossroads', gold, deals, chosen: null, outcome: [] } };
    return { ...paid, stop: { kind: 'spoils', gold, artifact, offers, commander } };
  });
  return { ...earned, run: next };
}

/**
 * Takes one of the spoils' offers, or skips them for a little gold (index null). After an elite
 * fight, the beaten commander's orders wait next.
 */
export function pickSpoils(campaign: Campaign, index: number | null): Campaign {
  const run = runOf(campaign);
  if (run.stop?.kind !== 'spoils') throw new Error('No spoils to pick');
  const commander = run.stop.commander;
  const next: Stop | null = commander ? { kind: 'decree', commander } : null;
  if (index === null) return { ...campaign, run: { ...run, gold: run.gold + oathGold(RUN_RULES.skipGold, run.oaths), stop: next } };
  const offer = run.stop.offers[index];
  if (!offer) throw new Error(`No offer ${index}`);
  return { ...campaign, run: { ...takeOffer(run, offer), stop: next } };
}

/** The cards the beaten commander at your stop offers as a decree, at your rank. */
export function decreeChoices(run: RunState, yourRank: RankNumber): Card[] {
  if (run.stop?.kind !== 'decree') throw new Error('No decree to take');
  const { general, rank } = run.stop.commander;
  return decreeOffers(general, rank, yourRank);
}

/** Takes one of the beaten commander's cards as the run's decree, in place of any before; or keeps yours (index null). */
export function takeDecree(campaign: Campaign, index: number | null, yourRank: RankNumber): Campaign {
  const run = runOf(campaign);
  const choices = decreeChoices(run, yourRank);
  if (index === null) return { ...campaign, run: { ...run, stop: null } };
  const card = choices[index];
  if (!card) throw new Error(`No decree ${index}`);
  return { ...campaign, run: { ...run, decree: structuredClone(card), stop: null } };
}

function merchantStop(run: RunState): Extract<Stop, { kind: 'merchant' }> {
  if (run.stop?.kind !== 'merchant') throw new Error('No merchant here');
  return run.stop;
}

/** What healing and a new stock cost at the merchant now. */
export function merchantPrices(run: RunState): { heal: number; reroll: number } {
  const rules = RUN_RULES.merchant;
  const rerolls = run.stop?.kind === 'merchant' ? run.stop.rerolls : 0;
  return { heal: oathPrice(rules.healPrice, run.oaths), reroll: oathPrice(rules.rerollPrice + rerolls * rules.rerollStep, run.oaths) };
}

/** Why you can't buy this item now, or null if you can. */
export function buyProblem(run: RunState, index: number): string | null {
  const item = merchantStop(run).stock[index];
  if (!item) return 'Nothing there';
  if (item.sold) return 'Sold';
  if (item.price > run.gold) return 'Not enough gold';
  return null;
}

export function buy(campaign: Campaign, index: number): Campaign {
  const run = runOf(campaign);
  const problem = buyProblem(run, index);
  if (problem) throw new Error(problem);
  const stop = merchantStop(run);
  const item = stop.stock[index]!;
  const bought = takeOffer(run, item.offer);
  return {
    ...campaign,
    run: { ...bought, gold: run.gold - item.price, stop: { ...stop, stock: stop.stock.map((s, i) => (i === index ? { ...s, sold: true } : s)) } },
  };
}

/** Why the merchant can't heal you now, or null if they can. */
export function healProblem(run: RunState): string | null {
  merchantStop(run);
  if (run.roster.every((f) => f.hp >= 1)) return 'Nobody is hurt';
  if (merchantPrices(run).heal > run.gold) return 'Not enough gold';
  return null;
}

/** Pays the merchant to heal every fighter fully. */
export function healAtMerchant(campaign: Campaign): Campaign {
  const run = runOf(campaign);
  const problem = healProblem(run);
  if (problem) throw new Error(problem);
  return { ...campaign, run: { ...run, gold: run.gold - merchantPrices(run).heal, roster: run.roster.map((f) => ({ ...f, hp: 1 })) } };
}

export function rerollProblem(run: RunState): string | null {
  merchantStop(run);
  return merchantPrices(run).reroll > run.gold ? 'Not enough gold' : null;
}

/** Pays for a whole new stock; each reroll costs more than the last. */
export function reroll(campaign: Campaign): Campaign {
  const run = runOf(campaign);
  const problem = rerollProblem(run);
  if (problem) throw new Error(problem);
  const stop = merchantStop(run);
  const paid: RunState = { ...run, gold: run.gold - merchantPrices(run).reroll };
  const stock = (rng: RngState) => rollStock(rng, paid, campaign.bossesBeaten, rarityChances(paid.path.length - 1));
  const next = rolling(paid, (rng) => ({ ...paid, stop: { ...stop, stock: stock(rng), rerolls: stop.rerolls + 1 } }));
  return { ...campaign, run: next };
}

/** Why you can't make this event choice now, or null if you can. */
export function eventChoiceProblem(run: RunState, index: number): string | null {
  if (run.stop?.kind !== 'event' || run.stop.chosen !== null) return 'No choice to make';
  const choice = EVENTS[run.stop.event].choices[index];
  return choice ? choiceProblem(run, choice) : 'No such choice';
}

/** Makes an event choice; the event then shows what happened until you leave. */
export function chooseEvent(campaign: Campaign, index: number): Campaign {
  const run = runOf(campaign);
  const problem = eventChoiceProblem(run, index);
  if (problem) throw new Error(problem);
  const stop = run.stop as Extract<Stop, { kind: 'event' }>;
  const choice = EVENTS[stop.event].choices[index]!;
  const next = rolling(run, (rng) => {
    const done = applyChoice(rng, run, choice, campaign.artifacts, campaign.bossesBeaten);
    return { ...done.run, stop: { ...stop, chosen: index, outcome: done.outcome } };
  });
  return { ...campaign, run: next };
}

/** Why you can't take this crossroads deal now, or null if you can. */
export function dealTakeProblem(run: RunState, index: number): string | null {
  if (run.stop?.kind !== 'crossroads' || run.stop.chosen !== null) return 'No deal to take';
  const deal = run.stop.deals[index];
  return deal ? dealProblem(run, deal) : 'No such deal';
}

/** Takes one of a crossroads' two deals (session 7F); the stop then shows what happened until you leave. */
export function takeDeal(campaign: Campaign, index: number): Campaign {
  const run = runOf(campaign);
  const problem = dealTakeProblem(run, index);
  if (problem) throw new Error(problem);
  const stop = run.stop as Extract<Stop, { kind: 'crossroads' }>;
  const next = rolling(run, (rng) => {
    const done = applyChoice(rng, run, dealChoice(stop.deals[index]!), campaign.artifacts, campaign.bossesBeaten);
    return { ...done.run, stop: { ...stop, chosen: index, outcome: done.outcome } };
  });
  return { ...campaign, run: next };
}

/** Moves on from a merchant, a camp, a finished event or a taken crossroads deal, back to the map. */
export function leaveStop(campaign: Campaign): Campaign {
  const run = runOf(campaign);
  const stop = run.stop;
  const done =
    stop?.kind === 'merchant' ||
    stop?.kind === 'camp' ||
    ((stop?.kind === 'event' || stop?.kind === 'crossroads') && stop.chosen !== null);
  if (!done) throw new Error('You can’t leave yet');
  return { ...campaign, run: { ...run, stop: null } };
}

/** Gives up the run: like a lost fight, the artifacts you carry are lost. */
export function abandonRun(campaign: Campaign): Campaign {
  const run = runOf(campaign);
  if (run.stop?.kind === 'end') return campaign;
  // Past the ruler, the run is won already: giving up goes home with the win (session 7G).
  return endRun(campaign, run, run.endless !== null || run.stop?.kind === 'endless');
}

/** Every ruler has fallen, counting this run's: beating a ruler now offers to march on (session 7G). */
export function endlessOpen(campaign: Campaign, run: RunState): boolean {
  return endlessFrom(campaign.bossesBeaten, run.region);
}

/** Beating this region's ruler would leave no ruler standing, so it offers the road on. */
export function endlessFrom(bossesBeaten: readonly GeneralId[], region: RegionId): boolean {
  const ruler = REGIONS[region].ruler;
  return BOSS_ORDER.every((g) => g === ruler || bossesBeaten.includes(g));
}

/** What a fight won past the ruler adds to an endless run's score: more for beating the ruler again. */
function endlessPoints(kind: Encounter['kind']): number {
  return ENDLESS_RULES.score.fight + (kind === 'boss' ? ENDLESS_RULES.score.ruler : 0);
}

/** The seed of an endless lap's map: its own, so each lap is a fresh road. */
function lapSeed(seed: number, lap: number): number {
  return (seed ^ (lap * 0x2545f491)) | 0;
}

/**
 * Marches on past the ruler (session 7G): a fresh map of the region, a lap further, its armies
 * stronger. Your army, gold, boons, artifacts and decree march with you.
 */
export function marchOn(campaign: Campaign): Campaign {
  const run = runOf(campaign);
  if (run.stop?.kind !== 'endless') throw new Error('No road on');
  const lap = run.stop.lap + 1;
  const next = rolling(run, (rng) => ({
    ...run,
    map: markCrossroads(generateRunMap(rng), lapSeed(run.seed, lap)),
    path: [],
    stop: null,
    endless: { lap, score: run.endless?.score ?? 0 },
  }));
  return { ...campaign, run: next };
}

/** Goes home from past the ruler: the run ends as the win it is (session 7G). */
export function goHome(campaign: Campaign): Campaign {
  const run = runOf(campaign);
  if (run.stop?.kind !== 'endless') throw new Error('No road on');
  return endRun(campaign, run, true);
}

/** After a won run: a fighter stays in your company, or doesn't. At most 8 stay. */
export function toggleKeep(campaign: Campaign, fighterId: number): Campaign {
  const run = runOf(campaign);
  const stop = run.stop;
  if (stop?.kind !== 'end' || !stop.won) throw new Error('Only a won run lets fighters stay');
  if (!run.roster.some((f) => f.id === fighterId) || stop.died.includes(fighterId)) return campaign;
  const keep = stop.keep.includes(fighterId) ? stop.keep.filter((id) => id !== fighterId) : [...stop.keep, fighterId];
  if (keep.length > COMPANY_RULES.size) return campaign;
  return { ...campaign, run: { ...run, stop: { ...stop, keep } } };
}

/**
 * Back to the Capital once the run is over. After a win, your company is the fighters you kept;
 * after a loss, your company comes home without the run's newcomers. Either way they come home
 * healed, with their records, and a troop that is gone (it left, or died in Ironman) is gone for
 * good; any artifact it carried goes back to your bank.
 */
export function closeRun(campaign: Campaign): Campaign {
  const stop = campaign.run?.stop;
  if (stop?.kind !== 'end') throw new Error('The run isn’t over');
  const run = campaign.run!;
  const usedIds = new Set(campaign.company.map((v) => v.id));
  let nextId = Math.max(0, ...usedIds) + 1;
  const home = stop.won
    ? stop.keep.flatMap((id) => run.roster.filter((f) => f.id === id))
    : run.roster.filter((f) => f.veteranId !== null && !stop.died.includes(f.id) && campaign.company.some((v) => v.id === f.veteranId));
  const company = home.map((f) => veteranFromFighter(f, f.veteranId ?? nextId++));
  return { ...campaign, company, run: null };
}

/**
 * The end of a run. A win banks what you carry and beats the ruler: that opens the next region,
 * may unlock a class, and teaches the ruler's Legendary action. A loss loses what you carry, and
 * in Ironman the fighters who fell in the last fight die. An endless run (session 7G) always ends
 * as a win, even at a lost fight (where in Ironman the fallen still die), and keeps its score.
 */
function endRun(campaign: Campaign, run: RunState, won: boolean, fell: ReadonlySet<number> = new Set()): Campaign {
  const fear = fearOf(run.oaths);
  const died = run.ironman ? run.roster.filter((f) => fell.has(f.id)).map((f) => f.id) : [];
  if (!won) {
    const stop: Stop = { kind: 'end', won, banked: [], lost: [...run.artifacts], learned: null, opened: [], unlocked: null, keep: [], died, fear, bounty: 0, endless: null };
    return { ...campaign, run: { ...run, artifacts: [], stop } };
  }
  // An endless run's score, and your best (session 7G).
  const score = run.endless?.score ?? null;
  // Winning above the region's highest Fear yet pays a bounty of Insight (session 5F).
  const { bounty, record } = fearBounty(campaign.fearRecords, run.region, fear);
  const region = REGIONS[run.region];
  const firstWin = !campaign.bossesBeaten.includes(region.ruler);
  const bossesBeaten = firstWin ? BOSS_ORDER.filter((g) => g === region.ruler || campaign.bossesBeaten.includes(g)) : campaign.bossesBeaten;
  const before = openRegions(campaign.bossesBeaten);
  const knew = learnedActions(campaign.bossesBeaten);
  const stop: Stop = {
    kind: 'end',
    won,
    banked: [...run.artifacts],
    lost: [],
    learned: learnedActions(bossesBeaten).find((a) => !knew.includes(a)) ?? null,
    opened: openRegions(bossesBeaten).filter((r) => !before.includes(r)),
    unlocked: firstWin ? region.unlocksClass : null,
    // An endless run that fell in Ironman: the fallen die, and can't stay.
    keep: defaultKeep(run.roster.filter((f) => !died.includes(f.id))),
    died,
    fear,
    bounty,
    endless: score === null ? null : { score, best: score > campaign.endlessBest },
  };
  return {
    ...campaign,
    bossesBeaten,
    endlessBest: Math.max(campaign.endlessBest, score ?? 0),
    artifacts: banked(campaign, run),
    insight: campaign.insight + bounty,
    fearRecords: { ...campaign.fearRecords, [run.region]: record },
    run: { ...run, artifacts: [], insight: run.insight + bounty, stop },
  };
}

/** Where you are: about to set out, at a node, or done with it and choosing the next. */
export function runPosition(run: RunState) {
  return { node: currentNode(run), choices: run.stop ? [] : nextChoices(run) };
}
