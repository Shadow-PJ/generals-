// The battle engine's public face. The renderer and tools import from here.

export { createBattle, runBattle, stepBattle } from './battle';
export { overtimeMultiplier } from './overtime';
export {
  chainTicksLeft,
  bloodPayer,
  inComeback,
  LEGENDARY_SLOT,
  momentumFull,
  nextLink,
  SLOT_COUNT,
  slotCost,
  slotReadiness,
  ultimateReady,
  type SlotReadiness,
} from './command';
export { TICKS_PER_SECOND, formatBattleTime, secondsToTicks, ticksToSeconds } from './time';
export { activeSynergies } from './synergies';
export { hiddenFromSide } from './queries';
export { ultimateOf } from './ultimates';
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
  Zone,
} from './types';
export { isArmyPlaced, placementProblem, type PlacementProblem } from './placement';
