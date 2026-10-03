// Walls block movement and shots, like a shield: every shot that would cross a wall hits
// it instead and wears it down. A wall with no HP left breaks and stops blocking anything,
// and every unit plans its path again.

import { BATTLE_RULES } from '../data/battle';
import { UNIT_CLASSES } from '../data/units';
import { segmentEntry } from './geometry';
import { buildNavGraph } from './navigation';
import { overtimeMultiplier } from './overtime';
import type { BattleState, Wall } from './types';

export function standingWalls(state: BattleState): Wall[] {
  return state.walls.filter((w) => w.hp > 0);
}

/** Room kept between walls and the paths units plan: the largest body plus some margin. */
export function navClearance(): number {
  const maxRadius = Math.max(...Object.values(UNIT_CLASSES).map((c) => c.stats.radius));
  return maxRadius + BATTLE_RULES.navigation.wallClearance;
}

/** Rebuilds the path graph from the walls still standing, and makes every unit plan again. */
export function rebuildNav(state: BattleState): void {
  state.nav = buildNavGraph(state.map.width, state.map.height, standingWalls(state), navClearance());
  for (const unit of state.units) unit.path = [];
}

/**
 * The first of these walls the segment from a to b runs into, if any. Ties go to the lower id.
 * Shots pass the walls that stood when the tick's shots started flying (see updateProjectiles).
 */
export function firstWallOnSegment(walls: readonly Wall[], ax: number, ay: number, bx: number, by: number): Wall | undefined {
  let hit: Wall | undefined;
  let hitAt = Infinity;
  for (const wall of walls) {
    const t = segmentEntry(ax, ay, bx, by, wall);
    if (t !== null && t < hitAt) {
      hit = wall;
      hitAt = t;
    }
  }
  return hit;
}

/** A shot hits a wall. Writes a wallHit event, and a wallBreak event if the wall breaks. */
export function damageWall(state: BattleState, wall: Wall, sourceId: number, raw: number): void {
  if (wall.hp <= 0) return;
  const amount = Math.min(wall.hp, Math.max(BATTLE_RULES.minDamage, Math.round(raw * overtimeMultiplier(state.tick))));
  wall.hp -= amount;
  state.events.push({ tick: state.tick, type: 'wallHit', wallId: wall.id, sourceId, amount });
  if (wall.hp > 0) return;
  state.events.push({ tick: state.tick, type: 'wallBreak', wallId: wall.id, sourceId });
  rebuildNav(state);
}
