import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { registerButton } from './buttons';
import { PAD_RULES } from './gamepad';
import { InputLayer } from './InputLayer';
import { inputDevice, useDevice } from './inputDevice';

/** Just enough of a Phaser scene: a keyboard that emits key events, a frame event, and a shutdown event. */
function fakeScene() {
  const handlers = new Map<string, (event: unknown) => void>();
  let shutdown = () => undefined as void;
  let update: ((time: number) => void) | null = null;
  const scene = {
    input: {
      keyboard: {
        on: (name: string, handler: (event: unknown) => void) => void handlers.set(name, handler),
        off: (name: string) => void handlers.delete(name),
      },
    },
    events: {
      once: (_name: string, handler: () => void) => void (shutdown = handler),
      on: (name: string, handler: (time: number) => void) => void (name === 'update' && (update = handler)),
      off: () => void (update = null),
    },
  } as unknown as Phaser.Scene;
  const key = (type: 'keydown' | 'keyup', code: string, repeat = false) =>
    handlers.get(type)?.({ code, shiftKey: false, repeat, target: null, preventDefault: () => undefined });
  /** One frame at `time` with these standard buttons held on the controller. */
  const frame = (time: number, buttons: number[] = []) => {
    pad.buttons = Array.from({ length: 17 }, (_, i) => ({ value: buttons.includes(i) ? 1 : 0, pressed: buttons.includes(i) }));
    update?.(time);
  };
  return { scene, key, frame, shutdown: () => shutdown(), handlers };
}

const pad = { connected: true, buttons: [] as { value: number; pressed: boolean }[], axes: [0, 0, 0, 0] };
const A = 0;
const B = 1;
const DOWN = 13;
const VIEW = 8;

describe('the input layer', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('HTMLInputElement', class {});
    vi.stubGlobal('HTMLTextAreaElement', class {});
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    useDevice('keyboard');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads a controller: A chooses in menus, but fires card slot 4 in battle', () => {
    const menu: string[] = [];
    const battle: string[] = [];
    const m = fakeScene();
    new InputLayer(m.scene).on('confirm', () => void menu.push('confirm'));
    m.frame(0);
    m.frame(16, [A]);
    m.frame(32, [A]);
    m.frame(48);
    expect(menu).toEqual(['confirm']);
    expect(inputDevice()).toBe('gamepad');
    const b = fakeScene();
    new InputLayer(b.scene).on('slot4', () => void battle.push('slot4')).on('slot3', () => void battle.push('slot3'));
    b.frame(0);
    b.frame(16, [A]);
    b.frame(32, [B]);
    expect(battle).toEqual(['slot4', 'slot3']);
  });

  it('does not count a button already held when the screen opened', () => {
    const log: string[] = [];
    const { scene, frame } = fakeScene();
    new InputLayer(scene).on('confirm', () => void log.push('confirm'));
    frame(0, [A]);
    frame(16, [A]);
    expect(log).toEqual([]);
    frame(32);
    frame(48, [A]);
    expect(log).toEqual(['confirm']);
  });

  it('holds a direction while the button is down, and repeats it in lists', () => {
    const log: string[] = [];
    const { scene, frame } = fakeScene();
    const input = new InputLayer(scene).on('down', () => void log.push('down'));
    frame(0);
    frame(10, [DOWN]);
    expect(input.isHeld('down')).toBe(true);
    frame(300, [DOWN]);
    expect(log).toEqual(['down']);
    frame(10 + PAD_RULES.repeatDelayMs + PAD_RULES.repeatEveryMs, [DOWN]);
    expect(log).toEqual(['down', 'down', 'down']);
    frame(800);
    expect(input.isHeld('down')).toBe(false);
  });

  it('moves among the screen’s buttons with View, and A presses the one in focus', () => {
    const { scene, frame } = fakeScene();
    const pressed: string[] = [];
    const focus: string[] = [];
    const button = (name: string, x: number) => ({
      x,
      y: 20,
      usable: () => true,
      press: () => void pressed.push(name),
      setFocused: (on: boolean) => void (on && focus.push(name)),
    });
    registerButton(scene, button('Company', 100));
    registerButton(scene, button('Codex', 300));
    const confirms: string[] = [];
    const input = new InputLayer(scene).on('confirm', () => void confirms.push('confirm'));
    frame(0);
    frame(10, [VIEW]);
    expect(input.choosingButton).toBe(true);
    frame(20);
    frame(30, [15]); // right
    frame(40);
    frame(50, [A]);
    expect(focus).toEqual(['Company', 'Codex']);
    expect(pressed).toEqual(['Codex']);
    expect(confirms).toEqual([]);
    expect(input.choosingButton).toBe(false);
  });

  it('sends every action to a capture (the on-screen keyboard) until it lets go', () => {
    const { scene, key } = fakeScene();
    const screen: string[] = [];
    const captured: string[] = [];
    const input = new InputLayer(scene).on('confirm', () => void screen.push('confirm'));
    input.capture((action) => void captured.push(action));
    key('keydown', 'Enter');
    key('keyup', 'Enter');
    input.capture(null);
    key('keydown', 'Enter');
    expect(captured).toEqual(['confirm']);
    expect(screen).toEqual(['confirm']);
  });

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
