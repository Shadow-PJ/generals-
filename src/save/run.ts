// Reading a saved run back. Like the rest of the profile, reading is forgiving: a run that doesn't
// read correctly in every part is dropped (null) rather than half-loaded, and the rest of your
// save still loads.

import type { Encounter, Fighter, MerchantItem, Offer, RunNode, RunState, Stop } from '../campaign/types';
import { LEGENDARY_ACTIONS, type LegendaryAction } from '../cards/types';
import { ARMY_SIZE, RESERVE_COUNT, type Troop, type TroopPlacement } from '../data/armies';
import { ARTIFACT_IDS, type ArtifactId } from '../data/artifacts';
import { BOON_IDS, type BoonId } from '../data/boons';
import { EVENT_IDS, type EventId } from '../data/events';
import { FACTION_IDS, type FactionId } from '../data/factions';
import { GENERAL_IDS, type GeneralId } from '../data/generals';
import { MAP_IDS, type MapId } from '../data/maps';
import { RANKS, type RankNumber } from '../data/ranks';
import { RARITIES, type Rarity } from '../data/rarity';
import { REGION_IDS, type RegionId } from '../data/regions';
import { NODE_KINDS, type NodeKind } from '../data/runs';
import { PERK_IDS, type PerkId } from '../data/perks';
import { TROOP_CLASSES, type TroopClass } from '../data/units';
import type { RngState } from '../sim';

type Data = Record<string, unknown>;

/** Thrown inside the reader when a part doesn't read; readRun turns it into null. */
class Unreadable extends Error {}

function fail(): never {
  throw new Unreadable();
}

function obj(value: unknown): Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Data) : fail();
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : fail();
}

function int(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fail();
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fail();
}

function bool(value: unknown): boolean {
  return typeof value === 'boolean' ? value : fail();
}

function oneOf<T>(options: readonly T[], value: unknown): T {
  return (options as readonly unknown[]).includes(value) ? (value as T) : fail();
}

function nullable<T>(value: unknown, read: (v: unknown) => T): T | null {
  return value === null ? null : read(value);
}

/** Ids from a list, each one known and none twice. */
function ids<T>(options: readonly T[], value: unknown): T[] {
  const out = list(value).map((v) => oneOf(options, v));
  return new Set(out).size === out.length ? out : fail();
}

const rank = (v: unknown) => oneOf<RankNumber>(RANKS.map((r) => r.rank), v);

function rng(value: unknown): RngState {
  const d = obj(value);
  const part = (v: unknown) => int(v, -0x80000000, 0x7fffffff);
  return { a: part(d.a), b: part(d.b), c: part(d.c), d: part(d.d) };
}

function troop(value: unknown): Troop {
  const d = obj(value);
  const t: Troop = { cls: oneOf<TroopClass>(TROOP_CLASSES, d.cls) };
  if (d.rarity !== undefined) t.rarity = oneOf<Rarity>(RARITIES, d.rarity);
  if (d.hp !== undefined) t.hp = num(d.hp);
  if (d.fighterId !== undefined) t.fighterId = int(d.fighterId);
  if (d.faction !== undefined) t.faction = faction(d.faction);
  if (d.perks !== undefined) t.perks = ids<PerkId>(PERK_IDS, d.perks);
  return t;
}

const faction = (v: unknown): FactionId | null => nullable(v, (f) => oneOf<FactionId>(FACTION_IDS, f));

/** A fighter's class, rarity, faction and perks. */
function traits(d: Data) {
  return {
    cls: oneOf<TroopClass>(TROOP_CLASSES, d.cls),
    rarity: oneOf<Rarity>(RARITIES, d.rarity),
    faction: faction(d.faction),
    perks: ids<PerkId>(PERK_IDS, d.perks),
  };
}

function placed(value: unknown): TroopPlacement {
  const d = obj(value);
  return { ...troop(d), x: num(d.x), y: num(d.y) };
}

function offer(value: unknown): Offer {
  const d = obj(value);
  if (d.kind === 'fighter') return { kind: 'fighter', ...traits(d) };
  if (d.kind === 'boon') return { kind: 'boon', boon: oneOf<BoonId>(BOON_IDS, d.boon) };
  return fail();
}

function encounter(value: unknown): Encounter {
  const d = obj(value);
  return {
    kind: oneOf<Encounter['kind']>(['battle', 'elite', 'boss'], d.kind),
    seed: num(d.seed),
    map: oneOf<MapId>(MAP_IDS, d.map),
    general: oneOf<GeneralId>(GENERAL_IDS, d.general),
    commander: nullable(d.commander, rank),
    troops: list(d.troops).map(placed),
    reserves: list(d.reserves).map(troop),
  };
}

function merchantItem(value: unknown): MerchantItem {
  const d = obj(value);
  return { offer: offer(d.offer), price: int(d.price), sold: bool(d.sold) };
}

