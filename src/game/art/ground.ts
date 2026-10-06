// The battlefield's ground as one picture (session 6B): each map's soil in a few shades of its
// own colors, a worn line down the middle, trees packed into its forests, and small scenery
// scattered where nothing stands. It is worked out from the map alone (no randomness), so a map
// always looks the same, and drawn at art size: one art pixel covers TROOP_ART_SCALE world units.

import type { MapData, Rect } from '../../data/maps';
import { bayer, hash, smooth } from './noise';
import { BASE } from './palette';
import { CLEAR, type Palette, type Rows } from './pixels';
import { PROP_ART, type PropId } from './props';
import { TROOP_ART_SCALE } from './troops';

export interface GroundStyle {
  /** The soil's shades, darkest first: broad patches pick one, single pixels a neighbor. */
  soil: readonly number[];
  /** A forest's floor, darkest first. */
  forestFloor: readonly number[];
  /** Small scenery outside forests, and how many per 1,000 art pixels of free ground. */
  scenery: readonly { prop: PropId; per1000: number }[];
  /** Laid stones (ruins, fortress): the size of a tile in art pixels, and the color of the joints. */
  tiles?: { size: number; joint: number };
  /** Ground worn bare down the middle, where the armies meet: its shades and width in art pixels. */
  worn?: { shades: readonly number[]; width: number };
}

const DIRT = [0x5e4a2f, 0x6b5536, 0x79613e, 0x866c46];

const GRASS = [0x3d6a33, 0x447538, 0x4b7f3c, 0x548a42];
const FOREST_FLOOR = [0x23401f, 0x2a4a24, 0x30532a];

export const GROUND_STYLES: Readonly<Record<string, GroundStyle>> = {
  openField: {
    soil: GRASS,
    forestFloor: FOREST_FLOOR,
    scenery: [
      { prop: 'tuft', per1000: 1.6 },
      { prop: 'flower', per1000: 0.45 },
      { prop: 'rock', per1000: 0.06 },
    ],
    worn: { shades: DIRT, width: 26 },
  },
  deepForest: {
    soil: [0x335c2c, 0x3a6631, 0x417035, 0x497a3a],
    forestFloor: FOREST_FLOOR,
    scenery: [
      { prop: 'tuft', per1000: 1.6 },
      { prop: 'bush', per1000: 0.12 },
      { prop: 'flower', per1000: 0.35 },
    ],
    worn: { shades: DIRT, width: 20 },
  },
  voidRuins: {
    soil: [0x3a3547, 0x413b50, 0x48425a, 0x504a63],
    forestFloor: FOREST_FLOOR,
    scenery: [
      { prop: 'crystal', per1000: 0.12 },
      { prop: 'rock', per1000: 0.08 },
      { prop: 'tuft', per1000: 0.2 },
    ],
    tiles: { size: 12, joint: 0x2e2a3a },
  },
  redCanyon: {
    soil: [0x8a4f2e, 0x965834, 0xa1623b, 0xab6c43],
    forestFloor: FOREST_FLOOR,
    scenery: [
      { prop: 'canyonRock', per1000: 0.16 },
      { prop: 'rock', per1000: 0.05 },
    ],
    worn: { shades: [0x9c5b35, 0xab683f, 0xb8774b, 0xc48657], width: 30 },
  },
  ironFortress: {
    soil: [0x4b505c, 0x535965, 0x5b616e, 0x636a77],
    forestFloor: FOREST_FLOOR,
    scenery: [{ prop: 'rock', per1000: 0.12 }],
    tiles: { size: 10, joint: 0x3c414b },
  },
  glassPlains: {
    soil: [0x5f8277, 0x678b80, 0x6f9488, 0x789d91],
    forestFloor: FOREST_FLOOR,
    scenery: [
      { prop: 'shard', per1000: 0.14 },
      { prop: 'tuft', per1000: 0.3 },
    ],
  },
};

/** The ground picture: `w × h` art pixels, row by row, as 0xRRGGBB. */
export interface GroundImage {
  w: number;
  h: number;
  pixels: Uint32Array;
}

