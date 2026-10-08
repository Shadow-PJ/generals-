import { describe, expect, it } from 'vitest';
import { REGION_IDS } from '../../data/regions';
import { BASE, SIDE_COLORS } from './palette';
import { STOP_SCENES, stopScenePixels } from './stops';

const W = 480;
const H = 60;
const colors = (pixels: Uint32Array) => new Set<number>([...pixels].map((p) => p & 0xffffff));

describe('the stop pictures (session 7E)', () => {
  it('paints every stop in every region, the whole picture, the same each time', () => {
    for (const scene of STOP_SCENES) {
      for (const region of REGION_IDS) {
        const image = stopScenePixels(scene, region, W, H);
        expect(image.w).toBe(W);
        expect(image.h).toBe(H);
        expect(image.pixels.length).toBe(W * H);
        // Plain loops: deep equality over 35 pictures of 28,800 pixels each is slow on a busy runner.
        expect(image.pixels.every((p) => p >>> 24 === 0xff)).toBe(true);
        const again = stopScenePixels(scene, region, W, H).pixels;
        expect(again.every((p, i) => p === image.pixels[i])).toBe(true);
      }
    }
  });

  it('gives each stop its own sky and each region its own land', () => {
    const top = (scene: (typeof STOP_SCENES)[number]) => stopScenePixels(scene, 'deepForest', W, H).pixels[W * 20 + 5];
    expect(new Set(STOP_SCENES.map(top)).size).toBe(STOP_SCENES.length);
    const land = REGION_IDS.map((region) => stopScenePixels('camp', region, W, H).pixels[(H - 2) * W + 3]);
    expect(new Set(land).size).toBe(REGION_IDS.length);
  });

  it('shows the place: the camp’s fire, the merchant’s stall, your banner at a won run’s end', () => {
    expect(colors(stopScenePixels('camp', 'glassPlains', W, H).pixels).has(BASE.f!)).toBe(true);
    expect(colors(stopScenePixels('merchant', 'glassPlains', W, H).pixels).has(BASE.z!)).toBe(true);
    expect(colors(stopScenePixels('won', 'redCanyon', W, H).pixels).has(SIDE_COLORS.player.A)).toBe(true);
    // A won run's field flies no enemy colors.
    expect(colors(stopScenePixels('won', 'redCanyon', W, H).pixels).has(SIDE_COLORS.enemy.A)).toBe(false);
  });

  it('grows with the screen: a taller picture keeps its scene at the bottom', () => {
    const tall = stopScenePixels('camp', 'deepForest', W, 130);
    expect(tall.h).toBe(130);
    expect(colors(tall.pixels).has(BASE.f!)).toBe(true);
  });
});
