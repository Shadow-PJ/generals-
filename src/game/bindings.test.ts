import { describe, expect, it } from 'vitest';
import { actionForKey, GAMEPAD_BINDINGS, KEYBOARD_BINDINGS, keyLabel, padButtonFor, SLOT_ACTIONS, type InputAction } from './bindings';

describe('key bindings', () => {
  it('maps keys to actions', () => {
    expect(actionForKey('Enter')).toBe('confirm');
    expect(actionForKey('Space')).toBe('pause');
    expect(actionForKey('KeyF')).toBe('speed');
    expect(actionForKey('ArrowLeft')).toBe('left');
    expect(actionForKey('Tab')).toBe('next');
    expect(actionForKey('Tab', true)).toBe('prev');
    expect(actionForKey('Delete')).toBe('clear');
    expect(actionForKey('KeyB')).toBe('start');
    expect(actionForKey('KeyT')).toBe('troops');
    expect(actionForKey('KeyG')).toBe('general');
    expect(actionForKey('KeyQ')).toBeUndefined();
  });

  it('fires card slots with keys 1 to 5 and the ultimate with U', () => {
    expect(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].map((code) => actionForKey(code))).toEqual([
      'slot1',
      'slot2',
      'slot3',
      'slot4',
      'slot5',
    ]);
    expect(actionForKey('Numpad3')).toBe('slot3');
    expect(actionForKey('KeyU')).toBe('ultimate');
  });

  it('holds V to speak an order, and names keys for the screen', () => {
    expect(actionForKey('KeyV')).toBe('talk');
    expect(keyLabel('talk')).toBe('V');
    expect(keyLabel('slot1')).toBe('1');
    expect(keyLabel('confirm')).toBe('Enter');
  });

  it('gives each key at most one action', () => {
    const used = Object.values(KEYBOARD_BINDINGS).flat();
    expect(new Set(used).size).toBe(used.length);
  });

  it('lays the battle out on a controller: X Y B A and RB fire the slots, a trigger the ultimate', () => {
    expect(SLOT_ACTIONS.map((a) => padButtonFor(a))).toEqual(['X', 'Y', 'B', 'A', 'RB']);
    expect(padButtonFor('ultimate')).toBe('RT');
    expect(GAMEPAD_BINDINGS.LT).toContain('ultimate');
    expect(padButtonFor('pause')).toBe('Menu');
    expect(padButtonFor('speed')).toBe('LB');
    expect(keyLabel('slot1', 'gamepad')).toBe('Ⓧ');
    expect(keyLabel('slot1', 'keyboard')).toBe('1');
  });

  it('reaches every menu action from a controller; screens opened by letter keys through View', () => {
    const menu: InputAction[] = ['confirm', 'back', 'clear', 'start', 'up', 'down', 'left', 'right', 'prev', 'next'];
    for (const action of menu) expect(padButtonFor(action), action).not.toBeNull();
    expect(keyLabel('confirm', 'gamepad')).toBe('Ⓐ');
    expect(keyLabel('back', 'gamepad')).toBe('Ⓑ');
    expect(GAMEPAD_BINDINGS.View).toEqual(['menu']);
    for (const action of ['codex', 'general', 'troops', 'tech', 'company', 'oaths', 'versus', 'talk'] as const) expect(keyLabel(action, 'gamepad')).toBe('');
  });
});
