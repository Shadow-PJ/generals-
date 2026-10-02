import { describe, expect, it } from 'vitest';
import { validateCard } from '../../src/cards/validator';
import { readFileSync } from 'node:fs';
import { cardKey, loadNatural, splitNatural } from './natural';

const examples = loadNatural();
const { train, test } = splitNatural(examples);

describe('the natural orders dataset', () => {
  it('has at least 1,000 hand-written sentences', () => {
    expect(examples.length).toBeGreaterThanOrEqual(1000);
  });

  it('labels every sentence with a card that is legal at Rank V', () => {
    for (const e of examples) expect(validateCard(e.card, 5).ok, e.group).toBe(true);
  });

  it('covers every action, every condition kind, repeating cards and 1 to 3 steps', () => {
    const actions = new Set(examples.flatMap((e) => e.card.steps.map((s) => s.action)));
    expect([...actions].sort()).toEqual(['callReserve', 'fallBack', 'focus', 'hold', 'move', 'overcharge', 'protect']);
    const triggers = new Set(examples.flatMap((e) => e.card.condition?.triggers.map((t) => t.kind) ?? []));
    expect(triggers.size).toBe(4);
    expect(examples.some((e) => e.card.condition?.repeat)).toBe(true);
    expect(new Set(examples.map((e) => e.card.steps.length))).toEqual(new Set([1, 2, 3]));
  });

  it('has no sentence twice', () => {
    const texts = examples.map((e) => e.text.toLowerCase());
    expect(texts.filter((t, i) => texts.indexOf(t) !== i)).toEqual([]);
  });

  it('holds out about a quarter of every group for testing, and the split never changes', () => {
    expect(train.length + test.length).toBe(examples.length);
    expect(test.length).toBeGreaterThan(examples.length / 5);
    expect(new Set(test.map((e) => e.group)).size).toBe(new Set(examples.map((e) => e.group)).size);
    expect(splitNatural(loadNatural()).test).toEqual(test);
    const trainTexts = new Set(train.map((e) => e.text));
    expect(test.some((e) => trainTexts.has(e.text))).toBe(false);
  });

  it('compares cards by meaning, not by field order or words', () => {
    const card = examples[0]!.card;
    const reordered = JSON.parse(JSON.stringify({ auto: card.auto, steps: card.steps, condition: card.condition, text: 'x' }));
    expect(cardKey(reordered)).toBe(cardKey(card));
    expect(cardKey(examples[1]!.card)).not.toBe(cardKey(examples[20]!.card));
  });
});

describe('the fresh test orders', () => {
  const fresh = loadNatural(readFileSync(new URL('./fresh.txt', import.meta.url), 'utf8'));

  it('label every sentence with a legal card, many of them kinds natural.txt does not have', () => {
    expect(fresh.length).toBeGreaterThan(150);
    for (const e of fresh) expect(validateCard(e.card, 5).ok, e.group).toBe(true);
    const naturalKinds = new Set(examples.map((e) => cardKey(e.card)));
    expect(new Set(fresh.filter((e) => !naturalKinds.has(cardKey(e.card))).map((e) => e.group)).size).toBeGreaterThanOrEqual(10);
  });

  it('share no sentence with natural.txt', () => {
    const natural = new Set(examples.map((e) => e.text.toLowerCase()));
    expect(fresh.filter((e) => natural.has(e.text.toLowerCase())).map((e) => e.text)).toEqual([]);
  });
});
