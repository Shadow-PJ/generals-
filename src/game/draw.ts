// Drawing the battlefield with plain shapes: the field, walls, troops and Rifts.
// Vanguards are squares, Rangers triangles, Guardians circles with a cross, Invokers diamonds
// and Assassins darts; blue is you, red the enemy.

import type Phaser from 'phaser';
import type { MapData, Rect } from '../data/maps';
import type { UnitClass } from '../data/units';
import type { Side, Zone } from '../sim';
import { COLORS } from './theme';

type Graphics = Phaser.GameObjects.Graphics;

/** The ground: a grid, the middle line, and the map's forests (dark green, with a few trees drawn as dots). */
export function drawField(g: Graphics, map: MapData): void {
  g.fillStyle(map.rangedReachBonus ? COLORS.plains : COLORS.field, 1).fillRect(0, 0, map.width, map.height);
  g.lineStyle(1, COLORS.fieldLine, 1);
  for (let x = 60; x < map.width; x += 60) g.lineBetween(x, 0, x, map.height);
  for (let y = 60; y < map.height; y += 60) g.lineBetween(0, y, map.width, y);
  g.lineStyle(2, COLORS.fieldLine, 1).lineBetween(map.width / 2, 0, map.width / 2, map.height);
  for (const f of map.forests ?? []) {
    g.fillStyle(COLORS.forest, 0.55).fillRect(f.x, f.y, f.w, f.h);
    g.fillStyle(COLORS.tree, 0.8);
    for (let x = f.x + 12; x < f.x + f.w - 6; x += 26) {
      for (let y = f.y + 12 + ((x - f.x) % 52 === 12 ? 0 : 13); y < f.y + f.h - 6; y += 26) g.fillCircle(x, y, 5);
    }
  }
}

/** A deploy zone: a tinted area with an outline. */
export function drawZone(g: Graphics, zone: Rect, side: Side, strength: number): void {
  g.fillStyle(COLORS.side[side], 0.1 * strength).fillRect(zone.x, zone.y, zone.w, zone.h);
  g.lineStyle(2, COLORS.side[side], 0.45 * strength).strokeRect(zone.x, zone.y, zone.w, zone.h);
}

/** A wall, cracked as it loses HP; a broken wall is left as rubble. Unbreakable walls are dark and never crack. */
export function drawWall(g: Graphics, wall: Rect & { hp?: number; maxHp?: number; unbreakable?: boolean; ticksLeft?: number | null }): void {
  // A Fortify wall: gone without rubble when it falls, and in its own color while it stands.
  const raised = wall.ticksLeft !== undefined && wall.ticksLeft !== null;
  if (raised && (wall.hp ?? 1) <= 0) return;
  if (wall.unbreakable) {
    g.fillStyle(COLORS.rock, 1).fillRect(wall.x, wall.y, wall.w, wall.h);
    g.lineStyle(2, COLORS.rockEdge, 1).strokeRect(wall.x, wall.y, wall.w, wall.h);
    return;
  }
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
  g.fillStyle(raised ? COLORS.fortify : COLORS.wall, 1).fillRect(wall.x, wall.y, wall.w, wall.h);
  g.lineStyle(2, raised ? COLORS.fortifyEdge : COLORS.wallEdge, 1).strokeRect(wall.x, wall.y, wall.w, wall.h);
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

/** The class legend shown on the Prep screen, with the shape each class is drawn as. */
export const CLASS_LEGEND = '■ Vanguard   ▲ Ranger   ⊕ Guardian   ◆ Invoker   ➤ Assassin';

/** A troop's body. Rangers and Assassins point toward (faceX, faceY). */
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
    const len = Math.hypot(faceX - x, faceY - y) || 1;
    const dx = (faceX - x) / len;
    const dy = (faceY - y) / len;
    if (cls === 'vanguard') {
      g.fillRoundedRect(x - r, y - r, r * 2, r * 2, 3).strokeRoundedRect(x - r, y - r, r * 2, r * 2, 3);
    } else if (cls === 'invoker') {
      const d = r * 1.25;
      polygon(g, [
        { x, y: y - d },
        { x: x + d, y },
        { x, y: y + d },
        { x: x - d, y },
      ]);
    } else if (cls === 'assassin') {
      // A dart: a long tip toward the target and a notch at the back.
      const tip = { x: x + dx * r * 1.5, y: y + dy * r * 1.5 };
      const left = { x: x - dx * r - dy * r, y: y - dy * r + dx * r };
      const notch = { x: x - dx * r * 0.3, y: y - dy * r * 0.3 };
      const right = { x: x - dx * r + dy * r, y: y - dy * r - dx * r };
      polygon(g, [tip, left, notch, right]);
    } else if (cls === 'ranger') {
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
  } else if (cls === 'invoker') {
    g.fillStyle(COLORS.sideDark[side], alpha).fillCircle(x, y, r * 0.3);
  }
  if (style.flash && style.flash > 0) paint(0xffffff, style.flash * 0.8);
}

/** Fills a shape whose corners all see the first one (a fan of triangles), then outlines it. */
function polygon(g: Graphics, points: readonly { x: number; y: number }[]): void {
  const [first] = points;
  if (!first) return;
  for (let i = 1; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    g.fillTriangle(first.x, first.y, a.x, a.y, b.x, b.y);
  }
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length]!;
    g.lineBetween(p.x, p.y, next.x, next.y);
  });
}

/** A small bar centered on x, filled to `share` (0 to 1), green to red. */
export function drawBar(g: Graphics, x: number, y: number, width: number, share: number): void {
  const color = share > 0.6 ? COLORS.hpGood : share > 0.3 ? COLORS.hpMid : COLORS.hpLow;
  g.fillStyle(COLORS.hpBack, 0.9).fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
  g.fillStyle(color, 1).fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, share)), 3);
}

