// Starts the game: finds the platform, loads your saves and settings, sizes the window, then
// starts Phaser. The screens read battle state from src/sim; they never change it.

import Phaser from 'phaser';
import { describeCard } from '../cards/describe';
import { translateOrder, type Translator } from '../cards/translator';
import { createPlatform } from '../platform';
import { audioStatus, setVolume, unlockAudio } from './audio/audio';
import { actionForKey } from './bindings';
import { onDeviceChange } from './inputDevice';
import { currentRenderScale, renderScale, setInitialRenderScale, setRenderScale } from './display';
import { orderModelState, orderModelTranslator, syncOrderModel } from './orderModel';
import { loadOrderReader, orderReaderTranslator } from './orderReader';
import { ArmyScene } from './scenes/ArmyScene';
import { CompanyScene } from './scenes/CompanyScene';
import { TechScene } from './scenes/TechScene';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { CapitalScene } from './scenes/CapitalScene';
import { CodexScene } from './scenes/CodexScene';
import { GeneralsScene } from './scenes/GeneralsScene';
import { OathsScene } from './scenes/OathsScene';
import { OrdersScene } from './scenes/OrdersScene';
import { PrepScene } from './scenes/PrepScene';
import { ResultScene } from './scenes/ResultScene';
import { RunScene } from './scenes/RunScene';
import { SettingsScene } from './scenes/SettingsScene';
import { StopScene } from './scenes/StopScene';
import { TroopsScene } from './scenes/TroopsScene';
import { watchScenes } from './sceneHooks';
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
  // The order reader loads in the background; so does the experimental model, if it is on.
  void loadOrderReader().catch(() => undefined);
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
    // Sound is the game's own synthesizer (src/game/audio), not Phaser's.
    audio: { noAudio: true },
    // Boot makes the textures, then opens the Capital, the world map hub.
    scene: [
      BootScene,
      CapitalScene,
      RunScene,
      ArmyScene,
      TechScene,
      CompanyScene,
      StopScene,
      PrepScene,
      OrdersScene,
      BattleScene,
      ResultScene,
      SettingsScene,
      CodexScene,
      TroopsScene,
      GeneralsScene,
      OathsScene,
    ],
  });

  watchScenes(game);
  // Sound: as loud as Settings say, starting with the first key press or click (browsers allow no sooner).
  setVolume(currentSettings().volume);
  window.addEventListener('pointerdown', unlockAudio, { capture: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });
  // A controller's first press too; the desktop app starts sound right away, the browser when it allows.
  onDeviceChange((device) => device === 'gamepad' && unlockAudio());
  if (currentPlatform().kind === 'desktop') unlockAudio();
  game.events.on('settings-changed', () => setVolume(currentSettings().volume));
  // The desktop app keeps its window hidden until the first screen is drawn.
  game.events.once(Phaser.Core.Events.POST_RENDER, () => currentPlatform().ready());
  // A bigger window or fullscreen needs more pixels to stay sharp.
  window.addEventListener('resize', () => setRenderScale(game, wantedRenderScale()));
  game.events.on('settings-changed', () => setRenderScale(game, wantedRenderScale()));
  // Automatic tests (the desktop smoke test) can ask the order reader and model directly with ?smoke.
  if (new URLSearchParams(window.location.search).has('smoke')) exposeTestHook();
  // F11 toggles fullscreen on every screen.
  window.addEventListener('keydown', (event) => {
    if (actionForKey(event.code, event.shiftKey) !== 'fullscreen' || event.repeat) return;
    event.preventDefault();
    void toggleFullscreen();
  });
}

function exposeTestHook(): void {
  /** Reads an order the way the Orders screen does, or with only the parser and the model. */
  async function translate(text: string, others: readonly (Translator | null)[]) {
    const start = performance.now();
    const result = await translateOrder(text, others, 240_000);
    return { ok: result.ok, by: result.by, card: result.ok ? describeCard(result.card) : result.error, ms: performance.now() - start };
  }
  Object.assign(window, {
    __smoke: {
      modelState: orderModelState,
      audio: audioStatus,
      translate: (text: string) => translate(text, [orderReaderTranslator, orderModelTranslator()]),
      translateWithModel: (text: string) => translate(text, [orderModelTranslator()]),
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
