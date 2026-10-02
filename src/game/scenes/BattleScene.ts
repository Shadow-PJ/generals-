// The battle: runs the battle engine at a fixed 20 ticks per second and draws it every frame.
// This scene only reads the battle state; the engine alone changes it. Key presses reach the
// engine as inputs stamped with the tick they take effect on, so every battle can be replayed.

import Phaser from 'phaser';
import { cardCost } from '../../cards/cost';
import { shortCard } from '../../cards/describe';
import { STARTER_ARMY_MIRRORED, STARTER_RESERVES } from '../../data/armies';
import { COMMAND_RULES } from '../../data/command';
import { OPEN_FIELD } from '../../data/maps';
import { RANKS } from '../../data/ranks';
import { UNIT_CLASSES } from '../../data/units';
import {
  createBattle,
  LEGENDARY_SLOT,
  overtimeMultiplier,
  secondsToTicks,
  SLOT_COUNT,
  slotReadiness,
  stepBattle,
  TICKS_PER_SECOND,
  ultimateReady,
  type BattleInput,
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
import { SLOT_ACTIONS } from '../bindings';
import { drawBar, drawBarrier, drawBody, drawField, drawMark, drawWall } from '../draw';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { threats } from '../threats';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_Y, COLORS, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle, type Button } from '../ui';

export interface BattleData extends MatchSetup {
  seed: number;
}

/** How long a troop flashes white after a hit, in milliseconds. */
const HIT_FLASH_MS = 120;
/** Pause between the last blow and the result screen, in milliseconds. */
const RESULT_DELAY_MS = 1400;

const SKILL_LABELS = { shove: 'Shove!', mark: 'Mark', barrier: 'Barrier' } as const;

const SLOT_W = 136;
const SLOT_H = 80;
const SLOT_GAP = 8;
const SLOT_Y = BOTTOM_BAR_Y + 10;
const PANEL_X = 16 + SLOT_COUNT * (SLOT_W + SLOT_GAP);

interface Point {
  x: number;
  y: number;
}

type PendingInput = { kind: 'slot'; slot: number } | { kind: 'ultimate' };

interface SlotTexts {
  key: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  card: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private setup!: BattleData;
  private state!: BattleState;
  private clock!: BattleClock;
  /** Key presses waiting for the next tick. */
  private pending: PendingInput[] = [];
  /** Where units and projectiles stood one tick ago, so movement can be drawn smoothly between ticks. */
  private previous = new Map<string, Point>();
  private flashUntil = new Map<number, number>();
  private slotFlashUntil = new Map<number, number>();
  private eventCursor = 0;
  private ended = false;

  private world!: Phaser.GameObjects.Container;
  private wallsLayer!: Phaser.GameObjects.Graphics;
  private unitsLayer!: Phaser.GameObjects.Graphics;
  private topBar!: Phaser.GameObjects.Graphics;
  private bottomBar!: Phaser.GameObjects.Graphics;
  private clockText!: Phaser.GameObjects.Text;
  private overtimeText!: Phaser.GameObjects.Text;
  private pausedText!: Phaser.GameObjects.Text;
  private speedButtons!: { pause: Button; normal: Button; fast: Button };
  private slotTexts: SlotTexts[] = [];
  private pipsText!: Phaser.GameObjects.Text;
  private ultimateText!: Phaser.GameObjects.Text;
  private threatTexts = new Map<number, Phaser.GameObjects.Text>();

  constructor() {
    super('Battle');
  }

  init(data: BattleData): void {
    this.setup = data;
    this.state = createBattle({
      seed: data.seed,
      map: OPEN_FIELD,
      player: data.placement,
      enemy: STARTER_ARMY_MIRRORED,
      loadout: data.loadout,
      rank: data.rank,
      reserves: { player: [...STARTER_RESERVES], enemy: [] },
      tactical: data.tactical,
    });
    this.clock = createClock();
    this.pending = [];
    this.previous = new Map();
    this.flashUntil = new Map();
    this.slotFlashUntil = new Map();
    this.threatTexts = new Map();
    this.slotTexts = [];
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
    this.pausedText = this.add.text(GAME_WIDTH / 2 - 50, 12, 'PAUSED · Space to go on', textStyle(13, TEXT.perfect, true)).setOrigin(1, 0);
    this.add.text(16, 44, '1-5: cards   U: ultimate   Space: pause   F: speed', textStyle(12, TEXT.muted));

    const y = 48;
    this.speedButtons = {
      pause: addButton(this, GAME_WIDTH / 2 - 62, y, '❚❚', () => togglePause(this.clock), 54, 22),
      normal: addButton(this, GAME_WIDTH / 2, y, '1x', () => setSpeed(this.clock, 1), 54, 22),
      fast: addButton(this, GAME_WIDTH / 2 + 62, y, '2x', () => setSpeed(this.clock, 2), 54, 22),
    };

    this.createBottomBar();

    const input = new InputLayer(this)
      .on('pause', () => togglePause(this.clock))
      .on('speed', () => toggleSpeed(this.clock))
      .on('ultimate', () => this.pending.push({ kind: 'ultimate' }));
    SLOT_ACTIONS.forEach((action, slot) => input.on(action, () => this.pending.push({ kind: 'slot', slot })));

    this.banner('FIGHT!', TEXT.title, this.setup.tactical ? 'Tactical mode: the battle pauses every 10 s' : undefined);
  }

