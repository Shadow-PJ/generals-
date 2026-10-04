// The Capital: your hub and the first screen. The world map shows the five regions around it,
// each ruled by a General; entering one starts a run that ends at its ruler. From here you also
// pick your General, practise in skirmish, read the Codex and change the settings.
// ←→ (or Tab) pick a region, Enter sets out or carries on your run, Del abandons it.

import Phaser from 'phaser';
import { abandonRun, newRun, setOutProblem } from '../../campaign/run';
import { ARTIFACTS } from '../../data/artifacts';
import { GENERALS } from '../../data/generals';
import { LEGENDARY_ACTION_DATA, learnedActions } from '../../data/legendary';
import { MAPS } from '../../data/maps';
import { rankRules } from '../../data/ranks';
import { openRegions, REGION_IDS, REGIONS, type RegionId } from '../../data/regions';
import { runFloor, runNumbers } from '../campaignUi';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { rankForXp, rankProgress } from '../progress';
import { newSeed } from '../seed';
import { currentCampaign, currentXp, saveCampaign, savedSetup } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle } from '../ui';

const MAP_CENTER = { x: 300, y: 350 };
const RING = 195;
const REGION_R = 44;
const PANEL_X = 610;
const PANEL_W = GAME_WIDTH - PANEL_X - 16;

type Status = 'cleared' | 'open' | 'locked';

/** Where a region sits on the world map: around the Capital, clockwise from the top in unlock order. */
function regionPoint(i: number): { x: number; y: number } {
  const angle = ((-90 + (360 / REGION_IDS.length) * i) * Math.PI) / 180;
  return { x: MAP_CENTER.x + RING * Math.cos(angle), y: MAP_CENTER.y + RING * Math.sin(angle) };
}

export class CapitalScene extends Phaser.Scene {
  private selected = 0;
  private ui!: Phaser.GameObjects.Container;
  /** Del was pressed once: the next press abandons the run. */
  private confirmAbandon = false;

  constructor() {
    super('Capital');
  }

  init(): void {
    const campaign = currentCampaign();
    const open = openRegions(campaign.bossesBeaten);
    const fresh = open.find((id) => !campaign.bossesBeaten.includes(REGIONS[id].ruler));
    this.selected = REGION_IDS.indexOf(campaign.run?.region ?? fresh ?? open[0]!);
    this.confirmAbandon = false;
  }

  create(): void {
    fitCamera(this);
    this.add.text(16, 10, 'THE CAPITAL', textStyle(18, TEXT.title, true));
    this.add.text(16, 38, '←→ pick a region, Enter: set out.', textStyle(13, TEXT.muted));
    addButton(this, GAME_WIDTH - 506, TOP_BAR_HEIGHT / 2, 'General  G', () => this.open('Generals'), 112, 34);
    addButton(this, GAME_WIDTH - 384, TOP_BAR_HEIGHT / 2, 'Skirmish  T', () => this.scene.start('Prep'), 112, 34);
    addButton(this, GAME_WIDTH - 262, TOP_BAR_HEIGHT / 2, 'Codex  C', () => this.open('Codex'), 112, 34);
    addButton(this, GAME_WIDTH - 110, TOP_BAR_HEIGHT / 2, 'Settings  Esc', () => this.open('Settings'), 170, 34);
    this.ui = this.add.container(0, 0);

    new InputLayer(this)
      .on('left', () => this.select(this.selected - 1))
      .on('up', () => this.select(this.selected - 1))
      .on('prev', () => this.select(this.selected - 1))
      .on('right', () => this.select(this.selected + 1))
      .on('down', () => this.select(this.selected + 1))
      .on('next', () => this.select(this.selected + 1))
      .on('confirm', () => this.go())
      .on('clear', () => this.abandon())
      .on('troops', () => this.scene.start('Prep'))
      .on('general', () => this.open('Generals'))
      .on('codex', () => this.open('Codex'))
      .on('back', () => this.open('Settings'));
    this.render();
  }

  /** The General, Codex and Settings screens, which come back here. */
  private open(scene: 'Generals' | 'Codex' | 'Settings'): void {
    this.scene.start(scene, { ...savedSetup(), returnTo: 'Capital' });
  }

  private select(i: number): void {
    this.selected = (i + REGION_IDS.length) % REGION_IDS.length;
    this.confirmAbandon = false;
    this.render();
  }

  private status(id: RegionId): Status {
    const campaign = currentCampaign();
    if (campaign.bossesBeaten.includes(REGIONS[id].ruler)) return 'cleared';
    return openRegions(campaign.bossesBeaten).includes(id) ? 'open' : 'locked';
  }

  /** Carries on your run, or sets out into the chosen region. */
  private go(): void {
    const campaign = currentCampaign();
    if (campaign.run) {
      this.scene.start('Run');
      return;
    }
    const region = REGION_IDS[this.selected]!;
    if (setOutProblem(campaign, region)) return;
    void saveCampaign(newRun(campaign, region, newSeed())).catch(() => undefined);
    this.scene.start('Run');
  }

  /** Gives up the run on the second press: the artifacts you carry are lost. */
  private abandon(): void {
    const campaign = currentCampaign();
    if (!campaign.run) return;
    if (!this.confirmAbandon) {
      this.confirmAbandon = true;
      this.render();
      return;
    }
    void saveCampaign(abandonRun(campaign)).catch(() => undefined);
    this.scene.start('Stop');
  }

