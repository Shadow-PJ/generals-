import { describe, expect, it } from 'vitest';
import { COMMAND_XP, RANK_XP } from '../data/progression';
import { RANKS, STARTING_RANK } from '../data/ranks';
import type { BattleEvent, BattleResult } from '../sim';
import { battleXp, rankForXp, rankProgress, rankUnlocks } from './progress';

const result = (winner: BattleResult['winner']): BattleResult => ({ winner, reason: 'eliminated', durationTicks: 1000, hpShare: { player: 0.5, enemy: 0 } });

describe('Command Ranks', () => {
  it('start at Rank I and rise with Command XP, up to Rank V', () => {
    expect(rankForXp(0)).toBe(STARTING_RANK);
    expect(rankForXp(RANK_XP[2] - 1)).toBe(1);
    expect(rankForXp(RANK_XP[2])).toBe(2);
    expect(rankForXp(RANK_XP[5] + 10_000)).toBe(5);
    for (const r of RANKS) expect(rankForXp(RANK_XP[r.rank])).toBe(r.rank);
  });

  it('show how far you are toward the next rank, and nothing past Rank V', () => {
    expect(rankProgress(RANK_XP[2] + 50)).toEqual({ into: 50, span: RANK_XP[3] - RANK_XP[2] });
    expect(rankProgress(RANK_XP[5])).toBeNull();
  });

  it('take about one region each: a region is about 10 battles', () => {
    const typical = COMMAND_XP.win + 2 * COMMAND_XP.perfect + COMMAND_XP.combo;
    for (const r of RANKS.slice(1)) {
      const battles = (RANK_XP[r.rank] - RANK_XP[(r.rank - 1) as 1 | 2 | 3 | 4]) / typical;
      expect(battles, `Rank ${r.numeral}`).toBeGreaterThan(3);
      expect(battles, `Rank ${r.numeral}`).toBeLessThan(20);
    }
  });
});

describe('Command XP from a battle', () => {
  const fired = (perfect: boolean, side: 'player' | 'enemy' = 'player'): BattleEvent => ({ tick: 1, type: 'cardFired', side, slot: 0, auto: false, perfect, cost: 1, link: 1 });

  it('pays for the battle by its outcome, a loss included', () => {
    expect(battleXp([], result('player')).total).toBe(COMMAND_XP.win);
    expect(battleXp([], result('draw')).total).toBe(COMMAND_XP.draw);
    expect(battleXp([], result('enemy'))).toEqual({ total: COMMAND_XP.loss, parts: [{ label: 'Defeat', xp: COMMAND_XP.loss }] });
  });

  it('adds Perfect timings, signature combos and Finishers, yours only, with caps', () => {
    const events: BattleEvent[] = [
      ...Array.from({ length: 9 }, () => fired(true)),
      fired(false),
      fired(true, 'enemy'),
      { tick: 2, type: 'combo', side: 'player', combo: 'ironShell', acrossCards: false },
      { tick: 2, type: 'combo', side: 'enemy', combo: 'ironShell', acrossCards: false },
      { tick: 3, type: 'ultimate', side: 'player', name: 'rally', link: 3, finisher: true },
    ];
    const gain = battleXp(events, result('player'));
    expect(gain.parts).toEqual([
      { label: 'Victory', xp: COMMAND_XP.win },
      { label: `${COMMAND_XP.maxPerfects} Perfect timings`, xp: COMMAND_XP.maxPerfects * COMMAND_XP.perfect },
      { label: '1 signature combo', xp: COMMAND_XP.combo },
      { label: '1 Finisher', xp: COMMAND_XP.finisher },
    ]);
    expect(gain.total).toBe(gain.parts.reduce((s, p) => s + p.xp, 0));
  });
});

describe('the rank-up note', () => {
  it('says what each rank brings', () => {
    expect(rankUnlocks(2)).toBe('3 slots · "when" conditions · Auto mode · Overcharge, Protect');
    expect(rankUnlocks(3)).toBe('5 max pips · 2 steps per card · Call Reserve, Hold · chains and signature combos');
    expect(rankUnlocks(4)).toBe('4 slots · 3 steps per card · "when X and Y" · Finishers');
    expect(rankUnlocks(5)).toBe('6 max pips · "every time" cards');
  });
});
