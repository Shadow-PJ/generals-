import { describe, expect, it } from 'vitest';
import { CODEX_ENTRY_IDS } from '../data/combos';
import type { BattleEvent } from '../sim';
import { codexEntry, codexFinds } from './codex';

describe('the Combo Codex', () => {
  it('finds each combo you landed once, in Codex order, and a Finisher', () => {
    const events: BattleEvent[] = [
      { tick: 5, type: 'combo', side: 'player', combo: 'ironShell', acrossCards: false },
      { tick: 9, type: 'combo', side: 'player', combo: 'feignedRetreat', acrossCards: true },
      { tick: 20, type: 'combo', side: 'player', combo: 'ironShell', acrossCards: true },
      { tick: 30, type: 'ultimate', side: 'player', name: 'rally', link: 1, finisher: false },
    ];
    expect(codexFinds(events)).toEqual(['feignedRetreat', 'ironShell']);
    expect(codexFinds([{ tick: 1, type: 'ultimate', side: 'player', name: 'rally', link: 3, finisher: true }])).toEqual(['finisher']);
    expect(codexFinds([{ tick: 1, type: 'combo', side: 'enemy', combo: 'ambush', acrossCards: false }])).toEqual([]);
  });

  it('has a name, steps and bonus for every entry', () => {
    expect(CODEX_ENTRY_IDS).toHaveLength(6);
    for (const id of CODEX_ENTRY_IDS) {
      const entry = codexEntry(id);
      expect(entry.name.length, id).toBeGreaterThan(3);
      expect(entry.stepsText.length, id).toBeGreaterThan(5);
      expect(entry.bonusText.length, id).toBeGreaterThan(5);
    }
  });
});
