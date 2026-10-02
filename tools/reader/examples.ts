// Training examples for the order reader: each generated order as words with their tags, plus
// the right answer for every decision the reader makes (trigger kinds, step actions, goals).

import { goalOf, type Goal } from '../../src/cards/reader/reader';
import { segmentsOf, tagFor, type Segment, type Tag } from '../../src/cards/reader/tags';
import { keptWords, rawWords, splitOrder } from '../../src/cards/reader/words';
import type { ActionName, Card, TriggerKind } from '../../src/cards/types';
import type { Pair } from '../dataset/generate';

export interface TaggedOrder {
  text: string;
  /** The order's words, before typos are fixed. */
  words: string[];
  tags: Tag[];
  card: Card;
  triggers: { segment: Segment; kind: TriggerKind }[];
  steps: { segment: Segment; action: ActionName; goal: Goal | null }[];
}

/** A generated order with a tag on every word, lined up with its card. Throws if they don't line up. */
export function taggedOrder(pair: Pair): TaggedOrder {
  const words: string[] = [];
  const tags: Tag[] = [];
  for (const piece of pair.pieces) {
    rawWords(piece.text).forEach((word, i) => {
      words.push(word);
      tags.push(tagFor(piece.role, piece.start === true && i === 0));
    });
  }
  const kept = keptWords(words);
  const keptWordsList = kept.map((i) => words[i]!);
  const keptTags = kept.map((i) => tags[i]!);
  const expected = splitOrder(pair.text);
  if (keptWordsList.join(' ') !== expected.join(' ')) {
    throw new Error(`Pieces and text split differently: "${keptWordsList.join(' ')}" vs "${expected.join(' ')}"`);
  }
  const segments = segmentsOf(keptTags);
  const triggerSegments = segments.filter((s) => s.kind === 'trigger');
  const stepSegments = segments.filter((s) => s.kind === 'step');
  const cardTriggers = pair.card.condition?.triggers ?? [];
  if (triggerSegments.length !== cardTriggers.length || stepSegments.length !== pair.card.steps.length) {
    throw new Error(`Tags and card don't line up for "${pair.text}"`);
  }
  return {
    text: pair.text,
    words: keptWordsList,
    tags: keptTags,
    card: pair.card,
    triggers: triggerSegments.map((segment, i) => ({ segment, kind: cardTriggers[i]!.kind })),
    steps: stepSegments.map((segment, i) => ({ segment, action: pair.card.steps[i]!.action, goal: goalOf(pair.card.steps[i]!) })),
  };
}
