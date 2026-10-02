import { describe, expect, it } from 'vitest';
import { renderScale } from './renderScale';

describe('resolution scaling', () => {
  it('uses a fixed setting as it is', () => {
    expect(renderScale(1, { width: 3840, height: 2160 }, 2)).toBe(1);
    expect(renderScale(1.5, { width: 960, height: 704 }, 1)).toBe(1.5);
    expect(renderScale(2, { width: 800, height: 600 }, 1)).toBe(2);
  });

  it('on Auto, draws as many pixels as the window shows, in quarter steps', () => {
    expect(renderScale('auto', { width: 960, height: 704 }, 1)).toBe(1);
    // 1280×800: the game is shown 800/704 = 1.14 times its size, rounded up to 1.25.
    expect(renderScale('auto', { width: 1280, height: 800 }, 1)).toBe(1.25);
    // Fullscreen on a 1080p monitor: 1080/704 = 1.53, so 1.75.
    expect(renderScale('auto', { width: 1920, height: 1080 }, 1)).toBe(1.75);
    // Steam Deck, 1280×800.
    expect(renderScale('auto', { width: 1280, height: 800 }, 1)).toBe(1.25);
  });

  it('on Auto, counts screen pixel density (Windows display scaling)', () => {
    // A 1080p laptop at 150% scaling: the window is 1280×720 in layout units, 1920×1080 in pixels.
    expect(renderScale('auto', { width: 1280, height: 720 }, 1.5)).toBe(1.75);
  });

  it('on Auto, never goes below 1 or above 3', () => {
    expect(renderScale('auto', { width: 400, height: 300 }, 1)).toBe(1);
    expect(renderScale('auto', { width: 7680, height: 4320 }, 2)).toBe(3);
  });
});
