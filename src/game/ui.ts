// Small UI pieces: text styles and buttons.

import type Phaser from 'phaser';
import { FONT, TEXT } from './theme';

export function textStyle(size: number, color: string = TEXT.body, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' };
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setHighlighted(on: boolean): void;
}

/** A clickable button. Every button's action also has a key, shown in its label. */
export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 120,
  height = 30,
): Button {
  const box = scene.add.rectangle(0, 0, width, height, 0x2b3a50).setStrokeStyle(1, 0x50627c);
  const text = scene.add.text(0, 0, label, textStyle(13)).setOrigin(0.5);
  const container = scene.add.container(x, y, [box, text]);
  let highlighted = false;
  const paint = (hover: boolean) => {
    box.setFillStyle(highlighted ? 0x3d6ea8 : hover ? 0x34475f : 0x2b3a50);
  };
  box.setInteractive({ useHandCursor: true });
  box.on('pointerover', () => paint(true));
  box.on('pointerout', () => paint(false));
  box.on('pointerdown', onClick);
  return {
    container,
    setHighlighted(on: boolean) {
      highlighted = on;
      paint(false);
    },
  };
}
