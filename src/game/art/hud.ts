// Small pixel art for the battle's bars (visual overhaul after 6C): the gems that count pips,
// full or empty, on the slot cards and beside Momentum.

import { BASE } from './palette';
import { still, type Palette, type Sprite } from './pixels';

/** A pip you hold: a cut blue gem. */
export const PIP_GEM: Sprite = still(['..kkk..', '.kxiik.', 'kxiiiIk', 'kiiiIIk', 'kiiIIIk', '.kIIIk.', '..kkk..']);

/** A pip you could hold but don't: an empty socket. */
export const PIP_SOCKET: Sprite = still(['..kkk..', '.kqqqk.', 'kqeeeOk', 'keeeeOk', 'keeeOOk', '.kOOOk.', '..kkk..']);

/** The gem's colors: blue, or green when a card costs less than written. */
export const GEM_PALETTES: Readonly<Record<'pip' | 'cheap', Palette>> = {
  pip: BASE,
  cheap: { ...BASE, i: 0x86efac, I: 0x2f9a5a },
};
