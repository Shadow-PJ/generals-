// The world map on the Capital screen (visual overhaul after 6C): an island in a dark sea, the
// Capital's castle in its heartland of farms, and the five regions around it, each its own
// land: deep woods, violet ruins, red mesas, iron mountains and glass plains, joined to the
// Capital by dirt roads. Worked out from the places alone (no randomness), so it looks the same
// on every visit, at art size: one art pixel is UI_PIXEL (frames.ts) world units. Pure; the Capital screen
// makes it a texture and lays the markers, the castle and the fog of locked regions over it.

import type { RegionId } from '../../data/regions';
import type { PixelImage } from './frames';
import { bayer, hash, ramp, smooth } from './noise';
import { BASE, sidePalette } from './palette';
import { CLEAR, still, type Rows, type Sprite } from './pixels';

/** The Capital's castle, 32 × 32: three towers with blue roofs and a gold banner. */
export const CASTLE_ART: Sprite = still([
  '...............kgggk............',
  '...............kgGgg............',
  '...............kG...............',
  '...............kk...............',
  '..............kLAk..............',
  '.............kLLAak.............',
  '............kLLAAaak............',
  '...........kLLLAAAaak...........',
  '..........kaaaaaaaaaak..........',
  '.....kgg....kooOOOqk......kgg...',
  '.....kG.....kookkOqk......kG....',
  '.....k......kooyyOqk......k.....',
  '....kLk.....kooyyOqk.....kLk....',
  '...kLAak....kooOOOqk....kLAak...',
  '..kLLAAak.kkkooOOOqkkk.kLLAAak..',
  '.kLLLAAaakkkkkkkkkkkkkkLLLAAaak.',
  '.kkkkkkkkkooooooooooookkkkkkkkk.',
  '..kooOOqkkooOOOOOOOOOqkkooOOqk..',
  '..kooOOqkkokOOOOOOOOkqkkooOOqk..',
  '..kooOOqkkqyOOqOOOqOyqkkooOOqk..',
  '..kooeqqkkoyOOOOOOOOyqkkooeOqk..',
  '..kooeOqkkooOOOOOOOOOqkkooeOqk..',
  '..kooOOqkkooqOkkkkOOqqkkooOOqk..',
  '..koqOOqkkooOkWWWWkOOqkkqoOOqk..',
  '..kooOOqkkooOkWwWwkOOqkkooOOqk..',
  '..kooeOqkkqoOkWwWwkOOqkkooeOqk..',
  '..kooeqqkkooOkWwWwkOOqkkooeOqk..',
  '..kooOOqkkooOkWwgwkOOqkkooOOqk..',
  '..kooOOqkkooqkWwWwkOqqkkooOOqk..',
  '..koqOOqkkooOkWwWwkOOqkkqoOOqk..',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '...qqqqqqqqqqqqqqqqqqqqqqqqqq...',
]);

/** Over the region in focus: a gold arrow pointing down at it. */
export const MARKER_ARROW: Sprite = still(['kkkkkkkkk', 'kyggggggk', '.kygggGk.', '..kygGk..', '...kgk...', '....k....']);

/** Planted beside the region your run is in: your banner. */
export const RUN_BANNER: Sprite = still([
  'k.......',
  'kkkkkkkk',
  'kLLAAAak',
  'kLAgAAak',
  'kLAAAAak',
  'kLAAAAak',
  'kLAkkAak',
  'kAk..kAk',
  'kk....kk',
  'k.......',
  'k.......',
  'k.......',
  'kk......',
]);

/** On a locked region's marker: a padlock. */
export const LOCK_ICON: Sprite = still(['..kkk..', '.kOOOk.', '.kO.Ok.', 'kkkkkkk', 'kgggggk', 'kggkggk', 'kgGGGgk', 'kkkkkkk']);

/** On a cleared region's marker: a green tick. */
export const CLEARED_ICON: Sprite = still(['.....kk', '....kxk', 'kk.kxk.', 'kxkxk..', '.kxk...', '..k....']);

type Biome = 'woods' | 'ruins' | 'mesas' | 'mountains' | 'glass' | 'heartland';

/** Each region's land on the map. */
export const REGION_BIOMES: Readonly<Record<RegionId, Biome>> = {
  deepForest: 'woods',
  voidRuins: 'ruins',
  redCanyon: 'mesas',
  ironFortress: 'mountains',
  glassPlains: 'glass',
};

