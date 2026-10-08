// The pictures at the top of a run's stops (session 7E): a small scene of the place, in the
// colors of the region the run is in. The spoils of a won fight are a chest by your banner (at a
// crossroads, session 7F, a signpost stands between them, under a dusk of its own); a beaten
// commander's orders, its red standard and a sealed scroll; an event, a signpost at twilight; the
// merchant, a striped stall; a rest camp, tents round a fire under the stars; and the run's end,
// your banner at dawn, or the enemy's over your fallen one in a storm. Worked out in code, the
// same every time, at art size (one art pixel is UI_PIXEL world units); the stop screen writes
// its title over the sky.

import type { RegionId } from '../../data/regions';
import type { UnitClass } from '../../data/units';
import type { PixelImage } from './frames';
import { bayer, hash, ramp, smooth } from './noise';
import { BASE, sidePalette } from './palette';
import { CLEAR, mirror, still, type Palette, type Rows, type Sprite } from './pixels';
import { PROP_ART, type PropId } from './props';
import { TROOP_ART } from './troops';
import { REGION_BIOMES, regionGround } from './worldMap';

export type StopScene = 'spoils' | 'crossroads' | 'decree' | 'event' | 'merchant' | 'camp' | 'won' | 'lost';
export const STOP_SCENES: readonly StopScene[] = ['spoils', 'crossroads', 'decree', 'event', 'merchant', 'camp', 'won', 'lost'];

/** A canvas tent, its door open: lit on the left, shaded on the right. */
export const TENT_ART: Sprite = still([
  '..........kk..........',
  '.........kcCk.........',
  '........kccCCk........',
  '.......kcccCCCk.......',
  '......kccckCCCCk......',
  '.....kcccckeCCCCk.....',
  '....kcccckeeeCCCCk....',
  '...kcccckeeeeeCCCCk...',
  '..kcccckeeeeeeeCCCCk..',
  '.kcccccWeeeeeeeWCCCCk.',
  'kkkkkkkkkkkkkkkkkkkkkk',
]);

/** A campfire: logs, a ring of stones, and the flames. */
export const CAMPFIRE_ART: Sprite = still([
  '.....f......',
  '....fF..f...',
  '...fFf.fF...',
  '...fFyffF...',
  '..fFyyyFf...',
  '..FfyyyyfF..',
  '.oWwFfFFwWo.',
  'oWwwWkkWwwWo',
  '.ooOoOOoOoo.',
]);

/** An open chest of gold. */
export const CHEST_ART: Sprite = still([
  '..kkkkkkkkkk..',
  '.kWwwwwwwwwWk.',
  '.kWkkkkkkkkWk.',
  'kgygyggygygyGk',
  'kGgGgGygGgGgGk',
  'kWwwwwgGwwwwWk',
  'kWwwwwGGwwwwWk',
  'kWwwwwwwwwwwWk',
  'kkkkkkkkkkkkkk',
]);

/** A standard on a tall pole, in the side's colors (blue yours, red the enemy's). */
export const STANDARD_ART: Sprite = still([
  '.g.........',
  'kgk........',
  'kWkkkkkkkk.',
  'kWkLLAAAak.',
  'kWkLAgAAak.',
  'kWkLggAAak.',
  'kWkLAgAAak.',
  'kWkLAAAAak.',
  'kWkLAAAAak.',
  'kWkLAAkAak.',
  'kWkAAk.kAk.',
  'kWkAk...kk.',
  'kWkk.......',
  'kWk........',
  'kWk........',
  'kWk........',
  'kWk........',
  'kWk........',
  'kWk........',
  'kWk........',
  'kWk........',
  'kWk........',
  'kkkk.......',
]);

/** Your standard fallen on its side, at a lost run's end. */
export const FALLEN_STANDARD_ART: Sprite = still([
  '..............kkkkkkk.',
  '.............kLLAAAak.',
  'kkkkkkkkkkkkkkLAgAAak.',
  'gWWWWWWWWWWWWkLAAAAak.',
  'kkkkkkkkkkkkkkkAAkAkk.',
]);

/** A sealed scroll of orders. */
export const SCROLL_ART: Sprite = still([
  '.kkkkkkkkk.',
  'kPppppppPPk',
  'kkppppppPkk',
  '.kpPPPppPk.',
  '.kppppzzPk.',
  '.kpPPPzzPk.',
  'kkppppppPkk',
  'kPppppppPPk',
  '.kkkkkkkkk.',
]);

