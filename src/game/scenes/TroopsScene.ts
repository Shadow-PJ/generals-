// The Skirmish screen: practice battles, earning no Command XP. Pick the class of each of your
// 5 troops and 3 reserves, a specialization for each class, and the battle: the map, your
// General (one you have recruited), the enemy's General (any), its army and its commander. In the
// campaign your specializations come from the Tech Web instead (session 5E).
// Up and Down pick a row, Left and Right change it; a click changes it too.

import Phaser from 'phaser';
import { RESERVE_COUNT, type EnemyArmy } from '../../data/armies';
import { recruitedGenerals } from '../../data/bosses';
import { GENERAL_IDS, GENERALS } from '../../data/generals';
import { MAP_IDS, MAPS } from '../../data/maps';
import { RANKS, rankRules, type RankNumber } from '../../data/ranks';
import { SPECIALIZATIONS } from '../../data/specializations';
import { SYNERGIES } from '../../data/synergies';
import { TROOP_CLASSES, UNIT_CLASSES, type UnitClass } from '../../data/units';
import { groundTexture } from '../art/textures';
import { TROOP_ART_SCALE } from '../art/troops';
import { drawBody, drawWall, drawZone } from '../draw';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { earnedRank, remember } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { cycle, nextClass, specOptions, withClass, withSpec, yourSynergies } from '../troops';
import { addButton, addHint, textStyle } from '../ui';

type Row =
  | { kind: 'troop'; index: number }
  | { kind: 'reserve'; index: number }
  | { kind: 'map' }
  | { kind: 'general' }
  | { kind: 'enemyGeneral' }
  | { kind: 'enemy' }
  | { kind: 'enemyCommander' }
  | { kind: 'spec'; cls: UnitClass }
  | { kind: 'practice' };

/** No commander, or one of each rank. */
const COMMANDER_CHOICES: readonly (RankNumber | null)[] = [null, ...RANKS.map((r) => r.rank)];
/** Your own rank, or practice at one of each rank. */
const PRACTICE_CHOICES: readonly (RankNumber | null)[] = [null, ...RANKS.map((r) => r.rank)];
/** The map preview's size, as a share of the battlefield. */
const PREVIEW_SCALE = 0.32;

const ENEMY_NAMES: Record<EnemyArmy, string> = { starter: 'The starter army', mirror: 'A mirror of yours' };

const LEFT_X = 16;
const RIGHT_X = 480;
const COLUMN_W = 452;
const ROW_H = 28;
const SPEC_ROW_H = 46;

export class TroopsScene extends Phaser.Scene {
  private setup!: MatchSetup;
  private rows: Row[] = [];
  private selected = 0;
  private boxes: Phaser.GameObjects.Rectangle[] = [];
  private values: Phaser.GameObjects.Text[] = [];
  private notes: (Phaser.GameObjects.Text | null)[] = [];
  private shapes!: Phaser.GameObjects.Graphics;
  private synergyText!: Phaser.GameObjects.Text;
  private preview!: Phaser.GameObjects.Graphics;
  private previewGround!: Phaser.GameObjects.Image;
  private terrainText!: Phaser.GameObjects.Text;

  constructor() {
    super('Troops');
  }

  init(data: MatchSetup): void {
    this.setup = {
      ...data,
      placement: data.placement.map((t) => ({ ...t })),
      reserves: [...data.reserves],
      specs: { ...data.specs },
      bossesBeaten: [...data.bossesBeaten],
    };
    this.rows = [
      ...this.setup.placement.map((_, index) => ({ kind: 'troop', index }) as const),
      ...Array.from({ length: RESERVE_COUNT }, (_, index) => ({ kind: 'reserve', index }) as const),
      { kind: 'map' },
      { kind: 'general' },
      { kind: 'enemyGeneral' },
      { kind: 'enemy' },
      { kind: 'enemyCommander' },
      ...TROOP_CLASSES.map((cls) => ({ kind: 'spec', cls }) as const),
      { kind: 'practice' },
    ];
    this.selected = 0;
    this.boxes = [];
    this.values = [];
    this.notes = [];
  }

  create(): void {
    fitCamera(this);
    this.add.text(16, 10, 'SKIRMISH', textStyle(18, TEXT.title, true));
    addHint(
      this,
      16,
      38,
      'Practice battles with any army, General and map; no Command XP. ↑↓ pick, ←→ change.',
      'Practice battles with any army, General and map; no Command XP. ↑↓ pick, ←→ change, Ⓑ: done.',
      textStyle(13, TEXT.muted),
    );
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, 'Done  Esc', () => this.goBack(), 150, 34);

