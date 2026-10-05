// Turns key presses into actions for one scene. Mouse and touch are handled by each
// screen, and everything they do also has an action here, so no screen needs a mouse.
// Some actions are held (push-to-talk), so screens can also listen for their release.

import type Phaser from 'phaser';
import { playSound } from './audio/audio';
import { menuSound } from './audio/cues';
import { actionForKey, type InputAction } from './bindings';

type Listener = () => void;

export class InputLayer {
  private readonly listeners = new Map<InputAction, Listener[]>();
  private readonly releaseListeners = new Map<InputAction, Listener[]>();
  private readonly held = new Set<InputAction>();
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Keys typed into a text box belong to the text box.
    if (isTextField(event.target)) return;
    const action = actionForKey(event.code, event.shiftKey);
    if (!action) return;
    // Keep Tab, Space and the arrows from moving browser focus or scrolling the page.
    event.preventDefault();
    this.held.add(action);
    if (event.repeat) return;
    const listeners = this.listeners.get(action) ?? [];
    // Moving, choosing and going back click softly, on the keys the screen listens to.
    const sound = listeners.length > 0 ? menuSound(action) : null;
    if (sound) playSound(sound);
    for (const listener of listeners) listener();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = actionForKey(event.code, event.shiftKey);
    if (action) this.release(action);
    // Releasing Shift before Tab must not leave 'next' held.
    if (event.code === 'Tab') {
      this.release('next');
      this.release('prev');
    }
  };

  /** A window that loses focus never hears its keys come up: let go of everything. */
  private readonly onBlur = (): void => {
    for (const action of [...this.held]) this.release(action);
  };

  constructor(scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard;
    this.keyboard?.on('keydown', this.onKeyDown);
    this.keyboard?.on('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Calls the listener each time the action is pressed. */
  on(action: InputAction, listener: Listener): this {
    this.listeners.set(action, [...(this.listeners.get(action) ?? []), listener]);
    return this;
  }

  /** Calls the listener when the action's key comes back up after a press. */
  onRelease(action: InputAction, listener: Listener): this {
    this.releaseListeners.set(action, [...(this.releaseListeners.get(action) ?? []), listener]);
    return this;
  }

  private release(action: InputAction): void {
    if (!this.held.delete(action)) return;
    for (const listener of this.releaseListeners.get(action) ?? []) listener();
  }

  /** True while a key for the action is held down. */
  isHeld(action: InputAction): boolean {
    return this.held.has(action);
  }

  destroy(): void {
    this.keyboard?.off('keydown', this.onKeyDown);
    this.keyboard?.off('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.listeners.clear();
    this.releaseListeners.clear();
    this.held.clear();
  }
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
