// Attacks, projectiles and damage.

import { BATTLE_RULES } from '../data/battle';
import { COMBO_BONUSES } from '../data/combos';
import { TROOP_SKILLS } from '../data/generals';
import { SPEC_RULES } from '../data/specializations';
import { SYNERGY_RULES } from '../data/synergies';
import { UNIT_CLASSES } from '../data/units';
import { factionAttackFactor, forgeAfterAttack, lifestealOf, phasesOut } from './factions';
import { distance, segmentNearCircle } from './geometry';
import { overtimeMultiplier } from './overtime';
import { centerDistance, findUnit, orderPower } from './queries';
import { nextFloat, nextRange } from './rng';
import { spotBehind } from './spots';
import { addVibration, applySlow, attackSpeedFactor, damageFactor, effectiveArmor, interruptCast } from './status';
import { hasSynergy, noteSynergy } from './synergies';
import { attackIntervalTicks, secondsToTicks, TICKS_PER_SECOND } from './time';
import { AREA_CAUSES, type BattleState, type DamageCause, type Projectile, type Unit, type Zone } from './types';
import { damageWall, firstWallOnSegment } from './walls';

/** Base damage with the battle's random spread applied. Uses the battle's seeded generator. */
export function rollDamage(state: BattleState, base: number): number {
  const spread = BATTLE_RULES.damageVariance;
  return base * nextRange(state.rng, 1 - spread, 1 + spread);
}

/**
 * Damage of one hit after the target's defenses:
 * armor blocks its share (armor piercing ignores part of the armor), then Mark adds its bonus.
 */
export function damageAfterDefenses(raw: number, armor: number, armorPierce: number, markBonus: number): number {
  const effectiveArmor = armor * (1 - armorPierce);
  const damage = raw * (1 - effectiveArmor) * (1 + markBonus);
  return Math.max(BATTLE_RULES.minDamage, Math.round(damage));
}

/**
 * Applies one hit: Overtime grows it (and area damage, for troops weak to it), a Barrier soaks
 * damage first, then HP. Writes a damage event. A troop holding with Iron Shell sends part of
 * the hit back while its Barrier lasts. Losing too much HP breaks an Invoker's cast. A wraith
 * takes nothing; a Strategist's troop dodges its first fatal blow (Phase Shift); a Conductor's
 * troops stack Vibration with every attack that lands (Echo Strike).
 */
export function dealDamage(
  state: BattleState,
  sourceId: number,
  target: Unit,
  raw: number,
  armorPierce: number,
  cause: DamageCause,
): void {
  if (!target.alive || target.hp <= 0 || target.wraithTicks > 0 || target.phasingFrom !== null) return;
  // Voidweavers: every few hits from attacks, the troop phases out and takes nothing.
  if (cause === 'attack' && phasesOut(state, target)) {
    state.events.push({ tick: state.tick, type: 'phased', unitId: target.id, sourceId });
    return;
  }
  const bonus = (target.mark?.damageTakenBonus ?? 0) + (target.chased?.damageTakenBonus ?? 0);
  const area = AREA_CAUSES.includes(cause) ? target.stats.areaDamageTaken : 1;
  const total = damageAfterDefenses(raw * overtimeMultiplier(state.tick) * area, effectiveArmor(target), armorPierce, bonus);
  const shelled = target.barrier !== null && cause !== 'reflect' && ironShellHolds(target);
  let absorbed = 0;
  if (target.barrier) {
    absorbed = Math.min(target.barrier.amount, total);
    target.barrier.amount -= absorbed;
    if (target.barrier.amount <= 0) barrierBroke(state, target);
  }
  let amount = Math.min(target.hp, total - absorbed);
  if (amount > 0 && amount >= target.hp && phaseShift(state, target, sourceId)) amount = 0;
  target.hp -= amount;
  if (amount > 0) target.lastHitBy = sourceId;
  state.events.push({ tick: state.tick, type: 'damage', sourceId, targetId: target.id, amount, absorbed, cause });
  if (target.casting && amount > 0) {
    target.casting.damageTaken += amount;
    const limit = target.stats.maxHp * UNIT_CLASSES.invoker.rift.interruptDamageShare;
    if (target.casting.damageTaken >= limit) interruptCast(state, target, sourceId);
  }
  if (cause === 'attack' && target.hp > 0) {
    const source = findUnit(state, sourceId);
    if (source && source.side !== target.side && state.generals[source.side] === 'conductor') addVibration(state, target, sourceId);
  }
  if (cause === 'attack' && amount > 0) healFromHit(state, sourceId, target, amount);
  if (shelled) {
    const attacker = findUnit(state, sourceId);
    const reflected = Math.round(total * COMBO_BONUSES.ironShell.reflectShare);
    if (attacker?.alive && attacker.side !== target.side && reflected > 0) {
      // The reflected share already counts Overtime and ignores the attacker's armor.
      dealDamage(state, target.id, attacker, reflected / overtimeMultiplier(state.tick), 1, 'reflect');
    }
  }
}

