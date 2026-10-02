// Moving units: steps toward a goal around walls, backing away, knockback and keeping
// bodies from overlapping. Walls and the map edge always block movement.

import { BATTLE_RULES } from '../data/battle';
import type { MapData } from '../data/maps';
import { circleOverlapsRect, distance, type Point } from './geometry';
import { findPath, isLineClear } from './navigation';
import { secondsToTicks, TICKS_PER_SECOND } from './time';
import type { BattleState, Unit } from './types';

/** True if a body of this radius fits at (x, y): inside the map and touching no wall. */
export function isSpaceFree(map: MapData, x: number, y: number, radius: number): boolean {
  if (x < radius || y < radius || x > map.width - radius || y > map.height - radius) return false;
  for (const wall of map.walls) {
    if (circleOverlapsRect(x, y, radius, wall)) return false;
  }
  return true;
}

/**
 * Where a body ends up after trying to move by (dx, dy). If the full move is blocked
 * it slides along the wall on one axis; if both are blocked it stays put.
 */
export function slideMove(map: MapData, x: number, y: number, radius: number, dx: number, dy: number): Point {
  if (isSpaceFree(map, x + dx, y + dy, radius)) return { x: x + dx, y: y + dy };
  if (dx !== 0 && isSpaceFree(map, x + dx, y, radius)) return { x: x + dx, y };
  if (dy !== 0 && isSpaceFree(map, x, y + dy, radius)) return { x, y: y + dy };
  return { x, y };
}

export function moveUnitBy(state: BattleState, unit: Unit, dx: number, dy: number): void {
  const to = slideMove(state.map, unit.x, unit.y, unit.stats.radius, dx, dy);
  unit.x = to.x;
  unit.y = to.y;
}

/** Distance a unit covers in one tick. */
export function stepLength(unit: Unit): number {
  return unit.stats.moveSpeed / TICKS_PER_SECOND;
}

/** The point the unit should walk toward right now to reach the goal, going around walls. */
export function steer(state: BattleState, unit: Unit, goal: Point): Point {
  if (isLineClear(state.nav, unit.x, unit.y, goal.x, goal.y)) {
    unit.path = [];
    return goal;
  }
  if (unit.path.length === 0 || state.tick >= unit.repathTick) {
    unit.path = findPath(state.nav, { x: unit.x, y: unit.y }, goal);
    unit.repathTick = state.tick + secondsToTicks(BATTLE_RULES.navigation.repathSeconds);
  }
  const reached = BATTLE_RULES.navigation.waypointReachedDistance;
  while (unit.path.length > 0 && distance(unit.x, unit.y, unit.path[0]!.x, unit.path[0]!.y) <= reached) {
    unit.path.shift();
  }
  return unit.path[0] ?? goal;
}

/** Moves the unit one step toward the goal, around walls. */
export function walkToward(state: BattleState, unit: Unit, goal: Point): void {
  const waypoint = steer(state, unit, goal);
  const d = distance(unit.x, unit.y, waypoint.x, waypoint.y);
  if (d === 0) return;
  const step = Math.min(stepLength(unit), d);
  moveUnitBy(state, unit, ((waypoint.x - unit.x) / d) * step, ((waypoint.y - unit.y) / d) * step);
}

/** The step that takes the unit straight away from a point, or null if they stand on the same spot. */
export function stepAwayFrom(unit: Unit, from: Point): Point | null {
  const d = distance(unit.x, unit.y, from.x, from.y);
  if (d === 0) return null;
  const step = stepLength(unit);
  return { x: ((unit.x - from.x) / d) * step, y: ((unit.y - from.y) / d) * step };
}

/** Moves shoved units along their push; walls stop them. */
export function updateKnockbacks(state: BattleState): void {
  for (const unit of state.units) {
    if (!unit.alive || !unit.knockback) continue;
    moveUnitBy(state, unit, unit.knockback.dx, unit.knockback.dy);
    unit.knockback.ticksLeft -= 1;
    if (unit.knockback.ticksLeft <= 0) unit.knockback = null;
  }
}

/**
 * Pushes overlapping bodies apart, half each. Every push is worked out from the same
 * positions and then applied together, so the order units are listed in doesn't matter.
 * Two units on the exact same spot are split along the x axis, the lower id to the left.
 */
export function separateUnits(state: BattleState): void {
  const units = state.units;
  const pushX = units.map(() => 0);
  const pushY = units.map(() => 0);
  for (let i = 0; i < units.length; i++) {
    const a = units[i]!;
    if (!a.alive) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j]!;
      if (!b.alive) continue;
      const minGap = a.stats.radius + b.stats.radius;
      const d = distance(a.x, a.y, b.x, b.y);
      if (d >= minGap) continue;
      const nx = d === 0 ? 1 : (b.x - a.x) / d;
      const ny = d === 0 ? 0 : (b.y - a.y) / d;
      const push = (minGap - d) / 2;
      pushX[i]! -= nx * push;
      pushY[i]! -= ny * push;
      pushX[j]! += nx * push;
      pushY[j]! += ny * push;
    }
  }
  units.forEach((unit, i) => {
    if (pushX[i] !== 0 || pushY[i] !== 0) moveUnitBy(state, unit, pushX[i]!, pushY[i]!);
  });
}
