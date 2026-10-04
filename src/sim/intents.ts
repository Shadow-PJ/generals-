// What a troop decides to do in a tick (an Intent), and small helpers to build one. Troops
// decide on their own (behaviors.ts), by their General's doctrine (doctrine.ts), or by a card
// order (orders.ts).

import { BATTLE_RULES } from '../data/battle';
import { distance, type Point } from './geometry';
import { slideMove, stepAwayFrom, stepLength } from './movement';
import { edgeDistance, findUnit } from './queries';
import type { BattleState, Unit } from './types';
import { firstWallOnSegment } from './walls';

export type Action =
  | { kind: 'hold' }
  | { kind: 'walk'; to: Point; targetId: number | null }
  | { kind: 'backAway'; from: Point; targetId: number }
  | { kind: 'attack'; targetId: number };

export type SkillCast =
  | { skill: 'shove' }
  | { skill: 'mark'; targetId: number }
  | { skill: 'barrier'; targetId: number }
  | { skill: 'rift'; at: Point }
  | { skill: 'shadowstep'; targetId: number };

export interface Intent {
  action: Action;
  cast: SkillCast | null;
}

export const HOLD: Intent = { action: { kind: 'hold' }, cast: null };

/** Attack the target if it is in reach, otherwise walk toward it. */
export function attackOrApproach(unit: Unit, target: Unit): Action {
  if (edgeDistance(unit, target) <= unit.stats.range) return { kind: 'attack', targetId: target.id };
  return { kind: 'walk', to: { x: target.x, y: target.y }, targetId: target.id };
}

/**
 * A ranged troop backs away from an enemy closer than `retreatDistance`, and can't shoot meanwhile.
 * Null when the enemy is far enough, or the troop is cornered against a wall or the map edge.
 */
export function backAway(state: BattleState, unit: Unit, threat: Unit, retreatDistance: number): Action | null {
  if (edgeDistance(unit, threat) >= retreatDistance) return null;
  const step = stepAwayFrom(unit, threat);
  if (!step) return null;
  const to = slideMove(state, unit.x, unit.y, unit.stats.radius, step.x, step.y);
  const moved = distance(unit.x, unit.y, to.x, to.y);
  if (moved < stepLength(unit) * BATTLE_RULES.corneredMoveShare) return null;
  return { kind: 'backAway', from: { x: threat.x, y: threat.y }, targetId: threat.id };
}

/**
 * A ranged troop whose shot would only hit rock or iron that never breaks (Red Canyon, Iron
 * Fortress) walks toward its target instead, to find a clear line. Shots at walls that break
 * still go ahead: they wear the wall down.
 */
export function aroundRock(state: BattleState, unit: Unit, intent: Intent): Intent {
  const action = intent.action;
  if (action.kind !== 'attack' || unit.stats.projectileSpeed <= 0) return intent;
  const target = findUnit(state, action.targetId);
  if (!target || !firstWallOnSegment(state, unit.x, unit.y, target.x, target.y)?.unbreakable) return intent;
  return { ...intent, action: { kind: 'walk', to: { x: target.x, y: target.y }, targetId: target.id } };
}
