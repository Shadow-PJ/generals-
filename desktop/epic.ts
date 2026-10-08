// The Epic Games Store (session 7B): achievements and presence for the desktop app, through Epic
// Online Services (desktop/eos.ts). Epic turns on only in the Epic build (`npm run epic:stage`
// puts the SDK library and the game's EOS settings beside the app), and only when the
// Epic Games Launcher started it (the launcher passes a one-time code that signs the player in)
// or a developer signs in with Epic's Developer Authentication Tool. Anywhere else, or when
// signing in fails, the app runs exactly as it does outside Epic.
//
// The launcher's code signs the player in to their Epic account, so it is never logged.

import path from 'node:path';
import { EOS_RESULT, loadEos, RICH_TEXT_MAX, SDK_LIBRARY, type EosCredentials, type EosHandle, type EosSdk } from './eos.js';
import { presenceText, readPresence } from './presence.js';

/** How the app was started for Epic. */
export interface EpicLaunch {
  credentials: EosCredentials;
  /** The sandbox the launcher named (Dev, Stage or Live), if it named one. */
  sandboxId: string | null;
  deploymentId: string | null;
  /** Epic's overlay; `--eos-no-overlay` turns it off. */
  overlay: boolean;
}

/**
 * How Epic started the app, from its command line, or null when it didn't. The Epic Games
 * Launcher passes `-AUTH_TYPE=exchangecode -AUTH_PASSWORD=<code> -epicsandboxid=<id>` among
 * others; `--eos-dev-auth=<host:port>/<name>` signs in with the Developer Authentication Tool.
 */
export function epicLaunch(argv: readonly string[]): EpicLaunch | null {
  const args = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--?([A-Za-z][A-Za-z0-9_-]*)(?:=(.*))?$/s.exec(arg);
    if (match) args.set(match[1]!.toLowerCase(), match[2] ?? '');
  }
  const value = (name: string) => args.get(name)?.trim() || null;
  let credentials: EosCredentials | null = null;
  const code = value('auth_password');
  const developer = value('eos-dev-auth');
  if (value('auth_type')?.toLowerCase() === 'exchangecode' && code) credentials = { kind: 'exchangeCode', code };
  else if (developer) {
    const slash = developer.indexOf('/');
    const host = developer.slice(0, slash);
    const name = developer.slice(slash + 1);
    if (slash > 0 && name) credentials = { kind: 'developer', host, name };
  }
  if (!credentials) return null;
  return { credentials, sandboxId: value('epicsandboxid'), deploymentId: value('epicdeploymentid'), overlay: !args.has('eos-no-overlay') };
}

/** The game's ids from Epic's Developer Portal, kept in epic.json beside the SDK in the Epic build. */
export interface EpicConfig {
  productId: string;
  clientId: string;
  clientSecret: string;
  /** Each sandbox's deployment, Live first: the launcher names the sandbox, not the deployment. */
  deployments: Readonly<Record<string, string>>;
}

export const EPIC_CONFIG_FILE = 'epic.json';
/** The folder beside the app (in its resources) that holds the SDK library and epic.json. */
export const EPIC_FOLDER = 'eos';

const ID = /^[A-Za-z0-9_.\-+=/]{1,128}$/;

/** epic.json's settings, or null when they are missing or malformed. */
export function readEpicConfig(text: string | null): EpicConfig | null {
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { productId, clientId, clientSecret, deployments } = value as Record<string, unknown>;
  const id = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
  if (!id(productId) || !id(clientId) || !id(clientSecret) || typeof deployments !== 'object' || deployments === null) return null;
  const pairs = Object.entries(deployments);
  if (pairs.length === 0 || !pairs.every(([sandbox, deployment]) => id(sandbox) && id(deployment))) return null;
  return { productId, clientId, clientSecret, deployments: Object.fromEntries(pairs) as Record<string, string> };
}

/** The sandbox and deployment to start in: the launcher's, else the first in epic.json (Live). */
export function epicTarget(config: EpicConfig, launch: EpicLaunch): { sandboxId: string; deploymentId: string } | null {
  const sandboxId = launch.sandboxId ?? Object.keys(config.deployments)[0]!;
  const deploymentId = launch.deploymentId ?? (Object.hasOwn(config.deployments, sandboxId) ? config.deployments[sandboxId] : undefined);
  return deploymentId ? { sandboxId, deploymentId } : null;
}

