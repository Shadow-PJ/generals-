// The Battle IQ report (session 5E): after every battle, your biggest mistake, your best decision,
// a missed opportunity and an enemy weakness, read from the battle's event log, and a grade.
// In a campaign battle the grade earns Command XP. Pure functions.

import { ACTION_NAMES } from '../cards/describe';
import type { Card } from '../cards/types';
import { BATTLE_IQ, CLASS_WEAKNESS } from '../data/battleIq';
import { COMMAND_RULES } from '../data/command';
import { SIGNATURE_COMBOS } from '../data/combos';
import { GENERALS } from '../data/generals';
import { rankRules } from '../data/ranks';
import { TROOP_NAMES } from '../data/units';
import { formatBattleTime, secondsToTicks, ticksToSeconds, type BattleEvent, type BattleState } from '../sim';
import { battleFacts } from './battleFacts';

export type Grade = 'A' | 'B' | 'C' | 'D';

export interface BattleIq {
  grade: Grade;
  /** 0 to 100. */
  score: number;
  /** The Command XP the grade earns in a campaign battle. */
  xp: number;
  mistake: string;
  best: string;
  missed: string;
  weakness: string;
}

/** A battle time as m:ss. */
const at = (tick: number) => formatBattleTime(tick).slice(0, -3);
const seconds = (ticks: number) => Math.round(ticksToSeconds(ticks) * 10) / 10;

type Candidate = { text: string; weight: number };

function heaviest(candidates: Candidate[], none: string): string {
  return candidates.reduce<Candidate | null>((best, c) => (best && best.weight >= c.weight ? best : c), null)?.text ?? none;
}

/** Your events of one type, in order. */
function mine<T extends BattleEvent['type']>(state: BattleState, type: T): Extract<BattleEvent, { type: T }>[] {
  return state.events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type && 'side' in e && e.side === 'player');
}

function endTick(state: BattleState): number {
  return state.result?.durationTicks ?? state.tick;
}

/** The longest your ultimate sat ready, and whether you ever fired it after. */
function idleUltimate(state: BattleState): { ticks: number; from: number; fired: boolean } {
  const fired = mine(state, 'ultimate').map((e) => e.tick);
  let worst = { ticks: 0, from: 0, fired: true };
  for (const ready of mine(state, 'ultimateReady')) {
    const next = fired.find((t) => t >= ready.tick);
    const ticks = (next ?? endTick(state)) - ready.tick;
    if (ticks > worst.ticks) worst = { ticks, from: ready.tick, fired: next !== undefined };
  }
  return worst;
}

/** The longest your pips sat full before a card spent them. */
function fullPips(state: BattleState): number {
  const spent = mine(state, 'cardFired').filter((e) => e.cost > 0).map((e) => e.tick);
  let worst = 0;
  for (const full of mine(state, 'pipsFull')) {
    const next = spent.find((t) => t >= full.tick);
    worst = Math.max(worst, (next ?? endTick(state)) - full.tick);
  }
  return worst;
}

/** Your troops that fell before the early-loss limit. */
function earlyLosses(state: BattleState) {
  const limit = secondsToTicks(BATTLE_IQ.earlyLossSeconds);
  return state.events.flatMap((e) => {
    if (e.type !== 'death' || e.tick > limit) return [];
    const unit = state.units.find((u) => u.id === e.unitId);
    return unit?.side === 'player' ? [{ tick: e.tick, cls: unit.cls }] : [];
  });
}

/** Enemy deaths within a few seconds after `tick`. */
function killsAfter(state: BattleState, tick: number): number {
  const until = tick + secondsToTicks(4);
  return state.events.filter((e) => e.type === 'death' && e.tick >= tick && e.tick <= until && state.units.find((u) => u.id === e.unitId)?.side === 'enemy').length;
}

function cardIn(state: BattleState, slot: number): Card | null {
  return state.command.slots[slot]?.card ?? null;
}

function biggestMistake(state: BattleState): Candidate[] {
  const out: Candidate[] = [];
  const idle = idleUltimate(state);
  if (idle.ticks >= secondsToTicks(BATTLE_IQ.idleUltimateSeconds)) {
    out.push({
      text: idle.fired
        ? `Your ultimate was ready for ${seconds(idle.ticks)} s before you used it (from ${at(idle.from)}). Press U as soon as it lights up.`
        : `Your ultimate was ready from ${at(idle.from)} and you never used it. Press U as soon as it lights up.`,
      weight: ticksToSeconds(idle.ticks),
    });
  }
  const full = fullPips(state);
  if (full >= secondsToTicks(BATTLE_IQ.fullPipsSeconds)) {
    const empty = state.command.slots.every((s) => s.card === null);
    out.push({
      text: empty
        ? `Your pips sat full for ${seconds(full)} s with no cards to spend them on. Write orders into your slots before the battle.`
        : `Your pips sat full for ${seconds(full)} s, wasting every refill. Fire a card sooner.`,
      weight: ticksToSeconds(full) * 0.5,
    });
  }
  const early = earlyLosses(state);
  if (early.length > 0) {
    const first = early[0]!;
    out.push({
      text: `Your ${TROOP_NAMES[first.cls].one} fell only ${Math.round(ticksToSeconds(first.tick))} s in${early.length > 1 ? `, and ${early.length - 1} more soon after` : ''}. Keep fragile troops behind your front line.`,
      weight: BATTLE_IQ.score.earlyLoss * early.length,
    });
  }
  return out;
}

