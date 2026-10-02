// Plane geometry for the battle engine: basic arithmetic and Math.sqrt only.

import type { Rect } from '../data/maps';

export interface Point {
  x: number;
  y: number;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** True if the segment from a to b passes within `radius` of the point c. */
export function segmentNearCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(((cx - ax) * dx + (cy - ay) * dy) / lengthSquared, 0, 1);
  const px = ax + dx * t - cx;
  const py = ay + dy * t - cy;
  return px * px + py * py < radius * radius;
}

/** Grows a rectangle by `by` on every side. */
export function inflateRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

/** True if the point is strictly inside the rectangle (touching an edge doesn't count). */
export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}

/** True if a circle overlaps the rectangle (touching doesn't count). */
export function circleOverlapsRect(cx: number, cy: number, radius: number, r: Rect): boolean {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * True if the segment from a to b passes through the inside of the rectangle.
 * Grazing a corner or running along an edge doesn't count, so paths can hug walls.
 */
export function segmentCrossesRect(ax: number, ay: number, bx: number, by: number, r: Rect): boolean {
  return segmentEntry(ax, ay, bx, by, r) !== null;
}

/**
 * How far along the segment from a to b (0 at a, 1 at b) it first enters the inside of
 * the rectangle, or null if it never does. Grazing an edge or corner doesn't count.
 */
export function segmentEntry(ax: number, ay: number, bx: number, by: number, r: Rect): number | null {
  let tMin = 0;
  let tMax = 1;
  const axes: [number, number, number, number][] = [
    [ax, bx - ax, r.x, r.x + r.w],
    [ay, by - ay, r.y, r.y + r.h],
  ];
  for (const [start, delta, lo, hi] of axes) {
    if (delta === 0) {
      if (start <= lo || start >= hi) return null;
      continue;
    }
    let t1 = (lo - start) / delta;
    let t2 = (hi - start) / delta;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin >= tMax) return null;
  }
  return tMin;
}
