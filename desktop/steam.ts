// Steam (session 7A): achievements, rich presence and the overlay for the desktop app, through
// steamworks.js. Steam turns on only when Steam started the app (Steam sets SteamAppId for the
// games it starts) or when an App ID is given for testing: `--steam-app-id=480` (Valve's test
// app, Spacewar) or a steam_appid.txt beside the app. Anywhere else, or when Steam can't start
// (not running, or the game isn't owned), the app runs exactly as it does outside Steam.

import { createRequire } from 'node:module';
import path from 'node:path';
import { readPresence } from './presence.js';

/** The part of steamworks.js the app uses. */
export interface SteamClient {
  achievement: { activate(name: string): boolean };
  localplayer: { setRichPresence(key: string, value?: string | null): void };
}

interface Steamworks {
  init(appId?: number): SteamClient;
  electronEnableSteamOverlay(disableEachFrameInvalidation?: boolean): void;
}

/**
 * The App ID to start Steam with, or null to run without Steam: the one Steam set for the game it
 * started, else one given on the command line, else one in a steam_appid.txt in `folders`.
 */
export function steamAppId(
  env: Readonly<Record<string, string | undefined>>,
  argv: readonly string[],
  readText: (file: string) => string | null,
  folders: readonly string[],
): number | null {
  const flag = '--steam-app-id=';
  const candidates = [
    env.SteamAppId,
    argv.find((arg) => arg.startsWith(flag))?.slice(flag.length),
    ...folders.map((folder) => readText(path.join(folder, 'steam_appid.txt'))),
  ];
  for (const candidate of candidates) {
    const id = Number(candidate?.trim());
    if (candidate && Number.isSafeInteger(id) && id > 0) return id;
  }
  return null;
}

/** Steam's names for achievements: their API names. */
const ACHIEVEMENT_NAME = /^[A-Z0-9_]{1,64}$/;

export interface SteamStoreOptions {
  /** How long to wait before trying an achievement again, in milliseconds. */
  retryMs?: number;
  /** How many times to try an achievement before giving up (it may not exist in Steamworks). */
  tries?: number;
  log?: (line: string) => void;
}

/**
 * Achievements and presence for a running Steam client. Steam turns an achievement down until it
 * has loaded the player's stats, a moment after it starts, so one that fails is tried again a
 * few times before it is given up.
 */
export class SteamStore {
  private readonly waiting = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private presenceKeys = new Set<string>();
  private readonly retryMs: number;
  private readonly tries: number;
  private readonly log: (line: string) => void;

  constructor(
    private readonly client: SteamClient,
    options: SteamStoreOptions = {},
  ) {
    this.retryMs = options.retryMs ?? 5000;
    this.tries = options.tries ?? 12;
    this.log = options.log ?? (() => undefined);
  }

  unlock(name: unknown): void {
    if (typeof name !== 'string' || !ACHIEVEMENT_NAME.test(name) || this.waiting.has(name)) return;
    this.waiting.set(name, 0);
    this.tryWaiting();
  }

  /** Achievements still waiting to be unlocked. */
  get pending(): string[] {
    return [...this.waiting.keys()];
  }

  private tryWaiting(): void {
    for (const [name, tried] of [...this.waiting]) {
      let done = false;
      try {
        done = this.client.achievement.activate(name);
      } catch {
        done = false;
      }
      if (done) this.waiting.delete(name);
      else if (tried + 1 >= this.tries) {
        this.waiting.delete(name);
        this.log(`Steam turned down the achievement ${name}; is it set up in Steamworks?`);
      } else this.waiting.set(name, tried + 1);
    }
    if (this.waiting.size > 0 && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.tryWaiting();
      }, this.retryMs);
    }
  }

  /** Shows the presence line (a token in the rich presence file, "#" + its name), or clears it. */
  presence(value: unknown): void {
    const presence = value === null ? null : readPresence(value);
    if (value !== null && !presence) return;
    const next: Record<string, string> = presence ? { steam_display: `#${presence.line}`, ...presence.params } : {};
    try {
      for (const key of this.presenceKeys) if (!(key in next)) this.client.localplayer.setRichPresence(key, null);
      for (const [key, text] of Object.entries(next)) this.client.localplayer.setRichPresence(key, text);
      this.presenceKeys = new Set(Object.keys(next));
    } catch (error) {
      this.log(`Steam presence failed: ${String(error)}`);
    }
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

/**
 * Starts Steam for the app, with its overlay, or returns null to run without it. Call it before
 * the app is ready: the overlay needs two of Chromium's switches set first.
 */
export function startSteam(appId: number, log: (line: string) => void, load: () => Steamworks = loadSteamworks): SteamStore | null {
  let steamworks: Steamworks;
  try {
    steamworks = load();
  } catch (error) {
    log(`Steam is off: steamworks.js did not load (${String(error)}).`);
    return null;
  }
  try {
    const client = steamworks.init(appId);
    steamworks.electronEnableSteamOverlay();
    log(`Steam is on, as app ${appId}.`);
    return new SteamStore(client, { log });
  } catch (error) {
    log(`Steam is off: it did not start (${String(error)}).`);
    return null;
  }
}

/**
 * Why steamworks.js won't load in this app, or null when it does: the desktop smoke test checks
 * that the packaged app carries it and Steam's library, without starting Steam.
 */
export function steamworksLoadProblem(load: () => Steamworks = loadSteamworks): string | null {
  try {
    return typeof load().init === 'function' ? null : 'it has no init';
  } catch (error) {
    return String(error);
  }
}

/** steamworks.js is a native module, loaded only when Steam is wanted, so a missing one can't stop the app. */
function loadSteamworks(): Steamworks {
  return createRequire(import.meta.url)('steamworks.js') as Steamworks;
}
