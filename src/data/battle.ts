// Rules that apply to every battle.

export const BATTLE_RULES = {
  /** A battle that lasts this long ends, and the side with the larger share of its starting HP left wins. */
  timeLimitSeconds: 180,
  /**
   * Overtime keeps stalled battles from dragging: from this point all damage grows
   * every second (0.06 = +6% per second, so +120% after 20 s).
   */
  overtime: {
    startSeconds: 140,
    damageBonusPerSecond: 0.06,
  },
  /** Each attack's damage varies by up to this share, up or down (0.1 = ±10%). */
  damageVariance: 0.1,
  /** Every hit does at least this much damage. */
  minDamage: 1,
  walls: {
    /**
     * Damage a wall stops before it breaks, unless the map gives the wall its own HP.
     * Walls act like a shield: every shot that would cross one hits the wall instead.
     */
    hp: 500,
  },
  navigation: {
    /** Extra room kept between unit bodies and walls when planning a path. */
    wallClearance: 4,
    /** How often a unit re-plans its path around walls. */
    repathSeconds: 0.5,
    /** A path corner counts as reached within this distance. */
    waypointReachedDistance: 6,
  },
  /** A unit trying to back away that can move less than this share of its step is cornered. */
  corneredMoveShare: 0.5,
} as const;

export type BattleRules = typeof BATTLE_RULES;
