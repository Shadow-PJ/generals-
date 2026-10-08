// The campaign's state (session 5B): what you keep between runs, and the run you are on. Plain
// data, so it is saved with your profile and a run carries on exactly where you closed the game.

import type { Troop, TroopPlacement } from '../data/armies';
import type { ArtifactId } from '../data/artifacts';
import type { BoonId } from '../data/boons';
import type { DealId } from '../data/crossroads';
import type { EventId } from '../data/events';
import type { FactionId } from '../data/factions';
import type { GeneralId } from '../data/generals';
import type { Card, LegendaryAction } from '../cards/types';
import type { MasteryId } from '../data/mastery';
import type { MapId } from '../data/maps';
import type { OathRanks } from '../data/oaths';
import type { RankNumber } from '../data/ranks';
import type { Rarity } from '../data/rarity';
import type { RegionId } from '../data/regions';
import type { NodeKind } from '../data/runs';
import type { PerkId } from '../data/perks';
import type { SpecializationId } from '../data/specializations';
import type { TechNodeId } from '../data/tech';
import type { TroopClass } from '../data/units';
import type { RngState } from '../sim';

/**
 * What the campaign keeps: the run you are on, your banked artifacts, the bosses you have beaten,
 * (session 5E) your company, Insight, Tech Web, Ironman mode and the Mastery challenges met, and
 * (session 5F) the oaths for your next run and the highest Fear you have won each region at.
 */
export interface Campaign {
  run: RunState | null;
  /** Artifacts banked for good, at a camp or by winning a run. Equipping one on a company troop doesn't take it out. */
  artifacts: ArtifactId[];
  bossesBeaten: GeneralId[];
  /** The troops you set out with on every run, up to 8: the field first, then the reserves. */
  company: Veteran[];
  /** Insight to spend on the Tech Web. */
  insight: number;
  tech: TechWeb;
  /** Ironman mode, for the next run: a troop that falls dies for good. */
  ironman: boolean;
  /** General Mastery challenges met. */
  mastery: MasteryId[];
  /** Oaths of Command for the next run: the run you are on keeps the ones it began with. */
  oaths: OathRanks;
  /** The highest Fear at which you have won each region's run. */
  fearRecords: Partial<Record<RegionId, number>>;
}

/** What each class has bought of its Tech Web: nodes, and the specialization taken (one at most). */
export type TechWeb = Partial<Record<TroopClass, { nodes: TechNodeId[]; spec: SpecializationId | null }>>;

/** A fighter's record: battles fought (on the field, or called in from reserve), enemies killed, and kills in boss fights. */
export interface FighterRecord {
  battles: number;
  kills: number;
  bossKills: number;
}

/** A troop of your company, between runs. */
export interface Veteran extends FighterTraits {
  id: number;
  name: string;
  record: FighterRecord;
  /** The artifact it carries: one of your banked artifacts, on one troop at most. */
  artifact: ArtifactId | null;
}

/** What makes a fighter who they are: class, rarity, faction (or none) and perks (session 5C). */
export interface FighterTraits {
  cls: TroopClass;
  rarity: Rarity;
  faction: FactionId | null;
  perks: PerkId[];
}

/** One of your troops in a run. */
export interface Fighter extends FighterTraits {
  id: number;
  name: string;
  record: FighterRecord;
  artifact: ArtifactId | null;
  /** The company troop this fighter is, or null for one who joined during the run. */
  veteranId: number | null;
  /** Share of max HP left, above 0: a fighter who falls in a won fight gets back up hurt. */
  hp: number;
  /** It fell in the last fight, so it sits this one out. */
  wounded: boolean;
  /** Where it stood last time, on your side of the map; null to let the game pick a spot. */
  spot: { x: number; y: number } | null;
}

/** A node on a run's map, and the nodes on the next floor it leads to. */
export interface RunNode {
  kind: NodeKind;
  next: number[];
  /** A battle that is a crossroads (session 7F): won, it offers two deals instead of the spoils' pick. */
  crossroads?: true;
}

