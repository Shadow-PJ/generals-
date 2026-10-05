import { describe, expect, it } from 'vitest';
import { sceneButtons, registerButton } from './buttons';
import { deviceHint, deviceLabel } from './hints';

describe('hints for the device in hand', () => {
  it('turns a button’s key into the controller’s button, or drops it when only a key does it', () => {
    expect(deviceLabel('Orders  ⏎', 'keyboard')).toBe('Orders  ⏎');
    expect(deviceLabel('Orders  ⏎', 'gamepad')).toBe('Orders  Ⓐ');
    expect(deviceLabel('◀ Capital  Esc', 'gamepad')).toBe('◀ Capital  Ⓑ');
    expect(deviceLabel('Clear slot  Del', 'gamepad')).toBe('Clear slot  Ⓧ');
    expect(deviceLabel('Start battle  B', 'gamepad')).toBe('Start battle  Menu');
    expect(deviceLabel('Codex  C', 'gamepad')).toBe('Codex');
    expect(deviceLabel('Tech Web  K', 'gamepad')).toBe('Tech Web');
    expect(deviceLabel('2x', 'gamepad')).toBe('2x');
  });

  it('picks the help line for the device', () => {
    expect(deviceHint('Enter: go', 'Ⓐ: go', 'keyboard')).toBe('Enter: go');
    expect(deviceHint('Enter: go', 'Ⓐ: go', 'gamepad')).toBe('Ⓐ: go');
  });
});

describe('the screen’s buttons for View', () => {
  const button = (x: number, y: number, usable = true) => ({ x, y, usable: () => usable, press: () => undefined, setFocused: () => undefined });

  it('come in reading order, leaving out hidden ones and forgetting removed ones', () => {
    const scene = {};
    const a = button(300, 30);
    const b = button(100, 34);
    const c = button(50, 600);
    const hidden = button(10, 10, false);
    registerButton(scene, a);
    registerButton(scene, c);
    const forget = registerButton(scene, b);
    registerButton(scene, hidden);
    expect(sceneButtons(scene)).toEqual([b, a, c]);
    forget();
    expect(sceneButtons(scene)).toEqual([a, c]);
    expect(sceneButtons({})).toEqual([]);
  });
});

describe('readable text', () => {
  it('never draws text smaller than the Steam Deck minimum', async () => {
    const { readableSize, MIN_TEXT_SIZE } = await import('./theme');
    expect(readableSize(9)).toBe(MIN_TEXT_SIZE);
    expect(readableSize(14)).toBe(14);
    // 1280×800 shows the 960×704 world about 1.14 times bigger: well above Valve's 9 pixels.
    expect(MIN_TEXT_SIZE * (800 / 704)).toBeGreaterThan(9);
  });
});
