// The Tech Web (session 5E), in the Capital: each class's small web of upgrades, bought with the
// Insight your campaign battles earn. Drills and Better Arms first, then one of the class's two
// specializations, then Honed Skill. Between runs a class's web can be taken back for free.
// Tab (or a click on a tab) picks the class, the arrows pick a node, Enter buys it, Del takes the
// class's web back, Esc returns to the Capital.

import Phaser from 'phaser';
import { buyTech, classTech, hasTech, respecProblem, respecTech, techCost, techProblem, techSpent, type TechPick } from '../../campaign/tech';
import { SPECIALIZATIONS, type SpecializationId } from '../../data/specializations';
import { TECH_NODES } from '../../data/tech';
import { TROOP_CLASSES, UNIT_CLASSES, type TroopClass } from '../../data/units';
import { unlockedClasses } from '../../data/regions';
import { keyLabel } from '../bindings';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { currentCampaign, saveCampaign } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, addFrame, addHint, addTitle, textStyle } from '../ui';

const TAB_Y = TOP_BAR_HEIGHT + 12;
const TAB_W = 120;
const WEB_X = 40;
const WEB_W = 520;
const NODE_W = 210;
const NODE_H = 64;
const ROW_Y = [TOP_BAR_HEIGHT + 90, TOP_BAR_HEIGHT + 210, TOP_BAR_HEIGHT + 330];
const PANEL_X = WEB_X + WEB_W + 30;
const PANEL_W = GAME_WIDTH - PANEL_X - 20;

/** The web's nodes for a class, by row and column: tier 1, the two specializations, Honed Skill. */
function layout(cls: TroopClass): TechPick[][] {
  const specs = (Object.keys(SPECIALIZATIONS) as SpecializationId[]).filter((id) => SPECIALIZATIONS[id].cls === cls);
  return [['drills', 'arms'], specs, ['honed']];
}

function pickName(pick: TechPick): string {
  return pick in SPECIALIZATIONS ? SPECIALIZATIONS[pick as SpecializationId].name : TECH_NODES[pick as keyof typeof TECH_NODES].name;
}

function pickText(pick: TechPick): string {
  return pick in SPECIALIZATIONS ? SPECIALIZATIONS[pick as SpecializationId].text : TECH_NODES[pick as keyof typeof TECH_NODES].text;
}

