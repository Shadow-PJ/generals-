// The first screen, gone in a moment: it turns the pixel art into textures (session 6B), makes the
// sprite shaders ready (session 7H), then opens the title screen.

import Phaser from 'phaser';
import { makeArtTextures } from '../art/textures';
import { warmShaders } from '../shaderWarmup';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    makeArtTextures(this);
    warmShaders(this, () => this.scene.start('Title'));
  }
}
