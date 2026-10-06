// Reading a controller (session 6C): the browser's Gamepad API, as snapshots of buttons and
// sticks, turned into presses and releases of named pad buttons. Pure, so it can be tested; the
// input layer feeds it a snapshot every frame. Buttons use the standard layout every browser
// maps Xbox, PlayStation, Switch Pro and Steam Deck controls onto (A is the bottom face button).

/** Standard Gamepad API button indices, by Xbox names. The left stick counts as four more. */
export const PAD_BUTTONS = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  View: 8,
  Menu: 9,
  L3: 10,
  R3: 11,
  Up: 12,
  Down: 13,
  Left: 14,
  Right: 15,
} as const;

export type PadButton = keyof typeof PAD_BUTTONS | 'StickUp' | 'StickDown' | 'StickLeft' | 'StickRight';

/** Directional buttons repeat while held, like a key held down in a text box. */
export const DIRECTIONS: readonly PadButton[] = ['Up', 'Down', 'Left', 'Right', 'StickUp', 'StickDown', 'StickLeft', 'StickRight'];

export const PAD_RULES = {
  /** A stick pushed this far counts as pressed in that direction; it lets go below `release`. */
  press: 0.6,
  release: 0.4,
  /** A trigger (LT, RT) pulled this far counts as pressed. */
  trigger: 0.5,
  /** A held direction repeats after this long, then this often, in milliseconds. */
  repeatDelayMs: 380,
  repeatEveryMs: 110,
} as const;

/** What one controller reports in one frame. */
export interface PadSnapshot {
  /** How far each button is pressed, 0 to 1, by standard index. */
  buttons: readonly number[];
  /** The sticks: left x, left y, right x, right y, from -1 to 1 (y down is positive). */
  axes: readonly number[];
}

/** The pad buttons held in a snapshot; the stick directions use `before` so they don't flicker at the edge. */
export function heldButtons(snapshot: PadSnapshot, before: ReadonlySet<PadButton> = new Set()): Set<PadButton> {
  const held = new Set<PadButton>();
  for (const [name, index] of Object.entries(PAD_BUTTONS) as [keyof typeof PAD_BUTTONS, number][]) {
    const value = snapshot.buttons[index] ?? 0;
    const trigger = name === 'LT' || name === 'RT';
    if (value >= (trigger ? PAD_RULES.trigger : 0.5)) held.add(name);
  }
  const x = snapshot.axes[0] ?? 0;
  const y = snapshot.axes[1] ?? 0;
  const stick = (name: PadButton, value: number) => {
    if (value >= (before.has(name) ? PAD_RULES.release : PAD_RULES.press)) held.add(name);
  };
  stick('StickLeft', -x);
  stick('StickRight', x);
  stick('StickUp', -y);
  stick('StickDown', y);
  return held;
}

/** What changed from one frame to the next: buttons just pressed and just let go. */
export function padChanges(before: ReadonlySet<PadButton>, now: ReadonlySet<PadButton>): { pressed: PadButton[]; released: PadButton[] } {
  return {
    pressed: [...now].filter((b) => !before.has(b)),
    released: [...before].filter((b) => !now.has(b)),
  };
}

/**
 * How many times a held direction repeats between two moments, counting from when it was
 * pressed: none before the delay, then one every `repeatEveryMs`.
 */
export function repeatsBetween(heldSinceMs: number, fromMs: number, toMs: number): number {
  const count = (t: number) => (t - heldSinceMs < PAD_RULES.repeatDelayMs ? 0 : Math.floor((t - heldSinceMs - PAD_RULES.repeatDelayMs) / PAD_RULES.repeatEveryMs) + 1);
  return Math.max(0, count(toMs) - count(fromMs));
}

/** The first connected controller's snapshot, from the browser; null when none is plugged in. */
export function readGamepad(): PadSnapshot | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  for (const pad of navigator.getGamepads()) {
    if (pad?.connected) return { buttons: pad.buttons.map((b) => b.value || (b.pressed ? 1 : 0)), axes: [...pad.axes] };
  }
  return null;
}
