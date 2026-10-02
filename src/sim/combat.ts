// Attacks, projectiles and damage.

import { BATTLE_RULES } from '../data/battle';
import { distance } from './geometry';
import { findUnit } from './queries';
import { nextRange } from './rng';
import { attackIntervalTicks, TICKS_PER_SECOND } from './time';
import type { BattleState, DamageCause, Unit } from './types';

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

/** Applies one hit: a Barrier soaks damage first, then HP. Writes a damage event. */
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
  const total = damageAfterDefenses(raw, target.stats.armor, armorPierce, markBonus);
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
  const raw = rollDamage(state, unit.stats.damage);
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
  unit.attackCooldown = attackIntervalTicks(unit.stats.attacksPerSecond);
}

/** Projectiles fly straight at their target and hit when they reach its body. They vanish if it dies first. */
export function updateProjectiles(state: BattleState): void {
  const flying = [];
  for (const p of state.projectiles) {
    const target = findUnit(state, p.targetId);
    if (!target || !target.alive) continue;
    const step = p.speed / TICKS_PER_SECOND;
    const d = distance(p.x, p.y, target.x, target.y);
    if (d <= step + target.stats.radius) {
      dealDamage(state, p.ownerId, target, p.damage, p.armorPierce, 'attack');
      continue;
    }
    p.x += ((target.x - p.x) / d) * step;
    p.y += ((target.y - p.y) / d) * step;
    flying.push(p);
  }
  state.projectiles = flying;
}
