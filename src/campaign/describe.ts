// Words for the campaign's screens: fighters, offers and node kinds.

import { BOONS } from '../data/boons';
import { RARITY_RULES, type Rarity } from '../data/rarity';
import type { NodeKind } from '../data/runs';
import { TROOP_NAMES, type TroopClass } from '../data/units';
import type { Offer } from './types';

/** "Rare Ranger"; a Common fighter is just "Ranger". */
export function fighterLabel(cls: TroopClass, rarity: Rarity): string {
  const name = TROOP_NAMES[cls].one;
  return rarity === 'common' ? name : `${RARITY_RULES[rarity].name} ${name}`;
}

/** The offer's name: "Epic Vanguard", "Supply Lines". */
export function offerLabel(offer: Offer): string {
  return offer.kind === 'fighter' ? fighterLabel(offer.cls, offer.rarity) : BOONS[offer.boon].name;
}

/** What the offer gives, in a line: "Epic fighter: joins your army with 20% more HP and damage." */
export function offerText(offer: Offer): string {
  if (offer.kind === 'boon') return `${RARITY_RULES[BOONS[offer.boon].rarity].name} boon for the run: ${BOONS[offer.boon].text}.`;
  const bonus = RARITY_RULES[offer.rarity].statBonus;
  return `${RARITY_RULES[offer.rarity].name} fighter: joins your army${bonus > 0 ? ` with ${Math.round(bonus * 100)}% more HP and damage` : ''}.`;
}

export const NODE_NAMES: Readonly<Record<NodeKind, string>> = {
  battle: 'Battle',
  elite: 'Elite fight',
  event: 'Event',
  merchant: 'Merchant',
  camp: 'Rest camp',
  boss: 'Boss',
};

export const NODE_TEXT: Readonly<Record<NodeKind, string>> = {
  battle: 'A fight. Win it for gold and a pick of the spoils.',
  elite: 'A hard fight: a stronger commander and rarer troops. Win it for more gold and an artifact.',
  event: 'Something happens on the road, and you choose what to do about it.',
  merchant: 'Buy fighters and boons, heal your army, or reroll the stock.',
  camp: 'Your army rests and heals, and the artifacts you carry are banked for good.',
  boss: 'The ruler of the region. Beat them to win the run.',
};
