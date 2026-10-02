// Effects that last a while on a troop: slows, taunts, silences, and a broken Rift cast.

import { UNIT_CLASSES } from '../data/units';
import { secondsToTicks } from './time';
import type { BattleState, Unit } from './types';

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
