// Before each fight of a run: choose which of your fighters take the field (up to 5), which wait
// in reserve (up to 3), and which sit this one out. The enemy you face is shown on the right.
// ↑↓ pick a fighter, ←→ (or a click) change their role, Enter: place your troops, Esc: the map.

import Phaser from 'phaser';
import { fighterById, nextRole, roleOf, withRole, type Role } from '../../campaign/army';
import { fighterLabel, NODE_NAMES } from '../../campaign/describe';
import { currentFight } from '../../campaign/run';
import type { RunState } from '../../campaign/types';
import { BOONS } from '../../data/boons';
import { GENERALS } from '../../data/generals';
import { MAPS } from '../../data/maps';
import { rankRules } from '../../data/ranks';
import { RARITIES, RARITY_RULES } from '../../data/rarity';
import { SYNERGIES } from '../../data/synergies';
import { activeSynergies } from '../../sim';
import { fightSetup } from '../campaignFlow';
import { drawBar } from '../draw';
import { drawFighter } from '../campaignUi';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { currentCampaign, earnedRank, saveCampaign, savedSetup } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle } from '../ui';

const LIST_X = 16;
const LIST_W = 580;
const LIST_Y = TOP_BAR_HEIGHT + 34;
const ROW_H = 30;
const VISIBLE_ROWS = 17;
const PANEL_X = LIST_X + LIST_W + 20;
const PANEL_W = GAME_WIDTH - PANEL_X - 16;

const ROLE_NAMES: Record<Role, string> = { field: 'On the field', reserve: 'In reserve', rest: 'Sits it out' };
const ROLE_COLORS: Record<Role, string> = { field: TEXT.victory, reserve: TEXT.perfect, rest: TEXT.muted };

