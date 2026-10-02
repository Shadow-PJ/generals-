// The battle: runs the battle engine at a fixed 20 ticks per second and draws it every frame.
// This scene only reads the battle state; the engine alone changes it.

import Phaser from 'phaser';
import { STARTER_ARMY_MIRRORED } from '../../data/armies';
import { OPEN_FIELD } from '../../data/maps';
import { UNIT_CLASSES } from '../../data/units';
import {
  createBattle,
  overtimeMultiplier,
  stepBattle,
  TICKS_PER_SECOND,
  type BattleState,
  type Side,
  type Unit,
} from '../../sim';
import {
  createClock,
  frameBlend,
  setSpeed,
  ticksForFrame,
  togglePause,
  toggleSpeed,
  type BattleClock,
} from '../battleClock';
import { drawBar, drawBarrier, drawBody, drawField, drawMark, drawWall } from '../draw';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { COLORS, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle, type Button } from '../ui';

export interface BattleData extends MatchSetup {
  seed: number;
}

/** How long a troop flashes white after a hit, in milliseconds. */
const HIT_FLASH_MS = 120;
/** Pause between the last blow and the result screen, in milliseconds. */
const RESULT_DELAY_MS = 1400;

const SKILL_LABELS = { shove: 'Shove!', mark: 'Mark', barrier: 'Barrier' } as const;

interface Point {
  x: number;
  y: number;
}

export class BattleScene extends Phaser.Scene {
  private setup!: BattleData;
  private state!: BattleState;
  private clock!: BattleClock;
  /** Where units and projectiles stood one tick ago, so movement can be drawn smoothly between ticks. */
  private previous = new Map<string, Point>();
  private flashUntil = new Map<number, number>();
  private eventCursor = 0;
  private ended = false;

  private world!: Phaser.GameObjects.Container;
  private wallsLayer!: Phaser.GameObjects.Graphics;
  private unitsLayer!: Phaser.GameObjects.Graphics;
  private topBar!: Phaser.GameObjects.Graphics;
  private clockText!: Phaser.GameObjects.Text;
  private overtimeText!: Phaser.GameObjects.Text;
  private speedButtons!: { pause: Button; normal: Button; fast: Button };

  constructor() {
    super('Battle');
  }

  init(data: BattleData): void {
    this.setup = data;
    this.state = createBattle({ seed: data.seed, map: OPEN_FIELD, player: data.placement, enemy: STARTER_ARMY_MIRRORED });
    this.clock = createClock();
    this.previous = new Map();
    this.flashUntil = new Map();
    this.eventCursor = 0;
    this.ended = false;
  }

  create(): void {
    this.world = this.add.container(0, TOP_BAR_HEIGHT);
    const field = this.add.graphics();
    drawField(field, OPEN_FIELD);
    this.wallsLayer = this.add.graphics();
    this.unitsLayer = this.add.graphics();
    this.world.add([field, this.wallsLayer, this.unitsLayer]);

    this.topBar = this.add.graphics();
    this.add.text(16, 8, 'YOU', textStyle(12, TEXT.muted, true));
    this.add.text(GAME_WIDTH - 16, 8, 'ENEMY', textStyle(12, TEXT.muted, true)).setOrigin(1, 0);
    this.clockText = this.add.text(GAME_WIDTH / 2, 6, '0:00', textStyle(22, TEXT.title, true)).setOrigin(0.5, 0);
    this.overtimeText = this.add.text(GAME_WIDTH / 2 + 50, 12, '', textStyle(13, TEXT.overtime, true));
    this.add.text(16, 44, 'Space: pause   F: speed', textStyle(12, TEXT.muted));

    const y = 48;
    this.speedButtons = {
      pause: addButton(this, GAME_WIDTH / 2 - 62, y, '❚❚', () => togglePause(this.clock), 54, 22),
      normal: addButton(this, GAME_WIDTH / 2, y, '1x', () => setSpeed(this.clock, 1), 54, 22),
      fast: addButton(this, GAME_WIDTH / 2 + 62, y, '2x', () => setSpeed(this.clock, 2), 54, 22),
    };

    new InputLayer(this).on('pause', () => togglePause(this.clock)).on('speed', () => toggleSpeed(this.clock));

    this.banner('FIGHT!', TEXT.title);
  }

