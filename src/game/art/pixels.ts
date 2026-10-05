// Pixel art as text (session 6B). Every sprite in the game is a grid of characters, one per
// pixel, each a key into a palette; '.' is clear. The same grid becomes a Phaser texture for the
// battle, paints straight onto a Graphics for small icons in the menus, and becomes a PNG in
// `npm run art:preview`, so there is one source for every picture and nothing to download.

/** Palette keys to colors (0xRRGGBB). '.' is never a key: it is always clear. */
export type Palette = Readonly<Record<string, number>>;

/** A picture: its rows, top first, all the same width. */
export type Rows = readonly string[];

/** A sprite with its frames (all the same size), by name. The first frame is the one shown still. */
export interface Sprite {
  readonly w: number;
  readonly h: number;
  readonly frames: Readonly<Record<string, Rows>>;
}

export const CLEAR = '.';

/** A frame made from another by swapping some of its rows: { 14: 'new row 14', ... }. */
export function patch(rows: Rows, changes: Readonly<Record<number, string>>): string[] {
  return rows.map((row, i) => changes[i] ?? row);
}

/** The frame mirrored left to right. */
export function mirror(rows: Rows): string[] {
  return rows.map((row) => [...row].reverse().join(''));
}

/** A sprite of one frame. */
export function still(rows: Rows): Sprite {
  return { w: rows[0]?.length ?? 0, h: rows.length, frames: { still: rows } };
}

/** A horizontal stretch of pixels of one color: the unit both painters draw with. */
export interface Run {
  x: number;
  y: number;
  w: number;
  color: number;
}

/** The frame as runs of one color, row by row, left to right. Keys missing from the palette are skipped. */
export function runs(rows: Rows, palette: Palette): Run[] {
  const out: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x]!;
      const color = key === CLEAR ? undefined : palette[key];
      let end = x + 1;
      while (end < row.length && row[end] === key) end++;
      if (color !== undefined) out.push({ x, y, w: end - x, color });
      x = end;
    }
  });
  return out;
}

/** What is wrong with a sprite: frames of the wrong size, or keys the palette doesn't have. Empty when it is fine. */
export function spriteProblems(name: string, sprite: Sprite, palette: Palette): string[] {
  const problems: string[] = [];
  for (const [frame, rows] of Object.entries(sprite.frames)) {
    if (rows.length !== sprite.h) problems.push(`${name}.${frame}: ${rows.length} rows, not ${sprite.h}`);
    rows.forEach((row, y) => {
      if (row.length !== sprite.w) problems.push(`${name}.${frame} row ${y}: ${row.length} wide, not ${sprite.w}`);
      for (const key of row) if (key !== CLEAR && palette[key] === undefined) problems.push(`${name}.${frame} row ${y}: no color for '${key}'`);
    });
  }
  return problems;
}

/** The frame's pixels as colors, row by row (null where clear): what the PNG preview writes. */
export function pixelColors(rows: Rows, palette: Palette): (number | null)[][] {
  return rows.map((row) => [...row].map((key) => (key === CLEAR ? null : (palette[key] ?? null))));
}