/** A rectangle of world units in art pixels. */
function toArt(r: Rect): Rect {
  return {
    x: Math.floor(r.x / TROOP_ART_SCALE),
    y: Math.floor(r.y / TROOP_ART_SCALE),
    w: Math.ceil(r.w / TROOP_ART_SCALE),
    h: Math.ceil(r.h / TROOP_ART_SCALE),
  };
}

function inside(x: number, y: number, r: Rect, margin = 0): boolean {
  return x >= r.x - margin && x < r.x + r.w + margin && y >= r.y - margin && y < r.y + r.h + margin;
}

function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
}

/** Where scenery stands: the prop and its top-left corner, in art pixels, drawn in this order. */
export interface Placed {
  prop: PropId;
  x: number;
  y: number;
}

/** Trees packed into each forest, back rows first, every tree wholly inside it. */
export function forestTrees(map: MapData): Placed[] {
  const trees: Placed[] = [];
  (map.forests ?? []).map(toArt).forEach((f, n) => {
    const step = 11;
    for (let row = 0, y = f.y - 3; y + 16 <= f.y + f.h + 1; row++, y += step - 2) {
      for (let x = f.x - 1; x + 16 <= f.x + f.w + 1; x += step) {
        const jx = (hash(x, y, n) % 5) - 2;
        const jy = (hash(y, x, n) % 3) - 1;
        // Every other row shifted by half a tree, so they don't stand in lines.
        const tx = Math.max(f.x - 1, Math.min(f.x + f.w - 15, x + jx + (row % 2) * 5));
        const ty = y + jy;
        trees.push({ prop: hash(tx, ty, 7) % 3 === 0 ? 'pine' : 'tree', x: tx, y: ty });
      }
    }
  });
  return trees.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Small scenery on free ground: never on a wall, in a forest or touching another piece. */
export function scatteredScenery(map: MapData, style: GroundStyle): Placed[] {
  const w = Math.ceil(map.width / TROOP_ART_SCALE);
  const h = Math.ceil(map.height / TROOP_ART_SCALE);
  const blocked = [...map.walls.map(toArt), ...(map.forests ?? []).map(toArt)];
  const placed: (Placed & Rect)[] = [];
  style.scenery.forEach(({ prop, per1000 }, kind) => {
    const sprite = PROP_ART[prop];
    const count = Math.round((w * h * per1000) / 1000);
    for (let i = 0; i < count * 3 && placed.filter((p) => p.prop === prop).length < count; i++) {
      const x = hash(i, kind, 11) % Math.max(1, w - sprite.w);
      const y = hash(kind, i, 13) % Math.max(1, h - sprite.h);
      const spot = { prop, x, y, w: sprite.w, h: sprite.h };
      if (blocked.some((b) => overlaps(spot, b, 3)) || placed.some((p) => overlaps(spot, p, 2))) continue;
      placed.push(spot);
    }
  });
  return placed.map(({ prop, x, y }) => ({ prop, x, y })).sort((a, b) => a.y - b.y || a.x - b.x);
}

function stamp(image: GroundImage, rows: Rows, palette: Palette, left: number, top: number): void {
  rows.forEach((row, j) => {
    const y = top + j;
    if (y < 0 || y >= image.h) return;
    for (let i = 0; i < row.length; i++) {
      const key = row[i]!;
      const x = left + i;
      if (key === CLEAR || x < 0 || x >= image.w) continue;
      const color = palette[key];
      if (color !== undefined) image.pixels[y * image.w + x] = color;
    }
  });
}

/** The map's ground, scenery and all, at art size. */
export function groundImage(map: MapData): GroundImage {
  const style = GROUND_STYLES[map.id] ?? GROUND_STYLES.openField!;
  const w = Math.ceil(map.width / TROOP_ART_SCALE);
  const h = Math.ceil(map.height / TROOP_ART_SCALE);
  const image: GroundImage = { w, h, pixels: new Uint32Array(w * h) };
  const forests = (map.forests ?? []).map(toArt);
  const middle = Math.floor(w / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inForest = forests.some((f) => inside(x, y, f));
      const shades = inForest ? style.forestFloor : style.soil;
      // Broad patches, then a fleck here and there one shade off.
      const patch = smooth(x, y, 14, 1) * 0.7 + smooth(x, y, 5, 2) * 0.3;
      let shade = Math.min(shades.length - 1, Math.floor(patch * shades.length));
      const fleck = hash(x, y, 3) % 23;
      if (fleck === 0) shade = Math.min(shades.length - 1, shade + 1);
      else if (fleck === 1) shade = Math.max(0, shade - 1);
      let color = shades[shade]!;
      // Worn bare down the middle: dirt with ragged edges, blending into the grass in specks.
      if (style.worn && !inForest) {
        const reach = style.worn.width / 2 + (smooth(x, y, 10, 4) - 0.5) * 14 + (smooth(x, y, 3, 5) - 0.5) * 4;
        const into = reach - Math.abs(x + 0.5 - w / 2);
        if (into > 2 || (into > 0 && hash(x, y, 6) % 3 !== 0)) {
          const dirt = style.worn.shades;
          color = dirt[Math.min(dirt.length - 1, Math.floor((smooth(x, y, 6, 7) * 0.7 + smooth(x, y, 2, 8) * 0.3) * dirt.length))]!;
        }
      }
      // Laid stones: joints along a grid, every other row of tiles shifted by half.
      if (style.tiles && !inForest) {
        const size = style.tiles.size;
        const row = Math.floor(y / size);
        const shifted = x + (row % 2) * Math.floor(size / 2);
        if (y % size === 0 || shifted % size === 0) color = style.tiles.joint;
      }
      // A worn line down the middle, in dashes: where the two halves meet.
      if (!inForest && (x === middle || x === middle - 1) && Math.floor(y / 4) % 2 === 0) color = shades[0]!;
      image.pixels[y * w + x] = color;
    }
  }
  for (const p of [...scatteredScenery(map, style), ...forestTrees(map)]) stamp(image, PROP_ART[p.prop].frames.still!, BASE, p.x, p.y);
  light(image, map.walls.map(toArt));
  return image;
}