  override update(time: number, delta: number): void {
    if (!this.state.result) {
      const ticks = ticksForFrame(this.clock, delta);
      for (let i = 0; i < ticks && !this.state.result; i++) {
        this.rememberPositions();
        stepBattle(this.state);
      }
      this.showNewEvents(time);
      if (this.state.result && !this.ended) {
        this.ended = true;
        this.time.delayedCall(RESULT_DELAY_MS, () => {
          this.scene.launch('Result', { ...this.setup, result: this.state.result });
          this.scene.pause();
        });
      }
    }
    this.draw(time, this.state.result ? 1 : frameBlend(this.clock));
  }

  private rememberPositions(): void {
    this.previous.clear();
    for (const u of this.state.units) this.previous.set(`u${u.id}`, { x: u.x, y: u.y });
    for (const p of this.state.projectiles) this.previous.set(`p${p.id}`, { x: p.x, y: p.y });
  }

  private smoothed(key: string, x: number, y: number, blend: number): Point {
    const before = this.previous.get(key);
    if (!before) return { x, y };
    return { x: before.x + (x - before.x) * blend, y: before.y + (y - before.y) * blend };
  }

  /** Turns new battle events into effects: hit flashes, skill names, broken walls, Overtime. */
  private showNewEvents(time: number): void {
    const events = this.state.events;
    for (; this.eventCursor < events.length; this.eventCursor++) {
      const e = events[this.eventCursor]!;
      if (e.type === 'damage' && e.amount + e.absorbed > 0) {
        this.flashUntil.set(e.targetId, time + HIT_FLASH_MS);
      } else if (e.type === 'skill') {
        const unit = this.unit(e.unitId);
        if (unit) this.popup(unit.x, unit.y - 26, SKILL_LABELS[e.skill], unit.side === 'player' ? '#bfe0ff' : '#ffc9c0');
      } else if (e.type === 'death') {
        const unit = this.unit(e.unitId);
        if (unit) this.popup(unit.x, unit.y - 20, '✖', unit.side === 'player' ? '#7fb8ff' : '#ff8f80');
      } else if (e.type === 'wallBreak') {
        const wall = this.state.walls.find((w) => w.id === e.wallId);
        if (wall) this.popup(wall.x + wall.w / 2, wall.y + wall.h / 2, 'Wall broken!', TEXT.title);
      } else if (e.type === 'overtime') {
        this.banner('OVERTIME', TEXT.overtime, 'Damage grows every second');
      }
    }
  }

  private unit(id: number): Unit | undefined {
    return this.state.units.find((u) => u.id === id);
  }

  private draw(time: number, blend: number): void {
    const walls = this.wallsLayer.clear();
    for (const wall of this.state.walls) drawWall(walls, wall);

    const g = this.unitsLayer.clear();
    // Fallen troops first, so the living are drawn on top.
    for (const u of this.state.units) {
      if (u.alive) continue;
      const r = u.stats.radius * 0.6;
      g.lineStyle(3, COLORS.side[u.side], 0.35);
      g.lineBetween(u.x - r, u.y - r, u.x + r, u.y + r).lineBetween(u.x - r, u.y + r, u.x + r, u.y - r);
    }
    for (const u of this.state.units) {
      if (!u.alive) continue;
      const at = this.smoothed(`u${u.id}`, u.x, u.y, blend);
      const r = u.stats.radius;
      const face = this.facing(u, at);
      const flash = Math.max(0, ((this.flashUntil.get(u.id) ?? 0) - time) / HIT_FLASH_MS);
      if (u.barrier) drawBarrier(g, at.x, at.y, r, u.barrier.amount / UNIT_CLASSES.guardian.barrier.amount);
      drawBody(g, u.cls, u.side, at.x, at.y, r, face.x, face.y, { flash });
      if (u.mark) drawMark(g, at.x, at.y, r);
      drawBar(g, at.x, at.y - r - 9, 26, u.hp / u.stats.maxHp);
    }
    for (const p of this.state.projectiles) {
      const at = this.smoothed(`p${p.id}`, p.x, p.y, blend);
      const tail = this.previous.get(`p${p.id}`) ?? at;
      g.lineStyle(2, COLORS.projectile[p.side], 0.5).lineBetween(tail.x, tail.y, at.x, at.y);
      g.fillStyle(COLORS.projectile[p.side], 1).fillCircle(at.x, at.y, 3);
    }

    this.drawTopBar();
  }

