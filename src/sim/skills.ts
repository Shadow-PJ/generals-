// Troop skills: Shove (Vanguard), Mark (Ranger) and Barrier (Guardian), with what their
// specializations change. The Invoker's Rift is in rift.ts, the Assassin's Shadowstep in shadowstep.ts.
// Troops use them on their own when they are ready; an Overcharge card fires them at once.

import { SPEC_RULES } from '../data/specializations';
import { SYNERGY_RULES } from '../data/synergies';
import { UNIT_CLASSES, type UnitClass } from '../data/units';
import { dealDamage } from './combat';
import { distance } from './geometry';
import { edgeDistance, livingEnemies } from './queries';
import { applyTaunt, interruptCast } from './status';
import { hasSynergy, noteSynergy } from './synergies';
import { secondsToTicks } from './time';
import type { BattleState, Unit } from './types';

export function skillCooldownTicks(cls: UnitClass): number {
  return secondsToTicks(skillTiming(cls).cooldownSeconds);
}

/** How long this troop waits for its skill again: its class's cooldown, cut by its perks and boons. */
export function skillCooldownFor(unit: Unit): number {
  return Math.round(skillCooldownTicks(unit.cls) * (1 - unit.skillHaste));
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
    case 'invoker':
      return UNIT_CLASSES.invoker.rift;
    case 'assassin':
      return UNIT_CLASSES.assassin.shadowstep;
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
 * Anvil) leaves them unable to act for a while after the push. Breakers push further and harder.
 * A push breaks an Invoker's cast; Iron Wall Vanguards can't be pushed.
 */
export function castShove(state: BattleState, vanguard: Unit, power = 1, stunTicks = 0): void {
  const shove = UNIT_CLASSES.vanguard.shove;
  const targets = shoveTargets(state, vanguard);
  if (targets.length === 0) return;
  const breaker = vanguard.spec === 'breaker' ? SPEC_RULES.breaker : { pushMultiplier: 1, shoveDamageMultiplier: 1 };
  const pushTicks = Math.max(1, secondsToTicks(shove.pushSeconds));
  const perTick = (shove.pushDistance * power * breaker.pushMultiplier) / pushTicks;
  for (const target of targets) {
    const d = distance(vanguard.x, vanguard.y, target.x, target.y);
    // Two units on the same spot: push toward the enemy's side of the map.
    const nx = d === 0 ? (vanguard.side === 'player' ? 1 : -1) : (target.x - vanguard.x) / d;
    const ny = d === 0 ? 0 : (target.y - vanguard.y) / d;
    if (immovable(state, target)) {
      noteSynergy(state, target.side, 'ironWall');
    } else {
      target.knockback = { dx: nx * perTick, dy: ny * perTick, ticksLeft: pushTicks, byId: vanguard.id, burned: false };
      interruptCast(state, target, vanguard.id);
    }
    if (stunTicks > 0) {
      target.stunTicks = Math.max(target.stunTicks, pushTicks + stunTicks);
      interruptCast(state, target, vanguard.id);
    }
    dealDamage(state, vanguard.id, target, shove.damage * power * breaker.shoveDamageMultiplier, vanguard.stats.armorPierce, 'shove');
  }
  vanguard.skillCooldown = skillCooldownFor(vanguard);
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
  ranger.skillCooldown = skillCooldownFor(ranger);
  state.events.push({ tick: state.tick, type: 'skill', unitId: ranger.id, skill: 'mark', targetIds: [target.id] });
}

/**
 * Barrier: shields one ally; the shield soaks damage before HP until it breaks or runs out.
 * A Warden's is bigger, and enemies near the shielded ally must attack it for a while; a
 * Mender's is smaller but heals the ally over time.
 */
export function castBarrier(state: BattleState, guardian: Unit, target: Unit, power = 1): void {
  const barrier = UNIT_CLASSES.guardian.barrier;
  const size =
    guardian.spec === 'warden' ? SPEC_RULES.warden.barrierMultiplier : guardian.spec === 'mender' ? SPEC_RULES.mender.barrierMultiplier : 1;
  target.barrier = { amount: Math.round(barrier.amount * power * size), ticksLeft: secondsToTicks(barrier.durationSeconds) };
  guardian.skillCooldown = skillCooldownFor(guardian);
  state.events.push({ tick: state.tick, type: 'skill', unitId: guardian.id, skill: 'barrier', targetIds: [target.id] });
  if (guardian.spec === 'warden') {
    const warden = SPEC_RULES.warden;
    for (const enemy of livingEnemies(state, target)) {
      if (edgeDistance(enemy, target) <= warden.tauntRadius) applyTaunt(enemy, target.id, secondsToTicks(warden.tauntSeconds));
    }
  } else if (guardian.spec === 'mender') {
    const mender = SPEC_RULES.mender;
    target.regen = { amount: Math.round(mender.healPerSecond * power), ticksLeft: secondsToTicks(mender.healSeconds) };
  }
}

/** Iron Wall: a Vanguard with a Barrier, on a side with the synergy, can't be knocked back. */
export function immovable(state: BattleState, unit: Unit): boolean {
  return unit.cls === 'vanguard' && unit.barrier !== null && hasSynergy(state, unit.side, 'ironWall');
}

/**
 * Iron Wall: each Vanguard with a Barrier taunts the enemies close to it, renewed every tick
 * while they stay close and the Barrier lasts.
 */
export function ironWallTaunts(state: BattleState): void {
  const wall = SYNERGY_RULES.ironWall;
  for (const unit of state.units) {
    if (!unit.alive || !immovable(state, unit)) continue;
    let taunted = false;
    for (const enemy of livingEnemies(state, unit)) {
      if (edgeDistance(enemy, unit) > wall.tauntRadius) continue;
      applyTaunt(enemy, unit.id, secondsToTicks(wall.tauntSeconds));
      taunted = true;
    }
    if (taunted) noteSynergy(state, unit.side, 'ironWall');
  }
}
