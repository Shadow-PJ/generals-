// What every screen does as it opens (session 6B): it fades in from the dark, and the right
// music plays: the Capital's theme on the menus; the battle sets its own. With a controller in
// hand (session 6C), a small corner note says View reaches the screen's buttons.

import Phaser from 'phaser';
import { playMusic } from './audio/audio';
import type { TrackId } from './audio/music';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT } from './theme';
import { addHint, textStyle } from './ui';

/** The music each screen asks for; screens left out keep whatever is playing. */
const SCENE_MUSIC: Readonly<Record<string, TrackId | null>> = {
  Capital: 'capital',
  Run: 'capital',
  Army: 'capital',
  Stop: 'capital',
  Tech: 'capital',
  Company: 'capital',
  Prep: 'capital',
  Orders: 'capital',
  Troops: 'capital',
  Generals: 'capital',
  Oaths: 'capital',
};

/** Screens drawn over another (the result over the battle) don't fade in; the Boot screen is gone at once. */
const NO_FADE = new Set(['Boot', 'Result']);
const FADE_MS = 180;

/** Hooks every scene of the game: call once, before the first screen opens. */
export function watchScenes(game: Phaser.Game): void {
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.getScenes(false)) scene.events.on(Phaser.Scenes.Events.CREATE, () => entered(scene));
  });
}

function entered(scene: Phaser.Scene): void {
  const key = scene.scene.key;
  const music = SCENE_MUSIC[key];
  if (music !== undefined) playMusic(music);
  if (key !== 'Boot') addHint(scene, GAME_WIDTH - 8, GAME_HEIGHT - 4, '', 'View: buttons', textStyle(11, TEXT.muted)).setOrigin(1, 1).setDepth(950);
  if (!NO_FADE.has(key)) {
    const c = COLORS.background;
    scene.cameras.main.fadeIn(FADE_MS, (c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
  }
}
