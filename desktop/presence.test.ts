import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESENCE_TEXT, presenceText } from './presence';

// The game's own test checks this file has every line the game sends, with its words.
const richPresence = readFileSync(path.join(import.meta.dirname, '..', 'docs', 'store', 'steam', 'rich-presence-english.vdf'), 'utf8');

describe('presence as text, for stores that take finished words (Epic)', () => {
  it('says the same as the rich presence file Steam keeps, line for line', () => {
    const tokens = [...richPresence.matchAll(/"#(\w+)"\s+"([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(Object.entries(PRESENCE_TEXT)).toEqual(tokens);
  });

  it('fills in the words, and drops a line it doesn’t know or one missing its words', () => {
    expect(presenceText({ line: 'Boss', params: { ruler: 'The Warlord', region: 'Red Canyon' } }, 255)).toBe('Facing The Warlord in Red Canyon');
    expect(presenceText({ line: 'Capital', params: {} }, 255)).toBe('In the Capital');
    expect(presenceText({ line: 'Run', params: {} }, 255)).toBeNull();
    expect(presenceText({ line: 'Shopping', params: {} }, 255)).toBeNull();
    expect(presenceText({ line: 'Run', params: { region: 'x'.repeat(300) } }, 255)).toHaveLength(255);
  });

  it('never reads words from the object’s prototype', () => {
    expect(presenceText({ line: 'toString', params: {} }, 255)).toBeNull();
    expect(presenceText({ line: 'Run', params: Object.create({ region: 'Red Canyon' }) as Record<string, string> }, 255)).toBeNull();
  });
});
