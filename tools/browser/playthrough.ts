// Plays the built game by keyboard, the way a player would, and reports what went wrong
// (session 7H): every page error and console error, and any screen it got stuck on. It sets out
// on runs, fights (firing every card and the ultimate as it goes), takes what the stops offer
// and carries on. A screenshot of each new screen goes to the output folder.
//
//   npm run build
//   npm run playthrough -- [--minutes 20] [--profile save.json] [--out playthrough]
//
// Exits with 1 when it saw an error or got stuck.

import { mkdirSync } from 'node:fs';
import { argValue, launchGame, PROFILE_KEY, press, readProfile, topScene } from './launch';

const minutes = Number(argValue('minutes') ?? 20);
const out = argValue('out') ?? 'playthrough';
/** Screens a playthrough has no business on: it leaves them. */
const SIDE_SCREENS = new Set(['Generals', 'Settings', 'Codex', 'Tech', 'Company', 'Oaths', 'Versus', 'Troops']);
/** Tries without progress before a screen counts as stuck (the battle is left to run). */
const STUCK_AFTER = 40;

async function main(): Promise<void> {
  mkdirSync(out, { recursive: true });
  const start = Date.now();
  const clock = () => `${Math.round((Date.now() - start) / 1000)}s`.padStart(5);
  const game = await launchGame({ width: 1280, height: 940, profile: readProfile(argValue('profile')) });
  const { page } = game;
  page.on('pageerror', (error) => console.log(clock(), 'PAGE ERROR', String(error)));
  const visits: Record<string, number> = {};
  const stuckOn: string[] = [];
  let last = '';
  let lastScene = '';
  let tries = 0;
  /** Steps on the same screen, progress or not: a stop that keeps changing but never ends is left. */
  let onScene = 0;
  let shots = 0;
  let slot = 0;
  while (Date.now() - start < minutes * 60_000) {
    const scene = await topScene(page);
    const save = await page.evaluate((key) => localStorage.getItem(key) ?? '', PROFILE_KEY);
    // Progress is a new screen or a changed save.
    const state = `${scene}:${save.length}:${save.slice(-300)}`;
    tries = state === last ? tries + 1 : 0;
    last = state;
    onScene = scene === lastScene ? onScene + 1 : 0;
    if (scene !== lastScene) {
      lastScene = scene;
      visits[scene] = (visits[scene] ?? 0) + 1;
      console.log(clock(), '->', scene);
      await page.screenshot({ path: `${out}/${String(shots++).padStart(3, '0')}-${scene}.png` });
      if (scene === 'Battle') await press(page, 'f', 100);
    }
    if (scene !== 'Battle' && tries === STUCK_AFTER) {
      console.log(clock(), 'STUCK on', scene);
      stuckOn.push(scene);
      await page.screenshot({ path: `${out}/${String(shots++).padStart(3, '0')}-stuck-${scene}.png` });
      break;
    }
    if (scene === 'Battle') {
      slot = (slot % 5) + 1;
      await press(page, String(slot), 600);
      await press(page, 'u', 200);
    } else if (scene === 'Orders') await press(page, 'b', 1500);
    else if (scene === 'Stop') {
      // The option the cursor starts on; failing that, the next ones; at last, leave.
      if (tries >= 8 || onScene >= 30) await press(page, 'Escape', 600);
      else if (tries >= 2) {
        await press(page, 'ArrowDown', 200);
        await press(page, 'Enter', 600);
      } else await press(page, 'Enter', 700);
    } else if (SIDE_SCREENS.has(scene)) await press(page, 'Escape', 700);
    else await press(page, 'Enter', 900);
  }
  await page.screenshot({ path: `${out}/zz-last.png` });
  const errors = [...game.errors];
  await game.close();
  console.log('\nScreens visited:', Object.entries(visits).map(([s, n]) => `${s} ${n}`).join(', '));
  console.log(`Errors: ${errors.length}`);
  for (const error of errors.slice(0, 20)) console.log('  ', error);
  if (stuckOn.length > 0) console.log('Stuck on:', stuckOn.join(', '));
  process.exitCode = errors.length > 0 || stuckOn.length > 0 ? 1 : 0;
}

await main();
