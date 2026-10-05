// The Battle IQ report (session 5E): after every battle, your biggest mistake, your best
// decision, a missed opportunity and an enemy weakness, read from the battle's event log, with a
// grade. In campaign battles a good grade earns Command XP. Starting values to tune.

export const BATTLE_IQ = {
  /** Your ultimate sat ready this long, or longer, before you fired it (or the battle ended): a mistake. */
  idleUltimateSeconds: 5,
  /** Your pips sat full this long, or longer, wasting the refills: a mistake. */
  fullPipsSeconds: 8,
  /** A troop of yours that fell this early was lost too soon. */
  earlyLossSeconds: 20,
  /** Two of your cards fired this far apart, or less, but not chained, could have been a chain... */
  nearChainSeconds: 6,
  /** Points for the grade: start at 50, then add and take away. */
  score: {
    start: 50,
    win: 20,
    perfect: 4,
    combo: 8,
    finisher: 10,
    /** Taken away per second the ultimate sat ready, past the idle limit. */
    idleUltimatePerSecond: 1,
    /** Taken away per second your pips sat full, past the limit. */
    fullPipsPerSecond: 0.5,
    /** Taken away per troop lost too soon. */
    earlyLoss: 8,
  },
  /** The lowest score for each grade, best first, and the Command XP it earns in a campaign battle. */
  grades: [
    { grade: 'A', min: 85, xp: 20 },
    { grade: 'B', min: 65, xp: 10 },
    { grade: 'C', min: 45, xp: 5 },
    { grade: 'D', min: -Infinity, xp: 0 },
  ],
} as const;

/** How to punish each class, from its weakness (docs/DESIGN.md, The 5 troop classes), for the enemy-weakness line. */
export const CLASS_WEAKNESS: Readonly<Record<'vanguard' | 'ranger' | 'guardian' | 'invoker' | 'assassin', string>> = {
  vanguard: 'armor-piercing attacks (Snipers) cut through them',
  ranger: 'they die fast once something reaches them',
  guardian: 'their damage is low, and Assassins hunt them first',
  invoker: 'a hit breaks their long Rift cast',
  assassin: 'they are fragile and weak to area damage',
};
