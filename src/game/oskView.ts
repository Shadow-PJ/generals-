// The on-screen keyboard on the Orders screen (session 6C): for typing an order with a
// controller. While it is open it takes every action from the screen's input layer: the D-pad
// or stick moves over the keys, A types, X deletes, Y adds a space, Menu reads the order and B
// closes it, keeping the words. Keys and suggested words can be clicked too. The layout and
// what each key does are in osk.ts.

import type Phaser from 'phaser';
import type { InputAction } from './bindings';
import type { InputLayer } from './InputLayer';
import { onDeviceChange } from './inputDevice';
import { applySuggestion, moveCursor, OSK_ROWS, pressKey, suggestions, type OskCursor, type OskKey } from './osk';
import { COLORS, GAME_WIDTH, TEXT } from './theme';
import { textStyle } from './ui';
import { playSound } from './audio/audio';

const PANEL_W = 690;
const PANEL_H = 404;
const KEY_W = 56;
const KEY_H = 38;
const GAP = 6;

export interface OskClose {
  text: string;
  /** The player asked to read the order now. */
  read: boolean;
  /** Closed because the player went back to the keyboard: carry on in the text box. */
  toKeyboard: boolean;
}

export class OnScreenKeyboard {
  private panel: Phaser.GameObjects.Container | null = null;
  private text = '';
  private cursor: OskCursor = { row: 1, col: 0 };
  private stopWatching: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly input: InputLayer,
    private readonly top: number,
    private readonly onClose: (close: OskClose) => void,
  ) {
    // Leaving the screen just lets go: there is no order box to fill any more.
    scene.events.once('shutdown', () => {
      this.active = false;
      this.panel = null;
      this.stopWatching?.();
      this.input.capture(null);
    });
  }

  /** Open from `open` to `close`: a click that closed it (by switching to the mouse) can't type into it after. */
  private active = false;

  get isOpen(): boolean {
    return this.active;
  }

  open(text: string): void {
    if (this.active) return;
    this.active = true;
    this.text = text;
    this.cursor = { row: 1, col: 0 };
    this.input.capture((action) => this.handle(action));
    // Picking up the keyboard again closes this one and carries on in the text box.
    this.stopWatching = onDeviceChange((device) => device === 'keyboard' && this.close(false, true));
    this.render();
  }

  private handle(action: InputAction): void {
    if (!this.active) return;
    const words = suggestions(this.text);
    const move = (dx: number, dy: number) => {
      this.cursor = moveCursor(this.cursor, dx, dy, words.length);
      playSound('uiMove');
      this.render();
    };
    switch (action) {
      case 'up':
        return move(0, -1);
      case 'down':
        return move(0, 1);
      case 'left':
      case 'prev':
        return move(-1, 0);
      case 'right':
      case 'next':
        return move(1, 0);
      case 'confirm':
        return this.pressAtCursor();
      case 'clear':
        return this.type({ label: '', type: { special: 'delete' }, width: 1 });
      case 'slot2':
        return this.type({ label: '', type: { special: 'space' }, width: 1 });
      case 'start':
        return this.type({ label: '', type: { special: 'read' }, width: 1 });
      case 'back':
        return this.close(false, false);
      default:
        return;
    }
  }

  private pressAtCursor(): void {
    if (this.cursor.row === -1) {
      const word = suggestions(this.text)[this.cursor.col];
      if (word) this.useWord(word);
      return;
    }
    const key = OSK_ROWS[this.cursor.row]?.[this.cursor.col];
    if (key) this.type(key);
  }

  private useWord(word: string): void {
    if (!this.active) return;
    this.text = applySuggestion(this.text, word);
    playSound('uiConfirm');
    // Back on the letters, ready for the next word.
    this.cursor = { row: 1, col: 0 };
    this.render();
  }

  private type(key: OskKey): void {
    if (!this.active) return;
    const result = pressKey(this.text, key);
    this.text = result.text;
    playSound(result.close ? 'uiConfirm' : 'uiMove');
    if (result.close) {
      this.close(result.read ?? false, false);
      return;
    }
    // Suggestions change as the word grows: stay on the row if it still has words.
    const count = suggestions(this.text).length;
    if (this.cursor.row === -1 && count === 0) this.cursor = { row: 0, col: 0 };
    else if (this.cursor.row === -1) this.cursor = { row: -1, col: Math.min(this.cursor.col, count - 1) };
    this.render();
  }

  private close(read: boolean, toKeyboard: boolean): void {
    if (!this.active) return;
    this.active = false;
    this.panel?.destroy();
    this.panel = null;
    this.stopWatching?.();
    this.stopWatching = null;
    this.input.capture(null);
    this.onClose({ text: this.text, read, toKeyboard });
  }

  private render(): void {
    this.panel?.destroy();
    const scene = this.scene;
    const left = (GAME_WIDTH - PANEL_W) / 2;
    const items: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(item: T): T => {
      items.push(item);
      return item;
    };
    add(scene.add.rectangle(left, this.top, PANEL_W, PANEL_H, COLORS.background, 0.97).setOrigin(0).setStrokeStyle(2, COLORS.glow));
    add(scene.add.text(left + 16, this.top + 10, 'TYPE YOUR ORDER', textStyle(14, TEXT.title, true)));
    // The words so far, with a cursor at the end.
    add(scene.add.rectangle(left + 16, this.top + 34, PANEL_W - 32, 46, 0x0f141c).setOrigin(0).setStrokeStyle(1, COLORS.panelEdge));
    add(
      scene.add.text(left + 24, this.top + 40, `${this.text}▌`, {
        ...textStyle(14, TEXT.body),
        wordWrap: { width: PANEL_W - 48 },
        maxLines: 2,
      }),
    );

    // Suggested words: finishing the word being typed, or common first words.
    const words = suggestions(this.text);
    const wordY = this.top + 92;
    add(scene.add.text(left + 16, wordY + 6, 'Words', textStyle(11, TEXT.muted, true)));
    words.forEach((word, i) => {
      const x = left + 70 + i * 100;
      const on = this.cursor.row === -1 && this.cursor.col === i;
      const chip = add(scene.add.rectangle(x, wordY, 94, 28, on ? COLORS.rowSelected : COLORS.row).setOrigin(0).setStrokeStyle(on ? 2 : 1, on ? COLORS.glow : COLORS.rowEdge));
      chip.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.useWord(word));
      add(scene.add.text(x + 47, wordY + 14, word, textStyle(13, on ? TEXT.title : TEXT.body, on)).setOrigin(0.5));
    });

    // The keys.
    const keysTop = this.top + 132;
    OSK_ROWS.forEach((row, r) => {
      const rowWidth = row.reduce((sum, k) => sum + k.width, 0) * (KEY_W + GAP) - GAP;
      let x = (GAME_WIDTH - rowWidth) / 2;
      row.forEach((key, c) => {
        const w = key.width * (KEY_W + GAP) - GAP;
        const y = keysTop + r * (KEY_H + GAP);
        const on = this.cursor.row === r && this.cursor.col === c;
        const special = typeof key.type !== 'string';
        const box = add(
          scene.add
            .rectangle(x, y, w, KEY_H, on ? COLORS.rowSelected : special ? 0x22303f : COLORS.row)
            .setOrigin(0)
            .setStrokeStyle(on ? 3 : 1, on ? COLORS.glow : COLORS.rowEdge),
        );
        box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.cursor = { row: r, col: c };
          this.type(key);
        });
        add(scene.add.text(x + w / 2, y + KEY_H / 2, key.label, textStyle(special ? 13 : 16, on ? TEXT.title : TEXT.body, on || !special)).setOrigin(0.5));
        x += w + GAP;
      });
    });

    add(
      scene.add
        .text(GAME_WIDTH / 2, this.top + PANEL_H - 22, '✚ move   Ⓐ type   Ⓧ delete   Ⓨ space   Menu: read the order   Ⓑ done', textStyle(12, TEXT.muted))
        .setOrigin(0.5, 0),
    );
    // Over everything, the Captain's tips included: it takes every press while it is open.
    this.panel = scene.add.container(0, 0, items).setDepth(1100);
  }
}
