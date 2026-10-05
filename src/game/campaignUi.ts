// Small drawing pieces shared by the campaign screens: fighters and boons as icons, and a run's
// numbers in a line.

import type Phaser from 'phaser';
import type { RunState } from '../campaign/types';
import { BOONS, type BoonId } from '../data/boons';
import type { FactionId } from '../data/factions';
import type { Rarity } from '../data/rarity';
import { UNIT_CLASSES, type UnitClass } from '../data/units';
import type { Side } from '../sim';
import { drawBar, drawBody, drawRarity } from './draw';
import { COLORS } from './theme';

type Graphics = Phaser.GameObjects.Graphics;

/**
 * A fighter as a small icon: its body, its rarity ring, a dot in its faction's color and, when
 * hurt, its HP. Enemy troops face left, in red.
 */
export function drawFighter(
  g: Graphics,
  cls: UnitClass,
  rarity: Rarity,
  x: number,
  y: number,
  hp = 1,
  alpha = 1,
  side: Side = 'player',
  faction: FactionId | null = null,
): void {
  const r = UNIT_CLASSES[cls].stats.radius * 0.8;
  drawBody(g, cls, side, x, y, r, x + (side === 'player' ? 100 : -100), y, { alpha });
  drawRarity(g, x, y, r, rarity, alpha);
  if (faction) drawFactionDot(g, faction, x + r + 2, y - r - 2, alpha);
  if (hp < 1) drawBar(g, x, y + r + 7, 22, hp);
}

/** A small dot in a faction's color. */
export function drawFactionDot(g: Graphics, faction: FactionId, x: number, y: number, alpha = 1): void {
  g.fillStyle(COLORS.faction[faction], alpha).fillCircle(x, y, 4);
  g.lineStyle(1, 0x0b0f16, alpha).strokeCircle(x, y, 4);
}

/** A boon as a small icon: a badge in its rarity's color with a plus; a duo boon wears its two factions' dots. */
export function drawBoon(g: Graphics, boon: BoonId, x: number, y: number): void {
  const color = COLORS.rarity[BOONS[boon].rarity];
  g.fillStyle(COLORS.row, 1).fillRoundedRect(x - 11, y - 11, 22, 22, 5);
  g.lineStyle(2, color, 1).strokeRoundedRect(x - 11, y - 11, 22, 22, 5);
  g.lineStyle(3, color, 1).lineBetween(x - 6, y, x + 6, y).lineBetween(x, y - 6, x, y + 6);
  const duo = BOONS[boon].duo;
  if (duo) {
    drawFactionDot(g, duo[0], x - 11, y - 11);
    drawFactionDot(g, duo[1], x + 11, y - 11);
  }
}

/** "85 gold · 9 fighters · 2 boons · 1 artifact carried". */
export function runNumbers(run: RunState): string {
  const parts = [`${run.gold} gold`, `${run.roster.length} fighters`, `${run.boons.length} boon${run.boons.length === 1 ? '' : 's'}`];
  if (run.artifacts.length > 0) parts.push(`${run.artifacts.length} artifact${run.artifacts.length === 1 ? '' : 's'} carried`);
  return parts.join('  ·  ');
}

/** "Floor 3 of 8". */
export function runFloor(run: RunState): string {
  return `Floor ${Math.max(1, run.path.length)} of ${run.map.length}`;
}
