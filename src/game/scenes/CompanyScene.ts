// Your company (session 5E), in the Capital: the troops you set out with on every run, each with
// a name, a rank and a record, and the artifact they carry. Between runs you equip your banked
// artifacts here (one per troop) and switch Ironman mode for the next run.
// ↑↓ pick a troop (or the Ironman line), ←→ change its artifact (or Ironman), Esc: the Capital.

import Phaser from 'phaser';
import { equip, equipProblem, freeArtifacts, ironmanProblem, veteranRank, withIronman } from '../../campaign/company';
import { fighterLabel, perksText, recordText } from '../../campaign/describe';
import type { Campaign, Veteran } from '../../campaign/types';
import { ARTIFACTS, type ArtifactId } from '../../data/artifacts';
import { FACTIONS } from '../../data/factions';
import { COMPANY_RULES } from '../../data/veterans';
import { drawFighter } from '../campaignUi';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { currentCampaign, saveCampaign } from '../session';
import { GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, addFrame, addHint, addTitle, textStyle } from '../ui';

const LIST_X = 16;
const LIST_W = 560;
const LIST_Y = TOP_BAR_HEIGHT + 34;
const ROW_H = 44;
const PANEL_X = LIST_X + LIST_W + 20;
const PANEL_W = GAME_WIDTH - PANEL_X - 16;

