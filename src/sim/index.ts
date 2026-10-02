// The battle engine's public face. The renderer and tools import from here.

export { createBattle, runBattle, stepBattle } from './battle';
export { TICKS_PER_SECOND, formatBattleTime, secondsToTicks, ticksToSeconds } from './time';
export { otherSide, SIDES } from './types';
export type {
  BattleEvent,
  BattleResult,
  BattleSetup,
  BattleState,
  Projectile,
  Side,
  SkillName,
  Unit,
  Winner,
} from './types';
