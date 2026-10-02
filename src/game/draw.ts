// Drawing the battlefield with plain shapes: the field, walls and troops.
// Vanguards are squares, Rangers triangles and Guardians circles; blue is you, red the enemy.

import type Phaser from 'phaser';
import type { MapData, Rect } from '../data/maps';
import type { UnitClass } from '../data/units';
import type { Side } from '../sim';
import { COLORS } from './theme';

type Graphics = Phaser.GameObjects.Graphics;

export function drawField(g: Graphics, map: MapData): void {
  g.fillStyle(COLORS.field, 1).fillRect(0, 0, map.width, map.height);
  g.lineStyle(1, COLORS.fieldLine, 1);
  for (let x = 60; x < map.width; x += 60) g.lineBetween(x, 0, x, map.height);
  for (let y = 60; y < map.height; y += 60) g.lineBetween(0, y, map.width, y);
  g.lineStyle(2, COLORS.fieldLine, 1).lineBetween(map.width / 2, 0, map.width / 2, map.height);
}

/** A deploy zone: a tinted area with an outline. */
export function drawZone(g: Graphics, zone: Rect, side: Side, strength: number): void {
  g.fillStyle(COLORS.side[side], 0.1 * strength).fillRect(zone.x, zone.y, zone.w, zone.h);
  g.lineStyle(2, COLORS.side[side], 0.45 * strength).strokeRect(zone.x, zone.y, zone.w, zone.h);
}

/** A wall, cracked as it loses HP; a broken wall is left as rubble. */
export function drawWall(g: Graphics, wall: Rect & { hp?: number; maxHp?: number }): void {
  const share = wall.hp !== undefined && wall.maxHp ? wall.hp / wall.maxHp : 1;
  if (share <= 0) {
    g.fillStyle(COLORS.wallEdge, 0.5);
    const size = Math.min(wall.w, wall.h) / 3;
    for (let i = 0; i < 5; i++) {
      const fx = ((i * 37) % 100) / 100;
      const fy = ((i * 61 + 13) % 100) / 100;
      g.fillRect(wall.x + fx * (wall.w - size), wall.y + fy * (wall.h - size), size, size * 0.7);
    }
    return;
  }
  g.fillStyle(COLORS.wall, 1).fillRect(wall.x, wall.y, wall.w, wall.h);
  g.lineStyle(2, COLORS.wallEdge, 1).strokeRect(wall.x, wall.y, wall.w, wall.h);
  if (share < 1) {
    // More cracks as the wall wears down.
    g.lineStyle(2, COLORS.crack, 1);
    const cracks = share < 0.33 ? 3 : share < 0.66 ? 2 : 1;
    for (let i = 0; i < cracks; i++) {
      const t = (i + 1) / (cracks + 1);
      g.lineBetween(wall.x + wall.w * t, wall.y + 2, wall.x + wall.w * (1 - t), wall.y + wall.h - 2);
    }
    drawBar(g, wall.x + wall.w / 2, wall.y - 6, Math.max(wall.w, 24), share);
  }
}

export interface BodyStyle {
  alpha?: number;
  /** 0 to 1: how much the body flashes white after a hit. */
  flash?: number;
}

/** A troop's body. Rangers point toward (faceX, faceY). */
export function drawBody(
  g: Graphics,
  cls: UnitClass,
  side: Side,
  x: number,
  y: number,
  r: number,
  faceX: number,
  faceY: number,
  style: BodyStyle = {},
): void {
  const alpha = style.alpha ?? 1;
  const fill = (color: number, a: number) => g.fillStyle(color, a * alpha);
  const outline = () => g.lineStyle(2, COLORS.sideDark[side], alpha);
  const paint = (color: number, a: number) => {
    fill(color, a);
    outline();
    if (cls === 'vanguard') {
      g.fillRoundedRect(x - r, y - r, r * 2, r * 2, 3).strokeRoundedRect(x - r, y - r, r * 2, r * 2, 3);
    } else if (cls === 'ranger') {
      const len = Math.hypot(faceX - x, faceY - y) || 1;
      const dx = (faceX - x) / len;
      const dy = (faceY - y) / len;
      const tip = { x: x + dx * r * 1.3, y: y + dy * r * 1.3 };
      const left = { x: x - dx * r * 0.8 - dy * r, y: y - dy * r * 0.8 + dx * r };
      const right = { x: x - dx * r * 0.8 + dy * r, y: y - dy * r * 0.8 - dx * r };
      g.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
      g.strokeTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
    } else {
      g.fillCircle(x, y, r).strokeCircle(x, y, r);
    }
  };
  paint(COLORS.side[side], 1);
  if (cls === 'guardian') {
    g.lineStyle(2, COLORS.sideDark[side], alpha);
    g.lineBetween(x - r * 0.5, y, x + r * 0.5, y).lineBetween(x, y - r * 0.5, x, y + r * 0.5);
  }
  if (style.flash && style.flash > 0) paint(0xffffff, style.flash * 0.8);
}

/** A small bar centered on x, filled to `share` (0 to 1), green to red. */
export function drawBar(g: Graphics, x: number, y: number, width: number, share: number): void {
  const color = share > 0.6 ? COLORS.hpGood : share > 0.3 ? COLORS.hpMid : COLORS.hpLow;
  g.fillStyle(COLORS.hpBack, 0.9).fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
  g.fillStyle(color, 1).fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, share)), 3);
}

/** A Barrier: a glowing ring, thicker while it has more left. */
export function drawBarrier(g: Graphics, x: number, y: number, r: number, share: number): void {
  g.lineStyle(1 + 3 * share, COLORS.barrier, 0.85).strokeCircle(x, y, r + 5);
}

/** Chased (Feigned Retreat): a broken violet ring, slowed and taking more damage. */
export function drawChased(g: Graphics, x: number, y: number, r: number): void {
  g.lineStyle(2, COLORS.chased, 0.9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath().arc(x, y, r + 7, a, a + Math.PI / 6).strokePath();
  }
}

/** Stunned (Hammer and Anvil): three small stars circling over the head. */
export function drawStun(g: Graphics, x: number, y: number, r: number, time: number): void {
  g.fillStyle(COLORS.stun, 1);
  for (let i = 0; i < 3; i++) {
    const a = time / 180 + (i * Math.PI * 2) / 3;
    g.fillCircle(x + Math.cos(a) * (r * 0.7), y - r - 6 + Math.sin(a) * 3, 2.5);
  }
}

/** A Mark: a yellow crosshair around the target. */
export function drawMark(g: Graphics, x: number, y: number, r: number): void {
  const inner = r + 4;
  const outer = r + 10;
  g.lineStyle(2, COLORS.mark, 0.95);
  g.lineBetween(x - outer, y, x - inner, y).lineBetween(x + inner, y, x + outer, y);
  g.lineBetween(x, y - outer, x, y - inner).lineBetween(x, y + inner, x, y + outer);
}
