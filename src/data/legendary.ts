// Legendary actions (session 5A): each boss General teaches one when you beat them, and the
// first boss win opens the Legendary slot (slot 5). They only go on the card in that slot.
// Numbers are starting values to tune.

import type { LegendaryAction } from '../cards/types';
import type { GeneralId } from './generals';

export interface LegendaryActionData {
  name: string;
  /** What it does, for screens. */
  text: string;
  /** The boss General who teaches it. */
  teacher: GeneralId;
}

export const LEGENDARY_RULES = {
  /** Every Legendary action costs this many pips. */
  cost: 3,
  hijack: {
    /** How long the enemy troop fights for you. */
    seconds: 5,
  },
  fortify: {
    /** How long the wall stands, unless it is shot down first. */
    seconds: 8,
    hp: 400,
    /** The wall line: long side across the way between the armies, short side along it. */
    length: 160,
    thickness: 20,
    /** "Forward" puts the wall this far in front of your army's middle, "back" this far behind it. */
    armyOffset: 110,
    /** "Behind the enemy" puts it this far behind their army's middle. */
    behindOffset: 90,
    /** "At your Rangers" puts it this far in front of the nearest of them, toward the nearest enemy. */
    allyOffset: 50,
  },
} as const;

export const LEGENDARY_ACTION_DATA: Readonly<Record<LegendaryAction, LegendaryActionData>> = {
  hijack: {
    name: 'Hijack',
    text: `Control one enemy troop for ${LEGENDARY_RULES.hijack.seconds} s: it attacks its own army, and yours leave it alone`,
    teacher: 'hiveMother',
  },
  swap: { name: 'Swap', text: 'Two of your troops trade places instantly', teacher: 'strategist' },
  bloodPact: { name: 'Blood Pact', text: 'Sacrifice one troop to refill all pips and Momentum', teacher: 'warlord' },
  fortify: {
    name: 'Fortify',
    text: `Raise a wall line where you point, for ${LEGENDARY_RULES.fortify.seconds} s`,
    teacher: 'engineer',
  },
  echo: { name: 'Echo', text: 'Repeat your last card for free', teacher: 'conductor' },
};

/**
 * The bosses in the order the campaign meets them: Deep Forest and Void Ruins first, the Glass
 * Plains last (docs/DESIGN.md, Campaign). The Captain is no boss.
 */
export const BOSS_ORDER: readonly GeneralId[] = ['hiveMother', 'strategist', 'warlord', 'engineer', 'conductor'];

/** The Legendary actions you know after beating these bosses, in boss order. */
export function learnedActions(bossesBeaten: readonly GeneralId[]): LegendaryAction[] {
  return BOSS_ORDER.filter((g) => bossesBeaten.includes(g)).map(
    (g) => (Object.keys(LEGENDARY_ACTION_DATA) as LegendaryAction[]).find((a) => LEGENDARY_ACTION_DATA[a].teacher === g)!,
  );
}
