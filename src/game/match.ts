// What carries from screen to screen: your troops and where they stand, your cards, your rank and General.

import type { Encounter } from '../campaign/types';
import type { Loadout } from '../cards/types';
import type { EnemyArmy, Troop, TroopPlacement } from '../data/armies';
import type { BoonId } from '../data/boons';
import type { GeneralId } from '../data/generals';
import type { MapId } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import type { SpecChoice } from '../data/specializations';
import type { UnitClass } from '../data/units';

export interface MatchSetup {
  placement: TroopPlacement[];
  loadout: Loadout;
  /** The rank you fight at: your Command Rank, earned with Command XP (session 5A), or your practice rank. */
  rank: RankNumber;
  /** Skirmish practice at any rank, earning no Command XP; null to fight at your own rank. */
  practiceRank: RankNumber | null;
  /** Boss Generals you have beaten: each teaches a Legendary action. Set on the Skirmish screen until the bosses arrive (5D). */
  bossesBeaten: GeneralId[];
  /** Tactical mode: the battle pauses every 10 s so you can choose cards calmly; no Perfect timing. */
  tactical: boolean;
  /** Who reads your cards. Set by the debug switch on the Orders screen until you recruit Generals (phase 5). */
  general: GeneralId;
  /** Your 3 reserve troops. The classes of your army, reserves and specializations are set on the debug Troops screen for now. */
  reserves: UnitClass[];
  /** Your specialization for each class, until the Tech Web sells them (phase 5). */
  specs: SpecChoice;
  /** Skirmish: the map, the enemy's army and General, and its commander's rank (null: no commander, no enemy cards). */
  map: MapId;
  enemyArmy: EnemyArmy;
  enemyGeneral: GeneralId;
  enemyCommander: RankNumber | null;
  /** A campaign fight (session 5B), or null for a skirmish. In a campaign fight the enemy and your reserves come from it. */
  fight: CampaignFight | null;
  /** Where the General, Codex and Settings screens go back to: the Prep screen, unless the Capital opened them. */
  returnTo?: 'Capital';
}

/** A fight on a run: the enemy at your node, and your run's reserve fighters and boons. */
export interface CampaignFight {
  encounter: Encounter;
  reserves: Troop[];
  boons: BoonId[];
}
