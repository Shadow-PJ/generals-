// The small model that reads free-form orders, when it is switched on in Settings. It loads in
// the background; until it is ready (or if it fails) the rule parser reads orders alone.
// After loading it reads one practice order: the first reading also works through the long
// prompt (by far the slowest part), and later readings reuse it, so your first order is quick.

import { PROMPT_EXAMPLES } from '../cards/modelFormat';
import { modelTranslator, type Translator } from '../cards/translator';
import { ORDER_MODELS, type LocalModel } from '../platform';
import { currentPlatform, currentSettings } from './session';

export type ModelState =
  | { status: 'off' }
  | { status: 'loading'; name: string; progress: number }
  | { status: 'warming'; name: string }
  | { status: 'ready'; name: string; threads: number }
  | { status: 'failed'; name: string; error: string };

let state: ModelState = { status: 'off' };
let loaded: { id: string; model: LocalModel } | null = null;
let loadingId: string | null = null;

export function orderModelState(): ModelState {
  return state;
}

/** Starts, switches or stops the model to match the settings. Does nothing when it already matches. */
export function syncOrderModel(): void {
  const choice = ORDER_MODELS.find((m) => m.id === currentSettings().orderModel);
  if (loaded && loaded.id !== choice?.id) {
    void loaded.model.unload();
    loaded = null;
  }
  if (!choice) {
    loadingId = null;
    state = { status: 'off' };
    return;
  }
  if (loaded || loadingId === choice.id) return;
  loadingId = choice.id;
  state = { status: 'loading', name: choice.name, progress: 0 };
  currentPlatform()
    .loadModel(choice.url, {
      onProgress: (done, total) => {
        if (loadingId === choice.id) state = { status: 'loading', name: choice.name, progress: total > 0 ? done / total : 0 };
      },
    })
    .then(async (model) => {
      // Switched to another model (or off) while this one loaded.
      if (loadingId !== choice.id) return void model.unload();
      state = { status: 'warming', name: choice.name };
      await modelTranslator(model).translate(PROMPT_EXAMPLES[0]!.text);
      if (loadingId !== choice.id) return void model.unload();
      loadingId = null;
      loaded = { id: choice.id, model };
      state = { status: 'ready', name: choice.name, threads: model.threads };
    })
    .catch((error: unknown) => {
      if (loadingId !== choice.id) return;
      loadingId = null;
      state = { status: 'failed', name: choice.name, error: error instanceof Error ? error.message : String(error) };
    });
}

/** The model as a translator once it is ready; null before that, so the parser answers alone. */
export function orderModelTranslator(): Translator | null {
  return loaded ? modelTranslator(loaded.model) : null;
}