export class ArmyScene extends Phaser.Scene {
  private selected = 0;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Army');
  }

  init(): void {
    this.selected = 0;
  }

  create(): void {
    fitCamera(this);
    const campaign = currentCampaign();
    if (!campaign.run || !currentFight(campaign)) {
      this.scene.start(campaign.run ? 'Run' : 'Capital');
      return;
    }
    this.add.text(16, 10, 'CHOOSE YOUR ARMY', textStyle(18, TEXT.title, true));
    this.add.text(16, 38, 'Up to 5 on the field and 3 in reserve. ↑↓ pick, ←→ change, Enter: place your troops.', textStyle(13, TEXT.muted));
    addButton(this, GAME_WIDTH - 250, TOP_BAR_HEIGHT / 2, '◀ Map  Esc', () => this.scene.start('Run'), 140, 34);
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, 'Place troops  ⏎', () => this.toPrep(), 150, 34);
    this.ui = this.add.container(0, 0);
    new InputLayer(this)
      .on('up', () => this.select(this.selected - 1))
      .on('prev', () => this.select(this.selected - 1))
      .on('down', () => this.select(this.selected + 1))
      .on('next', () => this.select(this.selected + 1))
      .on('left', () => this.change(-1))
      .on('right', () => this.change(1))
      .on('confirm', () => this.toPrep())
      .on('back', () => this.scene.start('Run'));
    this.render();
  }

  private run(): RunState {
    return currentCampaign().run!;
  }

  private select(i: number): void {
    const n = this.run().roster.length;
    this.selected = (i + n) % n;
    this.render();
  }

  /** Moves the chosen fighter to the next role that has room, and saves. */
  private change(step: number): void {
    const campaign = currentCampaign();
    const run = campaign.run!;
    const fighter = run.roster[this.selected];
    if (!fighter) return;
    const next = withRole(run, fighter.id, nextRole(run, fighter.id, step));
    if (next === run) return;
    void saveCampaign({ ...campaign, run: next }).catch(() => undefined);
    this.render();
  }

  private toPrep(): void {
    const setup = fightSetup(savedSetup(), this.run(), earnedRank());
    if (setup) this.scene.start('Prep', setup);
  }

  private render(): void {
    this.ui.removeAll(true);
    const run = this.run();
    const g = this.add.graphics();
    this.ui.add(g);
    const first = Math.min(Math.max(0, this.selected - VISIBLE_ROWS + 3), Math.max(0, run.roster.length - VISIBLE_ROWS));
    this.ui.add(
      this.add.text(LIST_X, LIST_Y - 22, `YOUR FIGHTERS  ·  field ${run.field.length}/5  ·  reserve ${run.reserves.length}/3`, textStyle(12, TEXT.muted, true)),
    );
    run.roster.slice(first, first + VISIBLE_ROWS).forEach((f, k) => {
      const i = first + k;
      const y = LIST_Y + k * ROW_H;
      const on = i === this.selected;
      const role = roleOf(run, f.id);
      const box = this.add.rectangle(LIST_X, y, LIST_W, ROW_H - 4, on ? COLORS.rowSelected : COLORS.row).setOrigin(0);
      box.setStrokeStyle(on ? 2 : 1, on ? COLORS.selected : COLORS.rowEdge).setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        this.selected = i;
        this.change(1);
      });
      this.ui.add(box);
      drawFighter(g, f.cls, f.rarity, LIST_X + 22, y + (ROW_H - 4) / 2, 1, role === 'rest' ? 0.5 : 1);
      this.ui.add(this.add.text(LIST_X + 46, y + 5, fighterLabel(f.cls, f.rarity), textStyle(13, TEXT.rarity[f.rarity], true)));
      drawBar(g, LIST_X + 270, y + 11, 90, f.hp);
      this.ui.add(this.add.text(LIST_X + 322, y + 5, `${Math.round(f.hp * 100)}% HP`, textStyle(12, f.hp < 0.5 ? TEXT.defeat : TEXT.body)));
      this.ui.add(this.add.text(LIST_X + 400, y + 5, `◀  ${ROLE_NAMES[role]}  ▶`, textStyle(13, ROLE_COLORS[role], true)));
    });
    if (run.roster.length > VISIBLE_ROWS) {
      this.ui.add(this.add.text(LIST_X, LIST_Y + VISIBLE_ROWS * ROW_H, `${first + 1}–${Math.min(run.roster.length, first + VISIBLE_ROWS)} of ${run.roster.length}`, textStyle(11, TEXT.muted)));
    }
    this.renderPanel(run, g);
    // The icons go over the rows.
    this.ui.bringToTop(g);
  }

  /** The enemy you face, and what your chosen army switches on. */
  private renderPanel(run: RunState, g: Phaser.GameObjects.Graphics): void {
    const encounter = currentFight(currentCampaign())!;
    let y = LIST_Y - 22;
    const add = (text: string, size: number, color: string = TEXT.body, bold = false, gap = 6) => {
      const t = this.add.text(PANEL_X, y, text, { ...textStyle(size, color, bold), wordWrap: { width: PANEL_W } });
      this.ui.add(t);
      y += t.height + gap;
    };
    add('THE ENEMY', 12, TEXT.muted, true, 4);
    add(NODE_NAMES[encounter.kind], 18, TEXT.threat, true, 2);
    const commander = encounter.commander ? `commander Rank ${rankRules(encounter.commander).numeral}` : 'no commander: no cards or ultimate';
    add(`${GENERALS[encounter.general].name} · ${commander}`, 13, TEXT.body, false, 4);
    const all = [...encounter.troops, ...encounter.reserves];
    const rarer = RARITIES.filter((r) => r !== 'common')
      .map((r) => [r, all.filter((t) => t.rarity === r).length] as const)
      .filter(([, n]) => n > 0)
      .map(([r, n]) => `${n} ${RARITY_RULES[r].name}`);
    add(`${encounter.troops.length} troops${encounter.reserves.length > 0 ? ` + ${encounter.reserves.length} in reserve` : ''}${rarer.length > 0 ? ` (${rarer.join(', ')})` : ''}`, 13, TEXT.body, false, 6);
    all.forEach((t, i) => drawFighter(g, t.cls, t.rarity ?? 'common', PANEL_X + 14 + i * 34, y + 10, 1, i < encounter.troops.length ? 1 : 0.45, 'enemy'));
    y += 34;
    add(`${MAPS[encounter.map].name}: ${MAPS[encounter.map].terrainText}`, 12, TEXT.muted, false, 14);

    const classes = [...run.field, ...run.reserves].flatMap((id) => fighterById(run, id)?.cls ?? []);
    const synergies = activeSynergies(classes, savedSetup().specs).map((id) => SYNERGIES.find((s) => s.id === id)!.name);
    add('SYNERGIES YOUR ARMY SWITCHES ON', 12, TEXT.muted, true, 2);
    add(synergies.length > 0 ? synergies.join(', ') : 'None', 13, TEXT.combo, false, 10);
    add('BOONS FOR THIS RUN', 12, TEXT.muted, true, 2);
    add(run.boons.length > 0 ? run.boons.map((b) => `${BOONS[b].name}: ${BOONS[b].text}`).join('\n') : 'None yet', 12, TEXT.body, false, 10);
    if (y < GAME_HEIGHT - 60) add('Wounds carry from fight to fight. A fighter who falls in a won fight gets back up at 25% HP.', 12, TEXT.muted);
  }
}
