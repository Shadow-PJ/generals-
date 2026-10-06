// The Capital: your hub and the first screen. The world map shows the five regions around it,
// each ruled by a General; entering one starts a run that ends at its ruler. From here you also
// see your company and equip its artifacts, spend Insight on the Tech Web, pick your General,
// practise in skirmish, battle a friend in Versus (M), read the Codex, take Oaths of Command for
// your next run (O) and change the settings. ←→ (or Tab) pick a region, Enter sets out or
// carries on your run, Del abandons it.

import Phaser from 'phaser';
import { titles } from '../../campaign/mastery';
import { abandonRun, newRun, setOutProblem } from '../../campaign/run';
import { fearOf } from '../../data/oaths';
import { ARTIFACTS } from '../../data/artifacts';
import { GENERALS } from '../../data/generals';
import { LEGENDARY_ACTION_DATA, learnedActions } from '../../data/legendary';
import { MAPS } from '../../data/maps';
import { rankRules } from '../../data/ranks';
import { openRegions, REGION_IDS, REGIONS, type RegionId } from '../../data/regions';
import { UI_PIXEL } from '../art/frames';
import { cloudTexture, MAP_ART, medallionTexture, portraitKey, regionKey, worldMapTexture } from '../art/textures';
import type { WorldMapPlan } from '../art/worldMap';
import { keyLabel } from '../bindings';
import { runFloor, runNumbers } from '../campaignUi';
import { CaptainTips } from '../captain';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { rankForXp, rankProgress } from '../progress';
import { newSeed } from '../seed';
import { currentCampaign, currentXp, saveCampaign, savedSetup } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { sceneTips } from '../tutorial';
import { addButton, addFrame, addHint, addTitle, displayStyle, drawCornerMarks, textStyle } from '../ui';

/** The world map's picture on the screen. */
const MAP = { x: 14, y: 74, w: 576, h: 516 };
const MAP_CENTER = { x: 300, y: 350 };
const RING = 195;
/** A region's marker: its medallion, in art pixels across, and how far around it takes a click. */
const MEDALLION = 26;
const REGION_R = 34;
const PANEL_X = 616;
const PANEL_W = GAME_WIDTH - PANEL_X - 18;

/** The medallion's ring for each state of a region. */
const RINGS = {
  open: { light: 0xf3d27a, dark: 0x8a5a2b },
  cleared: { light: 0x86efac, dark: 0x2f7a4a },
  locked: { light: 0x8a8296, dark: 0x45404f },
  run: { light: 0xfff0b8, dark: 0xd9a74a },
} as const;

type Status = 'cleared' | 'open' | 'locked';

/** Where a region sits on the world map: around the Capital, clockwise from the top in unlock order. */
function regionPoint(i: number): { x: number; y: number } {
  const angle = ((-90 + (360 / REGION_IDS.length) * i) * Math.PI) / 180;
  return { x: MAP_CENTER.x + RING * Math.cos(angle), y: MAP_CENTER.y + RING * Math.sin(angle) };
}

/** A spot on the screen in the map picture's art pixels. */
function toMapArt(p: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.round((p.x - MAP.x) / UI_PIXEL), y: Math.round((p.y - MAP.y) / UI_PIXEL) };
}

/** The map's layout for its picture: the Capital and each region, in art pixels. */
function mapPlan(): WorldMapPlan {
  return {
    w: MAP.w / UI_PIXEL,
    h: MAP.h / UI_PIXEL,
    capital: toMapArt(MAP_CENTER),
    regions: REGION_IDS.map((region, i) => ({ region, ...toMapArt(regionPoint(i)) })),
  };
}

