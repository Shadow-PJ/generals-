// What lies behind every menu screen (visual overhaul after 6C): a dark cloth lit from above
// (src/game/art/frames.ts), with motes of dust drifting up through the light.

import type Phaser from 'phaser';
import { UI_PIXEL } from './art/frames';
import { backdropTexture, FX } from './art/textures';
import { GAME_HEIGHT, GAME_WIDTH } from './theme';

/** Below everything the screen draws. */
const BACKDROP_DEPTH = -1000;

export function addBackdrop(scene: Phaser.Scene): void {
  scene.add.image(0, 0, backdropTexture(scene, GAME_WIDTH, GAME_HEIGHT)).setOrigin(0).setScale(UI_PIXEL).setDepth(BACKDROP_DEPTH);
  scene.add
    .particles(0, 0, FX.dot, {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: 40, max: GAME_HEIGHT },
      lifespan: { min: 7000, max: 12000 },
      speedX: { min: -4, max: 4 },
      speedY: { min: -12, max: -4 },
      scale: { min: 0.5, max: 1 },
      alpha: { values: [0, 0.35, 0.25, 0], interpolation: 'linear' },
      tint: [0xf3d27a, 0xd9a74a, 0xfff0b8],
      frequency: 450,
      quantity: 1,
      advance: 8000,
    })
    .setDepth(BACKDROP_DEPTH + 1);
}
