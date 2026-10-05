// Veterans (session 5E): every fighter is a named individual with a record of battles, kills and
// boss kills. Your company is the troops you set out with on every run: it starts as eight
// Recruits, and fighters who finish a won run can stay in it as veterans. Ranks come with
// battles fought, each adding one perk. A troop that falls sits out the next fight; in Ironman
// mode it dies instead, for good. Starting values to tune.

import type { TroopClass } from './units';

export interface VeteranRank {
  name: string;
  /** Battles fought to reach it. */
  battles: number;
}

/** Recruit, Veteran and Elite. Reaching Veteran or Elite adds one perk the troop doesn't have. */
export const VETERAN_RANKS: readonly VeteranRank[] = [
  { name: 'Recruit', battles: 0 },
  { name: 'Veteran', battles: 4 },
  { name: 'Elite', battles: 10 },
];

export const COMPANY_RULES = {
  /** The most troops your company keeps: a full army, field and reserve. */
  size: 8,
  /** Fresh Recruits who fill an empty company place, in this order of classes. */
  recruitClasses: ['vanguard', 'vanguard', 'ranger', 'ranger', 'guardian', 'vanguard', 'ranger', 'guardian'] as readonly TroopClass[],
} as const;

/** Names for your fighters; a name already in use is passed over while others are free. */
export const FIGHTER_NAMES: readonly string[] = [
  'Raven', 'Ash', 'Briar', 'Cade', 'Dax', 'Ember', 'Flint', 'Grey',
  'Hale', 'Ivo', 'Jory', 'Kestrel', 'Lark', 'Moss', 'Nyx', 'Oak',
  'Pike', 'Quill', 'Rook', 'Sable', 'Thorn', 'Vale', 'Wren', 'Yarrow',
  'Zephyr', 'Bram', 'Cinder', 'Dune', 'Fen', 'Gale', 'Haze', 'Iris',
  'Juniper', 'Kite', 'Lumen', 'Marsh', 'North', 'Onyx', 'Pell', 'Reed',
  'Sage', 'Talon', 'Umber', 'Vesper', 'Wick', 'Birch', 'Clay', 'Drift',
  'Garnet', 'Holt', 'Indigo', 'Jet', 'Knox', 'Linden', 'Mica', 'Nettle',
  'Orrin', 'Perrin', 'Rune', 'Slate', 'Tamsin', 'Ulric', 'Vega', 'Wilder',
];