/** Lifesteal (perks, boons, Bloodbound): the attacker heals a share of the HP its attack took. */
function healFromHit(state: BattleState, sourceId: number, target: Unit, amount: number): void {
  const source = findUnit(state, sourceId);
  if (!source?.alive || source.side === target.side || source.wraithTicks > 0) return;
  const heal = Math.round(amount * lifestealOf(state, source));
  if (heal > 0) source.hp = Math.min(source.stats.maxHp, source.hp + heal);
}

/**
 * Strategist's Phase Shift: once per battle, a troop about to fall dodges the blow. It takes no
 * more damage this tick, and when the tick ends it teleports behind its attacker and stuns it.
 * True if it dodged.
 */
function phaseShift(state: BattleState, unit: Unit, sourceId: number): boolean {
  if (unit.phaseShiftUsed || state.generals[unit.side] !== 'strategist') return false;
  unit.phaseShiftUsed = true;
  unit.phasingFrom = sourceId;
  return true;
}

/**
 * Ends this tick's Phase Shifts, once all of the tick's damage is done, so the order troops and
 * shots are handled in can't favor a side: every spot is worked out first, then everyone moves.
 */
export function resolvePhaseShifts(state: BattleState): void {
  const shifts = state.units
    .filter((u) => u.phasingFrom !== null)
    .map((unit) => {
      const attacker = findUnit(state, unit.phasingFrom);
      const enemy = attacker?.alive && attacker.side !== unit.side ? attacker : undefined;
      return { unit, attacker: enemy, spot: enemy ? spotBehind(state, unit, enemy) : null };
    });
  for (const { unit, attacker, spot } of shifts) {
    unit.phasingFrom = null;
    if (spot) {
      unit.x = spot.x;
      unit.y = spot.y;
      unit.path = [];
    }
    if (attacker) {
      attacker.stunTicks = Math.max(attacker.stunTicks, secondsToTicks(TROOP_SKILLS.phaseShift.stunSeconds));
      interruptCast(state, attacker, unit.id);
    }
    state.events.push({ tick: state.tick, type: 'skill', unitId: unit.id, skill: 'phaseShift', targetIds: attacker ? [attacker.id] : [] });
  }
}

/** A Barrier broke. Shadow Escort: an Assassin whose Barrier breaks turns invisible for a moment. */
function barrierBroke(state: BattleState, unit: Unit): void {
  unit.barrier = null;
  if (unit.cls !== 'assassin' || !hasSynergy(state, unit.side, 'shadowEscort')) return;
  unit.invisibleTicks = secondsToTicks(SYNERGY_RULES.shadowEscort.invisibleSeconds);
  noteSynergy(state, unit.side, 'shadowEscort');
}

function ironShellHolds(unit: Unit): boolean {
  const order = unit.orders[0];
  return order?.started === true && order.kind === 'hold' && order.combo === 'ironShell';
}

/**
 * How many times normal damage an Assassin's hit deals: its crit multiplier on a critical hit,
 * else 1. Other troops never crit. Execution Protocol: a Marked target is always a critical hit.
 */
export function critMultiplier(state: BattleState, unit: Unit, target: Unit): number {
  if (unit.cls !== 'assassin') return 1;
  const crit = UNIT_CLASSES.assassin.crit;
  if (target.mark && hasSynergy(state, unit.side, 'executionProtocol')) {
    noteSynergy(state, unit.side, 'executionProtocol');
    return crit.multiplier;
  }
  return nextFloat(state.rng) < crit.chance ? crit.multiplier : 1;
}

