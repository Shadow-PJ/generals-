// Battle state. Everything here is plain data: it can be copied, saved, hashed and
// sent over the network, and the same state plus the same step always gives the same result.

import type { TroopPlacement } from '../data/armies';
import type { MapData } from '../data/maps';
import type { UnitClass, UnitStats } from '../data/units';
import type { Point } from './geometry';
import type { NavGraph } from './navigation';
import type { RngState } from './rng';

export type Side = 'player' | 'enemy';
export const SIDES: readonly Side[] = ['player', 'enemy'];

export function otherSide(side: Side): Side {
  return side === 'player' ? 'enemy' : 'player';
}

/** Everything needed to start a battle. The same setup always gives the same battle. */
export interface BattleSetup {
  seed: number;
  map: MapData;
  player: TroopPlacement[];
  enemy: TroopPlacement[];
}

export interface Knockback {
  /** Movement per tick. */
  dx: number;
  dy: number;
  ticksLeft: number;
}

export interface Mark {
  ticksLeft: number;
  /** Extra damage taken while Marked (0.2 = +20%). */
  damageTakenBonus: number;
}

export interface Barrier {
  amount: number;
  ticksLeft: number;
}

export interface Unit {
  /** Units are created and updated in id order; ids never change and are never reused. */
  id: number;
  side: Side;
  cls: UnitClass;
  /** Copied from src/data when the battle starts, so later upgrades can change one unit. */
  stats: UnitStats;
  x: number;
  y: number;
  hp: number;
  alive: boolean;
  /** What the unit attacked or moved toward on the last tick, for the renderer. */
  targetId: number | null;
  /** Ticks until the unit can attack again. */
  attackCooldown: number;
  /** Ticks until the unit's skill is ready. */
  skillCooldown: number;
  mark: Mark | null;
  barrier: Barrier | null;
  /** A unit being shoved can't act. */
  knockback: Knockback | null;
  lastHitBy: number | null;
  /** Path corners still to walk around walls; empty when the way is clear. */
  path: Point[];
  /** Tick at which the path is planned again. */
  repathTick: number;
}

export interface Projectile {
  id: number;
  ownerId: number;
  side: Side;
  targetId: number;
  x: number;
  y: number;
  /** World units per second. */
  speed: number;
  /** Damage before armor and Mark. */
  damage: number;
  armorPierce: number;
}

export type SkillName = 'shove' | 'mark' | 'barrier';
export type DamageCause = 'attack' | 'shove';
export type EndReason = 'eliminated' | 'timeout';
export type Winner = Side | 'draw';

/** The battle event log. Combos and Battle IQ read it later; the headless runner prints it. */
export type BattleEvent =
  | {
      tick: number;
      type: 'damage';
      sourceId: number;
      targetId: number;
      /** HP lost. */
      amount: number;
      /** Damage soaked up by a Barrier. */
      absorbed: number;
      cause: DamageCause;
    }
  | { tick: number; type: 'skill'; unitId: number; skill: SkillName; targetIds: number[] }
  | { tick: number; type: 'death'; unitId: number; killerId: number | null }
  | { tick: number; type: 'end'; winner: Winner; reason: EndReason };

export interface BattleResult {
  winner: Winner;
  reason: EndReason;
  /** How long the battle lasted. */
  durationTicks: number;
  /** Share of starting HP each side has left, 0 to 1. */
  hpShare: Record<Side, number>;
}

export interface BattleState {
  seed: number;
  tick: number;
  rng: RngState;
  map: MapData;
  nav: NavGraph;
  units: Unit[];
  projectiles: Projectile[];
  nextProjectileId: number;
  /** Total max HP each side started with. */
  startHp: Record<Side, number>;
  events: BattleEvent[];
  result: BattleResult | null;
}
