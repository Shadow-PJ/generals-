// Battle state. Everything here is plain data: it can be copied, saved, hashed and
// sent over the network, and the same state plus the same step always gives the same result.

import type { Card, LegendaryAction, Loadout, Place, Step, Target } from '../cards/types';
import type { SignatureComboId } from '../data/combos';
import type { Troop, TroopPlacement } from '../data/armies';
import type { BoonId } from '../data/boons';
import type { FactionId } from '../data/factions';
import type { Rarity } from '../data/rarity';
import type { GeneralId, UltimateId } from '../data/generals';
import type { MapData, Rect } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import type { SpecChoice, SpecializationId } from '../data/specializations';
import type { SynergyId } from '../data/synergies';
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
  /** Troops waiting off the field until a Call Reserve card brings them in: a class, or a run fighter. */
  reserves?: { player: (UnitClass | Troop)[]; enemy: (UnitClass | Troop)[] };
  /** Tactical mode: the screen pauses every 10 s, and there is no Perfect timing. */
  tactical?: boolean;
  /** Your General: reads your cards by their personality rules, and gives your troops their skill and doctrine. The Captain when left out. */
  general?: GeneralId;
  /** The enemy's General: its troops' skill and doctrine, and its commander's ultimate, twist and card style. The Captain when left out. */
  enemyGeneral?: GeneralId;
  /** An enemy commander: its rank and the cards it fires by script (all Auto). None when left out. */
  enemyCommander?: { rank: RankNumber; loadout: Loadout };
  /** Each side's specializations, one per class; none when left out. */
  specs?: { player?: SpecChoice; enemy?: SpecChoice };
  /** The Legendary actions you have learned from bosses; with one or more the Legendary slot opens. None when left out. */
  learned?: LegendaryAction[];
  /** Each side's boons from a run (session 5B): stronger troops, more pips and Momentum. None when left out. */
  boons?: { player?: BoonId[]; enemy?: BoonId[] };
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
  /** Who pushed; null for a pull (Gravity Well). */
  byId: number | null;
  /** Fire Break already burned the unit during this push. */
  burned: boolean;
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

/** Feigned Retreat: an enemy that chased into it moves slower and takes more damage for a while. */
export interface Chased {
  ticksLeft: number;
  /** Share of speed lost (0.5 = half speed). */
  slow: number;
  damageTakenBonus: number;
}

/** Moving slower for a while: a frost Rift, or a frost arrow (Crossfire). */
export interface Slow {
  /** Share of speed lost (0.4 = 40% slower). */
  share: number;
  ticksLeft: number;
}

/** Taunted (Warden, Iron Wall): the unit must attack the taunter for a while. */
export interface Taunt {
  unitId: number;
  ticksLeft: number;
}

/** Healing over time (Mender): `amount` HP every second while it lasts. */
export interface Regen {
  amount: number;
  ticksLeft: number;
}

/** A while of faster attacks (Vampiric Link): `bonus` 2 = three times as fast. */
export interface Haste {
  bonus: number;
  ticksLeft: number;
}

/** Hive Mother's Assimilation: a kill grows a shell (armor) or claws (damage) for a while. */
export interface Adaptation {
  kind: 'shell' | 'claws';
  ticksLeft: number;
}

/** Conductor's Echo Strike: Vibration stacks on an enemy, which fade if no new hit lands for a while. */
export interface Vibration {
  stacks: number;
  ticksLeft: number;
}

/** An Invoker opening a Rift: it stands still until the cast ends, unless something breaks the cast. */
export interface Cast {
  ticksLeft: number;
  /** Where the Rift opens. */
  x: number;
  y: number;
  /** HP lost since the cast began; too much breaks it. */
  damageTaken: number;
}

/** What a Rift is made of: plain, or fire (Pyromancer) or frost (Frostcaller). */
export type ZoneElement = 'arcane' | 'fire' | 'frost';

