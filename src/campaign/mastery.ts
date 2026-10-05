// General Mastery in the campaign (session 5E): which challenges you have met, the titles they
// gave, and the Generals whose look you have earned. Checking a battle against the challenges is
// in src/game/mastery.ts. Pure functions.

import { GENERAL_IDS, GENERALS, type GeneralId } from '../data/generals';
import { MASTERY, type MasteryId } from '../data/mastery';
import type { Campaign } from './types';

export function masteryId(general: GeneralId, index: number): MasteryId {
  return `${general}.${index}` as MasteryId;
}

/** The campaign with these challenges met too. */
export function withMastery(campaign: Campaign, met: readonly MasteryId[]): Campaign {
  const fresh = met.filter((id) => !campaign.mastery.includes(id));
  return fresh.length === 0 ? campaign : { ...campaign, mastery: [...campaign.mastery, ...fresh] };
}

/** True when all three of the General's challenges are met: your troops wear their gold trim. */
export function hasLook(campaign: Pick<Campaign, 'mastery'>, general: GeneralId): boolean {
  return MASTERY[general].every((_, i) => campaign.mastery.includes(masteryId(general, i)));
}

/** A challenge's title with its General: "Captain the Calm". */
export function titleOf(id: MasteryId): string {
  const [general, index] = id.split('.') as [GeneralId, string];
  const challenge = GENERAL_IDS.includes(general) ? MASTERY[general][Number(index)] : undefined;
  return challenge ? `${GENERALS[general].name.replace(/^The /, '')} ${challenge.title}` : '';
}

/** The titles you have earned, in the order you earned them. */
export function titles(campaign: Pick<Campaign, 'mastery'>): string[] {
  return campaign.mastery.map(titleOf).filter((t) => t !== '');
}
