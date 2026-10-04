// How each troop class decides what to do on its own.
//
// Every living unit first decides (an Intent) by looking at the battle as it stood at the
// start of the tick; only then do all units act. That way no unit sees another unit's move
// from the same tick, and the order units are listed in doesn't favor either side.

import { UNIT_CLASSES } from '../data/units';
import { applyDoctrine } from './doctrine';
import { clamp, distance, type Point } from './geometry';
import { attackOrApproach, backAway, HOLD, type Intent, type SkillCast } from './intents';
import {
  centerDistance,
  edgeDistance,
  findUnit,
  hpShare,
  inForest,
  livingAllies,
  livingEnemies,
  mostHurt,
  nearestTo,
  visibleEnemies,
} from './queries';
import { riftSpot } from './rift';
import { choosePrey } from './shadowstep';
import { shoveTargets } from './skills';
import type { BattleState, Unit } from './types';

export type { Action, Intent, SkillCast } from './intents';

/** What the troop does on its own: its class behavior, as its General's doctrine bends it. */
export function think(state: BattleState, unit: Unit): Intent {
  return applyDoctrine(state, unit, classIntent(state, unit));
}

function classIntent(state: BattleState, unit: Unit): Intent {
  switch (unit.cls) {
    case 'vanguard':
      return thinkVanguard(state, unit);
    case 'ranger':
      return thinkRanger(state, unit);
    case 'guardian':
      return thinkGuardian(state, unit);
    case 'invoker':
      return thinkInvoker(state, unit);
    case 'assassin':
      return thinkAssassin(state, unit);
  }
}

/**
 * A taunted troop must attack its taunter (Warden, Iron Wall), whatever it or a card wanted;
 * null when it isn't taunted, or the taunter is gone.
 */
export function tauntIntent(state: BattleState, unit: Unit): Intent | null {
  if (!unit.taunt) return null;
  const taunter = findUnit(state, unit.taunt.unitId);
  if (!taunter?.alive || taunter.invisibleTicks > 0 || taunter.hijackTicks > 0) return null;
  return { action: attackOrApproach(unit, taunter), cast: null };
}

/**
 * Nobody in sight: walk toward the nearest enemy hiding in the woods (Deep Forest) to find it;
 * it can be attacked once seen. With no one hiding there (only invisible enemies), stand.
 */
function search(state: BattleState, unit: Unit): Intent {
  const hiding = livingEnemies(state, unit).filter((e) => e.invisibleTicks <= 0 && inForest(state, e));
  const nearest = nearestTo(hiding, unit.x, unit.y);
  return nearest ? { action: { kind: 'walk', to: { x: nearest.x, y: nearest.y }, targetId: null }, cast: null } : HOLD;
}

/**
 * Vanguard: holds the front and protects the nearest ally.
 * It keeps fighting any enemy already in reach, preferring the one closest to its nearest
 * ally. Otherwise it goes for the enemy closest to that ally: whoever threatens the ally,
 * or else the enemy front. Shoves whenever enemies are close and the skill is ready.
 */
export function thinkVanguard(state: BattleState, unit: Unit): Intent {
  const enemies = visibleEnemies(state, unit);
  if (enemies.length === 0) return search(state, unit);
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
  const threat = nearestTo(visibleEnemies(state, unit), unit.x, unit.y);
  if (!threat) return search(state, unit);
  const away = backAway(state, unit, threat, UNIT_CLASSES.ranger.behavior.retreatDistance);
  if (away) return { action: away, cast: null };

  const action = attackOrApproach(unit, threat);
  const cast =
    action.kind === 'attack' && unit.skillCooldown <= 0 && !threat.mark
      ? { skill: 'mark' as const, targetId: threat.id }
      : null;
  return { action, cast };
}

/**
 * Invoker: keeps its distance like a Ranger and attacks the nearest enemy, and casts a Rift at
 * the biggest group of enemies in reach when the skill is ready. It stands still while casting,
 * so it only starts a cast when no enemy is pressing it.
 */
export function thinkInvoker(state: BattleState, unit: Unit): Intent {
  const threat = nearestTo(visibleEnemies(state, unit), unit.x, unit.y);
  if (!threat) return search(state, unit);
  const away = backAway(state, unit, threat, UNIT_CLASSES.invoker.behavior.retreatDistance);
  if (away) return { action: away, cast: null };
  const spot = unit.skillCooldown <= 0 ? riftSpot(state, unit) : null;
  if (spot) return { action: { kind: 'hold' }, cast: { skill: 'rift', at: spot } };
  return { action: attackOrApproach(unit, threat), cast: null };
}

/**
 * Assassin: hunts Guardians first, then the other backline troops, then the weakest enemy, and
 * Shadowsteps behind its prey as soon as the skill is ready and the prey is in reach of it.
 */
export function thinkAssassin(state: BattleState, unit: Unit): Intent {
  const prey = choosePrey(state, unit);
  if (!prey) return search(state, unit);
  const ready = unit.skillCooldown <= 0 && centerDistance(unit, prey) <= UNIT_CLASSES.assassin.shadowstep.range;
  return { action: attackOrApproach(unit, prey), cast: ready ? { skill: 'shadowstep', targetId: prey.id } : null };
}

/**
 * Guardian: stays near the most hurt ally, on the side away from the enemy closest to that ally,
 * and shoots enemies in reach while it is there. It only guards allies that aren't Guardians
 * (two Guardians guarding each other would keep stepping behind one another, away from the
 * fight); with no one else left to guard, it fights. Gives a Barrier to the most hurt ally in
 * range that has none yet (never to itself).
 */
export function thinkGuardian(state: BattleState, unit: Unit): Intent {
  const enemies = visibleEnemies(state, unit);
  if (enemies.length === 0) return search(state, unit);
  const allies = livingAllies(state, unit);
  const cast = chooseBarrierTarget(unit, allies);

  const ward = mostHurt(allies.filter((a) => a.cls !== 'guardian'));
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