/** A Rift: a zone on the ground that hurts the other side's troops inside it, once per pulse. */
export interface Zone {
  id: number;
  /** The Invoker that opened it. */
  ownerId: number;
  side: Side;
  x: number;
  y: number;
  radius: number;
  element: ZoneElement;
  /** Damage each pulse deals to every enemy inside, before armor. */
  damage: number;
  /** Share of speed enemies inside lose (frost); 0 for none. */
  slow: number;
  ticksLeft: number;
  /** Ticks until the next pulse. */
  pulseIn: number;
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
  /** The signature combo this step completes, if any: it changes what the order does. */
  combo: SignatureComboId | null;
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
  /** Copied from src/data when the battle starts, with its specialization's changes. */
  stats: UnitStats;
  spec: SpecializationId | null;
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
  chased: Chased | null;
  /** A unit being shoved can't act. */
  knockback: Knockback | null;
  /** Ticks left of a stun (Hammer and Anvil): a stunned unit can't act. */
  stunTicks: number;
  slow: Slow | null;
  taunt: Taunt | null;
  /** Ticks left of a silence (Saboteur): no skills meanwhile. */
  silencedTicks: number;
  /** Ticks left invisible (Shadow Escort): enemies can't pick it as a target. */
  invisibleTicks: number;
  regen: Regen | null;
  /** The Rift an Invoker is casting; it can't act meanwhile. */
  casting: Cast | null;
  /** Where the troop started, or last finished a Move or Fall Back: Engineer Vanguards hold this spot. */
  home: Point;
  /** Ticks until the troop's General skill (Vampiric Link) is ready again. */
  troopSkillCooldown: number;
  haste: Haste | null;
  /** Engineer: attacks since the troop last vented. Thermal Detonation turns it into healing and damage. */
  heat: number;
  adaptation: Adaptation | null;
  /** Strategist: the troop's once-per-battle Phase Shift is spent. */
  phaseShiftUsed: boolean;
  /**
   * Strategist: the attacker whose blow the troop is dodging this tick. It takes no damage until
   * the tick ends, then teleports behind that attacker (resolvePhaseShifts).
   */
  phasingFrom: number | null;
  vibration: Vibration | null;
  /** Ticks left shattered (a full Vibration stack): less armor meanwhile. */
  shatterTicks: number;
  /** Reaper's Toll: an invulnerable wraith for this long, then it falls. */
  wraithTicks: number;
  /** Forced Evolution merged another troop into this one. */
  elite: boolean;
  lastHitBy: number | null;
  /** Path corners still to walk around walls; empty when the way is clear. */
  path: Point[];
  /** Tick at which the path is planned again. */
  repathTick: number;
  /** Orders from cards, the current one first. With none, the troop acts on its own. */
  orders: UnitOrder[];
  /** Ticks left of the Captain's Rally, and how much faster it makes the unit attack. */
  rallyTicks: number;
  rallyBonus: number;
  /** Ticks left under the other side's control (Hijack): it attacks its own army meanwhile. */
  hijackTicks: number;
  /** Rarer troops (run fighters) have more HP and damage. */
  rarity: Rarity;
  /** The run fighter this troop is, if any; the battle doesn't use it. */
  fighterId: number | null;
  /** Its faction, whose bonus it gets once its side has enough of the faction. */
  faction: FactionId | null;
  /** Share of the damage its attacks deal that it heals (perks and boons; Bloodbound adds more). */
  lifesteal: number;
  /** How much sooner its skill comes back (perks and boons): 0.25 = a quarter sooner. */
  skillHaste: number;
  /** Forgeborn: armor its attacks have added so far. */
  forgeArmor: number;
  /** Voidweavers: hits taken from attacks so far. */
  hitsTaken: number;
  /** Resonance: attacks made so far. */
  attacksMade: number;
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

/** Cards fired within a few seconds of each other (from Rank III). */
export interface ChainState {
  /** Links so far: 0 when no chain is open. The ultimate counts as a link. */
  links: number;
  /** When the last link was fired. */
  lastTick: number;
  /** The last step of the last card, for signature combos across the chain. */
  lastStep: Step | null;
  /** Reserves the last card called in, for an Ambush across the chain. */
  lastReserveIds: number[];
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
  chain: ChainState;
  /** The Legendary slot is open: a boss has taught at least one Legendary action. */
  legendaryOpen: boolean;
  /** The last regular card fired and who set it off, for Echo. */
  lastCard: { card: Card; triggerEnemyId: number | null; triggerAllyId: number | null } | null;
  /** Boons: pips refill this much faster (0.25 = 25%). */
  pipRateBonus: number;
  /** Boons: pips you can hold beyond your rank's. */
  maxPipBonus: number;
}

/** A wall on the battlefield. It blocks movement and shots until its HP runs out, unless it is unbreakable. */
export interface Wall extends Rect {
  id: number;
  hp: number;
  maxHp: number;
  unbreakable: boolean;
  /** Fortify: ticks until the wall falls by itself; null for the map's walls. */
  ticksLeft: number | null;
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
  /** Volley: the hit also lands on enemies this close to the target, at this share of the damage. */
  splash: { radius: number; share: number } | null;
  /** Crossfire: a Ranger's arrow that picks up the element of a Rift it flies through. */
  crossfire: boolean;
  element: 'burn' | 'frost' | null;
}

/** Troop skills, then the Generals' troop skills. */
export type SkillName =
  | 'shove'
  | 'mark'
  | 'barrier'
  | 'rift'
  | 'shadowstep'
  | 'vampiricLink'
  | 'vent'
  | 'assimilation'
  | 'phaseShift'
  | 'shatter';
/**
 * What dealt damage: a plain attack, a Shove, Overload's cost to the troop itself, Iron Shell's
 * reflection, a Rift's pulse, Fire Break's burn, Volley's splash, the strike after a Shadowstep,
 * an execution (Shadowstep, or a wraith's time running out), the HP a troop pays for Vampiric
 * Link or Blood Price, a vent (Venting), Thermal Detonation's beam, Shatterstorm, or a troop given
 * up to a Blood Pact.
 */
export type DamageCause =
  | 'attack'
  | 'shove'
  | 'overload'
  | 'reflect'
  | 'rift'
  | 'burn'
  | 'splash'
  | 'shadowstep'
  | 'execute'
  | 'drain'
  | 'bloodPrice'
  | 'vent'
  | 'beam'
  | 'shatterstorm'
  | 'sacrifice';
/** Damage that hits an area; Assassins take more of it. */
export const AREA_CAUSES: readonly DamageCause[] = ['shove', 'rift', 'burn', 'splash', 'vent', 'beam', 'shatterstorm'];
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
  /** An Invoker's cast was broken: by a hit, a Shove, a stun or a silence (`byId`: whose). */
  | { tick: number; type: 'interrupted'; unitId: number; byId: number | null }
  /** A troop synergy took effect for the first time this battle. */
  | { tick: number; type: 'synergy'; side: Side; synergy: SynergyId }
  | { tick: number; type: 'death'; unitId: number; killerId: number | null }
  | { tick: number; type: 'wallHit'; wallId: number; sourceId: number; amount: number }
  | { tick: number; type: 'wallBreak'; wallId: number; sourceId: number }
  | { tick: number; type: 'overtime' }
  /** `link`: 1 for a card on its own, 2 or more for a link in a chain. */
  | { tick: number; type: 'cardFired'; side: Side; slot: number; auto: boolean; perfect: boolean; cost: number; link: number }
  /** `at` and `to`: where it struck, for the ones that strike a place (Gravity Well; Thermal Detonation's beam runs from `at` to `to`). */
  | { tick: number; type: 'ultimate'; side: Side; name: UltimateId; link: number; finisher: boolean; at?: Point; to?: Point }
  /** Forced Evolution: `mergedId` joined `unitId`, which became an elite. */
  | { tick: number; type: 'evolved'; side: Side; unitId: number; mergedId: number }
  /** A signature combo landed: inside one card, or across two cards of a chain. */
  | { tick: number; type: 'combo'; side: Side; combo: SignatureComboId; acrossCards: boolean }
  | { tick: number; type: 'reserveCalled'; side: Side; unitId: number }
  /** Voidweavers: the troop phased out of a hit and took no damage. */
  | { tick: number; type: 'phased'; unitId: number; sourceId: number }
  /** A Legendary action: the troops it acted on, and where a Fortify wall rose (`wallId`, its middle `at`). */
  | { tick: number; type: 'legendary'; side: Side; action: LegendaryAction; unitIds: number[]; wallId?: number; at?: Point }
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
  /** Open Rifts. */
  zones: Zone[];
  nextZoneId: number;
  /** Each side's specializations. */
  specs: Record<Side, SpecChoice>;
  /** Each side's General: troop skill and doctrine (and, for your side, ultimate and mana twist). */
  generals: Record<Side, GeneralId>;
  /** Hive Mother's pack: the enemy each side's troops are hunting together, if any. */
  packPrey: Record<Side, number | null>;
  /** The troop synergies each side's army switched on, and those that have taken effect so far. */
  synergies: Record<Side, SynergyId[]>;
  synergiesSeen: Record<Side, SynergyId[]>;
  /** Total HP each side brought onto the field (reserves count once called in); a wounded run fighter brings less. */
  startHp: Record<Side, number>;
  events: BattleEvent[];
  result: BattleResult | null;
  /** Your cards, pips and Momentum. */
  command: CommandState;
  /** The enemy commander's, when the enemy has one. */
  enemyCommand: CommandState | null;
  /** Troops still waiting in reserve. */
  reserves: Record<Side, Troop[]>;
  /** Each side's boons. */
  boons: Record<Side, BoonId[]>;
  /** How many fighters of each faction each side counts (troops, reserves and faction boons). */
  factions: Record<Side, Partial<Record<FactionId, number>>>;
  tactical: boolean;
  /** Every input applied, in order: with the setup, this replays the battle exactly. */
  inputLog: BattleInput[];
}
