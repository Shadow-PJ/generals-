import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { InputLayer } from './InputLayer';

/** Just enough of a Phaser scene: a keyboard that emits key events, and a shutdown event. */
function fakeScene() {
  const handlers = new Map<string, (event: unknown) => void>();
  let shutdown = () => undefined as void;
  const scene = {
    input: {
      keyboard: {
        on: (name: string, handler: (event: unknown) => void) => void handlers.set(name, handler),
        off: (name: string) => void handlers.delete(name),
      },
    },
    events: { once: (_name: string, handler: () => void) => void (shutdown = handler) },
  } as unknown as Phaser.Scene;
  const key = (type: 'keydown' | 'keyup', code: string, repeat = false) =>
    handlers.get(type)?.({ code, shiftKey: false, repeat, target: null, preventDefault: () => undefined });
  return { scene, key, shutdown: () => shutdown(), handlers };
}

describe('the input layer', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('HTMLInputElement', class {});
    vi.stubGlobal('HTMLTextAreaElement', class {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reports a held key once when pressed and once when let go', () => {
    const { scene, key } = fakeScene();
    const log: string[] = [];
    const input = new InputLayer(scene).on('talk', () => void log.push('press')).onRelease('talk', () => void log.push('release'));
    key('keydown', 'KeyV');
    key('keydown', 'KeyV', true);
    expect(input.isHeld('talk')).toBe(true);
    key('keyup', 'KeyV');
    key('keyup', 'KeyV');
    expect(log).toEqual(['press', 'release']);
    expect(input.isHeld('talk')).toBe(false);
  });

  it('lets go of every held key when the window loses focus', () => {
    const { scene, key } = fakeScene();
    const log: string[] = [];
    new InputLayer(scene).onRelease('talk', () => void log.push('release'));
    key('keydown', 'KeyV');
    window.dispatchEvent(new Event('blur'));
    expect(log).toEqual(['release']);
  });

  it('stops listening when the screen closes', () => {
    const { scene, key, shutdown, handlers } = fakeScene();
    const log: string[] = [];
    new InputLayer(scene).on('talk', () => void log.push('press'));
    shutdown();
    expect(handlers.size).toBe(0);
    key('keydown', 'KeyV');
    expect(log).toEqual([]);
  });
});