/** A signpost at a crossroads, its two boards pointing two ways, a lantern hung from it. */
export const SIGNPOST_ART: Sprite = still([
  '.......kk.......',
  '.......kWk......',
  'kkkkkkkkWkkkkk..',
  'kwwwwwwwwwwwwwk.',
  'kWWWWWWkWWWWWk..',
  '.kkkkkkkWkkkkk..',
  '..kkkkkkWkkkkkkk',
  '.kwwwwwwwwwwwwwk',
  '..kWWWWWkWWWWWWk',
  '..kkkkkkWkkkkkkk',
  '.......kWk..k...',
  '.......kWk.kgk..',
  '.......kWk.kyk..',
  '.......kWk..k...',
  '.......kWk......',
  '.......kWk......',
  '......kkWkk.....',
  '.....kWWwWWk....',
]);

/** The merchant's stall: a striped awning on two posts over a counter of wares. */
export const STALL_ART: Sprite = still([
  '..kkkkkkkkkkkkkkkkkkkkkk..',
  '.kzzzcccczzzzcccczzzzcccck',
  'kzzzzcccczzzzcccczzzzccccC',
  'kkzzkkcckkzzkkcckkzzkkcckk',
  '.kk..kk..kk..kk..kk..kk.k.',
  '..kW.................kW...',
  '..kW..kgk..kuk..kllk.kW...',
  '..kW.kgGgk.kUk.kldlk.kW...',
  '.kkkkkkkkkkkkkkkkkkkkkkk..',
  '.kwwwwwwwwwwwwwwwwwwwwwk..',
  '.kWWWWWWWWWWWWWWWWWWWWWk..',
  '.kWwwwwwwwwwwwwwwwwwwwWk..',
  '.kWwwwwwwwwwwwwwwwwwwwWk..',
  '.kkkkkkkkkkkkkkkkkkkkkkk..',
]);

/** A wooden crate. */
export const CRATE_ART: Sprite = still([
  'kkkkkkkkkk',
  'kwwwwwwwWk',
  'kwWkkkkWWk',
  'kwkWwwWkWk',
  'kwkwWWwkWk',
  'kwkWwwWkWk',
  'kwWkkkkWWk',
  'kWWWWWWWWk',
  'kkkkkkkkkk',
]);

/** A barrel. */
export const BARREL_ART: Sprite = still([
  '.kkkkkk.',
  'kWwwwwWk',
  'kMMMMMMk',
  'kwwwwwWk',
  'kwwwwwWk',
  'kMMMMMMk',
  'kwwwwwWk',
  '.kkkkkk.',
]);

/** Every sprite the stop pictures use, by name, with the palette it is drawn in: for the tests and the art preview. */
export const STOP_ART: readonly { name: string; sprite: Sprite; palette: Palette }[] = [
  { name: 'tent', sprite: TENT_ART, palette: BASE },
  { name: 'campfire', sprite: CAMPFIRE_ART, palette: BASE },
  { name: 'chest', sprite: CHEST_ART, palette: BASE },
  { name: 'standard (you)', sprite: STANDARD_ART, palette: sidePalette('player') },
  { name: 'standard (enemy)', sprite: STANDARD_ART, palette: sidePalette('enemy') },
  { name: 'fallen standard', sprite: FALLEN_STANDARD_ART, palette: sidePalette('player') },
  { name: 'scroll', sprite: SCROLL_ART, palette: BASE },
  { name: 'signpost', sprite: SIGNPOST_ART, palette: BASE },
  { name: 'stall', sprite: STALL_ART, palette: BASE },
  { name: 'crate', sprite: CRATE_ART, palette: BASE },
  { name: 'barrel', sprite: BARREL_ART, palette: BASE },
];

interface SkyLook {
  /** The sky, top first. */
  shades: readonly number[];
  stars: boolean;
  /** How lit the land is, 0 (night) to 1 (day). */
  light: number;
}

const SKIES: Readonly<Record<StopScene, SkyLook>> = {
  spoils: { shades: [0x2a1b45, 0x5c2a55, 0xa4434a, 0xe57f45, 0xf3a457, 0xfcc874], stars: false, light: 0.8 },
  crossroads: { shades: [0x1c2340, 0x3a3560, 0x6e4a6e, 0xb06a5e, 0xe39a62, 0xf6c98a], stars: false, light: 0.75 },
  won: { shades: [0x3e2150, 0x7f3452, 0xc85a42, 0xf3a457, 0xfcc874, 0xffe39a], stars: false, light: 1 },
  decree: { shades: [0x1a0f14, 0x2e1418, 0x4f1c1c, 0x7a2a22, 0xa3402a], stars: false, light: 0.6 },
  event: { shades: [0x0d0a1c, 0x1d1536, 0x2a1b45, 0x3e2150, 0x5c2a55], stars: true, light: 0.45 },
  merchant: { shades: [0x2d4a7a, 0x3f6496, 0x5a82b0, 0x86a9c9, 0xc6cfc0, 0xe8d6a8], stars: false, light: 1 },
  camp: { shades: [0x05060f, 0x0b0e1f, 0x121833, 0x1b2447, 0x26315a], stars: true, light: 0.3 },
  lost: { shades: [0x111217, 0x1a1c24, 0x252833, 0x323644, 0x434857], stars: false, light: 0.35 },
};