/** How much the light changes the ground: warm sun from the top left, shade toward the edges and at the foot of walls. */
export const GROUND_LIGHT = { sun: 0.16, edge: 0.4, wall: 0.1, step: 0.05 } as const;

/**
 * Lights the ground (visual overhaul after 6C): brighter and warmer near the top left, darker
 * toward the edges, and darker in a ring at each wall's foot. Light comes in small steps blended
 * with a dither, so the picture keeps its pixel-art look; troops stay unlit, so they read.
 */
function light(image: GroundImage, walls: readonly Rect[]): void {
  const { w, h } = image;
  const sunX = w * 0.3;
  const sunY = -h * 0.25;
  const sunReach = w * 0.95;
  const half = Math.sqrt(w * w + h * h) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - sunX;
      const sy = y - sunY;
      const sun = Math.max(0, 1 - Math.sqrt(sx * sx + sy * sy) / sunReach) * GROUND_LIGHT.sun;
      const ex = x - w / 2;
      const ey = y - h * 0.45;
      const away = Math.min(1, Math.max(0, (Math.sqrt(ex * ex + ey * ey) / half - 0.45) / 0.6));
      let amount = sun - away * away * GROUND_LIGHT.edge;
      if (walls.some((r) => inside(x, y, r, 2) && !inside(x, y, r))) amount -= GROUND_LIGHT.wall;
      // Light in steps, dithered between them.
      const steps = amount / GROUND_LIGHT.step;
      const stepped = (Math.floor(steps) + (steps - Math.floor(steps) > bayer(x, y) ? 1 : 0)) * GROUND_LIGHT.step;
      if (stepped === 0) continue;
      const i = y * w + x;
      image.pixels[i] = tint(image.pixels[i]!, stepped);
    }
  }
}

/** A color brighter (and a little warmer) or darker by `amount`. */
function tint(rgb: number, amount: number): number {
  const warm = amount > 0 ? amount * 0.4 : 0;
  const r = Math.min(255, Math.max(0, Math.round(((rgb >> 16) & 0xff) * (1 + amount + warm))));
  const g = Math.min(255, Math.max(0, Math.round(((rgb >> 8) & 0xff) * (1 + amount + warm * 0.5))));
  const b = Math.min(255, Math.max(0, Math.round((rgb & 0xff) * (1 + amount))));
  return (r << 16) | (g << 8) | b || 0x010101;
}
