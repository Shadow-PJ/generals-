import { describe, expect, it } from 'vitest';
import { RANKS, rankRules, unlockedActions } from '../data/ranks';
import { replyToVerdict } from './replies';
import type { Card, Step } from './types';
import { conditionLevel, slotUnlockRank, validateCard } from './validator';

const focus: Step = { action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' } };
const card = (over: Partial<Card>): Card => ({ condition: null, steps: [focus], auto: false, ...over });
const dives = { kind: 'enemyReachesBackline', enemy: 'assassin' } as const;

describe('the rank table', () => {
  it('matches the design', () => {
    expect(RANKS.map((r) => [r.numeral, r.slots, r.maxPips, r.stepsPerCard, r.conditions])).toEqual([
      ['I', 2, 4, 1, 'none'],
      ['II', 3, 4, 1, 'simple'],
      ['III', 3, 5, 2, 'simple'],
      ['IV', 4, 5, 3, 'combined'],
      ['V', 4, 6, 3, 'repeating'],
    ]);
    expect(unlockedActions(1)).toEqual(['focus', 'move', 'fallBack']);
    expect(unlockedActions(2)).toEqual(['focus', 'move', 'fallBack', 'overcharge', 'protect']);
    expect(unlockedActions(3)).toEqual(['focus', 'move', 'fallBack', 'overcharge', 'protect', 'callReserve', 'hold']);
    expect(rankRules(2).autoMode).toBe(true);
    expect(rankRules(1).autoMode).toBe(false);
  });
});

describe('the validator', () => {
  it('accepts a simple Focus at Rank I and answers "Understood."', () => {
    const verdict = validateCard(card({}), 1);
    expect(verdict).toMatchObject({ ok: true, cost: 1 });
    expect(replyToVerdict(verdict)).toBe('Understood.');
  });

  it('locks actions until their rank, and names the rank in the reply', () => {
    const protect = card({ steps: [{ action: 'protect', actors: { kind: 'all' }, target: { kind: 'weakest' } }] });
    const verdict = validateCard(protect, 1);
    expect(verdict.problems).toEqual([{ kind: 'actionLocked', action: 'protect' }]);
    expect(verdict.unlockRank).toBe(2);
    expect(replyToVerdict(verdict)).toBe("We haven't trained for that yet. Reach Rank II.");
    expect(validateCard(card({ steps: [{ action: 'hold', actors: { kind: 'all' } }] }), 2).unlockRank).toBe(3);
  });

  it('limits steps per card: 1 at Ranks I and II, 2 at III, 3 at IV and V', () => {
    const two = card({ steps: [focus, focus] });
    expect(validateCard(two, 2)).toMatchObject({ ok: false, unlockRank: 3 });
    expect(validateCard(two, 3).ok).toBe(true);
    const three = card({ steps: [focus, focus, focus] });
    expect(validateCard(three, 3).unlockRank).toBe(4);
    expect(validateCard(three, 4).ok).toBe(true);
    expect(validateCard(card({ steps: [focus, focus, focus, focus] }), 5)).toMatchObject({ ok: false, unlockRank: null });
  });

  it('allows no condition at Rank I, simple "when" from II, "when X and Y" from IV, "every time" at V', () => {
    const simple = card({ condition: { triggers: [dives], repeat: false } });
    const combined = card({ condition: { triggers: [dives, { kind: 'enemyUltimateCharging' }], repeat: false } });
    const repeating = card({ condition: { triggers: [dives], repeat: true } });
    expect([conditionLevel(simple), conditionLevel(combined), conditionLevel(repeating)]).toEqual([
      'simple',
      'combined',
      'repeating',
    ]);
    expect(validateCard(simple, 1).unlockRank).toBe(2);
    expect(validateCard(simple, 2).ok).toBe(true);
    expect(validateCard(combined, 3).unlockRank).toBe(4);
    expect(validateCard(combined, 4).ok).toBe(true);
    expect(validateCard(repeating, 4).unlockRank).toBe(5);
    expect(validateCard(repeating, 5).ok).toBe(true);
    expect(replyToVerdict(validateCard(repeating, 3))).toBe("We haven't trained for that yet. Reach Rank V.");
  });

  it('allows Auto from Rank II, and only on cards with a condition', () => {
    const autoWhen = card({ condition: { triggers: [dives], repeat: false }, auto: true });
    expect(validateCard(autoWhen, 2).ok).toBe(true);
    const autoAlways = card({ auto: true });
    const verdict = validateCard(autoAlways, 5);
    expect(verdict).toMatchObject({ ok: false, unlockRank: null });
    expect(replyToVerdict(verdict)).toBe('Auto needs a condition to wait for.');
  });

  it('allows naming a veteran from Rank III', () => {
    const named = card({ steps: [{ action: 'focus', actors: { kind: 'named', name: 'Raven' }, target: { kind: 'class', cls: 'guardian' } }] });
    expect(validateCard(named, 2).problems).toEqual([{ kind: 'namedLocked' }]);
    expect(validateCard(named, 3).ok).toBe(true);
  });

  it('keeps the cost within your max pips', () => {
    const pricey = card({
      steps: [
        { action: 'overcharge', actors: { kind: 'all' } },
        { action: 'callReserve', reserve: null },
        { action: 'callReserve', reserve: null },
      ],
    });
    expect(validateCard(pricey, 4).problems).toEqual([{ kind: 'tooExpensive', cost: 6, maxPips: 5 }]);
    expect(validateCard(pricey, 5).ok).toBe(true);
  });

  it('refuses "the one that set it off" when no trigger names such a unit', () => {
    const him = card({ steps: [{ action: 'focus', actors: { kind: 'all' }, target: { kind: 'trigger' } }] });
    expect(validateCard(him, 5)).toMatchObject({ ok: false, unlockRank: null });
    const allyTrigger = card({
      condition: { triggers: [{ kind: 'allyBelowHp', ally: 'ranger', hpPercent: 50 }], repeat: false },
      steps: [{ action: 'focus', actors: { kind: 'all' }, target: { kind: 'trigger' } }],
    });
    expect(validateCard(allyTrigger, 5).problems).toEqual([{ kind: 'triggerTargetMismatch', stepIndex: 0 }]);
    const ok = { ...allyTrigger, steps: [{ action: 'protect', actors: { kind: 'all' }, target: { kind: 'trigger' } } as Step] };
    expect(validateCard(ok, 2).ok).toBe(true);
  });

  it('refuses cards with no steps, too many triggers or numbers out of range', () => {
    expect(validateCard(card({ steps: [] }), 5).ok).toBe(false);
    const three = card({ condition: { triggers: [dives, dives, dives], repeat: false } });
    expect(validateCard(three, 5).problems).toContainEqual({ kind: 'tooManyTriggers', triggers: 3, max: 2 });
    const hp = card({ condition: { triggers: [{ kind: 'allyBelowHp', ally: 'any', hpPercent: 150 }], repeat: false } });
    expect(validateCard(hp, 5).problems).toContainEqual({ kind: 'numberOutOfRange', what: 'hpPercent', value: 150 });
  });

  it('accepts the design examples at the ranks they belong to', () => {
    // Rank I: "Everyone focus their Assassin." Manual, 1 step, cost 1.
    const rank1 = card({ steps: [{ action: 'focus', actors: { kind: 'all' }, target: { kind: 'class', cls: 'assassin' } }] });
    expect(validateCard(rank1, 1)).toMatchObject({ ok: true, cost: 1 });
    // Rank III: a condition and 2 steps, cost 2.
    const rank3 = card({
      condition: { triggers: [dives], repeat: false },
      steps: [
        { action: 'protect', actors: { kind: 'all' }, target: { kind: 'class', cls: 'ranger' } },
        { action: 'focus', actors: { kind: 'all' }, target: { kind: 'trigger' } },
      ],
    });
    expect(validateCard(rank3, 3)).toMatchObject({ ok: true, cost: 2 });
    expect(validateCard(rank3, 2).unlockRank).toBe(3);
  });

  it('locks slots beyond your rank: 2 at Rank I, 3 at II and III, 4 from IV', () => {
    expect(slotUnlockRank(1, 1)).toBeNull();
    expect(slotUnlockRank(2, 1)).toBe(2);
    expect(slotUnlockRank(3, 3)).toBe(4);
    expect(slotUnlockRank(3, 4)).toBeNull();
  });
});

describe('the validator and the Legendary slot', () => {
  const swap: Step = { action: 'swap', actors: { kind: 'class', cls: 'vanguard' }, target: { kind: 'class', cls: 'ranger' } };
  const echo: Step = { action: 'echo' };
  const slot = (learned: readonly ('swap' | 'echo' | 'hijack')[]) => ({ legendarySlot: true, learned });

  it('takes a Legendary action only on the Legendary slot’s card, once a boss has taught it', () => {
    expect(validateCard(card({ steps: [echo] }), 1, slot(['echo']))).toMatchObject({ ok: true, cost: 3 });
    const outside = validateCard(card({ steps: [echo] }), 5);
    expect(outside.problems).toEqual([{ kind: 'legendaryOutsideSlot', action: 'echo' }]);
    expect(outside.unlockRank).toBeNull();
    expect(replyToVerdict(outside)).toBe('That is a Legendary order. It goes in the Legendary slot.');
    const unknown = validateCard(card({ steps: [swap] }), 5, slot(['echo']));
    expect(unknown.problems).toEqual([{ kind: 'legendaryNotLearned', action: 'swap' }]);
    expect(replyToVerdict(unknown)).toBe("We don't know that one. Beat The Strategist to learn it.");
  });

  it('wants exactly one Legendary action on the Legendary slot’s card', () => {
    expect(validateCard(card({}), 5, slot(['echo'])).problems).toEqual([{ kind: 'legendaryMissing' }]);
    expect(validateCard(card({ steps: [echo, swap] }), 5, slot(['echo', 'swap'])).problems).toEqual([{ kind: 'tooManyLegendary', count: 2 }]);
  });

  it('counts the Legendary step toward your rank’s steps and pips, as in the design: Swap, Protect, Focus is 3 steps and 5 pips at Rank V', () => {
    const design = card({
      condition: { triggers: [dives], repeat: true },
      steps: [swap, { action: 'protect', actors: { kind: 'all' }, target: { kind: 'class', cls: 'ranger' } }, { ...focus, target: { kind: 'trigger' } }],
    });
    expect(validateCard(design, 5, slot(['swap']))).toMatchObject({ ok: true, cost: 5 });
    expect(validateCard(design, 4, slot(['swap'])).unlockRank).toBe(5);
    expect(validateCard(card({ steps: [swap, focus] }), 1, slot(['swap'])).problems).toContainEqual({ kind: 'tooManySteps', steps: 2, max: 1 });
  });
});
