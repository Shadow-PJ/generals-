// What carries from screen to screen: where your troops stand, your cards, your rank and General.

import type { Loadout } from '../cards/types';
import type { TroopPlacement } from '../data/armies';
import type { GeneralId } from '../data/generals';
import type { RankNumber } from '../data/ranks';

export interface MatchSetup {
  placement: TroopPlacement[];
  loadout: Loadout;
  /** Set by the debug switch on the Orders screen until ranks are earned (session 5A). */
  rank: RankNumber;
  /** Tactical mode: the battle pauses every 10 s so you can choose cards calmly; no Perfect timing. */
  tactical: boolean;
  /** Who reads your cards. Set by the debug switch on the Orders screen until you recruit Generals (phase 5). */
  general: GeneralId;
}
