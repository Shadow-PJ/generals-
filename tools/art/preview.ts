// Draws every sprite in the game onto one PNG sheet, each frame at 4× on the three ground colors
// it is seen on, and every map's ground onto a second one (walls in plain gray):
// `npm run art:preview -- out.png` writes out.png and out-maps.png. For checking art without
// starting the game.

import { writeFileSync } from 'node:fs';
import { MAPS } from '../../src/data/maps';
import { ART_SHEET } from '../../src/game/art';
import { groundImage } from '../../src/game/art/ground';
import { pixelColors } from '../../src/game/art/pixels';
import { TROOP_ART_SCALE } from '../../src/game/art/troops';
import { Canvas } from './png';

const ZOOM = 4;
const PAD = 8;
const SHEET_WIDTH = 1400;
const BACKGROUNDS = [0x3f6b35, 0x2a2f3a, 0x8a6a4a];

const out = process.argv[2] ?? 'art-preview.png';

// Lay the entries out in lines: each entry is its frames on each background, side by side.
interface Placed {
  x: number;
  y: number;
  entry: (typeof ART_SHEET)[number];
}
const placed: Placed[] = [];
let x = PAD;
let y = PAD;
let lineHeight = 0;
for (const entry of ART_SHEET) {
  const frames = Object.keys(entry.sprite.frames).length;
  const width = frames * BACKGROUNDS.length * (entry.sprite.w * ZOOM + PAD) + PAD * 2;
  if (x + width > SHEET_WIDTH && x > PAD) {
    x = PAD;
    y += lineHeight + PAD;
    lineHeight = 0;
  }
  placed.push({ x, y, entry });
  x += width;
  lineHeight = Math.max(lineHeight, entry.sprite.h * ZOOM);
}
const canvas = new Canvas(SHEET_WIDTH, y + lineHeight + PAD, 0x111111);

for (const { x: left, y: top, entry } of placed) {
  let at = left;
  for (const background of BACKGROUNDS) {
    for (const frame of Object.values(entry.sprite.frames)) {
      canvas.fill(at - 2, top - 2, entry.sprite.w * ZOOM + 4, entry.sprite.h * ZOOM + 4, background);
      pixelColors(frame, entry.palette).forEach((line, j) =>
        line.forEach((color, i) => {
          if (color !== null) canvas.fill(at + i * ZOOM, top + j * ZOOM, ZOOM, ZOOM, color);
        }),
      );
      at += entry.sprite.w * ZOOM + PAD;
    }
  }
}
writeFileSync(out, canvas.png());
console.log(`Wrote ${ART_SHEET.length} sprites to ${out} (${canvas.width}×${canvas.height})`);

// The maps, two to a line, at art size.
const maps = Object.values(MAPS).map((map) => ({ map, image: groundImage(map) }));
const mapW = maps[0]!.image.w;
const mapH = maps[0]!.image.h;
const sheet = new Canvas(PAD + 2 * (mapW + PAD), PAD + Math.ceil(maps.length / 2) * (mapH + PAD), 0x111111);
maps.forEach(({ map, image }, n) => {
  const left = PAD + (n % 2) * (mapW + PAD);
  const top = PAD + Math.floor(n / 2) * (mapH + PAD);
  for (let j = 0; j < image.h; j++) for (let i = 0; i < image.w; i++) sheet.fill(left + i, top + j, 1, 1, image.pixels[j * image.w + i]!);
  for (const wall of map.walls) {
    const s = TROOP_ART_SCALE;
    sheet.fill(left + Math.floor(wall.x / s), top + Math.floor(wall.y / s), Math.ceil(wall.w / s), Math.ceil(wall.h / s), wall.unbreakable ? 0x4b3a33 : 0x8c96a8);
  }
});
const mapsOut = out.replace(/\.png$/, '') + '-maps.png';
writeFileSync(mapsOut, sheet.png());
console.log(`Wrote ${maps.length} maps to ${mapsOut}`);
