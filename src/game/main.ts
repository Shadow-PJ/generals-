// Starts Phaser. The game reads battle state from src/sim; it never changes it.

import Phaser from 'phaser';
import { EngineCheckScene } from './scenes/EngineCheckScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 960,
  height: 540,
  backgroundColor: '#1b2230',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [EngineCheckScene],
});