/** Small scenery for the map, a few pixels each, drawn in the base palette. */
const MINI: Readonly<Record<string, Rows>> = {
  tree: ['.ddd.', 'dlldd', 'dlldD', 'ddddD', '.DWD.', '..W..'],
  pine: ['..d..', '.dld.', '.dld.', 'dlldD', 'dlddD', 'DddDD', '..W..'],
  bush: ['.dd.', 'dldD', '.DD.'],
  mountain: [
    '.....x.....',
    '....xxo....',
    '...xooOO...',
    '..xoOOOqO..',
    '.ooOOOqqqq.',
    'oOOOOqqqqqq',
  ],
  hill: ['..ooO..', '.oOOOq.', 'oOOqqqq'],
  mesa: ['.zzzzzz..', 'zzfzzzzF.', 'FzzzzFFFF', 'FFFFFFFF.'],
  rock: ['.wW.', 'wwWW'],
  crystal: ['.r.', 'rRR', 'rRv', 'RvV', '.V.'],
  pillar: ['ooo', '.O.', '.O.', '.O.', 'qqq'],
  broken: ['.o.', '.O.', 'qOq'],
  shard: ['.u.', 'uuU', 'uUU', '.U.'],
  house: ['..zz..', '.zzzz.', 'zzzzzz', '.cCcC.', '.cWcC.'],
  sheaf: ['.g.', 'gGg', '.G.'],
};

/** Colors only the map uses, merged over the base palette for its scenery. */
const MAP_PALETTE = { ...BASE, z: 0xb5482b, f: 0xd8743f, F: 0x7c3420 };

interface BiomeLook {
  /** The ground, darkest first. */
  ground: readonly number[];
  /** Scenery, with how likely each spot gets one. */
  scenery: readonly { mini: keyof typeof MINI; chance: number }[];
  /** Spots this many art pixels apart. */
  spacing: number;
}

const BIOMES: Readonly<Record<Biome, BiomeLook>> = {
  woods: {
    ground: [0x1c3a20, 0x23472a, 0x2b5530, 0x356338],
    scenery: [
      { mini: 'tree', chance: 0.55 },
      { mini: 'pine', chance: 0.4 },
    ],
    spacing: 5,
  },
  ruins: {
    ground: [0x2b2336, 0x342a42, 0x3e3250, 0x4a3c5f],
    scenery: [
      { mini: 'crystal', chance: 0.18 },
      { mini: 'pillar', chance: 0.1 },
      { mini: 'broken', chance: 0.1 },
    ],
    spacing: 7,
  },
  mesas: {
    ground: [0x7a3a22, 0x8e4628, 0xa35532, 0xb4663d],
    scenery: [
      { mini: 'mesa', chance: 0.3 },
      { mini: 'rock', chance: 0.2 },
    ],
    spacing: 9,
  },
  mountains: {
    ground: [0x3d4350, 0x4a515f, 0x58606e, 0x67707e],
    scenery: [
      { mini: 'mountain', chance: 0.5 },
      { mini: 'hill', chance: 0.25 },
    ],
    spacing: 9,
  },
  glass: {
    ground: [0x2c5a58, 0x376b67, 0x447d78, 0x53908a],
    scenery: [
      { mini: 'shard', chance: 0.22 },
      { mini: 'bush', chance: 0.1 },
    ],
    spacing: 7,
  },
  heartland: {
    ground: [0x46682c, 0x527734, 0x5e863b, 0x6c9544],
    scenery: [
      { mini: 'house', chance: 0.12 },
      { mini: 'tree', chance: 0.12 },
      { mini: 'sheaf', chance: 0.12 },
    ],
    spacing: 8,
  },
};

const WATER = [0x0c2236, 0x102b42, 0x14364f, 0x1a435c, 0x22526a, 0x2c637a];
const FOAM = 0xa9d6df;
const SPARKLE = 0x7fbfd0;
const SAND = [0x9c7e4a, 0xb8995d, 0xcfb173];
const ROAD = 0x8f7045;
const ROAD_EDGE = 0x5e4630;
const FIELDS = [0x7d8f38, 0x9aa645];

/** A place on the map, in art pixels. */
export interface MapSite {
  x: number;
  y: number;
}

export interface WorldMapPlan {
  w: number;
  h: number;
  capital: MapSite;
  regions: readonly (MapSite & { region: RegionId })[];
}