  /** Rangers point at what they are shooting; otherwise troops face the enemy's side. */
  private facing(u: Unit, at: Point): Point {
    const target = u.targetId === null ? undefined : this.unit(u.targetId);
    if (target && target.side !== u.side) return { x: target.x, y: target.y };
    return { x: at.x + (u.side === 'player' ? 100 : -100), y: at.y };
  }

  private drawTopBar(): void {
    const g = this.topBar.clear();
    g.fillStyle(COLORS.background, 1).fillRect(0, 0, GAME_WIDTH, TOP_BAR_HEIGHT);
    const share = (side: Side) =>
      this.state.units.filter((u) => u.side === side && u.alive).reduce((sum, u) => sum + u.hp, 0) /
      this.state.startHp[side];
    this.armyBar(g, 16, share('player'), 'player');
    this.armyBar(g, GAME_WIDTH - 16 - 300, share('enemy'), 'enemy');

    const seconds = Math.floor(this.state.tick / TICKS_PER_SECOND);
    this.clockText.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    const boost = overtimeMultiplier(this.state.tick) - 1;
    this.overtimeText.setText(boost > 0 ? `OVERTIME +${Math.round(boost * 100)}%` : '');

    this.speedButtons.pause.setHighlighted(this.clock.paused);
    this.speedButtons.normal.setHighlighted(!this.clock.paused && this.clock.speed === 1);
    this.speedButtons.fast.setHighlighted(!this.clock.paused && this.clock.speed === 2);
  }

  /** An army's HP left, as a long bar in its color; the enemy's drains from the right. */
  private armyBar(g: Phaser.GameObjects.Graphics, x: number, share: number, side: Side): void {
    const width = 300;
    const filled = width * Math.max(0, Math.min(1, share));
    g.fillStyle(COLORS.hpBack, 1).fillRect(x, 24, width, 12);
    g.fillStyle(COLORS.side[side], 1).fillRect(side === 'player' ? x : x + width - filled, 24, filled, 12);
    g.lineStyle(1, COLORS.sideDark[side], 1).strokeRect(x, 24, width, 12);
  }

  /** Floating text over the battlefield that rises and fades. */
  private popup(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, textStyle(13, color, true)).setOrigin(0.5);
    this.world.add(label);
    this.tweens.add({ targets: label, y: y - 18, alpha: 0, duration: 900, onComplete: () => label.destroy() });
  }

  /** Big text across the middle of the battlefield. */
  private banner(title: string, color: string, subtitle?: string): void {
    const cx = OPEN_FIELD.width / 2;
    const cy = OPEN_FIELD.height / 2;
    const items = [this.add.text(cx, cy - 12, title, textStyle(44, color, true)).setOrigin(0.5)];
    if (subtitle) items.push(this.add.text(cx, cy + 26, subtitle, textStyle(16, TEXT.body)).setOrigin(0.5));
    this.world.add(items);
    this.tweens.add({ targets: items, alpha: 0, delay: 1200, duration: 800, onComplete: () => items.forEach((t) => t.destroy()) });
  }
}
