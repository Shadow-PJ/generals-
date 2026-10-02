// Troop classes: base stats, behavior settings and skills.
// Times are in seconds and distances in world units (the map is 960 x 540);
// the battle engine converts seconds to ticks.

/** Every troop class in the design. */
export const TROOP_CLASSES = ['vanguard', 'ranger', 'guardian', 'invoker', 'assassin'] as const;
export type TroopClass = (typeof TROOP_CLASSES)[number];

/** The classes the battle engine can field: all five since session 4B. */
export type UnitClass = TroopClass;
export const UNIT_CLASS_LIST: readonly UnitClass[] = TROOP_CLASSES;

export const TROOP_NAMES: Record<TroopClass, { one: string; many: string }> = {
  vanguard: { one: 'Vanguard', many: 'Vanguards' },
  ranger: { one: 'Ranger', many: 'Rangers' },
  guardian: { one: 'Guardian', many: 'Guardians' },
  invoker: { one: 'Invoker', many: 'Invokers' },
  assassin: { one: 'Assassin', many: 'Assassins' },
};

export interface UnitStats {
  maxHp: number;
  /** Share of incoming damage blocked, 0 to 1. Armor-piercing attacks ignore part of it. */
  armor: number;
  /** Damage of one attack, before armor. */
  damage: number;
  attacksPerSecond: number;
  /** Attack reach, measured edge to edge between the two units. */
  range: number;
  moveSpeed: number;
  /** Size of the unit's body. */
  radius: number;
  /** Speed of the unit's projectile; 0 means the hit lands at once (melee). */
  projectileSpeed: number;
  /** Share of the target's armor this unit's attacks ignore, 0 to 1. */
  armorPierce: number;
  /** Damage taken from area attacks (Rifts, Shoves, splash), as a multiple: 1.5 = 50% more. */
  areaDamageTaken: number;
}

export interface VanguardData {
  name: string;
  stats: UnitStats;
  shove: {
    cooldownSeconds: number;
    initialCooldownSeconds: number;
    /** Enemies within this distance (edge to edge) are shoved. */
    range: number;
    pushDistance: number;
    /** How long the push lasts; the shoved enemy can't act meanwhile. */
    pushSeconds: number;
    damage: number;
  };
}

export interface RangerData {
  name: string;
  stats: UnitStats;
  behavior: {
    /** When the nearest enemy is closer than this (edge to edge), the Ranger backs away instead of shooting. */
    retreatDistance: number;
  };
  mark: {
    cooldownSeconds: number;
    initialCooldownSeconds: number;
    durationSeconds: number;
    /** A Marked unit takes this much extra damage from every source (0.2 = +20%). */
    damageTakenBonus: number;
  };
}

export interface GuardianData {
  name: string;
  stats: UnitStats;
  behavior: {
    /** How far behind the most hurt ally the Guardian stands, away from the enemy nearest to that ally. */
    followDistance: number;
    /** The Guardian only moves once it is this far from its spot. */
    followSlack: number;
  };
  barrier: {
    cooldownSeconds: number;
    initialCooldownSeconds: number;
    range: number;
    /** Damage the Barrier absorbs before HP is lost. */
    amount: number;
    durationSeconds: number;
    /** Only allies below this share of their max HP get a Barrier. */
    hpThreshold: number;
  };
}

export interface InvokerData {
  name: string;
  stats: UnitStats;
  behavior: {
    /** When the nearest enemy is closer than this (edge to edge), the Invoker backs away instead of attacking. */
    retreatDistance: number;
  };
  rift: {
    cooldownSeconds: number;
    initialCooldownSeconds: number;
    /** How long the cast takes. The Invoker stands still meanwhile, and the cast can be interrupted. */
    castSeconds: number;
    /** Furthest a Rift can be opened, from the Invoker to the zone's middle. */
    castRange: number;
    /** Size of the zone. */
    radius: number;
    durationSeconds: number;
    /** The zone hurts every enemy in it once per pulse. */
    pulseSeconds: number;
    pulseDamage: number;
    /** The Invoker only casts at a group of at least this many enemies (or at whoever is left). */
    minTargets: number;
    /** Losing this share of max HP during the cast interrupts it; so does a Shove, a stun or a silence. */
    interruptDamageShare: number;
    /** After an interrupted cast, the Rift is ready again this soon. */
    interruptedCooldownSeconds: number;
  };
}

