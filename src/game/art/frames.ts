// Pixel-art frames for every box in the game (visual overhaul after 6C): panels with a gold trim
// and corner studs, list rows, buttons standing on a lip, cards for the battle's slots and
// sunken wells for bars and text. They stretch to any size, so they are drawn in code rather
// than as text grids, with the same chunky pixel as the troops: one art pixel is UI_PIXEL world
// units. Pure: textures.ts turns them into Phaser textures.
//
// Also the menus' backdrop: a dark cloth, lit from above and darker toward the edges.

import { bayer, hash, ramp, smooth } from './noise';

/** World units per art pixel for frames and the backdrop: the troops' scale. */
export const UI_PIXEL = 2;

export interface FrameStyle {
  /** The dark line around the box; its corners are cut by one pixel. */
  outline: number;
  /** A ring inside the outline, lit from the top left. */
  trim?: { light: number; dark: number };
  /** A dark line inside the trim. */
  inner?: number;
  /** The inside, top to bottom: shades blended with an ordered dither. */
  fill: readonly number[];
  /** A row of light along the top of the inside, and a darker one along its bottom. */
  bevel?: { light: number; dark: number };
  /** The box stands on a lip this many pixels tall (buttons). */
  lip?: { color: number; rows: number };
  /** Gold studs in the trim's corners (boxes big enough for them). */
  studs?: { light: number; dark: number };
  /** A faint grain in the fill: the share of pixels one shade off. */
  grain?: number;
}

const INK = 0x0e0b12;
const GOLD = { light: 0xf3d27a, mid: 0xd9a74a, dark: 0x8a5a2b };
const STUDS = { light: 0xfff0b8, dark: 0xb5813a };

/** Every kind of box. */
export const FRAME_STYLES = {
  /** A screen's main panels: the Captain's tips, the result, footers. */
  panel: {
    outline: INK,
    trim: { light: GOLD.mid, dark: GOLD.dark },
    inner: 0x1a141f,
    fill: [0x2f2537, 0x2b2233, 0x261e2d, 0x221a28],
    studs: STUDS,
    grain: 0.05,
  },
  /** A plainer panel, for boxes inside a panel. */
  plain: {
    outline: INK,
    fill: [0x2a2231, 0x251e2c, 0x211a27],
    bevel: { light: 0x3d3146, dark: 0x1a141f },
    grain: 0.04,
  },
  /** A list row, and the one in focus. */
  row: {
    outline: INK,
    fill: [0x2d2435, 0x2a2231, 0x261f2d],
    bevel: { light: 0x3e3248, dark: 0x1d1723 },
  },
  rowOn: {
    outline: INK,
    trim: { light: GOLD.light, dark: GOLD.mid },
    fill: [0x56412f, 0x4b3a2e, 0x413227],
    bevel: { light: 0x6e5440, dark: 0x35281f },
  },
  /** Owned (green trim) and ready to take (gold trim). */
  rowGood: {
    outline: INK,
    trim: { light: 0x86efac, dark: 0x3f8f5a },
    fill: [0x2d2435, 0x2a2231, 0x261f2d],
  },
  rowGold: {
    outline: INK,
    trim: { light: GOLD.mid, dark: GOLD.dark },
    fill: [0x2d2435, 0x2a2231, 0x261f2d],
  },
  /** Locked or not yet known. */
  rowDim: {
    outline: INK,
    fill: [0x1e1824, 0x1b1520],
    bevel: { light: 0x271f2e, dark: 0x16111b },
  },
  /** Buttons: resting, under the mouse, and the choice that is on. */
  button: {
    outline: INK,
    fill: [0x524160, 0x4a3a57, 0x42344e],
    bevel: { light: 0x6e5a80, dark: 0x3a2e45 },
    lip: { color: 0x241c2b, rows: 2 },
  },
  buttonHover: {
    outline: INK,
    fill: [0x655078, 0x5c486d, 0x534163],
    bevel: { light: 0x8a74a0, dark: 0x473a56 },
    lip: { color: 0x2b2234, rows: 2 },
  },
  buttonOn: {
    outline: INK,
    fill: [0xc08a45, 0xae7a3b, 0x9b6a31],
    bevel: { light: 0xeec27a, dark: 0x83582a },
    lip: { color: 0x5a3a1c, rows: 2 },
  },
  /** The battle's card slots: resting, ready and locked. */
  card: {
    outline: INK,
    trim: { light: 0x7a6688, dark: 0x45374f },
    fill: [0x30263a, 0x2a2133, 0x241c2b],
    grain: 0.04,
  },
  cardReady: {
    outline: INK,
    trim: { light: GOLD.light, dark: GOLD.mid },
    inner: 0x3a2a1c,
    fill: [0x3e3040, 0x352939, 0x2d2331],
    studs: STUDS,
    grain: 0.04,
  },
  cardDim: {
    outline: INK,
    trim: { light: 0x3a3042, dark: 0x2a2231 },
    fill: [0x1d1822, 0x1a151f],
  },
  /** Sunken: text boxes, bar wells, the battle's bars. */
  well: {
    outline: INK,
    fill: [0x0f0c13, 0x15111a],
    bevel: { light: 0x0a080d, dark: 0x3a2f43 },
  },
  /** The battle's top and bottom bars. */
  bar: {
    outline: INK,
    trim: { light: 0x4d3d57, dark: 0x2a2130 },
    fill: [0x241c2b, 0x1f1825, 0x1b1520],
    grain: 0.05,
  },
} as const satisfies Record<string, FrameStyle>;