const STAR = [0x8a7aa0, 0xd8c8e8, 0xfff4d6];
/** How far apart, in art pixels down the land, the rows of scenery stand. */
const ROW_DEPTH = 14;

/** The region's scenery along the sides of the picture, and how many art pixels apart it stands in the back row. */
const SCENERY: Readonly<Record<ReturnType<typeof biomeOf>, { props: readonly PropId[]; spacing: number }>> = {
  woods: { props: ['tree', 'pine', 'pine', 'tree', 'bush'], spacing: 10 },
  ruins: { props: ['crystal', 'shard', 'rock'], spacing: 22 },
  mesas: { props: ['canyonRock', 'rock', 'canyonRock'], spacing: 24 },
  mountains: { props: ['rock', 'pine', 'rock'], spacing: 18 },
  glass: { props: ['shard', 'crystal', 'bush'], spacing: 18 },
  heartland: { props: ['tree', 'bush'], spacing: 16 },
};

function biomeOf(region: RegionId) {
  return REGION_BIOMES[region];
}

const opaque = (rgb: number) => (0xff000000 | rgb) >>> 0;

/** A color times `by` (below 1 darker), channel by channel. */
function shade(rgb: number, by: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * by)));
  return (c((rgb >> 16) & 0xff) << 16) | (c((rgb >> 8) & 0xff) << 8) | c(rgb & 0xff);
}

/** The palette dimmed for a dark sky, so the scenery sits in the night. */
function dimmed(palette: Palette, light: number): Palette {
  if (light >= 0.8) return palette;
  const by = 0.45 + light * 0.6;
  return Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, shade(v, by)]));
}

/** Something stood on the ground: its picture, its middle and the row its feet are on. */
interface Placed {
  rows: Rows;
  palette: Palette;
  x: number;
  base: number;
}

/** What stands in the middle of each scene, and who of your army is there, around x = cx, feet on row `base`. */
function setPiece(scene: StopScene, cx: number, base: number, light: number): Placed[] {
  const lit = (p: Palette) => dimmed(p, Math.max(light, 0.55));
  const you = lit(sidePalette('player'));
  const them = lit(sidePalette('enemy'));
  const things = lit(BASE);
  const troop = (cls: UnitClass, x: number, facingLeft = false, b = base): Placed => {
    const rows = TROOP_ART[cls].frames.stand!;
    return { rows: facingLeft ? mirror(rows) : rows, palette: you, x, base: b };
  };
  const at = (sprite: Sprite, x: number, palette = things, b = base): Placed => ({ rows: sprite.frames.still!, palette, x, base: b });
  switch (scene) {
    case 'spoils':
      return [at(STANDARD_ART, cx + 16, you, base - 2), at(CHEST_ART, cx - 6), troop('vanguard', cx - 36), troop('ranger', cx - 54, false, base - 3), troop('guardian', cx + 40, true)];
    case 'crossroads':
      // Two roads from a won field: a signpost between your spoils and the road on.
      return [at(SIGNPOST_ART, cx), at(CHEST_ART, cx - 26), at(STANDARD_ART, cx + 26, you, base - 2), troop('vanguard', cx - 50), troop('ranger', cx + 48, true)];
    case 'decree':
      return [at(STANDARD_ART, cx + 4, them, base - 3), at(SCROLL_ART, cx - 14), troop('vanguard', cx - 42), troop('guardian', cx + 36, true)];
    case 'event':
      return [at(SIGNPOST_ART, cx), troop('ranger', cx - 30), troop('vanguard', cx - 46, false, base - 2)];
    case 'merchant':
      return [at(STALL_ART, cx), at(BARREL_ART, cx - 24), at(CRATE_ART, cx + 22), troop('guardian', cx - 46)];
    case 'camp':
      return [
        at(TENT_ART, cx - 42, things, base - 4),
        { rows: mirror(TENT_ART.frames.still!), palette: things, x: cx + 44, base: base - 4 },
        at(CAMPFIRE_ART, cx, BASE),
        troop('ranger', cx - 18),
        troop('vanguard', cx + 18, true),
      ];
    case 'won':
      return [at(STANDARD_ART, cx, you, base - 3), troop('vanguard', cx - 22), troop('ranger', cx - 40, false, base - 2), troop('guardian', cx + 22, true), troop('vanguard', cx + 40, true, base - 2)];
    case 'lost':
      return [at(STANDARD_ART, cx + 10, them, base - 3), at(FALLEN_STANDARD_ART, cx - 20, you)];
  }
}

