import { describe, expect, it } from 'vitest';
import { buildNavGraph, findPath, isLineClear } from './navigation';
import { openMap } from './testing/fixtures';

const wall = { x: 400, y: 100, w: 50, h: 400 };

describe('navigation', () => {
  it('sees when a wall blocks the straight line', () => {
    const nav = buildNavGraph(openMap([wall]), 18);
    expect(isLineClear(nav, 300, 300, 600, 300)).toBe(false);
    expect(isLineClear(nav, 300, 50, 600, 50)).toBe(true);
  });

  it('needs no path when the way is clear', () => {
    const nav = buildNavGraph(openMap([wall]), 18);
    expect(findPath(nav, { x: 300, y: 550 }, { x: 600, y: 550 })).toEqual([]);
  });

  it('finds the shorter way around a wall, through its corners', () => {
    const nav = buildNavGraph(openMap([wall]), 18);
    const start = { x: 300, y: 200 };
    const goal = { x: 600, y: 200 };
    const path = findPath(nav, start, goal);
    expect(path.length).toBe(2);
    // The wall's top is nearer than its bottom, so the path goes over the top.
    for (const corner of path) expect(corner.y).toBeLessThan(wall.y);
    const points = [start, ...path, goal];
    for (let i = 1; i < points.length; i++) {
      expect(isLineClear(nav, points[i - 1]!.x, points[i - 1]!.y, points[i]!.x, points[i]!.y)).toBe(true);
    }
  });

  it('returns no path when the goal is walled in', () => {
    const walls = [
      { x: 600, y: 200, w: 200, h: 20 },
      { x: 600, y: 380, w: 200, h: 20 },
      { x: 600, y: 200, w: 20, h: 200 },
      { x: 780, y: 200, w: 20, h: 200 },
    ];
    const nav = buildNavGraph(openMap(walls), 18);
    expect(findPath(nav, { x: 100, y: 300 }, { x: 700, y: 300 })).toEqual([]);
  });
});
