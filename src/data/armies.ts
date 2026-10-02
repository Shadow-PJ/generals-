// Preset armies: which troops each side brings and where they stand at the start.

import type { UnitClass } from './units';
import { OPEN_FIELD } from './maps';

export interface TroopPlacement {
  cls: UnitClass;
  x: number;
  y: number;
}

/** The default player army: two Vanguards in front, two Rangers behind, a Guardian in the middle. */
export const STARTER_ARMY: TroopPlacement[] = [
  { cls: 'vanguard', x: 260, y: 220 },
  { cls: 'vanguard', x: 260, y: 320 },
  { cls: 'ranger', x: 120, y: 190 },
  { cls: 'ranger', x: 120, y: 350 },
  { cls: 'guardian', x: 180, y: 270 },
];

/** The same army facing the other way, in the enemy's deploy zone of the Open Field. It is the preset enemy on the prep screen. */
export const STARTER_ARMY_MIRRORED: TroopPlacement[] = STARTER_ARMY.map((t) => ({
  ...t,
  x: OPEN_FIELD.width - t.x,
}));

/** Your 3 reserve troops, called in by a Call Reserve card. They arrive at your edge of the map. */
export const STARTER_RESERVES: UnitClass[] = ['vanguard', 'ranger', 'guardian'];

/** An army is 5 troops on the field plus 3 in reserve. */
export const ARMY_SIZE = STARTER_ARMY.length;
export const RESERVE_COUNT = STARTER_RESERVES.length;

/**
 * Which army the enemy brings, chosen on the debug Troops screen until there are real opponents:
 * the starter army, or a mirror of yours (the same classes, reserves and specializations).
 */
export type EnemyArmy = 'starter' | 'mirror';
export const ENEMY_ARMIES: readonly EnemyArmy[] = ['starter', 'mirror'];
