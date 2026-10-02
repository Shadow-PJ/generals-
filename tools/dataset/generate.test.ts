import { describe, expect, it } from 'vitest';
import { parseOrder } from '../../src/cards/parser';
import { validateCard } from '../../src/cards/validator';
import { generate } from './generate';
import { cardKey } from './natural';

const pairs = generate(2000, 7);

describe('the dataset generator', () => {
  it('makes the asked number of distinct, legal sentence and card pairs', () => {
    expect(pairs).toHaveLength(2000);
    expect(new Set(pairs.map((p) => p.text)).size).toBe(2000);
    for (const p of pairs) expect(validateCard(p.card, 5).ok, p.text).toBe(true);
  });

  it('gives the same dataset for the same seed, and a different one for another seed', () => {
    expect(generate(50, 7)).toEqual(pairs.slice(0, 50));
    expect(generate(50, 8)).not.toEqual(pairs.slice(0, 50));
  });

  it('combines every action with conditions, repeats and several steps', () => {
    const actions = new Set(pairs.flatMap((p) => p.card.steps.map((s) => s.action)));
    expect(actions.size).toBe(7);
    const triggers = new Set(pairs.flatMap((p) => p.card.condition?.triggers.map((t) => t.kind) ?? []));
    expect(triggers.size).toBe(4);
    expect(pairs.some((p) => p.card.condition?.repeat)).toBe(true);
    expect(pairs.some((p) => (p.card.condition?.triggers.length ?? 0) === 2)).toBe(true);
    expect(new Set(pairs.map((p) => p.card.steps.length))).toEqual(new Set([1, 2, 3]));
  });

  it('labels agree with the rule parser on every sentence the parser can read', () => {
    let read = 0;
    for (const p of pairs) {
      const parsed = parseOrder(p.text);
      if (!parsed.ok) continue;
      read++;
      expect(cardKey(parsed.card), p.text).toBe(cardKey(p.card));
    }
    expect(read).toBeGreaterThan(pairs.length / 2);
  });
});
