// What each key does, as named actions. Screens listen for actions, never for keys, so a
// controller layout can map onto the same actions in session 6C.

export type InputAction =
  | 'confirm'
  | 'back'
  | 'pause'
  | 'speed'
  | 'next'
  | 'prev'
  | 'clear'
  | 'start'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'slot5'
  | 'ultimate'
  | 'fullscreen'
  /** Held to speak an order (push-to-talk). */
  | 'talk'
  | 'codex'
  /** Opens the debug Troops screen from the Prep screen. */
  | 'troops'
  /** Opens the General select screen from the Prep screen. */
  | 'general';

/** The card slot actions, in slot order. */
export const SLOT_ACTIONS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'] as const;

/** Keyboard keys for each action, as KeyboardEvent.code values. */
export const KEYBOARD_BINDINGS: Readonly<Record<InputAction, readonly string[]>> = {
  confirm: ['Enter', 'NumpadEnter'],
  back: ['Escape', 'Backspace'],
  pause: ['Space', 'KeyP'],
  speed: ['KeyF'],
  next: ['Tab'],
  prev: [],
  clear: ['Delete'],
  start: ['KeyB'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  slot1: ['Digit1', 'Numpad1'],
  slot2: ['Digit2', 'Numpad2'],
  slot3: ['Digit3', 'Numpad3'],
  slot4: ['Digit4', 'Numpad4'],
  slot5: ['Digit5', 'Numpad5'],
  ultimate: ['KeyU'],
  fullscreen: ['F11'],
  talk: ['KeyV'],
  codex: ['KeyC'],
  troops: ['KeyT'],
  general: ['KeyG'],
};

const ACTION_BY_CODE = new Map<string, InputAction>();
for (const [action, codes] of Object.entries(KEYBOARD_BINDINGS) as [InputAction, readonly string[]][]) {
  for (const code of codes) ACTION_BY_CODE.set(code, action);
}

/** The key to show for an action on screen: "V" for KeyV. */
export function keyLabel(action: InputAction): string {
  const code = KEYBOARD_BINDINGS[action][0] ?? '';
  return code.replace(/^(Key|Digit)/, '');
}

/** The action a key press means, if any. Shift+Tab steps backward. */
export function actionForKey(code: string, shiftKey = false): InputAction | undefined {
  if (code === 'Tab' && shiftKey) return 'prev';
  return ACTION_BY_CODE.get(code);
}
