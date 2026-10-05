// The first screen, gone in a moment: it turns the pixel art into textures (session 6B), then
// opens the Capital.

import Phaser from 'phaser';
import { makeArtTextures } from '../art/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    makeArtTextures(this);
    this.scene.start('Capital');
  }
}
