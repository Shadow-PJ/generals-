import { describe, expect, it } from 'vitest';
import type { DesktopBridge } from './bridge';
import { createDesktopPlatform } from './desktop';

function fakeBridge() {
  const files = new Map<string, string>();
  const calls: string[] = [];
  let onFullscreen: (on: boolean) => void = () => undefined;
  const bridge: DesktopBridge = {
    info: async () => ({ savesFolder: 'C:\\Users\\Ali\\AppData\\Roaming\\Generals\\saves', fullscreen: false, workArea: { width: 1920, height: 1040 } }),
    readFile: async (name) => files.get(name) ?? null,
    writeFile: async (name, text) => void files.set(name, text),
    setFullscreen: async (on) => void calls.push(`fullscreen ${on}`),
    setWindowSize: async (w, h) => void calls.push(`size ${w}x${h}`),
    openSavesFolder: async () => void calls.push('open'),
    onFullscreenChange: (listener) => {
      onFullscreen = listener;
    },
    ready: () => void calls.push('ready'),
    quit: () => void calls.push('quit'),
  };
  return { bridge, files, calls, fullscreenFromOutside: (on: boolean) => onFullscreen(on) };
}

describe('desktop platform', () => {
  it('sends file reads and writes to the main process', async () => {
    const fake = fakeBridge();
    const platform = await createDesktopPlatform(fake.bridge);
    await platform.files.write('saves/profile.json', 'x');
    expect(fake.files.get('saves/profile.json')).toBe('x');
    expect(await platform.files.read('saves/profile.json')).toBe('x');
    expect(platform.saveFolder).toContain('Generals');
  });

  it('knows when fullscreen changes, from the game or from outside', async () => {
    const fake = fakeBridge();
    const platform = await createDesktopPlatform(fake.bridge);
    const heard: boolean[] = [];
    platform.display.onFullscreenChange((on) => heard.push(on));
    expect(platform.display.isFullscreen()).toBe(false);
    await platform.display.setFullscreen(true);
    expect(platform.display.isFullscreen()).toBe(true);
    fake.fullscreenFromOutside(false);
    expect(platform.display.isFullscreen()).toBe(false);
    expect(heard).toEqual([false]);
  });

  it('can size its window and shows it only once', async () => {
    const fake = fakeBridge();
    const platform = await createDesktopPlatform(fake.bridge);
    expect(platform.display.canSizeWindow).toBe(true);
    expect(platform.display.workArea()).toEqual({ width: 1920, height: 1040 });
    await platform.display.setWindowSize(1200, 880);
    platform.ready();
    platform.ready();
    expect(fake.calls).toEqual(['size 1200x880', 'ready']);
  });
});
