// Turns key presses and controller buttons into actions for one scene. Mouse and touch are
// handled by each screen, and everything they do also has an action here, so no screen needs a
// mouse. Some actions are held (push-to-talk, moving a troop), so screens can also ask whether
// one is held and listen for its release.
//
// A controller (session 6C) drives the same actions: its buttons are read every frame through
// the browser's Gamepad API (src/game/gamepad.ts) and mapped by src/game/bindings.ts. View moves
// among the screen's on-screen buttons, so anything a letter key opens can be reached too. A
// screen can also capture every action for a while, as the on-screen keyboard does.

import type Phaser from 'phaser';
import { playSound } from './audio/audio';
import { menuSound } from './audio/cues';
import { actionForKey, GAMEPAD_BINDINGS, type InputAction } from './bindings';
import { DIRECTIONS, heldButtons, padChanges, readGamepad, repeatsBetween, type PadButton } from './gamepad';
import { useDevice } from './inputDevice';
import { sceneButtons, type FocusableButton } from './buttons';

type Listener = () => void;

export class InputLayer {
  private readonly listeners = new Map<InputAction, Listener[]>();
  private readonly releaseListeners = new Map<InputAction, Listener[]>();
  private readonly held = new Set<InputAction>();
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  /** The controller buttons held after the last frame, when each was pressed, and the action each one holds. */
  private padHeld: Set<PadButton> | null = null;
  private readonly padSince = new Map<PadButton, number>();
  private readonly padAction = new Map<PadButton, InputAction>();
  private lastPollMs = 0;
  /** While set, every action goes here instead (the on-screen keyboard). */
  private captor: ((action: InputAction) => void) | null = null;
  /** Moving among the screen's buttons with View: the buttons in reading order, and the one in focus. */
  private bar: { buttons: FocusableButton[]; index: number } | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Keys typed into a text box belong to the text box.
    if (isTextField(event.target)) return;
    const action = actionForKey(event.code, event.shiftKey);
    useDevice('keyboard');
    if (!action) return;
    // Keep Tab, Space and the arrows from moving browser focus or scrolling the page.
    event.preventDefault();
    if (event.repeat) return;
    if (!this.captor && !this.bar) this.held.add(action);
    this.dispatch(action);
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

  private readonly onPointer = (): void => useDevice('keyboard');

  /** Reads the controller once a frame. */
  private readonly poll = (time: number): void => {
    const snapshot = readGamepad();
    const before = this.padHeld;
    const now = snapshot ? heldButtons(snapshot, before ?? new Set()) : new Set<PadButton>();
    this.padHeld = now;
    const from = this.lastPollMs;
    this.lastPollMs = time;
    // The first frame only notes what is already held: the press that opened this screen
    // must not count again here.
    if (!before) return;
    const { pressed, released } = padChanges(before, now);
    for (const button of released) this.padRelease(button);
    for (const button of pressed) {
      this.padSince.set(button, time);
      useDevice('gamepad');
      this.padPress(button, true);
    }
    // A direction held down repeats, for moving through lists.
    for (const button of DIRECTIONS) {
      const since = this.padSince.get(button);
      if (since === undefined || !now.has(button) || pressed.includes(button)) continue;
      for (let i = repeatsBetween(since, from, time); i > 0; i--) this.padPress(button, false);
    }
  };

