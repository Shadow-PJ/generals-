// Walls on the battlefield as pixel-art blocks (visual overhaul after 6C): a lit top face over
// the wall's whole footprint, with its front face in shade along the bottom, so a wall reads as
// standing up off the ground without covering any ground it doesn't block. Brick for most maps,
// raw rock in the canyon, riveted iron in the fortress, and stakes for a wall raised by Fortify.
// Pure: the battle makes a texture for each wall's size and kind.

import type { PixelImage } from './frames';
import { bayer, hash } from './noise';

export type WallKind = 'brick' | 'rock' | 'iron' | 'palisade';

interface WallLook {
  /** The top face: joints, then shades from dark to light. */
  top: readonly number[];
  joint: number;
  /** The front face in shade. */
  front: readonly number[];
  frontJoint: number;
  /** The lit edge along the top. */
  edge: number;
}

const INK = 0x0e0b12;

const LOOKS: Readonly<Record<WallKind, WallLook>> = {
  brick: { top: [0x7d8596, 0x8f98a9, 0xa1aabb], joint: 0x5a6172, front: [0x4d5465, 0x5a6273], frontJoint: 0x363c4a, edge: 0xc8cfdb },
  rock: { top: [0x7a4a33, 0x8d5a3e, 0x9f6a49], joint: 0x5e3624, front: [0x4a2a1c, 0x583425], frontJoint: 0x341d13, edge: 0xc28a62 },
  iron: { top: [0x4a515e, 0x575f6d, 0x646d7c], joint: 0x30353f, front: [0x2b3039, 0x343a45], frontJoint: 0x1f232a, edge: 0x8e98a8 },
  palisade: { top: [0x8a5f34, 0x9c6d3d, 0xae7c47], joint: 0x5c3d20, front: [0x553719, 0x63421f], frontJoint: 0x3d2711, edge: 0xd29b5e },
};

/** How many art pixels tall the front face is: the wall's height, seen from above at a slant. */
export const WALL_FRONT = 4;

const opaque = (rgb: number) => (0xff000000 | rgb) >>> 0;

/** A wall `w × h` art pixels big, of a kind. */
export function wallPixels(w: number, h: number, kind: WallKind): PixelImage {
  const look = LOOKS[kind];
  const pixels = new Uint32Array(w * h);
  const front = Math.min(WALL_FRONT, Math.max(2, Math.floor(h / 3)));
  const faceTop = h - 1 - front;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edgeX = x === 0 || x === w - 1;
      const edgeY = y === 0 || y === h - 1;
      if (edgeX && edgeY) continue;
      let color: number;
      if (edgeX || edgeY || y === faceTop) color = INK;
      else if (y > faceTop) color = frontColor(look, kind, x, y - faceTop - 1, front);
      else if (y === 1) color = look.edge;
      else color = topColor(look, kind, x, y, faceTop);
      pixels[y * w + x] = opaque(color);
    }
  }
  return { w, h, pixels };
}

function topColor(look: WallLook, kind: WallKind, x: number, y: number, faceTop: number): number {
  switch (kind) {
    case 'brick': {
      // Courses of bricks, every other one shifted by half, each brick a shade of its own.
      const course = Math.floor((y - 2) / 4);
      if ((y - 2) % 4 === 3) return look.joint;
      const shifted = x + (course % 2) * 4;
      if (shifted % 8 === 0) return look.joint;
      const brick = hash(Math.floor(shifted / 8), course, 61) % 3;
      // Light from the top: the lowest row of each brick a shade darker.
      return look.top[(y - 2) % 4 === 2 ? Math.max(0, brick - 1) : brick]!;
    }
    case 'rock': {
      // Layers of rock, broken here and there, with pale flecks.
      const layer = Math.floor((y + (hash(Math.floor(x / 9), 0, 62) % 3)) / 5);
      if ((y + (hash(Math.floor(x / 9), 0, 62) % 3)) % 5 === 0 && hash(x, layer, 63) % 4 !== 0) return look.joint;
      if (hash(x, y, 64) % 41 === 0) return look.edge;
      return look.top[(layer + (y > faceTop - 3 ? 0 : 1)) % look.top.length]!;
    }
    case 'iron': {
      // Plates with a rivet at each corner.
      const px = x % 12;
      const py = (y - 2) % 12;
      if (px === 0 || py === 11) return look.joint;
      if ((px === 2 || px === 10) && (py === 1 || py === 9)) return look.edge;
      return look.top[py < 2 ? 2 : bayer(x, y) < 0.3 ? 0 : 1]!;
    }
    case 'palisade': {
      // Stakes side by side, lit on their left.
      const stake = x % 4;
      if (stake === 0) return look.joint;
      return look.top[stake === 1 ? 2 : stake === 2 ? 1 : 0]!;
    }
  }
}

function frontColor(look: WallLook, kind: WallKind, x: number, row: number, rows: number): number {
  const joints = kind === 'brick' ? (x + (row % 2) * 4) % 8 === 0 : kind === 'iron' ? x % 12 === 0 : kind === 'palisade' ? x % 4 === 0 : hash(x, row, 65) % 7 === 0;
  if (joints) return look.frontJoint;
  return look.front[row < rows / 2 ? 1 : 0]!;
}
