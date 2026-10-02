// Starts the game: finds the platform, loads your saves and settings, sizes the window, then
// starts Phaser. The screens read battle state from src/sim; they never change it.

import Phaser from 'phaser';
import { createPlatform } from '../platform';
import { actionForKey } from './bindings';
import { currentRenderScale, renderScale, setInitialRenderScale, setRenderScale } from './display';
import { BattleScene } from './scenes/BattleScene';
import { OrdersScene } from './scenes/OrdersScene';
import { PrepScene } from './scenes/PrepScene';
import { ResultScene } from './scenes/ResultScene';
import { SettingsScene } from './scenes/SettingsScene';
import { applyWindowSettings, currentPlatform, currentSettings, startSession, toggleFullscreen } from './session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './theme';

/** The render scale the current window and setting call for. */
function wantedRenderScale(): number {
  return renderScale(
    currentSettings().resolution,
    { width: window.innerWidth, height: window.innerHeight },
    window.devicePixelRatio || 1,
  );
}

async function boot(): Promise<void> {
  await startSession(await createPlatform());
  await applyWindowSettings();
  setInitialRenderScale(wantedRenderScale());

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: GAME_WIDTH * currentRenderScale(),
    height: GAME_HEIGHT * currentRenderScale(),
    backgroundColor: COLORS.background,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // The order text box on the Orders screen is a real HTML input laid over the canvas.
    dom: { createContainer: true },
    scene: [PrepScene, OrdersScene, BattleScene, ResultScene, SettingsScene],
  });

  // The desktop app keeps its window hidden until the first screen is drawn.
  game.events.once(Phaser.Core.Events.POST_RENDER, () => currentPlatform().ready());
  // A bigger window or fullscreen needs more pixels to stay sharp.
  window.addEventListener('resize', () => setRenderScale(game, wantedRenderScale()));
  game.events.on('settings-changed', () => setRenderScale(game, wantedRenderScale()));
  // F11 toggles fullscreen on every screen.
  window.addEventListener('keydown', (event) => {
    if (actionForKey(event.code, event.shiftKey) !== 'fullscreen' || event.repeat) return;
    event.preventDefault();
    void toggleFullscreen();
  });
}

boot().catch((error: unknown) => {
  console.error(error);
  const app = document.getElementById('app');
  if (app) {
    app.style.cssText += 'color:#d6dde8;font:16px system-ui,sans-serif;padding:24px;box-sizing:border-box';
    app.textContent = `Generals could not start: ${String(error)}`;
  }
});
