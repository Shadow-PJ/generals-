import { describe, expect, it } from 'vitest';
import { validateCard } from '../cards/validator';
import { enemyScript } from '../data/enemyScripts';
import { decreeOffers } from './decrees';
import { decreeChoices, enterNode, finishFight, pickSpoils, takeDecree } from './run';
import { runOf, runThrough } from './testing';
import type { Campaign } from './types';

const won = { won: true, fighters: [], xp: 50 };

/** A run that has just won an elite fight and picked from its spoils. */
function afterElite(skip = false): Campaign {
  const c = finishFight(enterNode(runThrough(['elite', 'battle', 'boss']), 0), won);
  return pickSpoils(c, skip ? null : 0);
}

describe('the beaten commander’s cards', () => {
  it('are the cards it fought with, at its rank, or as far as a lower rank can follow them', () => {
    expect(decreeOffers('warlord', 3, 5)).toEqual(enemyScript('warlord', 3).slots);
    const atTwo = decreeOffers('strategist', 4, 2);
    expect(atTwo.length).toBeGreaterThan(0);
    for (const card of atTwo) expect(validateCard(card, 2).ok).toBe(true);
    expect(atTwo.every((card) => card.steps.length === 1 && card.auto)).toBe(true);
  });

  it('are none at Rank I, which can’t set a card to fire by itself', () => {
    expect(decreeOffers('captain', 4, 1)).toEqual([]);
  });
});

describe('decrees on a run', () => {
  it('after an elite fight’s spoils, picked or skipped, the beaten commander’s orders wait', () => {
    const before = runOf(finishFight(enterNode(runThrough(['elite', 'battle', 'boss']), 0), won));
    if (before.stop?.kind !== 'spoils') throw new Error('expected spoils');
    expect(before.stop.commander).toEqual({ general: 'hiveMother', rank: expect.any(Number) });
    for (const run of [runOf(afterElite()), runOf(afterElite(true))]) {
      expect(run.stop).toEqual({ kind: 'decree', commander: before.stop.commander });
    }
  });

  it('a plain battle’s spoils have no commander’s orders after them', () => {
    const c = finishFight(enterNode(runThrough(['battle', 'boss']), 0), won);
    expect(runOf(c).stop).toMatchObject({ kind: 'spoils', commander: null });
    expect(runOf(pickSpoils(c, 0)).stop).toBeNull();
  });

  it('takes one card as the run’s decree, in place of any before, or keeps yours', () => {
    const c = afterElite();
    const choices = decreeChoices(runOf(c), 4);
    expect(choices.length).toBeGreaterThan(1);
    const taken = takeDecree(c, 1, 4);
    expect(runOf(taken)).toMatchObject({ decree: choices[1], stop: null });
    const kept = takeDecree({ ...c, run: { ...runOf(c), decree: choices[0]! } }, null, 4);
    expect(runOf(kept)).toMatchObject({ decree: choices[0], stop: null });
    expect(() => takeDecree(c, 99, 4)).toThrow();
    expect(() => takeDecree(taken, 0, 4)).toThrow();
  });

  it('at Rank I offers nothing to take, and moving on keeps the run going', () => {
    const c = afterElite();
    expect(decreeChoices(runOf(c), 1)).toEqual([]);
    const on = takeDecree(c, null, 1);
    expect(runOf(on)).toMatchObject({ decree: null, stop: null });
    expect(runOf(enterNode(on, 0)).stop).toMatchObject({ kind: 'fight' });
  });
});
