// The campaign's state (session 5B): what you keep between runs, and the run you are on. Plain
// data, so it is saved with your profile and a run carries on exactly where you closed the game.

import type { Troop, TroopPlacement } from '../data/armies';
import type { ArtifactId } from '../data/artifacts';
import type { BoonId } from '../data/boons';
import type { EventId } from '../data/events';
import type { GeneralId } from '../data/generals';
import type { LegendaryAction } from '../cards/types';
import type { MapId } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import type { Rarity } from '../data/rarity';
import type { RegionId } from '../data/regions';
import type { NodeKind } from '../data/runs';
import type { TroopClass } from '../data/units';
import type { RngState } from '../sim';

/** What the campaign keeps: the run you are on, your banked artifacts and the bosses you have beaten. */
export interface Campaign {
  run: RunState | null;
  /** Artifacts banked for good, at a camp or by winning a run. */
  artifacts: ArtifactId[];
  bossesBeaten: GeneralId[];
}

/** One of your troops in a run. */
export interface Fighter {
  id: number;
  cls: TroopClass;
  rarity: Rarity;
  /** Share of max HP left, above 0: a fighter who falls in a won fight gets back up hurt. */
  hp: number;
  /** Where it stood last time, on your side of the map; null to let the game pick a spot. */
  spot: { x: number; y: number } | null;
}

/** A node on a run's map, and the nodes on the next floor it leads to. */
export interface RunNode {
  kind: NodeKind;
  next: number[];
}

/** A fighter or a boon, offered in the spoils or sold by the merchant. */
export type Offer = { kind: 'fighter'; cls: TroopClass; rarity: Rarity } | { kind: 'boon'; boon: BoonId };

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

export interface MerchantItem {
  offer: Offer;
  price: number;
  sold: boolean;
}

/** What waits for you at the node you are on, until you are done there. */
export type Stop =
  | { kind: 'fight'; encounter: Encounter }
  /** After a won fight: the gold and any artifact are already yours; pick one offer or skip. */
  | { kind: 'spoils'; gold: number; artifact: ArtifactId | null; offers: Offer[] }
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
}
