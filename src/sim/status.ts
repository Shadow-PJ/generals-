// Effects that last a while on a troop: slows, taunts, silences, a broken Rift cast, and what
// the Generals' skills do to a troop's armor, damage and attack speed.

import { TROOP_SKILLS, ULTIMATE_RULES } from '../data/generals';
import { UNIT_CLASSES } from '../data/units';
import { secondsToTicks } from './time';
import type { BattleState, DamageCause, Unit } from './types';

/** Slows a unit; a stronger slow replaces a weaker one, and an equal one lasts the longer time. */
export function applySlow(unit: Unit, share: number, ticks: number): void {
  const now = unit.slow;
  if (!now || share > now.share || (share === now.share && ticks > now.ticksLeft)) unit.slow = { share, ticksLeft: ticks };
}

/** How much of its speed a unit keeps: slows and Feigned Retreat's chase multiply. */
export function speedFactor(unit: Unit): number {
  const chased = unit.chased ? 1 - unit.chased.slow : 1;
  const slowed = unit.slow ? 1 - unit.slow.share : 1;
  return chased * slowed;
}

/** Makes a unit attack the taunter for a while. A newer taunt by someone else waits until this one ends. */
export function applyTaunt(unit: Unit, taunterId: number, ticks: number): void {
  if (unit.taunt && unit.taunt.unitId !== taunterId) return;
  unit.taunt = { unitId: taunterId, ticksLeft: Math.max(ticks, unit.taunt?.ticksLeft ?? 0) };
}

/** Silences a unit: no skills for a while, and a cast it is making breaks. */
export function silence(state: BattleState, unit: Unit, ticks: number, byId: number): void {
  unit.silencedTicks = Math.max(unit.silencedTicks, ticks);
  interruptCast(state, unit, byId);
}

/** Breaks an Invoker's cast, if it is casting: no Rift, and the skill is ready again a little sooner. */
export function interruptCast(state: BattleState, unit: Unit, byId: number | null): void {
  if (!unit.casting) return;
  unit.casting = null;
  unit.skillCooldown = secondsToTicks(UNIT_CLASSES.invoker.rift.interruptedCooldownSeconds);
  state.events.push({ tick: state.tick, type: 'interrupted', unitId: unit.id, byId });
}

/** Armor after a shell (Assimilation) and a shatter (Echo Strike), 0 to 0.9. */
export function effectiveArmor(unit: Unit): number {
  const shell = unit.adaptation?.kind === 'shell' ? TROOP_SKILLS.assimilation.shellArmor : 0;
  const shattered = unit.shatterTicks > 0 ? TROOP_SKILLS.echoStrike.shatterArmorLoss : 0;
  return Math.max(0, Math.min(0.9, unit.stats.armor + shell - shattered));
}

/** How much harder the troop hits: claws (Assimilation) and a wraith (Reaper's Toll). */
export function damageFactor(unit: Unit): number {
  const claws = unit.adaptation?.kind === 'claws' ? TROOP_SKILLS.assimilation.clawsDamageBonus : 0;
  const wraith = unit.wraithTicks > 0 ? ULTIMATE_RULES.reapersToll.wraithDamageBonus : 0;
  return (1 + claws) * (1 + wraith);
}

/** How much faster the troop attacks: Rally and Vampiric Link. */
export function attackSpeedFactor(unit: Unit): number {
  const rally = unit.rallyTicks > 0 ? 1 + unit.rallyBonus : 1;
  const haste = unit.haste ? 1 + unit.haste.bonus : 1;
  return rally * haste;
}

/**
 * Echo Strike: a hit adds a Vibration stack, up to the most. Reaching the most shatters the
 * enemy's armor for a while. Stacks fade if no new hit lands for a while.
 */
export function addVibration(state: BattleState, target: Unit, sourceId: number): void {
  const echo = TROOP_SKILLS.echoStrike;
  const stacks = Math.min(echo.maxStacks, (target.vibration?.stacks ?? 0) + 1);
  target.vibration = { stacks, ticksLeft: secondsToTicks(echo.stackSeconds) };
  if (stacks === echo.maxStacks && target.shatterTicks <= 0) {
    target.shatterTicks = secondsToTicks(echo.shatterSeconds);
    state.events.push({ tick: state.tick, type: 'skill', unitId: sourceId, skill: 'shatter', targetIds: [target.id] });
  }
}

/** A troop pays HP for something (Vampiric Link, Blood Price, a vent): never its last point. Returns what it paid. */
export function payHp(state: BattleState, unit: Unit, amount: number, cause: DamageCause): number {
  const paid = Math.min(unit.hp - 1, Math.round(amount));
  if (paid <= 0) return 0;
  unit.hp -= paid;
  state.events.push({ tick: state.tick, type: 'damage', sourceId: unit.id, targetId: unit.id, amount: paid, absorbed: 0, cause });
  return paid;
}