function stop(value: unknown): Stop {
  const d = obj(value);
  switch (d.kind) {
    case 'fight':
      return { kind: 'fight', encounter: encounter(d.encounter) };
    case 'spoils':
      return { kind: 'spoils', gold: int(d.gold), artifact: nullable(d.artifact, (v) => oneOf<ArtifactId>(ARTIFACT_IDS, v)), offers: list(d.offers).map(offer) };
    case 'event':
      return {
        kind: 'event',
        event: oneOf<EventId>(EVENT_IDS, d.event),
        chosen: nullable(d.chosen, (v) => int(v)),
        outcome: list(d.outcome).map((l) => (typeof l === 'string' ? l : fail())),
      };
    case 'merchant':
      return { kind: 'merchant', stock: list(d.stock).map(merchantItem), rerolls: int(d.rerolls) };
    case 'camp':
      return { kind: 'camp', healed: num(d.healed), banked: ids<ArtifactId>(ARTIFACT_IDS, d.banked) };
    case 'end':
      return {
        kind: 'end',
        won: bool(d.won),
        banked: ids<ArtifactId>(ARTIFACT_IDS, d.banked),
        lost: ids<ArtifactId>(ARTIFACT_IDS, d.lost),
        learned: nullable(d.learned, (v) => oneOf<LegendaryAction>(LEGENDARY_ACTIONS, v)),
        opened: ids<RegionId>(REGION_IDS, d.opened),
        unlocked: nullable(d.unlocked, (v) => oneOf<TroopClass>(TROOP_CLASSES, v)),
      };
    default:
      return fail();
  }
}

function fighter(value: unknown): Fighter {
  const d = obj(value);
  const hp = num(d.hp);
  if (hp <= 0 || hp > 1) fail();
  const spot = nullable(d.spot, (v) => {
    const s = obj(v);
    return { x: num(s.x), y: num(s.y) };
  });
  return { id: int(d.id, 1), ...traits(d), hp, spot };
}

/** The floors of a run's map: each node leads only to nodes that exist on the next floor. */
function runMap(value: unknown): RunNode[][] {
  const floors = list(value).map((f) =>
    list(f).map((n) => {
      const d = obj(n);
      return { kind: oneOf<NodeKind>(NODE_KINDS, d.kind), next: list(d.next).map((i) => int(i)) };
    }),
  );
  if (floors.length === 0 || floors.some((f) => f.length === 0)) fail();
  floors.forEach((f, i) => {
    const after = floors[i + 1]?.length ?? 0;
    if (f.some((n) => n.next.some((j) => j >= after) || (after > 0 && n.next.length === 0))) fail();
  });
  return floors;
}

function run(value: unknown): RunState {
  const d = obj(value);
  const map = runMap(d.map);
  const path = list(d.path).map((i) => int(i));
  if (path.length > map.length || path.some((i, f) => i >= map[f]!.length || (f > 0 && !map[f - 1]![path[f - 1]!]!.next.includes(i)))) fail();
  const roster = list(d.roster).map(fighter);
  const known = new Set(roster.map((f) => f.id));
  if (known.size !== roster.length || roster.length === 0) fail();
  const team = (v: unknown, max: number, min: number) => {
    const out = list(v).map((id) => int(id));
    return out.length <= max && out.length >= min && out.every((id) => known.has(id)) && new Set(out).size === out.length ? out : fail();
  };
  const field = team(d.field, ARMY_SIZE, 1);
  const reserves = team(d.reserves, RESERVE_COUNT, 0);
  if (reserves.some((id) => field.includes(id))) fail();
  const nextFighterId = int(d.nextFighterId, Math.max(...known) + 1);
  return {
    region: oneOf<RegionId>(REGION_IDS, d.region),
    level: int(d.level, 0, REGION_IDS.length),
    seed: num(d.seed),
    rng: rng(d.rng),
    map,
    path,
    stop: nullable(d.stop, stop),
    gold: int(d.gold),
    roster,
    nextFighterId,
    field,
    reserves,
    boons: ids<BoonId>(BOON_IDS, d.boons),
    artifacts: ids<ArtifactId>(ARTIFACT_IDS, d.artifacts),
    eventsSeen: ids<EventId>(EVENT_IDS, d.eventsSeen),
    fightsWon: int(d.fightsWon),
    xp: int(d.xp),
  };
}

/** The saved run, or null when there is none or it doesn't read correctly. */
export function readRun(value: unknown): RunState | null {
  if (value === null || value === undefined) return null;
  try {
    return run(value);
  } catch (error) {
    if (error instanceof Unreadable) return null;
    throw error;
  }
}

/** Banked artifacts as saved: the known ones, each once. */
export function readArtifacts(value: unknown): ArtifactId[] {
  return Array.isArray(value) ? ARTIFACT_IDS.filter((id) => value.includes(id)) : [];
}
