// A run, step by step: set out into a region, take a node, fight, pick the spoils, trade with the
// merchant, rest at a camp, face an event, and end at the ruler. Each step takes the campaign and
// returns the next one; nothing is changed in place, and every roll comes from the run's
// generator, so a run is the same for the same seed and the same choices.

import { STARTER_ARMY, STARTER_RESERVES } from '../data/armies';
import { EVENT_IDS, EVENTS } from '../data/events';
import { BOSS_ORDER, learnedActions } from '../data/legendary';
import { openRegions, REGIONS, type RegionId } from '../data/regions';
import { RUN_RULES } from '../data/runs';
import { createRng, nextInt, type RngState } from '../sim';
import { addFighter } from './army';
import { makeEncounter } from './encounters';
import { applyChoice, choiceProblem, newArtifact } from './events';
import { rollOffers, rollStock, takeOffer } from './offers';
import { pick } from './random';
import { currentNode, generateRunMap, nextChoices } from './runMap';
import type { Campaign, RunState, Stop } from './types';

/** How a fight went, for the run: who is left standing, and with how much HP. */
export interface FightOutcome {
  won: boolean;
  /** Each fighter who took the field: their share of HP left, or null if they fell. Reserves never called in are left out. */
  fighters: { id: number; hp: number | null }[];
  /** The Command XP the battle earned, for the run's tally. */
  xp: number;
}

/** Why you can't set out into a region now, or null if you can. */
export function setOutProblem(campaign: Campaign, region: RegionId): string | null {
  if (campaign.run) return 'Finish or abandon your run first';
  if (!openRegions(campaign.bossesBeaten).includes(region)) return 'Locked: beat another region’s ruler first';
  return null;
}

