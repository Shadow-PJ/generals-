// Choosing your General: who reads your cards, and what your troops can do in battle (troop
// skill, doctrine, ultimate and mana twist). You start with the Captain; each region's ruler
// joins you once you beat them at the end of a run (session 5D). Every General can be read here,
// but only those you have can lead. Up and Down pick one, Enter leads with them, Esc goes back.

import Phaser from 'phaser';
import { recruitedGenerals } from '../../data/bosses';
import { GENERAL_IDS, GENERALS, type GeneralId } from '../../data/generals';
import { REGIONS, regionOf } from '../../data/regions';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { remember } from '../session';
import { COLORS, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle } from '../ui';

const LIST_X = 16;
const LIST_W = 270;
const ROW_H = 62;
const PANEL_X = LIST_X + LIST_W + 20;
const PANEL_W = GAME_WIDTH - PANEL_X - 16;

export class GeneralsScene extends Phaser.Scene {
  private setup!: MatchSetup;
  private selected = 0;
  private boxes: Phaser.GameObjects.Rectangle[] = [];
  private panel!: Phaser.GameObjects.Container;
  private recruited: GeneralId[] = [];
  private lead!: Phaser.GameObjects.Text;

  constructor() {
    super('Generals');
  }

  init(data: MatchSetup): void {
    this.setup = data;
    this.recruited = recruitedGenerals(data.bossesBeaten);
    this.selected = Math.max(0, GENERAL_IDS.indexOf(data.general));
    this.boxes = [];
  }

  create(): void {
    fitCamera(this);
    this.add.text(16, 10, 'CHOOSE YOUR GENERAL', textStyle(18, TEXT.title, true));
    this.add.text(16, 38, 'Beat a region’s ruler to recruit them. ↑↓ pick, Enter: lead with them, Esc: back.', textStyle(13, TEXT.muted));
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, 'Back  Esc', () => this.goBack(), 150, 34);

    GENERAL_IDS.forEach((id, i) => {
      const y = TOP_BAR_HEIGHT + 12 + i * ROW_H;
      const box = this.add.rectangle(LIST_X, y, LIST_W, ROW_H - 8, 0x1d2939).setOrigin(0).setStrokeStyle(1, 0x34465e);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.selected === i) this.choose();
        else this.select(i);
      });
      this.boxes.push(box);
      const general = GENERALS[id];
      this.add.text(LIST_X + 12, y + 8, general.name, textStyle(15, TEXT.title, true));
      this.add.text(LIST_X + 12, y + 30, general.faction ?? 'No faction', textStyle(12, TEXT.muted));
      if (id === this.setup.general) this.add.text(LIST_X + LIST_W - 12, y + 10, 'Leading', textStyle(12, TEXT.victory, true)).setOrigin(1, 0);
      else if (!this.recruited.includes(id)) this.add.text(LIST_X + LIST_W - 12, y + 10, 'Locked', textStyle(12, TEXT.muted, true)).setOrigin(1, 0);
    });

    this.panel = this.add.container(0, 0);
    const buttonY = TOP_BAR_HEIGHT + 12 + GENERAL_IDS.length * ROW_H - 22;
    addButton(this, PANEL_X + 110, buttonY, 'Lead with them  ⏎', () => this.choose(), 220, 34);
    this.lead = this.add.text(PANEL_X + 236, buttonY, '', textStyle(13, TEXT.muted)).setOrigin(0, 0.5);

    new InputLayer(this)
      .on('up', () => this.select(this.selected - 1))
      .on('down', () => this.select(this.selected + 1))
      .on('prev', () => this.select(this.selected - 1))
      .on('next', () => this.select(this.selected + 1))
      .on('confirm', () => this.choose())
      .on('back', () => this.goBack())
      .on('general', () => this.goBack());
    this.select(this.selected);
  }

  private select(index: number): void {
    const n = GENERAL_IDS.length;
    this.selected = (index + n) % n;
    this.boxes.forEach((box, i) => {
      const on = i === this.selected;
      box.setFillStyle(on ? 0x2b3a50 : 0x1d2939).setStrokeStyle(on ? 2 : 1, on ? COLORS.selected : 0x34465e);
    });
    const id = GENERAL_IDS[this.selected]!;
    this.showGeneral(id);
    this.lead.setText(this.recruited.includes(id) ? '' : lockedText(id));
  }

  /** The chosen General's parts, top to bottom in the panel on the right. */
  private showGeneral(id: GeneralId): void {
    const general = GENERALS[id];
    this.panel.removeAll(true);
    let y = TOP_BAR_HEIGHT + 12;
    const add = (text: string, size: number, color: string, bold = false, gap = 6) => {
      const label = this.add.text(PANEL_X, y, text, { ...textStyle(size, color, bold), wordWrap: { width: PANEL_W } });
      this.panel.add(label);
      y += label.height + gap;
    };
    add(`${general.name}${general.faction ? ` · ${general.faction}` : ''}`, 22, TEXT.title, true, 4);
    add(general.motto, 13, TEXT.muted, false, 16);
    const parts: [string, string][] = [
      ['TROOP SKILL', general.troopSkill ? `${general.troopSkill.name}: ${general.troopSkill.text}` : 'None'],
      ['DOCTRINE', general.doctrine],
      ['ULTIMATE (U)', `${general.ultimate.name}: ${general.ultimate.text}`],
      ['MANA TWIST', general.twist ? `${general.twist.name}: ${general.twist.text}` : 'None: the standard rules'],
      ['WRITES YOUR CARDS', general.writes],
    ];
    for (const [title, text] of parts) {
      add(title, 12, TEXT.muted, true, 2);
      add(text, 14, TEXT.body, false, 14);
    }
  }

  private choose(): void {
    const general = GENERAL_IDS[this.selected]!;
    if (!this.recruited.includes(general)) {
      this.cameras.main.shake(120, 0.004);
      return;
    }
    const setup = { ...this.setup, general };
    void remember(setup).catch(() => undefined);
    this.scene.start(setup.returnTo ?? 'Prep', setup);
  }

  private goBack(): void {
    this.scene.start(this.setup.returnTo ?? 'Prep', this.setup);
  }
}

/** Where to beat a General you don't have yet. */
function lockedText(id: GeneralId): string {
  const region = regionOf(id);
  return region ? `Locked: beat ${GENERALS[id].name} at the end of a ${REGIONS[region].name} run.` : 'Locked.';
}
