import { describe, expect, it } from 'vitest';
import { bestLabel, scoreLabels, viterbi, type LinearWeights } from './model';
import { canFollow, TAGS } from './tags';

const weights: LinearWeights = {
  labels: ['focus', 'hold', 'move'],
  weights: { 'w=kill': [0, 50], 'w=stay': [1, 40, 2, 10], b: [2, 5] },
};

describe("the order reader's model", () => {
  it('adds up each feature’s weights per answer, ignoring unknown features', () => {
    expect(scoreLabels(weights, ['w=kill', 'b', 'w=nonsense'])).toEqual([50, 0, 5]);
  });

  it('picks the best allowed answer and says how far ahead it is', () => {
    expect(bestLabel(weights, ['w=kill'])).toEqual({ label: 'focus', margin: 50 });
    expect(bestLabel(weights, ['w=stay', 'b'], ['hold', 'move'])).toEqual({ label: 'hold', margin: 25 });
    expect(bestLabel(weights, ['w=kill'], ['move'])).toEqual({ label: 'move', margin: Infinity });
  });

  it('tags a whole order at once, never continuing a part that was not started', () => {
    const k = TAGS.length;
    const flat = Array.from({ length: k + 1 }, () => new Array<number>(k).fill(0));
    const emit = (tag: string, score: number) => TAGS.map((t) => (t === tag ? score : 0));
    // The second word prefers "IV", but "IV" can't follow "C", so something legal is chosen.
    const { path, margins } = viterbi([emit('C', 10), emit('IV', 3)], flat);
    expect(TAGS[path[0]!]).toBe('C');
    expect(TAGS[path[1]!]).not.toBe('IV');
    expect(canFollow('C', TAGS[path[1]!]!)).toBe(true);
    // The best path without "C" first is "BV IV" (3), so "C" wins by 10 - 3.
    expect(margins[0]).toBe(7);
    // With a legal start, the preferred tags win, each by its own score.
    const legal = viterbi([emit('BV', 10), emit('IV', 3)], flat);
    expect(legal.path.map((t) => TAGS[t])).toEqual(['BV', 'IV']);
    expect(legal.margins).toEqual([10, 3]);
  });
});