/** One attack: melee hits land at once, ranged attacks fire a projectile. */
export function performAttack(state: BattleState, unit: Unit, target: Unit): void {
  const raw =
    rollDamage(state, unit.stats.damage) * orderPower(unit) * damageFactor(unit) * critMultiplier(state, unit, target) * factionAttackFactor(state, unit);
  if (unit.stats.projectileSpeed > 0) {
    state.projectiles.push({
      id: state.nextProjectileId++,
      ownerId: unit.id,
      side: unit.side,
      targetId: target.id,
      x: unit.x,
      y: unit.y,
      speed: unit.stats.projectileSpeed,
      damage: raw,
      armorPierce: unit.stats.armorPierce,
      splash: unit.spec === 'volley' ? { radius: SPEC_RULES.volley.splashRadius, share: SPEC_RULES.volley.splashShare } : null,
      crossfire: unit.cls === 'ranger' && hasSynergy(state, unit.side, 'crossfire'),
      element: null,
    });
  } else {
    dealDamage(state, unit.id, target, raw, unit.stats.armorPierce, 'attack');
  }
  unit.attackCooldown = attackIntervalTicks(unit.stats.attacksPerSecond * attackSpeedFactor(unit));
  forgeAfterAttack(state, unit);
}

/**
 * Projectiles fly straight at their target and hit when they reach its body. A standing
 * wall in the way takes the hit instead, and so does an enemy Bulwark whose body is in the way.
 * They vanish if the target dies first. Crossfire arrows take the element of a Rift they fly through.
 */
export function updateProjectiles(state: BattleState): void {
  const flying = [];
  for (const p of state.projectiles) {
    const target = findUnit(state, p.targetId);
    if (!target || !target.alive) continue;
    const step = p.speed / TICKS_PER_SECOND;
    const d = distance(p.x, p.y, target.x, target.y);
    const arrives = d <= step + target.stats.radius;
    const toX = arrives ? target.x : p.x + ((target.x - p.x) / d) * step;
    const toY = arrives ? target.y : p.y + ((target.y - p.y) / d) * step;
    const wall = firstWallOnSegment(state, p.x, p.y, toX, toY);
    if (wall) {
      damageWall(state, wall, p.ownerId, p.damage);
      continue;
    }
    const shield = blockingBulwark(state, p, target, toX, toY);
    if (shield) {
      dealDamage(state, p.ownerId, shield, p.damage, p.armorPierce, 'attack');
      continue;
    }
    if (p.crossfire && !p.element) {
      const zone = zoneAt(state, p.side, toX, toY);
      if (zone) p.element = zone.element === 'frost' ? 'frost' : 'burn';
    }
    if (arrives) {
      projectileHit(state, p, target);
      continue;
    }
    p.x = toX;
    p.y = toY;
    flying.push(p);
  }
  state.projectiles = flying;
}

function projectileHit(state: BattleState, p: Projectile, target: Unit): void {
  const crossfire = SYNERGY_RULES.crossfire;
  const damage = p.element === 'burn' ? p.damage * (1 + crossfire.burnBonus) : p.damage;
  dealDamage(state, p.ownerId, target, damage, p.armorPierce, 'attack');
  if (p.element) {
    if (p.element === 'frost' && target.alive) applySlow(target, crossfire.frostSlow, secondsToTicks(crossfire.frostSeconds));
    noteSynergy(state, p.side, 'crossfire');
  }
  if (p.splash) {
    for (const other of state.units) {
      if (!other.alive || other.side === p.side || other.id === target.id) continue;
      if (centerDistance(other, target) <= p.splash.radius) {
        dealDamage(state, p.ownerId, other, p.damage * p.splash.share, p.armorPierce, 'splash');
      }
    }
  }
}

/** Bulwark: the first enemy Bulwark (not the target itself) whose body this step of the shot crosses. */
function blockingBulwark(state: BattleState, p: Projectile, target: Unit, toX: number, toY: number): Unit | undefined {
  for (const u of state.units) {
    if (!u.alive || u.side === p.side || u.id === target.id || u.spec !== 'bulwark') continue;
    if (segmentNearCircle(p.x, p.y, toX, toY, u.x, u.y, u.stats.radius)) return u;
  }
  return undefined;
}

/** The first open Rift of `side` (of that element, if given) within `slack` of the point. */
export function zoneAt(
  state: BattleState,
  side: Zone['side'],
  x: number,
  y: number,
  element?: Zone['element'],
  slack = 0,
): Zone | undefined {
  return state.zones.find(
    (z) => z.side === side && (element === undefined || z.element === element) && distance(x, y, z.x, z.y) <= z.radius + slack,
  );
}
