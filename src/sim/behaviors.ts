// How each troop class decides what to do on its own.
//
// Every living unit first decides (an Intent) by looking at the battle as it stood at the
// start of the tick; only then do all units act. That way no unit sees another unit's move
// from the same tick, and the order units are listed in doesn't favor either side.

import { UNIT_CLASSES } from '../data/units';
import { BATTLE_RULES } from '../data/battle';
import { clamp, distance, type Point } from './geometry';
import { slideMove, stepAwayFrom, stepLength } from './movement';
import {
  centerDistance,
  edgeDistance,
  hpShare,
  livingAllies,
  livingEnemies,
  mostHurt,
  nearestTo,
} from './queries';
import { shoveTargets } from './skills';
import type { BattleState, Unit } from './types';

export type Action =
  | { kind: 'hold' }
  | { kind: 'walk'; to: Point; targetId: number | null }
  | { kind: 'backAway'; from: Point; targetId: number }
  | { kind: 'attack'; targetId: number };

export type SkillCast =
  | { skill: 'shove' }
  | { skill: 'mark'; targetId: number }
  | { skill: 'barrier'; targetId: number };

export interface Intent {
  action: Action;
  cast: SkillCast | null;
}

const HOLD: Intent = { action: { kind: 'hold' }, cast: null };

export function think(state: BattleState, unit: Unit): Intent {
  switch (unit.cls) {
    case 'vanguard':
      return thinkVanguard(state, unit);
    case 'ranger':
      return thinkRanger(state, unit);
    case 'guardian':
      return thinkGuardian(state, unit);
  }
}

/** Attack the target if it is in reach, otherwise walk toward it. */
function attackOrApproach(unit: Unit, target: Unit): Action {
  if (edgeDistance(unit, target) <= unit.stats.range) return { kind: 'attack', targetId: target.id };
  return { kind: 'walk', to: { x: target.x, y: target.y }, targetId: target.id };
}

/**
 * Vanguard: holds the front and protects the nearest ally.
 * It keeps fighting any enemy already in reach, preferring the one closest to its nearest
 * ally. Otherwise it goes for the enemy closest to that ally: whoever threatens the ally,
 * or else the enemy front. Shoves whenever enemies are close and the skill is ready.
 */
export function thinkVanguard(state: BattleState, unit: Unit): Intent {
  const enemies = livingEnemies(state, unit);
  if (enemies.length === 0) return HOLD;
  const cast = unit.skillCooldown <= 0 && shoveTargets(state, unit).length > 0 ? { skill: 'shove' as const } : null;

  const inReach = enemies.filter((e) => edgeDistance(unit, e) <= unit.stats.range);
  const ally = nearestTo(livingAllies(state, unit), unit.x, unit.y);
  const threat = ally ? nearestTo(enemies, ally.x, ally.y) : undefined;
  const target =
    (threat && inReach.includes(threat) ? threat : nearestTo(inReach, unit.x, unit.y)) ??
    threat ??
    nearestTo(enemies, unit.x, unit.y)!;
  return { action: attackOrApproach(unit, target), cast };
}

/**
 * Ranger: keeps max range and shoots the nearest threat.
 * When an enemy gets too close it backs away and can't shoot meanwhile; once cornered
 * against a wall or the map edge it stands and shoots. Marks its target when the skill is ready.
 */
export function thinkRanger(state: BattleState, unit: Unit): Intent {
  const enemies = livingEnemies(state, unit);
  const threat = nearestTo(enemies, unit.x, unit.y);
  if (!threat) return HOLD;
  const gap = edgeDistance(unit, threat);

  if (gap < UNIT_CLASSES.ranger.behavior.retreatDistance) {
    const step = stepAwayFrom(unit, threat);
    if (step) {
      const to = slideMove(state.map, unit.x, unit.y, unit.stats.radius, step.x, step.y);
      const moved = distance(unit.x, unit.y, to.x, to.y);
      if (moved >= stepLength(unit) * BATTLE_RULES.corneredMoveShare) {
        return { action: { kind: 'backAway', from: { x: threat.x, y: threat.y }, targetId: threat.id }, cast: null };
      }
    }
  }

  const action = attackOrApproach(unit, threat);
  const cast =
    action.kind === 'attack' && unit.skillCooldown <= 0 && !threat.mark
      ? { skill: 'mark' as const, targetId: threat.id }
      : null;
  return { action, cast };
}

/**
 * Guardian: stays near the most hurt ally, on the side away from the enemy closest to that ally,
 * and shoots enemies in reach while it is there. Gives a Barrier to the most hurt ally in range
 * that has none yet (never to itself).
 */
export function thinkGuardian(state: BattleState, unit: Unit): Intent {
  const enemies = livingEnemies(state, unit);
  if (enemies.length === 0) return HOLD;
  const allies = livingAllies(state, unit);
  const cast = chooseBarrierTarget(unit, allies);

  const ward = mostHurt(allies);
  if (ward) {
    const danger = nearestTo(enemies, ward.x, ward.y)!;
    const spot = guardSpot(state, unit, ward, danger);
    if (distance(unit.x, unit.y, spot.x, spot.y) > UNIT_CLASSES.guardian.behavior.followSlack) {
      return { action: { kind: 'walk', to: spot, targetId: ward.id }, cast };
    }
  }

  const target = nearestTo(enemies, unit.x, unit.y)!;
  if (edgeDistance(unit, target) <= unit.stats.range) return { action: { kind: 'attack', targetId: target.id }, cast };
  if (!ward) return { action: attackOrApproach(unit, target), cast };
  return { action: { kind: 'hold' }, cast };
}

function chooseBarrierTarget(guardian: Unit, allies: Unit[]): SkillCast | null {
  if (guardian.skillCooldown > 0) return null;
  const barrier = UNIT_CLASSES.guardian.barrier;
  const candidates = allies.filter(
    (u) => !u.barrier && hpShare(u) < barrier.hpThreshold && centerDistance(guardian, u) <= barrier.range,
  );
  const target = mostHurt(candidates);
  return target ? { skill: 'barrier', targetId: target.id } : null;
}

/** Where the Guardian wants to stand: just behind its ward, as seen from the enemy nearest to the ward. */
function guardSpot(state: BattleState, guardian: Unit, ward: Unit, danger: Unit): Point {
  const d = distance(ward.x, ward.y, danger.x, danger.y);
  const awayX = d === 0 ? (guardian.side === 'player' ? -1 : 1) : (ward.x - danger.x) / d;
  const awayY = d === 0 ? 0 : (ward.y - danger.y) / d;
  const offset = UNIT_CLASSES.guardian.behavior.followDistance + ward.stats.radius + guardian.stats.radius;
  const r = guardian.stats.radius;
  return {
    x: clamp(ward.x + awayX * offset, r, state.map.width - r),
    y: clamp(ward.y + awayY * offset, r, state.map.height - r),
  };
}
