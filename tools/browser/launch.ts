// Opens the built game in a browser for the scripts that play it (session 7H): serves `dist`
// with Vite's preview server, starts Chromium through Playwright and loads the game with its
// test hook (`?smoke`). Build first (`npm run build`). Chromium comes from
// `npx playwright install chromium`, or set CHROMIUM_PATH to a Chrome or Chromium of your own.

import { readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { preview } from 'vite';

/** The game's test hook, on the page's window (see src/game/main.ts). */
export type SmokeWindow = { __smoke?: { scenes(): string[]; fps(): number } };

/** The save the game keeps in the browser's local storage. */
export const PROFILE_KEY = 'generals/saves/profile.json';

export interface GameWindow {
  page: Page;
  /** Every page error and console error or warning, in order. */
  errors: string[];
  close(): Promise<void>;
}

export interface LaunchOptions {
  width: number;
  height: number;
  /** A save to start from (a profile file's text); a new profile when left out. */
  profile?: string | null;
  /** Settings to start from (a settings file's text), for example with the Captain's tips off. */
  settings?: string | null;
  /** Called with each console line, for scripts that print them. */
  onConsole?: (type: string, text: string) => void;
}

/** Reads a profile file for `LaunchOptions.profile`, or null for none. */
export function readProfile(path: string | undefined): string | null {
  return path ? readFileSync(path, 'utf8') : null;
}

/** The value after `--name` on the command line, if there is one. */
export function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function launchGame(options: LaunchOptions): Promise<GameWindow> {
  const server = await preview({ preview: { port: 4180, strictPort: false, open: false }, logLevel: 'warn' });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('The preview server did not start: run npm run build first');
  let browser: Browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      // Software WebGL, so it runs on machines and CI runners without a GPU.
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
    });
  } catch (error) {
    await server.close();
    throw new Error(`Chromium did not start (run npx playwright install chromium, or set CHROMIUM_PATH): ${String(error)}`);
  }
  const page = await browser.newPage({ viewport: { width: options.width, height: options.height } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`);
    options.onConsole?.(message.type(), message.text());
  });
  // The save and settings are put in place once, before the game first reads them.
  await page.addInitScript(
    ({ key, profile, settings }) => {
      if (sessionStorage.getItem('seeded')) return;
      if (profile) localStorage.setItem(key, profile);
      if (settings) localStorage.setItem('generals/settings.json', settings);
      sessionStorage.setItem('seeded', '1');
    },
    { key: PROFILE_KEY, profile: options.profile ?? null, settings: options.settings ?? null },
  );
  await page.goto(`${url}?smoke`);
  await page.waitForFunction(() => (globalThis as SmokeWindow).__smoke?.scenes().includes('Title'), null, { timeout: 60_000 });
  return {
    page,
    errors,
    close: async () => {
      await browser.close();
      await server.close();
    },
  };
}

/** The screen on top: the last one open, the result over the battle. */
export async function topScene(page: Page): Promise<string> {
  const scenes = await page.evaluate(() => (globalThis as SmokeWindow).__smoke?.scenes() ?? []);
  return scenes.filter((s) => s !== 'Boot').at(-1) ?? 'none';
}

/** Presses a key, then waits for the screen to answer. */
export async function press(page: Page, key: string, waitMs = 500): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(waitMs);
}

/** Waits until this screen is on top, or throws after the timeout. */
export async function waitForScene(page: Page, scene: string, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  while ((await topScene(page)) !== scene) {
    if (Date.now() - start > timeoutMs) throw new Error(`Waited for ${scene}, still on ${await topScene(page)}`);
    await page.waitForTimeout(200);
  }
}