  override update(time: number, delta: number): void {
    if (!this.state.result) {
      const ticks = ticksForFrame(this.clock, delta);
      for (let i = 0; i < ticks && !this.state.result && !this.clock.paused; i++) {
        this.rememberPositions();
        stepBattle(this.state, this.takeInputs());
        this.tacticalPause();
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

  /** Stamps the waiting key presses with the tick about to run. */
  private takeInputs(): BattleInput[] {
    const tick = this.state.tick;
    const inputs = this.pending.map((p): BattleInput => (p.kind === 'slot' ? { tick, kind: 'slot', slot: p.slot } : { tick, kind: 'ultimate' }));
    this.pending = [];
    return inputs;
  }

  /** Tactical mode: stop every 10 s so cards can be chosen without hurry. */
  private tacticalPause(): void {
    const every = secondsToTicks(COMMAND_RULES.tacticalPauseSeconds);
    if (!this.setup.tactical || this.state.result || this.state.tick % every !== 0) return;
    this.clock.paused = true;
    this.banner('TACTICAL PAUSE', TEXT.title, 'Pick your cards, then press Space to go on');
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

  /** Turns new battle events into effects: hit flashes, skill names, cards, the ultimate, Overtime. */
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
      } else if (e.type === 'cardFired' && e.side === 'player') {
        this.slotFlashUntil.set(e.slot, time + 450);
        const x = 16 + e.slot * (SLOT_W + SLOT_GAP) + SLOT_W / 2;
        const label = e.perfect ? 'PERFECT!' : e.auto ? 'Auto' : 'Go!';
        this.screenPopup(x, SLOT_Y - 6, label, e.perfect ? TEXT.perfect : TEXT.body, e.perfect ? 18 : 13);
      } else if (e.type === 'ultimate') {
        this.banner('RALLY!', TEXT.perfect, 'Every troop heals and attacks faster');
      } else if (e.type === 'reserveCalled') {
        const unit = this.unit(e.unitId);
        if (unit) this.popup(unit.x, unit.y - 26, 'Reserve arrives!', '#bfe0ff');
      }
    }
  }

  private unit(id: number | null): Unit | undefined {
    return id === null ? undefined : this.state.units[id - 1];
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
    const focused = new Set<number>();
    for (const u of this.state.units) {
      if (!u.alive) continue;
      const at = this.smoothed(`u${u.id}`, u.x, u.y, blend);
      const r = u.stats.radius;
      const face = this.facing(u, at);
      const flash = Math.max(0, ((this.flashUntil.get(u.id) ?? 0) - time) / HIT_FLASH_MS);
      if (u.barrier) drawBarrier(g, at.x, at.y, r, u.barrier.amount / UNIT_CLASSES.guardian.barrier.amount);
      if (u.rallyTicks > 0) g.lineStyle(2, COLORS.glow, 0.7).strokeCircle(at.x, at.y, r + 9);
      drawBody(g, u.cls, u.side, at.x, at.y, r, face.x, face.y, { flash });
      if (u.mark) drawMark(g, at.x, at.y, r);
      drawBar(g, at.x, at.y - r - 9, 26, u.hp / u.stats.maxHp);
      // A small white dot: this troop is carrying out a card order.
      const order = u.orders[0];
      if (order?.started) {
        g.fillStyle(0xffffff, 0.9).fillCircle(at.x, at.y + r + 6, 2.5);
        if (order.kind === 'focus' && order.unitId !== null) focused.add(order.unitId);
      }
    }
    for (const id of focused) {
      const t = this.unit(id);
      if (!t?.alive) continue;
      const at = this.smoothed(`u${t.id}`, t.x, t.y, blend);
      g.lineStyle(2, COLORS.invalid, 0.9).strokeCircle(at.x, at.y, t.stats.radius + 12);
    }
    for (const p of this.state.projectiles) {
      const at = this.smoothed(`p${p.id}`, p.x, p.y, blend);
      const tail = this.previous.get(`p${p.id}`) ?? at;
      g.lineStyle(2, COLORS.projectile[p.side], 0.5).lineBetween(tail.x, tail.y, at.x, at.y);
      g.fillStyle(COLORS.projectile[p.side], 1).fillCircle(at.x, at.y, 3);
    }

    this.drawThreats(blend);
    this.drawTopBar();
    this.drawBottomBar(time);
  }

  /** Threat Readout: "Ranger falls in ~3 s" over troops about to fall. */
  private drawThreats(blend: number): void {
    const warnings = this.state.result ? [] : threats(this.state);
    const shown = new Set(warnings.map((w) => w.unitId));
    for (const [id, text] of this.threatTexts) if (!shown.has(id)) text.setVisible(false);
    for (const w of warnings) {
      const u = this.unit(w.unitId)!;
      const at = this.smoothed(`u${u.id}`, u.x, u.y, blend);
      let text = this.threatTexts.get(w.unitId);
      if (!text) {
        text = this.add.text(0, 0, '', textStyle(11, TEXT.threat, true)).setOrigin(0.5, 1);
        this.world.add(text);
        this.threatTexts.set(w.unitId, text);
      }
      text.setText(w.text).setPosition(at.x, at.y - u.stats.radius - 13).setVisible(true);
    }
  }

  /** Rangers point at what they are shooting; otherwise troops face the enemy's side. */
  private facing(u: Unit, at: Point): Point {
    const target = this.unit(u.targetId);
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

    this.pausedText.setVisible(this.clock.paused && !this.state.result);
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

  // The slot bar ------------------------------------------------------------------------------

  private createBottomBar(): void {
    this.bottomBar = this.add.graphics();
    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = 16 + i * (SLOT_W + SLOT_GAP);
      const hit = this.add.rectangle(x, SLOT_Y, SLOT_W, SLOT_H, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.pending.push({ kind: 'slot', slot: i }));
      const card = this.state.command.slots[i]?.card;
      this.slotTexts.push({
        key: this.add.text(x + 8, SLOT_Y + 5, String(i + 1), textStyle(15, TEXT.title, true)),
        cost: this.add.text(x + SLOT_W - 8, SLOT_Y + 7, card ? '●'.repeat(cardCost(card)) : '', textStyle(12, '#7dd3fc')).setOrigin(1, 0),
        card: this.add.text(x + 8, SLOT_Y + 24, card ? shortCard(card) : '', {
          ...textStyle(11),
          wordWrap: { width: SLOT_W - 16 },
          maxLines: 3,
        }),
        status: this.add.text(x + 8, SLOT_Y + SLOT_H - 17, '', textStyle(10, TEXT.muted)),
      });
    }
    this.add.text(PANEL_X, SLOT_Y + 2, 'PIPS', textStyle(11, TEXT.muted, true));
    this.pipsText = this.add.text(GAME_WIDTH - 16, SLOT_Y + 2, '', textStyle(11, TEXT.muted)).setOrigin(1, 0);
    this.add.text(PANEL_X, SLOT_Y + 40, 'MOMENTUM', textStyle(11, TEXT.muted, true));
    this.ultimateText = this.add.text(PANEL_X, SLOT_Y + 64, '', textStyle(12, TEXT.muted, true));
    this.add
      .rectangle(PANEL_X, SLOT_Y + 38, GAME_WIDTH - 16 - PANEL_X, 44, 0, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.pending.push({ kind: 'ultimate' }));
  }

  private drawBottomBar(time: number): void {
    const g = this.bottomBar.clear();
    g.fillStyle(COLORS.background, 1).fillRect(0, BOTTOM_BAR_Y, GAME_WIDTH, BOTTOM_BAR_HEIGHT);
    const command = this.state.command;
    const pulse = 0.55 + 0.45 * Math.sin(time / 120);

    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = 16 + i * (SLOT_W + SLOT_GAP);
      const slot = command.slots[i]!;
      const readiness = slotReadiness(this.state, i);
      const texts = this.slotTexts[i]!;
      const dim = readiness === 'locked' || readiness === 'empty';
      g.fillStyle(dim ? 0x141a23 : 0x1d2939, 1).fillRect(x, SLOT_Y, SLOT_W, SLOT_H);
      let border: [number, number, number] = [1, 0x34465e, 1];
      if (slot.glowing && readiness !== 'locked') border = [3, COLORS.glow, pulse];
      if ((this.slotFlashUntil.get(i) ?? 0) > time) border = [3, 0xffffff, 1];
      g.lineStyle(border[0], border[1], border[2]).strokeRect(x, SLOT_Y, SLOT_W, SLOT_H);
      if (readiness === 'resting') {
        const total = secondsToTicks(COMMAND_RULES.slotRestSeconds);
        g.fillStyle(0x000000, 0.45).fillRect(x, SLOT_Y, SLOT_W, SLOT_H);
        g.fillStyle(COLORS.pip, 0.8).fillRect(x, SLOT_Y + SLOT_H - 3, SLOT_W * (1 - slot.restTicks / total), 3);
      }
      texts.key.setAlpha(dim ? 0.4 : 1);
      texts.card.setAlpha(readiness === 'ready' ? 1 : 0.6);
      texts.status.setText(this.slotStatus(i, readiness)).setColor(readiness === 'ready' ? TEXT.victory : TEXT.muted);
    }

    // Pips: one circle per pip you can hold, and a thin bar filling toward the next one.
    const interval = secondsToTicks(COMMAND_RULES.pipRefillSeconds);
    for (let p = 0; p < command.maxPips; p++) {
      const cx = PANEL_X + 10 + p * 22;
      const cy = SLOT_Y + 26;
      if (p < command.pips) g.fillStyle(COLORS.pip, 1).fillCircle(cx, cy, 8);
      g.lineStyle(2, COLORS.pip, 0.8).strokeCircle(cx, cy, 8);
    }
    const width = GAME_WIDTH - 16 - PANEL_X;
    g.fillStyle(COLORS.pip, 0.5).fillRect(PANEL_X, SLOT_Y + 36, width * Math.min(1, command.pipProgress / interval), 2);
    this.pipsText.setText(`${command.pips}/${command.maxPips}`);

    // Momentum and the ultimate.
    const share = command.momentum / COMMAND_RULES.momentum.max;
    g.fillStyle(COLORS.hpBack, 1).fillRect(PANEL_X, SLOT_Y + 55, width, 6);
    g.fillStyle(COLORS.momentum, share >= 1 ? pulse : 1).fillRect(PANEL_X, SLOT_Y + 55, width * Math.min(1, share), 6);
    const ready = ultimateReady(this.state);
    this.ultimateText.setText(ready ? 'U: RALLY ready!' : `U: Rally  ${Math.floor(share * 100)}%`).setColor(ready ? TEXT.perfect : TEXT.muted);
  }

