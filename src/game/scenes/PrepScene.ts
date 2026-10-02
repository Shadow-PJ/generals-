// Before the battle: you see the map and the enemy army, and place your 5 troops on your half.
// Drag a troop with the mouse, or pick one with Tab and move it with the arrow keys.

import Phaser from 'phaser';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED, type TroopPlacement } from '../../data/armies';
import { OPEN_FIELD } from '../../data/maps';
import { UNIT_CLASSES } from '../../data/units';
import { placementProblem } from '../../sim';
import { drawBody, drawField, drawWall, drawZone } from '../draw';
import { InputLayer } from '../InputLayer';
import { newSeed } from '../seed';
import { COLORS, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle } from '../ui';

/** How fast the arrow keys move a troop, in world units per second. */
const KEYBOARD_MOVE_SPEED = 220;
/** How close to a troop a click must land to pick it up. */
const PICK_SLACK = 8;

export interface PrepData {
  placement?: TroopPlacement[];
}

export class PrepScene extends Phaser.Scene {
  private placement: TroopPlacement[] = [];
  private selected = 0;
  private drag: { index: number; x: number; y: number } | null = null;
  private actions!: InputLayer;
  private graphics!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;

  constructor() {
    super('Prep');
  }

  init(data: PrepData): void {
    this.placement = (data.placement ?? STARTER_ARMY).map((t) => ({ ...t }));
    this.selected = 0;
    this.drag = null;
  }

  create(): void {
    this.add.text(16, 10, 'PLACE YOUR TROOPS', textStyle(18, TEXT.title, true));
    this.add.text(250, 13, '■ Vanguard   ▲ Ranger   ● Guardian', textStyle(13, TEXT.muted));
    this.add.text(
      16,
      38,
      'Drag a troop, or pick one with Tab and move it with the arrow keys. Enter starts the battle.',
      textStyle(13),
    );
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, 'Start battle  ⏎', () => this.startBattle(), 150, 34);

    const world = this.add.container(0, TOP_BAR_HEIGHT);
    const field = this.add.graphics();
    drawField(field, OPEN_FIELD);
    drawZone(field, OPEN_FIELD.deployZones.player, 'player', 1);
    drawZone(field, OPEN_FIELD.deployZones.enemy, 'enemy', 0.6);
    for (const wall of OPEN_FIELD.walls) drawWall(field, wall);
    for (const t of STARTER_ARMY_MIRRORED) {
      drawBody(field, t.cls, 'enemy', t.x, t.y, UNIT_CLASSES[t.cls].stats.radius, t.x - 100, t.y, { alpha: 0.85 });
    }
    this.graphics = this.add.graphics();
    this.label = this.add.text(0, 0, '', textStyle(12, TEXT.title)).setOrigin(0.5, 1);
    world.add([field, this.graphics, this.label]);

    this.actions = new InputLayer(this)
      .on('nextUnit', () => this.cycleSelection(1))
      .on('prevUnit', () => this.cycleSelection(-1))
      .on('confirm', () => this.startBattle());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.pickUp(p.x, p.y - TOP_BAR_HEIGHT));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag) this.drag = { ...this.drag, x: p.x, y: p.y - TOP_BAR_HEIGHT };
    });
    this.input.on('pointerup', () => this.drop());
  }

  override update(_time: number, delta: number): void {
    this.moveWithKeys(delta);
    this.redraw();
  }

  private cycleSelection(step: number): void {
    const n = this.placement.length;
    this.selected = (this.selected + step + n) % n;
  }

  private problemAt(index: number, x: number, y: number) {
    const others = this.placement.filter((_, i) => i !== index);
    return placementProblem(OPEN_FIELD, 'player', this.placement[index]!.cls, x, y, others);
  }

  private pickUp(x: number, y: number): void {
    let best = -1;
    let bestDistance = Infinity;
    this.placement.forEach((t, i) => {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= UNIT_CLASSES[t.cls].stats.radius + PICK_SLACK && d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    });
    if (best === -1) return;
    this.selected = best;
    this.drag = { index: best, x, y };
  }

  /** Drops a dragged troop where it is, or sends it back if it can't stand there. */
  private drop(): void {
    if (!this.drag) return;
    const { index, x, y } = this.drag;
    if (this.problemAt(index, x, y) === null) this.placement[index] = { ...this.placement[index]!, x, y };
    this.drag = null;
  }

  private moveWithKeys(delta: number): void {
    if (this.drag) return;
    const dx = (this.actions.isHeld('right') ? 1 : 0) - (this.actions.isHeld('left') ? 1 : 0);
    const dy = (this.actions.isHeld('down') ? 1 : 0) - (this.actions.isHeld('up') ? 1 : 0);
    if (dx === 0 && dy === 0) return;
    const step = (KEYBOARD_MOVE_SPEED * delta) / 1000;
    const troop = this.placement[this.selected]!;
    // Try the full move, then each direction alone, so a troop slides along a zone edge.
    const tries: [number, number][] = [
      [dx * step, dy * step],
      [dx * step, 0],
      [0, dy * step],
    ];
    for (const [mx, my] of tries) {
      if ((mx !== 0 || my !== 0) && this.problemAt(this.selected, troop.x + mx, troop.y + my) === null) {
        this.placement[this.selected] = { ...troop, x: troop.x + mx, y: troop.y + my };
        return;
      }
    }
  }

  private redraw(): void {
    const g = this.graphics.clear();
    this.placement.forEach((t, i) => {
      const r = UNIT_CLASSES[t.cls].stats.radius;
      const dragged = this.drag?.index === i;
      drawBody(g, t.cls, 'player', t.x, t.y, r, t.x + 100, t.y, { alpha: dragged ? 0.35 : 1 });
      if (i === this.selected && !dragged) g.lineStyle(2, COLORS.selected, 0.9).strokeCircle(t.x, t.y, r + 6);
    });
    const selected = this.placement[this.selected]!;
    let labelX = selected.x;
    let labelY = selected.y;
    if (this.drag) {
      const t = this.placement[this.drag.index]!;
      const r = UNIT_CLASSES[t.cls].stats.radius;
      const ok = this.problemAt(this.drag.index, this.drag.x, this.drag.y) === null;
      drawBody(g, t.cls, 'player', this.drag.x, this.drag.y, r, this.drag.x + 100, this.drag.y);
      g.lineStyle(2, ok ? COLORS.selected : COLORS.invalid, 0.9).strokeCircle(this.drag.x, this.drag.y, r + 6);
      labelX = this.drag.x;
      labelY = this.drag.y;
    }
    const r = UNIT_CLASSES[selected.cls].stats.radius;
    this.label.setText(UNIT_CLASSES[selected.cls].name).setPosition(labelX, labelY - r - 9);
  }

  private startBattle(): void {
    this.drop();
    this.scene.start('Battle', { placement: this.placement, seed: newSeed() });
  }
}
