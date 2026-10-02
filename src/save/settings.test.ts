import { describe, expect, it } from 'vitest';
import { defaultSettings, readSettings, writeSettings } from './settings';

describe('settings', () => {
  it('default to a window that fits the screen, sharp resolution, not fullscreen', () => {
    expect(readSettings(null)).toEqual({ version: 1, fullscreen: false, windowScale: null, resolution: 'auto' });
  });

  it('come back exactly as written', () => {
    const settings = { ...defaultSettings(), fullscreen: true, windowScale: 1.5, resolution: 1 as const };
    expect(readSettings(writeSettings(settings))).toEqual(settings);
  });

  it('fall back to defaults for anything damaged', () => {
    expect(readSettings('not json')).toEqual(defaultSettings());
    expect(readSettings(JSON.stringify({ fullscreen: 'yes', windowScale: 40, resolution: 7 }))).toEqual(defaultSettings());
    expect(readSettings(JSON.stringify({ resolution: 2 })).resolution).toBe(2);
  });
});
