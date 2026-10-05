// A run's map: floors of nodes from left to right, ending at the region's ruler. You pick your
// path one node at a time; what waits at a node (an event, the merchant, a camp) opens when you
// get there, but a fight is scouted (session 5F): picking it shows the army that waits. Your army, gold, boons and the artifacts you carry are shown below.
// ←→ (or Tab) pick a node you can reach, Enter goes there, Esc goes back to the Capital and the
// run waits for you.

import Phaser from 'phaser';
import { NODE_NAMES, NODE_TEXT, scoutText } from '../../campaign/describe';
import { nodeEncounter } from '../../campaign/encounters';
import { enterNode } from '../../campaign/run';
import { currentNode, nextChoices } from '../../campaign/runMap';
import type { RunState } from '../../campaign/types';
import { ARTIFACTS } from '../../data/artifacts';
import { BOONS } from '../../data/boons';
import { fearOf } from '../../data/oaths';
import { REGIONS } from '../../data/regions';
import type { NodeKind } from '../../data/runs';
import { NODE_ICONS } from '../art/icons';
import { keyLabel } from '../bindings';
import { paintCentered } from '../art/paint';
import { BASE } from '../art/palette';
import { drawBoon, drawFighter, runFloor } from '../campaignUi';
import { CaptainTips } from '../captain';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { currentCampaign, saveCampaign } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { sceneTips } from '../tutorial';
import { addButton, addFrame, addHint, addPlate, addTitle, drawCornerMarks, textStyle } from '../ui';
import { UI_PIXEL } from '../art/frames';
import { MAP_ART, medallionTexture, regionLandTexture } from '../art/textures';

const MAP_LEFT = 70;
const MAP_RIGHT = GAME_WIDTH - 70;
const MAP_MIDDLE = 300;
const ROW_GAP = 88;
const NODE_R = 17;
const FOOTER_Y = GAME_HEIGHT - 150;
/** The region's land under the road. */
const LAND = { x: 14, y: 76, w: GAME_WIDTH - 28, h: 400 };
/** A stop's medallion, in art pixels across: the ruler's is bigger. */
const MEDALLION = 20;
const BOSS_MEDALLION = 26;
/** The dots of a road, and how far apart. */
const ROAD_DOT = 4;
const ROAD_STEP = 10;
const ROAD = { plain: 0xb8995d, walked: 0xf3d27a, ahead: 0xfff6dc } as const;

/** A color a little darker. */
function shade(color: number, by: number): number {
  return (Math.floor(((color >> 16) & 0xff) * by) << 16) | (Math.floor(((color >> 8) & 0xff) * by) << 8) | Math.floor((color & 0xff) * by);
}

function nodePoint(run: RunState, floor: number, index: number): { x: number; y: number } {
  const count = run.map[floor]!.length;
  const step = (MAP_RIGHT - MAP_LEFT) / Math.max(1, run.map.length - 1);
  return { x: MAP_LEFT + floor * step, y: MAP_MIDDLE + (index - (count - 1) / 2) * ROW_GAP };
}

