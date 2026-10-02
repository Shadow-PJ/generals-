// Screen layout, colors and fonts. Simple shapes and colors until real art arrives in 6B.

import { OPEN_FIELD } from '../data/maps';

/** Height of the bar above the battlefield that holds titles, the clock and buttons. */
export const TOP_BAR_HEIGHT = 64;
export const GAME_WIDTH = OPEN_FIELD.width;
export const GAME_HEIGHT = OPEN_FIELD.height + TOP_BAR_HEIGHT;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const COLORS = {
  background: 0x141a24,
  field: 0x1f2a38,
  fieldLine: 0x26344a,
  side: { player: 0x4da3ff, enemy: 0xff6b5b },
  sideDark: { player: 0x1b4a78, enemy: 0x80281f },
  projectile: { player: 0xcfe7ff, enemy: 0xffd0c8 },
  wall: 0x8c96a8,
  wallEdge: 0x5a6476,
  crack: 0x2a313d,
  hpBack: 0x0b0f16,
  hpGood: 0x4ade80,
  hpMid: 0xfacc15,
  hpLow: 0xf87171,
  barrier: 0x67e8f9,
  mark: 0xfde047,
  selected: 0xffffff,
  invalid: 0xf87171,
} as const;

export const TEXT = {
  title: '#f2e6c9',
  body: '#d6dde8',
  muted: '#8b97a8',
  victory: '#86efac',
  defeat: '#fca5a5',
  overtime: '#fb923c',
} as const;