/** A Barrier: a glowing ring, thicker while it has more left. */
export function drawBarrier(g: Graphics, x: number, y: number, r: number, share: number): void {
  g.lineStyle(1 + 3 * Math.min(1.5, share), COLORS.barrier, 0.85).strokeCircle(x, y, r + 5);
}

/** A Rift on the ground, in its element's color, fading as it runs out; it flares on each pulse. */
export function drawRift(g: Graphics, zone: Zone, share: number, flare: number): void {
  const color = COLORS.rift[zone.element];
  g.fillStyle(color, 0.12 + 0.12 * share + 0.15 * flare).fillCircle(zone.x, zone.y, zone.radius);
  g.lineStyle(2, color, 0.5 + 0.4 * share).strokeCircle(zone.x, zone.y, zone.radius);
  g.lineStyle(1, COLORS.side[zone.side], 0.6).strokeCircle(zone.x, zone.y, zone.radius - 4);
}

/** An Invoker casting: a ring that closes as the cast nears its end, and a line to where the Rift will open. */
export function drawCasting(g: Graphics, x: number, y: number, r: number, at: { x: number; y: number }, progress: number): void {
  g.lineStyle(1, COLORS.rift.arcane, 0.5).lineBetween(x, y, at.x, at.y);
  g.lineStyle(1, COLORS.rift.arcane, 0.5).strokeCircle(at.x, at.y, 8);
  g.lineStyle(3, COLORS.rift.arcane, 0.95);
  g.beginPath().arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2).strokePath();
}

/** Silenced (Saboteur): a slashed circle over the head. */
export function drawSilenced(g: Graphics, x: number, y: number, r: number): void {
  const cy = y - r - 16;
  g.lineStyle(2, COLORS.silenced, 0.95).strokeCircle(x + r + 4, cy, 5).lineBetween(x + r, cy + 4, x + r + 8, cy - 4);
}

/** Slowed (frost): a pale blue ring at the feet. */
export function drawSlowed(g: Graphics, x: number, y: number, r: number): void {
  g.lineStyle(2, COLORS.rift.frost, 0.85).strokeEllipse(x, y + r * 0.6, r * 2.4, r * 0.9);
}

/** Taunted (Warden, Iron Wall): a red line to the troop it must attack. */
export function drawTaunted(g: Graphics, x: number, y: number, to: { x: number; y: number }): void {
  g.lineStyle(1, COLORS.taunt, 0.55).lineBetween(x, y, to.x, to.y);
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

/** The Generals' effects on a troop: an elite (gold double ring), a wraith (violet haze), Vampiric Link (red ring), Assimilation (shell or claws). */
export function drawGeneralEffects(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  unit: { elite: boolean; wraithTicks: number; haste: unknown; adaptation: { kind: 'shell' | 'claws' } | null },
): void {
  if (unit.wraithTicks > 0) g.fillStyle(COLORS.wraith, 0.3).fillCircle(x, y, r + 8);
  if (unit.elite) g.lineStyle(2, COLORS.elite, 0.95).strokeCircle(x, y, r + 4).strokeCircle(x, y, r + 7);
  if (unit.haste) g.lineStyle(2, COLORS.haste, 0.9).strokeCircle(x, y, r + 11);
  if (unit.adaptation?.kind === 'shell') g.lineStyle(4, COLORS.shell, 0.8).strokeCircle(x, y, r + 2);
  if (unit.adaptation?.kind === 'claws') {
    g.lineStyle(2, COLORS.claws, 0.95);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.lineBetween(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6));
    }
  }
}

/** Vibration stacks (Echo Strike) as small dots over the troop; a shattered troop gets a broken ring. */
export function drawVibration(g: Graphics, x: number, y: number, r: number, stacks: number, shattered: boolean): void {
  g.fillStyle(COLORS.vibration, 1);
  for (let i = 0; i < stacks; i++) g.fillCircle(x - 6 + i * 6, y - r - 16, 2);
  if (shattered) {
    g.lineStyle(2, COLORS.vibration, 0.8);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      g.beginPath().arc(x, y, r + 6, a, a + Math.PI / 4).strokePath();
    }
  }
}

/** Heat (Venting) as small orange marks under the troop: one per attack since it last vented. */
export function drawHeat(g: Graphics, x: number, y: number, r: number, heat: number): void {
  g.fillStyle(COLORS.heat, 0.9);
  for (let i = 0; i < heat; i++) g.fillRect(x - 9 + i * 5, y + r + 9, 3, 3);
}

/** Thermal Detonation's beam, fading over `share` (1 to 0). */
export function drawBeam(g: Graphics, from: { x: number; y: number }, to: { x: number; y: number }, share: number): void {
  g.lineStyle(18 * share + 4, COLORS.beam, 0.25 * share).lineBetween(from.x, from.y, to.x, to.y);
  g.lineStyle(4, COLORS.beam, 0.9 * share).lineBetween(from.x, from.y, to.x, to.y);
}

/** Gravity Well: a dark swirl at the point, shrinking as `share` goes from 1 to 0. */
export function drawGravityWell(g: Graphics, at: { x: number; y: number }, share: number, time: number): void {
  g.fillStyle(COLORS.gravityWell, 0.25 * share).fillCircle(at.x, at.y, 60 * share + 10);
  g.lineStyle(2, COLORS.gravityWell, 0.9 * share);
  for (let i = 0; i < 3; i++) {
    const a = time / 150 + (i * Math.PI * 2) / 3;
    g.beginPath().arc(at.x, at.y, 20 + 30 * share, a, a + Math.PI / 2).strokePath();
  }
}