  private slotStatus(index: number, readiness: ReturnType<typeof slotReadiness>): string {
    const slot = this.state.command.slots[index]!;
    const auto = slot.card?.auto ? 'Auto · ' : '';
    switch (readiness) {
      case 'locked': {
        if (index === LEGENDARY_SLOT) return 'Legendary: beat a boss';
        const opens = RANKS.find((r) => r.slots > index);
        return opens ? `Opens at Rank ${opens.numeral}` : 'Locked';
      }
      case 'empty':
        return 'Empty';
      case 'resting':
        return `${auto}Resting ${Math.ceil(slot.restTicks / TICKS_PER_SECOND)} s`;
      case 'waiting':
        return `${auto}Waits for its moment`;
      case 'noPips':
        return `${auto}Needs ${cardCost(slot.card!)} pips`;
      case 'ready':
        return slot.glowing ? `${auto}NOW! Perfect timing` : `${auto}Ready`;
    }
  }

  // Effects -----------------------------------------------------------------------------------

  /** Floating text over the battlefield that rises and fades. */
  private popup(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, textStyle(13, color, true)).setOrigin(0.5);
    this.world.add(label);
    this.tweens.add({ targets: label, y: y - 18, alpha: 0, duration: 900, onComplete: () => label.destroy() });
  }

  /** Floating text in screen space, for the slot bar. */
  private screenPopup(x: number, y: number, text: string, color: string, size: number): void {
    const label = this.add.text(x, y, text, textStyle(size, color, true)).setOrigin(0.5, 1);
    this.tweens.add({ targets: label, y: y - 22, alpha: 0, duration: 1000, onComplete: () => label.destroy() });
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

