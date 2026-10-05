// The on-screen keyboard for typing orders with a controller (session 6C). Pure: the layout,
// the cursor moving over it, what a key press does to the text, and the words it suggests,
// which come from the rule parser's own vocabulary (src/cards/vocabulary.ts), so they are words
// an order can use. The Orders screen draws it (src/game/oskView.ts).

import * as vocabulary from '../cards/vocabulary';

/** Keys that do something other than type their letter. */
export type SpecialKey = 'space' | 'delete' | 'read' | 'done';

export interface OskKey {
  /** What the key shows. */
  label: string;
  /** Typed text, or a special key. */
  type: string | { special: SpecialKey };
  /** How many letter widths wide it is. */
  width: number;
}

const letters = (row: string): OskKey[] => [...row].map((c) => ({ label: c, type: c, width: 1 }));

/** The keys, row by row: numbers, three rows of letters (with % and punctuation), then the wide keys. */
export const OSK_ROWS: readonly (readonly OskKey[])[] = [
  letters('1234567890'),
  letters('qwertyuiop'),
  letters('asdfghjkl%'),
  letters("zxcvbnm,.'"),
  [
    { label: 'space', type: { special: 'space' }, width: 4 },
    { label: '⌫ delete', type: { special: 'delete' }, width: 2 },
    { label: 'read order', type: { special: 'read' }, width: 2 },
    { label: 'done', type: { special: 'done' }, width: 2 },
  ],
];

/** Where the cursor is: a suggestion (row -1) or a key. */
export interface OskCursor {
  row: number;
  col: number;
}

export const OSK_RULES = {
  maxLength: 200,
  suggestions: 6,
} as const;

/** Every word the parser knows (lower case, letters only), most useful first. */
export const ORDER_WORDS: readonly string[] = (() => {
  const words = new Set<string>();
  const add = (phrase: string) => {
    for (const w of phrase.toLowerCase().split(/[^a-z']+/)) if (w.length >= 2) words.add(w);
  };
  for (const value of Object.values(vocabulary)) {
    if (Array.isArray(value)) value.forEach((v) => typeof v === 'string' && add(v));
    else if (value instanceof Set) value.forEach((v) => typeof v === 'string' && add(v));
    else if (value && typeof value === 'object') Object.keys(value).forEach(add);
  }
  // The words orders use most come first, then the rest from short to long.
  const common = ['when', 'my', 'their', 'protect', 'focus', 'then', 'hold', 'everyone', 'below', 'ranger', 'vanguard', 'guardian', 'invoker', 'assassin', 'fall', 'back', 'attack', 'shield'];
  const rest = [...words].filter((w) => !common.includes(w)).sort((a, b) => a.length - b.length || a.localeCompare(b));
  return [...common.filter((w) => words.has(w)), ...rest];
})();

/** The word being typed: the letters after the last space. */
export function partialWord(text: string): string {
  return /([a-z']*)$/i.exec(text)?.[1]?.toLowerCase() ?? '';
}

/** Words to offer: ones that finish the word being typed, or common first words after a space. */
export function suggestions(text: string, words: readonly string[] = ORDER_WORDS): string[] {
  const partial = partialWord(text);
  if (partial === '') return words.slice(0, OSK_RULES.suggestions);
  return words.filter((w) => w.startsWith(partial) && w !== partial).slice(0, OSK_RULES.suggestions);
}

/** The text with the word being typed finished as `word`, and a space after it. */
export function applySuggestion(text: string, word: string): string {
  const partial = partialWord(text);
  return clip(`${text.slice(0, text.length - partial.length)}${word} `);
}

function clip(text: string): string {
  return text.slice(0, OSK_RULES.maxLength);
}

/** What pressing a key does: the new text, and whether the player asked to read the order or close. */
export function pressKey(text: string, key: OskKey): { text: string; read?: boolean; close?: boolean } {
  if (typeof key.type === 'string') return { text: clip(text + key.type) };
  switch (key.type.special) {
    case 'space':
      return { text: text === '' || text.endsWith(' ') ? text : clip(`${text} `) };
    case 'delete':
      return { text: text.slice(0, -1) };
    case 'read':
      return { text, read: true, close: true };
    case 'done':
      return { text, close: true };
  }
}

/** The left edge of each key in a row, in letter widths, for moving between rows of different shapes. */
function keyStarts(row: readonly OskKey[]): number[] {
  const starts: number[] = [];
  let x = 0;
  for (const key of row) {
    starts.push(x);
    x += key.width;
  }
  return starts;
}

/** The key in `row` under the middle of key `col` of `fromRow`. */
function keyBelow(fromRow: readonly OskKey[], col: number, row: readonly OskKey[]): number {
  const middle = keyStarts(fromRow)[col]! + fromRow[col]!.width / 2;
  const starts = keyStarts(row);
  let best = 0;
  starts.forEach((start, i) => {
    if (start <= middle) best = i;
  });
  return best;
}

/**
 * The cursor moved one step: left and right wrap within a row; up and down move between rows,
 * landing on the key under the cursor. Row -1 is the suggestion row, there only when it has words.
 */
export function moveCursor(cursor: OskCursor, dx: number, dy: number, suggestionCount: number): OskCursor {
  const top = suggestionCount > 0 ? -1 : 0;
  if (dy !== 0) {
    const row = Math.max(top, Math.min(OSK_ROWS.length - 1, cursor.row + dy));
    if (row === cursor.row) return cursor;
    if (row === -1) return { row, col: Math.min(cursor.col, suggestionCount - 1) };
    if (cursor.row === -1) return { row, col: Math.min(cursor.col * 2, OSK_ROWS[row]!.length - 1) };
    return { row, col: keyBelow(OSK_ROWS[cursor.row]!, cursor.col, OSK_ROWS[row]!) };
  }
  const length = cursor.row === -1 ? suggestionCount : OSK_ROWS[cursor.row]!.length;
  if (length === 0) return cursor;
  return { row: cursor.row, col: (cursor.col + dx + length) % length };
}
