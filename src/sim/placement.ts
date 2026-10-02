// Where troops may stand before a battle: inside their side's deploy zone, clear of
// walls, and not on top of each other.

import type { TroopPlacement } from '../data/armies';
import type { MapData } from '../data/maps';
import { UNIT_CLASSES, type UnitClass } from '../data/units';
import { circleOverlapsRect, distance } from './geometry';
import type { Side } from './types';

export type PlacementProblem = 'outsideZone' | 'wall' | 'crowded';

/** Why a troop can't stand at (x, y), or null if it can. `others` are the other troops of its side. */
export function placementProblem(
  map: MapData,
  side: Side,
  cls: UnitClass,
  x: number,
  y: number,
  others: readonly TroopPlacement[],
): PlacementProblem | null {
  const r = UNIT_CLASSES[cls].stats.radius;
  const zone = map.deployZones[side];
  if (x - r < zone.x || x + r > zone.x + zone.w || y - r < zone.y || y + r > zone.y + zone.h) return 'outsideZone';
  if (map.walls.some((w) => circleOverlapsRect(x, y, r, w))) return 'wall';
  if (others.some((o) => distance(x, y, o.x, o.y) < r + UNIT_CLASSES[o.cls].stats.radius)) return 'crowded';
  return null;
}

/** True if every troop of the army stands somewhere it may. */
export function isArmyPlaced(map: MapData, side: Side, army: readonly TroopPlacement[]): boolean {
  return army.every((t, i) => placementProblem(map, side, t.cls, t.x, t.y, army.filter((_, j) => j !== i)) === null);
}
