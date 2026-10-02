// The desktop app: every request goes to Electron's main process through the bridge the
// preload script provides. Files land in the player's app data folder
// (on Windows, %APPDATA%\Generals), where Steam Cloud can pick up the saves.

import type { DesktopBridge } from './bridge';
import type { Platform } from './types';

export async function createDesktopPlatform(bridge: DesktopBridge): Promise<Platform> {
  const info = await bridge.info();
  let fullscreen = info.fullscreen;
  const listeners: ((on: boolean) => void)[] = [];
  bridge.onFullscreenChange((on) => {
    fullscreen = on;
    for (const listener of listeners) listener(on);
  });
  let shown = false;
  return {
    kind: 'desktop',
    files: {
      read: (name) => bridge.readFile(name),
      write: (name, text) => bridge.writeFile(name, text),
    },
    display: {
      canSizeWindow: true,
      canFullscreen: true,
      isFullscreen: () => fullscreen,
      async setFullscreen(on) {
        await bridge.setFullscreen(on);
        fullscreen = on;
      },
      workArea: () => info.workArea,
      setWindowSize: (width, height) => bridge.setWindowSize(width, height),
      onFullscreenChange(listener) {
        listeners.push(listener);
      },
    },
    saveFolder: info.savesFolder,
    openSaveFolder: () => void bridge.openSavesFolder(),
    quit: () => bridge.quit(),
    ready() {
      if (shown) return;
      shown = true;
      bridge.ready();
    },
  };
}
