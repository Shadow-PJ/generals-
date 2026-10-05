// Small UI pieces: text styles, screen titles, framed boxes, buttons and help lines.

import type Phaser from 'phaser';
import { UI_PIXEL, type FrameStyleId } from './art/frames';
import { frameTexture } from './art/textures';
import { playSound } from './audio/audio';
import { registerButton } from './buttons';
import { currentRenderScale } from './display';
import { deviceHint, deviceLabel } from './hints';
import { onDeviceChange } from './inputDevice';
import { COLORS, DISPLAY_FONT, FONT, readableSize, TEXT, TEXT_SHADOW, titleCase } from './theme';

export { titleCase };

/** Text in the reading font, with a dark drop shadow so it reads on any art. */
export function textStyle(size: number, color: string = TEXT.body, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  const px = readableSize(size);
  return {
    fontFamily: FONT,
    fontSize: `${px}px`,
    color,
    fontStyle: bold ? 'bold' : 'normal',
    shadow: { offsetX: 0, offsetY: px >= 18 ? 2 : 1, color: TEXT_SHADOW, blur: 0, fill: true },
    // Drawn at the render scale so text stays sharp when the camera zooms in.
    resolution: currentRenderScale(),
  };
}

/**
 * Titles and banners in the display font, outlined and shadowed. The font's pixels line up at
 * multiples of 12, so sizes are rounded to those.
 */
export function displayStyle(size: number, color: string = TEXT.title): Phaser.Types.GameObjects.Text.TextStyle {
  const px = Math.max(24, Math.round(size / 12) * 12);
  const edge = Math.max(3, Math.round(px / 8));
  return {
    fontFamily: DISPLAY_FONT,
    fontSize: `${px}px`,
    color,
    stroke: TEXT_SHADOW,
    strokeThickness: edge,
    shadow: { offsetX: 0, offsetY: Math.round(edge * 0.75), color: TEXT_SHADOW, blur: 0, stroke: true, fill: true },
    resolution: currentRenderScale(),
  };
}

/**
 * Changes a text's color only when it is a new one: Phaser redraws a text whenever its style is
 * set, and the battle sets colors every frame.
 */
export function recolor(text: Phaser.GameObjects.Text, color: string): Phaser.GameObjects.Text {
  return text.style.color === color ? text : text.setColor(color);
}

/** A screen's title in its top-left corner. */
export function addTitle(scene: Phaser.Scene, title: string): Phaser.GameObjects.Text {
  return scene.add.text(14, 2, titleCase(title), displayStyle(24, TEXT.title));
}

/**
 * A pixel-art box `w × h` world units big, its top-left corner at (x, y): a panel, a list row,
 * a card or a well. It is an image, so it takes clicks like any other object.
 */
export function addFrame(scene: Phaser.Scene, x: number, y: number, w: number, h: number, style: FrameStyleId): Phaser.GameObjects.Image {
  return scene.add.image(x, y, frameTexture(scene, style, w, h)).setOrigin(0).setScale(UI_PIXEL).setData('frameSize', { w, h });
}

/** A label on a small dark plate, centered on (x, y): names on maps, over busy art. */
export function addPlate(scene: Phaser.Scene, x: number, y: number, label: string, style: Phaser.Types.GameObjects.Text.TextStyle): [Phaser.GameObjects.Image, Phaser.GameObjects.Text] {
  const text = scene.add.text(x, y, label, style).setOrigin(0.5);
  const plate = addFrame(scene, x - text.width / 2 - 7, y - text.height / 2 - 3, text.width + 14, text.height + 6, 'plain');
  // The text was made first, to measure it: bring it back over its plate.
  text.setDepth(plate.depth);
  scene.children.bringToTop(text);
  return [plate, text];
}

/** Gives a box from addFrame another style, at the same size (a row coming into focus). */
export function restyleFrame(box: Phaser.GameObjects.Image, style: FrameStyleId): void {
  const size = box.getData('frameSize') as { w: number; h: number };
  box.setTexture(frameTexture(box.scene, style, size.w, size.h));
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

/** How far the face of a button sits above its middle: the lip takes the bottom pixels. */
const BUTTON_FACE_LIFT = UI_PIXEL;

/**
 * A clickable button: a pixel-art face standing on a dark lip, lighter under the mouse and gold
 * when it is the choice that is on; it dips when pressed. Every button's action also has a key,
 * shown in its label ("Orders  ⏎"); with a controller the label shows its button instead, and
 * View reaches every button on the screen, which then wears gold corner marks.
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
  const face = scene.add.image(0, 0, frameTexture(scene, 'button', width, height)).setScale(UI_PIXEL);
  const text = scene.add.text(0, -BUTTON_FACE_LIFT, deviceLabel(label), textStyle(13, TEXT.title)).setOrigin(0.5);
  const ring = scene.add.graphics();
  const hit = scene.add.rectangle(0, 0, width, height, 0, 0).setInteractive({ useHandCursor: true });
  const container = scene.add.container(x, y, [ring, face, text, hit]);
  let highlighted = false;
  let hover = false;
  let focused = false;
  const paint = () => {
    const style: FrameStyleId = highlighted ? 'buttonOn' : hover || focused ? 'buttonHover' : 'button';
    face.setTexture(frameTexture(scene, style, width, height));
    ring.clear();
    // In focus from a controller: gold corner marks just outside.
    if (focused) drawCornerMarks(ring, -width / 2 - 5, -height / 2 - 5, width + 10, height + 10);
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

/** Gold corner marks around a box: what the controller has in focus. */
export function drawCornerMarks(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number = COLORS.glow): void {
  const arm = Math.min(10, w / 3, h / 3);
  const t = UI_PIXEL;
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ] as const;
  for (const [cx, cy, sx, sy] of corners) {
    // A dark edge first, then the gold on it.
    g.fillStyle(0x0e0b12, 1);
    g.fillRect(sx > 0 ? cx - t : cx - arm - t, sy > 0 ? cy - t : cy - 2 * t, arm + 2 * t, 3 * t);
    g.fillRect(sx > 0 ? cx - t : cx - 2 * t, sy > 0 ? cy - t : cy - arm - t, 3 * t, arm + 2 * t);
    g.fillStyle(color, 1);
    g.fillRect(sx > 0 ? cx : cx - arm, sy > 0 ? cy : cy - t, arm, t);
    g.fillRect(sx > 0 ? cx : cx - t, sy > 0 ? cy : cy - arm, t, arm);
  }
}