/** How far each spot is from the island's middle, as a share of its edge (under 1 is land). */
function islandShare(plan: WorldMapPlan, x: number, y: number): number {
  // The island's middle is the middle of its regions, which may sit off the Capital.
  const xs = plan.regions.map((r) => r.x);
  const ys = plan.regions.map((r) => r.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dx = (x - cx) / (plan.w * 0.46);
  const dy = (y - cy) / (plan.h * 0.44);
  const coast = 1 + (smooth(x, y, 26, 1) - 0.5) * 0.26 + (smooth(x, y, 9, 2) - 0.5) * 0.1;
  let share = Math.sqrt(dx * dx + dy * dy) / coast;
  // Always firm ground around a region's marker.
  for (const site of plan.regions) {
    const sx = x - site.x;
    const sy = y - site.y;
    const near = 1 - Math.sqrt(sx * sx + sy * sy) / 24;
    if (near > 0) share -= near * 0.35;
  }
  return share;
}

/** True where the map is land (not sea). */
export function landAt(plan: WorldMapPlan, x: number, y: number): boolean {
  return islandShare(plan, x, y) < 1;
}

/** The land a spot belongs to: the heartland near the Capital, else the nearest region, with ragged borders. */
function biomeAt(plan: WorldMapPlan, x: number, y: number): Biome {
  const wobble = (smooth(x, y, 11, 7) - 0.5) * 18;
  const cdx = x - plan.capital.x;
  const cdy = y - plan.capital.y;
  if (Math.sqrt(cdx * cdx + cdy * cdy) + wobble < plan.w * 0.14) return 'heartland';
  let best = plan.regions[0]!;
  let bestDistance = Infinity;
  for (const site of plan.regions) {
    const dx = x - site.x + (smooth(x, y, 13, 8) - 0.5) * 22;
    const dy = y - site.y + (smooth(x, y, 13, 9) - 0.5) * 22;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = site;
    }
  }
  return REGION_BIOMES[best.region];
}

/** The ground's height for shading: lit from the top left. */
function height(x: number, y: number): number {
  return smooth(x, y, 12, 3) * 0.65 + smooth(x, y, 5, 4) * 0.35;
}

/** The roads: a slightly winding line of pixels from the Capital to each region. */
export function roadPixels(plan: WorldMapPlan): Set<number> {
  const road = new Set<number>();
  plan.regions.forEach((site, n) => {
    const dx = site.x - plan.capital.x;
    const dy = site.y - plan.capital.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(length * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Bends that fade out at both ends, so the road meets the castle and the region.
      const bend = (smooth(t * 30, n * 17, 7, 12) - 0.5) * 14 * t * (1 - t) * 4;
      const x = Math.round(plan.capital.x + dx * t - (dy / length) * bend);
      const y = Math.round(plan.capital.y + dy * t + (dx / length) * bend);
      if (x >= 0 && y >= 0 && x < plan.w && y < plan.h) road.add(y * plan.w + x);
    }
  });
  return road;
}

const opaque = (rgb: number) => (0xff000000 | rgb) >>> 0;

