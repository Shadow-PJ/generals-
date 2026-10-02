// Settings: fullscreen, window size, resolution, and where your saves are kept.
// ↑↓ pick a line, ←→ change it, Enter uses it, Esc goes back. The mouse works too.

import Phaser from 'phaser';
import { RESOLUTIONS, type Resolution } from '../../save/settings';
import { currentRenderScale, fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import {
  availableWindowScales,
  changeSettings,
  chosenWindowScale,
  currentPlatform,
  currentSettings,
  toggleFullscreen,
} from '../session';
import { GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle } from '../ui';

const ROWS_X = 60;
const ROWS_Y = TOP_BAR_HEIGHT + 40;
const ROW_H = 74;
const VALUE_X = 260;
const VALUE_W = 420;

interface Row {
  label: string;
  value: string;
  note: string;
  /** ←→ (or the arrows) change the value; missing when it can't be changed here. */
  change?: (step: number) => void;
  /** Enter (or a click on the value) uses the line. */
  use?: () => void;
}

export class SettingsScene extends Phaser.Scene {
  /** The setup to hand back to the troop screen. */
  private setup!: MatchSetup;
  private row = 0;
  private ui!: Phaser.GameObjects.Container;
  private shownFullscreen = false;
  private shownScale = 1;

  constructor() {
    super('Settings');
  }

  init(data: MatchSetup): void {
    this.setup = data;
    this.row = 0;
  }

  create(): void {
    fitCamera(this);
    this.add.text(16, 10, 'SETTINGS', textStyle(18, TEXT.title, true));
    this.add.text(16, 38, '↑↓ pick a line, ←→ change it, Enter uses it, Esc goes back. F11 switches fullscreen anywhere.', textStyle(12, TEXT.muted));
    addButton(this, 16 + 70, GAME_HEIGHT - 34, '◀ Back  Esc', () => this.goBack(), 140, 32);
    this.ui = this.add.container(0, 0);

    new InputLayer(this)
      .on('up', () => this.moveRow(-1))
      .on('down', () => this.moveRow(1))
      .on('left', () => this.change(-1))
      .on('right', () => this.change(1))
      .on('confirm', () => this.use())
      .on('back', () => this.goBack());

    this.render();
  }

  override update(): void {
    // Fullscreen can change from outside this screen (F11, or Esc in a browser), and the
    // resolution follows the window size; redraw when either moves.
    const display = currentPlatform().display;
    if (display.isFullscreen() !== this.shownFullscreen || currentRenderScale() !== this.shownScale) this.render();
  }

  private rows(): Row[] {
    const platform = currentPlatform();
    const display = platform.display;
    const settings = currentSettings();
    const fullscreen = display.isFullscreen();
    const rows: Row[] = [];

    rows.push({
      label: 'Display',
      value: display.canFullscreen ? (fullscreen ? 'Fullscreen' : 'Windowed') : 'Windowed (fullscreen not available)',
      note: 'Fullscreen fills the whole screen; the game keeps its shape with bars at the sides if needed.',
      ...(display.canFullscreen && { change: () => this.act(toggleFullscreen()), use: () => this.act(toggleFullscreen()) }),
    });

    const scales = availableWindowScales();
    const scale = chosenWindowScale();
    if (scales.length > 0 && scale !== null) {
      rows.push({
        label: 'Window size',
        value: `${Math.round(GAME_WIDTH * scale)} × ${Math.round(GAME_HEIGHT * scale)}`,
        note: fullscreen ? 'Used when you go back to a window.' : 'Only sizes that fit your screen are offered. You can also drag the window’s edges.',
        change: (step) => {
          const i = Math.max(0, Math.min(scales.length - 1, scales.indexOf(scale) + step));
          this.act(this.setWindowScale(scales[i]!));
        },
      });
    } else {
      rows.push({ label: 'Window size', value: 'Set by your browser window', note: 'Resize the browser window, or use fullscreen.' });
    }

    rows.push({
      label: 'Resolution',
      value: resolutionLabel(settings.resolution),
      note: 'Auto draws as many pixels as the window shows, so text stays sharp. 100% is lightest for slow computers.',
      change: (step) => {
        const i = (RESOLUTIONS.indexOf(settings.resolution) + step + RESOLUTIONS.length) % RESOLUTIONS.length;
        this.act(changeSettings({ resolution: RESOLUTIONS[i]! }), () => this.game.events.emit('settings-changed'));
      },
    });

    const openFolder = platform.openSaveFolder;
    rows.push({
      label: 'Saves',
      value: platform.saveFolder ?? 'Kept in this browser',
      note: openFolder
        ? 'Your cards and troops are saved here as you change them. Enter opens the folder.'
        : 'Your cards and troops are saved as you change them. Clearing this site’s data deletes them.',
      ...(openFolder && { use: openFolder }),
    });

    const quit = platform.quit;
    if (quit) rows.push({ label: 'Quit', value: 'Quit to desktop', note: 'Your cards are already saved.', use: quit });
    return rows;
  }

  private async setWindowScale(scale: number): Promise<void> {
    await changeSettings({ windowScale: scale });
    const display = currentPlatform().display;
    if (!display.isFullscreen()) await display.setWindowSize(Math.round(GAME_WIDTH * scale), Math.round(GAME_HEIGHT * scale));
  }

  /** Runs a settings change, then redraws. A failed save just leaves the setting for this session. */
  private act(done: Promise<void>, after?: () => void): void {
    done
      .catch(() => undefined)
      .then(() => {
        after?.();
        if (this.scene.isActive()) this.render();
      });
  }

  private moveRow(step: number): void {
    this.row = Math.max(0, Math.min(this.rows().length - 1, this.row + step));
    this.render();
  }

  private change(step: number): void {
    this.rows()[this.row]?.change?.(step);
  }

  private use(): void {
    this.rows()[this.row]?.use?.();
  }

  private goBack(): void {
    this.scene.start('Prep', this.setup);
  }

  private render(): void {
    this.shownFullscreen = currentPlatform().display.isFullscreen();
    this.shownScale = currentRenderScale();
    this.ui.removeAll(true);
    this.rows().forEach((r, i) => {
      const y = ROWS_Y + i * ROW_H;
      const selected = i === this.row;
      if (selected) this.ui.add(this.add.rectangle(ROWS_X - 12, y - 10, GAME_WIDTH - 2 * ROWS_X + 24, ROW_H - 8, 0x2b3a50).setOrigin(0));
      this.ui.add(this.add.text(ROWS_X, y, r.label, textStyle(15, selected ? TEXT.title : TEXT.body, true)));
      const valueStyle = { ...textStyle(14, r.change || r.use ? TEXT.body : TEXT.muted), wordWrap: { width: VALUE_W - 40 } };
      const value = this.add.text(VALUE_X + VALUE_W / 2, y + 1, r.value, valueStyle).setOrigin(0.5, 0);
      this.ui.add(value);
      if (r.use) {
        const use = r.use;
        value.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.row = i;
          use();
        });
      }
      if (r.change) {
        const change = r.change;
        const left = this.add.text(VALUE_X, y, '◀', textStyle(15)).setInteractive({ useHandCursor: true });
        const right = this.add.text(VALUE_X + VALUE_W, y, '▶', textStyle(15)).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        left.on('pointerdown', () => {
          this.row = i;
          change(-1);
        });
        right.on('pointerdown', () => {
          this.row = i;
          change(1);
        });
        this.ui.add([left, right]);
      }
      this.ui.add(this.add.text(ROWS_X, y + 30, r.note, { ...textStyle(12, TEXT.muted), wordWrap: { width: GAME_WIDTH - 2 * ROWS_X } }));
    });
  }
}

function resolutionLabel(resolution: Resolution): string {
  if (resolution === 'auto') return `Auto (now ${Math.round(currentRenderScale() * 100)}%)`;
  return `${resolution * 100}%  (${GAME_WIDTH * resolution} × ${GAME_HEIGHT * resolution})`;
}
