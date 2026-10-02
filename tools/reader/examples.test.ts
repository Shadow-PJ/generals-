import { describe, expect, it } from 'vitest';
import { segmentsOf } from '../../src/cards/reader/tags';
import { generate } from '../dataset/generate';
import { taggedOrder } from './examples';

describe('training examples for the order reader', () => {
  const pairs = generate(2000, 11);

  it('line up every word of a generated order with a tag, and every trigger and step with the card', () => {
    for (const pair of pairs) {
      const order = taggedOrder(pair);
      expect(order.tags).toHaveLength(order.words.length);
      expect(segmentsOf(order.tags).length).toBe((pair.card.condition?.triggers.length ?? 0) + pair.card.steps.length);
    }
  });

  it('give each step its action and goal from the card', () => {
    const order = taggedOrder({
      text: 'when their assassin dives, rangers fall back to the healer',
      card: {
        condition: { triggers: [{ kind: 'enemyReachesBackline', enemy: 'assassin' }], repeat: false },
        steps: [{ action: 'fallBack', actors: { kind: 'class', cls: 'ranger' }, to: { kind: 'class', cls: 'guardian' } }],
        auto: false,
      },
      pieces: [
        { text: 'when', role: 'C' },
        { text: 'their assassin', role: 'E', start: true },
        { text: 'dives', role: 'T' },
        { text: ',', role: 'O' },
        { text: 'rangers', role: 'A', start: true },
        { text: 'fall back', role: 'V' },
        { text: 'to the healer', role: 'G' },
      ],
    });
    expect(order.tags).toEqual(['C', 'BE', 'IE', 'IT', 'O', 'BA', 'IV', 'IV', 'IG', 'IG', 'IG']);
    expect(order.triggers.map((t) => t.kind)).toEqual(['enemyReachesBackline']);
    expect(order.steps.map((s) => [s.action, s.goal])).toEqual([['fallBack', 'class']]);
  });
});
