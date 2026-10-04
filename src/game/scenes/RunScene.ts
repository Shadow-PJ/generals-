// A run's map: floors of nodes from left to right, ending at the region's ruler. You pick your
// path one node at a time; what waits at a node (a fight, an event, the merchant, a camp) opens
// when you get there. Your army, gold, boons and the artifacts you carry are shown below.
// ←→ (or Tab) pick a node you can reach, Enter goes there, Esc goes back to the Capital and the
// run waits for you.

import Phaser from 'phaser';
import { NODE_NAMES, NODE_TEXT } from '../../campaign/describe';
import { enterNode } from '../../campaign/run';
import { currentNode, nextChoices } from '../../campaign/runMap';
import type { RunState } from '../../campaign/types';
import { ARTIFACTS } from '../../data/artifacts';
import { BOONS } from '../../data/boons';
import { REGIONS } from '../../data/regions';
import type { NodeKind } from '../../data/runs';
import { drawBoon, drawFighter, runFloor } from '../campaignUi';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { currentCampaign, saveCampaign } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle } from '../ui';

const MAP_LEFT = 70;
const MAP_RIGHT = GAME_WIDTH - 70;
const MAP_MIDDLE = 300;
const ROW_GAP = 88;
const NODE_R = 17;
const FOOTER_Y = GAME_HEIGHT - 150;

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
    this.add.text(16, 10, `${REGIONS[run.region].name.toUpperCase()} · RUN`, textStyle(18, TEXT.title, true));
    this.add.text(16, 38, '←→ pick your path, Enter: go there. Esc: back to the Capital; your run waits.', textStyle(13, TEXT.muted));
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, '◀ Capital  Esc', () => this.scene.start('Capital'), 150, 34);
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
          g.lineStyle(walked ? 4 : 2, walked ? COLORS.glow : ahead ? COLORS.selected : COLORS.fieldLine, walked ? 0.9 : ahead ? 0.6 : 1);
          g.lineBetween(from.x, from.y, to.x, to.y);
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
        if (isHere) g.lineStyle(3, COLORS.glow, 1).strokeCircle(p.x, p.y, NODE_R + 6);
        if (reachable) g.lineStyle(2, COLORS.selected, 0.7).strokeCircle(p.x, p.y, NODE_R + 5);
        if (reachable && i === picked) g.lineStyle(4, COLORS.selected, 1).strokeCircle(p.x, p.y, NODE_R + 8);
        if (reachable || node.kind === 'boss') {
          const zone = this.add.zone(p.x, p.y, NODE_R * 3, NODE_R * 3).setInteractive({ useHandCursor: reachable });
          if (reachable) zone.on('pointerdown', () => (i === picked ? this.go(i) : ((this.choice = choices.indexOf(i)), this.render())));
          this.ui.add(zone);
        }
        const label = this.add.text(p.x, p.y + NODE_R + 6, NODE_NAMES[node.kind], textStyle(11, reachable ? TEXT.title : TEXT.muted, reachable)).setOrigin(0.5, 0);
        this.ui.add(label.setAlpha(Math.max(alpha, 0.5)));
        if (node.kind === 'event' || node.kind === 'merchant') {
          this.ui.add(this.add.text(p.x, p.y, node.kind === 'event' ? '?' : '$', textStyle(16, '#0b0f16', true)).setOrigin(0.5).setAlpha(alpha));
        }
      }),
    );

    // What you are about to do.
    const lineY = FOOTER_Y - 40;
    let headline: string;
    let detail: string;
    if (run.stop && here) {
      headline = `Waiting for you here: ${NODE_NAMES[here.node.kind]}`;
      detail = 'Press Enter to carry on.';
    } else if (picked !== undefined) {
      const kind = run.map[run.path.length]![picked]!.kind;
      headline = `${NODE_NAMES[kind]}  ·  Enter to go`;
      detail = NODE_TEXT[kind];
    } else {
      headline = 'The run is over.';
      detail = '';
    }
    this.ui.add(this.add.text(16, lineY, headline, textStyle(15, TEXT.perfect, true)));
    this.ui.add(this.add.text(16, lineY + 20, detail, textStyle(12, TEXT.body)));
    this.ui.add(this.add.text(GAME_WIDTH - 16, lineY, runFloor(run), textStyle(13, TEXT.muted, true)).setOrigin(1, 0));
    this.renderFooter(run);
  }

  /** A node's mark: its kind's color, with a sign for fights, camps and the boss. */
  private drawNode(g: Phaser.GameObjects.Graphics, kind: NodeKind, x: number, y: number, alpha: number): void {
    const r = kind === 'boss' ? NODE_R + 6 : NODE_R;
    g.fillStyle(COLORS.node[kind], alpha).fillCircle(x, y, r);
    g.lineStyle(2, 0x0b0f16, alpha).strokeCircle(x, y, r);
    const ink = 0x0b0f16;
    if (kind === 'battle' || kind === 'elite') {
      g.lineStyle(3, ink, alpha).lineBetween(x - 7, y - 7, x + 7, y + 7).lineBetween(x - 7, y + 7, x + 7, y - 7);
      if (kind === 'elite') g.lineStyle(2, COLORS.node.elite, alpha).strokeCircle(x, y, r + 4);
    } else if (kind === 'camp') {
      g.fillStyle(ink, alpha).fillTriangle(x, y - 8, x - 9, y + 7, x + 9, y + 7);
    } else if (kind === 'boss') {
      g.fillStyle(ink, alpha).fillTriangle(x - 11, y + 6, x - 11, y - 6, x - 4, y + 1);
      g.fillTriangle(x - 5, y + 6, x, y - 10, x + 5, y + 6);
      g.fillTriangle(x + 11, y + 6, x + 11, y - 6, x + 4, y + 1);
      g.fillRect(x - 11, y + 4, 22, 4);
    }
  }

  /** Your army, gold, boons and carried artifacts. */
  private renderFooter(run: RunState): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1).fillRect(0, FOOTER_Y, GAME_WIDTH, GAME_HEIGHT - FOOTER_Y);
    this.ui.add(g);
    const y = FOOTER_Y + 10;
    this.ui.add(this.add.text(16, y, `YOUR ARMY · ${run.field.length} on the field, ${run.reserves.length} in reserve, ${run.roster.length} in all`, textStyle(11, TEXT.muted, true)));
    run.roster.slice(0, 15).forEach((f, i) => {
      const x = 30 + i * 36;
      const resting = !run.field.includes(f.id) && !run.reserves.includes(f.id);
      drawFighter(g, f.cls, f.rarity, x, y + 36, f.hp, resting ? 0.45 : 1);
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