  private render(): void {
    this.ui.removeAll(true);
    const campaign = currentCampaign();
    const g = this.add.graphics();
    this.ui.add(g);

    // The world map: the Capital in the middle, the regions around it.
    REGION_IDS.forEach((_, i) => {
      const p = regionPoint(i);
      g.lineStyle(3, COLORS.fieldLine, 1).lineBetween(MAP_CENTER.x, MAP_CENTER.y, p.x, p.y);
    });
    g.fillStyle(COLORS.capital, 1).fillCircle(MAP_CENTER.x, MAP_CENTER.y, 34);
    g.lineStyle(3, 0x7c5f22, 1).strokeCircle(MAP_CENTER.x, MAP_CENTER.y, 34);
    this.ui.add(this.add.text(MAP_CENTER.x, MAP_CENTER.y + 42, 'THE CAPITAL', textStyle(12, TEXT.title, true)).setOrigin(0.5, 0));

    REGION_IDS.forEach((id, i) => {
      const p = regionPoint(i);
      const status = this.status(id);
      const here = campaign.run?.region === id;
      g.fillStyle(COLORS.region[id], status === 'locked' ? 0.25 : 1).fillCircle(p.x, p.y, REGION_R);
      if (status === 'cleared') g.lineStyle(4, COLORS.hpGood, 1).strokeCircle(p.x, p.y, REGION_R);
      if (here) g.lineStyle(4, COLORS.glow, 1).strokeCircle(p.x, p.y, REGION_R + 5);
      if (i === this.selected) g.lineStyle(3, COLORS.selected, 1).strokeCircle(p.x, p.y, REGION_R + (here ? 11 : 6));
      const zone = this.add.zone(p.x, p.y, REGION_R * 2, REGION_R * 2).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => (this.selected === i ? this.go() : this.select(i)));
      const name = this.add.text(p.x, p.y - 8, REGIONS[id].name, textStyle(13, status === 'locked' ? TEXT.muted : TEXT.title, true)).setOrigin(0.5);
      const label = here ? 'Your run' : { cleared: 'Cleared', open: 'Open', locked: 'Locked' }[status];
      const color = here ? TEXT.perfect : status === 'cleared' ? TEXT.victory : TEXT.muted;
      const note = this.add.text(p.x, p.y + 10, label, textStyle(11, color, true)).setOrigin(0.5);
      this.ui.add([zone, name, note]);
    });

    this.renderPanel();
    this.renderFooter();
  }

  /** The chosen region, and your run if you are on one. */
  private renderPanel(): void {
    const campaign = currentCampaign();
    const id = REGION_IDS[this.selected]!;
    const region = REGIONS[id];
    const status = this.status(id);
    let y = TOP_BAR_HEIGHT + 16;
    const add = (text: string, size: number, color: string = TEXT.body, bold = false, gap = 6) => {
      const t = this.add.text(PANEL_X, y, text, { ...textStyle(size, color, bold), wordWrap: { width: PANEL_W } });
      this.ui.add(t);
      y += t.height + gap;
    };
    add(region.name.toUpperCase(), 20, TEXT.title, true, 2);
    add(`Ruled by ${GENERALS[region.ruler].name}`, 13, TEXT.threat, true, 10);
    add(MAPS[region.map].terrainText, 13, TEXT.body, false, 10);
    add('BEAT THE RULER FOR', 11, TEXT.muted, true, 2);
    add(region.reward, 13, TEXT.combo, false, 12);

    const run = campaign.run;
    if (run) {
      add('YOUR RUN', 11, TEXT.muted, true, 2);
      add(`${REGIONS[run.region].name} · ${runFloor(run)}`, 14, TEXT.perfect, true, 2);
      add(runNumbers(run), 12, TEXT.body, false, 10);
      this.ui.add(addButton(this, PANEL_X + 90, y + 16, 'Carry on  ⏎', () => this.go(), 180, 34).container);
      this.ui.add(addButton(this, PANEL_X + 90, y + 58, 'Abandon run  Del', () => this.abandon(), 180, 30).container);
      y += 84;
      if (this.confirmAbandon) add('Press Del again to give up the run. You lose the artifacts you carry; you keep your XP.', 12, TEXT.defeat, true);
      return;
    }
    if (status === 'locked') {
      add('Locked. Beat another region’s ruler to open it.', 13, TEXT.muted, true);
      return;
    }
    if (status === 'cleared') add('Cleared: you can run it again for XP, but its ruler has nothing new to teach.', 12, TEXT.muted, false, 8);
    this.ui.add(addButton(this, PANEL_X + 90, y + 16, 'Set out  ⏎', () => this.go(), 180, 34).container);
  }

  /** Your rank, the Legendary actions you know and your banked artifacts. */
  private renderFooter(): void {
    const campaign = currentCampaign();
    const y = GAME_HEIGHT - 88;
    const xp = currentXp();
    const rank = rankRules(rankForXp(xp));
    const progress = rankProgress(xp);
    const next = progress ? `${progress.into}/${progress.span} XP to the next rank` : 'the highest rank';
    const learned = learnedActions(campaign.bossesBeaten).map((a) => LEGENDARY_ACTION_DATA[a].name);
    const banked = campaign.artifacts.map((a) => ARTIFACTS[a].name);
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1).fillRect(0, y - 10, GAME_WIDTH, GAME_HEIGHT - y + 10);
    this.ui.add(g);
    const line = (x: number, title: string, text: string, color: string = TEXT.body) => {
      this.ui.add(this.add.text(x, y, title, textStyle(11, TEXT.muted, true)));
      this.ui.add(this.add.text(x, y + 16, text, { ...textStyle(13, color, true), wordWrap: { width: 290 } }));
    };
    line(16, 'COMMAND RANK', `Rank ${rank.numeral} · ${rank.name}\n${next}`);
    line(330, 'LEGENDARY ACTIONS', learned.length > 0 ? learned.join(', ') : 'None yet: beat a ruler', TEXT.combo);
    line(640, 'BANKED ARTIFACTS', banked.length > 0 ? banked.join(', ') : 'None yet: bank them at a camp', TEXT.gold);
  }
}
