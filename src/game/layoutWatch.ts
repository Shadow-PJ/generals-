// Runs the layout check (session 7E) in development builds: on every screen a moment after it
// opens, printing what it finds to the console as "[layout] Capital: …". The browser's console
// can also call __layoutCheck() to check the screens open now, after moving around on one, and
// __layoutItems() to list the words and buttons the check sees.

import Phaser from 'phaser';
import { layoutProblems, type LayoutBox, type LayoutButton, type LayoutItems } from './layoutCheck';
import { GAME_HEIGHT, GAME_WIDTH } from './theme';

/** How long after a screen opens it is checked: once it has drawn and faded in. */
const CHECK_DELAY_MS = 500;

/**
 * Marks an object as free to overlap others, and for a container everything in it: words that
 * float over the battle, a tip laid over the screen on purpose.
 */
export function layoutFree<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData('layoutFree', true);
  return object;
}

/** Marks a container as a button `w × h` around its middle, for the check (ui.ts does it for every button). */
export function markButton(container: Phaser.GameObjects.Container, label: string, w: number, h: number): void {
  container.setData('button', { label, w, h });
}

const boxOf = (label: string, r: Phaser.Geom.Rectangle): LayoutBox => ({ label, x: r.x, y: r.y, w: r.width, h: r.height });

function shows(o: Phaser.GameObjects.GameObject): boolean {
  const seen = o as Partial<Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.Alpha>;
  return seen.visible !== false && (seen.alpha === undefined || seen.alpha > 0.05) && !o.getData('layoutFree');
}

/** The words and buttons a screen shows now. */
export function screenLayout(scene: Phaser.Scene): LayoutItems {
  const texts: LayoutBox[] = [];
  const buttons: LayoutButton[] = [];
  const walk = (list: readonly Phaser.GameObjects.GameObject[]) => {
    for (const o of list) {
      if (!shows(o)) continue;
      if (o instanceof Phaser.GameObjects.Container) {
        const button = o.getData('button') as { label: string; w: number; h: number } | undefined;
        if (!button) {
          walk(o.list);
          continue;
        }
        const m = o.getWorldTransformMatrix();
        const label = o.list.find((c): c is Phaser.GameObjects.Text => c instanceof Phaser.GameObjects.Text);
        buttons.push({
          label: button.label,
          x: m.tx - button.w / 2,
          y: m.ty - button.h / 2,
          w: button.w,
          h: button.h,
          text: label ? boxOf(label.text, label.getBounds()) : null,
        });
      } else if (o instanceof Phaser.GameObjects.Text && o.text.trim() !== '') {
        texts.push(boxOf(o.text.replace(/\s+/g, ' '), o.getBounds()));
      }
    }
  };
  walk(scene.children.list);
  return { texts, buttons };
}

/** What is wrong with the layout of the screens open now, each line naming its screen. */
export function checkScreens(game: Phaser.Game): string[] {
  return game.scene
    .getScenes(true)
    .flatMap((scene) => layoutProblems(screenLayout(scene), { w: GAME_WIDTH, h: GAME_HEIGHT }).map((p) => `${scene.scene.key}: ${p}`));
}

/** Checks each screen a moment after it opens, and gives the console __layoutCheck(). */
export function watchLayout(game: Phaser.Game, scene: Phaser.Scene): void {
  const debug = window as { __layoutCheck?: () => string[]; __layoutItems?: () => unknown };
  debug.__layoutCheck = () => checkScreens(game);
  debug.__layoutItems = () => game.scene.getScenes(true).map((s) => ({ scene: s.scene.key, ...screenLayout(s) }));
  scene.time.delayedCall(CHECK_DELAY_MS, () => {
    const problems = layoutProblems(screenLayout(scene), { w: GAME_WIDTH, h: GAME_HEIGHT });
    for (const problem of problems) console.warn(`[layout] ${scene.scene.key}: ${problem}`);
  });
}