    let y = TOP_BAR_HEIGHT + 14;
    this.add.text(LEFT_X, y, 'YOUR TROOPS', textStyle(12, TEXT.muted, true));
    y += 20;
    this.shapes = this.add.graphics().setDepth(1);
    this.rows.forEach((row, i) => {
      if (row.kind === 'reserve' && row.index === 0) {
        y += 8;
        this.add.text(LEFT_X, y, 'RESERVES', textStyle(12, TEXT.muted, true));
        y += 20;
      } else if (row.kind === 'map') {
        y += 8;
        this.add.text(LEFT_X, y, 'THE BATTLE', textStyle(12, TEXT.muted, true));
        y += 20;
      } else if (row.kind === 'spec' && row.cls === TROOP_CLASSES[0]) {
        y = TOP_BAR_HEIGHT + 14;
        this.add.text(RIGHT_X, y, 'SPECIALIZATIONS (one per class)', textStyle(12, TEXT.muted, true));
        y += 20;
      }
      const x = row.kind === 'spec' || row.kind === 'practice' ? RIGHT_X : LEFT_X;
      const h = row.kind === 'spec' ? SPEC_ROW_H : ROW_H;
      const box = this.add.rectangle(x, y, COLUMN_W, h - 4, 0x1d2939).setOrigin(0).setStrokeStyle(1, 0x34465e);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = i;
        this.change(1);
      });
      this.boxes.push(box);
      this.add.text(x + 12, y + 6, this.rowLabel(row), textStyle(13, TEXT.muted));
      this.values.push(this.add.text(x + 150, y + 6, '', textStyle(row.kind === 'practice' ? 12 : 13, TEXT.body, true)));
      this.notes.push(row.kind === 'spec' ? this.add.text(x + 12, y + 25, '', textStyle(11, TEXT.muted)) : null);
      y += h;
    });

    // The chosen map, small, under the specializations, with how its terrain plays.
    const previewY = TOP_BAR_HEIGHT + 14 + 20 + TROOP_CLASSES.length * SPEC_ROW_H + ROW_H + 10;
    this.previewGround = this.add.image(RIGHT_X, previewY, groundTexture(this, MAPS[this.setup.map])).setOrigin(0).setScale(TROOP_ART_SCALE * PREVIEW_SCALE);
    this.preview = this.add.graphics().setPosition(RIGHT_X, previewY).setScale(PREVIEW_SCALE);
    const previewW = MAPS.openField.width * PREVIEW_SCALE;
    this.terrainText = this.add.text(RIGHT_X + previewW + 10, previewY, '', {
      ...textStyle(12, TEXT.muted),
      wordWrap: { width: GAME_WIDTH - 16 - (RIGHT_X + previewW + 10) },
    });

    this.add.text(LEFT_X, GAME_HEIGHT - 146, 'SYNERGIES YOUR ARMY SWITCHES ON', textStyle(12, TEXT.muted, true));
    this.synergyText = this.add.text(LEFT_X, GAME_HEIGHT - 126, '', { ...textStyle(13), lineSpacing: 4 });

    new InputLayer(this)
      .on('up', () => this.move(-1))
      .on('down', () => this.move(1))
      .on('prev', () => this.move(-1))
      .on('next', () => this.move(1))
      .on('left', () => this.change(-1))
      .on('right', () => this.change(1))
      .on('confirm', () => this.goBack())
      .on('back', () => this.goBack())
      .on('troops', () => this.goBack());
    this.refresh();
  }

  private rowLabel(row: Row): string {
    switch (row.kind) {
      case 'troop':
        return `Troop ${row.index + 1}`;
      case 'reserve':
        return `Reserve ${row.index + 1}`;
      case 'map':
        return 'Map';
      case 'general':
        return 'Your General';
      case 'enemyGeneral':
        return 'Enemy General';
      case 'enemy':
        return 'Enemy army';
      case 'enemyCommander':
        return 'Enemy commander';
      case 'spec':
        return UNIT_CLASSES[row.cls].name;
      case 'practice':
        return 'Your rank';
    }
  }

  private move(step: number): void {
    this.selected = (this.selected + step + this.rows.length) % this.rows.length;
    this.refresh();
  }

  /** Changes the selected row to its next (or previous) choice, and saves. */
  private change(step: number): void {
    const row = this.rows[this.selected]!;
    const setup = this.setup;
    switch (row.kind) {
      case 'troop':
        setup.placement = withClass(setup.placement, row.index, nextClass(setup.placement[row.index]!.cls, step));
        break;
      case 'reserve':
        setup.reserves[row.index] = nextClass(setup.reserves[row.index]!, step);
        break;
      case 'map':
        setup.map = cycle(MAP_IDS, setup.map, step);
        break;
      case 'general':
        // Only Generals you have recruited by beating them; the Captain from the start.
        setup.general = cycle(recruitedGenerals(setup.bossesBeaten), setup.general, step);
        break;
      case 'enemyGeneral':
        setup.enemyGeneral = cycle(GENERAL_IDS, setup.enemyGeneral, step);
        break;
      case 'enemy':
        setup.enemyArmy = cycle<EnemyArmy>(['starter', 'mirror'], setup.enemyArmy, step);
        break;
      case 'enemyCommander':
        setup.enemyCommander = cycle(COMMANDER_CHOICES, setup.enemyCommander, step);
        break;
      case 'spec': {
        const options = specOptions(row.cls);
        setup.specs = withSpec(setup.specs, row.cls, cycle(options, setup.specs[row.cls] ?? null, step));
        break;
      }
      case 'practice':
        // Your own rank, or practice at any rank for no Command XP.
        setup.practiceRank = cycle(PRACTICE_CHOICES, setup.practiceRank, step);
        setup.rank = setup.practiceRank ?? earnedRank();
        break;
    }
    void remember(setup).catch(() => undefined);
    this.refresh();
  }

  private refresh(): void {
    const g = this.shapes.clear();
    this.rows.forEach((row, i) => {
      const box = this.boxes[i]!;
      const on = i === this.selected;
      box.setFillStyle(on ? 0x2b3a50 : 0x1d2939).setStrokeStyle(on ? 2 : 1, on ? COLORS.selected : 0x34465e);
      const value = this.values[i]!;
      switch (row.kind) {
        case 'troop':
        case 'reserve': {
          const cls = row.kind === 'troop' ? this.setup.placement[row.index]!.cls : this.setup.reserves[row.index]!;
          value.setText(`◀  ${UNIT_CLASSES[cls].name}  ▶`);
          const r = UNIT_CLASSES[cls].stats.radius * 0.8;
          drawBody(g, cls, 'player', box.x + 120, box.y + box.height / 2, r, box.x + 220, box.y + box.height / 2);
          break;
        }
        case 'map':
          value.setText(`◀  ${MAPS[this.setup.map].name}  ▶`);
          break;
        case 'general':
          value.setText(`◀  ${GENERALS[this.setup.general].name}  ▶`);
          break;
        case 'enemyGeneral':
          value.setText(`◀  ${GENERALS[this.setup.enemyGeneral].name}  ▶`);
          break;
        case 'enemy':
          value.setText(`◀  ${ENEMY_NAMES[this.setup.enemyArmy]}  ▶`);
          break;
        case 'enemyCommander': {
          const rank = RANKS.find((r) => r.rank === this.setup.enemyCommander);
          let text = 'None: no enemy cards or ultimate';
          if (rank) text = `Rank ${rank.numeral}: ${rank.autoMode ? 'its cards and ultimate' : 'only its ultimate'}`;
          value.setText(`◀  ${text}  ▶`);
          break;
        }
        case 'practice': {
          const earned = rankRules(earnedRank());
          const practice = this.setup.practiceRank === null ? null : rankRules(this.setup.practiceRank);
          value.setText(`◀  ${practice ? `Practice at Rank ${practice.numeral}: no XP` : `Earned: Rank ${earned.numeral}`}  ▶`);
          break;
        }
        case 'spec': {
          const spec = this.setup.specs[row.cls];
          value.setText(`◀  ${spec ? SPECIALIZATIONS[spec].name : 'None'}  ▶`);
          this.notes[i]!.setText(spec ? SPECIALIZATIONS[spec].text : 'The class as it is.');
          drawBody(g, row.cls, 'player', box.x + 120, box.y + 14, UNIT_CLASSES[row.cls].stats.radius * 0.8, box.x + 220, box.y + 14);
          break;
        }
      }
    });
    const map = MAPS[this.setup.map];
    this.previewGround.setTexture(groundTexture(this, map));
    const p = this.preview.clear();
    drawZone(p, map.deployZones.player, 'player', 1);
    drawZone(p, map.deployZones.enemy, 'enemy', 0.6);
    for (const wall of map.walls) drawWall(p, wall, map.id);
    this.terrainText.setText(`${map.name.toUpperCase()}\n${map.terrainText}`);
    const on = yourSynergies(this.setup);
    this.synergyText.setText(
      on.length === 0
        ? 'None. Pairs of classes switch them on: see the Combo Codex.'
        : on.map((id) => `${SYNERGIES.find((s) => s.id === id)!.name}: ${SYNERGIES.find((s) => s.id === id)!.bonusText}`).join('\n'),
    );
  }

  private goBack(): void {
    void remember(this.setup).catch(() => undefined);
    this.scene.start('Prep', this.setup);
  }
}
