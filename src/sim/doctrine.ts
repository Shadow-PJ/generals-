// Doctrines: how each General bends what troops do on their own. A troop first decides by its
// class (behaviors.ts); its General's doctrine then changes that decision. Taunts and card
// orders still come first.

import { DOCTRINES, TROOP_SKILLS } from '../data/generals';
import { UNIT_CLASSES } from '../data/units';
import { distance, type Point } from './geometry';
import { attackOrApproach, backAway, type Intent } from './intents';
import {
  centerDistance,
  edgeDistance,
  findUnit,
  hiddenFromSide,
  livingAllies,
  livingUnits,
  nearestTo,
  visibleEnemies,
} from './queries';
import { choosePrey } from './shadowstep';
import { secondsToTicks } from './time';
import { SIDES, type BattleState, type Unit } from './types';

export function applyDoctrine(state: BattleState, unit: Unit, base: Intent): Intent {
  switch (state.generals[unit.side]) {
    case 'captain':
      return base;
    case 'warlord':
      return warlord(state, unit, base);
    case 'engineer':
      return engineer(state, unit, base);
    case 'hiveMother':
      return pack(state, unit, base);
    case 'strategist':
      return strategist(state, unit, base);
    case 'conductor':
      return conductor(state, unit, base);
  }
}

/** True when the troop was going to attack an enemy, or walk up to one. */
function goingForEnemy(state: BattleState, unit: Unit, base: Intent): boolean {
  const action = base.action;
  if (action.kind === 'attack') return true;
  if (action.kind !== 'walk' || action.targetId === null) return false;
  return findUnit(state, action.targetId)?.side !== unit.side;
}

/**
 * Warlord: Vanguards go for the strongest enemy in reach (since session 6A; across the field, they
 * chased the toughest troop while Rangers shot them); Assassins Shadowstep to their prey at any distance.
 */
function warlord(state: BattleState, unit: Unit, base: Intent): Intent {
  if (unit.cls === 'vanguard' && goingForEnemy(state, unit, base)) {
    const target = strongest(visibleEnemies(state, unit).filter((e) => edgeDistance(unit, e) <= unit.stats.range));
    return target ? { action: attackOrApproach(unit, target), cast: base.cast } : base;
  }
  if (unit.cls === 'assassin' && !base.cast && unit.skillCooldown <= 0) {
    const prey = choosePrey(state, unit);
    return prey ? { action: base.action, cast: { skill: 'shadowstep', targetId: prey.id } } : base;
  }
  return base;
}

/** The enemy with the most HP left. Ties go to the lowest id. */
function strongest(units: readonly Unit[]): Unit | undefined {
  let best: Unit | undefined;
  for (const u of units) if (!best || u.hp > best.hp) best = u;
  return best;
}

/**
 * Engineer, for the opening of the battle: Vanguards hold their ground, leaving their spot only
 * for enemies close to it and going back afterwards; Rangers stand behind the nearest Vanguard
 * until the enemy comes close. Then troops fight as usual (so two Engineers can't wait forever).
 */
function engineer(state: BattleState, unit: Unit, base: Intent): Intent {
  const rules = DOCTRINES.engineer;
  if (state.tick >= secondsToTicks(rules.holdSeconds)) return base;
  if (unit.cls === 'vanguard' && base.action.kind !== 'attack') {
    const near = visibleEnemies(state, unit).filter((e) => distance(e.x, e.y, unit.home.x, unit.home.y) <= rules.holdRadius + e.stats.radius);
    const target = nearestTo(near, unit.x, unit.y);
    if (target) return { action: attackOrApproach(unit, target), cast: base.cast };
    return { action: stayAt(unit, unit.home, null), cast: base.cast };
  }
  if (unit.cls === 'ranger' && base.action.kind === 'walk') {
    const cover = nearestTo(livingAllies(state, unit).filter((a) => a.cls === 'vanguard'), unit.x, unit.y);
    const threat = cover ? nearestTo(visibleEnemies(state, unit), cover.x, cover.y) : undefined;
    if (!cover || !threat) return base;
    // Once the enemy is close, the Rangers come out to fight.
    const nearest = nearestTo(visibleEnemies(state, unit), unit.x, unit.y)!;
    if (edgeDistance(unit, nearest) <= unit.stats.range + rules.coverLeaveDistance) return base;
    const spot = awayFrom(cover, threat, rules.coverDistance + cover.stats.radius + unit.stats.radius);
    return { action: stayAt(unit, spot, cover.id), cast: null };
  }
  return base;
}

/** Walk to the spot, or hold once there. */
function stayAt(unit: Unit, spot: Point, targetId: number | null): Intent['action'] {
  if (distance(unit.x, unit.y, spot.x, spot.y) <= DOCTRINES.engineer.holdSlack) return { kind: 'hold' };
  return { kind: 'walk', to: spot, targetId };
}

