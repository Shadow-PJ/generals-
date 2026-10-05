// Key hints for the device in hand (session 6C): a button labelled "Orders  ⏎" reads
// "Orders  Ⓐ" once the player picks up a controller, and a screen's help line has a version
// for each device. Pure apart from asking which device was used last.

import { keyLabel, type InputAction } from './bindings';
import { inputDevice, type InputDevice } from './inputDevice';

/** The keyboard names button labels end with, and the action each stands for. */
const KEY_TOKENS: Readonly<Record<string, InputAction>> = {
  Esc: 'back',
  '⏎': 'confirm',
  Del: 'clear',
  B: 'start',
  C: 'codex',
  R: 'company',
  G: 'general',
  O: 'oaths',
  T: 'troops',
  K: 'tech',
  V: 'talk',
};

/**
 * A button label for the device: its trailing key ("  Esc") becomes the controller's button
 * ("  Ⓑ"), or goes away when only a key does it (View reaches the button instead).
 */
export function deviceLabel(label: string, device: InputDevice = inputDevice()): string {
  if (device === 'keyboard') return label;
  const match = /^(.*\S)\s{2,}(\S+)$/.exec(label);
  if (!match) return label;
  const action = KEY_TOKENS[match[2]!];
  if (!action) return label;
  const button = keyLabel(action, 'gamepad');
  return button ? `${match[1]}  ${button}` : match[1]!;
}

/** A screen's help line, in the words for the device in hand. */
export function deviceHint(keyboard: string, gamepad: string, device: InputDevice = inputDevice()): string {
  return device === 'gamepad' ? gamepad : keyboard;
}

/** The help line every controller screen ends with: how to reach the buttons. */
export const VIEW_HINT = 'View: the buttons';
