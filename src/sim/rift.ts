// The Invoker's Rift: after a long cast, a zone opens on the ground and hurts every enemy inside
// once per pulse while it lasts. Pyromancers open fire Rifts that burn harder; Frostcallers open
// frost Rifts that slow. A hit that costs enough HP, a Shove, a stun or a silence breaks the cast.

import { SPEC_RULES } from '../data/specializations';
import { SYNERGY_RULES } from '../data/synergies';
import { UNIT_CLASSES } from '../data/units';
import { dealDamage, zoneAt } from './combat';
import { distance, type Point } from './geometry';
import { centerDistance, visibleEnemies } from './queries';
import { skillCooldownFor } from './skills';
import { applySlow } from './status';
import { hasSynergy, noteSynergy } from './synergies';
import { secondsToTicks } from './time';
import { otherSide, type BattleState, type Knockback, type Unit, type Zone } from './types';

/**
 * Where the Invoker would open a Rift: on the enemy with the most other enemies close around it,
 * within `range`. Null unless the group has at least `minTargets` enemies (or all that are left).
 */
export function riftSpot(
  state: BattleState,
  invoker: Unit,
  range: number = UNIT_CLASSES.invoker.rift.castRange,
  minTargets: number = UNIT_CLASSES.invoker.rift.minTargets,
): Point | null {
  const enemies = visibleEnemies(state, invoker);
  const radius = UNIT_CLASSES.invoker.rift.radius;
  let best: Unit | undefined;
  let most = 0;
  for (const center of enemies) {
    if (centerDistance(invoker, center) > range) continue;
    const near = enemies.filter((e) => centerDistance(e, center) <= radius).length;
    if (near > most) {
      best = center;
      most = near;
    }
  }
  if (!best || most < Math.min(minTargets, enemies.length)) return null;
  return { x: best.x, y: best.y };
}

/** Starts casting a Rift at the spot. The skill's cooldown starts now. */
export function startRift(invoker: Unit, spot: Point): void {
  invoker.casting = {
    ticksLeft: secondsToTicks(UNIT_CLASSES.invoker.rift.castSeconds),
    x: spot.x,
    y: spot.y,
    damageTaken: 0,
  };
  invoker.skillCooldown = skillCooldownFor(invoker);
}

/** Counts down a cast; when it ends, the Rift opens. Called with the other timers. */
export function tickCast(state: BattleState, invoker: Unit): void {
  const cast = invoker.casting;
  if (!cast || --cast.ticksLeft > 0) return;
  invoker.casting = null;
  openRift(state, invoker, cast);
}

/** Opens a Rift at once. `power` above 1 (a Perfect Overcharge, Overload) makes it hurt more. */
export function openRift(state: BattleState, invoker: Unit, spot: Point, power = 1): void {
  const rift = UNIT_CLASSES.invoker.rift;
  const spec = invoker.spec;
  const element: Zone['element'] = spec === 'pyromancer' ? 'fire' : spec === 'frostcaller' ? 'frost' : 'arcane';
  const multiplier =
    spec === 'pyromancer'
      ? SPEC_RULES.pyromancer.riftDamageMultiplier
      : spec === 'frostcaller'
        ? SPEC_RULES.frostcaller.riftDamageMultiplier
        : 1;
  const zone: Zone = {
    id: state.nextZoneId++,
    ownerId: invoker.id,
    side: invoker.side,
    x: spot.x,
    y: spot.y,
    radius: rift.radius,
    element,
    damage: rift.pulseDamage * multiplier * power,
    slow: element === 'frost' ? SPEC_RULES.frostcaller.slow : 0,
    ticksLeft: secondsToTicks(rift.durationSeconds),
    pulseIn: 0,
  };
  state.zones.push(zone);
  state.events.push({
    tick: state.tick,
    type: 'skill',
    unitId: invoker.id,
    skill: 'rift',
    targetIds: enemiesInside(state, zone).map((u) => u.id),
  });
}

function enemiesInside(state: BattleState, zone: Zone): Unit[] {
  return state.units.filter((u) => u.alive && u.side !== zone.side && distance(u.x, u.y, zone.x, zone.y) <= zone.radius + u.stats.radius);
}

/** Pulses every open Rift, slows enemies in frost, and closes Rifts whose time is up. */
export function updateZones(state: BattleState): void {
  const pulseTicks = secondsToTicks(UNIT_CLASSES.invoker.rift.pulseSeconds);
  for (const zone of state.zones) {
    const inside = enemiesInside(state, zone);
    // Frost slows whoever is inside, renewed every tick, so the slow ends just after they step out.
    if (zone.slow > 0) for (const u of inside) applySlow(u, zone.slow, 2);
    if (zone.pulseIn <= 0) {
      for (const u of inside) dealDamage(state, zone.ownerId, u, zone.damage, 0, 'rift');
      zone.pulseIn = pulseTicks;
    }
    zone.pulseIn -= 1;
    zone.ticksLeft -= 1;
  }
  state.zones = state.zones.filter((z) => z.ticksLeft > 0);
}

/**
 * Fire Break: an enemy Shoved into a fire Rift of a side with the synergy takes several pulses of
 * burn at once, once per Shove. Called for every unit a push moved this tick.
 */
export function burnShoved(state: BattleState, unit: Unit, push: Knockback): void {
  if (push.burned || !unit.alive) return;
  const side = otherSide(unit.side);
  if (!hasSynergy(state, side, 'fireBreak')) return;
  const zone = zoneAt(state, side, unit.x, unit.y, 'fire', unit.stats.radius);
  if (!zone) return;
  push.burned = true;
  dealDamage(state, zone.ownerId, unit, zone.damage * SYNERGY_RULES.fireBreak.pulses, 0, 'burn');
  noteSynergy(state, side, 'fireBreak');
}