/** The whole map at art size. */
export function worldMapPixels(plan: WorldMapPlan): PixelImage {
  const { w, h } = plan;
  const pixels = new Uint32Array(w * h);
  const land = new Uint8Array(w * h);
  const share = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      share[y * w + x] = islandShare(plan, x, y);
      land[y * w + x] = share[y * w + x]! < 1 ? 1 : 0;
    }
  }
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && land[y * w + x] === 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = share[i]!;
      if (!land[i]) {
        // The sea: shallow and lighter near the shore, a line of foam on it, sparkles out deep.
        const nearLand = isLand(x - 1, y) || isLand(x + 1, y) || isLand(x, y - 1) || isLand(x, y + 1);
        if (nearLand && bayer(x, y) < 0.75) pixels[i] = opaque(FOAM);
        else if (s > 1.12 && hash(x, y, 21) % 389 === 0) pixels[i] = opaque(SPARKLE);
        else {
          const depth = Math.min(1, (s - 1) * 2.6);
          const edge = Math.max(Math.abs(x / w - 0.5), Math.abs(y / h - 0.5)) * 2;
          pixels[i] = opaque(ramp(WATER, 1 - depth * 0.8 - edge * edge * 0.35 + (smooth(x, y, 8, 22) - 0.5) * 0.18, x, y));
        }
        continue;
      }
      // A beach along the coast.
      if (s > 0.955) {
        pixels[i] = opaque(ramp(SAND, (1 - s) * 18 + (smooth(x, y, 4, 23) - 0.5) * 0.4, x, y));
        continue;
      }
      const biome = biomeAt(plan, x, y);
      const look = BIOMES[biome];
      const here = height(x, y);
      const relief = (here - height(x + 1, y + 1)) * 6;
      let value = 0.35 + (here - 0.5) * 0.9 + relief;
      // A little more light toward the top of the map.
      value += (0.5 - y / h) * 0.15;
      let color = ramp(look.ground, value, x, y);
      // Fields in the heartland: patches of striped crops.
      if (biome === 'heartland' && smooth(x, y, 9, 24) > 0.62) color = FIELDS[(y + (Math.floor(x / 6) % 2)) % 2]!;
      pixels[i] = opaque(color);
    }
  }
  // Roads, with a darker edge under them.
  const road = roadPixels(plan);
  for (const i of road) {
    const x = i % w;
    const y = Math.floor(i / w);
    if (!land[i]) continue;
    if (y + 1 < h && !road.has(i + w) && land[i + w]) pixels[i + w] = opaque(ROAD_EDGE);
    pixels[i] = opaque(ROAD);
    if (x + 1 < w && land[i + 1] && !road.has(i + 1)) pixels[i + 1] = opaque(ROAD);
  }
  // Scenery, kept off the roads and clear of the castle and the region markers.
  const placed: { mini: keyof typeof MINI; x: number; y: number }[] = [];
  const clear = [{ ...plan.capital, r: 26 }, ...plan.regions.map((s) => ({ ...s, r: 15 }))];
  for (const biome of Object.keys(BIOMES) as Biome[]) {
    const look = BIOMES[biome];
    const step = look.spacing;
    for (let gy = 0; gy < h; gy += step) {
      for (let gx = 0; gx < w; gx += step) {
        const x = gx + (hash(gx, gy, 31) % step);
        const y = gy + (hash(gy, gx, 32) % step);
        if (!isLand(x, y) || share[y * w + x]! > 0.9 || biomeAt(plan, x, y) !== biome) continue;
        if (clear.some((c) => (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y) < c.r * c.r)) continue;
        let roll = (hash(x, y, 33) % 1000) / 1000;
        const pick = look.scenery.find((s) => (roll -= s.chance) < 0);
        if (!pick) continue;
        const rows = MINI[pick.mini]!;
        const left = x - Math.floor(rows[0]!.length / 2);
        const top = y - rows.length + 1;
        if (touchesRoad(road, w, left, top, rows)) continue;
        placed.push({ mini: pick.mini, x: left, y: top });
      }
    }
  }
  placed.sort((a, b) => a.y + MINI[a.mini]!.length - (b.y + MINI[b.mini]!.length) || a.x - b.x);
  for (const p of placed) stamp(pixels, w, h, MINI[p.mini]!, p.x, p.y, land);
  return { w, h, pixels };
}

function touchesRoad(road: Set<number>, w: number, left: number, top: number, rows: Rows): boolean {
  for (let y = top - 1; y < top + rows.length + 1; y++) {
    for (let x = left - 1; x < left + rows[0]!.length + 1; x++) if (road.has(y * w + x)) return true;
  }
  return false;
}

/** Draws a small picture, with a one-pixel shadow under its right side, on land only. */
function stamp(pixels: Uint32Array, w: number, h: number, rows: Rows, left: number, top: number, land: Uint8Array): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const key = row[i]!;
      const x = left + i;
      const y = top + j;
      if (key === CLEAR || x < 0 || y < 0 || x >= w || y >= h || !land[y * w + x]) continue;
      const color = MAP_PALETTE[key as keyof typeof MAP_PALETTE];
      if (color !== undefined) pixels[y * w + x] = opaque(color);
    }
  });
  // A soft shadow along the base.
  const base = top + rows.length;
  if (base < h) {
    for (let i = 1; i < rows[0]!.length + 1; i++) {
      const x = left + i;
      if (x < w && land[base * w + x] && bayer(x, base) < 0.6) pixels[base * w + x] = darken(pixels[base * w + x]!);
    }
  }
}

function darken(argb: number): number {
  const r = Math.floor(((argb >>> 16) & 0xff) * 0.7);
  const g = Math.floor(((argb >>> 8) & 0xff) * 0.7);
  const b = Math.floor((argb & 0xff) * 0.7);
  return opaque((r << 16) | (g << 8) | b);
}

/**
 * A soft cloud of fog, `w × h` art pixels: puffs blended together, lit on top, see-through at
 * the edges. Laid over regions that are still locked.
 */
