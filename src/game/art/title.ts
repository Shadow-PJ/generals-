// The title screen's picture (after the visual overhaul): dusk over the realm. A sky going from
// night to the glow of a setting sun, with stars, two ranges of mountains against it, and dark
// hills rising to the Capital's hill in the middle, where the screen stands its castle. Worked
// out in code, the same every time, at art size; the screen adds the castle, the armies, the
// title and drifting embers on top.

import type { PixelImage } from './frames';
import { bayer, hash, ramp, smooth } from './noise';

const SKY = [0x0d0a1c, 0x141029, 0x1d1536, 0x2a1b45, 0x3e2150, 0x5c2a55, 0x7f3452, 0xa4434a, 0xc85a42, 0xe57f45, 0xf3a457];
const SUN = [0xf08a48, 0xf7a85a, 0xfcc874, 0xffe39a];
const FAR_MOUNTAINS = { body: 0x3a2147, rim: 0x6a3458 };
const NEAR_MOUNTAINS = { body: 0x221530, rim: 0x46243f };
const HILLS = [0x0b130f, 0x101b14, 0x16251a, 0x1d3020, 0x253b26];
const STAR = [0x8a7aa0, 0xd8c8e8, 0xfff4d6];

/** The title picture's landmarks, in art pixels: where the horizon is and the castle stands. */
export interface TitleLayout {
  horizon: number;
  sun: { x: number; y: number; r: number };
  /** The top of the Capital's hill, where the castle stands. */
  hill: { x: number; y: number };
}

export function titleLayout(w: number, h: number): TitleLayout {
  const horizon = Math.round(h * 0.6);
  return {
    horizon,
    sun: { x: Math.round(w / 2), y: horizon - Math.round(h * 0.17), r: Math.round(h * 0.12) },
    hill: { x: Math.round(w / 2), y: horizon + Math.round(h * 0.02) },
  };
}

/** How high a ridge of mountains stands at column x: its height above the horizon in art pixels. */
function ridge(x: number, height: number, cell: number, salt: number): number {
  const big = smooth(x, 0, cell, salt);
  const small = smooth(x, 0, Math.max(3, Math.floor(cell / 4)), salt + 1);
  // Peaks: the noise sharpened, so the ridge has points rather than humps.
  const peak = 1 - Math.abs(big * 2 - 1);
  return Math.round(height * (0.35 + peak * 0.55 + small * 0.25));
}

/** The hills' top at column x: low at the sides, rising to the Capital's hill in the middle. */
function hillTop(layout: TitleLayout, w: number, x: number): number {
  const dx = (x - layout.hill.x) / (w * 0.16);
  const rise = Math.max(0, 1 - dx * dx);
  return Math.round(layout.horizon + 14 - rise * 16 + (smooth(x, 0, 23, 71) - 0.5) * 8);
}

const opaque = (rgb: number) => (0xff000000 | rgb) >>> 0;

export function titlePixels(w: number, h: number): PixelImage {
  const layout = titleLayout(w, h);
  const { horizon, sun } = layout;
  const pixels = new Uint32Array(w * h);
  // The mountains part in a valley in the middle, where the sun sets behind the Capital.
  const valley = (x: number) => 0.45 + 0.55 * Math.min(1, Math.abs(x - sun.x) / (w * 0.3));
  const far = Array.from({ length: w }, (_, x) => horizon - Math.round(ridge(x, h * 0.22, 60, 61) * valley(x)));
  const near = Array.from({ length: w }, (_, x) => horizon - Math.round(ridge(x, h * 0.13, 34, 63) * valley(x)) + 6);
  const hills = Array.from({ length: w }, (_, x) => hillTop(layout, w, x));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let color: number;
      if (y >= hills[x]!) {
        // The hills: lit on their tops by the low sun, darker toward the bottom of the screen.
        const depth = (y - hills[x]!) / (h - hills[x]!);
        const lit = Math.max(0, 1 - Math.abs(x - sun.x) / (w * 0.6));
        const value = 0.75 - depth * 0.9 + lit * 0.25 - (y === hills[x] ? -0.3 : 0) + (smooth(x, y, 9, 72) - 0.5) * 0.15;
        color = ramp(HILLS, value, x, y);
      } else if (y >= near[x]!) {
        color = y === near[x] ? NEAR_MOUNTAINS.rim : NEAR_MOUNTAINS.body;
      } else if (y >= far[x]!) {
        // The far range catches the sun on its left faces.
        const lit = far[x]! < far[Math.max(0, x - 1)]! && y < far[x]! + 3;
        color = y === far[x] || lit ? FAR_MOUNTAINS.rim : FAR_MOUNTAINS.body;
      } else {
        const dx = x - sun.x;
        const dy = y - sun.y;
        const fromSun = Math.sqrt(dx * dx + dy * dy);
        if (fromSun < sun.r) {
          // The sun, brightest in its middle, with bands of sky across its lower half.
          const band = dy > sun.r * 0.15 && Math.floor(dy / 3) % 2 === 0 && dy / 3 > sun.r * 0.12;
          color = band ? ramp(SKY, y / horizon, x, y) : ramp(SUN, 1 - fromSun / sun.r + 0.15, x, y);
        } else {
          // The sky, with a glow around the sun, and stars in the dark at the top.
          const glow = Math.max(0, 1 - (fromSun - sun.r) / (h * 0.45)) * 0.18;
          color = ramp(SKY, (y / horizon) * 1.02 + glow, x, y);
          const roll = hash(x, y, 73) % 400;
          if (y < horizon * 0.45 && roll < 3) color = STAR[roll]!;
        }
      }
      pixels[y * w + x] = opaque(color);
    }
  }
  // Shade the bottom edge, so the title's words and the armies read.
  for (let y = Math.floor(h * 0.85); y < h; y++) {
    const share = (y - h * 0.85) / (h * 0.15);
    for (let x = 0; x < w; x++) if (bayer(x, y) < share * 0.8) pixels[y * w + x] = opaque(HILLS[0]!);
  }
  return { w, h, pixels };
}
