// Attacks, projectiles and damage.

import { BATTLE_RULES } from '../data/battle';
import { ULTIMATES } from '../data/command';
import { distance } from './geometry';
import { overtimeMultiplier } from './overtime';
import { findUnit, orderPower } from './queries';
import { nextRange } from './rng';
import { attackIntervalTicks, TICKS_PER_SECOND } from './time';
import type { BattleState, DamageCause, Unit } from './types';
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

/** Applies one hit: Overtime grows it, a Barrier soaks damage first, then HP. Writes a damage event. */
export function dealDamage(
  state: BattleState,
  sourceId: number,
  target: Unit,
  raw: number,
  armorPierce: number,
  cause: DamageCause,
): void {
  if (!target.alive || target.hp <= 0) return;
  const markBonus = target.mark ? target.mark.damageTakenBonus : 0;
  const total = damageAfterDefenses(raw * overtimeMultiplier(state.tick), target.stats.armor, armorPierce, markBonus);
  let absorbed = 0;
  if (target.barrier) {
    absorbed = Math.min(target.barrier.amount, total);
    target.barrier.amount -= absorbed;
    if (target.barrier.amount <= 0) target.barrier = null;
  }
  const amount = Math.min(target.hp, total - absorbed);
  target.hp -= amount;
  if (amount > 0) target.lastHitBy = sourceId;
  state.events.push({ tick: state.tick, type: 'damage', sourceId, targetId: target.id, amount, absorbed, cause });
}

/** One attack: melee hits land at once, ranged attacks fire a projectile. */
export function performAttack(state: BattleState, unit: Unit, target: Unit): void {
  const raw = rollDamage(state, unit.stats.damage) * orderPower(unit);
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
    });
  } else {
    dealDamage(state, unit.id, target, raw, unit.stats.armorPierce, 'attack');
  }
  const rally = unit.rallyTicks > 0 ? 1 + ULTIMATES.rally.attackSpeedBonus : 1;
  unit.attackCooldown = attackIntervalTicks(unit.stats.attacksPerSecond * rally);
}

/**
 * Projectiles fly straight at their target and hit when they reach its body. A standing
 * wall in the way takes the hit instead. They vanish if the target dies first.
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
    if (arrives) {
      dealDamage(state, p.ownerId, target, p.damage, p.armorPierce, 'attack');
      continue;
    }
    p.x = toX;
    p.y = toY;
    flying.push(p);
  }
  state.projectiles = flying;
}
