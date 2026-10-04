// Your army in a run: the roster of fighters, which 5 take the field and which 3 wait in reserve,
// and where they stand. New fighters fill the field first, then the reserves; the rest wait.

import { ARMY_SIZE, RESERVE_COUNT, STARTER_ARMY, STARTER_ARMY_MIRRORED, type Troop, type TroopPlacement } from '../data/armies';
import type { MapData } from '../data/maps';
import type { UnitClass } from '../data/units';
import { placementProblem, type Side } from '../sim';
import type { Fighter, FighterTraits, RunState } from './types';

export type Role = 'field' | 'reserve' | 'rest';

/** The starter army's five spots: two in front, two at the back, one in the middle. */
const FRONT = [0, 1];
const BACK = [2, 3];
const MIDDLE = [4];

/** Which spots a class likes best: melee in front, shooters at the back, Guardians in the middle. */
const SPOT_ORDER: Readonly<Record<UnitClass, readonly number[]>> = {
  vanguard: [...FRONT, ...MIDDLE, ...BACK],
  assassin: [...FRONT, ...MIDDLE, ...BACK],
  guardian: [...MIDDLE, ...FRONT, ...BACK],
  ranger: [...BACK, ...MIDDLE, ...FRONT],
  invoker: [...BACK, ...MIDDLE, ...FRONT],
};

/** Grid steps tried when every usual spot is taken. */
const GRID_STEP = 30;

/** A spot for a troop of `cls` on its side, clear of `taken`: its class's favourite free spot, else any free one. */
function freeSpot(map: MapData, side: Side, cls: UnitClass, taken: readonly TroopPlacement[]): { x: number; y: number } {
  const spots = side === 'player' ? STARTER_ARMY : STARTER_ARMY_MIRRORED;
  for (const i of SPOT_ORDER[cls]) {
    const { x, y } = spots[i]!;
    if (placementProblem(map, side, cls, x, y, taken) === null) return { x, y };
  }
  const zone = map.deployZones[side];
  for (let x = zone.x + GRID_STEP; x < zone.x + zone.w; x += GRID_STEP) {
    for (let y = zone.y + GRID_STEP; y < zone.y + zone.h; y += GRID_STEP) {
      if (placementProblem(map, side, cls, x, y, taken) === null) return { x, y };
    }
  }
  throw new Error(`No room for a ${cls} on the ${side} side of ${map.name}`);
}

/** Troops lined up on one side: front-liners in front, shooters behind. */
export function formation<T extends Troop>(map: MapData, side: Side, troops: readonly T[]): (T & { x: number; y: number })[] {
  const placed: (T & { x: number; y: number })[] = [];
  for (const troop of troops) placed.push({ ...troop, ...freeSpot(map, side, troop.cls, placed) });
  return placed;
}

export function fighterById(run: RunState, id: number): Fighter | undefined {
  return run.roster.find((f) => f.id === id);
}

export function roleOf(run: RunState, id: number): Role {
  if (run.field.includes(id)) return 'field';
  if (run.reserves.includes(id)) return 'reserve';
  return 'rest';
}

/**
 * The run with a fighter moved to another role. The field holds 5 and the reserves 3; a full
 * role takes no one more, and the field never goes empty. Returns the run unchanged then.
 */
export function withRole(run: RunState, id: number, role: Role): RunState {
  if (!fighterById(run, id) || roleOf(run, id) === role) return run;
  if (role === 'field' && run.field.length >= ARMY_SIZE) return run;
  if (role === 'reserve' && run.reserves.length >= RESERVE_COUNT) return run;
  const field = run.field.filter((f) => f !== id);
  if (field.length === 0) return run;
  const reserves = run.reserves.filter((f) => f !== id);
  if (role === 'field') field.push(id);
  if (role === 'reserve') reserves.push(id);
  return { ...run, field, reserves };
}

/** The next role a fighter can take, in the order field, reserve, waiting; its own role if none is free. */
export function nextRole(run: RunState, id: number, step: number): Role {
  const roles: Role[] = ['field', 'reserve', 'rest'];
  const now = roles.indexOf(roleOf(run, id));
  for (let k = 1; k < roles.length; k++) {
    const role = roles[(((now + k * step) % roles.length) + roles.length) % roles.length]!;
    if (withRole(run, id, role) !== run) return role;
  }
  return roles[now]!;
}

/** The run with a new fighter: on the field if there is room, else in reserve, else waiting. */
export function addFighter(run: RunState, traits: FighterTraits, hp = 1): RunState {
  const fighter: Fighter = { id: run.nextFighterId, cls: traits.cls, rarity: traits.rarity, faction: traits.faction, perks: [...traits.perks], hp, spot: null };
  const field = run.field.length < ARMY_SIZE ? [...run.field, fighter.id] : run.field;
  const reserves = field === run.field && run.reserves.length < RESERVE_COUNT ? [...run.reserves, fighter.id] : run.reserves;
  return { ...run, roster: [...run.roster, fighter], nextFighterId: run.nextFighterId + 1, field, reserves };
}

/** The run without a fighter. If that empties the field, the healthiest fighter left steps in. */
export function removeFighter(run: RunState, id: number): RunState {
  const roster = run.roster.filter((f) => f.id !== id);
  const reserves = run.reserves.filter((f) => f !== id);
  let field = run.field.filter((f) => f !== id);
  if (field.length === 0 && roster.length > 0) {
    const next = [...roster].sort((a, b) => b.hp - a.hp || a.id - b.id)[0]!;
    field = [next.id];
    return { ...run, roster, field, reserves: reserves.filter((f) => f !== next.id) };
  }
  return { ...run, roster, field, reserves };
}

/** Your fielded fighters as troops on the map: where they stood last if they still fit there, else a free spot. */
export function fieldPlacement(run: RunState, map: MapData): TroopPlacement[] {
  const placed: TroopPlacement[] = [];
  const later: Fighter[] = [];
  for (const id of run.field) {
    const f = fighterById(run, id);
    if (!f) continue;
    if (f.spot && placementProblem(map, 'player', f.cls, f.spot.x, f.spot.y, placed) === null) placed.push({ ...troopOf(f), ...f.spot });
    else later.push(f);
  }
  for (const f of later) placed.push({ ...troopOf(f), ...freeSpot(map, 'player', f.cls, placed) });
  // Back in field order, so the first fielded fighter is the first troop.
  return run.field.flatMap((id) => placed.find((t) => t.fighterId === id) ?? []);
}

/** Your reserve fighters, in order, as troops for the battle. */
export function reserveTroops(run: RunState): Troop[] {
  return run.reserves.flatMap((id) => {
    const f = fighterById(run, id);
    return f ? [troopOf(f)] : [];
  });
}

/** A fighter as a troop for the battle engine. */
export function troopOf(f: Fighter): Troop {
  return { cls: f.cls, rarity: f.rarity, hp: f.hp, faction: f.faction, perks: [...f.perks], fighterId: f.id };
}

/** The run with each fielded fighter's spot remembered from the placement you made. */
export function withSpots(run: RunState, placement: readonly TroopPlacement[]): RunState {
  const spots = new Map(placement.flatMap((t) => (t.fighterId === undefined ? [] : [[t.fighterId, { x: t.x, y: t.y }] as const])));
  return { ...run, roster: run.roster.map((f) => (spots.has(f.id) ? { ...f, spot: spots.get(f.id)! } : f)) };
}
