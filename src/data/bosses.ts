// Boss Generals (session 5D): each region's ruler waits at the end of its runs. A boss doesn't
// have huge HP; each one tests one idea, with a rule that only their boss fight has. Beat them
// and they join you as a General you can lead with, and teach you their Legendary action.
// Starting values to tune.

import type { TroopPlacement } from './armies';
import { GENERAL_IDS, type GeneralId } from './generals';
import type { UnitClass } from './units';

/** The five rulers: every General but the Captain. */
export type BossId = Exclude<GeneralId, 'captain'>;

export interface BossData {
  /** The boss rule, for the Army screen and the battle banner. */
  rule: string;
  /** How to beat it, in a line. */
  counter: string;
}

/** What one of your troops gives the Hive when her army kills it: a stat for every troop of hers still standing. */
export interface StolenTrait {
  name: string;
  stat: 'armor' | 'damage' | 'maxHp' | 'attacksPerSecond' | 'moveSpeed';
  /** Armor is added (0.04 = 4 points); the other stats grow by this share (0.1 = 10%). */
  amount: number;
}

export const BOSS_RULES = {
  hiveMother: {
    /** Each of your troops her army kills gives every troop of hers still standing its class's trait, for the rest of the battle. */
    steals: {
      vanguard: { name: 'Thick Hide', stat: 'armor', amount: 0.04 },
      ranger: { name: 'Keen Sight', stat: 'damage', amount: 0.08 },
      guardian: { name: 'Hardened Shell', stat: 'maxHp', amount: 0.12 },
      invoker: { name: 'Quickened Mind', stat: 'attacksPerSecond', amount: 0.08 },
      assassin: { name: 'Swift Claws', stat: 'moveSpeed', amount: 0.12 },
    } as Readonly<Record<UnitClass, StolenTrait>>,
  },
  strategist: {
    /** Each of her troops phases out of this many big hits, taking nothing from them... */
    phases: 2,
    /** ...a hit being big once it would take this share of the troop's max HP or more. */
    burstShare: 0.2,
  },
  warlord: {
    /** Each of his troops that falls sends the rest into a rage: more damage and faster attacks for a while, stacking. */
    rage: { damage: 0.2, attackSpeed: 0.15, seconds: 8, maxStacks: 4 },
  },
  engineer: {
    /** Turrets: Rangers that never move, at the back corners inside her walls. They come on top of her army. */
    turrets: [
      { cls: 'ranger', x: 780, y: 110 },
      { cls: 'ranger', x: 780, y: 430 },
    ] as readonly TroopPlacement[],
    /** A turret's stats against a plain Ranger's: more HP, armor and reach, but area damage hurts it twice as much. */
    turret: { maxHp: 0.3, armor: 0.1, range: 0.15, areaDamageTaken: 2 },
  },
  conductor: {
    /** A Vibration stack her troops land also goes to each of your troops this close to the one hit... */
    spreadRadius: 45,
    /** ...and every stack she lands brings her Shatterstorm closer: this much Momentum. */
    momentumPerStack: 0.5,
  },
} as const;

export const BOSSES: Readonly<Record<BossId, BossData>> = {
  hiveMother: {
    rule: 'Her troops steal a trait from every troop of yours they kill: armor from Vanguards, damage from Rangers, HP from Guardians, speed from Invokers and Assassins.',
    counter: 'Protect your weak troops and pull them back before they fall.',
  },
  strategist: {
    rule: `Each of her troops phases out of its first ${BOSS_RULES.strategist.phases} big hits (${Math.round(BOSS_RULES.strategist.burstShare * 100)}% of its HP or more) and takes nothing from them.`,
    counter: 'Spend her phases with small hits first; save your ultimate and big combos for after.',
  },
  warlord: {
    rule: `Every troop of his that falls sends the rest into a rage: ${Math.round(BOSS_RULES.warlord.rage.damage * 100)}% more damage and faster attacks for ${BOSS_RULES.warlord.rage.seconds} s, stacking.`,
    counter: 'Bring several of his troops low together and finish them at once, not one by one.',
  },
  engineer: {
    rule: 'She fights from behind her iron walls, falling back to two turrets inside that never move and shoot further than any Ranger.',
    counter: 'Turrets take double area damage: hit them with Invokers and Rifts, or send Assassins behind her walls.',
  },
  conductor: {
    rule: 'Every Vibration stack her troops land spreads to your troops standing close by, and brings her Shatterstorm closer.',
    counter: 'Spread your army out, and strike her troops down before her Shatterstorm is ready.',
  },
};

export function isBoss(general: GeneralId): general is BossId {
  return general !== 'captain';
}

/** The Generals you can lead with: the Captain, and every ruler you have beaten (recruited). */
export function recruitedGenerals(bossesBeaten: readonly GeneralId[]): GeneralId[] {
  return GENERAL_IDS.filter((g) => g === 'captain' || bossesBeaten.includes(g));
}
