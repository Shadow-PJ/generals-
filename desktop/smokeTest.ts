// A quick automatic check that the built app really works, run by GitHub Actions on Windows
// after installing it. `Generals.exe --smoke-test=play` goes past the title screen, from the
// Capital to a skirmish, writes an order into slot 1 and starts a battle; `--smoke-test=reopen` starts the app again and checks the card is still in slot 1.
// This is the owner check from docs/PLAN.md (install, play, close, reopen), done by a script.
// The play test also has the order reader read a free-form order, which checks its weights load
// in the installed app, and checks steamworks.js loads there (session 7A). `--smoke-test=model --smoke-model=<id>` switches on the experimental
// language model, waits for it to download, and has it read a few free-form orders, timing each.

import type { BrowserWindow } from 'electron';
import { appendFileSync } from 'node:fs';

export type SmokeMode = 'play' | 'reopen' | 'model';

/** The order the smoke test writes into slot 1; no part of a starter order, so finding it in the save means it was saved. */
const ORDER = 'Rangers focus their Guardian';
/** What slot 1 holds on a new save: the first starter order (STARTER_ORDERS in src/data/armies.ts, session 7E). */
const STARTER_ORDER = 'Everyone focus their Rangers';
const READY_TIMEOUT_MS = 30_000;
const SAVE_TIMEOUT_MS = 5_000;
const SCREEN_CHANGE_MS = 800;
const BATTLE_WATCH_MS = 4_000;
const MODEL_READY_TIMEOUT_MS = 480_000;
/** Orders the rule parser can't read, so the model has to. */
const FREE_FORM_ORDERS = ['yo team just chill where u are for a sec', 'drop their ranger asap'];
/** Asks the page what speech recognition it has, including Chromium's on-device kind. */
const SPEECH_PROBE = `(async () => {
  const R = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!R) return 'none';
  if (typeof R.available !== 'function') return 'the API only (no on-device check)';
  try {
    return 'API; on-device English: ' + (await R.available({ langs: ['en-US'], processLocally: true }));
  } catch (error) {
    return 'API; on-device check failed: ' + error;
  }
})()`;
/** An order the rule parser can't read, and the card the order reader should make of it. */
const READER_ORDER = { text: 'yo rangers pull back to the healer asap', card: 'Rangers fall back to your Guardians' };

function option(argv: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length) ?? null;
}

export function smokeTestMode(argv: readonly string[]): SmokeMode | null {
  const mode = option(argv, 'smoke-test');
  return mode === 'play' || mode === 'reopen' || mode === 'model' ? mode : null;
}

/** Which order model the model test switches on. */
export function smokeModel(argv: readonly string[]): string | null {
  return option(argv, 'smoke-model');
}

/** Writes progress to stdout and to the file given by --smoke-log, since a Windows app has no console. */
export function smokeLog(argv: readonly string[]): (line: string) => void {
  const file = option(argv, 'smoke-log');
  return (line) => {
    console.log(line);
    if (file) appendFileSync(file, `${line}\n`);
  };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return true;
    await wait(100);
  }
  return false;
}