/** A fighter or a boon, offered in the spoils or sold by the merchant. */
export type Offer = ({ kind: 'fighter' } & FighterTraits) | { kind: 'boon'; boon: BoonId };

/** The enemy at a fight node: its army on your region's map, its General and its commander. */
export interface Encounter {
  kind: 'battle' | 'elite' | 'boss';
  /** The battle's seed, fixed when you reach the node. */
  seed: number;
  map: MapId;
  general: GeneralId;
  commander: RankNumber | null;
  troops: TroopPlacement[];
  reserves: Troop[];
}

/** An elite fight's commander, beaten: its General and rank. */
export interface BeatenCommander {
  general: GeneralId;
  rank: RankNumber;
}

export interface MerchantItem {
  offer: Offer;
  price: number;
  sold: boolean;
}

/** What waits for you at the node you are on, until you are done there. */
export type Stop =
  | { kind: 'fight'; encounter: Encounter }
  /**
   * After a won fight: the gold and any artifact are already yours; pick one offer or skip. After
   * an elite fight, `commander` is the beaten commander, whose orders are offered next (session 7D).
   */
  | { kind: 'spoils'; gold: number; artifact: ArtifactId | null; offers: Offer[]; commander: BeatenCommander | null }
  /** After an elite fight's spoils: take one of the beaten commander's cards as your decree, or keep yours (session 7D). */
  | { kind: 'decree'; commander: BeatenCommander }
  /**
   * After a won crossroads battle (session 7F): its gold is yours; take one of two deals. `chosen`
   * is null until you take one; then `outcome` says what happened.
   */
  | { kind: 'crossroads'; gold: number; deals: DealId[]; chosen: number | null; outcome: string[] }
  /** `chosen` is null until you choose; then `outcome` says what happened. */
  | { kind: 'event'; event: EventId; chosen: number | null; outcome: string[] }
  | { kind: 'merchant'; stock: MerchantItem[]; rerolls: number }
  /** The camp healed you and banked what you carried. */
  | { kind: 'camp'; healed: number; banked: ArtifactId[] }
  | {
      kind: 'end';
      won: boolean;
      /** Artifacts banked by the win, or lost with the run. */
      banked: ArtifactId[];
      lost: ArtifactId[];
      /** What beating the ruler brought. */
      learned: LegendaryAction | null;
      opened: RegionId[];
      unlocked: TroopClass | null;
      /** A won run: the fighters who will stay in your company (up to 8). You change it before going back. */
      keep: number[];
      /** A run lost in Ironman: the fighters who fell in the last fight, gone for good. */
      died: number[];
      /** The run's Fear, and the Insight a win above the region's highest Fear yet paid. */
      fear: number;
      bounty: number;
    };

export interface RunState {
  region: RegionId;
  /** Bosses you had beaten when the run began: each makes its fights harder. */
  level: number;
  seed: number;
  /** Every roll of the run (map, enemies, offers, events) comes from here, so a run is the same for the same seed and choices. */
  rng: RngState;
  /** Floors of nodes, first floor first; the last floor holds the boss. */
  map: RunNode[][];
  /** The node taken on each floor so far; the last is where you are. */
  path: number[];
  stop: Stop | null;
  gold: number;
  roster: Fighter[];
  nextFighterId: number;
  /** Fighter ids on the field (up to 5) and in reserve (up to 3) for the next fight; the rest wait. */
  field: number[];
  reserves: number[];
  boons: BoonId[];
  /** Artifacts found and carried, not banked yet. */
  artifacts: ArtifactId[];
  eventsSeen: EventId[];
  fightsWon: number;
  /** Command XP earned in this run's battles. */
  xp: number;
  /** Insight earned in this run's battles. */
  insight: number;
  /** Ironman mode, set when the run began: a fighter who falls dies. */
  ironman: boolean;
  /** Oaths of Command taken when the run began (session 5F). */
  oaths: OathRanks;
  /** A beaten commander's card your army fires by itself in the run's battles (session 7D), or null. */
  decree: Card | null;
}
