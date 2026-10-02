// Loads tools/dataset/natural.txt: hand-written orders grouped under a canonical order whose
// card (read by the rule parser) is the expected card for the whole group. Also splits it into a
// training part and a held-out test part that no prompt or training run may look at.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseOrder } from '../../src/cards/parser';
import { readCard } from '../../src/cards/schema';
import type { Card } from '../../src/cards/types';

export interface Example {
  text: string;
  /** The expected card, without the words. */
  card: Card;
  /** The canonical order of the group the sentence belongs to. */
  group: string;
}

export const NATURAL_FILE = fileURLToPath(new URL('./natural.txt', import.meta.url));

/** Every `HELD_OUT_EVERY`th sentence of each group goes to the test set. */
export const HELD_OUT_EVERY = 4;

export function loadNatural(source: string = readFileSync(NATURAL_FILE, 'utf8')): Example[] {
  const examples: Example[] = [];
  let group: { order: string; card: Card } | null = null;
  source.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    if (line.startsWith('==')) {
      const order = line.slice(2).trim();
      const parsed = parseOrder(order);
      if (!parsed.ok) throw new Error(`Line ${i + 1}: the rule parser can't read the group order "${order}": ${parsed.error}`);
      group = { order, card: withoutWords(parsed.card) };
      return;
    }
    if (!group) throw new Error(`Line ${i + 1}: a sentence before the first "==" group`);
    examples.push({ text: line, card: group.card, group: group.order });
  });
  return examples;
}

/** Splits each group: every 4th sentence is held out for testing, the rest are for training and prompts. */
export function splitNatural(examples: readonly Example[]): { train: Example[]; test: Example[] } {
  const train: Example[] = [];
  const test: Example[] = [];
  const seen = new Map<string, number>();
  for (const example of examples) {
    const n = seen.get(example.group) ?? 0;
    seen.set(example.group, n + 1);
    (n % HELD_OUT_EVERY === HELD_OUT_EVERY - 1 ? test : train).push(example);
  }
  return { train, test };
}

export function withoutWords(card: Card): Card {
  const { text: _words, ...rest } = card;
  return rest;
}

/** A card as a string with a fixed field order and no words, for comparing cards from any source. */
export function cardKey(card: Card): string {
  const normal = readCard(JSON.parse(JSON.stringify(card)));
  return normal ? JSON.stringify(withoutWords(normal)) : `invalid:${JSON.stringify(card)}`;
}
