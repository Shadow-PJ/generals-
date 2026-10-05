// Oaths of Command in a run (session 5F): what the oaths taken change, and what their Fear pays.
// The numbers are in src/data/oaths.ts.

import { MAX_FEAR, maxRank, OATH_RULES, oathValue, fearOf, type OathId, type OathRanks } from '../data/oaths';
import type { RegionId } from '../data/regions';
import { RUN_RULES } from '../data/runs';
import type { Campaign } from './types';

/** The campaign with an oath set to a rank (0 lifts it) for the next run. */
export function withOath(campaign: Campaign, id: OathId, rank: number): Campaign {
  const clamped = Math.max(0, Math.min(maxRank(id), Math.floor(rank)));
  const { [id]: _old, ...rest } = campaign.oaths;
  return { ...campaign, oaths: clamped === 0 ? rest : { ...rest, [id]: clamped } };
}

/** The Insight a battle earns under these oaths: more for every point of Fear. */
export function oathInsight(base: number, oaths: OathRanks): number {
  return Math.round(base * (1 + OATH_RULES.insightPerFear * fearOf(oaths)));
}

/** Gold from a fight, or for skipping the spoils, under these oaths. */
export function oathGold(gold: number, oaths: OathRanks): number {
  return Math.round(gold * (1 - oathValue(oaths, OATH_RULES.leanPurse.cut, 'leanPurse')));
}

/** What the merchant asks under these oaths, for something that costs `price`. */
export function oathPrice(price: number, oaths: OathRanks): number {
  return Math.round(price * (1 + oathValue(oaths, OATH_RULES.shortSupply.priceRise, 'shortSupply')));
}

/** The share of HP a fighter who fell gets back up with. */
export function fallenHp(oaths: OathRanks): number {
  return oathValue(oaths, OATH_RULES.lastingWounds.fallenHp, 'lastingWounds', RUN_RULES.fallenHp);
}

/** How much of their HP a camp gives back. */
export function campHeal(oaths: OathRanks): number {
  return RUN_RULES.campHeal * oathValue(oaths, OATH_RULES.lastingWounds.campHealShare, 'lastingWounds', 1);
}

/** How many offers the spoils hold. */
export function spoilsOffers(oaths: OathRanks): number {
  return Math.max(1, RUN_RULES.offers - oathValue(oaths, OATH_RULES.noQuarter.fewerOffers, 'noQuarter'));
}

/** The Insight a won run pays for beating the region above its highest Fear yet, and the new record. */
export function fearBounty(records: Campaign['fearRecords'], region: RegionId, fear: number): { bounty: number; record: number } {
  const best = records[region];
  if (best === undefined) return { bounty: fear * OATH_RULES.bountyPerFear, record: fear };
  return fear > best ? { bounty: (fear - best) * OATH_RULES.bountyPerFear, record: fear } : { bounty: 0, record: best };
}

export { fearOf, MAX_FEAR };
