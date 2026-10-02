// Preset armies: which troops each side brings and where they stand at the start.

import type { UnitClass } from './units';
import { TRAINING_FIELD } from './maps';

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

/** The same army facing the other way, standing in the enemy's deploy zone of the Training Field. */
export const STARTER_ARMY_MIRRORED: TroopPlacement[] = STARTER_ARMY.map((t) => ({
  ...t,
  x: TRAINING_FIELD.width - t.x,
}));
