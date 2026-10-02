// What each key does, as named actions. Screens listen for actions, never for keys, so a
// controller layout can map onto the same actions in session 6C.
// Keys 1 to 5 and U stay free for the card slots and the ultimate (session 2B).

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
  | 'right';

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
};

const ACTION_BY_CODE = new Map<string, InputAction>();
for (const [action, codes] of Object.entries(KEYBOARD_BINDINGS) as [InputAction, readonly string[]][]) {
  for (const code of codes) ACTION_BY_CODE.set(code, action);
}

/** The action a key press means, if any. Shift+Tab steps backward. */
export function actionForKey(code: string, shiftKey = false): InputAction | undefined {
  if (code === 'Tab' && shiftKey) return 'prev';
  return ACTION_BY_CODE.get(code);
}
