import { describe, expect, it } from 'vitest';
import { defaultSettings, readSettings, writeSettings } from './settings';

describe('settings', () => {
  it('default to a window that fits the screen, sharp resolution, not fullscreen, no model download and the build’s own relay', () => {
    expect(readSettings(null)).toEqual({
      version: 1,
      fullscreen: false,
      windowScale: null,
      resolution: 'auto',
      orderModel: null,
      volume: { master: 0.8, music: 0.6, effects: 0.8 },
      screenShake: true,
      relayUrl: null,
    });
  });

  it('keep a relay address only if it is one the game can use', () => {
    expect(readSettings(JSON.stringify({ relayUrl: 'wss://relay.example.com' })).relayUrl).toBe('wss://relay.example.com');
    expect(readSettings(JSON.stringify({ relayUrl: 'http://relay.example.com' })).relayUrl).toBeNull();
    expect(readSettings(JSON.stringify({ relayUrl: 42 })).relayUrl).toBeNull();
    const settings = { ...defaultSettings(), relayUrl: 'ws://192.168.1.20:8787' };
    expect(readSettings(writeSettings(settings))).toEqual(settings);
  });

  it('come back exactly as written', () => {
    const settings = { ...defaultSettings(), fullscreen: true, windowScale: 1.5, resolution: 1 as const, orderModel: 'smollm2-360m' };
    expect(readSettings(writeSettings(settings))).toEqual(settings);
  });

  it('fall back to defaults for anything damaged', () => {
    expect(readSettings('not json')).toEqual(defaultSettings());
    expect(readSettings(JSON.stringify({ fullscreen: 'yes', windowScale: 40, resolution: 7, orderModel: 42 }))).toEqual(defaultSettings());
    expect(readSettings(JSON.stringify({ resolution: 2 })).resolution).toBe(2);
  });

  it('keep volumes between 0 and 1 in tenths, and fill in what an older file lacks', () => {
    const read = readSettings(JSON.stringify({ volume: { master: 0.33, music: 7, effects: 'loud' }, screenShake: false }));
    expect(read.volume).toEqual({ master: 0.3, music: 1, effects: defaultSettings().volume.effects });
    expect(read.screenShake).toBe(false);
    // A settings file from before session 6B has neither: the defaults fill them in.
    const old = readSettings(JSON.stringify({ version: 1, fullscreen: true, windowScale: null, resolution: 'auto', orderModel: null }));
    expect(old.volume).toEqual(defaultSettings().volume);
    expect(old.screenShake).toBe(true);
    expect(old.fullscreen).toBe(true);
  });
});