  constructor(private readonly scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard;
    this.keyboard?.on('keydown', this.onKeyDown);
    this.keyboard?.on('keyup', this.onKeyUp);
    scene.input.on?.('pointerdown', this.onPointer);
    scene.events.on?.('update', this.poll);
    window.addEventListener('blur', this.onBlur);
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Calls the listener each time the action is pressed. */
  on(action: InputAction, listener: Listener): this {
    this.listeners.set(action, [...(this.listeners.get(action) ?? []), listener]);
    return this;
  }

  /** Calls the listener when the action's key or button comes back up after a press. */
  onRelease(action: InputAction, listener: Listener): this {
    this.releaseListeners.set(action, [...(this.releaseListeners.get(action) ?? []), listener]);
    return this;
  }

  /** True while a key or button for the action is held down. */
  isHeld(action: InputAction): boolean {
    return this.held.has(action);
  }

  /** Sends every action to `handler` instead of the screen, until called again with null. */
  capture(handler: ((action: InputAction) => void) | null): void {
    this.captor = handler;
    if (handler) for (const action of [...this.held]) this.release(action);
  }

  /** True while View has the screen's buttons in focus. */
  get choosingButton(): boolean {
    return this.bar !== null;
  }

  /** A controller button went down (or repeated): it means the first of its actions this screen uses. */
  private padPress(button: PadButton, fresh: boolean): void {
    const actions = GAMEPAD_BINDINGS[button];
    // Captured, or among the buttons: the button's first meaning (A is "confirm", not a card slot).
    const action =
      this.captor || this.bar
        ? actions[0]
        : (actions.find((a) => (this.listeners.get(a)?.length ?? 0) > 0 || this.releaseListeners.has(a)) ??
          (actions.includes('menu') ? 'menu' : actions[0]));
    if (!action) return;
    if (fresh && !this.captor && !this.bar) {
      this.held.add(action);
      this.padAction.set(button, action);
    }
    this.dispatch(action);
  }

  private padRelease(button: PadButton): void {
    this.padSince.delete(button);
    const action = this.padAction.get(button);
    this.padAction.delete(button);
    if (action) this.release(action);
  }

  private dispatch(action: InputAction): void {
    if (this.captor) {
      this.captor(action);
      return;
    }
    if (this.bar) {
      this.barAction(action);
      return;
    }
    if (action === 'menu') {
      this.openBar();
      return;
    }
    const listeners = this.listeners.get(action) ?? [];
    // Moving, choosing and going back click softly, on the keys the screen listens to.
    const sound = listeners.length > 0 ? menuSound(action) : null;
    if (sound) playSound(sound);
    for (const listener of listeners) listener();
  }

  /** View: the screen's buttons, in reading order, the first one in focus. */
  private openBar(): void {
    const buttons = sceneButtons(this.scene);
    if (buttons.length === 0) return;
    for (const action of [...this.held]) this.release(action);
    this.bar = { buttons, index: 0 };
    playSound('uiMove');
    this.focusBar();
  }

  private barAction(action: InputAction): void {
    const bar = this.bar!;
    const step = action === 'left' || action === 'up' || action === 'prev' ? -1 : action === 'right' || action === 'down' || action === 'next' ? 1 : 0;
    if (step !== 0) {
      bar.index = (bar.index + step + bar.buttons.length) % bar.buttons.length;
      playSound('uiMove');
      this.focusBar();
    } else if (action === 'confirm') {
      const button = bar.buttons[bar.index];
      this.closeBar();
      button?.press();
    } else if (action === 'back' || action === 'menu') {
      playSound('uiBack');
      this.closeBar();
    }
  }

  private focusBar(): void {
    this.bar?.buttons.forEach((b, i) => b.setFocused(i === this.bar!.index));
  }

  private closeBar(): void {
    this.bar?.buttons.forEach((b) => b.setFocused(false));
    this.bar = null;
  }

  private release(action: InputAction): void {
    if (!this.held.delete(action)) return;
    for (const listener of this.releaseListeners.get(action) ?? []) listener();
  }

  destroy(): void {
    this.keyboard?.off('keydown', this.onKeyDown);
    this.keyboard?.off('keyup', this.onKeyUp);
    this.scene.input?.off?.('pointerdown', this.onPointer);
    this.scene.events.off?.('update', this.poll);
    window.removeEventListener('blur', this.onBlur);
    this.listeners.clear();
    this.releaseListeners.clear();
    this.held.clear();
    this.captor = null;
    this.bar = null;
  }
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
