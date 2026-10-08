// What two players' games say to each other through the relay (session 6D). The relay carries
// these without reading them (server/protocol.ts). Before a battle each side sends its army and
// cards, which the other checks against the match's rules; during it, only key presses by tick
// and, every few seconds, a fingerprint of the battle to catch a desync. Pure: no network here.

import type { LegendaryAction, Loadout } from '../cards/types';
import type { TroopPlacement } from '../data/armies';
import type { GeneralId } from '../data/generals';
import type { MapId } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import type { SpecChoice } from '../data/specializations';
import type { UnitClass } from '../data/units';

/** Bumped when the messages change, so two different versions of the game refuse to play. */
export const VERSUS_PROTOCOL = 1;

/** What the host sets for the match: the map and the rank both players fight at. */
export interface MatchRules {
  map: MapId;
  rank: RankNumber;
}

/**
 * A player's side of a battle, as they set it up on their own screen: their troops placed in
 * the left-hand deploy zone, as everyone sees their own army; the guest's are mirrored onto the
 * right when the battle is built.
 */
export interface VersusArmy {
  general: GeneralId;
  placement: TroopPlacement[];
  reserves: UnitClass[];
  specs: SpecChoice;
  loadout: Loadout;
  /** The Legendary actions they have learned, which open their Legendary slot. */
  learned: LegendaryAction[];
}

/** A key press as it travels: which slot, or the ultimate. */
export type VersusPress = { kind: 'slot'; slot: number } | { kind: 'ultimate' };

export type MatchMessage =
  /** First thing each side says: which version of the messages it speaks. */
  | { kind: 'hello'; protocol: number }
  /** Host: the match's rules, whenever they change in the lobby. */
  | { kind: 'rules'; rules: MatchRules }
  /** Host: on to setting up armies, with these rules. */
  | { kind: 'begin'; rules: MatchRules }
  /** A side is ready for battle `round`: its army and cards. The host's carries the battle's seed. */
  | { kind: 'army'; round: number; army: VersusArmy; seed?: number }
  /** The other side's army checked: empty problems means it may play. */
  | { kind: 'verdict'; round: number; problems: string[] }
  /** The presses for one tick of battle `round` (often none). */
  | { kind: 'inputs'; round: number; tick: number; presses: VersusPress[] }
  /** The battle's fingerprint after `tick`. */
  | { kind: 'hash'; round: number; tick: number; hash: number }
  /** Leaving the match. */
  | { kind: 'leave' };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

function readPresses(value: unknown): VersusPress[] | null {
  if (!Array.isArray(value) || value.length > 10) return null;
  const presses: VersusPress[] = [];
  for (const p of value) {
    if (!isObject(p)) return null;
    if (p.kind === 'ultimate') presses.push({ kind: 'ultimate' });
    else if (p.kind === 'slot' && isInt(p.slot) && p.slot >= 0 && p.slot <= 4) presses.push({ kind: 'slot', slot: p.slot });
    else return null;
  }
  return presses;
}

/**
 * A message from the other player, or null if it isn't one we understand. Only the shape is
 * checked here; an army's contents are checked against the rules by `armyProblems`.
 */
export function readMatchMessage(data: unknown): MatchMessage | null {
  if (!isObject(data)) return null;
  switch (data.kind) {
    case 'hello':
      return isInt(data.protocol) ? { kind: 'hello', protocol: data.protocol } : null;
    case 'rules':
    case 'begin':
      return isObject(data.rules) && typeof data.rules.map === 'string' && isInt(data.rules.rank)
        ? { kind: data.kind, rules: { map: data.rules.map as MapId, rank: data.rules.rank as RankNumber } }
        : null;
    case 'army':
      if (!isInt(data.round) || !isObject(data.army) || (data.seed !== undefined && !isInt(data.seed))) return null;
      return { kind: 'army', round: data.round, army: data.army as unknown as VersusArmy, ...(data.seed === undefined ? {} : { seed: data.seed }) };
    case 'verdict':
      return isInt(data.round) && Array.isArray(data.problems) && data.problems.every((p) => typeof p === 'string')
        ? { kind: 'verdict', round: data.round, problems: (data.problems as string[]).slice(0, 10) }
        : null;
    case 'inputs': {
      const presses = readPresses(data.presses);
      return isInt(data.round) && isInt(data.tick) && data.tick >= 0 && presses ? { kind: 'inputs', round: data.round, tick: data.tick, presses } : null;
    }
    case 'hash':
      return isInt(data.round) && isInt(data.tick) && isInt(data.hash) ? { kind: 'hash', round: data.round, tick: data.tick, hash: data.hash } : null;
    case 'leave':
      return { kind: 'leave' };
    default:
      return null;
  }
}
