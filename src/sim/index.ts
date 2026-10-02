// The battle engine's public face. The renderer and tools import from here.

export { createBattle, runBattle, stepBattle } from './battle';
export { overtimeMultiplier } from './overtime';
export { inComeback, LEGENDARY_SLOT, SLOT_COUNT, slotReadiness, ultimateReady, type SlotReadiness } from './command';
export { TICKS_PER_SECOND, formatBattleTime, secondsToTicks, ticksToSeconds } from './time';
export { otherSide, SIDES } from './types';
export type {
  BattleEvent,
  BattleInput,
  CommandState,
  SlotState,
  UnitOrder,
  BattleResult,
  BattleSetup,
  BattleState,
  Projectile,
  Side,
  SkillName,
  Unit,
  Wall,
  Winner,
} from './types';
export { isArmyPlaced, placementProblem, type PlacementProblem } from './placement';
