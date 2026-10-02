import { describe, expect, it } from 'vitest';
import { classesIn, editDistance, hpPercentIn, keptWords, KnownWords, normalizeWords, numbersIn, rawWords, splitOrder, wordGroup } from './words';

describe("the order reader's words", () => {
  it('split an order into lowercase words, numbers and commas', () => {
    expect(splitOrder('Rangers: fall back!! Then hold.')).toEqual(['rangers', ',', 'fall', 'back', ',', 'then', 'hold']);
    expect(splitOrder("When my healer's under 30%, they're 3+ enemies")).toEqual(
      ['when', 'my', 'healers', 'under', '30', 'percent', ',', 'theyre', '3', 'or', 'more', 'enemies'],
    );
    expect(splitOrder('  ...  ')).toEqual([]);
  });

  it('keep the same words whether an order is split whole or piece by piece', () => {
    const words = rawWords(', , kill , ,him ,');
    expect(keptWords(words).map((i) => words[i])).toEqual(splitOrder(', , kill , ,him ,'));
  });

  it('fix typos to the closest known word, preferring the same first letter', () => {
    const known = new KnownWords(['toward', 'forward', 'rangers', 'vanguards', 'hold', 'kill', 'burn', 'ultimate', 'boys']);
    expect(known.closest('rangrs')).toBe('rangers');
    expect(known.closest('vangaurds')).toBe('vanguards');
    expect(known.closest('hodl')).toBe('hold');
    expect(known.closest('kil')).toBe('kill');
    expect(known.closest('ultamite')).toBe('ultimate');
    expect(known.closest('foward')).toBe('forward');
    // A different short word is not a typo.
    expect(known.closest('turn')).toBeUndefined();
    expect(known.closest('bows')).toBeUndefined();
    expect(known.closest('zebra')).toBeUndefined();
  });

  it('read chat spellings and leave known words alone', () => {
    const known = new KnownWords(['you', 'are', 'where', 'hold', 'focus']);
    expect(normalizeWords(['hold', 'where', 'u', 'r', ',', 'focsu'], known)).toEqual(['hold', 'where', 'you', 'are', ',', 'focus']);
  });

  it('count a swap of two letters as one typo', () => {
    expect(editDistance('hodl', 'hold', 2)).toBe(1);
    expect(editDistance('abc', 'xyz', 1)).toBe(2);
  });

  it('find troop classes, including slang and two-word names', () => {
    expect(classesIn(['the', 'archers', 'and', 'their', 'front', 'line'])).toEqual(['ranger', 'vanguard']);
    expect(classesIn(['heals', 'ninja', 'spellcaster'])).toEqual(['guardian', 'assassin', 'invoker']);
    expect(classesIn(['everyone'])).toEqual([]);
  });

  it('read numbers in digits and words, but not "one of"', () => {
    expect(numbersIn(['below', 'twenty', 'five', 'percent'])).toEqual([25]);
    expect(numbersIn(['3', 'or', 'more', 'of', 'them'])).toEqual([3]);
    expect(numbersIn(['one', 'of', 'my', 'troops', 'drops', 'below', 'forty'])).toEqual([40]);
  });

  it('read an HP threshold from a number, a fraction or a hurt word', () => {
    expect(hpPercentIn(['drops', 'below', '40', 'percent'])).toBe(40);
    expect(hpPercentIn(['is', 'at', 'half', 'health'])).toBe(50);
    expect(hpPercentIn(['is', 'in', 'trouble'])).toBe(40);
    expect(hpPercentIn(['gets', 'low', 'on', 'health'])).toBe(30);
    expect(hpPercentIn(['is', 'wounded'])).toBe(50);
    expect(hpPercentIn(['dives'])).toBeUndefined();
  });

  it('sort words into rough groups for the features', () => {
    expect(wordGroup('rangers')).toBe('class');
    expect(wordGroup('50')).toBe('num');
    expect(wordGroup('whenever')).toBe('cond');
    expect(wordGroup(',')).toBe('comma');
    expect(wordGroup('xylophone')).toBe('other');
  });
});
