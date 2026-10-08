// Decrees (session 7D): after an elite fight, you may take one of the beaten commander's cards as
// your run's decree, a standing order your army fires by itself in every battle of the run. The
// cards are the ones that commander fought with, as far as your rank can follow them; each goes
// through the validator at your rank like any card. Pure.

import { validateCard } from '../cards/validator';
import type { Card } from '../cards/types';
import { enemyScript } from '../data/enemyScripts';
import type { GeneralId } from '../data/generals';
import type { RankNumber } from '../data/ranks';

/**
 * The beaten commander's cards you may take: its script at its rank, or at yours when yours is
 * lower (the steps your rank hasn't unlocked are left out). None at Rank I, which has no Auto.
 */
export function decreeOffers(general: GeneralId, commanderRank: RankNumber, yourRank: RankNumber): Card[] {
  const rank = Math.min(commanderRank, yourRank) as RankNumber;
  return enemyScript(general, rank).slots.filter((card): card is Card => card !== null && validateCard(card, yourRank).ok);
}
