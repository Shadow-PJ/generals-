// Specializations: each troop class has two, and a troop takes one or neither (docs/DESIGN.md,
// The 5 troop classes). The Tech Web will sell them in phase 5; until then a debug menu picks
// them, one per class for your whole army. All numbers are starting values to tune.

import type { TroopClass } from './units';

export type SpecializationId =
  | 'breaker'
  | 'bulwark'
  | 'sniper'
  | 'volley'
  | 'warden'
  | 'mender'
  | 'pyromancer'
  | 'frostcaller'
  | 'blade'
  | 'saboteur';

/** Changes to a troop's base stats: multipliers, except `armorPierce`, which replaces the base value. */
export interface StatChanges {
  moveSpeed?: number;
  damage?: number;
  attacksPerSecond?: number;
  range?: number;
  armorPierce?: number;
}

export interface Specialization {
  id: SpecializationId;
  cls: TroopClass;
  name: string;
  /** What it does, for the menu. */
  text: string;
  stats?: StatChanges;
}

export const SPECIALIZATIONS: Readonly<Record<SpecializationId, Specialization>> = {
  breaker: {
    id: 'breaker',
    cls: 'vanguard',
    name: 'Breaker',
    text: 'Charges 20% faster; Shove pushes 50% further and hits 50% harder',
    stats: { moveSpeed: 1.2 },
  },
  bulwark: {
    id: 'bulwark',
    cls: 'vanguard',
    name: 'Bulwark',
    text: 'A shield wall: enemy shots that cross its body hit it instead',
    stats: { moveSpeed: 0.9 },
  },
  sniper: {
    id: 'sniper',
    cls: 'ranger',
    name: 'Sniper',
    text: 'Shots ignore 60% of armor and reach 20% further, but come slower',
    stats: { armorPierce: 0.6, range: 1.2, attacksPerSecond: 0.8, damage: 1.2 },
  },
  volley: {
    id: 'volley',
    cls: 'ranger',
    name: 'Volley',
    text: 'Arrows also hit enemies near the target for half damage',
    stats: { damage: 0.85 },
  },
  warden: {
    id: 'warden',
    cls: 'guardian',
    name: 'Warden',
    text: 'Barriers 50% bigger; enemies near the shielded ally must attack it for 2 s',
  },
  mender: {
    id: 'mender',
    cls: 'guardian',
    name: 'Mender',
    text: 'Smaller Barriers that also heal 25 HP a second for 6 s',
  },
  pyromancer: {
    id: 'pyromancer',
    cls: 'invoker',
    name: 'Pyromancer',
    text: 'Fire Rifts that burn 40% harder',
  },
  frostcaller: {
    id: 'frostcaller',
    cls: 'invoker',
    name: 'Frostcaller',
    text: 'Frost Rifts slow enemies inside by 40%, but hurt 30% less',
  },
  blade: {
    id: 'blade',
    cls: 'assassin',
    name: 'Blade',
    text: 'Shadowstep strikes twice as hard and executes below 25% HP',
  },
  saboteur: {
    id: 'saboteur',
    cls: 'assassin',
    name: 'Saboteur',
    text: "Shadowstep silences its target for 4 s: no skills, and a cast breaks",
  },
};

/** Each class's two specializations, in menu order. */
export const SPECIALIZATIONS_OF: Readonly<Record<TroopClass, readonly [SpecializationId, SpecializationId]>> = {
  vanguard: ['breaker', 'bulwark'],
  ranger: ['sniper', 'volley'],
  guardian: ['warden', 'mender'],
  invoker: ['pyromancer', 'frostcaller'],
  assassin: ['blade', 'saboteur'],
};

/** The specialization chosen for each class; a class left out fights with none. */
export type SpecChoice = Partial<Record<TroopClass, SpecializationId>>;

/** What the specializations do beyond stat changes. */
export const SPEC_RULES = {
  breaker: { pushMultiplier: 1.5, shoveDamageMultiplier: 1.5 },
  volley: { splashRadius: 45, splashShare: 0.5 },
  warden: { barrierMultiplier: 1.5, tauntRadius: 80, tauntSeconds: 2 },
  mender: { barrierMultiplier: 0.6, healPerSecond: 25, healSeconds: 6 },
  pyromancer: { riftDamageMultiplier: 1.4 },
  frostcaller: { riftDamageMultiplier: 0.7, slow: 0.4 },
  blade: { strikeMultiplier: 2, executeShare: 0.25 },
  saboteur: { silenceSeconds: 4 },
} as const;
