// Factions (session 5C): every run fighter may belong to one of the five Generals' factions.
// Two, four and six fighters of one faction in your army (troops and reserves, plus faction
// boons) switch on that faction's bonus, in the spirit of its General; it helps the troops of
// that faction. Starting values to tune.

import type { GeneralId } from './generals';

export const FACTION_IDS = ['bloodbound', 'forgeborn', 'hive', 'voidweavers', 'resonance'] as const;
export type FactionId = (typeof FACTION_IDS)[number];

/** Fighters of one faction it takes for each step of its bonus. */
export const FACTION_TIERS = [2, 4, 6] as const;

export interface FactionData {
  name: string;
  /** The General who leads it. */
  general: GeneralId;
  /** What the bonus does, with {value} for each step's number. */
  text: string;
  /** The bonus's number at 2, 4 and 6 fighters. */
  values: readonly [number, number, number];
}

export const FACTION_RULES = {
  /** Forgeborn: armor each attack adds, up to the bonus's cap. */
  forgeArmorPerAttack: 0.01,
  /** Resonance: every this many attacks resonates. */
  resonanceEvery: 3,
  /**
   * The faction a fighter offer rolls, by weight: none, each faction, and more for each fighter
   * of that faction already in your run, so the factions you draft keep turning up.
   */
  offerWeights: { none: 1, faction: 1, perOwned: 0.5 },
} as const;

export const FACTIONS: Readonly<Record<FactionId, FactionData>> = {
  bloodbound: {
    name: 'Bloodbound',
    general: 'warlord',
    text: 'Bloodbound troops heal {value} of the damage their attacks deal',
    values: [0.2, 0.35, 0.6],
  },
  forgeborn: {
    name: 'Forgeborn',
    general: 'engineer',
    text: `Forgeborn troops harden as they heat up: each attack adds ${Math.round(FACTION_RULES.forgeArmorPerAttack * 100)}% armor, up to {value}`,
    values: [0.025, 0.045, 0.06],
  },
  hive: {
    name: 'Hive',
    general: 'hiveMother',
    text: 'Hive troops hit {value} harder for each other Hive troop still standing',
    values: [0.03, 0.03, 0.035],
  },
  voidweavers: {
    name: 'Voidweavers',
    general: 'strategist',
    text: 'Voidweavers troops phase out of every {value} hit they take, and take no damage from it',
    values: [16, 12, 10],
  },
  resonance: {
    name: 'Resonance',
    general: 'conductor',
    text: `Every ${ordinal(FACTION_RULES.resonanceEvery)} attack of a Resonance troop resonates for {value} more damage`,
    values: [0.25, 0.25, 0.3],
  },
};

/** The step of a faction's bonus for this many fighters: 0 (off) to 3. */
export function factionTier(count: number): 0 | 1 | 2 | 3 {
  return FACTION_TIERS[2] <= count ? 3 : FACTION_TIERS[1] <= count ? 2 : FACTION_TIERS[0] <= count ? 1 : 0;
}

/** The faction bonus's number at this step, or 0 when it is off. */
export function factionValue(faction: FactionId, tier: number): number {
  return tier > 0 ? FACTIONS[faction].values[tier - 1]! : 0;
}

/** "Bloodbound troops heal 20% of the damage their attacks deal", for a step (1 to 3). */
export function factionText(faction: FactionId, tier: number): string {
  const data = FACTIONS[faction];
  const v = data.values[Math.max(0, Math.min(2, tier - 1))]!;
  const value = faction === 'voidweavers' ? ordinal(v) : `${Math.round(v * 100)}%`;
  return data.text.replace('{value}', value);
}

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}
