// Paints pixel art straight onto a Graphics, one rectangle per run of pixels: for the small
// troop icons on the menus, which are drawn into the same Graphics as their rings and bars.

import type Phaser from 'phaser';
import { runs, type Palette, type Rows, type Run } from './pixels';

const cache = new WeakMap<Rows, WeakMap<Palette, Run[]>>();

function cachedRuns(rows: Rows, palette: Palette): Run[] {
  let byPalette = cache.get(rows);
  if (!byPalette) cache.set(rows, (byPalette = new WeakMap()));
  let found = byPalette.get(palette);
  if (!found) byPalette.set(palette, (found = runs(rows, palette)));
  return found;
}

export interface PaintStyle {
  /** World units per art pixel. */
  scale: number;
  /** Mirrored left to right. */
  flipX?: boolean;
  alpha?: number;
}

/** Paints the frame centered on (x, y). */
export function paintCentered(g: Phaser.GameObjects.Graphics, rows: Rows, palette: Palette, x: number, y: number, style: PaintStyle): void {
  const w = rows[0]?.length ?? 0;
  const h = rows.length;
  const s = style.scale;
  const left = x - (w * s) / 2;
  const top = y - (h * s) / 2;
  const alpha = style.alpha ?? 1;
  for (const run of cachedRuns(rows, palette)) {
    const rx = style.flipX ? w - run.x - run.w : run.x;
    g.fillStyle(run.color, alpha).fillRect(left + rx * s, top + run.y * s, run.w * s, s);
  }
}
