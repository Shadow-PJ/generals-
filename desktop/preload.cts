// Runs in the game's window before the game starts. It hands the game a small, fixed set of
// requests to the main process (window.generalsDesktop) and nothing else: the game itself never
// sees Node or Electron. It is CommonJS because Electron's sandbox requires that for preloads.

import electron = require('electron');
import type { DesktopBridge } from '../src/platform/bridge';

const { contextBridge, ipcRenderer } = electron;

const bridge: DesktopBridge = {
  info: () => ipcRenderer.invoke('info'),
  readFile: (name) => ipcRenderer.invoke('read-file', name),
  writeFile: (name, text) => ipcRenderer.invoke('write-file', name, text),
  setFullscreen: (on) => ipcRenderer.invoke('set-fullscreen', on),
  setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', width, height),
  openSavesFolder: () => ipcRenderer.invoke('open-saves-folder'),
  onFullscreenChange: (listener) => {
    ipcRenderer.on('fullscreen-changed', (_event, on: boolean) => listener(on));
  },
  ready: () => ipcRenderer.send('ready'),
  quit: () => ipcRenderer.send('quit'),
  unlockAchievement: (id) => ipcRenderer.send('unlock-achievement', id),
  setPresence: (presence) => ipcRenderer.send('set-presence', presence),
};

contextBridge.exposeInMainWorld('generalsDesktop', bridge);