/** A color a little darker, for a medallion's middle. */
function shade(color: number, by: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * by);
  const g = Math.floor(((color >> 8) & 0xff) * by);
  const b = Math.floor((color & 0xff) * by);
  return (r << 16) | (g << 8) | b;
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
    addTitle(this, 'THE CAPITAL');
    addHint(this, 16, 38, '←→ region, Enter: set out.', '←→ region, Ⓐ: set out.', textStyle(13, TEXT.muted));
    addButton(this, GAME_WIDTH - 790, TOP_BAR_HEIGHT / 2, 'Versus  M', () => this.scene.start('Versus'), 104, 34);
    addButton(this, GAME_WIDTH - 680, TOP_BAR_HEIGHT / 2, 'Company  R', () => this.scene.start('Company'), 104, 34);
    addButton(this, GAME_WIDTH - 570, TOP_BAR_HEIGHT / 2, 'Tech Web  K', () => this.scene.start('Tech'), 104, 34);
    addButton(this, GAME_WIDTH - 460, TOP_BAR_HEIGHT / 2, 'General  G', () => this.open('Generals'), 104, 34);
    addButton(this, GAME_WIDTH - 350, TOP_BAR_HEIGHT / 2, 'Skirmish  T', () => this.scene.start('Prep'), 104, 34);
    addButton(this, GAME_WIDTH - 240, TOP_BAR_HEIGHT / 2, 'Codex  C', () => this.open('Codex'), 104, 34);
    addButton(this, GAME_WIDTH - 100, TOP_BAR_HEIGHT / 2, 'Settings  Esc', () => this.open('Settings'), 160, 34);
    this.createMap();
    addFrame(this, PANEL_X - 14, MAP.y - 8, PANEL_W + 26, MAP.h + 16, 'panel');
    // Markers, the panel and the footer: over the map and its fog.
    this.ui = this.add.container(0, 0).setDepth(6);

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
      .on('tech', () => this.scene.start('Tech'))
      .on('company', () => this.scene.start('Company'))
      .on('codex', () => this.open('Codex'))
      .on('oaths', () => this.scene.start('Oaths'))
      .on('versus', () => this.scene.start('Versus'))
      .on('back', () => this.open('Settings'));
    this.render();
    new CaptainTips(this, { x: PANEL_X, width: PANEL_W, top: 400 }).say(sceneTips('Capital'));
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

  /**
   * The world map: an island with the Capital's castle in the middle and the five regions
   * around it; regions still locked lie under drifting fog.
   */
  private createMap(): void {
    addFrame(this, MAP.x - 8, MAP.y - 8, MAP.w + 16, MAP.h + 16, 'panel');
    this.add.image(MAP.x, MAP.y, worldMapTexture(this, mapPlan())).setOrigin(0).setScale(UI_PIXEL);
    const castle = this.add.image(MAP_CENTER.x, MAP_CENTER.y + 18, MAP_ART.castle).setOrigin(0.5, 1).setScale(UI_PIXEL);
    this.add.ellipse(MAP_CENTER.x, MAP_CENTER.y + 16, 56, 10, 0x000000, 0.3).setDepth(castle.depth - 1);
    this.plate(MAP_CENTER.x, MAP_CENTER.y + 34, 'The Capital', TEXT.title);
    REGION_IDS.forEach((id, i) => {
      if (this.status(id) !== 'locked') return;
      const p = regionPoint(i);
      [-1, 1, 0].forEach((side, n) => {
        const cloud = this.add
          .image(p.x + side * 26, p.y - 8 + n * 14 - (side === 0 ? 0 : 6), cloudTexture(this, i * 3 + n))
          .setScale(UI_PIXEL)
          .setAlpha(0.9)
          .setDepth(5);
        this.tweens.add({ targets: cloud, x: cloud.x + 8 - n * 6, duration: 3200 + n * 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
    });
  }

  /** A name on a small plate, centered under a spot on the map. */
  private plate(x: number, y: number, name: string, color: string, container?: Phaser.GameObjects.Container): void {
    const text = this.add.text(x, y, name, textStyle(13, color, true)).setOrigin(0.5).setDepth(6);
    const plate = addFrame(this, x - text.width / 2 - 8, y - 11, text.width + 16, 22, 'plain').setDepth(6);
    text.setDepth(7);
    container?.add([plate, text]);
  }

  private render(): void {
    this.ui.removeAll(true);
    const campaign = currentCampaign();
    REGION_IDS.forEach((id, i) => {
      const p = regionPoint(i);
      const status = this.status(id);
      const here = campaign.run?.region === id;
      const ring = here ? RINGS.run : RINGS[status];
      const medallion = this.add.image(p.x, p.y, medallionTexture(this, MEDALLION, ring, shade(COLORS.region[id], status === 'locked' ? 0.3 : 0.55)));
      medallion.setScale(UI_PIXEL);
      const emblem = this.add.image(p.x, p.y, regionKey(id)).setScale(UI_PIXEL).setAlpha(status === 'locked' ? 0.45 : 1);
      const zone = this.add.zone(p.x, p.y, REGION_R * 2, REGION_R * 2).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => (this.selected === i ? this.go() : this.select(i)));
      this.ui.add([medallion, emblem, zone]);
      if (status === 'locked') this.ui.add(this.add.image(p.x + 17, p.y + 15, MAP_ART.lock).setScale(UI_PIXEL));
      if (status === 'cleared') this.ui.add(this.add.image(p.x + 17, p.y + 15, MAP_ART.cleared).setScale(UI_PIXEL));
      if (here) this.ui.add(this.add.image(p.x + 26, p.y - 4, MAP_ART.banner).setOrigin(0, 1).setScale(UI_PIXEL));
      this.plate(p.x, p.y + 40, REGIONS[id].name, status === 'locked' ? TEXT.muted : TEXT.title, this.ui);
      const label = here ? 'Your run' : { cleared: 'Cleared', open: 'Open', locked: 'Locked' }[status];
      const color = here ? TEXT.perfect : status === 'cleared' ? TEXT.victory : status === 'open' ? TEXT.gold : TEXT.muted;
      this.ui.add(this.add.text(p.x, p.y + 60, label, textStyle(11, color, true)).setOrigin(0.5).setDepth(7));
      if (i === this.selected) {
        // The region in focus: gold corner marks, and an arrow bobbing over it.
        const marks = this.add.graphics().setDepth(8);
        drawCornerMarks(marks, p.x - 32, p.y - 32, 64, 64);
        const arrow = this.add.image(p.x, p.y - 36, MAP_ART.arrow).setOrigin(0.5, 1).setScale(UI_PIXEL).setDepth(8);
        this.tweens.add({ targets: arrow, y: arrow.y - 6, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.ui.add([marks, arrow]);
      }
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
    // The ruler's portrait, beside the region's name.
    this.ui.add(addFrame(this, PANEL_X + PANEL_W - 58, y - 4, 58, 58, 'well'));
    this.ui.add(this.add.image(PANEL_X + PANEL_W - 5, y - 1, portraitKey(region.ruler)).setOrigin(1, 0).setScale(3));
    const name = this.add.text(PANEL_X - 2, y - 10, region.name, displayStyle(36, TEXT.title));
    this.ui.add(name);
    y += name.height - 12;
    add(`Ruled by ${GENERALS[region.ruler].name}`, 13, TEXT.threat, true, 10);
    add(MAPS[region.map].terrainText, 13, TEXT.body, false, 10);
    add('BEAT THE RULER FOR', 11, TEXT.muted, true, 2);
    add(region.reward, 13, TEXT.combo, false, 12);

    const run = campaign.run;
    if (run) {
      add('YOUR RUN', 11, TEXT.muted, true, 2);
      add(`${REGIONS[run.region].name} · ${runFloor(run)}`, 14, TEXT.perfect, true, 2);
      add(runNumbers(run), 12, TEXT.body, false, 2);
      add(`Fear ${fearOf(run.oaths)}`, 12, fearOf(run.oaths) > 0 ? TEXT.threat : TEXT.muted, true, 10);
      this.ui.add(addButton(this, PANEL_X + 90, y + 16, 'Carry on  ⏎', () => this.go(), 180, 34).container);
      this.ui.add(addButton(this, PANEL_X + 90, y + 58, 'Abandon run  Del', () => this.abandon(), 180, 30).container);
      y += 84;
      if (this.confirmAbandon) add(`Press ${keyLabel('clear')} again to give up the run. You lose the artifacts you carry; you keep your XP.`, 12, TEXT.defeat, true);
      return;
    }
    if (status === 'locked') {
      add('Locked. Beat another region’s ruler to open it.', 13, TEXT.muted, true);
      return;
    }
    if (status === 'cleared') add('Cleared: you can run it again for XP, but its ruler has nothing new to teach.', 12, TEXT.muted, false, 8);
    this.ui.add(addButton(this, PANEL_X + 90, y + 16, 'Set out  ⏎', () => this.go(), 180, 34).container);
    // Oaths of Command (session 5F): harder runs for more Insight.
    const fear = fearOf(campaign.oaths);
    this.ui.add(addButton(this, PANEL_X + 90, y + 58, 'Oaths of Command  O', () => this.scene.start('Oaths'), 180, 30).container);
    y += 84;
    add(`Fear ${fear}${fear > 0 ? ': harder, for more Insight' : ': no oaths taken'} · highest won here: ${campaign.fearRecords[id] ?? 'none yet'}`, 12, fear > 0 ? TEXT.threat : TEXT.muted, true);
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
    this.ui.add(addFrame(this, 4, y - 14, GAME_WIDTH - 8, GAME_HEIGHT - y + 10, 'panel'));
    const line = (x: number, title: string, text: string, color: string = TEXT.body) => {
      this.ui.add(this.add.text(x, y, title, textStyle(11, TEXT.muted, true)));
      this.ui.add(this.add.text(x, y + 16, text, { ...textStyle(13, color, true), wordWrap: { width: 290 } }));
    };
    const title = titles(campaign).at(-1);
    line(16, 'COMMAND RANK', `Rank ${rank.numeral} · ${rank.name}\n${next}\nInsight: ${campaign.insight}${title ? ` · ${title}` : ''}`);
    line(330, 'LEGENDARY ACTIONS', learned.length > 0 ? learned.join(', ') : 'None yet: beat a ruler', TEXT.combo);
    line(640, 'BANKED ARTIFACTS', banked.length > 0 ? banked.join(', ') : 'None yet: bank them at a camp', TEXT.gold);
  }
}
