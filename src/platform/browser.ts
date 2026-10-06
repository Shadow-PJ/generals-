// The browser build: files live in the browser's local storage, fullscreen uses the
// Fullscreen API, speech uses the browser's speech recognition, and the window size is the
// browser's business.

import { loadLocalModel } from './model';
import { buildRelay, webSocketNetwork } from './network';
import { browserRecognition, webSpeech } from './speech';
import type { Display, FileName, Files, Platform } from './types';

const KEY_PREFIX = 'generals/';

/** Files in local storage. Falls back to memory when storage is blocked (some private windows). */
export function storageFiles(storage: Storage | null): Files {
  const memory = new Map<string, string>();
  return {
    async read(name: FileName) {
      try {
        if (storage) return storage.getItem(KEY_PREFIX + name);
      } catch {
        // Blocked storage: use memory below.
      }
      return memory.get(name) ?? null;
    },
    async write(name: FileName, text: string) {
      memory.set(name, text);
      try {
        storage?.setItem(KEY_PREFIX + name, text);
      } catch {
        // Full or blocked storage: the game keeps working, the file just won't outlive the tab.
      }
    },
  };
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserDisplay(): Display {
  const root = document.documentElement;
  return {
    canSizeWindow: false,
    canFullscreen: typeof root.requestFullscreen === 'function',
    isFullscreen: () => document.fullscreenElement !== null,
    async setFullscreen(on) {
      try {
        if (on && !document.fullscreenElement) await root.requestFullscreen();
        if (!on && document.fullscreenElement) await document.exitFullscreen();
      } catch {
        // The browser said no (it needs a key press or click first); nothing to undo.
      }
    },
    workArea: () => null,
    async setWindowSize() {},
    onFullscreenChange(listener) {
      document.addEventListener('fullscreenchange', () => listener(document.fullscreenElement !== null));
    },
  };
}

export function createBrowserPlatform(): Platform {
  return {
    kind: 'browser',
    files: storageFiles(browserStorage()),
    display: browserDisplay(),
    saveFolder: null,
    openSaveFolder: null,
    quit: null,
    ready() {},
    loadModel: loadLocalModel,
    speech: webSpeech(browserRecognition()),
    network: webSocketNetwork(buildRelay(import.meta.env.VITE_RELAY_URL)),
  };
}
