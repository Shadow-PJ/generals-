// Reading a saved run back, and the rest of the campaign: your company, Tech Web and Mastery.
// Like the rest of the profile, reading is forgiving: a run that doesn't read correctly in every
// part is dropped (null) rather than half-loaded, and the rest of your save still loads.

import type { Encounter, Fighter, FighterRecord, MerchantItem, Offer, RunNode, RunState, Stop, TechWeb, Veteran } from '../campaign/types';
import { LEGENDARY_ACTIONS, type LegendaryAction } from '../cards/types';
import { ARMY_SIZE, RESERVE_COUNT, type Troop, type TroopPlacement } from '../data/armies';
import { ARTIFACT_IDS, type ArtifactId } from '../data/artifacts';
import { BOON_IDS, type BoonId } from '../data/boons';
import { EVENT_IDS, type EventId } from '../data/events';
import { FACTION_IDS, type FactionId } from '../data/factions';
import { GENERAL_IDS, type GeneralId } from '../data/generals';
import { MAP_IDS, type MapId } from '../data/maps';
import { MASTERY, type MasteryId } from '../data/mastery';
import { RANKS, type RankNumber } from '../data/ranks';
import { RARITIES, type Rarity } from '../data/rarity';
import { REGION_IDS, type RegionId } from '../data/regions';
import { NODE_KINDS, type NodeKind } from '../data/runs';
import { PERK_IDS, type PerkId } from '../data/perks';
import { SPECIALIZATIONS, type SpecializationId } from '../data/specializations';
import { TECH_NODE_IDS } from '../data/tech';
import { COMPANY_RULES } from '../data/veterans';
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
  if (d.turret !== undefined) t.turret = bool(d.turret);
  if (d.artifact !== undefined) t.artifact = oneOf<ArtifactId>(ARTIFACT_IDS, d.artifact);
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
        keep: ids<number>(list(d.keep).map((v) => int(v)), d.keep),
        died: ids<number>(list(d.died).map((v) => int(v)), d.died),
      };
    default:
      return fail();
  }
}

function name(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fail();
}

function record(value: unknown): FighterRecord {
  const d = obj(value);
  return { battles: int(d.battles), kills: int(d.kills), bossKills: int(d.bossKills) };
}

const artifactOrNull = (v: unknown): ArtifactId | null => nullable(v, (a) => oneOf<ArtifactId>(ARTIFACT_IDS, a));

function fighter(value: unknown): Fighter {
  const d = obj(value);
  const hp = num(d.hp);
  if (hp <= 0 || hp > 1) fail();
  const spot = nullable(d.spot, (v) => {
    const s = obj(v);
    return { x: num(s.x), y: num(s.y) };
  });
  return {
    id: int(d.id, 1),
    name: name(d.name),
    ...traits(d),
    record: record(d.record),
    artifact: artifactOrNull(d.artifact),
    veteranId: nullable(d.veteranId, (v) => int(v, 1)),
    hp,
    wounded: bool(d.wounded),
    spot,
  };
}

function veteran(value: unknown): Veteran {
  const d = obj(value);
  return { id: int(d.id, 1), name: name(d.name), ...traits(d), record: record(d.record), artifact: artifactOrNull(d.artifact) };
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
  const end = nullable(d.stop, stop);
  if (end?.kind === 'end' && [...end.keep, ...end.died].some((id) => !known.has(id))) fail();
  const nextFighterId = int(d.nextFighterId, Math.max(...known) + 1);
  return {
    region: oneOf<RegionId>(REGION_IDS, d.region),
    level: int(d.level, 0, REGION_IDS.length),
    seed: num(d.seed),
    rng: rng(d.rng),
    map,
    path,
    stop: end,
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
    insight: int(d.insight),
    ironman: bool(d.ironman),
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

/** Your company as saved: every troop that reads correctly, each id and name once, at most a company's worth. Each artifact on one troop at most. */
export function readCompany(value: unknown, banked: readonly ArtifactId[]): Veteran[] {
  if (!Array.isArray(value)) return [];
  const company: Veteran[] = [];
  for (const v of value) {
    try {
      const vet = veteran(v);
      if (company.some((c) => c.id === vet.id || c.name === vet.name) || company.length >= COMPANY_RULES.size) continue;
      const carried = vet.artifact !== null && (!banked.includes(vet.artifact) || company.some((c) => c.artifact === vet.artifact));
      company.push(carried ? { ...vet, artifact: null } : vet);
    } catch (error) {
      if (!(error instanceof Unreadable)) throw error;
    }
  }
  return company;
}

/** The Tech Web as saved: for each class, its known nodes (once each) and its specialization, if it belongs to the class. */
export function readTech(value: unknown): TechWeb {
  const web: TechWeb = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return web;
  for (const cls of TROOP_CLASSES) {
    const d = (value as Data)[cls];
    if (typeof d !== 'object' || d === null) continue;
    const saved = d as Data;
    const nodes = Array.isArray(saved.nodes) ? TECH_NODE_IDS.filter((n) => (saved.nodes as unknown[]).includes(n)) : [];
    const spec = typeof saved.spec === 'string' && SPECIALIZATIONS[saved.spec as SpecializationId]?.cls === cls ? (saved.spec as SpecializationId) : null;
    if (nodes.length > 0 || spec) web[cls] = { nodes, spec };
  }
  return web;
}

/** The Mastery challenges met, as saved: the known ones, each once. */
export function readMastery(value: unknown): MasteryId[] {
  if (!Array.isArray(value)) return [];
  const known = GENERAL_IDS.flatMap((g) => MASTERY[g].map((_, i) => `${g}.${i}` as MasteryId));
  return value.filter((id, i): id is MasteryId => known.includes(id as MasteryId) && value.indexOf(id) === i);
}
