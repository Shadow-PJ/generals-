// Helpers for engine tests: small maps and battles built by hand.

import type { Card, Loadout, Step } from '../../cards/types';
import type { TroopPlacement } from '../../data/armies';
import type { GeneralId } from '../../data/generals';
import type { RankNumber } from '../../data/ranks';
import type { SpecChoice } from '../../data/specializations';
import type { MapData, WallData } from '../../data/maps';
import { createBattle } from '../battle';
import type { BattleState, Unit } from '../types';

export function openMap(walls: WallData[] = []): MapData {
  return {
    id: 'test',
    name: 'Test Map',
    terrainText: 'A test map.',
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
  enemyReserves?: TroopPlacement['cls'][];
  tactical?: boolean;
  general?: GeneralId;
  enemyGeneral?: GeneralId;
  specs?: SpecChoice;
  enemySpecs?: SpecChoice;
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
    reserves: { player: options.reserves ?? [], enemy: options.enemyReserves ?? [] },
    tactical: options.tactical,
    general: options.general,
    enemyGeneral: options.enemyGeneral,
    specs: { player: options.specs, enemy: options.enemySpecs },
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

/** Leaves units standing where they are, doing nothing, for a long while. */
export function freeze(...units: Unit[]): void {
  for (const u of units) u.stunTicks = 100_000;
}
