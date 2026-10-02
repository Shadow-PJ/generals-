// Starts the game: finds the platform, loads your saves and settings, sizes the window, then
// starts Phaser. The screens read battle state from src/sim; they never change it.

import Phaser from 'phaser';
import { describeCard } from '../cards/describe';
import { translateOrder } from '../cards/translator';
import { createPlatform } from '../platform';
import { actionForKey } from './bindings';
import { currentRenderScale, renderScale, setInitialRenderScale, setRenderScale } from './display';
import { orderModelState, orderModelTranslator, syncOrderModel } from './orderModel';
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
  // The small order-reading model, if it is switched on, loads in the background.
  syncOrderModel();
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
  // Automatic tests (the desktop smoke test) can ask the order model directly with ?smoke.
  if (new URLSearchParams(window.location.search).has('smoke')) exposeTestHook();
  // F11 toggles fullscreen on every screen.
  window.addEventListener('keydown', (event) => {
    if (actionForKey(event.code, event.shiftKey) !== 'fullscreen' || event.repeat) return;
    event.preventDefault();
    void toggleFullscreen();
  });
}

function exposeTestHook(): void {
  Object.assign(window, {
    __smoke: {
      modelState: orderModelState,
      async translate(text: string) {
        const start = performance.now();
        const result = await translateOrder(text, orderModelTranslator(), 240_000);
        return { ok: result.ok, by: result.by, card: result.ok ? describeCard(result.card) : result.error, ms: performance.now() - start };
      },
    },
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
