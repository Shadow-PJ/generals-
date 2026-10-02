// Troop skills: Shove (Vanguard), Mark (Ranger) and Barrier (Guardian).
// Troops use them on their own when they are ready; cards will trigger them later.

import { UNIT_CLASSES, type UnitClass } from '../data/units';
import { dealDamage } from './combat';
import { distance } from './geometry';
import { edgeDistance, livingEnemies } from './queries';
import { secondsToTicks } from './time';
import type { BattleState, Unit } from './types';

export function skillCooldownTicks(cls: UnitClass): number {
  return secondsToTicks(skillTiming(cls).cooldownSeconds);
}

export function initialSkillCooldownTicks(cls: UnitClass): number {
  return secondsToTicks(skillTiming(cls).initialCooldownSeconds);
}

function skillTiming(cls: UnitClass): { cooldownSeconds: number; initialCooldownSeconds: number } {
  switch (cls) {
    case 'vanguard':
      return UNIT_CLASSES.vanguard.shove;
    case 'ranger':
      return UNIT_CLASSES.ranger.mark;
    case 'guardian':
      return UNIT_CLASSES.guardian.barrier;
  }
}

/** Enemies close enough to be Shoved. */
export function shoveTargets(state: BattleState, vanguard: Unit): Unit[] {
  const range = UNIT_CLASSES.vanguard.shove.range;
  return livingEnemies(state, vanguard).filter((e) => edgeDistance(vanguard, e) <= range);
}

/**
 * Shove: pushes every nearby enemy straight away from the Vanguard and deals a little damage.
 * `power` above 1 (a Perfect Overcharge) pushes further and hits harder; `stunTicks` (Hammer and
 * Anvil) leaves them unable to act for a while after the push.
 */
export function castShove(state: BattleState, vanguard: Unit, power = 1, stunTicks = 0): void {
  const shove = UNIT_CLASSES.vanguard.shove;
  const targets = shoveTargets(state, vanguard);
  if (targets.length === 0) return;
  const pushTicks = Math.max(1, secondsToTicks(shove.pushSeconds));
  const perTick = (shove.pushDistance * power) / pushTicks;
  for (const target of targets) {
    const d = distance(vanguard.x, vanguard.y, target.x, target.y);
    // Two units on the same spot: push toward the enemy's side of the map.
    const nx = d === 0 ? (vanguard.side === 'player' ? 1 : -1) : (target.x - vanguard.x) / d;
    const ny = d === 0 ? 0 : (target.y - vanguard.y) / d;
    target.knockback = { dx: nx * perTick, dy: ny * perTick, ticksLeft: pushTicks };
    if (stunTicks > 0) target.stunTicks = Math.max(target.stunTicks, pushTicks + stunTicks);
    dealDamage(state, vanguard.id, target, shove.damage * power, vanguard.stats.armorPierce, 'shove');
  }
  vanguard.skillCooldown = skillCooldownTicks('vanguard');
  state.events.push({
    tick: state.tick,
    type: 'skill',
    unitId: vanguard.id,
    skill: 'shove',
    targetIds: targets.map((t) => t.id),
  });
}

/** Mark: the target takes extra damage from every source for a while (longer with more `power`). */
export function castMark(state: BattleState, ranger: Unit, target: Unit, power = 1): void {
  const mark = UNIT_CLASSES.ranger.mark;
  target.mark = { ticksLeft: secondsToTicks(mark.durationSeconds * power), damageTakenBonus: mark.damageTakenBonus };
  ranger.skillCooldown = skillCooldownTicks('ranger');
  state.events.push({ tick: state.tick, type: 'skill', unitId: ranger.id, skill: 'mark', targetIds: [target.id] });
}

/** Barrier: shields one ally; the shield soaks damage before HP until it breaks or runs out. */
export function castBarrier(state: BattleState, guardian: Unit, target: Unit, power = 1): void {
  const barrier = UNIT_CLASSES.guardian.barrier;
  target.barrier = { amount: Math.round(barrier.amount * power), ticksLeft: secondsToTicks(barrier.durationSeconds) };
  guardian.skillCooldown = skillCooldownTicks('guardian');
  state.events.push({ tick: state.tick, type: 'skill', unitId: guardian.id, skill: 'barrier', targetIds: [target.id] });
}
