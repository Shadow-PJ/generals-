// Overtime: from a set point in the battle, all damage keeps growing until one side falls.

import { BATTLE_RULES } from '../data/battle';
import { secondsToTicks, TICKS_PER_SECOND } from './time';

export function overtimeStartTick(): number {
  return secondsToTicks(BATTLE_RULES.overtime.startSeconds);
}

/** Damage multiplier at this tick: 1 before Overtime, then rising every tick. */
export function overtimeMultiplier(tick: number): number {
  const start = overtimeStartTick();
  if (tick < start) return 1;
  return 1 + ((tick - start) / TICKS_PER_SECOND) * BATTLE_RULES.overtime.damageBonusPerSecond;
}
