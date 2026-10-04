// Checks on maps for tests.

import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../../data/armies';
import type { MapData } from '../../data/maps';
import { isArmyPlaced } from '../placement';

/** True if both starter armies stand where they may on the map. */
export function isPlacementFine(map: MapData): boolean {
  return isArmyPlaced(map, 'player', STARTER_ARMY) && isArmyPlaced(map, 'enemy', STARTER_ARMY_MIRRORED);
}
