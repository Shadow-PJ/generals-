// What carries from screen to screen: your troops and where they stand, your cards, your rank and General.

import type { Loadout } from '../cards/types';
import type { EnemyArmy, TroopPlacement } from '../data/armies';
import type { GeneralId } from '../data/generals';
import type { MapId } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import type { SpecChoice } from '../data/specializations';
import type { UnitClass } from '../data/units';

export interface MatchSetup {
  placement: TroopPlacement[];
  loadout: Loadout;
  /** Set by the debug switch on the Orders screen until ranks are earned (session 5A). */
  rank: RankNumber;
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
}
