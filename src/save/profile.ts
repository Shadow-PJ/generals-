// Your saved progress: the cards in your slots, where your troops stand, your rank, Tactical
// mode and your General. It is plain JSON in saves/profile.json. Reading is forgiving: anything missing
// or damaged falls back to the default, so a bad file never stops the game from starting.
// Phase 5 grows this into the full save with migrations; `version` is there for that.

import { readCard } from '../cards/schema';
import { emptyLoadout, type Loadout } from '../cards/types';
import { STARTER_ARMY, type TroopPlacement } from '../data/armies';
import { OPEN_FIELD } from '../data/maps';
import { GENERAL_IDS, STARTING_GENERAL, type GeneralId } from '../data/generals';
import { DEBUG_DEFAULT_RANK, RANKS, type RankNumber } from '../data/ranks';
import type { FileName } from '../platform';
import { isArmyPlaced } from '../sim';

export const PROFILE_VERSION = 1;
export const PROFILE_FILE: FileName = 'saves/profile.json';

export interface Profile {
  version: typeof PROFILE_VERSION;
  loadout: Loadout;
  placement: TroopPlacement[];
  rank: RankNumber;
  tactical: boolean;
  /** Your cards are stored as you wrote them; the General's rules are applied when they are read. */
  general: GeneralId;
}

export function newProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    loadout: emptyLoadout(),
    placement: STARTER_ARMY.map((t) => ({ ...t })),
    rank: DEBUG_DEFAULT_RANK,
    tactical: false,
    general: STARTING_GENERAL,
  };
}

export function writeProfile(profile: Profile): string {
  return `${JSON.stringify(profile, null, 2)}\n`;
}

/** The profile in the text, keeping every part that reads correctly. Null text gives a new profile. */
export function readProfile(text: string | null): Profile {
  const profile = newProfile();
  if (text === null) return profile;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return profile;
  }
  if (typeof data !== 'object' || data === null) return profile;
  const saved = data as Record<string, unknown>;
  profile.loadout = readLoadout(saved.loadout);
  profile.placement = readPlacement(saved.placement) ?? profile.placement;
  if (RANKS.some((r) => r.rank === saved.rank)) profile.rank = saved.rank as RankNumber;
  if (typeof saved.tactical === 'boolean') profile.tactical = saved.tactical;
  if ((GENERAL_IDS as readonly unknown[]).includes(saved.general)) profile.general = saved.general as GeneralId;
  return profile;
}

function readLoadout(value: unknown): Loadout {
  const loadout = emptyLoadout();
  if (typeof value !== 'object' || value === null) return loadout;
  const saved = value as Record<string, unknown>;
  const slots = saved.slots;
  if (Array.isArray(slots)) loadout.slots = loadout.slots.map((_, i) => readCard(slots[i]));
  loadout.legendary = readCard(saved.legendary);
  return loadout;
}

/** Your troops as saved, if it is the same army and every troop still stands somewhere it may. */
function readPlacement(value: unknown): TroopPlacement[] | null {
  if (!Array.isArray(value) || value.length !== STARTER_ARMY.length) return null;
  const placement: TroopPlacement[] = [];
  for (const [i, t] of value.entries()) {
    if (typeof t !== 'object' || t === null) return null;
    const { cls, x, y } = t as Record<string, unknown>;
    const expected = STARTER_ARMY[i]!.cls;
    if (cls !== expected || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    placement.push({ cls: expected, x: x as number, y: y as number });
  }
  return isArmyPlaced(OPEN_FIELD, 'player', placement) ? placement : null;
}
