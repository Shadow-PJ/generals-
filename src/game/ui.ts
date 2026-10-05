// Small UI pieces: text styles and buttons.

import type Phaser from 'phaser';
import { playSound } from './audio/audio';
import { currentRenderScale } from './display';
import { FONT, TEXT } from './theme';

export function textStyle(size: number, color: string = TEXT.body, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? 'bold' : 'normal',
    // Drawn at the render scale so text stays sharp when the camera zooms in.
    resolution: currentRenderScale(),
  };
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setHighlighted(on: boolean): void;
}

/** Button colors: resting, under the mouse, and highlighted (the choice that is on). */
const BUTTON = {
  fill: 0x2b3a50,
  hover: 0x34475f,
  on: 0x3d6ea8,
  edge: 0x50627c,
  hoverEdge: 0x7189ab,
  onEdge: 0x8fc0f5,
  radius: 6,
};

/**
 * A clickable button: rounded, with a soft shadow and a sheen on its top half; it lights up
 * under the mouse and dips when pressed. Every button's action also has a key, shown in its label.
 */
export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 120,
  height = 30,
): Button {
  const g = scene.add.graphics();
  const text = scene.add.text(0, 0, label, textStyle(13)).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, width, height, 0, 0).setInteractive({ useHandCursor: true });
  const container = scene.add.container(x, y, [g, text, hit]);
  let highlighted = false;
  let hover = false;
  const left = -width / 2;
  const top = -height / 2;
  const paint = () => {
    const fill = highlighted ? BUTTON.on : hover ? BUTTON.hover : BUTTON.fill;
    const edge = highlighted ? BUTTON.onEdge : hover ? BUTTON.hoverEdge : BUTTON.edge;
    g.clear();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(left + 1, top + 3, width, height, BUTTON.radius);
    g.fillStyle(fill, 1).fillRoundedRect(left, top, width, height, BUTTON.radius);
    g.fillStyle(0xffffff, highlighted || hover ? 0.1 : 0.06).fillRoundedRect(left + 2, top + 2, width - 4, height / 2 - 2, {
      tl: BUTTON.radius - 1,
      tr: BUTTON.radius - 1,
      bl: 0,
      br: 0,
    });
    g.lineStyle(1, edge, 1).strokeRoundedRect(left, top, width, height, BUTTON.radius);
  };
  paint();
  hit.on('pointerover', () => {
    hover = true;
    paint();
  });
  hit.on('pointerout', () => {
    hover = false;
    paint();
  });
  hit.on('pointerdown', () => {
    playSound('uiConfirm');
    scene.tweens.add({ targets: container, scale: 0.95, duration: 60, yoyo: true });
    onClick();
  });
  return {
    container,
    setHighlighted(on: boolean) {
      if (on === highlighted) return;
      highlighted = on;
      paint();
    },
  };
}