export class CompanyScene extends Phaser.Scene {
  private selected = 0;
  private message = '';
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Company');
  }

  init(): void {
    this.selected = 0;
    this.message = '';
  }

  create(): void {
    fitCamera(this);
    addTitle(this, 'YOUR COMPANY');
    // The details of what is picked, in a panel down the right.
    addFrame(this, PANEL_X - 12, TOP_BAR_HEIGHT + 8, GAME_WIDTH - PANEL_X + 6, GAME_HEIGHT - 12 - (TOP_BAR_HEIGHT + 8), 'panel');
    addHint(this, 16, 38, '↑↓ pick, ←→ change the artifact (or Ironman), Esc: back to the Capital.', '↑↓ pick, ←→ change the artifact (or Ironman), Ⓑ: back to the Capital.', textStyle(13, TEXT.muted));
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, '◀ Capital  Esc', () => this.scene.start('Capital'), 150, 34);
    this.ui = this.add.container(0, 0);
    new InputLayer(this)
      .on('up', () => this.select(this.selected - 1))
      .on('prev', () => this.select(this.selected - 1))
      .on('down', () => this.select(this.selected + 1))
      .on('next', () => this.select(this.selected + 1))
      .on('left', () => this.change(-1))
      .on('right', () => this.change(1))
      .on('confirm', () => this.change(1))
      .on('back', () => this.scene.start('Capital'))
      .on('company', () => this.scene.start('Capital'));
    this.render();
  }

  /** The rows: each company troop, then the Ironman line. */
  private rowCount(campaign: Campaign): number {
    return campaign.company.length + 1;
  }

  private select(i: number): void {
    const n = this.rowCount(currentCampaign());
    this.selected = (i + n) % n;
    this.message = '';
    this.render();
  }

  /** The chosen troop's artifact steps through none and every artifact free to give it; or Ironman switches. */
  private change(step: number): void {
    const campaign = currentCampaign();
    const vet = campaign.company[this.selected];
    if (!vet) {
      const problem = ironmanProblem(campaign);
      if (problem) this.message = problem;
      else void saveCampaign(withIronman(campaign, !campaign.ironman)).catch(() => undefined);
      this.render();
      return;
    }
    const choices: (ArtifactId | null)[] = [null, ...campaign.artifacts.filter((a) => a === vet.artifact || freeArtifacts(campaign).includes(a))];
    if (choices.length === 1) {
      this.message = campaign.artifacts.length === 0 ? 'No artifacts banked yet: find them in runs and bank them at a rest camp.' : 'Every banked artifact is on another troop.';
      this.render();
      return;
    }
    const i = choices.indexOf(vet.artifact);
    const next = choices[(i + step + choices.length) % choices.length]!;
    const problem = equipProblem(campaign, vet.id, next);
    if (problem) this.message = problem;
    else {
      void saveCampaign(equip(campaign, vet.id, next)).catch(() => undefined);
      this.message = '';
    }
    this.render();
  }

  private render(): void {
    this.ui.removeAll(true);
    const campaign = currentCampaign();
    const g = this.add.graphics();
    this.ui.add(g);
    this.ui.add(this.add.text(LIST_X, LIST_Y - 22, `${campaign.company.length} of ${COMPANY_RULES.size} · the first 5 take the field, the rest wait in reserve`, textStyle(12, TEXT.muted, true)));
    campaign.company.forEach((v, i) => {
      const y = LIST_Y + i * ROW_H;
      const on = i === this.selected;
      this.ui.add(this.rowBox(y, on, i));
      drawFighter(g, v.cls, v.rarity, LIST_X + 22, y + (ROW_H - 4) / 2, 1, 1, 'player', v.faction);
      const name = this.add.text(LIST_X + 46, y + 5, v.name, textStyle(14, TEXT.title, true));
      this.ui.add(name);
      this.ui.add(this.add.text(name.x + name.width + 8, y + 7, `${fighterLabel(v.cls, v.rarity, v.faction)} · ${veteranRank(v.record).name}`, textStyle(12, TEXT.rarity[v.rarity], true)));
      this.ui.add(this.add.text(LIST_X + 46, y + 23, `${v.record.battles} battles · ${v.record.kills} kills`, textStyle(11, TEXT.muted)));
      const artifact = v.artifact ? ARTIFACTS[v.artifact].name : 'No artifact';
      this.ui.add(this.add.text(LIST_X + LIST_W - 12, y + (ROW_H - 4) / 2, `◀  ${artifact}  ▶`, textStyle(12, v.artifact ? TEXT.gold : TEXT.muted, true)).setOrigin(1, 0.5));
    });
    if (campaign.company.length === 0) this.ui.add(this.add.text(LIST_X, LIST_Y, 'Nobody yet: fresh Recruits join when you set out.', textStyle(13, TEXT.muted)));
    // Ironman, for the next run.
    const iy = LIST_Y + campaign.company.length * ROW_H + 10;
    this.ui.add(this.rowBox(iy, this.selected === campaign.company.length, campaign.company.length));
    this.ui.add(this.add.text(LIST_X + 14, iy + 6, 'Ironman mode', textStyle(14, TEXT.title, true)));
    this.ui.add(this.add.text(LIST_X + 14, iy + 24, 'A troop that falls dies for good, instead of sitting out a fight.', textStyle(11, TEXT.muted)));
    this.ui.add(this.add.text(LIST_X + LIST_W - 12, iy + (ROW_H - 4) / 2, `◀  ${campaign.ironman ? 'On' : 'Off'}  ▶`, textStyle(13, campaign.ironman ? TEXT.defeat : TEXT.body, true)).setOrigin(1, 0.5));
    this.ui.bringToTop(g);
    this.renderPanel(campaign, campaign.company[this.selected]);
  }

  private rowBox(y: number, on: boolean, i: number): Phaser.GameObjects.Image {
    const box = addFrame(this, LIST_X, y, LIST_W, ROW_H - 4, on ? 'rowOn' : 'row').setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => (this.selected === i ? this.change(1) : this.select(i)));
    return box;
  }

  /** The chosen troop, or what Ironman means, and your free artifacts. */
  private renderPanel(campaign: Campaign, vet: Veteran | undefined): void {
    let y = LIST_Y - 22;
    const add = (text: string, size: number, color: string = TEXT.body, bold = false, gap = 6) => {
      const t = this.add.text(PANEL_X, y, text, { ...textStyle(size, color, bold), wordWrap: { width: PANEL_W } });
      this.ui.add(t);
      y += t.height + gap;
    };
    if (vet) {
      add(vet.name.toUpperCase(), 18, TEXT.title, true, 2);
      add(fighterLabel(vet.cls, vet.rarity, vet.faction), 13, TEXT.rarity[vet.rarity], true, 2);
      add(recordText(vet.record), 13, TEXT.body, false, 10);
      add('PERKS', 11, TEXT.muted, true, 2);
      add(vet.perks.length > 0 ? perksText(vet.perks) : 'None yet: each new rank (Veteran, Elite) brings one.', 12, TEXT.body, false, 10);
      if (vet.faction) add(`${FACTIONS[vet.faction].name} faction: counts toward its bonus in your army.`, 12, TEXT.faction[vet.faction], false, 10);
      add('ARTIFACT', 11, TEXT.muted, true, 2);
      add(vet.artifact ? `${ARTIFACTS[vet.artifact].name}: ${ARTIFACTS[vet.artifact].text}.` : 'None. ←→ to give it one of your banked artifacts.', 12, vet.artifact ? TEXT.gold : TEXT.body, false, 12);
    } else {
      add('IRONMAN MODE', 18, TEXT.title, true, 4);
      add('Set for each run when it begins. With it on, a troop that falls in a fight dies for good, and leaves your company. With it off, a fallen troop gets back up hurt and sits the next fight out.', 12, TEXT.body, false, 12);
    }
    const free = freeArtifacts(campaign);
    add('FREE ARTIFACTS', 11, TEXT.muted, true, 2);
    add(free.length > 0 ? free.map((a) => ARTIFACTS[a].name).join(', ') : 'None', 12, TEXT.gold, false, 12);
    if (campaign.run) add('Your company is out on a run: equip artifacts and switch Ironman between runs.', 12, TEXT.defeat, true);
    if (this.message) add(this.message, 12, TEXT.combo, true);
    this.ui.add(this.add.text(16, GAME_HEIGHT - 30, 'Fighters who finish a won run can join your company in place of others, up to 8.', textStyle(12, TEXT.muted)));
  }
}
