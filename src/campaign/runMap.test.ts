import { describe, expect, it } from 'vitest';
import { RUN_RULES } from '../data/runs';
import { createRng } from '../sim';
import { generateRunMap } from './runMap';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

describe('run maps', () => {
  it('are the same for the same seed', () => {
    expect(generateRunMap(createRng(42))).toEqual(generateRunMap(createRng(42)));
    expect(generateRunMap(createRng(42))).not.toEqual(generateRunMap(createRng(43)));
  });

  it('start with battles, rest before the boss, and end with the boss alone', () => {
    for (const seed of SEEDS) {
      const map = generateRunMap(createRng(seed));
      expect(map).toHaveLength(RUN_RULES.floors + 1);
      expect(map[0]!.every((n) => n.kind === 'battle')).toBe(true);
      expect(map[RUN_RULES.floors - 1]!.every((n) => n.kind === 'camp')).toBe(true);
      expect(map[RUN_RULES.floors]).toEqual([{ kind: 'boss', next: [] }]);
      expect(map[RUN_RULES.merchantFloor]!.some((n) => n.kind === 'merchant')).toBe(true);
      for (let f = 0; f < RUN_RULES.floors; f++) {
        expect(map[f]!.length).toBeGreaterThanOrEqual(RUN_RULES.minWidth);
        expect(map[f]!.length).toBeLessThanOrEqual(RUN_RULES.maxWidth);
        if (f > 0 && f < RUN_RULES.firstSpecialFloor) expect(map[f]!.every((n) => n.kind === 'battle' || n.kind === 'event')).toBe(true);
      }
    }
  });

  it('lead every node on and into every node, with no paths crossing', () => {
    for (const seed of SEEDS) {
      const map = generateRunMap(createRng(seed));
      for (let f = 0; f + 1 < map.length; f++) {
        const floor = map[f]!;
        const nextCount = map[f + 1]!.length;
        for (const node of floor) {
          expect(node.next.length).toBeGreaterThanOrEqual(1);
          expect([...node.next].sort((a, b) => a - b)).toEqual(node.next);
          expect(node.next.every((j) => j >= 0 && j < nextCount)).toBe(true);
        }
        for (let j = 0; j < nextCount; j++) expect(floor.some((n) => n.next.includes(j)), `seed ${seed} floor ${f + 1} node ${j}`).toBe(true);
        // No crossing: a node lower down never leads above a node higher up.
        for (let i = 0; i + 1 < floor.length; i++) {
          expect(Math.max(...floor[i]!.next)).toBeLessThanOrEqual(Math.min(...floor[i + 1]!.next));
        }
      }
    }
  });

  it('hold every kind of node across many runs', () => {
    const kinds = new Set(SEEDS.flatMap((seed) => generateRunMap(createRng(seed)).flat().map((n) => n.kind)));
    expect([...kinds].sort()).toEqual(['battle', 'boss', 'camp', 'elite', 'event', 'merchant']);
  });
});
