import { describe, expect, it } from 'vitest';
import { heldButtons, padChanges, PAD_RULES, repeatsBetween, type PadButton } from './gamepad';

const snapshot = (pressed: Partial<Record<number, number>> = {}, axes: number[] = [0, 0, 0, 0]) => ({
  buttons: Array.from({ length: 17 }, (_, i) => pressed[i] ?? 0),
  axes,
});

describe('reading a controller', () => {
  it('names the buttons held, with the triggers pulled half way', () => {
    expect([...heldButtons(snapshot({ 0: 1, 5: 1 }))]).toEqual(['A', 'RB']);
    expect(heldButtons(snapshot({ 7: 0.3 })).has('RT')).toBe(false);
    expect(heldButtons(snapshot({ 7: 0.8 })).has('RT')).toBe(true);
    expect([...heldButtons(snapshot({ 12: 1, 15: 1 }))]).toEqual(['Up', 'Right']);
  });

  it('reads the left stick as four directions, with a margin so it does not flicker at the edge', () => {
    expect([...heldButtons(snapshot({}, [0.9, 0, 0, 0]))]).toEqual(['StickRight']);
    expect([...heldButtons(snapshot({}, [0, -0.7, 0, 0]))]).toEqual(['StickUp']);
    expect(heldButtons(snapshot({}, [0.3, 0.3, 0, 0])).size).toBe(0);
    // Between let go and pressed: only held if it was already.
    const middle = snapshot({}, [0.5, 0, 0, 0]);
    expect(heldButtons(middle).has('StickRight')).toBe(false);
    expect(heldButtons(middle, new Set<PadButton>(['StickRight'])).has('StickRight')).toBe(true);
    // The right stick moves nothing.
    expect(heldButtons(snapshot({}, [0, 0, 1, 1])).size).toBe(0);
  });

  it('tells what was just pressed and let go', () => {
    expect(padChanges(new Set(['A', 'Up']), new Set(['A', 'B']))).toEqual({ pressed: ['B'], released: ['Up'] });
  });

  it('repeats a held direction after a pause, then steadily', () => {
    const { repeatDelayMs: delay, repeatEveryMs: every } = PAD_RULES;
    expect(repeatsBetween(0, 0, delay - 1)).toBe(0);
    expect(repeatsBetween(0, delay - 1, delay)).toBe(1);
    expect(repeatsBetween(0, delay, delay + every * 3)).toBe(3);
    expect(repeatsBetween(1000, 0, 1000 + delay + every)).toBe(2);
  });
});