/** Where the Epic build keeps the SDK and epic.json, if one of these folders has both. */
export function findEpicFiles(
  folders: readonly string[],
  readText: (file: string) => string | null,
  exists: (file: string) => boolean,
  platform: string = process.platform,
): { config: EpicConfig; library: string } | null {
  const libraryName = SDK_LIBRARY[platform];
  if (!libraryName) return null;
  for (const folder of folders) {
    const library = path.join(folder, libraryName);
    const config = readEpicConfig(readText(path.join(folder, EPIC_CONFIG_FILE)));
    if (config && exists(library)) return { config, library };
  }
  return null;
}

export interface EpicStoreOptions {
  /** How often the SDK gets to do its work, in milliseconds. */
  tickMs?: number;
  /** How long to wait before trying an achievement again, in milliseconds. */
  retryMs?: number;
  /** How many times to try an achievement before giving up (it may not exist in the Developer Portal). */
  tries?: number;
  log?: (line: string) => void;
}

const ACHIEVEMENT_ID = /^[A-Z0-9_]{1,64}$/;

/**
 * Signs the player in, then unlocks achievements and shows their presence. Signing in takes
 * two steps: the Epic account (which presence needs), then the game's own services, where
 * achievements live (a player's first time creates their user there). Anything the game sends
 * before that waits for it.
 */
export class EpicStore {
  private account: EosHandle | null = null;
  private user: EosHandle | null = null;
  private signingIn = true;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private readonly waiting = new Map<string, number>();
  private readonly unlocking = new Set<string>();
  private readonly retries = new Set<ReturnType<typeof setTimeout>>();
  private wantedText: string | null = null;
  private shownText: string | null = null;
  private sendingPresence = false;
  private readonly tickMs: number;
  private readonly retryMs: number;
  private readonly tries: number;
  private readonly log: (line: string) => void;

  constructor(
    private readonly sdk: EosSdk,
    private readonly platform: EosHandle,
    options: EpicStoreOptions = {},
  ) {
    this.tickMs = options.tickMs ?? 100;
    this.retryMs = options.retryMs ?? 10_000;
    this.tries = options.tries ?? 6;
    this.log = options.log ?? (() => undefined);
  }

  /** Starts the SDK's work and signs the player in. */
  start(credentials: EosCredentials): void {
    this.sdk.authLogin(this.platform, credentials, (result, account) => {
      if (result !== EOS_RESULT.Success || !account) return this.signInFailed('Epic is off: signing in to the Epic account', result);
      this.account = account;
      this.log('Epic: signed in.');
      this.showPresence();
      this.connect(account);
    });
    this.ticker = setInterval(() => this.tick(), this.tickMs);
  }

  /** True once achievements can unlock. */
  get ready(): boolean {
    return this.user !== null;
  }

  /** Achievements still waiting to be unlocked. */
  get pending(): string[] {
    return [...this.waiting.keys()];
  }

  /** The SDK does its work, and calls back, only inside a tick. */
  tick(): void {
    try {
      this.sdk.tick(this.platform);
    } catch (error) {
      this.log(`Epic: the SDK failed (${String(error)}).`);
    }
  }

  private connect(account: EosHandle): void {
    const token = this.sdk.copyIdToken(this.platform, account);
    if (!token) return this.signInFailed('Epic achievements are off: copying the ID token', null);
    this.sdk.connectLogin(this.platform, token, (result, user, continuance) => {
      if (result === EOS_RESULT.Success && user) return this.signedIn(user);
      if (result !== EOS_RESULT.InvalidUser || !continuance) return this.signInFailed('Epic achievements are off: signing in to the game’s services', result);
      // The player's first time: their user in the game's services is made now.
      this.sdk.createUser(this.platform, continuance, (created, newUser) => {
        if (created === EOS_RESULT.Success && newUser) this.signedIn(newUser);
        else this.signInFailed('Epic achievements are off: creating the player’s user', created);
      });
    });
  }

  private signedIn(user: EosHandle): void {
    this.user = user;
    this.signingIn = false;
    this.unlockWaiting();
  }

  /** Ends signing in: what failed, as a log line's start, and the SDK's result. */
  private signInFailed(what: string, result: number | null): void {
    this.signingIn = false;
    this.waiting.clear();
    this.log(`${what} failed (${result === null ? 'the SDK gave none' : this.sdk.resultName(result)}).`);
  }

  unlock(id: unknown): void {
    if (typeof id !== 'string' || !ACHIEVEMENT_ID.test(id) || this.waiting.has(id)) return;
    if (!this.signingIn && !this.user) return;
    this.waiting.set(id, 0);
    this.unlockWaiting();
  }

