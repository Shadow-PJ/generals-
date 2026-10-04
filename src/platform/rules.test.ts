// Guard for rule 7 in CLAUDE.md: game code never talks to Electron, a store, the file system,
// browser storage or the microphone directly; only src/platform does.

import { describe, expect, it } from 'vitest';

const gameFiles = import.meta.glob(['../**/*.ts', '!./**', '!../**/*.test.ts', '!../**/testing/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Source without comments, so rules mentioned in comments don't count. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const FORBIDDEN = [
  /\belectron\b/i,
  /generalsDesktop/,
  /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/,
  /requestFullscreen|exitFullscreen/,
  /from\s+['"](node:|fs|path|child_process)/,
  /\bsteam/i,
  // The Epic Games Store and its online services; "Epic" alone is also a rarity (session 5B).
  /\bepic[\s_-]*(games|store|online|services|launcher|sdk)|\beos[\s_-]*sdk/i,
  /SpeechRecognition|getUserMedia/,
];

describe('platform rule', () => {
  it('checks every game file outside src/platform', () => {
    expect(Object.keys(gameFiles).length).toBeGreaterThan(40);
    expect(Object.keys(gameFiles).some((f) => f.includes('/platform/'))).toBe(false);
  });

  for (const [file, source] of Object.entries(gameFiles)) {
    it(`${file} reaches the computer only through src/platform`, () => {
      const body = code(source);
      for (const pattern of FORBIDDEN) expect(body).not.toMatch(pattern);
    });
  }
});
