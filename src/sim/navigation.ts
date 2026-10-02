// Walking around walls.
//
// Each wall is grown by the largest unit radius plus some clearance. A unit walks straight
// to its goal when nothing blocks the line; otherwise it follows the shortest path through
// the corners of the grown walls (a visibility graph). With a few walls on a map this is
// a handful of nodes, so planning is cheap and the paths are smooth.

import type { MapData, Rect } from '../data/maps';
import { distance, inflateRect, pointInRect, segmentCrossesRect, type Point } from './geometry';

/** How far outside a grown wall its corner nodes sit, so they never touch it. */
const CORNER_OFFSET = 1;

export interface NavGraph {
  /** The walls themselves. */
  walls: Rect[];
  /** Walls grown by the clearance; paths avoid these. */
  blockers: Rect[];
  /** Corners of the blockers that units can walk to. */
  corners: Point[];
}

export function buildNavGraph(map: MapData, clearance: number): NavGraph {
  const walls = map.walls.map((w) => ({ ...w }));
  const blockers = walls.map((w) => inflateRect(w, clearance));
  const corners: Point[] = [];
  for (const b of blockers) {
    const candidates: Point[] = [
      { x: b.x - CORNER_OFFSET, y: b.y - CORNER_OFFSET },
      { x: b.x + b.w + CORNER_OFFSET, y: b.y - CORNER_OFFSET },
      { x: b.x - CORNER_OFFSET, y: b.y + b.h + CORNER_OFFSET },
      { x: b.x + b.w + CORNER_OFFSET, y: b.y + b.h + CORNER_OFFSET },
    ];
    for (const c of candidates) {
      const inMap = c.x >= clearance && c.y >= clearance && c.x <= map.width - clearance && c.y <= map.height - clearance;
      if (inMap && !blockers.some((other) => pointInRect(c.x, c.y, other))) corners.push(c);
    }
  }
  return { walls, blockers, corners };
}

/**
 * True if a unit can walk straight from a to b.
 * A unit already standing inside a grown wall (pressed against the wall) is only stopped
 * by the wall itself, so it can step away along the wall.
 */
export function isLineClear(nav: NavGraph, ax: number, ay: number, bx: number, by: number): boolean {
  for (let i = 0; i < nav.blockers.length; i++) {
    const blocker = nav.blockers[i]!;
    const endpointInside = pointInRect(ax, ay, blocker) || pointInRect(bx, by, blocker);
    const shape = endpointInside ? nav.walls[i]! : blocker;
    if (segmentCrossesRect(ax, ay, bx, by, shape)) return false;
  }
  return true;
}

/**
 * Corners to walk through, in order, to get from start to goal (the goal itself not included).
 * Returns an empty list when the line is clear or when no path exists.
 */
export function findPath(nav: NavGraph, start: Point, goal: Point): Point[] {
  if (isLineClear(nav, start.x, start.y, goal.x, goal.y)) return [];

  // Dijkstra over [start, ...corners, goal]. Ties go to the lower index, so results are stable.
  const nodes: Point[] = [start, ...nav.corners, goal];
  const goalIndex = nodes.length - 1;
  const best: number[] = nodes.map(() => Infinity);
  const previous: number[] = nodes.map(() => -1);
  const done: boolean[] = nodes.map(() => false);
  best[0] = 0;

  for (;;) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!done[i] && best[i]! < Infinity && (current === -1 || best[i]! < best[current]!)) current = i;
    }
    if (current === -1 || current === goalIndex) break;
    done[current] = true;
    const from = nodes[current]!;
    for (let next = 0; next < nodes.length; next++) {
      if (done[next]) continue;
      const to = nodes[next]!;
      if (!isLineClear(nav, from.x, from.y, to.x, to.y)) continue;
      const cost = best[current]! + distance(from.x, from.y, to.x, to.y);
      if (cost < best[next]!) {
        best[next] = cost;
        previous[next] = current;
      }
    }
  }

  if (previous[goalIndex] === -1) return [];
  const path: Point[] = [];
  for (let i = previous[goalIndex]!; i > 0; i = previous[i]!) path.push({ ...nodes[i]! });
  return path.reverse();
}
