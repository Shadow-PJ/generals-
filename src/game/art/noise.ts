// Noise and dithering for pictures worked out in code (the battle's ground, frames, the menus'
// backdrop and the world map): the same spot always gives the same value, so a picture never
// changes between visits.

/** A whole number from a spot and a salt, the same every time. */
export function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 0 to 1 from a spot and a salt. */
export function unit(x: number, y: number, salt: number): number {
  return hash(x, y, salt) / 0x100000000;
}

/** Smooth noise, 0 to 1: values on a grid of `cell` pixels, blended between. */
export function smooth(x: number, y: number, cell: number, salt: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = (((x % cell) + cell) % cell) / cell;
  const fy = (((y % cell) + cell) % cell) / cell;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = unit(gx, gy, salt) * (1 - sx) + unit(gx + 1, gy, salt) * sx;
  const bottom = unit(gx, gy + 1, salt) * (1 - sx) + unit(gx + 1, gy + 1, salt) * sx;
  return top * (1 - sy) + bottom * sy;
}

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** The ordered-dither threshold at a pixel, 0 to just under 1: blends two shades without new colors. */
export function bayer(x: number, y: number): number {
  return (BAYER_4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
}

/**
 * A shade from a ramp (darkest first) for a value from 0 to 1, dithered with its neighbor so
 * gradients come out in the ramp's own colors.
 */
export function ramp(shades: readonly number[], value: number, x: number, y: number): number {
  const at = Math.max(0, Math.min(1, value)) * (shades.length - 1);
  const low = Math.floor(at);
  const pick = at - low > bayer(x, y) ? low + 1 : low;
  return shades[Math.min(shades.length - 1, pick)]!;
}