export interface AssassinData {
  name: string;
  stats: UnitStats;
  /** Every attack may be a critical hit. */
  crit: { chance: number; multiplier: number };
  shadowstep: {
    cooldownSeconds: number;
    initialCooldownSeconds: number;
    /** Furthest target it can blink to, center to center. */
    range: number;
    /** The strike after the blink deals this many times a normal attack. */
    strikeMultiplier: number;
    /** A target left below this share of its max HP after the strike is executed. */
    executeShare: number;
  };
}

export interface UnitClassTable {
  vanguard: VanguardData;
  ranger: RangerData;
  guardian: GuardianData;
  invoker: InvokerData;
  assassin: AssassinData;
}

export const UNIT_CLASSES: UnitClassTable = {
  // Controls space. Holds the front and protects the nearest ally.
  // Weakness: armor-piercing attacks (its strength is armor).
  vanguard: {
    name: 'Vanguard',
    stats: {
      maxHp: 1550,
      armor: 0.4,
      damage: 24,
      attacksPerSecond: 0.8,
      range: 10,
      moveSpeed: 55,
      radius: 14,
      projectileSpeed: 0,
      armorPierce: 0,
      areaDamageTaken: 1,
    },
    shove: {
      cooldownSeconds: 8,
      initialCooldownSeconds: 3,
      range: 24,
      pushDistance: 80,
      pushSeconds: 0.3,
      damage: 20,
    },
  },

  // Controls targets. Keeps max range and shoots the nearest threat.
  // Weakness: dies fast once reached (low HP, no armor, can't shoot while backing away).
  ranger: {
    name: 'Ranger',
    stats: {
      maxHp: 450,
      armor: 0,
      damage: 34,
      attacksPerSecond: 0.9,
      range: 220,
      moveSpeed: 60,
      radius: 10,
      projectileSpeed: 480,
      armorPierce: 0,
      areaDamageTaken: 1,
    },
    behavior: { retreatDistance: 90 },
    mark: {
      cooldownSeconds: 8,
      initialCooldownSeconds: 2,
      durationSeconds: 5,
      damageTakenBonus: 0.2,
    },
  },

  // Controls damage. Stays near the most hurt ally and shields it.
  // Weakness: low damage.
  guardian: {
    name: 'Guardian',
    stats: {
      maxHp: 600,
      armor: 0.15,
      damage: 14,
      attacksPerSecond: 1,
      range: 130,
      moveSpeed: 65,
      radius: 12,
      projectileSpeed: 360,
      armorPierce: 0,
      areaDamageTaken: 1,
    },
    behavior: { followDistance: 45, followSlack: 20 },
    barrier: {
      cooldownSeconds: 8,
      initialCooldownSeconds: 2,
      range: 200,
      amount: 260,
      durationSeconds: 6,
      hpThreshold: 0.85,
    },
  },

  // Controls areas. Keeps its distance and opens a Rift, a damaging zone, on groups of enemies.
  // Weakness: the Rift takes a long cast that can be interrupted.
  invoker: {
    name: 'Invoker',
    stats: {
      maxHp: 480,
      armor: 0,
      damage: 16,
      attacksPerSecond: 0.8,
      range: 170,
      moveSpeed: 55,
      radius: 11,
      projectileSpeed: 380,
      armorPierce: 0,
      areaDamageTaken: 1,
    },
    behavior: { retreatDistance: 80 },
    rift: {
      cooldownSeconds: 9,
      initialCooldownSeconds: 4,
      castSeconds: 1.5,
      castRange: 230,
      radius: 60,
      durationSeconds: 4,
      pulseSeconds: 0.5,
      pulseDamage: 12,
      minTargets: 2,
      interruptDamageShare: 0.1,
      interruptedCooldownSeconds: 3,
    },
  },

  // Controls priority targets. Hunts Guardians first, then the other backline troops, then the
  // weakest enemy, and Shadowsteps behind its prey to finish it.
  // Weakness: fragile, and takes 50% more damage from area attacks.
  assassin: {
    name: 'Assassin',
    stats: {
      maxHp: 520,
      armor: 0.05,
      damage: 36,
      attacksPerSecond: 1,
      range: 10,
      moveSpeed: 80,
      radius: 11,
      projectileSpeed: 0,
      armorPierce: 0.3,
      areaDamageTaken: 1.5,
    },
    crit: { chance: 0.2, multiplier: 1.75 },
    shadowstep: {
      cooldownSeconds: 9,
      initialCooldownSeconds: 3,
      range: 240,
      strikeMultiplier: 1.5,
      executeShare: 0.15,
    },
  },
};