export class TechScene extends Phaser.Scene {
  private cls: TroopClass = 'vanguard';
  private row = 0;
  private col = 0;
  private message = '';
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Tech');
  }

  init(): void {
    this.row = 0;
    this.col = 0;
    this.message = '';
  }

  create(): void {
    fitCamera(this);
    addTitle(this, 'TECH WEB');
    // The details of what is picked, in a panel down the right.
    addFrame(this, PANEL_X - 12, TAB_Y + 44, GAME_WIDTH - PANEL_X + 6, GAME_HEIGHT - 12 - (TAB_Y + 44), 'panel');
    addHint(this, 16, 38, 'Tab: class, arrows: pick, Enter: buy, Del: take the class’s web back, Esc: Capital.', 'LB RB: class, ✚: pick, Ⓐ: buy, Ⓧ: take the class’s web back, Ⓑ: Capital.', textStyle(13, TEXT.muted));
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, '◀ Capital  Esc', () => this.scene.start('Capital'), 150, 34);
    this.ui = this.add.container(0, 0);
    new InputLayer(this)
      .on('next', () => this.switchClass(1))
      .on('prev', () => this.switchClass(-1))
      .on('up', () => this.move(-1, 0))
      .on('down', () => this.move(1, 0))
      .on('left', () => this.move(0, -1))
      .on('right', () => this.move(0, 1))
      .on('confirm', () => this.buy())
      .on('clear', () => this.respec())
      .on('back', () => this.scene.start('Capital'))
      .on('tech', () => this.scene.start('Capital'));
    this.render();
  }

  private switchClass(step: number): void {
    const i = TROOP_CLASSES.indexOf(this.cls);
    this.cls = TROOP_CLASSES[(i + step + TROOP_CLASSES.length) % TROOP_CLASSES.length]!;
    this.message = '';
    this.render();
  }

  private move(dRow: number, dCol: number): void {
    const rows = layout(this.cls);
    this.row = Math.max(0, Math.min(rows.length - 1, this.row + dRow));
    this.col = Math.max(0, Math.min(rows[this.row]!.length - 1, this.col + dCol));
    this.message = '';
    this.render();
  }

  private picked(): TechPick {
    const rows = layout(this.cls);
    const row = rows[this.row]!;
    return row[Math.min(this.col, row.length - 1)]!;
  }

  private buy(): void {
    const campaign = currentCampaign();
    const pick = this.picked();
    const problem = techProblem(campaign, this.cls, pick);
    if (problem) {
      this.message = problem;
    } else {
      void saveCampaign(buyTech(campaign, this.cls, pick)).catch(() => undefined);
      this.message = `${pickName(pick)}: yours.`;
    }
    this.render();
  }

  private respec(): void {
    const campaign = currentCampaign();
    const problem = respecProblem(campaign, this.cls);
    if (problem) {
      this.message = problem;
    } else {
      this.message = `${UNIT_CLASSES[this.cls].name} web taken back: ${techSpent(campaign.tech, this.cls)} Insight to spend again.`;
      void saveCampaign(respecTech(campaign, this.cls)).catch(() => undefined);
    }
    this.render();
  }

  private render(): void {
    this.ui.removeAll(true);
    const campaign = currentCampaign();
    const g = this.add.graphics();
    this.ui.add(g);
    const unlocked = unlockedClasses(campaign.bossesBeaten);

    // The class tabs.
    TROOP_CLASSES.forEach((cls, i) => {
      const x = WEB_X + i * (TAB_W + 8);
      const on = cls === this.cls;
      const box = addFrame(this, x, TAB_Y, TAB_W, 30, on ? 'buttonOn' : 'button').setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        this.cls = cls;
        this.render();
      });
      const spent = techSpent(campaign.tech, cls);
      const label = `${UNIT_CLASSES[cls].name}${spent > 0 ? ` · ${spent}` : ''}`;
      const text = this.add.text(x + TAB_W / 2, TAB_Y + 15, label, textStyle(13, unlocked.includes(cls) ? TEXT.title : TEXT.muted, on)).setOrigin(0.5);
      this.ui.add([box, text]);
    });

    // The web: lines first, then the nodes.
    const rows = layout(this.cls);
    const centers = rows.map((row, r) => row.map((_, c) => ({ x: WEB_X + (row.length === 1 ? WEB_W / 2 : WEB_W / 4 + (c * WEB_W) / 2), y: ROW_Y[r]! + NODE_H / 2 })));
    for (let r = 0; r + 1 < rows.length; r++) {
      for (const from of centers[r]!) for (const to of centers[r + 1]!) g.lineStyle(2, COLORS.fieldLine, 1).lineBetween(from.x, from.y + NODE_H / 2, to.x, to.y - NODE_H / 2);
    }
    rows.forEach((row, r) =>
      row.forEach((pick, c) => {
        const { x, y } = centers[r]![c]!;
        const owned = hasTech(campaign.tech, this.cls, pick);
        const problem = techProblem(campaign, this.cls, pick);
        const on = r === this.row && c === Math.min(this.col, row.length - 1);
        const style = on ? 'rowOn' : owned ? 'rowGood' : problem ? 'rowDim' : 'rowGold';
        const box = addFrame(this, x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H, style).setInteractive({ useHandCursor: true });
        box.on('pointerdown', () => {
          if (this.row === r && this.col === c) this.buy();
          else {
            this.row = r;
            this.col = c;
            this.render();
          }
        });
        const name = this.add.text(x, y - 12, pickName(pick), textStyle(15, owned ? TEXT.victory : problem ? TEXT.muted : TEXT.title, true)).setOrigin(0.5);
        const cost = this.add.text(x, y + 12, owned ? 'Yours' : `${techCost(pick)} Insight`, textStyle(12, owned ? TEXT.victory : TEXT.gold, true)).setOrigin(0.5);
        this.ui.add([box, name, cost]);
      }),
    );

    // The chosen node, on the right.
    const pick = this.picked();
    let y = TOP_BAR_HEIGHT + 70;
    const add = (text: string, size: number, color: string = TEXT.body, bold = false, gap = 8) => {
      const t = this.add.text(PANEL_X, y, text, { ...textStyle(size, color, bold), wordWrap: { width: PANEL_W } });
      this.ui.add(t);
      y += t.height + gap;
    };
    add(`INSIGHT: ${campaign.insight}`, 18, TEXT.gold, true, 4);
    add('Every campaign battle earns some, win or lose.', 12, TEXT.muted, false, 18);
    add(`${UNIT_CLASSES[this.cls].name.toUpperCase()} · ${pickName(pick)}`, 16, TEXT.title, true, 4);
    add(pickText(pick), 13, TEXT.body, false, 10);
    const problem = techProblem(campaign, this.cls, pick);
    if (hasTech(campaign.tech, this.cls, pick)) add('Yours: every troop of this class has it in your campaign battles.', 12, TEXT.victory);
    else add(problem ?? `${keyLabel('confirm')}: buy it for ${techCost(pick)} Insight.`, 12, problem ? TEXT.defeat : TEXT.perfect, true);
    const spec = classTech(campaign.tech, this.cls).spec;
    y += 8;
    add(`Specialization: ${spec ? SPECIALIZATIONS[spec].name : 'none yet'}. In skirmish you pick specializations freely; the Tech Web sets them for the campaign.`, 12, TEXT.muted);
    if (this.message) add(this.message, 13, TEXT.combo, true);
    this.ui.add(this.add.text(16, GAME_HEIGHT - 30, campaign.run ? 'You are on a run: you can buy, but take a web back only between runs.' : `Between runs: ${keyLabel('clear')} takes a class’s web back for all its Insight, free.`, textStyle(12, TEXT.muted)));
  }
}
