// Helpers for engine tests: small maps and battles built by hand.

import type { TroopPlacement } from '../../data/armies';
import type { MapData, WallData } from '../../data/maps';
import { createBattle } from '../battle';
import type { BattleState, Unit } from '../types';

export function openMap(walls: WallData[] = []): MapData {
  return {
    id: 'test',
    name: 'Test Map',
    width: 1000,
    height: 600,
    walls,
    deployZones: { player: { x: 0, y: 0, w: 500, h: 600 }, enemy: { x: 500, y: 0, w: 500, h: 600 } },
  };
}

export function battleWith(
  player: TroopPlacement[],
  enemy: TroopPlacement[],
  options: { seed?: number; walls?: WallData[] } = {},
): BattleState {
  return createBattle({ seed: options.seed ?? 1, map: openMap(options.walls), player, enemy });
}

/** Units of one side, in the order they were placed. */
export function sideUnits(state: BattleState, side: Unit['side']): Unit[] {
  return state.units.filter((u) => u.side === side);
}
