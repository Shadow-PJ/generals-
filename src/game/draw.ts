// Drawing on the battlefield with Graphics: walls, deploy zones, troops in the menus, and the
// rings, bars and marks that show what is happening to a troop. The ground and the troops in
// battle are pixel-art textures (src/game/art); troops on the menus are painted from the same art.

import type Phaser from 'phaser';
import type { Rect } from '../data/maps';
import type { Rarity } from '../data/rarity';
import { UNIT_CLASSES, type UnitClass } from '../data/units';
import type { Side, Zone } from '../sim';
import { paintCentered } from './art/paint';
import { BASE, FLASH, sidePalette } from './art/palette';
import { TROOP_ART, TROOP_ART_SCALE } from './art/troops';
import { COLORS } from './theme';

type Graphics = Phaser.GameObjects.Graphics;

/** A deploy zone: a tinted area with an outline. */
export function drawZone(g: Graphics, zone: Rect, side: Side, strength: number): void {
  g.fillStyle(COLORS.side[side], 0.1 * strength).fillRect(zone.x, zone.y, zone.w, zone.h);
  g.lineStyle(2, COLORS.side[side], 0.45 * strength).strokeRect(zone.x, zone.y, zone.w, zone.h);
}

/** How walls look: stone bricks; a Fortify wall is a wooden palisade; unbreakable ones are canyon rock or fortress iron. */
const WALL = {
  shadow: 0x000000,
  outline: BASE.k!,
  stone: 0xa9afba,
  stoneLight: 0xd3d8e0,
  stoneShade: 0x6f7684,
  joint: 0x7d8492,
  wood: BASE.w!,
  woodLight: 0xd09a5c,
  woodShade: BASE.W!,
  rock: 0x74503f,
  rockLight: 0x9a6f57,
  rockShade: 0x3f2a20,
  iron: 0x4d5463,
  ironLight: 0x7a8394,
  ironShade: 0x2d323c,
  rivet: 0x9aa3b3,
};

/** A wall, cracked as it loses HP; a broken wall is left as rubble. Unbreakable walls never crack. */
export function drawWall(g: Graphics, wall: Rect & { hp?: number; maxHp?: number; unbreakable?: boolean; ticksLeft?: number | null }, mapId = ''): void {
  // A Fortify wall: gone without rubble when it falls, and a palisade while it stands.
  const raised = wall.ticksLeft !== undefined && wall.ticksLeft !== null;
  if (raised && (wall.hp ?? 1) <= 0) return;
  const share = wall.hp !== undefined && wall.maxHp ? wall.hp / wall.maxHp : 1;
  if (share <= 0) {
    // Rubble: a few stones where it stood.
    for (let i = 0; i < 7; i++) {
      const fx = ((i * 37) % 100) / 100;
      const fy = ((i * 61 + 13) % 100) / 100;
      const size = Math.max(5, Math.min(wall.w, wall.h) / (3 + (i % 3)));
      const x = wall.x + fx * (wall.w - size);
      const y = wall.y + fy * (wall.h - size);
      g.fillStyle(WALL.stoneShade, 1).fillRect(x, y + 2, size, size * 0.7);
      g.fillStyle(WALL.stone, 1).fillRect(x, y, size, size * 0.6);
    }
    return;
  }
  // A shadow on the ground, then the wall, its lit top edge and its face in shade.
  g.fillStyle(WALL.shadow, 0.28).fillRect(wall.x + 4, wall.y + 5, wall.w, wall.h);
  if (wall.unbreakable && mapId === 'ironFortress') drawIron(g, wall);
  else if (wall.unbreakable) drawRock(g, wall);
  else if (raised) drawPalisade(g, wall);
  else drawBricks(g, wall);
  g.lineStyle(2, WALL.outline, 1).strokeRect(wall.x, wall.y, wall.w, wall.h);
  if (wall.unbreakable || share >= 1) return;
  // More cracks as the wall wears down.
  g.lineStyle(2, WALL.outline, 0.85);
  const cracks = share < 0.33 ? 3 : share < 0.66 ? 2 : 1;
  for (let i = 0; i < cracks; i++) {
    const t = (i + 1) / (cracks + 1);
    const midX = wall.x + wall.w * (0.5 + (t - 0.5) * 0.4);
    const midY = wall.y + wall.h * t;
    g.lineBetween(wall.x + wall.w * t, wall.y + 2, midX, midY).lineBetween(midX, midY, wall.x + wall.w * (1 - t), wall.y + wall.h - 2);
  }
  drawBar(g, wall.x + wall.w / 2, wall.y - 6, Math.max(wall.w, 24), share);
}

function drawBricks(g: Graphics, r: Rect): void {
  const course = 8;
  g.fillStyle(WALL.stone, 1).fillRect(r.x, r.y, r.w, r.h);
  g.lineStyle(1, WALL.joint, 1);
  for (let row = 0, y = r.y; y < r.y + r.h; row++, y += course) {
    if (row > 0) g.lineBetween(r.x, y, r.x + r.w, y);
    for (let x = r.x + (row % 2 === 0 ? 14 : 7); x < r.x + r.w - 2; x += 14) g.lineBetween(x, y, x, Math.min(y + course, r.y + r.h));
  }
  g.fillStyle(WALL.stoneLight, 0.8).fillRect(r.x, r.y, r.w, 2);
  g.fillStyle(WALL.stoneShade, 0.75).fillRect(r.x, r.y + r.h - 4, r.w, 4);
}

