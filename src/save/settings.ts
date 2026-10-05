// Settings for this computer's screen and speakers, in settings.json. They stay out of saves/ on
// purpose: a laptop and a big monitor want different window sizes (and a laptop at night wants
// quieter sound), so they don't sync between computers.

import type { FileName } from '../platform';

export const SETTINGS_VERSION = 1;
export const SETTINGS_FILE: FileName = 'settings.json';

/**
 * How many pixels the game draws, as a multiple of its base size (960×704). 'auto' matches the
 * screen so text stays sharp in a big window; 1 is the lightest on slow computers.
 */
export type Resolution = 'auto' | 1 | 1.5 | 2;
export const RESOLUTIONS: readonly Resolution[] = ['auto', 1, 1.5, 2];

export interface Settings {
  version: typeof SETTINGS_VERSION;
  /** Desktop only; a browser can't start in fullscreen by itself. */
  fullscreen: boolean;
  /** The window's size as a multiple of the base size; null picks the largest that fits the screen. */
  windowScale: number | null;
  resolution: Resolution;
  /**
   * Which small model reads orders the rule parser can't, by id (src/platform/models.ts), or
   * null for the rule parser alone. Off by default: the model is a download of several hundred MB.
   */
  orderModel: string | null;
  /** Loudness, 0 (off) to 1, in steps of a tenth: all sound, then music and effects within it (session 6B). */
  volume: Volume;
  /** The battlefield shakes for big blows (ultimates, walls falling); off for players it bothers. */
  screenShake: boolean;
}

export interface Volume {
  master: number;
  music: number;
  effects: number;
}


export function defaultSettings(): Settings {
  return {
    version: SETTINGS_VERSION,
    fullscreen: false,
    windowScale: null,
    resolution: 'auto',
    orderModel: null,
    volume: { master: 0.8, music: 0.6, effects: 0.8 },
    screenShake: true,
  };
}

/** A loudness kept to 0 to 1 in tenths. */
export function clampVolume(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10))) / 10;
}

export function writeSettings(settings: Settings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

/** The settings in the text; anything missing or damaged gets its default. */
export function readSettings(text: string | null): Settings {
  const settings = defaultSettings();
  if (text === null) return settings;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return settings;
  }
  if (typeof data !== 'object' || data === null) return settings;
  const saved = data as Record<string, unknown>;
  if (typeof saved.fullscreen === 'boolean') settings.fullscreen = saved.fullscreen;
  if (typeof saved.windowScale === 'number' && saved.windowScale >= 0.5 && saved.windowScale <= 4) {
    settings.windowScale = saved.windowScale;
  }
  if ((RESOLUTIONS as readonly unknown[]).includes(saved.resolution)) settings.resolution = saved.resolution as Resolution;
  if (typeof saved.orderModel === 'string' && saved.orderModel.length <= 40) settings.orderModel = saved.orderModel;
  if (typeof saved.volume === 'object' && saved.volume !== null) {
    const volume = saved.volume as Record<string, unknown>;
    for (const key of ['master', 'music', 'effects'] as const) {
      const value = volume[key];
      if (typeof value === 'number' && Number.isFinite(value)) settings.volume[key] = clampVolume(value);
    }
  }
  if (typeof saved.screenShake === 'boolean') settings.screenShake = saved.screenShake;
  return settings;
}
