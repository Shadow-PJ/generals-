// Turns key presses into actions for one scene. Mouse and touch are handled by each
// screen, and everything they do also has an action here, so no screen needs a mouse.

import type Phaser from 'phaser';
import { actionForKey, type InputAction } from './bindings';

type Listener = () => void;

export class InputLayer {
  private readonly listeners = new Map<InputAction, Listener[]>();
  private readonly held = new Set<InputAction>();
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = actionForKey(event.code, event.shiftKey);
    if (!action) return;
    // Keep Tab, Space and the arrows from moving browser focus or scrolling the page.
    event.preventDefault();
    this.held.add(action);
    if (event.repeat) return;
    for (const listener of this.listeners.get(action) ?? []) listener();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = actionForKey(event.code, event.shiftKey);
    if (action) this.held.delete(action);
    // Releasing Shift before Tab must not leave 'nextUnit' held.
    if (event.code === 'Tab') {
      this.held.delete('nextUnit');
      this.held.delete('prevUnit');
    }
  };

  constructor(scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard;
    this.keyboard?.on('keydown', this.onKeyDown);
    this.keyboard?.on('keyup', this.onKeyUp);
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Calls the listener each time the action is pressed. */
  on(action: InputAction, listener: Listener): this {
    this.listeners.set(action, [...(this.listeners.get(action) ?? []), listener]);
    return this;
  }

  /** True while a key for the action is held down. */
  isHeld(action: InputAction): boolean {
    return this.held.has(action);
  }

  destroy(): void {
    this.keyboard?.off('keydown', this.onKeyDown);
    this.keyboard?.off('keyup', this.onKeyUp);
    this.listeners.clear();
    this.held.clear();
  }
}
