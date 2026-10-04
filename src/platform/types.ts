// What the game needs from the computer it runs on. Each build (the browser build and the
// desktop app now; Steam and Epic later) provides one Platform, and game code never reaches
// past it to Electron, the file system or a store.

import type { LoadOptions, LocalModel } from './model';
import type { SpeechInput } from './speech';

/**
 * The files the game keeps. Everything under `saves/` is your progress and is meant to sync
 * between computers (Steam Cloud); `settings.json` is about this computer's screen and stays here.
 */
export type FileName = 'saves/profile.json' | 'saves/profile-backup.json' | 'settings.json';

export interface Files {
  /** The file's text, or null when it doesn't exist yet. */
  read(name: FileName): Promise<string | null>;
  /** Replaces the whole file. */
  write(name: FileName, text: string): Promise<void>;
}

export interface Display {
  /** True when the game can size its own window (the desktop app); a browser tab can't. */
  readonly canSizeWindow: boolean;
  /** True when fullscreen can be turned on and off from inside the game. */
  readonly canFullscreen: boolean;
  isFullscreen(): boolean;
  setFullscreen(on: boolean): Promise<void>;
  /** The free space on the screen for a window's inner area, or null in a browser. */
  workArea(): { width: number; height: number } | null;
  /** Sets the size of the window's inner area and centers it on the screen (desktop only). */
  setWindowSize(width: number, height: number): Promise<void>;
  /** Calls the listener whenever fullscreen turns on or off, including from outside the game. */
  onFullscreenChange(listener: (on: boolean) => void): void;
}

export interface Platform {
  readonly kind: 'browser' | 'desktop';
  readonly files: Files;
  readonly display: Display;
  /** The folder that holds the save files, to show the player; null when saves live in the browser. */
  readonly saveFolder: string | null;
  /** Opens the save folder in the file manager, where there is one. */
  openSaveFolder: (() => void) | null;
  /** Closes the game, where that makes sense (not in a browser tab). */
  quit: (() => void) | null;
  /** Called once the first screen is drawn; the desktop app shows its window then. */
  ready(): void;
  /** Starts the experimental language model for reading orders; both builds download it on first use. */
  loadModel(url: string, options?: LoadOptions): Promise<LocalModel>;
  /** Turns speech into words for spoken orders; null where there is no speech recognition. */
  readonly speech: SpeechInput | null;
}
