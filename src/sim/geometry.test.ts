import { describe, expect, it } from 'vitest';
import { circleOverlapsRect, segmentCrossesRect, snap } from './geometry';

const box = { x: 10, y: 10, w: 10, h: 10 };

describe('geometry', () => {
  it('finds segments that pass through a rectangle', () => {
    expect(segmentCrossesRect(0, 15, 30, 15, box)).toBe(true);
    expect(segmentCrossesRect(0, 0, 30, 30, box)).toBe(true);
    expect(segmentCrossesRect(15, 15, 40, 40, box)).toBe(true);
  });

  it('ignores segments that miss, stop short, or only graze an edge or corner', () => {
    expect(segmentCrossesRect(0, 0, 30, 0, box)).toBe(false);
    expect(segmentCrossesRect(0, 15, 9, 15, box)).toBe(false);
    expect(segmentCrossesRect(0, 10, 30, 10, box)).toBe(false);
    expect(segmentCrossesRect(0, 20, 20, 0, box)).toBe(false);
  });

  it('snaps positions to a 1/1024 grid, where a spot and its mirror image stay exact mirror images', () => {
    expect(snap(100.0004)).toBe(100);
    expect(snap(100.0006)).toBe(100 + 1 / 1024);
    // In floating point 960 - x is often not exactly the mirror image of x; snapped, it is. A value
    // exactly halfway goes to the even grid point, so its mirror image goes to the mirrored one.
    for (const x of [123.456789, 0.1, 333 + 3 / 2048, 333 + 5 / 2048]) expect(snap(960 - x)).toBe(960 - snap(x));
  });

  it('finds circles that overlap a rectangle', () => {
    expect(circleOverlapsRect(5, 15, 6, box)).toBe(true);
    expect(circleOverlapsRect(5, 15, 5, box)).toBe(false);
    expect(circleOverlapsRect(15, 15, 1, box)).toBe(true);
  });
});
