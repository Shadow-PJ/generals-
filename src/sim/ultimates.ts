// The Generals' ultimates, fired with U once Momentum is full. `power` is 1, or more for a
// Finisher. Some ultimates need something on the field to work on; until then they wait.

import { ULTIMATES } from '../data/command';
import { GENERALS, ULTIMATE_RULES, type UltimateId } from '../data/generals';
import { dealDamage } from './combat';
import { distance, type Point } from './geometry';
import { centerDistance, hpShare, livingUnits, nearestTo } from './queries';
import { immovable } from './skills';
import { interruptCast } from './status';
import { secondsToTicks } from './time';
import { otherSide, type BattleState, type Side, type Unit } from './types';

/** The ultimate of a side's General. */
export function ultimateOf(state: BattleState, side: Side): UltimateId {
  return GENERALS[state.generals[side]].ultimate.id;
}

/** True if the ultimate has something to work on now. */
export function ultimateUsable(state: BattleState, side: Side): boolean {
  const mine = livingUnits(state, side);
  const theirs = livingUnits(state, otherSide(side));
  switch (ultimateOf(state, side)) {
    case 'rally':
    case 'thermalDetonation':
      return mine.length > 0;
    case 'reapersToll':
      return mine.some((u) => u.wraithTicks <= 0 && hpShare(u) < ULTIMATE_RULES.reapersToll.hpShareBelow);
    case 'forcedEvolution':
      return mine.filter((u) => u.wraithTicks <= 0 && hpShare(u) < ULTIMATE_RULES.forcedEvolution.hurtShareBelow).length >= 2;
    case 'gravityWell':
      return theirs.length > 0;
    case 'shatterstorm':
      return theirs.some((u) => (u.vibration?.stacks ?? 0) > 0);
  }
}

/** What an ultimate struck, for the event log: a place, or a line from `at` to `to`. */
export interface UltimateMark {
  at?: Point;
  to?: Point;
}

/** Fires the side's ultimate. */
export function castUltimate(state: BattleState, side: Side, power: number): UltimateMark {
  switch (ultimateOf(state, side)) {
    case 'rally':
      return rally(state, side, power);
    case 'reapersToll':
      return reapersToll(state, side, power);
    case 'thermalDetonation':
      return thermalDetonation(state, side, power);
    case 'forcedEvolution':
      return forcedEvolution(state, side, power);
    case 'gravityWell':
      return gravityWell(state, side, power);
    case 'shatterstorm':
      return shatterstorm(state, side, power);
  }
}

/** Captain's Rally: every troop heals and attacks faster for a few seconds. */
function rally(state: BattleState, side: Side, power: number): UltimateMark {
  const rules = ULTIMATES.rally;
  for (const unit of livingUnits(state, side)) {
    unit.hp = Math.min(unit.stats.maxHp, unit.hp + Math.round(unit.stats.maxHp * rules.healShare * power));
    unit.rallyTicks = secondsToTicks(rules.durationSeconds);
    unit.rallyBonus = rules.attackSpeedBonus * power;
  }
  return {};
}

/** Warlord's Reaper's Toll: troops close to falling become invulnerable wraiths that hit harder, then fall. */
function reapersToll(state: BattleState, side: Side, power: number): UltimateMark {
  const rules = ULTIMATE_RULES.reapersToll;
  for (const unit of livingUnits(state, side)) {
    if (unit.wraithTicks <= 0 && hpShare(unit) < rules.hpShareBelow) unit.wraithTicks = secondsToTicks(rules.wraithSeconds * power);
  }
  return {};
}

function centroid(units: readonly Unit[]): Point {
  return {
    x: units.reduce((sum, u) => sum + u.x, 0) / units.length,
    y: units.reduce((sum, u) => sum + u.y, 0) / units.length,
  };
}

/**
 * Engineer's Thermal Detonation: takes every troop's heat to heal it, then fires a beam from the
 * middle of your army through the middle of the enemy's. The more heat, the stronger both.
 */
function thermalDetonation(state: BattleState, side: Side, power: number): UltimateMark {
  const rules = ULTIMATE_RULES.thermalDetonation;
  const mine = livingUnits(state, side);
  let heat = 0;
  for (const unit of mine) {
    const share = rules.healShare + rules.healSharePerHeat * unit.heat;
    unit.hp = Math.min(unit.stats.maxHp, unit.hp + Math.round(unit.stats.maxHp * share * power));
    heat += unit.heat;
    unit.heat = 0;
  }
  const theirs = livingUnits(state, otherSide(side));
  if (mine.length === 0 || theirs.length === 0) return {};
  const from = centroid(mine);
  const aim = centroid(theirs);
  const d = distance(from.x, from.y, aim.x, aim.y);
  const dx = d === 0 ? (side === 'player' ? 1 : -1) : (aim.x - from.x) / d;
  const dy = d === 0 ? 0 : (aim.y - from.y) / d;
  const source = nearestTo(mine, from.x, from.y)!;
  const damage = (rules.beamDamage + rules.beamDamagePerHeat * heat) * power;
  for (const enemy of theirs) {
    const along = (enemy.x - from.x) * dx + (enemy.y - from.y) * dy;
    const across = Math.abs((enemy.x - from.x) * dy - (enemy.y - from.y) * dx);
    if (along >= 0 && across <= rules.beamWidth + enemy.stats.radius) dealDamage(state, source.id, enemy, damage, 0, 'beam');
  }
  return { at: from, to: beamEnd(state, from, dx, dy) };
}

