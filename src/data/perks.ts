// Perks (session 5C): a Rare or Epic fighter has one perk and a Legendary fighter two, rolled when
// the fighter is offered. Each makes that one troop better at something. Starting values to tune.

export type PerkStat = 'damage' | 'maxHp' | 'moveSpeed' | 'attacksPerSecond' | 'range';

/** Something that makes one troop better: a perk, an artifact it carries or its class's Tech Web (session 5E). */
export type PerkEffect =
  /** `bonus` more of a stat (0.15 = 15%; below 0 for less). */
  | { kind: 'stat'; stat: PerkStat; bonus: number }
  /** More armor, added to the troop's own (0.06 = 6 points). */
  | { kind: 'armor'; amount: number }
  /** Heals this share of the damage its attacks deal. */
  | { kind: 'lifesteal'; share: number }
  /** Its skill comes back this much sooner (0.25 = a quarter sooner). */
  | { kind: 'skillHaste'; cut: number }
  /** It takes this much less area damage (0.35 = 35% less). */
  | { kind: 'areaWard'; cut: number }
  /** Once a battle, instead of falling it gets back up with this share of its max HP. */
  | { kind: 'revive'; hp: number };

export interface PerkData {
  name: string;
  text: string;
  effect: PerkEffect;
}

export const PERK_IDS = ['tough', 'fierce', 'swift', 'quick', 'hardened', 'keenEyed', 'leech', 'drilled'] as const;
export type PerkId = (typeof PERK_IDS)[number];

export const PERKS: Readonly<Record<PerkId, PerkData>> = {
  tough: { name: 'Tough', text: '15% more HP', effect: { kind: 'stat', stat: 'maxHp', bonus: 0.15 } },
  fierce: { name: 'Fierce', text: '12% more damage', effect: { kind: 'stat', stat: 'damage', bonus: 0.12 } },
  swift: { name: 'Swift', text: 'moves 20% faster', effect: { kind: 'stat', stat: 'moveSpeed', bonus: 0.2 } },
  quick: { name: 'Quick', text: 'attacks 12% faster', effect: { kind: 'stat', stat: 'attacksPerSecond', bonus: 0.12 } },
  hardened: { name: 'Hardened', text: '6% more armor', effect: { kind: 'armor', amount: 0.06 } },
  keenEyed: { name: 'Keen-eyed', text: 'reaches 12% further', effect: { kind: 'stat', stat: 'range', bonus: 0.12 } },
  leech: { name: 'Leech', text: 'heals 10% of the damage its attacks deal', effect: { kind: 'lifesteal', share: 0.1 } },
  drilled: { name: 'Drilled', text: 'its skill comes back 25% sooner', effect: { kind: 'skillHaste', cut: 0.25 } },
};