function bestDecision(state: BattleState): Candidate[] {
  const out: Candidate[] = [];
  const finisher = mine(state, 'ultimate').find((e) => e.finisher);
  if (finisher) out.push({ text: `Your Finisher at ${at(finisher.tick)}: the ultimate at the end of a chain hit 50% harder.`, weight: 100 });
  for (const combo of mine(state, 'combo')) {
    const data = SIGNATURE_COMBOS.find((c) => c.id === combo.combo)!;
    out.push({ text: `${data.name} at ${at(combo.tick)}: ${data.stepsText}. ${data.bonusText}.`, weight: 80 });
  }
  for (const ult of mine(state, 'ultimate')) {
    const kills = killsAfter(state, ult.tick);
    if (kills >= 2) out.push({ text: `Your ultimate at ${at(ult.tick)} was followed by ${kills} kills within 4 s.`, weight: 20 * kills });
  }
  const perfects = mine(state, 'cardFired').filter((e) => e.perfect);
  if (perfects.length > 0) {
    out.push({ text: `${perfects.length} Perfect timing${perfects.length === 1 ? '' : 's'}: you fired right as your cards glowed.`, weight: 15 * perfects.length });
  }
  for (const fired of mine(state, 'cardFired')) {
    const kills = killsAfter(state, fired.tick);
    if (kills > 0) out.push({ text: `The card in slot ${fired.slot + 1} at ${at(fired.tick)} led to ${kills} kill${kills === 1 ? '' : 's'} within 4 s.`, weight: 10 * kills });
  }
  return out;
}

function missedOpportunity(state: BattleState): Candidate[] {
  const out: Candidate[] = [];
  const chains = rankRules(state.command.rank).chains;
  const window = secondsToTicks(COMMAND_RULES.chain.windowSeconds);
  const near = secondsToTicks(BATTLE_IQ.nearChainSeconds);
  const fired = mine(state, 'cardFired');
  const plain = SIGNATURE_COMBOS.filter((c) => !c.sameActors && !c.actorClass && !c.firstPlace);
  for (let i = 1; i < fired.length && chains; i++) {
    const a = fired[i - 1]!;
    const b = fired[i]!;
    const gap = b.tick - a.tick;
    if (gap > near) continue;
    // Fired the other way round, the two cards would have made a signature combo.
    const first = cardIn(state, b.slot)?.steps.at(-1)?.action;
    const then = cardIn(state, a.slot)?.steps[0]?.action;
    const reversed = plain.find((c) => c.first === first && c.then === then);
    if (reversed) {
      out.push({
        text: `${ACTION_NAMES[reversed.first]} then ${ACTION_NAMES[reversed.then]} would have made a ${reversed.name}: you fired them the other way round at ${at(a.tick)}.`,
        weight: 30,
      });
    } else if (gap > window) {
      out.push({
        text: `Your cards at ${at(a.tick)} and ${at(b.tick)} were ${seconds(gap)} s apart: within ${COMMAND_RULES.chain.windowSeconds} s they would have chained (a pip cheaper, double Momentum).`,
        weight: 10,
      });
    }
  }
  const idle = idleUltimate(state);
  if (!idle.fired && idle.ticks > 0) out.push({ text: `Your ultimate was ready at the end and never fired: that was free power left unused.`, weight: 5 });
  if (fired.length === 0) out.push({ text: `You fired no cards: every pip you earned went unused.`, weight: 4 });
  return out;
}

function enemyWeakness(state: BattleState): string {
  const enemies = state.units.filter((u) => u.side === 'enemy');
  const deathTick = new Map(state.events.flatMap((e) => (e.type === 'death' ? [[e.unitId, e.tick] as const] : [])));
  let best: { cls: (typeof enemies)[number]['cls']; share: number; avg: number; dead: number; count: number } | null = null;
  for (const cls of [...new Set(enemies.map((u) => u.cls))]) {
    const ofClass = enemies.filter((u) => u.cls === cls);
    const dead = ofClass.filter((u) => deathTick.has(u.id));
    if (dead.length === 0) continue;
    const share = dead.length / ofClass.length;
    const avg = dead.reduce((sum, u) => sum + deathTick.get(u.id)!, 0) / dead.length;
    if (!best || share > best.share || (share === best.share && avg < best.avg)) best = { cls, share, avg, dead: dead.length, count: ofClass.length };
  }
  if (!best) return 'No weakness found: none of their troops fell. Focus your fire on one enemy at a time.';
  return `Their ${TROOP_NAMES[best.cls].many} fell first (${best.dead} of ${best.count}, around ${at(Math.round(best.avg))}): ${CLASS_WEAKNESS[best.cls]}.`;
}

function scoreOf(state: BattleState): number {
  const s = BATTLE_IQ.score;
  const facts = battleFacts(state);
  let score = s.start + (facts.won ? s.win : 0) + s.perfect * facts.perfects + s.combo * facts.combos + s.finisher * facts.finishers;
  score -= s.idleUltimatePerSecond * Math.max(0, ticksToSeconds(idleUltimate(state).ticks) - BATTLE_IQ.idleUltimateSeconds);
  score -= s.fullPipsPerSecond * Math.max(0, ticksToSeconds(fullPips(state)) - BATTLE_IQ.fullPipsSeconds);
  score -= s.earlyLoss * earlyLosses(state).length;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/** The report for a finished battle. */
export function battleIq(state: BattleState): BattleIq {
  const score = scoreOf(state);
  const grade = BATTLE_IQ.grades.find((g) => score >= g.min)!;
  return {
    grade: grade.grade,
    score,
    xp: grade.xp,
    mistake: heaviest(biggestMistake(state), 'No clear mistake: your ultimate, pips and troops were all put to use.'),
    best: heaviest(bestDecision(state), `No standout moment: your troops fought on their own. Fire cards as their moment comes; ${GENERALS[state.generals.player].ultimate.name} on U when it is ready.`),
    missed: heaviest(missedOpportunity(state), 'No missed chances that the battle log shows.'),
    weakness: enemyWeakness(state),
  };
}