/** Where a beam from `from` going (dx, dy) leaves the map. */
function beamEnd(state: BattleState, from: Point, dx: number, dy: number): Point {
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (state.map.width - from.x) / dx);
  if (dx < 0) t = Math.min(t, -from.x / dx);
  if (dy > 0) t = Math.min(t, (state.map.height - from.y) / dy);
  if (dy < 0) t = Math.min(t, -from.y / dy);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/**
 * Hive Mother's Forced Evolution, once two troops are badly hurt: the two most hurt troops merge.
 * The one with more HP left stays, now an elite at full HP: their max HP together, more damage and
 * armor. The other is gone.
 */
function forcedEvolution(state: BattleState, side: Side, power: number): UltimateMark {
  const rules = ULTIMATE_RULES.forcedEvolution;
  const hurt = livingUnits(state, side)
    .filter((u) => u.wraithTicks <= 0)
    .sort((a, b) => hpShare(a) - hpShare(b) || a.id - b.id)
    .slice(0, 2);
  if (hurt.length < 2) return {};
  const [a, b] = hurt as [Unit, Unit];
  const [elite, merged] = b.hp > a.hp || (b.hp === a.hp && b.id < a.id) ? [b, a] : [a, b];
  elite.stats.maxHp += merged.stats.maxHp;
  elite.hp = elite.stats.maxHp;
  elite.stats.damage *= 1 + rules.damageBonus * power;
  elite.stats.armor = Math.min(0.8, elite.stats.armor + rules.armorBonus);
  elite.elite = true;
  merged.alive = false;
  merged.hp = 0;
  merged.orders = [];
  merged.barrier = null;
  merged.casting = null;
  merged.knockback = null;
  state.events.push({ tick: state.tick, type: 'evolved', side, unitId: elite.id, mergedId: merged.id });
  return { at: { x: elite.x, y: elite.y } };
}

/**
 * Strategist's Gravity Well: every unit near the middle of the enemy army, friend and foe, is
 * dragged toward that point, and can't act while it is pulled. Iron Wall Vanguards stand fast.
 */
function gravityWell(state: BattleState, side: Side, power: number): UltimateMark {
  const rules = ULTIMATE_RULES.gravityWell;
  const theirs = livingUnits(state, otherSide(side));
  if (theirs.length === 0) return {};
  const point = centroid(theirs);
  const pullTicks = Math.max(1, secondsToTicks(rules.pullSeconds));
  for (const unit of state.units) {
    if (!unit.alive || immovable(state, unit)) continue;
    const d = distance(unit.x, unit.y, point.x, point.y);
    if (d > rules.radius) continue;
    const move = Math.min(rules.pullDistance * power, d - unit.stats.radius - 8);
    if (move <= 0) continue;
    unit.knockback = {
      dx: ((point.x - unit.x) / d) * (move / pullTicks),
      dy: ((point.y - unit.y) / d) * (move / pullTicks),
      ticksLeft: pullTicks,
      byId: null,
      burned: true,
    };
    interruptCast(state, unit, null);
  }
  return { at: point };
}

/**
 * Conductor's Shatterstorm: every Vibration stack on the enemy explodes at once. Each enemy takes
 * damage for its stacks, and the blast hurts the enemies around it too.
 */
function shatterstorm(state: BattleState, side: Side, power: number): UltimateMark {
  const rules = ULTIMATE_RULES.shatterstorm;
  const mine = livingUnits(state, side);
  const stacked = livingUnits(state, otherSide(side)).filter((u) => (u.vibration?.stacks ?? 0) > 0);
  const blasts = stacked.map((u) => ({ unit: u, damage: u.vibration!.stacks * rules.damagePerStack * power }));
  for (const u of stacked) u.vibration = null;
  for (const { unit, damage } of blasts) {
    const source = nearestTo(mine, unit.x, unit.y);
    if (!source) break;
    for (const enemy of livingUnits(state, otherSide(side))) {
      if (enemy.id === unit.id) dealDamage(state, source.id, enemy, damage, 0, 'shatterstorm');
      else if (centerDistance(enemy, unit) <= rules.blastRadius) dealDamage(state, source.id, enemy, damage * rules.blastShare, 0, 'shatterstorm');
    }
  }
  return {};
}
