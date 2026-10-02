// Troop classes: base stats, behavior settings and skills.
// Times are in seconds and distances in world units (the map is 960 x 540);
// the battle engine converts seconds to ticks.

export type UnitClass = 'vanguard' | 'ranger' | 'guardian';

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

export interface UnitClassTable {
  vanguard: VanguardData;
  ranger: RangerData;
  guardian: GuardianData;
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
};