export async function runSmokeTest(options: {
  mode: SmokeMode;
  win: BrowserWindow;
  gameReady: Promise<void>;
  readProfile: () => Promise<string | null>;
  log: (line: string) => void;
}): Promise<boolean> {
  const { mode, win, log } = options;
  const contents = win.webContents;
  const errors: string[] = [];
  contents.on('console-message', (event) => {
    if (event.level === 'error') errors.push(event.message);
  });
  contents.on('render-process-gone', (_event, details) => errors.push(`game window crashed: ${details.reason}`));
  contents.on('preload-error', (_event, _path, error) => errors.push(`preload failed: ${error.message}`));

  let passed = true;
  const check = (ok: boolean, what: string) => {
    log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`);
    passed &&= ok;
  };
  const page = <T>(code: string): Promise<T> => contents.executeJavaScript(code, true) as Promise<T>;
  // The game reads keys by KeyboardEvent.code, through the same input layer the player uses.
  const press = (code: string) =>
    page(`for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code: '${code}', bubbles: true }));`);
  const orderBox = () => page<string | null>(`document.querySelector('input')?.value ?? null`);

  const ready = await Promise.race([options.gameReady.then(() => true), wait(READY_TIMEOUT_MS).then(() => false)]);
  check(ready, 'the game started and drew its first screen');
  if (!ready) return false;
  check((await page<string>('document.title')) === 'Generals', 'the window shows the game');
  check(
    await page<boolean>(`typeof window.generalsDesktop === 'object' && typeof require === 'undefined' && typeof process === 'undefined'`),
    'the game sees the desktop bridge and not Node',
  );
  check(await page<boolean>('crossOriginIsolated'), 'the page is cross-origin isolated, so the order model can use several threads');

  if (mode === 'model') {
    passed &&= await testModel(page, check, log);
    check(errors.length === 0, `no errors in the game${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    return passed;
  }

  await wait(SCREEN_CHANGE_MS);
  await press('Enter'); // the title screen -> the Capital
  await wait(SCREEN_CHANGE_MS);
  await press('KeyT'); // the Capital -> a skirmish's troops
  await wait(SCREEN_CHANGE_MS);
  await press('Enter'); // troops -> orders
  await wait(SCREEN_CHANGE_MS);
  const box = await orderBox();
  check(box !== null, 'Enter opens the orders screen');

  if (mode === 'play') {
    check(box === STARTER_ORDER, 'slot 1 starts with the first starter order');
    // Type the order and press Enter in the text box (translate), then Enter again (save to slot 1).
    await page(
      `(() => { const box = document.querySelector('input'); box.focus(); box.value = ${JSON.stringify(ORDER)};` +
        ` box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); })()`,
    );
    await wait(300);
    await press('Enter');
    const saved = await waitFor(async () => (await options.readProfile())?.includes(ORDER) ?? false, SAVE_TIMEOUT_MS);
    check(saved, 'the card was written to saves\\profile.json');
    const read = await page<Reading>(`window.__smoke.translate(${JSON.stringify(READER_ORDER.text)})`);
    log(`      "${READER_ORDER.text}" -> ${read.card} [${read.by}, ${read.ms.toFixed(1)} ms]`);
    check(read.by === 'reader' && read.card === READER_ORDER.card, 'the order reader loaded and read a free-form order');
    // Not a check: what speech recognition Electron offers, for deciding on voice in the app later.
    log(`      speech recognition in the app: ${await page<string>(SPEECH_PROBE)}`);
    await press('KeyB'); // start the battle
    await wait(BATTLE_WATCH_MS);
    check(await page<boolean>(`document.querySelector('input') === null`), 'the battle started');
  } else {
    check(box === ORDER, 'after reopening, slot 1 still holds the card');
  }

  check(
    await page<boolean>(`window.generalsDesktop.readFile('saves/profile.json').then((t) => t !== null && t.includes(${JSON.stringify(ORDER)}))`),
    'the game reads its save back through the bridge',
  );
  check(errors.length === 0, `no errors in the game${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  return passed;
}

type ModelState = { status: string; progress?: number; threads?: number; error?: string };
type Reading = { ok: boolean; by: string; card: string; ms: number };

/** Waits for the order model through the game's test hook, then has it read a few orders. */
async function testModel(
  page: <T>(code: string) => Promise<T>,
  check: (ok: boolean, what: string) => void,
  log: (line: string) => void,
): Promise<boolean> {
  const hook = await page<boolean>(`typeof window.__smoke === 'object'`);
  check(hook, 'the game exposes its test hook');
  if (!hook) return false;
  const start = Date.now();
  let state: ModelState = { status: 'off' };
  let lastLog = 0;
  while (Date.now() - start < MODEL_READY_TIMEOUT_MS) {
    state = await page<ModelState>('window.__smoke.modelState()');
    if (state.status === 'ready' || state.status === 'failed') break;
    if (Date.now() - lastLog > 30_000) {
      lastLog = Date.now();
      log(`      model ${state.status} ${Math.round((state.progress ?? 0) * 100)}%`);
    }
    await wait(1000);
  }
  check(state.status === 'ready', `the order model downloaded and started (${state.status}${state.error ? `: ${state.error}` : ''}) in ${((Date.now() - start) / 1000).toFixed(0)} s on ${state.threads ?? 0} threads`);
  if (state.status !== 'ready') return false;
  let allByModel = true;
  for (const text of FREE_FORM_ORDERS) {
    const reading = await page<Reading>(`window.__smoke.translateWithModel(${JSON.stringify(text)})`);
    log(`      "${text}" -> ${reading.card} [${reading.by}, ${(reading.ms / 1000).toFixed(1)} s]`);
    allByModel &&= reading.by === 'model' && reading.ok;
  }
  check(allByModel, 'the model read each free-form order into a card (speed is reported above; the model eval judges accuracy)');
  return allByModel;
}
