import { beforeEach, describe, expect, it } from 'vitest';
import type { LocalModel, Platform } from '../platform';
import { ORDER_MODELS } from '../platform';
import { orderModelState, orderModelTranslator, syncOrderModel } from './orderModel';
import { changeSettings, startSession } from './session';

/** A platform whose model loads finish only when the test says so. */
function fakePlatform() {
  const loads: { url: string; progress: (done: number, total: number) => void; finish: () => void; fail: (e: Error) => void }[] = [];
  const unloaded: string[] = [];
  const files = new Map<string, string>();
  const platform: Platform = {
    kind: 'browser',
    files: { read: async (n) => files.get(n) ?? null, write: async (n, t) => void files.set(n, t) },
    display: {
      canSizeWindow: false,
      canFullscreen: false,
      isFullscreen: () => false,
      setFullscreen: async () => undefined,
      workArea: () => null,
      setWindowSize: async () => undefined,
      onFullscreenChange: () => undefined,
    },
    saveFolder: null,
    openSaveFolder: null,
    quit: null,
    ready: () => undefined,
    loadModel: (url, options) =>
      new Promise<LocalModel>((resolve, reject) => {
        const model: LocalModel = {
          threads: 4,
          complete: async () => JSON.stringify({ condition: null, steps: [{ action: 'hold', actors: { kind: 'all' } }] }),
          unload: async () => void unloaded.push(url),
        };
        loads.push({ url, progress: (d, t) => options?.onProgress?.(d, t), finish: () => resolve(model), fail: reject });
      }),
  };
  return { platform, loads, unloaded };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const [first, second] = ORDER_MODELS;

describe('the order-reading model in the game', () => {
  let fake: ReturnType<typeof fakePlatform>;

  beforeEach(async () => {
    fake = fakePlatform();
    await startSession(fake.platform);
    await changeSettings({ orderModel: null });
    syncOrderModel();
  });

  it('is off by default: no download, and the parser reads alone', () => {
    expect(orderModelState()).toEqual({ status: 'off' });
    expect(fake.loads).toEqual([]);
    expect(orderModelTranslator()).toBeNull();
  });

  it('loads in the background when switched on, showing progress, then reads orders', async () => {
    await changeSettings({ orderModel: first!.id });
    syncOrderModel();
    syncOrderModel();
    expect(fake.loads).toHaveLength(1);
    expect(fake.loads[0]!.url).toBe(first!.url);
    fake.loads[0]!.progress(50, 200);
    expect(orderModelState()).toEqual({ status: 'loading', name: first!.name, progress: 0.25 });
    expect(orderModelTranslator()).toBeNull();
    fake.loads[0]!.finish();
    // It reads one practice order first, so the long prompt is ready for your first real one.
    await flush();
    await flush();
    expect(orderModelState()).toEqual({ status: 'ready', name: first!.name, threads: 4 });
    expect(await orderModelTranslator()!.translate('chill')).toMatchObject({ ok: true, card: { steps: [{ action: 'hold' }] } });
  });

  it('says when the model fails, and the parser keeps reading', async () => {
    await changeSettings({ orderModel: first!.id });
    syncOrderModel();
    fake.loads[0]!.fail(new Error('out of memory'));
    await flush();
    expect(orderModelState()).toEqual({ status: 'failed', name: first!.name, error: 'out of memory' });
    expect(orderModelTranslator()).toBeNull();
  });

  it('frees the old model when switched to another one or off', async () => {
    await changeSettings({ orderModel: first!.id });
    syncOrderModel();
    fake.loads[0]!.finish();
    await flush();
    await flush();
    await changeSettings({ orderModel: second!.id });
    syncOrderModel();
    expect(fake.unloaded).toEqual([first!.url]);
    expect(orderModelState()).toMatchObject({ status: 'loading', name: second!.name });
    await changeSettings({ orderModel: null });
    syncOrderModel();
    // A load that finishes after being switched off is thrown away.
    fake.loads[1]!.finish();
    await flush();
    await flush();
    expect(orderModelState()).toEqual({ status: 'off' });
    expect(fake.unloaded).toEqual([first!.url, second!.url]);
  });
});