export function cloudPixels(w: number, h: number, salt: number): PixelImage {
  const pixels = new Uint32Array(w * h);
  const shades = [0x5a5068, 0x766a86, 0x9488a3, 0xb3a8c0];
  const puffs = [0.2, 0.42, 0.62, 0.8].map((px, i) => ({
    x: px * w,
    y: h * (0.55 + ((hash(i, salt, 41) % 100) / 100 - 0.5) * 0.25),
    r: h * (0.32 + ((hash(salt, i, 42) % 100) / 100) * 0.16),
  }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = 0;
      for (const p of puffs) {
        const dx = (x - p.x) / p.r;
        const dy = (y - p.y) / p.r;
        inside = Math.max(inside, 1 - Math.sqrt(dx * dx + dy * dy));
      }
      if (inside <= 0) continue;
      // Lighter toward the top, and thinner at the edges in a dither, so the land shows through.
      const value = 1 - y / h + inside * 0.4;
      const alpha = inside > 0.18 ? 0xe6 : bayer(x, y) < inside / 0.18 ? 0xb0 : 0;
      if (alpha === 0) continue;
      pixels[y * w + x] = ((alpha << 24) | ramp(shades, value, x, y)) >>> 0;
    }
  }
  return { w, h, pixels };
}

/** A round medallion for a region's marker: a dark disc in a ring, `size` art pixels across. */
export function medallionPixels(size: number, ring: { light: number; dark: number }, fill: number): PixelImage {
  const pixels = new Uint32Array(size * size);
  const c = (size - 1) / 2;
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r - 0.2) continue;
      let color: number;
      if (d > r - 1.2) color = 0x0e0b12;
      else if (d > r - 3.2) color = dy + dx < 0 ? ring.light : ring.dark;
      else if (d > r - 4.2) color = 0x0e0b12;
      else color = dy < -c * 0.35 ? lighten(fill) : fill;
      pixels[y * size + x] = opaque(color);
    }
  }
  return { w: size, h: size, pixels };
}

function lighten(rgb: number): number {
  const r = Math.min(255, Math.floor(((rgb >> 16) & 0xff) * 1.25 + 8));
  const g = Math.min(255, Math.floor(((rgb >> 8) & 0xff) * 1.25 + 8));
  const b = Math.min(255, Math.floor((rgb & 0xff) * 1.25 + 8));
  return (r << 16) | (g << 8) | b;
}

/**
 * A region's land, `w × h` art pixels, for the road of a run through it: its ground and some of
 * its scenery, darker toward the edges so the stops stand out.
 */
export function regionLandPixels(w: number, h: number, region: RegionId): PixelImage {
  const look = BIOMES[REGION_BIOMES[region]];
  const pixels = new Uint32Array(w * h);
  const land = new Uint8Array(w * h).fill(1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const here = height(x, y);
      const relief = (here - height(x + 1, y + 1)) * 6;
      const ex = Math.abs(x / w - 0.5) * 2;
      const ey = Math.abs(y / h - 0.5) * 2;
      const edge = Math.max(ex * ex, ey * ey);
      const value = 0.3 + (here - 0.5) * 0.8 + relief - edge * 0.45;
      pixels[y * w + x] = opaque(ramp(look.ground, value, x, y));
    }
  }
  const placed: { rows: Rows; x: number; y: number }[] = [];
  const step = look.spacing + 4;
  for (let gy = 0; gy < h; gy += step) {
    for (let gx = 0; gx < w; gx += step) {
      const x = gx + (hash(gx, gy, 51) % step);
      const y = gy + (hash(gy, gx, 52) % step);
      let roll = (hash(x, y, 53) % 1000) / 1000 / 0.32;
      const pick = look.scenery.find((s) => (roll -= s.chance) < 0);
      if (!pick) continue;
      const rows = MINI[pick.mini]!;
      placed.push({ rows, x: x - Math.floor(rows[0]!.length / 2), y: y - rows.length + 1 });
    }
  }
  placed.sort((a, b) => a.y + a.rows.length - (b.y + b.rows.length) || a.x - b.x);
  for (const p of placed) stamp(pixels, w, h, p.rows, p.x, p.y, land);
  // Darken the scenery near the edges too, with the ground.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.abs(x / w - 0.5) * 2;
      const ey = Math.abs(y / h - 0.5) * 2;
      if (Math.max(ex, ey) > 0.9 && bayer(x, y) < (Math.max(ex, ey) - 0.9) * 8) pixels[y * w + x] = darken(pixels[y * w + x]!);
    }
  }
  return { w, h, pixels };
}

/** The palette the castle is drawn in: your side's blue roofs. */
export const CASTLE_PALETTE = sidePalette('player');
