import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, nextUint32 } from './rng';

function firstNumbers(seed: number, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => nextUint32(rng));
}

describe('seeded random numbers', () => {
  it('gives the same sequence for the same seed', () => {
    expect(firstNumbers(42, 100)).toEqual(firstNumbers(42, 100));
  });

  it('gives different sequences for different seeds, even neighbors', () => {
    expect(firstNumbers(42, 10)).not.toEqual(firstNumbers(43, 10));
    expect(firstNumbers(0, 10)).not.toEqual(firstNumbers(1, 10));
  });

  it('keeps a known sequence, so replays stay valid across versions', () => {
    // If this fails, the generator changed and every saved replay would break.
    expect(firstNumbers(42, 3)).toMatchInlineSnapshot(`
      [
        1601493291,
        3055293090,
        3930772717,
      ]
    `);
  });

  it('keeps its state as plain data that can be copied mid-sequence', () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) nextUint32(rng);
    const copy = JSON.parse(JSON.stringify(rng));
    expect(Array.from({ length: 20 }, () => nextUint32(copy))).toEqual(
      Array.from({ length: 20 }, () => nextUint32(rng)),
    );
  });

  it('returns floats in [0, 1) spread evenly', () => {
    const rng = createRng(123);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const value = nextFloat(rng);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      sum += value;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });

  it('returns whole numbers in [0, n)', () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(nextInt(rng, 6));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
