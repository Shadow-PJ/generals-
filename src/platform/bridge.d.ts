// What the desktop app's preload script (desktop/preload.cts) puts on `window.generalsDesktop`.
// Only src/platform/desktop.ts uses it. It is a .d.ts with no imports so the desktop code can
// share it without pulling game code into the Electron build.

export interface DesktopInfo {
  /** Absolute path of the folder holding the save files (Steam Cloud syncs this folder). */
  savesFolder: string;
  fullscreen: boolean;
  /** Free space for the window's inner area on the screen the window is on. */
  workArea: { width: number; height: number };
  /** The store that started the app and is running alongside it (session 7A), or 'none'. */
  store: 'none' | 'steam';
}

/** What the player is doing, for the store to show friends (see src/platform/store.ts). */
export interface DesktopPresence {
  line: string;
  params: Record<string, string>;
}

export interface DesktopBridge {
  info(): Promise<DesktopInfo>;
  readFile(name: string): Promise<string | null>;
  writeFile(name: string, text: string): Promise<void>;
  setFullscreen(on: boolean): Promise<void>;
  setWindowSize(width: number, height: number): Promise<void>;
  openSavesFolder(): Promise<void>;
  onFullscreenChange(listener: (on: boolean) => void): void;
  ready(): void;
  quit(): void;
  /** Store features (session 7A); they do nothing when no store is running. */
  unlockAchievement(id: string): void;
  setPresence(presence: DesktopPresence | null): void;
}
