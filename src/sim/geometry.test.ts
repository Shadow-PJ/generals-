import { describe, expect, it } from 'vitest';
import { circleOverlapsRect, segmentCrossesRect } from './geometry';

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

  it('finds circles that overlap a rectangle', () => {
    expect(circleOverlapsRect(5, 15, 6, box)).toBe(true);
    expect(circleOverlapsRect(5, 15, 5, box)).toBe(false);
    expect(circleOverlapsRect(15, 15, 1, box)).toBe(true);
  });
});
