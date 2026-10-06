// The title screen (after the visual overhaul): dusk over the realm, the Capital's castle on its
// hill against the setting sun, your army and the enemy's facing each other in front of it, and
// the game's name. Any key, click or button goes on to the Capital. It shows once, when the game
// starts.

import Phaser from 'phaser';
import type { UnitClass } from '../../data/units';
import type { Side } from '../../sim';
import { UI_PIXEL } from '../art/frames';
import { FX, MAP_ART, titleTexture, troopKey } from '../art/textures';
import { titleLayout } from '../art/title';
import { KEYBOARD_BINDINGS, type InputAction } from '../bindings';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT } from '../theme';
import { addHint, displayStyle, textStyle } from '../ui';

/** Troops on the title, by rank from the middle out: a front of Vanguards and Guardians, then Rangers and Invokers. */
const RANKS: readonly (readonly UnitClass[])[] = [
  ['vanguard', 'guardian', 'vanguard'],
  ['ranger', 'invoker', 'ranger', 'assassin'],
  ['ranger', 'vanguard', 'guardian'],
];
/** Art pixels per troop pixel: the armies stand in front, so they are drawn big. */
const TROOP_SCALE = 3;
/** How long the screen takes to fade before the Capital opens, in milliseconds. */
const LEAVE_MS = 320;

export class TitleScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super('Title');
  }

  init(): void {
    this.leaving = false;
  }

  create(): void {
    fitCamera(this);
    this.add.image(0, 0, titleTexture(this, GAME_WIDTH, GAME_HEIGHT)).setOrigin(0).setScale(UI_PIXEL);
    const layout = titleLayout(GAME_WIDTH / UI_PIXEL, GAME_HEIGHT / UI_PIXEL);
    const hill = { x: layout.hill.x * UI_PIXEL, y: layout.hill.y * UI_PIXEL };
    this.add.ellipse(hill.x, hill.y + 2, 140, 14, 0x000000, 0.35);
    this.add.image(hill.x, hill.y + 4, MAP_ART.castle).setOrigin(0.5, 1).setScale(UI_PIXEL * 2);
    this.addArmy('player');
    this.addArmy('enemy');
    this.addEmbers();

    // The name, in gold that darkens toward its foot, landing as the screen opens.
    const name = this.add.text(GAME_WIDTH / 2, 96, 'Generals', displayStyle(108, '#f3d27a')).setOrigin(0.5);
    const gold = name.context.createLinearGradient(0, 0, 0, name.height / name.scaleY);
    gold.addColorStop(0.25, '#fff2bf');
    gold.addColorStop(0.75, '#d9a74a');
    gold.addColorStop(1, '#9a6326');
    name.setFill(gold);
    name.setScale(1.4).setAlpha(0);
    this.tweens.add({ targets: name, scale: 1, alpha: 1, duration: 700, ease: 'Back.Out' });
    const tagline = this.add.text(GAME_WIDTH / 2, 168, 'Write the orders. Fire the cards. Win the war.', textStyle(16, TEXT.title)).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: tagline, alpha: 1, delay: 500, duration: 600 });

    const prompt = addHint(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, 'Press any key', 'Press any button', textStyle(18, TEXT.perfect, true)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Every key, button and click goes on, except the one that switches fullscreen.
    const input = new InputLayer(this);
    for (const action of Object.keys(KEYBOARD_BINDINGS) as InputAction[]) if (action !== 'fullscreen') input.on(action, () => this.leave());
    input.on('menu', () => this.leave());
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => event.code !== 'F11' && this.leave());
    this.input.on('pointerdown', () => this.leave());
  }

  /** An army in ranks on its side of the screen, facing the other, its banner behind it. */
  private addArmy(side: Side): void {
    const toward = side === 'player' ? 1 : -1;
    const middle = GAME_WIDTH / 2;
    const baseY = GAME_HEIGHT - 150;
    const shadows = this.add.graphics();
    RANKS.forEach((rank, r) => {
      rank.forEach((cls, i) => {
        // Ranks step back from the middle and down toward the viewer; troops in a rank spread along it.
        const x = middle - toward * (150 + r * 70 + (i % 2) * 22);
        const y = baseY + i * 30 - r * 6;
        shadows.fillStyle(0x000000, 0.35).fillEllipse(x, y + 22, 40, 10);
        const troop = this.add.image(x, y, troopKey(cls, side), 'stand').setScale(TROOP_SCALE).setFlipX(side === 'enemy').setDepth(y);
        // Each breathes in its own time.
        this.tweens.add({ targets: troop, y: y - 2, duration: 700 + ((r * 3 + i) % 4) * 120, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: (r * 5 + i * 3) * 70 });
      });
    });
    const banner = this.add
      .image(middle - toward * 330, baseY - 20, side === 'player' ? MAP_ART.banner : MAP_ART.enemyBanner)
      .setOrigin(0, 1)
      .setScale(TROOP_SCALE + 1)
      .setFlipX(side === 'enemy')
      .setDepth(baseY - 31);
    this.tweens.add({ targets: banner, angle: toward * 2, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** Embers rising from the field into the dusk. */
  private addEmbers(): void {
    this.add
      .particles(0, 0, FX.dot, {
        x: { min: 0, max: GAME_WIDTH },
        y: GAME_HEIGHT + 10,
        lifespan: { min: 5000, max: 9000 },
        speedY: { min: -60, max: -25 },
        speedX: { min: -12, max: 12 },
        scale: { min: 0.5, max: 1.1 },
        alpha: { values: [0, 0.9, 0.6, 0], interpolation: 'linear' },
        tint: [0xffb24a, 0xf2541b, 0xfff0b8],
        frequency: 120,
        blendMode: 'ADD',
        advance: 6000,
      })
      .setDepth(GAME_HEIGHT);
  }

  /** On to the Capital, once, after a short fade. */
  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    const c = COLORS.background;
    this.cameras.main.fadeOut(LEAVE_MS, (c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Capital'));
  }
}