export type FrameStyleId = keyof typeof FRAME_STYLES;

/** A picture worked out in code: `w × h` pixels, row by row, as 0xAARRGGBB (0 is clear). */
export interface PixelImage {
  w: number;
  h: number;
  pixels: Uint32Array;
}

const opaque = (rgb: number) => (0xff000000 | rgb) >>> 0;

/**
 * A frame `w × h` art pixels big: the outline with its corners cut, the trim and inner line in
 * rings inside it, then the fill; a button's lip takes the bottom rows.
 */
export function framePixels(style: FrameStyle, w: number, h: number): PixelImage {
  const pixels = new Uint32Array(w * h);
  const lip = style.lip?.rows ?? 0;
  // The face: everything above the lip.
  const faceBottom = h - 1 - lip;
  const rings: { light: number; dark: number }[] = [];
  if (style.trim) rings.push(style.trim);
  if (style.inner !== undefined) rings.push({ light: style.inner, dark: style.inner });
  const fillTop = 1 + rings.length;
  const fillBottom = faceBottom - rings.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edgeX = x === 0 || x === w - 1;
      const edgeY = y === 0 || y === h - 1;
      if (edgeX && edgeY) continue; // The cut corners.
      let color: number;
      if (edgeX || edgeY) color = style.outline;
      else if (y > faceBottom) color = y === h - 1 ? style.outline : style.lip!.color;
      else if (y === faceBottom && lip > 0) color = style.outline;
      else {
        // Rings inside the outline: how far in this pixel is, from the face's own edges.
        const left = x;
        const top = y;
        const right = w - 1 - x;
        const bottom = faceBottom - y;
        const depth = Math.min(left, top, right, bottom);
        if (depth <= rings.length) {
          const ring = rings[depth - 1]!;
          // Lit from the top left: the top and left sides light, the bottom and right dark.
          const lit = top === depth || (left === depth && bottom !== depth);
          color = lit ? ring.light : ring.dark;
        } else color = fillColor(style, x, y, fillTop, fillBottom);
      }
      pixels[y * w + x] = opaque(color);
    }
  }
  if (style.studs && w >= 16 && h >= 12) addStuds(pixels, w, faceBottom, style.studs);
  return { w, h, pixels };
}

function fillColor(style: FrameStyle, x: number, y: number, top: number, bottom: number): number {
  if (style.bevel && y === top) return style.bevel.light;
  if (style.bevel && y === bottom) return style.bevel.dark;
  const span = Math.max(1, bottom - top);
  let value = (y - top) / span;
  // Grain: here and there a pixel a shade off, so a big panel isn't flat.
  if (style.grain) {
    const roll = hash(x, y, 31) % 1000;
    if (roll < style.grain * 500) value -= 1 / style.fill.length;
    else if (roll < style.grain * 1000) value += 1 / style.fill.length;
  }
  return ramp(style.fill, value, x, y);
}

/** A 2×2 stud in each corner of the trim: lit on its top-left pixel. */
function addStuds(pixels: Uint32Array, w: number, faceBottom: number, studs: { light: number; dark: number }): void {
  const corners = [
    [1, 1],
    [w - 3, 1],
    [1, faceBottom - 2],
    [w - 3, faceBottom - 2],
  ] as const;
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) pixels[(cy + dy) * w + cx + dx] = opaque(dx === 0 && dy === 0 ? studs.light : studs.dark);
    }
  }
}

/** The backdrop's shades, darkest first. */
const BACKDROP = [0x0d0a11, 0x110d16, 0x15111b, 0x1a1521, 0x1f1927, 0x241d2d, 0x2a2234];

/**
 * The menus' backdrop, `w × h` art pixels: a dark cloth lit from above, with soft folds of
 * light and dark, a faint woven lattice, and darker edges.
 */
export function backdropPixels(w: number, h: number): PixelImage {
  const pixels = new Uint32Array(w * h);
  const cx = w / 2;
  const cy = h * 0.38;
  const reach = Math.sqrt(cx * cx + (h * 0.7) * (h * 0.7));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const away = Math.sqrt(dx * dx + dy * dy) / reach;
      // Light pooled near the top middle, folds of the cloth, then darker edges.
      let value = 0.78 - away * 0.85;
      value += (smooth(x, y, 40, 5) - 0.5) * 0.22 + (smooth(x, y, 13, 6) - 0.5) * 0.08;
      // A faint woven lattice of diamonds.
      const lattice = (x + y) % 24 === 0 || (((x - y) % 24) + 24) % 24 === 0;
      if (lattice && bayer(x, y) < 0.5) value += 0.07;
      pixels[y * w + x] = opaque(ramp(BACKDROP, value, x, y));
    }
  }
  return { w, h, pixels };
}
