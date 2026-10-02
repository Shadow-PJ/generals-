// What carries from screen to screen: where your troops stand, your cards and your rank.

import type { Loadout } from '../cards/types';
import type { TroopPlacement } from '../data/armies';
import type { RankNumber } from '../data/ranks';

export interface MatchSetup {
  placement: TroopPlacement[];
  loadout: Loadout;
  /** Set by the debug switch on the Orders screen until ranks are earned (session 5A). */
  rank: RankNumber;
  /** Tactical mode: the battle pauses every 10 s so you can choose cards calmly; no Perfect timing. */
  tactical: boolean;
}
