// The Captain's tip panel (session 6A): a small box with the Captain's words, placed where it
// covers the least of each screen. It never takes a key: it fades by itself after a while, or at
// a click, so the screen under it works as before. A tip is marked seen the moment it shows.

import Phaser from 'phaser';
import type { GeneralId } from '../data/generals';
import { TUTORIAL_RULES } from '../data/tutorial';
import { portraitKey } from './art/textures';
import { currentTutorial, saveTutorial } from './session';
import { COLORS, TEXT } from './theme';
import { nextTip, seeTip, tipText, type TipCall } from './tutorial';
import { textStyle } from './ui';

/** Where the panel goes: its left edge and width, and its top (or its bottom, growing upward). */
export interface TipPlace {
  x: number;
  width: number;
  top?: number;
  bottom?: number;
}

const PAD = 10;
/** The Captain's portrait: 16 art pixels at 2 each. */
const BADGE = 32;

export class CaptainTips {
  private panel: Phaser.GameObjects.Container | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  /** The tutorial as saved; only this screen changes it while it is open. */
  private tutorial = currentTutorial();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly place: TipPlace,
    /** Whose ultimate a tip names. */
    private readonly general: GeneralId = 'captain',
  ) {
    scene.events.once('shutdown', () => this.hide());
  }

  /** True while a tip is on screen. */
  get showing(): boolean {
    return this.panel !== null;
  }

  /**
   * Says the first of these tips that is still unseen, if tips are on, and marks it seen.
   * Nothing happens while another tip is showing. True when one shows.
   */
  say(calls: readonly TipCall[], seconds: number = TUTORIAL_RULES.tipSeconds): boolean {
    if (this.showing) return false;
    const call = nextTip(this.tutorial, calls);
    if (!call) return false;
    this.tutorial = seeTip(this.tutorial, call.id);
    void saveTutorial(this.tutorial).catch(() => undefined);
    this.show(tipText(call, this.general), seconds);
    return true;
  }

  private show(text: string, seconds: number): void {
    const { x, width } = this.place;
    const scene = this.scene;
    const words = scene.add.text(PAD + BADGE + 10, PAD + 18, text, { ...textStyle(13, TEXT.body), wordWrap: { width: width - PAD * 2 - BADGE - 10 } });
    const height = Math.max(words.y + words.height, PAD + BADGE) + PAD + 14;
    const box = scene.add.rectangle(0, 0, width, height, COLORS.background, 0.95).setOrigin(0).setStrokeStyle(1, COLORS.glow);
    const badge = scene.add.rectangle(PAD - 2, PAD - 2, BADGE + 4, BADGE + 4, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.glow);
    const portrait = scene.add.image(PAD, PAD, portraitKey('captain')).setOrigin(0).setScale(BADGE / 16);
    const name = scene.add.text(PAD + BADGE + 10, PAD, 'THE CAPTAIN', textStyle(12, TEXT.gold, true));
    const hint = scene.add.text(width - PAD, height - PAD + 2, 'click to close · tips can be turned off in Settings', textStyle(10, TEXT.muted)).setOrigin(1, 1);
    const top = this.place.top ?? (this.place.bottom ?? height) - height;
    this.panel = scene.add.container(x, top, [box, badge, portrait, name, words, hint]).setDepth(1000);
    box.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.hide());
    this.panel.setAlpha(0);
    scene.tweens.add({ targets: this.panel, alpha: 1, duration: 200 });
    this.timer = scene.time.delayedCall(seconds * 1000, () => this.fade());
  }

  private fade(): void {
    const panel = this.panel;
    if (!panel) return;
    this.scene.tweens.add({ targets: panel, alpha: 0, duration: 400, onComplete: () => this.hide() });
  }

  hide(): void {
    this.timer?.remove();
    this.timer = null;
    this.panel?.destroy();
    this.panel = null;
  }
}
