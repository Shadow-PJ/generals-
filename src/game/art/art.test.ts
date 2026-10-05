import { describe, expect, it } from 'vitest';
import { MAPS } from '../../data/maps';
import { lungeShare, poseAt, STEP_MS } from './animate';
import { forestTrees, groundImage, GROUND_STYLES, scatteredScenery } from './ground';
import { ART_SHEET } from './index';
import { BASE, FLASH, sidePalette } from './palette';
import { mirror, patch, runs, spriteProblems } from './pixels';
import { PROP_ART } from './props';
import { TROOP_ART, TROOP_FRAMES } from './troops';

describe('pixel art', () => {
  it('every sprite is well formed: frames the right size, every pixel a palette color', () => {
    const problems = ART_SHEET.flatMap((e) => spriteProblems(e.name, e.sprite, e.palette));
    expect(problems).toEqual([]);
    expect(ART_SHEET.length).toBeGreaterThan(30);
  });

  it('turns rows into runs of one color, skipping the clear pixels', () => {
    expect(runs(['kk.Ak', '.....'], sidePalette('player'))).toEqual([
      { x: 0, y: 0, w: 2, color: BASE.k },
      { x: 3, y: 0, w: 1, color: sidePalette('player').A },
      { x: 4, y: 0, w: 1, color: BASE.k },
    ]);
    expect(mirror(['ab.', 'c..'])).toEqual(['.ba', '..c']);
    expect(patch(['a', 'b', 'c'], { 1: 'x' })).toEqual(['a', 'x', 'c']);
  });

  it('draws both armies from one drawing: only the side colors differ', () => {
    const rows = TROOP_ART.vanguard.frames.stand!;
    const you = runs(rows, sidePalette('player'));
    const them = runs(rows, sidePalette('enemy'));
    expect(you.map((r) => [r.x, r.y, r.w])).toEqual(them.map((r) => [r.x, r.y, r.w]));
    expect(you.some((r, i) => r.color !== them[i]!.color)).toBe(true);
    expect(new Set(runs(rows, FLASH).map((r) => r.color))).toEqual(new Set([0xffffff]));
  });

  it('gives every troop class its standing and walking frames, and the walk changes the legs', () => {
    for (const art of Object.values(TROOP_ART)) {
      expect(Object.keys(art.frames)).toEqual([...TROOP_FRAMES]);
      expect(art.frames.stepA).not.toEqual(art.frames.stand);
      expect(art.frames.stepA!.slice(0, 13)).toEqual(art.frames.stand!.slice(0, 13));
    }
  });
});

describe('troop animation', () => {
  it('walks through two frames and stands still otherwise', () => {
    const frames = new Set([0, 1, 2, 3].map((i) => poseAt(true, i * STEP_MS, 1).frame));
    expect(frames).toEqual(new Set(['stepA', 'stepB']));
    expect(poseAt(false, 1234, 3).frame).toBe('stand');
    expect(Math.abs(poseAt(false, 0, 1).bob)).toBeLessThanOrEqual(1);
  });

  it('leans into a blow and back, then stops', () => {
    expect(lungeShare(0)).toBe(0);
    expect(lungeShare(56)).toBeGreaterThan(0.95);
    expect(lungeShare(140)).toBeLessThan(0.3);
    expect(lungeShare(500)).toBe(0);
    expect(lungeShare(-5)).toBe(0);
  });
});

describe('the ground', () => {
  it('has a style for every map, and the same map always looks the same', () => {
    for (const map of Object.values(MAPS)) expect(GROUND_STYLES[map.id]).toBeDefined();
    const a = groundImage(MAPS.voidRuins);
    const b = groundImage(MAPS.voidRuins);
    expect(a.pixels).toEqual(b.pixels);
    expect(a.w * a.h).toBe(a.pixels.length);
    expect(a.pixels.every((p) => p !== 0)).toBe(true);
  });

  it('packs trees into forests and keeps scattered scenery off the walls and out of the woods', () => {
    const forest = MAPS.deepForest;
    const trees = forestTrees(forest);
    expect(trees.length).toBeGreaterThan(40);
    for (const tree of trees) {
      // Each tree stands (mostly) inside a forest: its middle is in one.
      const mx = (tree.x + 8) * 2;
      const my = (tree.y + 8) * 2;
      expect(forest.forests!.some((f) => mx >= f.x && mx <= f.x + f.w && my >= f.y && my <= f.y + f.h)).toBe(true);
    }
    for (const map of Object.values(MAPS)) {
      const blocked = [...map.walls, ...(map.forests ?? [])];
      for (const p of scatteredScenery(map, GROUND_STYLES[map.id]!)) {
        const sprite = PROP_ART[p.prop];
        const r = { x: p.x * 2, y: p.y * 2, w: sprite.w * 2, h: sprite.h * 2 };
        expect(blocked.some((b) => r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h)).toBe(false);
      }
    }
  });
});
