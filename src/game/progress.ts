// Your progress between battles: Command XP and the rank it gives, and the XP a battle earns,
// read from the battle's event log. Pure functions, so they are tested without the game running.

import { ACTION_NAMES } from '../cards/describe';
import { COMMAND_XP, RANK_XP } from '../data/progression';
import { RANKS, type RankNumber } from '../data/ranks';
import type { BattleEvent, BattleResult } from '../sim';

/** Your Command Rank for this much XP. */
export function rankForXp(xp: number): RankNumber {
  let rank: RankNumber = 1;
  for (const r of RANKS) if (xp >= RANK_XP[r.rank]) rank = r.rank;
  return rank;
}

/** How far you are toward the next rank: XP into this rank, XP this rank spans, or null at Rank V. */
export function rankProgress(xp: number): { into: number; span: number } | null {
  const rank = rankForXp(xp);
  if (rank === RANKS.length) return null;
  const from = RANK_XP[rank];
  const to = RANK_XP[(rank + 1) as RankNumber];
  return { into: xp - from, span: to - from };
}

export interface XpGain {
  total: number;
  /** What earned it, for the result screen: "Victory +50", "2 Perfect timings +10". */
  parts: { label: string; xp: number }[];
}

/** The Command XP your side earns from a finished battle. */
export function battleXp(events: readonly BattleEvent[], result: BattleResult): XpGain {
  const parts: XpGain['parts'] = [];
  const outcome = result.winner === 'player' ? 'win' : result.winner === 'draw' ? 'draw' : 'loss';
  parts.push({ label: { win: 'Victory', draw: 'Draw', loss: 'Defeat' }[outcome], xp: COMMAND_XP[outcome] });

  const perfects = events.filter((e) => e.type === 'cardFired' && e.side === 'player' && e.perfect).length;
  const combos = events.filter((e) => e.type === 'combo' && e.side === 'player').length;
  const finishers = events.filter((e) => e.type === 'ultimate' && e.side === 'player' && e.finisher).length;
  const counted = (n: number, max: number, one: string, many: string, each: number) => {
    const k = Math.min(n, max);
    if (k > 0) parts.push({ label: `${k} ${k === 1 ? one : many}`, xp: k * each });
  };
  counted(perfects, COMMAND_XP.maxPerfects, 'Perfect timing', 'Perfect timings', COMMAND_XP.perfect);
  counted(combos, COMMAND_XP.maxCombos, 'signature combo', 'signature combos', COMMAND_XP.combo);
  counted(finishers, Infinity, 'Finisher', 'Finishers', COMMAND_XP.finisher);
  return { total: parts.reduce((sum, p) => sum + p.xp, 0), parts };
}

/** The XP with the Battle IQ grade's bonus added, when it earns one. */
export function withIqXp(xp: XpGain, grade: string, bonus: number): XpGain {
  if (bonus <= 0) return xp;
  return { total: xp.total + bonus, parts: [...xp.parts, { label: `Battle IQ ${grade}`, xp: bonus }] };
}

/** What a rank brings, for the rank-up note: "4 slots, 3 steps per card, "when X and Y", Finishers". */
export function rankUnlocks(rank: RankNumber): string {
  const rules = RANKS[rank - 1]!;
  const before = rank > 1 ? RANKS[rank - 2]! : null;
  const parts: string[] = [];
  if (!before || rules.slots > before.slots) parts.push(`${rules.slots} slots`);
  if (!before || rules.maxPips > before.maxPips) parts.push(`${rules.maxPips} max pips`);
  if (!before || rules.stepsPerCard > before.stepsPerCard) parts.push(`${rules.stepsPerCard} step${rules.stepsPerCard === 1 ? '' : 's'} per card`);
  if (before && rules.conditions !== before.conditions) {
    parts.push({ none: '', simple: '"when" conditions', combined: '"when X and Y"', repeating: '"every time" cards' }[rules.conditions]);
  }
  if (rules.autoMode && !before?.autoMode) parts.push('Auto mode');
  if (rules.newActions.length > 0) parts.push(rules.newActions.map((a) => ACTION_NAMES[a]).join(', '));
  if (rules.chains && !before?.chains) parts.push('chains and signature combos');
  if (rules.finishers && !before?.finishers) parts.push('Finishers');
  return parts.filter((p) => p !== '').join(' · ');
}
