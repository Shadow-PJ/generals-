// Offers: the fighters and boons the spoils and the merchant put in front of you. Each rolls its
// rarity, with chances that shift toward the rare ones deeper in a run and after an elite fight.
// A fighter comes in a class you have unlocked, with a faction (more often one you already
// field) and a perk for each step of rarity. A boon offer is one you don't have yet that helps
// your army: a class in it, a faction in it, or every troop. Since session 5F the spoils can offer
// a duo boon once two factions' bonuses are on in your army.

import { BOON_IDS, BOONS, boonClasses, boonFaction, DUO_RULES, type BoonId } from '../data/boons';
import { FACTION_IDS, FACTION_RULES, factionTier, type FactionId } from '../data/factions';
import type { GeneralId } from '../data/generals';
import { PERK_IDS, type PerkId } from '../data/perks';
import { RARITIES, RARITY_RULES, type Rarity } from '../data/rarity';
import { unlockedClasses } from '../data/regions';
import { RUN_RULES } from '../data/runs';
import type { TroopClass } from '../data/units';
import { factionCounts, type RngState } from '../sim';
import { addFighter } from './army';
import { oathPrice } from './oaths';
import { chance, pick, rollRarity, shuffled, weighted } from './random';
import type { FighterTraits, MerchantItem, Offer, RunState } from './types';

/** Rarity chances for one set of offers; the starting ones when left out. */
export type RarityChances = Readonly<Record<Rarity, number>>;

/** Boons of this rarity you could be offered: not yours yet, not already on offer, and of use to your army. */
function boonChoices(run: RunState, rarity: Rarity, taken: readonly BoonId[]): BoonId[] {
  const classes = new Set(run.roster.map((f) => f.cls));
  const factions = new Set(run.roster.flatMap((f) => f.faction ?? []));
  return BOON_IDS.filter((id) => {
    if (BOONS[id].duo || BOONS[id].rarity !== rarity || run.boons.includes(id) || taken.includes(id)) return false;
    const faction = boonFaction(id);
    if (faction === 'largest') return factions.size > 0;
    if (faction) return factions.has(faction);
    const helps = boonClasses(id);
    return helps === null || helps.some((c) => classes.has(c));
  });
}

/** How many fighters of each faction your army counts: the field and the reserves, and faction boons. */
function armyFactions(run: RunState): Partial<Record<FactionId, number>> {
  const army = [...run.field, ...run.reserves].flatMap((id) => run.roster.filter((f) => f.id === id).map((f) => ({ cls: f.cls, faction: f.faction })));
  return factionCounts(army, run.boons);
}

/** Duo boons open to you: both factions' bonuses on in your army, and not yours or on offer yet. */
export function duoChoices(run: RunState, taken: readonly BoonId[] = []): BoonId[] {
  const counts = armyFactions(run);
  return BOON_IDS.filter((id) => {
    const duo = BOONS[id].duo;
    if (!duo || run.boons.includes(id) || taken.includes(id)) return false;
    return duo.every((f) => factionTier(counts[f] ?? 0) > 0);
  });
}

/** A faction for a new fighter, or none: each faction more likely for every fighter of it already in your run. */
export function rollFaction(rng: RngState, run: RunState): FactionId | null {
  const { none, faction, perOwned } = FACTION_RULES.offerWeights;
  const weights: Record<FactionId | 'none', number> = { none } as Record<FactionId | 'none', number>;
  for (const f of FACTION_IDS) weights[f] = faction + perOwned * run.roster.filter((r) => r.faction === f).length;
  const rolled = weighted(rng, weights);
  return rolled === 'none' ? null : rolled;
}

/** Perks for a fighter of this rarity, all different. */
export function rollPerks(rng: RngState, rarity: Rarity, keep: readonly PerkId[] = []): PerkId[] {
  const wanted = RARITY_RULES[rarity].perks;
  const fresh = shuffled(rng, PERK_IDS.filter((p) => !keep.includes(p)));
  return [...keep, ...fresh].slice(0, Math.max(wanted, keep.length));
}

/** A new fighter of this rarity: of `cls` or an unlocked class, with a faction and perks. */
export function rollFighter(rng: RngState, run: RunState, rarity: Rarity, bossesBeaten: readonly GeneralId[], cls?: TroopClass): FighterTraits {
  const chosen = cls ?? pick(rng, unlockedClasses(bossesBeaten));
  return { cls: chosen, rarity, faction: rollFaction(rng, run), perks: rollPerks(rng, rarity) };
}

function fighterOffer(rng: RngState, run: RunState, rarity: Rarity, bossesBeaten: readonly GeneralId[]): Offer {
  return { kind: 'fighter', ...rollFighter(rng, run, rarity, bossesBeaten) };
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
  return boon ? { kind: 'boon', boon } : fighterOffer(rng, run, rarity, bossesBeaten);
}

/** The spoils' offers: each a fighter or a boon, by chance, of a rolled rarity. */
export function rollOffers(
  rng: RngState,
  run: RunState,
  bossesBeaten: readonly GeneralId[],
  chances?: RarityChances,
  count: number = RUN_RULES.offers,
): Offer[] {
  const offers: Offer[] = [];
  for (let i = 0; i < count; i++) {
    const fighter = chance(rng, RUN_RULES.fighterChance);
    const rarity = rollRarity(rng, chances);
    const taken = offers.flatMap((o) => (o.kind === 'boon' ? [o.boon] : []));
    if (fighter) {
      offers.push(fighterOffer(rng, run, rarity, bossesBeaten));
      continue;
    }
    // A boon offer may be a duo boon, once two factions' bonuses are on in your army.
    const duos = duoChoices(run, taken);
    if (duos.length > 0 && chance(rng, DUO_RULES.offerChance)) offers.push({ kind: 'boon', boon: pick(rng, duos) });
    else offers.push(boonOffer(rng, run, rarity, taken, bossesBeaten));
  }
  return offers;
}

/** The merchant's stock: fighters, then boons, each of a rolled rarity, priced by rarity. */
export function rollStock(rng: RngState, run: RunState, bossesBeaten: readonly GeneralId[], chances?: RarityChances): MerchantItem[] {
  const { fighters, boons } = RUN_RULES.merchant;
  const offers: Offer[] = [];
  for (let i = 0; i < fighters; i++) offers.push(fighterOffer(rng, run, rollRarity(rng, chances), bossesBeaten));
  for (let i = 0; i < boons; i++) {
    const taken = offers.flatMap((o) => (o.kind === 'boon' ? [o.boon] : []));
    offers.push(boonOffer(rng, run, rollRarity(rng, chances), taken, bossesBeaten));
  }
  // Short Supply (an oath) raises every price.
  return offers.map((offer) => ({ offer, price: oathPrice(offerPrice(offer), run.oaths), sold: false }));
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
  if (offer.kind === 'fighter') {
    const { kind: _kind, ...traits } = offer;
    return addFighter(run, traits);
  }
  return run.boons.includes(offer.boon) ? run : { ...run, boons: [...run.boons, offer.boon] };
}
