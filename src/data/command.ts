// Command pips, Momentum, card slots, troop orders and the ultimate.
// All numbers are starting values to tune in playtests.

export const COMMAND_RULES = {
  startingPips: 2,
  /** One pip refills this often. */
  pipRefillSeconds: 6,
  /** Once you have lost this share of your troops, pips refill this many times faster. */
  comebackLossShare: 0.5,
  comebackRefillMultiplier: 2,
  /** A fired slot rests this long before it can fire again. */
  slotRestSeconds: 8,
  /** A card keeps glowing this long after its condition stops being true. */
  glowLingerSeconds: 1.5,
  /** Perfect timing: a manual card fired while it glows. */
  perfect: { effectBonus: 0.25, pipRefund: 1 },
  momentum: {
    max: 100,
    /** Fills on its own, so every player gets their ultimate (a full bar in about 75 s). */
    passivePerSecond: 1.35,
    perfectGain: 20,
    /** Each chain link after the first adds this much... */
    chainLinkGain: 8,
    /** ...and a chained card's Momentum (Perfect, combos, the link itself) counts this many times. */
    chainMultiplier: 2,
  },
  /** Chains (from Rank III): fire the next card within the window to chain it to the last one. */
  chain: {
    windowSeconds: 3,
    /** Each link after the first costs this many pips less, but never under `minCost`. */
    linkDiscount: 1,
    minCost: 1,
  },
  /** Finishers (from Rank IV): the ultimate as link `minLinks` or later of a chain hits harder. */
  finisher: { minLinks: 3, powerBonus: 0.5 },
  /** Tactical mode pauses the battle this often. */
  tacticalPauseSeconds: 10,
} as const;

/** How long each card action's order lasts for the troops carrying it out, and how far they go. */
export const ORDER_RULES = {
  focusSeconds: 6,
  moveSeconds: 4,
  fallBackSeconds: 2.5,
  holdSeconds: 5,
  protectSeconds: 6,
  /** Move forward or back: this far from where the troop stands. */
  moveDistance: 140,
  /** Fall back with nowhere named: this far away from the enemy. */
  fallBackDistance: 130,
  /** Move behind the enemy: this far past the enemy's middle, on the far side. */
  behindOffset: 90,
  /** A moving troop has arrived within this distance. */
  arriveDistance: 12,
} as const;

/** When conditions count as met. */
export const CONDITION_RULES = {
  /** The enemy ultimate is charging once its Momentum reaches this share of full. */
  ultimateChargingShare: 0.8,
  /** An enemy this close to one of your Rangers or Guardians has reached your backline. */
  backlineRadius: 90,
  /** Enemies within this distance of each other count as close together. */
  groupRadius: 100,
} as const;

/** The Captain's ultimate. The other Generals' are in src/data/generals.ts (ULTIMATE_RULES). */
export const ULTIMATES = {
  rally: { name: 'Rally', healShare: 0.2, attackSpeedBonus: 0.3, durationSeconds: 5 },
} as const;

/** Threat Readout: warn when a troop would fall within this many seconds at the damage rate it is taking. */
export const THREAT_RULES = {
  windowSeconds: 2,
  warnBelowSeconds: 4,
} as const;