/** A new run into `region`, with the starter squad: 5 troops on the field and 3 in reserve. */
export function newRun(campaign: Campaign, region: RegionId, seed: number): Campaign {
  const problem = setOutProblem(campaign, region);
  if (problem) throw new Error(problem);
  const rng = createRng(seed);
  let run: RunState = {
    region,
    level: BOSS_ORDER.filter((g) => campaign.bossesBeaten.includes(g)).length,
    seed,
    rng,
    map: generateRunMap(rng),
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
  };
  for (const t of [...STARTER_ARMY, ...STARTER_RESERVES.map((cls) => ({ cls }))]) run = addFighter(run, t.cls, 'common');
  // The starter troops stand where the starter army does.
  run = { ...run, roster: run.roster.map((f, i) => (STARTER_ARMY[i] ? { ...f, spot: { x: STARTER_ARMY[i].x, y: STARTER_ARMY[i].y } } : f)) };
  return { ...campaign, run: { ...run, rng: { ...rng } } };
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
    // Rest heals, and what you carry is banked for good.
    const camp: RunState = {
      ...moved,
      roster: moved.roster.map((f) => ({ ...f, hp: Math.min(1, f.hp + RUN_RULES.campHeal) })),
      artifacts: [],
      stop: { kind: 'camp', healed: RUN_RULES.campHeal, banked: [...moved.artifacts] },
    };
    return { ...campaign, artifacts: banked(campaign, moved), run: camp };
  }
  const next = rolling(moved, (rng): RunState => {
    switch (kind) {
      case 'battle':
      case 'elite':
      case 'boss':
        return { ...moved, stop: { kind: 'fight', encounter: makeEncounter(rng, moved, kind, floor) } };
      case 'event': {
        const fresh = EVENT_IDS.filter((id) => !moved.eventsSeen.includes(id));
        const event = pick(rng, fresh.length > 0 ? fresh : EVENT_IDS);
        return { ...moved, eventsSeen: [...moved.eventsSeen, event], stop: { kind: 'event', event, chosen: null, outcome: [] } };
      }
      case 'merchant':
        return { ...moved, stop: { kind: 'merchant', stock: rollStock(rng, moved, campaign.bossesBeaten), rerolls: 0 } };
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
  const tallied: RunState = { ...run, xp: run.xp + Math.max(0, outcome.xp) };
  if (!outcome.won) return endRun(campaign, tallied, false);

  const hp = new Map(outcome.fighters.map((f) => [f.id, f.hp]));
  const healed: RunState = {
    ...tallied,
    fightsWon: run.fightsWon + 1,
    // A fighter who fell gets back up, hurt; the others keep the HP they ended with.
    roster: run.roster.map((f) => {
      if (!hp.has(f.id)) return f;
      const left = hp.get(f.id)!;
      return { ...f, hp: left === null || left <= 0 ? RUN_RULES.fallenHp : Math.min(1, left) };
    }),
  };
  if (encounter.kind === 'boss') return endRun(campaign, healed, true);

  const floor = run.path.length - 1;
  const next = rolling(healed, (rng) => {
    const rules = RUN_RULES.gold;
    const gold = (encounter.kind === 'elite' ? rules.elite : rules.battle) + rules.perFloor * floor + nextInt(rng, rules.spread + 1);
    const artifact = encounter.kind === 'elite' ? newArtifact(rng, healed, campaign.artifacts) : null;
    const offers = rollOffers(rng, healed, campaign.bossesBeaten);
    return {
      ...healed,
      gold: healed.gold + gold,
      artifacts: artifact ? [...healed.artifacts, artifact] : healed.artifacts,
      stop: { kind: 'spoils', gold, artifact, offers },
    };
  });
  return { ...campaign, run: next };
}

/** Takes one of the spoils' offers, or skips them for a little gold (index null). */
export function pickSpoils(campaign: Campaign, index: number | null): Campaign {
  const run = runOf(campaign);
  if (run.stop?.kind !== 'spoils') throw new Error('No spoils to pick');
  if (index === null) return { ...campaign, run: { ...run, gold: run.gold + RUN_RULES.skipGold, stop: null } };
  const offer = run.stop.offers[index];
  if (!offer) throw new Error(`No offer ${index}`);
  return { ...campaign, run: { ...takeOffer(run, offer), stop: null } };
}

function merchantStop(run: RunState): Extract<Stop, { kind: 'merchant' }> {
  if (run.stop?.kind !== 'merchant') throw new Error('No merchant here');
  return run.stop;
}

/** What healing and a new stock cost at the merchant now. */
export function merchantPrices(run: RunState): { heal: number; reroll: number } {
  const rules = RUN_RULES.merchant;
  const rerolls = run.stop?.kind === 'merchant' ? run.stop.rerolls : 0;
  return { heal: rules.healPrice, reroll: rules.rerollPrice + rerolls * rules.rerollStep };
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
  const next = rolling(paid, (rng) => ({ ...paid, stop: { ...stop, stock: rollStock(rng, paid, campaign.bossesBeaten), rerolls: stop.rerolls + 1 } }));
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

/** Moves on from a merchant, a camp or a finished event, back to the map. */
export function leaveStop(campaign: Campaign): Campaign {
  const run = runOf(campaign);
  const stop = run.stop;
  const done = stop?.kind === 'merchant' || stop?.kind === 'camp' || (stop?.kind === 'event' && stop.chosen !== null);
  if (!done) throw new Error('You can’t leave yet');
  return { ...campaign, run: { ...run, stop: null } };
}

/** Gives up the run: like a lost fight, the artifacts you carry are lost. */
export function abandonRun(campaign: Campaign): Campaign {
  const run = runOf(campaign);
  if (run.stop?.kind === 'end') return campaign;
  return endRun(campaign, run, false);
}

/** Back to the Capital once the run is over. */
export function closeRun(campaign: Campaign): Campaign {
  if (campaign.run?.stop?.kind !== 'end') throw new Error('The run isn’t over');
  return { ...campaign, run: null };
}

/**
 * The end of a run. A win banks what you carry and beats the ruler: that opens the next region,
 * may unlock a class, and teaches the ruler's Legendary action. A loss loses what you carry.
 */
function endRun(campaign: Campaign, run: RunState, won: boolean): Campaign {
  if (!won) {
    const stop: Stop = { kind: 'end', won, banked: [], lost: [...run.artifacts], learned: null, opened: [], unlocked: null };
    return { ...campaign, run: { ...run, artifacts: [], stop } };
  }
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
  };
  return { bossesBeaten, artifacts: banked(campaign, run), run: { ...run, artifacts: [], stop } };
}

/** Where you are: about to set out, at a node, or done with it and choosing the next. */
export function runPosition(run: RunState) {
  return { node: currentNode(run), choices: run.stop ? [] : nextChoices(run) };
}
