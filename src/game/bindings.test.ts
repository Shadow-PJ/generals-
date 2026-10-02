import { describe, expect, it } from 'vitest';
import { actionForKey, KEYBOARD_BINDINGS } from './bindings';

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
    expect(actionForKey('KeyQ')).toBeUndefined();
  });

  it('leaves keys 1 to 5 and U free for the card slots and the ultimate', () => {
    const used = Object.values(KEYBOARD_BINDINGS).flat();
    for (const code of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyU']) expect(used).not.toContain(code);
  });

  it('gives each key at most one action', () => {
    const used = Object.values(KEYBOARD_BINDINGS).flat();
    expect(new Set(used).size).toBe(used.length);
  });
});