/** Draws a picture with its feet on row `base`, centered on x, with a dithered shadow under it. */
function stand(pixels: Uint32Array, w: number, h: number, thing: Placed): void {
  const width = thing.rows[0]!.length;
  const left = Math.round(thing.x - width / 2);
  const top = thing.base - thing.rows.length + 1;
  for (let i = 1; i < width - 1; i++) {
    const x = left + i;
    const y = thing.base + 1;
    if (x >= 0 && x < w && y < h && bayer(x, y) < 0.7) pixels[y * w + x] = opaque(shade(pixels[y * w + x]! & 0xffffff, 0.6));
  }
  thing.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const key = row[i]!;
      const x = left + i;
      const y = top + j;
      if (key === CLEAR || x < 0 || y < 0 || x >= w || y >= h) continue;
      const color = thing.palette[key];
      if (color !== undefined) pixels[y * w + x] = opaque(color);
    }
  });
}

/** The picture for a stop, `w × h` art pixels. */
export function stopScenePixels(scene: StopScene, region: RegionId, w: number, h: number): PixelImage {
  const sky = SKIES[scene];
  const ground = regionGround(region);
  const horizon = Math.round(h * 0.62);
  const cx = Math.round(w / 2);
  const pixels = new Uint32Array(w * h);
  // A far ridge against the sky, in the region's darkest ground, darker still at night.
  const ridgeColor = shade(ground[0]!, 0.55 + sky.light * 0.25);
  const ridge = Array.from({ length: w }, (_, x) => horizon - 2 - Math.round(smooth(x, 0, 26, 91) * h * 0.16 + smooth(x, 0, 7, 92) * 3));
  const fire = scene === 'camp' ? { x: cx, y: horizon + Math.round((h - horizon) * 0.6) } : null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let color: number;
      if (y >= horizon) {
        // The land: the region's ground, lit by the sky, brighter round the camp's fire.
        const depth = (y - horizon) / (h - horizon);
        let value = 0.25 + sky.light * 0.55 + (smooth(x, y, 6, 93) - 0.5) * 0.35 - depth * 0.15;
        if (fire) {
          const dx = (x - fire.x) / 2.2;
          const dy = y - fire.y;
          value += Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 26) * 0.7;
        }
        color = ramp(ground, value, x, y);
        if (y === horizon) color = shade(color, 0.8);
      } else if (y >= ridge[x]!) {
        color = y === ridge[x] ? shade(ridgeColor, 1.25) : ridgeColor;
      } else {
        color = ramp(sky.shades, y / horizon, x, y);
        const roll = hash(x, y, 94) % 300;
        if (sky.stars && y < horizon * 0.7 && roll < 3) color = STAR[roll]!;
      }
      pixels[y * w + x] = opaque(color);
    }
  }
  // The region's scenery along the sides: a back row along the horizon, a few nearer things
  // lower down, the middle left clear for the scene.
  const { props, spacing } = SCENERY[biomeOf(region)];
  const palette = dimmed(BASE, sky.light);
  const things: Placed[] = [];
  const clear = Math.round(w * 0.16);
  const scenery = (x: number, base: number, salt: number) => {
    if (Math.abs(x - cx) < clear || x < 4 || x > w - 4) return;
    things.push({ rows: PROP_ART[props[hash(x, base, salt) % props.length]!].frames.still!, palette, x, base });
  };
  // A row every ROW_DEPTH art pixels down the land, each further forward sparser than the last.
  const rows = Math.max(2, Math.floor((h - 4 - horizon) / ROW_DEPTH));
  for (let r = 0; r < rows; r++) {
    const step = Math.round(spacing * (1 + r * 1.5));
    for (let x = 4 + r * 7, i = 0; x < w; x += step, i++) {
      if (r > 0 && hash(i, r, 98) % 3 === 0) continue;
      const base = Math.min(h - 3, horizon + 2 + r * ROW_DEPTH + (hash(i, r, 99) % 4));
      scenery(x + (hash(i, r, 95) % 5) - 2, base, 96 + r);
    }
  }
  const base = h - 4;
  things.push(...setPiece(scene, cx, base, sky.light));
  things.sort((a, b) => a.base - b.base);
  for (const thing of things) stand(pixels, w, h, thing);
  // Shade the top, so the title's words read on the sky.
  for (let y = 0; y < Math.floor(h * 0.18); y++) {
    const share = 1 - y / (h * 0.18);
    for (let x = 0; x < w; x++) if (bayer(x, y) < share * 0.5) pixels[y * w + x] = opaque(shade(pixels[y * w + x]! & 0xffffff, 0.7));
  }
  return { w, h, pixels };
}
