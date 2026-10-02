// Starts Phaser. The screens read battle state from src/sim; they never change it.

import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { OrdersScene } from './scenes/OrdersScene';
import { PrepScene } from './scenes/PrepScene';
import { ResultScene } from './scenes/ResultScene';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './theme';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // The order text box on the Orders screen is a real HTML input laid over the canvas.
  dom: { createContainer: true },
  scene: [PrepScene, OrdersScene, BattleScene, ResultScene],
});
