// The achievement icons for the stores (session 7A), drawn from the game's own pixel art: each
// achievement's emblem (a ruler's portrait, a run-map icon, rank chevrons) on a framed plate,
// 256×256. Earned icons are in color; the "not yet earned" ones are the same, in dim gray.
// `npm run art:achievements -- release/achievements` writes <ID>.png and <ID>_locked.png.

import type { Achievement } from '../../src/data/achievements';
import { CAPITAL_ICON, NODE_ICONS } from '../../src/game/art/icons';
import { BASE } from '../../src/game/art/palette';
import { pixelColors, type Palette, type Sprite } from '../../src/game/art/pixels';
import { PORTRAITS, portraitPalette } from '../../src/game/art/portraits';
import { Canvas } from './png';

/** The icon's size in pixels, and in art pixels (cells) across. */
export const ICON_SIZE = 256;
const CELLS = 32;
const CELL = ICON_SIZE / CELLS;

const PLATE = 0x2a2130;
const PLATE_DARK = 0x1c1622;
const GOLD = 0xd9a74a;
const GOLD_LIGHT = 0xf6c945;
const OUTLINE = 0x0e0b12;

/** A General's colors turned to gold, for the gold-trim Mastery icon. */
const GILDED: Palette = { ...portraitPalette('captain'), L: 0xfff1a0, A: 0xf6c945, a: 0xb5862c };

/** The picture at the middle of an achievement's icon: a sprite in its colors, or rank chevrons. */
type Emblem = { sprite: Sprite; palette: Palette } | { chevrons: number };

function emblemOf(achievement: Achievement): Emblem {
  const goal = achievement.goal;
  switch (goal.kind) {
    case 'rank':
      return { chevrons: goal.rank - 1 };
    case 'boss':
      return { sprite: PORTRAITS[goal.boss], palette: portraitPalette(goal.boss) };
    case 'allBosses':
      return { sprite: CAPITAL_ICON, palette: BASE };
    // Crossed swords for combos (the bright rim marks every one), a skull for the Finisher.
    case 'signatureCombos':
    case 'allSignatureCombos':
      return { sprite: NODE_ICONS.battle, palette: BASE };
    case 'codexEntry':
      return { sprite: NODE_ICONS.elite, palette: BASE };
    case 'allSynergies':
      return { sprite: NODE_ICONS.camp, palette: BASE };
    case 'fullCodex':
      return { sprite: NODE_ICONS.boss, palette: BASE };
    case 'masteryTitles':
      return { sprite: PORTRAITS.captain, palette: portraitPalette('captain') };
    case 'masteredGeneral':
    case 'allMastery':
      return { sprite: PORTRAITS.captain, palette: GILDED };
  }
}

/** Fills one art pixel. */
function cell(canvas: Canvas, x: number, y: number, color: number): void {
  canvas.fill(x * CELL, y * CELL, CELL, CELL, color);
}

/** The plate: a dark outline, a gold rim, then the plum face with a darker lower half. */
function drawPlate(canvas: Canvas, rim: number): void {
  canvas.fill(0, 0, ICON_SIZE, ICON_SIZE, OUTLINE);
  canvas.fill(CELL, CELL, ICON_SIZE - 2 * CELL, ICON_SIZE - 2 * CELL, rim);
  canvas.fill(2 * CELL, 2 * CELL, ICON_SIZE - 4 * CELL, ICON_SIZE - 4 * CELL, OUTLINE);
  canvas.fill(3 * CELL, 3 * CELL, ICON_SIZE - 6 * CELL, ICON_SIZE - 6 * CELL, PLATE);
  canvas.fill(3 * CELL, ICON_SIZE / 2, ICON_SIZE - 6 * CELL, ICON_SIZE / 2 - 3 * CELL, PLATE_DARK);
}

/** A sprite, each of its pixels one art pixel, centered on the plate (sprites are up to 16 across). */
function drawSprite(canvas: Canvas, sprite: Sprite, palette: Palette): void {
  const frame = Object.values(sprite.frames)[0]!;
  const scale = sprite.w <= 12 && sprite.h <= 12 ? 2 : 1;
  const left = Math.floor((CELLS - sprite.w * scale) / 2);
  const top = Math.floor((CELLS - sprite.h * scale) / 2);
  pixelColors(frame, palette).forEach((line, j) =>
    line.forEach((color, i) => {
      if (color === null) return;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) cell(canvas, left + i * scale + dx, top + j * scale + dy, color);
    }),
  );
}

/** Rank chevrons, one per rank above the first, stacked, gold on an outline. */
function drawChevrons(canvas: Canvas, count: number): void {
  const height = 4;
  const gap = 1;
  const total = count * height + (count - 1) * gap;
  let top = Math.floor((CELLS - total) / 2);
  for (let n = 0; n < count; n++) {
    // A "^" six cells tall at the tip's column, two cells thick.
    for (let k = 0; k < 9; k++) {
      const rise = Math.min(k, 8 - k);
      for (const [dy, color] of [
        [-1, OUTLINE],
        [0, GOLD_LIGHT],
        [1, GOLD],
        [2, OUTLINE],
      ] as const) {
        cell(canvas, 11 + k, top + (4 - Math.min(rise, 4)) + dy, color);
      }
    }
    top += height + gap;
  }
}

/** An achievement's icon: in color once earned, in dim gray before. */
export function achievementIcon(achievement: Achievement, earned: boolean): Canvas {
  const canvas = new Canvas(ICON_SIZE, ICON_SIZE, OUTLINE);
  const emblem = emblemOf(achievement);
  // The hardest ones (all of something) get a bright rim.
  const all = ['allBosses', 'allSignatureCombos', 'fullCodex', 'allMastery', 'allSynergies'].includes(achievement.goal.kind);
  drawPlate(canvas, all ? GOLD_LIGHT : GOLD);
  if ('chevrons' in emblem) drawChevrons(canvas, emblem.chevrons);
  else drawSprite(canvas, emblem.sprite, emblem.palette);
  if (!earned) toLocked(canvas);
  return canvas;
}

/** Gray and dim, for an achievement not yet earned. */
function toLocked(canvas: Canvas): void {
  const px = canvas.rgba;
  for (let i = 0; i < px.length; i += 4) {
    const gray = Math.round((0.3 * px[i]! + 0.59 * px[i + 1]! + 0.11 * px[i + 2]!) * 0.55);
    px[i] = gray;
    px[i + 1] = gray;
    px[i + 2] = gray;
  }
}
