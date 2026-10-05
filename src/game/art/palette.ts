// The colors the pixel art is drawn with. Troops use three keys for their side's colors
// (L light, A main, a dark), so one drawing serves both armies: blue for you, red for the enemy.

import type { Side } from '../../sim';
import type { Palette } from './pixels';

/** Shared colors. Upper and lower case of one letter are a light and a dark shade. */
export const BASE: Palette = {
  k: 0x161b26, // outline
  e: 0x0b0e14, // eyes, deep shadow
  m: 0xe3e9f2, // metal, light
  M: 0x9ba7b9, // metal
  n: 0x5c677a, // metal, dark
  s: 0xf2c9a0, // skin
  S: 0xc8916a, // skin, shaded
  h: 0x6b4429, // hair, leather
  H: 0x3f2717, // hair, dark
  w: 0xb47c44, // wood
  W: 0x74502b, // wood, dark
  g: 0xf6c945, // gold
  G: 0xb5862c, // gold, dark
  c: 0xeadfc4, // cloth
  C: 0xb6a888, // cloth, shaded
  b: 0x2b2e3c, // boots
  r: 0xd2b4ff, // arcane glow
  R: 0x8b5cf6, // arcane
  f: 0xffb24a, // fire
  F: 0xf2541b, // fire, deep
  i: 0xc8efff, // frost
  I: 0x5fb8e6, // frost, deep
  l: 0x58b05a, // leaves
  d: 0x2f7a3f, // leaves, dark
  D: 0x1d4f2a, // leaves, deepest
  o: 0xb3b8c2, // stone
  O: 0x737a87, // stone, dark
  q: 0x474d59, // stone, deepest
  p: 0xd9c49a, // sand
  P: 0xa8875a, // sand, dark
  u: 0x9ee7e3, // glass
  U: 0x3fa7b0, // glass, deep
  v: 0x6d3fb0, // void
  V: 0x3b2266, // void, deep
  x: 0xffffff, // white
  y: 0xfff1a0, // pale yellow
  z: 0xd94848, // red (cheeks, gems)
};

/** Each side's three colors: light, main and dark. */
export const SIDE_COLORS: Readonly<Record<Side, { L: number; A: number; a: number }>> = {
  player: { L: 0xa3d4ff, A: 0x3d8bff, a: 0x1f4f9e },
  enemy: { L: 0xffab9e, A: 0xe2493b, a: 0x8c2219 },
};

const SIDE_PALETTES: Readonly<Record<Side, Palette>> = {
  player: { ...BASE, ...SIDE_COLORS.player },
  enemy: { ...BASE, ...SIDE_COLORS.enemy },
};

/** The palette a troop of this side is drawn with (the same object every time). */
export function sidePalette(side: Side): Palette {
  return SIDE_PALETTES[side];
}

/** Every key white: a troop's flash when it is hit. */
export const FLASH: Palette = Object.fromEntries([...Object.keys(BASE), 'L', 'A', 'a'].map((k) => [k, 0xffffff]));
