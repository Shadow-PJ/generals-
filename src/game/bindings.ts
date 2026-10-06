// What each key and each controller button does, as named actions. Screens listen for actions,
// never for keys or buttons, so the keyboard and a controller (session 6C) drive them the same way.

import type { PadButton } from './gamepad';
import { inputDevice, type InputDevice } from './inputDevice';

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
  | 'general'
  /** Opens the Tech Web from the Capital. */
  | 'tech'
  /** Opens your company from the Capital. */
  | 'company'
  /** Opens the Oaths of Command from the Capital (session 5F). */
  | 'oaths'
  /** Controller only: moves among the screen's buttons, to press any of them (session 6C). */
  | 'menu';

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
  tech: ['KeyK'],
  company: ['KeyR'],
  oaths: ['KeyO'],
  menu: [],
};

/**
 * Controller buttons for each action, in the standard layout (Xbox names; the Steam Deck's are
 * the same). A button can mean several actions: the first one the screen listens to wins. In
 * menus A chooses, B goes back, X clears and the bumpers switch tabs or slots; in battle the
 * face buttons and RB fire the five card slots, a trigger fires the ultimate, Menu pauses and LB
 * switches speed. View moves among the screen's buttons, reaching what keys like G or C open.
 */
export const GAMEPAD_BINDINGS: Readonly<Record<PadButton, readonly InputAction[]>> = {
  A: ['confirm', 'slot4'],
  B: ['back', 'slot3'],
  X: ['clear', 'slot1'],
  Y: ['slot2'],
  LB: ['prev', 'speed'],
  RB: ['next', 'slot5'],
  RT: ['ultimate'],
  LT: ['ultimate'],
  View: ['menu'],
  Menu: ['start', 'pause'],
  L3: [],
  R3: [],
  Up: ['up'],
  Down: ['down'],
  Left: ['left'],
  Right: ['right'],
  StickUp: ['up'],
  StickDown: ['down'],
  StickLeft: ['left'],
  StickRight: ['right'],
};

/** How each controller button is written on screen. */
export const PAD_LABELS: Readonly<Record<PadButton, string>> = {
  A: 'Ⓐ',
  B: 'Ⓑ',
  X: 'Ⓧ',
  Y: 'Ⓨ',
  LB: 'LB',
  RB: 'RB',
  RT: 'RT',
  LT: 'LT',
  View: 'View',
  Menu: 'Menu',
  L3: 'L3',
  R3: 'R3',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  StickUp: '↑',
  StickDown: '↓',
  StickLeft: '←',
  StickRight: '→',
};

/** The controller button for an action (the first in the layout), or null when only a key does it. */
export function padButtonFor(action: InputAction): PadButton | null {
  for (const [button, actions] of Object.entries(GAMEPAD_BINDINGS) as [PadButton, readonly InputAction[]][]) {
    if (actions.includes(action)) return button;
  }
  return null;
}

const ACTION_BY_CODE = new Map<string, InputAction>();
for (const [action, codes] of Object.entries(KEYBOARD_BINDINGS) as [InputAction, readonly string[]][]) {
  for (const code of codes) ACTION_BY_CODE.set(code, action);
}

/**
 * The key or button to show for an action on screen, for the device the player last used:
 * "V" for KeyV, "Ⓐ" for confirm on a controller; '' when that device has nothing for it.
 */
export function keyLabel(action: InputAction, device: InputDevice = inputDevice()): string {
  if (device === 'gamepad') {
    const button = padButtonFor(action);
    return button ? PAD_LABELS[button] : '';
  }
  const code = KEYBOARD_BINDINGS[action][0] ?? '';
  return code.replace(/^(Key|Digit)/, '');
}

/** The action a key press means, if any. Shift+Tab steps backward. */
export function actionForKey(code: string, shiftKey = false): InputAction | undefined {
  if (code === 'Tab' && shiftKey) return 'prev';
  return ACTION_BY_CODE.get(code);
}
