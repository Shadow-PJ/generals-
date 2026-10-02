// Helpers for engine tests: small maps and battles built by hand.

import type { Card, Loadout, Step } from '../../cards/types';
import type { TroopPlacement } from '../../data/armies';
import type { GeneralId } from '../../data/generals';
import type { RankNumber } from '../../data/ranks';
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

export interface BattleOptions {
  seed?: number;
  walls?: WallData[];
  cards?: (Card | null)[];
  rank?: RankNumber;
  reserves?: TroopPlacement['cls'][];
  tactical?: boolean;
  general?: GeneralId;
}

export function battleWith(player: TroopPlacement[], enemy: TroopPlacement[], options: BattleOptions = {}): BattleState {
  const loadout: Loadout | undefined = options.cards ? { slots: options.cards, legendary: null } : undefined;
  return createBattle({
    seed: options.seed ?? 1,
    map: openMap(options.walls),
    player,
    enemy,
    loadout,
    rank: options.rank ?? 5,
    reserves: { player: options.reserves ?? [], enemy: [] },
    tactical: options.tactical,
    general: options.general,
  });
}

/** A one-step card with no condition. */
export function cardOf(...steps: Step[]): Card {
  return { condition: null, steps, auto: false };
}

/** Units of one side, in the order they were placed. */
export function sideUnits(state: BattleState, side: Unit['side']): Unit[] {
  return state.units.filter((u) => u.side === side);
}
