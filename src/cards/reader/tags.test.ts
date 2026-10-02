import { describe, expect, it } from 'vitest';
import { canFollow, segmentsOf, tagFor, type Tag } from './tags';

describe("the order reader's tags", () => {
  it('only continue a trigger or step with an "I" tag of the same part', () => {
    expect(canFollow(null, 'IV')).toBe(false);
    expect(canFollow('BA', 'IV')).toBe(true);
    expect(canFollow('BE', 'IT')).toBe(true);
    expect(canFollow('IT', 'IV')).toBe(false);
    expect(canFollow('O', 'IA')).toBe(false);
    expect(canFollow('IT', 'BA')).toBe(true);
  });

  it('mark the first word of a trigger or step with "B"', () => {
    expect(tagFor('V', true)).toBe('BV');
    expect(tagFor('G', false)).toBe('IG');
    expect(tagFor('C', true)).toBe('C');
  });

  it('find the triggers and steps in order', () => {
    // when their assassin dives , rangers fall back to the healer
    const tags: Tag[] = ['C', 'BE', 'IE', 'IT', 'O', 'BA', 'IV', 'IV', 'IG', 'IG', 'IG'];
    expect(segmentsOf(tags)).toEqual([
      { kind: 'trigger', start: 1, end: 4 },
      { kind: 'step', start: 5, end: 11 },
    ]);
    // fall back , then hold : a "B" starts a new step even right after another
    expect(segmentsOf(['BV', 'IV', 'BV'])).toEqual([
      { kind: 'step', start: 0, end: 2 },
      { kind: 'step', start: 2, end: 3 },
    ]);
  });
});
