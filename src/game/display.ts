// Resolution scaling. The game is laid out on a 960×704 world, and every scene's camera zooms
// that world onto a canvas drawn at a multiple of it. A bigger multiple keeps shapes and text
// sharp in a big window or in fullscreen; the canvas is then fitted to the window either way.

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './theme';

export { renderScale } from './renderScale';

let current = 1;

export function currentRenderScale(): number {
  return current;
}

/** The game's starting render scale, before Phaser starts. */
export function setInitialRenderScale(scale: number): void {
  current = scale;
}

/** Makes the scene's camera show the 960×704 world at the render scale. Every scene calls it first in create(). */
export function fitCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setOrigin(0, 0).setZoom(current);
}

/** Changes the render scale while the game runs, redrawing every scene's text at the new size. */
export function setRenderScale(game: Phaser.Game, scale: number): void {
  if (scale === current) return;
  current = scale;
  game.scale.setGameSize(GAME_WIDTH * scale, GAME_HEIGHT * scale);
  for (const scene of game.scene.getScenes(false)) {
    if (!scene.cameras?.main) continue;
    fitCamera(scene);
    sharpenTexts(scene.children.list, scale);
  }
}

function sharpenTexts(objects: readonly Phaser.GameObjects.GameObject[], scale: number): void {
  for (const object of objects) {
    if (object instanceof Phaser.GameObjects.Text) object.setResolution(scale);
    else if (object instanceof Phaser.GameObjects.Container) sharpenTexts(object.list, scale);
  }
}