function drawPalisade(g: Graphics, r: Rect): void {
  g.fillStyle(WALL.wood, 1).fillRect(r.x, r.y, r.w, r.h);
  const vertical = r.h >= r.w;
  g.lineStyle(1, WALL.woodShade, 1);
  if (vertical) for (let y = r.y + 7; y < r.y + r.h; y += 7) g.lineBetween(r.x, y, r.x + r.w, y);
  else for (let x = r.x + 7; x < r.x + r.w; x += 7) g.lineBetween(x, r.y, x, r.y + r.h);
  g.fillStyle(WALL.woodLight, 0.7).fillRect(r.x, r.y, r.w, 2);
  g.fillStyle(WALL.woodShade, 0.7).fillRect(r.x, r.y + r.h - 4, r.w, 4);
}

function drawRock(g: Graphics, r: Rect): void {
  g.fillStyle(WALL.rock, 1).fillRect(r.x, r.y, r.w, r.h);
  // Broken layers in the rock and pale flecks, placed by a fixed pattern so the rock never flickers.
  for (let i = 0, y = r.y + 6; y < r.y + r.h - 4; i++, y += 9) {
    for (let x = r.x + ((i * 13) % 17); x < r.x + r.w - 6; x += 22 + ((i * 7) % 9)) {
      const len = Math.min(10 + ((x * 3 + i * 5) % 9), r.x + r.w - 3 - x);
      g.fillStyle(WALL.rockShade, 0.85).fillRect(x, y, len, 2);
      g.fillStyle(WALL.rockLight, 0.7).fillRect(x + 2, y - 2, Math.max(2, len - 6), 1);
    }
  }
  g.fillStyle(WALL.rockLight, 0.5);
  for (let i = 0; i < Math.floor((r.w * r.h) / 260); i++) g.fillRect(r.x + 3 + ((i * 37) % Math.max(1, r.w - 6)), r.y + 3 + ((i * 59 + 11) % Math.max(1, r.h - 6)), 2, 2);
  g.fillStyle(WALL.rockShade, 0.7).fillRect(r.x, r.y + r.h - 5, r.w, 5);
}

function drawIron(g: Graphics, r: Rect): void {
  g.fillStyle(WALL.iron, 1).fillRect(r.x, r.y, r.w, r.h);
  // Plates with a rivet at each corner.
  const plate = 24;
  g.lineStyle(1, WALL.ironShade, 1);
  for (let y = r.y + plate; y < r.y + r.h; y += plate) g.lineBetween(r.x, y, r.x + r.w, y);
  for (let x = r.x + plate; x < r.x + r.w; x += plate) g.lineBetween(x, r.y, x, r.y + r.h);
  g.fillStyle(WALL.rivet, 1);
  for (let y = r.y + 4; y < r.y + r.h - 2; y += plate) for (let x = r.x + 4; x < r.x + r.w - 2; x += plate) g.fillRect(x, y, 2, 2);
  g.fillStyle(WALL.ironLight, 0.7).fillRect(r.x, r.y, r.w, 2);
  g.fillStyle(WALL.ironShade, 0.8).fillRect(r.x, r.y + r.h - 4, r.w, 4);
}

export interface BodyStyle {
  alpha?: number;
  /** 0 to 1: how much the body flashes white after a hit. */
  flash?: number;
}

/**
 * A troop's body, painted from its pixel art at a size set by `r` (its class's radius draws it at
 * battle size), with a small shadow at its feet. It faces (faceX, faceY): right, or flipped left.
 */
export function drawBody(
  g: Graphics,
  cls: UnitClass,
  side: Side,
  x: number,
  y: number,
  r: number,
  faceX: number,
  _faceY: number,
  style: BodyStyle = {},
): void {
  const alpha = style.alpha ?? 1;
  const scale = (TROOP_ART_SCALE * r) / UNIT_CLASSES[cls].stats.radius;
  const rows = TROOP_ART[cls].frames.stand!;
  const flipX = faceX < x;
  g.fillStyle(0x000000, 0.25 * alpha).fillEllipse(x, y + 7 * scale, 11 * scale, 3 * scale);
  paintCentered(g, rows, sidePalette(side), x, y, { scale, flipX, alpha });
  if (style.flash && style.flash > 0) paintCentered(g, rows, FLASH, x, y, { scale, flipX, alpha: style.flash * 0.8 * alpha });
}

/** A ring in the rarity's color around a Rare, Epic or Legendary troop; nothing for a Common one. */
export function drawRarity(g: Graphics, x: number, y: number, r: number, rarity: Rarity, alpha = 1): void {
  if (rarity === 'common') return;
  g.lineStyle(rarity === 'legendary' ? 3 : 2, COLORS.rarity[rarity], 0.9 * alpha).strokeCircle(x, y, r + 5);
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

/** A Rift on the ground, in its element's color, fading as it runs out; it flares on each pulse, and motes circle in it. */
export function drawRift(g: Graphics, zone: Zone, share: number, flare: number, time = 0): void {
  const color = COLORS.rift[zone.element];
  g.fillStyle(color, 0.12 + 0.12 * share + 0.15 * flare).fillCircle(zone.x, zone.y, zone.radius);
  g.lineStyle(2, color, 0.5 + 0.4 * share).strokeCircle(zone.x, zone.y, zone.radius);
  g.lineStyle(1, COLORS.side[zone.side], 0.6).strokeCircle(zone.x, zone.y, zone.radius - 4);
  g.fillStyle(color, 0.5 + 0.4 * share);
  for (let i = 0; i < 8; i++) {
    const turn = time / (900 + (i % 3) * 300) + (i * Math.PI * 2) / 8;
    const reach = zone.radius * (0.35 + 0.55 * (((i * 37) % 10) / 10));
    g.fillRect(zone.x + Math.cos(turn) * reach - 1.5, zone.y + Math.sin(turn) * reach - 1.5, 3, 3);
  }
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
