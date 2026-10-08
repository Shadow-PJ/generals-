// The battle engine's public face. The renderer and tools import from here.

export { createBattle, runBattle, stepBattle } from './battle';
export { stateHash } from './hash';
export { overtimeMultiplier } from './overtime';
export {
  chainTicksLeft,
  bloodPayer,
  commandOf,
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
export { factionCounts } from './factions';
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
export { createRng, nextFloat, nextInt, nextUint32, type RngState } from './rng';
