// Small UI pieces: text styles, buttons and help lines.

import type Phaser from 'phaser';
import { playSound } from './audio/audio';
import { registerButton } from './buttons';
import { currentRenderScale } from './display';
import { deviceHint, deviceLabel } from './hints';
import { onDeviceChange } from './inputDevice';
import { COLORS, FONT, readableSize, TEXT } from './theme';

export function textStyle(size: number, color: string = TEXT.body, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${readableSize(size)}px`,
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

/** Runs `stop` when the object is destroyed (the screen closes or redraws). */
function untilDestroyed(object: Phaser.GameObjects.GameObject, stop: () => void): void {
  object.once('destroy', stop);
}

/**
 * A help line in the words for the device in hand, switching when the player picks up a
 * controller or goes back to the keyboard.
 */
export function addHint(scene: Phaser.Scene, x: number, y: number, keyboard: string, gamepad: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, deviceHint(keyboard, gamepad), style);
  untilDestroyed(text, onDeviceChange((device) => text.setText(deviceHint(keyboard, gamepad, device))));
  return text;
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
 * under the mouse and dips when pressed. Every button's action also has a key, shown in its
 * label ("Orders  ⏎"); with a controller the label shows its button instead, and View reaches
 * every button on the screen, which then wears a gold focus ring.
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
  const text = scene.add.text(0, 0, deviceLabel(label), textStyle(13)).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, width, height, 0, 0).setInteractive({ useHandCursor: true });
  const container = scene.add.container(x, y, [g, text, hit]);
  let highlighted = false;
  let hover = false;
  let focused = false;
  const left = -width / 2;
  const top = -height / 2;
  const paint = () => {
    const fill = highlighted ? BUTTON.on : hover || focused ? BUTTON.hover : BUTTON.fill;
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
    // In focus from a controller: a gold ring just outside.
    if (focused) g.lineStyle(3, COLORS.glow, 1).strokeRoundedRect(left - 4, top - 4, width + 8, height + 8, BUTTON.radius + 3);
  };
  paint();
  const press = () => {
    playSound('uiConfirm');
    scene.tweens.add({ targets: container, scale: 0.95, duration: 60, yoyo: true });
    onClick();
  };
  hit.on('pointerover', () => {
    hover = true;
    paint();
  });
  hit.on('pointerout', () => {
    hover = false;
    paint();
  });
  hit.on('pointerdown', press);
  untilDestroyed(container, onDeviceChange((device) => text.setText(deviceLabel(label, device))));
  untilDestroyed(
    container,
    registerButton(scene, {
      get x() {
        return container.parentContainer ? container.parentContainer.x + container.x : container.x;
      },
      get y() {
        return container.parentContainer ? container.parentContainer.y + container.y : container.y;
      },
      usable: () => container.active && container.visible && (!container.parentContainer || container.parentContainer.visible),
      press,
      setFocused(on: boolean) {
        focused = on;
        paint();
      },
    }),
  );
  return {
    container,
    setHighlighted(on: boolean) {
      if (on === highlighted) return;
      highlighted = on;
      paint();
    },
  };
}
