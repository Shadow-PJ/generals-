// Guards for the engine rules in CLAUDE.md: the battle engine stays deterministic and
// never depends on the renderer.

import { describe, expect, it } from 'vitest';

const engineFiles = import.meta.glob(['./**/*.ts', '../data/**/*.ts', '!./**/*.test.ts', '!../data/**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ALLOWED_MATH = new Set(['sqrt', 'floor', 'round', 'abs', 'min', 'max']);

/** Source without comments, so rules mentioned in comments don't count. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('engine rules', () => {
  it('checks every engine and data file', () => {
    expect(Object.keys(engineFiles).length).toBeGreaterThan(10);
  });

  for (const [file, source] of Object.entries(engineFiles)) {
    describe(file, () => {
      const body = code(source);

      it('uses only Math functions that give the same result in every browser', () => {
        const used = [...body.matchAll(/\bMath\.(\w+)/g)].map((m) => m[1]!);
        expect(used.filter((name) => !ALLOWED_MATH.has(name))).toEqual([]);
      });

      it('never reads a clock or unseeded randomness', () => {
        expect(body).not.toMatch(/\bDate\b|\bperformance\b|\bsetTimeout\b|\bsetInterval\b|\bcrypto\b/);
        expect(body).not.toMatch(/requestAnimationFrame/);
      });

      it('never imports Phaser, the game folder, or Node modules', () => {
        const imports = [...body.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
        for (const path of imports) {
          expect(path).not.toMatch(/phaser|\/game\b|^node:|^fs$|^path$/);
        }
      });
    });
  }
});