  /** Unlocks each waiting achievement on its own, so one Epic turns down holds up no other. */
  private unlockWaiting(): void {
    const user = this.user;
    if (!user) return;
    for (const [id, tried] of this.waiting) {
      if (this.unlocking.has(id)) continue;
      this.unlocking.add(id);
      this.sdk.unlockAchievements(this.platform, user, [id], (result) => {
        this.unlocking.delete(id);
        if (result === EOS_RESULT.Success) this.waiting.delete(id);
        else if (tried + 1 >= this.tries) {
          this.waiting.delete(id);
          this.log(`Epic turned down the achievement ${id} (${this.sdk.resultName(result)}); is it set up in the Developer Portal?`);
        } else {
          this.waiting.set(id, tried + 1);
          const retry = setTimeout(() => {
            this.retries.delete(retry);
            this.unlockWaiting();
          }, this.retryMs);
          this.retries.add(retry);
        }
      });
    }
  }

  /** Shows the presence line as text in the player's friends list, or clears it. */
  presence(value: unknown): void {
    if (value === null) this.wantedText = '';
    else {
      const presence = readPresence(value);
      const text = presence && presenceText(presence, RICH_TEXT_MAX);
      if (text === null) return;
      this.wantedText = text;
    }
    this.showPresence();
  }

  private showPresence(): void {
    const account = this.account;
    const text = this.wantedText;
    if (!account || text === null || text === this.shownText || this.sendingPresence) return;
    this.sendingPresence = true;
    const done = (result: number) => {
      this.sendingPresence = false;
      // A presence Epic turns down is not tried again; the next screen sends its own.
      this.shownText = text;
      if (result !== EOS_RESULT.Success) this.log(`Epic presence failed (${this.sdk.resultName(result)}).`);
      this.showPresence();
    };
    const started = this.sdk.setPresence(this.platform, account, text, done);
    if (started !== EOS_RESULT.Success) done(started);
  }

  /** Stops the SDK: the player signs out with it. */
  stop(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    for (const retry of this.retries) clearTimeout(retry);
    this.retries.clear();
    try {
      this.sdk.releasePlatform(this.platform);
      this.sdk.shutdown();
    } catch (error) {
      this.log(`Epic: the SDK failed to stop (${String(error)}).`);
    }
  }
}

export interface StartEpicOptions {
  launch: EpicLaunch;
  config: EpicConfig;
  /** The SDK library's path. */
  library: string;
  productVersion: string;
  /** A folder the SDK may keep temporary files in. */
  cacheDirectory: string;
  log: (line: string) => void;
  load?: (library: string) => EosSdk;
  store?: EpicStoreOptions;
}

/**
 * Starts the SDK and signs the player in, or returns null to run without Epic. Call it before
 * the app is ready, so Epic's overlay is there before the window's graphics start.
 */
export function startEpic(options: StartEpicOptions): EpicStore | null {
  const { launch, config, log } = options;
  const target = epicTarget(config, launch);
  if (!target) {
    log(`Epic is off: epic.json has no deployment for the sandbox ${launch.sandboxId ?? '(none named)'}.`);
    return null;
  }
  let sdk: EosSdk;
  try {
    sdk = (options.load ?? loadEos)(options.library);
  } catch (error) {
    log(`Epic is off: the SDK did not load (${String(error)}).`);
    return null;
  }
  try {
    const initialized = sdk.initialize('Generals', options.productVersion);
    if (initialized !== EOS_RESULT.Success && initialized !== EOS_RESULT.AlreadyConfigured) {
      log(`Epic is off: the SDK did not start (${sdk.resultName(initialized)}).`);
      return null;
    }
    const platform = sdk.createPlatform({
      productId: config.productId,
      sandboxId: target.sandboxId,
      deploymentId: target.deploymentId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      cacheDirectory: options.cacheDirectory,
      overlay: launch.overlay,
    });
    if (!platform) {
      sdk.shutdown();
      log('Epic is off: the SDK would not start the game’s platform; check epic.json against the Developer Portal, and that the SDK is current.');
      return null;
    }
    const store = new EpicStore(sdk, platform, { log, ...options.store });
    log(`Epic is on, in sandbox ${target.sandboxId}.`);
    try {
      store.start(launch.credentials);
    } catch (error) {
      store.stop();
      throw error;
    }
    return store;
  } catch (error) {
    log(`Epic is off: the SDK failed (${String(error)}).`);
    return null;
  }
}