export class RunScene extends Phaser.Scene {
  private choice = 0;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Run');
  }

  init(): void {
    this.choice = 0;
  }

  create(): void {
    fitCamera(this);
    const run = currentCampaign().run;
    if (!run) {
      this.scene.start('Capital');
      return;
    }
    addTitle(this, `${REGIONS[run.region].name.toUpperCase()} · RUN`);
    addHint(this, 16, 38, '←→ pick your path, Enter: go there. Esc: back to the Capital; your run waits.', '←→ pick your path, Ⓐ: go there. Ⓑ: back to the Capital; your run waits.', textStyle(13, TEXT.muted));
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, '◀ Capital  Esc', () => this.scene.start('Capital'), 150, 34);
    addFrame(this, LAND.x - 8, LAND.y - 8, LAND.w + 16, LAND.h + 16, 'panel');
    this.add.image(LAND.x, LAND.y, regionLandTexture(this, LAND.w, LAND.h, run.region)).setOrigin(0).setScale(UI_PIXEL);
    this.ui = this.add.container(0, 0);
    new InputLayer(this)
      .on('left', () => this.pick(-1))
      .on('up', () => this.pick(-1))
      .on('prev', () => this.pick(-1))
      .on('right', () => this.pick(1))
      .on('down', () => this.pick(1))
      .on('next', () => this.pick(1))
      .on('confirm', () => this.go())
      .on('back', () => this.scene.start('Capital'));
    this.render();
    new CaptainTips(this, { x: GAME_WIDTH - 376, width: 360, bottom: GAME_HEIGHT - 8 }).say(sceneTips('Run'));
  }

  private run(): RunState {
    return currentCampaign().run!;
  }

  private pick(step: number): void {
    const choices = nextChoices(this.run());
    if (choices.length === 0 || this.run().stop) return;
    this.choice = (this.choice + step + choices.length) % choices.length;
    this.render();
  }

  /** Carries on with what waits at your node, or goes to the node you picked. */
  private go(index?: number): void {
    const campaign = currentCampaign();
    const run = campaign.run!;
    if (run.stop) {
      this.scene.start(run.stop.kind === 'fight' ? 'Army' : 'Stop');
      return;
    }
    const choices = nextChoices(run);
    const target = index ?? choices[this.choice];
    if (target === undefined || !choices.includes(target)) return;
    const next = enterNode(campaign, target);
    void saveCampaign(next).catch(() => undefined);
    this.scene.start(next.run!.stop?.kind === 'fight' ? 'Army' : 'Stop');
  }

  private render(): void {
    this.ui.removeAll(true);
    const run = this.run();
    const g = this.add.graphics();
    this.ui.add(g);
    const choices = run.stop ? [] : nextChoices(run);
    const picked = choices[this.choice];
    const taken = (floor: number, index: number) => run.path[floor] === index;

    // Paths first, the ones you took brighter.
    run.map.forEach((floor, f) =>
      floor.forEach((node, i) => {
        const from = nodePoint(run, f, i);
        for (const j of node.next) {
          const to = nodePoint(run, f + 1, j);
          const walked = taken(f, i) && taken(f + 1, j);
          const ahead = f + 1 === run.path.length && taken(f, i) && choices.includes(j);
          this.drawRoad(g, from, to, walked ? ROAD.walked : ahead ? ROAD.ahead : ROAD.plain, walked || ahead ? 1 : 0.75);
        }
      }),
    );

    const here = currentNode(run);
    run.map.forEach((floor, f) =>
      floor.forEach((node, i) => {
        const p = nodePoint(run, f, i);
        const reachable = f === run.path.length && choices.includes(i);
        const isHere = here?.floor === f && here.index === i;
        // Nodes behind you fade: the ones you passed by most, the ones you took a little.
        const alpha = isHere || reachable ? 1 : f < run.path.length ? (taken(f, i) ? 0.55 : 0.3) : 0.8;
        this.drawNode(g, node.kind, p.x, p.y, alpha);
        // Where you stand: your banner. Where you can go: a soft gold ring; the one picked, gold corner marks.
        if (isHere) this.ui.add(this.add.image(p.x + 14, p.y - 8, MAP_ART.banner).setOrigin(0, 1).setScale(UI_PIXEL));
        if (reachable) g.lineStyle(2, COLORS.glow, 0.55).strokeCircle(p.x, p.y, NODE_R + 6);
        if (reachable && i === picked) {
          const marks = this.add.graphics();
          drawCornerMarks(marks, p.x - NODE_R - 9, p.y - NODE_R - 9, NODE_R * 2 + 18, NODE_R * 2 + 18);
          const arrow = this.add.image(p.x, p.y - NODE_R - 12, MAP_ART.arrow).setOrigin(0.5, 1).setScale(UI_PIXEL);
          this.tweens.add({ targets: arrow, y: arrow.y - 5, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
          this.ui.add([marks, arrow]);
        }
        if (reachable || node.kind === 'boss') {
          const zone = this.add.zone(p.x, p.y, NODE_R * 3, NODE_R * 3).setInteractive({ useHandCursor: reachable });
          if (reachable) zone.on('pointerdown', () => (i === picked ? this.go(i) : ((this.choice = choices.indexOf(i)), this.render())));
          this.ui.add(zone);
        }
        const [plate, label] = addPlate(this, p.x, p.y + NODE_R + (node.kind === 'boss' ? 22 : 15), NODE_NAMES[node.kind], textStyle(11, reachable ? TEXT.title : TEXT.body, reachable));
        this.ui.add([plate.setAlpha(Math.max(alpha, 0.6)), label.setAlpha(Math.max(alpha, 0.6))]);
      }),
    );

    // What you are about to do.
    const lineY = FOOTER_Y - 40;
    let headline: string;
    let detail: string;
    if (run.stop && here) {
      headline = `Waiting for you here: ${NODE_NAMES[here.node.kind]}`;
      detail = `Press ${keyLabel('confirm')} to carry on.`;
    } else if (picked !== undefined) {
      const kind = run.map[run.path.length]![picked]!.kind;
      headline = `${NODE_NAMES[kind]}  ·  ${keyLabel('confirm')} to go`;
      // Scouting: a fight shows the army that waits there, before you choose.
      const scouted = nodeEncounter(run, run.path.length, picked);
      detail = scouted ? `Scouted: ${scoutText(scouted)}` : NODE_TEXT[kind];
      if (scouted) {
        const troops = [...scouted.troops, ...scouted.reserves];
        troops.slice(0, 10).forEach((t, i) => drawFighter(g, t.cls, t.rarity ?? 'common', 440 + i * 30, lineY + 10, 1, i < scouted.troops.length ? 1 : 0.45, 'enemy'));
      }
    } else {
      headline = 'The run is over.';
      detail = '';
    }
    this.ui.add(this.add.text(16, lineY, headline, textStyle(15, TEXT.perfect, true)));
    this.ui.add(this.add.text(16, lineY + 20, detail, textStyle(12, TEXT.body)));
    const fear = fearOf(run.oaths);
    this.ui.add(this.add.text(GAME_WIDTH - 16, lineY, `${runFloor(run)}${fear > 0 ? `  ·  Fear ${fear}` : ''}`, textStyle(13, fear > 0 ? TEXT.threat : TEXT.muted, true)).setOrigin(1, 0));
    this.renderFooter(run);
  }

  /** A road between two stops: a line of dirt dots with dark edges. */
  private drawRoad(g: Phaser.GameObjects.Graphics, from: { x: number; y: number }, to: { x: number; y: number }, color: number, alpha: number): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const dots = Math.floor((length - NODE_R * 2) / ROAD_STEP);
    for (let i = 0; i <= dots; i++) {
      const t = (NODE_R + i * ROAD_STEP + (length - NODE_R * 2 - dots * ROAD_STEP) / 2) / length;
      const x = Math.round((from.x + dx * t) / 2) * 2;
      const y = Math.round((from.y + dy * t) / 2) * 2;
      g.fillStyle(0x0e0b12, 0.7 * alpha).fillRect(x - ROAD_DOT / 2 - 2, y - ROAD_DOT / 2 - 2, ROAD_DOT + 4, ROAD_DOT + 4);
      g.fillStyle(color, alpha).fillRect(x - ROAD_DOT / 2, y - ROAD_DOT / 2, ROAD_DOT, ROAD_DOT);
    }
  }

  /** A stop's mark: a medallion in its kind's color, with its sign in the middle. */
  private drawNode(g: Phaser.GameObjects.Graphics, kind: NodeKind, x: number, y: number, alpha: number): void {
    const color = COLORS.node[kind];
    const size = kind === 'boss' ? BOSS_MEDALLION : MEDALLION;
    const medallion = this.add.image(x, y, medallionTexture(this, size, { light: color, dark: shade(color, 0.55) }, shade(color, 0.32)));
    this.ui.addAt(medallion.setScale(UI_PIXEL).setAlpha(alpha), this.ui.getIndex(g));
    // The stop's pixel-art icon in the middle.
    paintCentered(g, NODE_ICONS[kind].frames.still!, BASE, x, y, { scale: kind === 'boss' ? 2 : UI_PIXEL, alpha });
  }


  /** Your army, gold, boons and carried artifacts. */
  private renderFooter(run: RunState): void {
    this.ui.add(addFrame(this, 4, FOOTER_Y, GAME_WIDTH - 8, GAME_HEIGHT - FOOTER_Y - 4, 'panel'));
    const g = this.add.graphics();
    this.ui.add(g);
    const y = FOOTER_Y + 10;
    this.ui.add(this.add.text(16, y, `YOUR ARMY · ${run.field.length} on the field, ${run.reserves.length} in reserve, ${run.roster.length} in all`, textStyle(11, TEXT.muted, true)));
    run.roster.slice(0, 15).forEach((f, i) => {
      const x = 30 + i * 36;
      const resting = !run.field.includes(f.id) && !run.reserves.includes(f.id);
      drawFighter(g, f.cls, f.rarity, x, y + 36, f.hp, resting ? 0.45 : 1, 'player', f.faction);
    });
    if (run.roster.length > 15) this.ui.add(this.add.text(30 + 15 * 36, y + 28, `+${run.roster.length - 15}`, textStyle(12, TEXT.muted)));

    const right = 590;
    this.ui.add(this.add.text(right, y, 'GOLD', textStyle(11, TEXT.muted, true)));
    this.ui.add(this.add.text(right, y + 15, `${run.gold}`, textStyle(18, TEXT.gold, true)));
    this.ui.add(this.add.text(right + 70, y, 'BOONS', textStyle(11, TEXT.muted, true)));
    run.boons.slice(0, 8).forEach((b, i) => drawBoon(g, b, right + 82 + i * 28, y + 28));
    const boonNames = run.boons.map((b) => BOONS[b].name).join(', ');
    this.ui.add(this.add.text(right + 70, y + 44, boonNames || 'None yet', { ...textStyle(11, TEXT.body), wordWrap: { width: GAME_WIDTH - right - 86 } }));
    const carried = run.artifacts.map((a) => ARTIFACTS[a].name);
    this.ui.add(
      this.add.text(16, y + 72, carried.length > 0 ? `CARRYING: ${carried.join(', ')}. Bank them at a rest camp, or lose them if the run is lost.` : 'Artifacts you find are carried until you bank them at a rest camp or win the run.', {
        ...textStyle(12, carried.length > 0 ? TEXT.gold : TEXT.muted, carried.length > 0),
        wordWrap: { width: 560 },
      }),
    );
  }
}
