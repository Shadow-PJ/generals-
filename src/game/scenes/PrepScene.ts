// Before the battle: you see the map and the enemy army, and place your troops on your half.
// Drag a troop with the mouse, or pick one with Tab and move it with the arrow keys. In a
// campaign fight your troops are your run's fighters; in a skirmish, your skirmish army.

import Phaser from 'phaser';
import { withSpots } from '../../campaign/army';
import { fighterLabel, NODE_NAMES } from '../../campaign/describe';
import type { TroopPlacement } from '../../data/armies';
import { REGION_IDS, REGIONS } from '../../data/regions';
import { MAPS } from '../../data/maps';
import { GENERALS } from '../../data/generals';
import { RANKS } from '../../data/ranks';
import { SPECIALIZATIONS } from '../../data/specializations';
import { SYNERGIES } from '../../data/synergies';
import { UNIT_CLASSES } from '../../data/units';
import { placementProblem } from '../../sim';
import { CLASS_LEGEND, drawBar, drawBody, drawField, drawRarity, drawWall, drawZone } from '../draw';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { currentCampaign, remember, saveCampaign, savedSetup } from '../session';
import { BOTTOM_BAR_Y, COLORS, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { enemyArmyOf, yourReserves, yourSynergies } from '../troops';
import { addButton, textStyle } from '../ui';

/** How fast the arrow keys move a troop, in world units per second. */
const KEYBOARD_MOVE_SPEED = 220;
/** How close to a troop a click must land to pick it up. */
const PICK_SLACK = 8;


export class PrepScene extends Phaser.Scene {
  private setup!: MatchSetup;
  private placement: TroopPlacement[] = [];
  private selected = 0;
  private drag: { index: number; x: number; y: number } | null = null;
  private actions!: InputLayer;
  private graphics!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;

  constructor() {
    super('Prep');
  }

  /** With no data (the game just started, or back from Settings) it picks up your saved setup. */
  init(data: Partial<MatchSetup>): void {
    this.setup = { ...savedSetup(), ...data };
    this.placement = this.setup.placement.map((t) => ({ ...t }));
    this.selected = 0;
    this.drag = null;
  }

  create(): void {
    fitCamera(this);
    const fight = this.setup.fight;
    const region = fight ? REGION_IDS.find((id) => REGIONS[id].map === fight.encounter.map) : undefined;
    this.add.text(16, 10, fight ? `PLACE YOUR TROOPS · ${NODE_NAMES[fight.encounter.kind].toUpperCase()}` : 'SKIRMISH', textStyle(18, TEXT.title, true));
    this.add.text(
      16,
      38,
      fight ? `${region ? REGIONS[region].name : ''} run. Drag troops, or Tab and the arrows.` : 'Practice: no XP. Drag or Tab + arrows.',
      textStyle(13),
    );
    if (fight) {
      addButton(this, GAME_WIDTH - 506, TOP_BAR_HEIGHT / 2, 'General  G', () => this.toGenerals(), 112, 34);
      addButton(this, GAME_WIDTH - 384, TOP_BAR_HEIGHT / 2, 'Codex  C', () => this.toCodex(), 112, 34);
      addButton(this, GAME_WIDTH - 250, TOP_BAR_HEIGHT / 2, '◀ Army  Esc', () => this.goBack(), 140, 34);
    } else {
      addButton(this, GAME_WIDTH - 628, TOP_BAR_HEIGHT / 2, 'General  G', () => this.toGenerals(), 112, 34);
      addButton(this, GAME_WIDTH - 506, TOP_BAR_HEIGHT / 2, 'Skirmish  T', () => this.toTroops(), 112, 34);
      addButton(this, GAME_WIDTH - 384, TOP_BAR_HEIGHT / 2, 'Codex  C', () => this.toCodex(), 112, 34);
      addButton(this, GAME_WIDTH - 250, TOP_BAR_HEIGHT / 2, '◀ Capital  Esc', () => this.goBack(), 140, 34);
    }
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, 'Orders  ⏎', () => this.toOrders(), 150, 34);

    const world = this.add.container(0, TOP_BAR_HEIGHT);
    const field = this.add.graphics();
    const map = MAPS[this.setup.map];
    drawField(field, map);
    drawZone(field, map.deployZones.player, 'player', 1);
    drawZone(field, map.deployZones.enemy, 'enemy', 0.6);
    for (const wall of map.walls) drawWall(field, wall);
    const enemy = enemyArmyOf(this.setup);
    for (const t of enemy.placement) {
      const r = UNIT_CLASSES[t.cls].stats.radius;
      drawBody(field, t.cls, 'enemy', t.x, t.y, r, t.x - 100, t.y, { alpha: 0.85 });
      drawRarity(field, t.x, t.y, r, t.rarity ?? 'common', 0.85);
    }
    // The map's terrain rule over the field, and who leads the enemy under its deploy zone.
    const terrain = this.add.text(map.width / 2, 10, `${map.name}: ${map.terrainText}`, textStyle(12, TEXT.muted)).setOrigin(0.5, 0);
    const zone = map.deployZones.enemy;
    const rank = RANKS.find((r) => r.rank === enemy.commander?.rank);
    const enemyReserves = enemy.reserves.length > 0 ? ` · ${enemy.reserves.length} in reserve` : '';
    const enemyLead = this.add
      .text(
        zone.x + zone.w / 2,
        zone.y + zone.h + 6,
        `${GENERALS[enemy.general].name} · ${rank ? `commander Rank ${rank.numeral}` : 'no commander'}${enemyReserves}`,
        textStyle(12, TEXT.threat, true),
      )
      .setOrigin(0.5, 0);
    this.graphics = this.add.graphics();
    this.label = this.add.text(0, 0, '', textStyle(12, TEXT.title)).setOrigin(0.5, 1);
    world.add([field, terrain, enemyLead, this.graphics, this.label]);

    // Your 3 reserves wait off the field until a Call Reserve card brings them in.
    this.add.text(16, BOTTOM_BAR_Y + 16, 'RESERVES', textStyle(12, TEXT.muted, true));
    const reserves = this.add.graphics();
    const waiting = yourReserves(this.setup);
    waiting.forEach((t, i) => {
      const x = 120 + i * 130;
      const r = UNIT_CLASSES[t.cls].stats.radius;
      drawBody(reserves, t.cls, 'player', x, BOTTOM_BAR_Y + 24, r, x + 100, BOTTOM_BAR_Y + 24);
      drawRarity(reserves, x, BOTTOM_BAR_Y + 24, r, t.rarity ?? 'common');
      if (t.hp !== undefined && t.hp < 1) drawBar(reserves, x, BOTTOM_BAR_Y + 4, 22, t.hp);
      this.add.text(x + 22, BOTTOM_BAR_Y + 16, fighterLabel(t.cls, t.rarity ?? 'common'), textStyle(12, TEXT.rarity[t.rarity ?? 'common']));
    });
    this.add.text(
      16,
      BOTTOM_BAR_Y + 52,
      waiting.length === 0 ? 'None. Pick reserves on the Army screen.' : 'They join at your edge of the map when you fire a Call Reserve card (Rank III).',
      textStyle(12, TEXT.muted),
    );
    this.add.text(16, BOTTOM_BAR_Y + 76, CLASS_LEGEND, textStyle(12, TEXT.muted));
    // What the army you brought switches on by itself, and the specializations you picked.
    const synergies = yourSynergies(this.setup).map((id) => SYNERGIES.find((s) => s.id === id)!.name);
    const specs = Object.values(this.setup.specs).map((id) => SPECIALIZATIONS[id].name);
    this.add.text(520, BOTTOM_BAR_Y + 16, 'SYNERGIES', textStyle(12, TEXT.muted, true));
    this.add.text(610, BOTTOM_BAR_Y + 16, synergies.length > 0 ? synergies.join(', ') : 'None', {
      ...textStyle(12, TEXT.combo),
      wordWrap: { width: GAME_WIDTH - 626 },
    });
    this.add.text(520, BOTTOM_BAR_Y + 52, 'SPECIALIZED', textStyle(12, TEXT.muted, true));
    this.add.text(610, BOTTOM_BAR_Y + 52, specs.length > 0 ? specs.join(', ') : 'None (set on the Skirmish screen)', {
      ...textStyle(12),
      wordWrap: { width: GAME_WIDTH - 626 },
    });
    const general = GENERALS[this.setup.general];
    this.add.text(520, BOTTOM_BAR_Y + 76, 'GENERAL', textStyle(12, TEXT.muted, true));
    this.add.text(610, BOTTOM_BAR_Y + 76, `${general.name}${general.faction ? ` · ${general.faction}` : ''} (G to change)`, textStyle(12, TEXT.perfect));

    this.actions = new InputLayer(this)
      .on('next', () => this.cycleSelection(1))
      .on('prev', () => this.cycleSelection(-1))
      .on('confirm', () => this.toOrders())
      .on('back', () => this.goBack())
      .on('codex', () => this.toCodex())
      .on('general', () => this.toGenerals());
    if (!fight) this.actions.on('troops', () => this.toTroops());

    // World coordinates, so dragging works at any render scale.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.pickUp(p.worldX, p.worldY - TOP_BAR_HEIGHT));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag) this.drag = { ...this.drag, x: p.worldX, y: p.worldY - TOP_BAR_HEIGHT };
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
    return placementProblem(MAPS[this.setup.map], 'player', this.placement[index]!.cls, x, y, others);
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
      drawRarity(g, t.x, t.y, r, t.rarity ?? 'common', dragged ? 0.35 : 1);
      // A run fighter still hurt from an earlier fight shows how much HP it has.
      if (t.hp !== undefined && t.hp < 1 && !dragged) drawBar(g, t.x, t.y + r + 6, 24, t.hp);
      if (i === this.selected && !dragged) g.lineStyle(2, COLORS.selected, 0.9).strokeCircle(t.x, t.y, r + 8);
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
    const hp = selected.hp !== undefined && selected.hp < 1 ? ` · ${Math.round(selected.hp * 100)}% HP` : '';
    this.label.setText(`${fighterLabel(selected.cls, selected.rarity ?? 'common')}${hp}`).setPosition(labelX, labelY - r - 9);
  }

  private toOrders(): void {
    this.drop();
    const setup = { ...this.setup, placement: this.placement };
    void remember(setup).catch(() => undefined);
    this.keepSpots();
    this.scene.start('Orders', setup);
  }

  /** In a run, your fighters remember where you put them, for the next fight. */
  private keepSpots(): void {
    const campaign = currentCampaign();
    if (!this.setup.fight || !campaign.run) return;
    void saveCampaign({ ...campaign, run: withSpots(campaign.run, this.placement) }).catch(() => undefined);
  }

  /** Back to the Army screen in a run, or to the Capital from a skirmish. */
  private goBack(): void {
    this.drop();
    if (this.setup.fight) {
      this.keepSpots();
      this.scene.start('Army');
    } else {
      const setup = { ...this.setup, placement: this.placement };
      void remember(setup).catch(() => undefined);
      this.scene.start('Capital');
    }
  }

  private toCodex(): void {
    this.drop();
    this.scene.start('Codex', { ...this.setup, placement: this.placement });
  }

  private toGenerals(): void {
    this.drop();
    this.scene.start('Generals', { ...this.setup, placement: this.placement });
  }

  private toTroops(): void {
    this.drop();
    this.scene.start('Troops', { ...this.setup, placement: this.placement });
  }
}