/** The point `by` past `from`, on the far side from `threat`. */
function awayFrom(from: Unit, threat: Unit, by: number): Point {
  const d = distance(from.x, from.y, threat.x, threat.y);
  if (d === 0) return { x: from.x, y: from.y };
  return { x: from.x + ((from.x - threat.x) / d) * by, y: from.y + ((from.y - threat.y) / d) * by };
}

/**
 * Hive Mother: the pack hunts one enemy at a time. Vanguards and Assassins go for the pack's prey
 * instead of their own target (Assassins Shadowstep to it); Rangers and Invokers shoot it
 * whenever it is in range. Guardians keep to their allies.
 */
function pack(state: BattleState, unit: Unit, base: Intent): Intent {
  const prey = findUnit(state, state.packPrey[unit.side]);
  if (!prey?.alive || unit.cls === 'guardian' || !goingForEnemy(state, unit, base)) return base;
  if (unit.cls === 'ranger' || unit.cls === 'invoker') {
    return edgeDistance(unit, prey) <= unit.stats.range ? { action: { kind: 'attack', targetId: prey.id }, cast: base.cast } : base;
  }
  let cast = base.cast;
  if (cast?.skill === 'shadowstep') {
    cast = centerDistance(unit, prey) <= UNIT_CLASSES.assassin.shadowstep.range ? { skill: 'shadowstep', targetId: prey.id } : null;
  }
  return { action: attackOrApproach(unit, prey), cast };
}

/**
 * Hive Mother: picks each pack's prey before troops decide: it keeps its prey until the prey falls
 * or vanishes, then takes the enemy nearest to the middle of the pack.
 */
export function updatePacks(state: BattleState): void {
  for (const side of SIDES) {
    if (state.generals[side] !== 'hiveMother') continue;
    const current = findUnit(state, state.packPrey[side]);
    if (current?.alive && !hiddenFromSide(state, current, side)) continue;
    const pack = livingUnits(state, side);
    if (pack.length === 0) {
      state.packPrey[side] = null;
      continue;
    }
    const x = pack.reduce((sum, u) => sum + u.x, 0) / pack.length;
    const y = pack.reduce((sum, u) => sum + u.y, 0) / pack.length;
    const seen = state.units.filter((u) => u.alive && u.side !== side && !hiddenFromSide(state, u, side));
    state.packPrey[side] = nearestTo(seen, x, y)?.id ?? null;
  }
}

/** Strategist: Vanguards guard the nearest ally; Rangers back away between shots to keep their distance. */
function strategist(state: BattleState, unit: Unit, base: Intent): Intent {
  if (unit.cls === 'vanguard' && base.action.kind !== 'attack') {
    const ally = nearestTo(livingAllies(state, unit).filter((a) => a.cls !== 'vanguard'), unit.x, unit.y);
    const threat = ally ? nearestTo(visibleEnemies(state, unit), ally.x, ally.y) : undefined;
    if (!ally || !threat) return base;
    const d = distance(ally.x, ally.y, threat.x, threat.y);
    const by = Math.min(d, ally.stats.radius + unit.stats.radius + 8);
    const spot = d === 0 ? { x: ally.x, y: ally.y } : { x: ally.x + ((threat.x - ally.x) / d) * by, y: ally.y + ((threat.y - ally.y) / d) * by };
    return { action: stayAt(unit, spot, ally.id), cast: base.cast };
  }
  if (unit.cls === 'ranger' && unit.attackCooldown > 0) {
    const threat = nearestTo(visibleEnemies(state, unit), unit.x, unit.y);
    const away = threat ? backAway(state, unit, threat, unit.stats.range * DOCTRINES.strategist.keepRangeShare) : null;
    if (away) return { action: away, cast: null };
  }
  return base;
}

/**
 * Conductor: troops spread their attacks. A troop about to hit an enemy that already has a full
 * Vibration stack hits the nearest enemy in reach without one instead. Assassins keep to their prey.
 */
function conductor(state: BattleState, unit: Unit, base: Intent): Intent {
  if (base.action.kind !== 'attack' || unit.cls === 'assassin') return base;
  const target = findUnit(state, base.action.targetId);
  const full = TROOP_SKILLS.echoStrike.maxStacks;
  if (!target || (target.vibration?.stacks ?? 0) < full) return base;
  const fresh = visibleEnemies(state, unit).filter((e) => edgeDistance(unit, e) <= unit.stats.range && (e.vibration?.stacks ?? 0) < full);
  const other = nearestTo(fresh, unit.x, unit.y);
  return other ? { action: { kind: 'attack', targetId: other.id }, cast: base.cast } : base;
}
