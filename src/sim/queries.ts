// Read-only questions about the battle that behaviors ask: who is near, who is hurt.

import { distance } from './geometry';
import type { BattleState, Side, Unit } from './types';

export function livingUnits(state: BattleState, side: Side): Unit[] {
  return state.units.filter((u) => u.alive && u.side === side);
}

export function livingEnemies(state: BattleState, unit: Unit): Unit[] {
  return state.units.filter((u) => u.alive && u.side !== unit.side);
}

/** Living enemies the unit can pick as a target: all but the invisible ones. */
export function visibleEnemies(state: BattleState, unit: Unit): Unit[] {
  return state.units.filter((u) => u.alive && u.side !== unit.side && u.invisibleTicks <= 0);
}

/** Living units on the same side, not counting the unit itself. */
export function livingAllies(state: BattleState, unit: Unit): Unit[] {
  return state.units.filter((u) => u.alive && u.side === unit.side && u.id !== unit.id);
}

export function findUnit(state: BattleState, id: number | null): Unit | undefined {
  if (id === null) return undefined;
  // Units are stored in id order starting at 1.
  const unit = state.units[id - 1];
  return unit && unit.id === id ? unit : state.units.find((u) => u.id === id);
}

export function centerDistance(a: Unit, b: Unit): number {
  return distance(a.x, a.y, b.x, b.y);
}

/** Gap between two unit bodies; attack ranges are measured this way. */
export function edgeDistance(a: Unit, b: Unit): number {
  return centerDistance(a, b) - a.stats.radius - b.stats.radius;
}

/** Share of max HP left, 0 to 1. */
export function hpShare(unit: Unit): number {
  return unit.hp / unit.stats.maxHp;
}

/** The unit closest to (x, y). Ties go to the lowest id. */
export function nearestTo<T extends Unit>(units: readonly T[], x: number, y: number): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const u of units) {
    const d = distance(u.x, u.y, x, y);
    if (d < bestDistance) {
      best = u;
      bestDistance = d;
    }
  }
  return best;
}

/** The unit with the lowest share of HP left. Ties go to the lowest id. */
export function mostHurt<T extends Unit>(units: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const u of units) {
    if (!best || hpShare(u) < hpShare(best)) best = u;
  }
  return best;
}

/** How strongly the unit carries out its current card order: 1, or more after a Perfect timing. */
export function orderPower(unit: Unit): number {
  const order = unit.orders[0];
  return order?.started ? order.power : 1;
}
