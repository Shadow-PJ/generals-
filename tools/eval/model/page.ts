// The browser half of the model eval: loads the model with the game's own loader and answers
// one order at a time. tools/eval/model/run.ts drives it and does the scoring.

import { CARD_GRAMMAR, promptFor } from '../../../src/cards/modelFormat';
import { MODEL_MAX_TOKENS } from '../../../src/cards/translator';
import { loadLocalModel, type LocalModel } from '../../../src/platform/model';
import type { EvalPage, LoadReport } from './protocol';

let model: LocalModel | null = null;

const status = (text: string) => {
  document.getElementById('status')!.textContent = text;
};

async function evalLoad(url: string, threads: number): Promise<LoadReport> {
  const start = performance.now();
  let bytes = 0;
  model = await loadLocalModel(url, {
    ...(threads > 0 ? { threads } : {}),
    onProgress: (loaded, total) => {
      bytes = total;
      status(`Downloading ${Math.round((loaded / total) * 100)}%`);
    },
  });
  status('Model ready');
  return { ms: performance.now() - start, bytes, threads: model.threads, isolated: crossOriginIsolated };
}

async function evalTranslate(text: string): Promise<{ raw: string; ms: number }> {
  if (!model) throw new Error('Load the model first');
  const start = performance.now();
  const raw = await model.complete(promptFor(text), CARD_GRAMMAR, MODEL_MAX_TOKENS);
  return { raw, ms: performance.now() - start };
}

const api: EvalPage = { evalLoad, evalTranslate };
Object.assign(window, api);
