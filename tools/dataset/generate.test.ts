import { describe, expect, it } from 'vitest';
import { parseOrder } from '../../src/cards/parser';
import { validateCard } from '../../src/cards/validator';
import { isLegendaryAction } from '../../src/cards/types';
import { generate, joinPieces, LEGENDARY_SHARE, slotFor } from './generate';
import { cardKey } from './natural';

const pairs = generate(2000, 7);

describe('the dataset generator', () => {
  it('makes the asked number of distinct, legal sentence and card pairs', () => {
    expect(pairs).toHaveLength(2000);
    expect(new Set(pairs.map((p) => p.text)).size).toBe(2000);
    for (const p of pairs) expect(validateCard(p.card, 5, slotFor(p.card)).ok, p.text).toBe(true);
  });

  it('gives the same dataset for the same seed, and a different one for another seed', () => {
    expect(generate(50, 7)).toEqual(pairs.slice(0, 50));
    expect(generate(50, 8)).not.toEqual(pairs.slice(0, 50));
  });

  it('combines every action, Legendary ones too, with conditions, repeats and several steps', () => {
    const actions = new Set(pairs.flatMap((p) => p.card.steps.map((s) => s.action)));
    expect(actions.size).toBe(12);
    // About one order in eight has a Legendary step, never more than one.
    const legendary = pairs.filter((p) => p.card.steps.some((s) => isLegendaryAction(s.action)));
    expect(legendary.length / pairs.length).toBeCloseTo(LEGENDARY_SHARE, 1);
    expect(legendary.every((p) => p.card.steps.filter((s) => isLegendaryAction(s.action)).length === 1)).toBe(true);
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
    // Most generated orders are meant to be beyond the parser: slang, typos, odd word order.
    expect(read).toBeGreaterThan(pairs.length / 20);
  });

  it('labels every word, and the labeled pieces make up the sentence', () => {
    for (const p of pairs) {
      expect(joinPieces(p.pieces).toLowerCase(), p.text).toBe(p.text.toLowerCase());
      expect(p.pieces.every((piece) => piece.text.length > 0)).toBe(true);
    }
  });

  it('adds typos from their own random numbers, so the same seed without typos gives the same orders', () => {
    const clean = generate(200, 7, { typos: false });
    const typed = pairs.slice(0, 200);
    const same = clean.filter((p, i) => p.text === typed[i]!.text).length;
    expect(same).toBeGreaterThan(100);
    expect(same).toBeLessThan(200);
    expect(clean.map((p) => p.card)).toEqual(typed.map((p) => p.card));
  });
});
