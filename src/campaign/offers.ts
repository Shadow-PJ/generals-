// Offers: the fighters and boons the spoils and the merchant put in front of you. Each rolls its
// rarity with the chances in RARITY_RULES; a boon offer is one you don't have yet, and only for
// classes in your army. Fighters come in the classes you have unlocked.

import { BOON_IDS, BOONS, boonClasses, type BoonId } from '../data/boons';
import { RARITIES, type Rarity } from '../data/rarity';
import { unlockedClasses } from '../data/regions';
import { RUN_RULES } from '../data/runs';
import type { GeneralId } from '../data/generals';
import type { RngState } from '../sim';
import { addFighter } from './army';
import { chance, pick, rollRarity } from './random';
import type { MerchantItem, Offer, RunState } from './types';

/** Boons of this rarity you could be offered: not yours yet, not already on offer, and of use to your army. */
function boonChoices(run: RunState, rarity: Rarity, taken: readonly BoonId[]): BoonId[] {
  const classes = new Set(run.roster.map((f) => f.cls));
  return BOON_IDS.filter((id) => {
    if (BOONS[id].rarity !== rarity || run.boons.includes(id) || taken.includes(id)) return false;
    const helps = boonClasses(id);
    return helps === null || helps.some((c) => classes.has(c));
  });
}

function fighterOffer(rng: RngState, rarity: Rarity, bossesBeaten: readonly GeneralId[]): Offer {
  return { kind: 'fighter', cls: pick(rng, unlockedClasses(bossesBeaten)), rarity };
}

/** A boon of this rarity, or of the nearest rarity below that still has one for you; null when none is left. */
export function boonOfferOrNull(rng: RngState, run: RunState, rarity: Rarity, taken: readonly BoonId[] = []): BoonId | null {
  for (let r = RARITIES.indexOf(rarity); r >= 0; r--) {
    const choices = boonChoices(run, RARITIES[r]!, taken);
    if (choices.length > 0) return pick(rng, choices);
  }
  return null;
}

/** A boon offer, or a fighter of the rolled rarity when no boon is left for you. */
function boonOffer(rng: RngState, run: RunState, rarity: Rarity, taken: readonly BoonId[], bossesBeaten: readonly GeneralId[]): Offer {
  const boon = boonOfferOrNull(rng, run, rarity, taken);
  return boon ? { kind: 'boon', boon } : fighterOffer(rng, rarity, bossesBeaten);
}

/** The spoils' offers: each a fighter or a boon, by chance, of a rolled rarity. */
export function rollOffers(rng: RngState, run: RunState, bossesBeaten: readonly GeneralId[], count: number = RUN_RULES.offers): Offer[] {
  const offers: Offer[] = [];
  for (let i = 0; i < count; i++) {
    const fighter = chance(rng, RUN_RULES.fighterChance);
    const rarity = rollRarity(rng);
    const taken = offers.flatMap((o) => (o.kind === 'boon' ? [o.boon] : []));
    offers.push(fighter ? fighterOffer(rng, rarity, bossesBeaten) : boonOffer(rng, run, rarity, taken, bossesBeaten));
  }
  return offers;
}

/** The merchant's stock: fighters, then boons, each of a rolled rarity, priced by rarity. */
export function rollStock(rng: RngState, run: RunState, bossesBeaten: readonly GeneralId[]): MerchantItem[] {
  const { fighters, boons } = RUN_RULES.merchant;
  const offers: Offer[] = [];
  for (let i = 0; i < fighters; i++) offers.push(fighterOffer(rng, rollRarity(rng), bossesBeaten));
  for (let i = 0; i < boons; i++) {
    const taken = offers.flatMap((o) => (o.kind === 'boon' ? [o.boon] : []));
    offers.push(boonOffer(rng, run, rollRarity(rng), taken, bossesBeaten));
  }
  return offers.map((offer) => ({ offer, price: offerPrice(offer), sold: false }));
}

export function offerRarity(offer: Offer): Rarity {
  return offer.kind === 'fighter' ? offer.rarity : BOONS[offer.boon].rarity;
}

/** What the merchant asks for an offer. */
export function offerPrice(offer: Offer): number {
  const prices = offer.kind === 'fighter' ? RUN_RULES.merchant.fighterPrice : RUN_RULES.merchant.boonPrice;
  return prices[offerRarity(offer)];
}

/** The run with the offer taken: the fighter joins, or the boon is yours. */
export function takeOffer(run: RunState, offer: Offer): RunState {
  if (offer.kind === 'fighter') return addFighter(run, offer.cls, offer.rarity);
  return run.boons.includes(offer.boon) ? run : { ...run, boons: [...run.boons, offer.boon] };
}
