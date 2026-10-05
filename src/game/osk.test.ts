import { describe, expect, it } from 'vitest';
import { parseOrder } from '../cards/parser';
import { applySuggestion, moveCursor, ORDER_WORDS, OSK_ROWS, partialWord, pressKey, suggestions } from './osk';

const key = (label: string) => OSK_ROWS.flat().find((k) => k.label === label)!;

describe('the on-screen keyboard', () => {
  it('types letters, spaces once between words, deletes and stops at the length limit', () => {
    expect(pressKey('wh', key('e')).text).toBe('whe');
    expect(pressKey('when', key('space')).text).toBe('when ');
    expect(pressKey('when ', key('space')).text).toBe('when ');
    expect(pressKey('', key('space')).text).toBe('');
    expect(pressKey('when', key('⌫ delete')).text).toBe('whe');
    expect(pressKey('x'.repeat(200), key('a')).text).toHaveLength(200);
    expect(pressKey('hold', key('read order'))).toEqual({ text: 'hold', read: true, close: true });
    expect(pressKey('hold', key('done'))).toEqual({ text: 'hold', close: true });
  });

  it('suggests words the order reader knows that finish the word being typed', () => {
    expect(partialWord('when my ran')).toBe('ran');
    expect(suggestions('when my ran')).toContain('ranger');
    expect(suggestions('pro')).toContain('protect');
    expect(suggestions('when my ranger')).not.toContain('ranger');
    // After a space: the commonest first words.
    expect(suggestions('')).toEqual(ORDER_WORDS.slice(0, 6));
    expect(suggestions('').slice(0, 2)).toEqual(['when', 'my']);
    expect(applySuggestion('when my ran', 'ranger')).toBe('when my ranger ');
    for (const w of ['vanguard', 'guardian', 'invoker', 'assassin', 'protect', 'focus', 'hold', 'below']) expect(ORDER_WORDS).toContain(w);
  });

  it('can type a whole order the parser reads, with suggestions doing most of the work', () => {
    let text = '';
    for (const word of ['when', 'my', 'ranger', 'drops', 'below']) text = applySuggestion(text, word);
    for (const c of '40% ') text = pressKey(text, key(c === ' ' ? 'space' : c)).text;
    for (const word of ['guardians', 'protect', 'him']) text = applySuggestion(text, word);
    expect(text.trim()).toBe('when my ranger drops below 40% guardians protect him');
    expect(parseOrder(text.trim()).ok).toBe(true);
  });

  it('moves the cursor over the keys: wrapping across a row, landing under itself between rows', () => {
    expect(moveCursor({ row: 1, col: 0 }, -1, 0, 0)).toEqual({ row: 1, col: 9 });
    expect(moveCursor({ row: 1, col: 9 }, 1, 0, 0)).toEqual({ row: 1, col: 0 });
    // From the letters down to the wide keys: under the middle of q is the space bar.
    expect(moveCursor({ row: 3, col: 0 }, 0, 1, 0)).toEqual({ row: 4, col: 0 });
    expect(moveCursor({ row: 3, col: 9 }, 0, 1, 0)).toEqual({ row: 4, col: 3 });
    expect(moveCursor({ row: 4, col: 3 }, 0, 1, 0)).toEqual({ row: 4, col: 3 });
    // Up to the suggestions only when there are some.
    expect(moveCursor({ row: 0, col: 4 }, 0, -1, 0)).toEqual({ row: 0, col: 4 });
    expect(moveCursor({ row: 0, col: 9 }, 0, -1, 3)).toEqual({ row: -1, col: 2 });
    expect(moveCursor({ row: -1, col: 2 }, 1, 0, 3)).toEqual({ row: -1, col: 0 });
  });
});
