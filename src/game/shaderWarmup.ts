// Shaders made ready before play (session 7H). Phaser builds the shader for a batch of sprites to
// fit the number of textures the batch draws, the first time each number comes up. In a battle
// that happened mid-fight, as damage numbers brought new textures into the batch, and each new
// shader stalled a frame (about 80 ms with software drawing). The Boot screen draws one batch of
// every size, a frame each, out of sight, so every shader is built before the title appears.

import Phaser from 'phaser';

const KEY = 'shader-warmup';

/** Draws a batch of each texture count once, then calls `done`. */
export function warmShaders(scene: Phaser.Scene, done: () => void): void {
  const renderer = scene.game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
    done();
    return;
  }
  const max = renderer.maxTextures;
  // A tiny texture for each texture unit, so a batch of n images draws n textures.
  const keys = Array.from({ length: max }, (_, i) => {
    const key = `${KEY}-${i}`;
    if (!scene.textures.exists(key)) scene.textures.createCanvas(key, 2, 2)?.refresh();
    return key;
  });
  const images: Phaser.GameObjects.Image[] = [];
  let count = 1;
  const step = () => {
    for (const image of images) image.destroy();
    images.length = 0;
    if (count > max) {
      for (const key of keys) scene.textures.remove(key);
      done();
      return;
    }
    // Nearly see-through (a fully clear image isn't drawn at all), in the corner.
    for (let i = 0; i < count; i++) images.push(scene.add.image(1, 1, keys[i]!).setAlpha(0.01));
    count++;
    scene.game.events.once(Phaser.Core.Events.POST_RENDER, step);
  };
  step();
}
