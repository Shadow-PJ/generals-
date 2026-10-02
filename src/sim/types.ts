// Battle state. Everything here is plain data: it can be copied, saved, hashed and
// sent over the network, and the same state plus the same step always gives the same result.

import type { Card, Loadout, Place, Target } from '../cards/types';
import type { TroopPlacement } from '../data/armies';
import type { GeneralId } from '../data/generals';
import type { MapData, Rect } from '../data/maps';
import type { RankNumber } from '../data/ranks';
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
  /** Your Command cards. Cards your rank doesn't allow are left out. */
  loadout?: Loadout;
  /** Your Command Rank; sets max pips and which slots are open. Rank I when left out. */
  rank?: RankNumber;
  /** Troops waiting off the field until a Call Reserve card brings them in. */
  reserves?: { player: UnitClass[]; enemy: UnitClass[] };
  /** Tactical mode: the screen pauses every 10 s, and there is no Perfect timing. */
  tactical?: boolean;
  /** Your General, who reads your cards by their personality rules. The Captain when left out. */
  general?: GeneralId;
}

/** A player input, stamped with the tick it takes effect on. A seed plus its inputs replays a battle. */
export type BattleInput =
  /** Fire a card slot: 0 to 3 are the regular slots, 4 the Legendary slot. */
  | { tick: number; kind: 'slot'; slot: number }
  | { tick: number; kind: 'ultimate' };

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

/** An order a card gave a troop. Troops carry out their orders one after another. */
export interface UnitOrder {
  kind: 'focus' | 'move' | 'fallBack' | 'hold' | 'protect' | 'overcharge';
  /** What the card named; turned into a unit or a point when the order starts. */
  target: Target | null;
  place: Place | null;
  /** The units that set off the card's condition, for "him" and "her". */
  triggerEnemyId: number | null;
  triggerAllyId: number | null;
  /** 1, or more after a Perfect timing: the troop hits harder and moves faster while it lasts. */
  power: number;
  started: boolean;
  ticksLeft: number;
  /** The unit it is about: whom to focus or protect, or the ally to move to. */
  unitId: number | null;
  /** Where to go, when the place is a spot on the map. */
  point: Point | null;
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
  /** Orders from cards, the current one first. With none, the troop acts on its own. */
  orders: UnitOrder[];
  /** Ticks left of the Captain's Rally. */
  rallyTicks: number;
}

export interface SlotState {
  card: Card | null;
  /** Ticks until the slot can fire again. */
  restTicks: number;
  /** The card's condition is met, or was within the last moment. */
  glowing: boolean;
  /** Ticks the glow lasts after the condition stops being true. */
  lingerTicks: number;
  /** Already fired during this glow; Auto waits for the condition to return. */
  firedThisGlow: boolean;
  /** Who set off the condition, for "him" and "her". */
  triggerEnemyId: number | null;
  triggerAllyId: number | null;
  /** How often the card fired by itself; a "when" card does so once per battle. */
  autoFires: number;
  lastAutoTick: number | null;
}

/** Your side's Command pips, Momentum and card slots. */
export interface CommandState {
  side: Side;
  rank: RankNumber;
  pips: number;
  maxPips: number;
  /** Progress toward the next pip, in ticks. */
  pipProgress: number;
  momentum: number;
  /** 0 to 3 the regular slots, 4 the Legendary slot. */
  slots: SlotState[];
}

/** A wall on the battlefield. It blocks movement and shots until its HP runs out. */
export interface Wall extends Rect {
  id: number;
  hp: number;
  maxHp: number;
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
  | { tick: number; type: 'wallHit'; wallId: number; sourceId: number; amount: number }
  | { tick: number; type: 'wallBreak'; wallId: number; sourceId: number }
  | { tick: number; type: 'overtime' }
  | { tick: number; type: 'cardFired'; side: Side; slot: number; auto: boolean; perfect: boolean; cost: number }
  | { tick: number; type: 'ultimate'; side: Side; name: 'rally' }
  | { tick: number; type: 'reserveCalled'; side: Side; unitId: number }
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
  /** The map's walls with their current HP; a wall at 0 HP is broken and blocks nothing. */
  walls: Wall[];
  /** Paths around the standing walls; rebuilt when a wall breaks. */
  nav: NavGraph;
  units: Unit[];
  projectiles: Projectile[];
  nextProjectileId: number;
  /** Total max HP each side brought onto the field (reserves count once called in). */
  startHp: Record<Side, number>;
  events: BattleEvent[];
  result: BattleResult | null;
  /** Your cards, pips and Momentum. The enemy gets its own in session 4D. */
  command: CommandState;
  /** Troops still waiting in reserve. */
  reserves: { player: UnitClass[]; enemy: UnitClass[] };
  tactical: boolean;
  /** Every input applied, in order: with the setup, this replays the battle exactly. */
  inputLog: BattleInput[];
}
