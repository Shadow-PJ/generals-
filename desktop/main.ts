// The desktop app's main process. It opens one window that runs the same game build as the
// browser version, served from inside the app, and answers the game's few requests: read and
// write its files, fullscreen, window size. The game never gets Node or Electron itself.

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  net,
  protocol,
  screen,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { DesktopInfo } from '../src/platform/bridge.js';
import { DataFiles } from './dataFiles.js';
import { runSmokeTest, smokeLog, smokeModel, smokeTestMode, type SmokeMode } from './smokeTest.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** The game build (`npm run build` output). In the installed app it sits inside app.asar. */
const GAME_FOLDER = path.join(here, '..', '..', 'dist');
const GAME_ORIGIN = 'app://game';
const BACKGROUND = '#11151c';
/** The game's base size; the window starts at it until the game picks a size. */
const BASE = { width: 960, height: 704 };
/** If the game never says it is ready, show the window anyway so any error is visible. */
const SHOW_ANYWAY_MS = 10_000;

// The game is served from app://game/, a private origin, instead of file:// pages.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// Keep Chromium's caches out of the roaming folder, so %APPDATA%\Generals holds only the
// game's own files: saves\ (for Steam Cloud) and settings.json. On Linux and the Steam Deck the
// same goes for ~/.config/Generals: the caches go to ~/.cache/Generals.
if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
  app.setPath('sessionData', path.join(process.env.LOCALAPPDATA, 'Generals', 'session'));
} else if (process.platform === 'linux') {
  const cache = process.env.XDG_CACHE_HOME || path.join(app.getPath('home'), '.cache');
  app.setPath('sessionData', path.join(cache, 'Generals', 'session'));
}

let win: BrowserWindow | null = null;
let shown = false;
let fullscreenOnShow = false;
let markReady: () => void = () => undefined;
const gameReady = new Promise<void>((resolve) => {
  markReady = resolve;
});

/**
 * Serves the game build. The page is cross-origin isolated (these two headers), which lets the
 * small order-reading model use several CPU threads; GitHub Pages can't send them, so the
 * browser build runs it on one.
 */
const ISOLATION_HEADERS = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' };

async function serveGame(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const file = path.resolve(GAME_FOLDER, decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
  const inside = path.relative(GAME_FOLDER, file);
  if (url.host !== 'game' || inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) {
    return new Response('Not found', { status: 404 });
  }
  const response = await net.fetch(pathToFileURL(file).toString());
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(ISOLATION_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function fromGame(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  return event.senderFrame?.url.startsWith(`${GAME_ORIGIN}/`) ?? false;
}

function show(): void {
  if (!win || shown) return;
  shown = true;
  win.show();
  if (fullscreenOnShow) win.setFullScreen(true);
}

function workArea(): { width: number; height: number } {
  const bounds = win?.getBounds();
  return (bounds ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay()).workAreaSize;
}

function listenToGame(files: DataFiles, savesFolder: string): void {
  const handle = (channel: string, listener: (...args: unknown[]) => unknown) => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!fromGame(event)) throw new Error('Request from outside the game');
      return listener(...args);
    });
  };

  handle('info', (): DesktopInfo => ({
    savesFolder,
    fullscreen: win?.isFullScreen() || fullscreenOnShow,
    workArea: workArea(),
  }));
  handle('read-file', (name) => files.read(name));
  handle('write-file', (name, text) => files.write(name, text));
  handle('set-fullscreen', (on) => {
    if (!win) return;
    // A hidden window goes fullscreen as it is shown.
    if (!shown) fullscreenOnShow = on === true;
    else win.setFullScreen(on === true);
  });
  handle('set-window-size', (width, height) => {
    if (!win || win.isFullScreen() || typeof width !== 'number' || typeof height !== 'number') return;
    const area = workArea();
    win.setContentSize(Math.round(Math.min(width, area.width)), Math.round(Math.min(height, area.height)));
    win.center();
  });
  handle('open-saves-folder', async () => {
    await mkdir(savesFolder, { recursive: true });
    await shell.openPath(savesFolder);
  });
  ipcMain.on('ready', (event) => {
    if (!fromGame(event)) return;
    show();
    markReady();
  });
  ipcMain.on('quit', (event) => {
    if (fromGame(event)) app.quit();
  });
}

/** `query` is added to the page address; smoke tests use it to switch on the game's test hook. */
function createWindow(query = ''): BrowserWindow {
  const window = new BrowserWindow({
    ...BASE,
    useContentSize: true,
    minWidth: BASE.width / 2,
    minHeight: BASE.height / 2,
    show: false,
    backgroundColor: BACKGROUND,
    title: 'Generals',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      // A player with only a controller (a Steam Deck) never presses a key or clicks, which is
      // what browsers wait for before playing sound; the app needs no such wait.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  window.on('enter-full-screen', () => window.webContents.send('fullscreen-changed', true));
  window.on('leave-full-screen', () => window.webContents.send('fullscreen-changed', false));
  window.on('closed', () => {
    win = null;
  });
  // The game never opens other pages or links.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (!app.isPackaged) {
    window.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') window.webContents.toggleDevTools();
    });
  }
  setTimeout(show, SHOW_ANYWAY_MS);
  void window.loadURL(`${GAME_ORIGIN}/index.html${query}`);
  return window;
}

const smokeMode = smokeTestMode(process.argv);
/** A smoke test that hasn't finished in this time has failed; the model test includes a download. */
const SMOKE_TEST_LIMIT_MS = smokeMode === 'model' ? 600_000 : 120_000;

// One copy of the game at a time, so two windows can't write the same save.
if (!app.requestSingleInstanceLock()) {
  // A smoke test that can't run must not look like a pass.
  app.exit(smokeMode ? 1 : 0);
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on('window-all-closed', () => (smokeMode ? app.exit(1) : app.quit()));

  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    const dataFolder = app.getPath('userData');
    const files = new DataFiles(dataFolder);
    protocol.handle('app', serveGame);
    listenToGame(files, path.join(dataFolder, 'saves'));
    const model = smokeModel(process.argv);
    // The model test switches the order model on, as a player would in Settings.
    if (smokeMode === 'model' && model) await files.write('settings.json', JSON.stringify({ orderModel: model }));
    win = createWindow(smokeMode ? '?smoke' : '');
    if (smokeMode) startSmokeTest(smokeMode, win, files, dataFolder);
  });
}

function startSmokeTest(mode: SmokeMode, window: BrowserWindow, files: DataFiles, dataFolder: string): void {
  const log = smokeLog(process.argv);
  log(`smoke test "${mode}", data folder ${dataFolder}`);
  const finish = (passed: boolean, why: string) => {
    log(passed ? 'smoke test passed' : `smoke test FAILED: ${why}`);
    app.exit(passed ? 0 : 1);
  };
  setTimeout(() => finish(false, 'it took too long'), SMOKE_TEST_LIMIT_MS);
  runSmokeTest({ mode, win: window, gameReady, readProfile: () => files.read('saves/profile.json'), log }).then(
    (passed) => finish(passed, 'see the lines above'),
    (error: unknown) => finish(false, String(error)),
  );
}
