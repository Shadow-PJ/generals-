import { describe, expect, it } from 'vitest';
import { REGION_IDS } from '../../data/regions';
import { backdropPixels, FRAME_STYLES, framePixels, type FrameStyleId } from './frames';
import { bayer, ramp } from './noise';
import { titleLayout, titlePixels } from './title';
import { WALL_FRONT, wallPixels, type WallKind } from './walls';
import { cloudPixels, landAt, medallionPixels, regionLandPixels, roadPixels, worldMapPixels, type WorldMapPlan } from './worldMap';

const alpha = (argb: number) => argb >>> 24;
const rgb = (argb: number) => argb & 0xffffff;

describe('dithering', () => {
  it('blends two shades of a ramp without new colors', () => {
    const shades = [0x111111, 0x222222, 0x333333];
    const seen = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.add(ramp(shades, 0.25, x, y));
    expect(seen).toEqual(new Set([0x111111, 0x222222]));
    expect(ramp(shades, 0, 1, 1)).toBe(0x111111);
    expect(ramp(shades, 1, 1, 1)).toBe(0x333333);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(bayer(x, y)).toBeLessThan(1);
  });
});

describe('frames', () => {
  it('cuts the corners, rings the box in its outline and fills the rest', () => {
    for (const id of Object.keys(FRAME_STYLES) as FrameStyleId[]) {
      const style = FRAME_STYLES[id];
      const { w, h, pixels } = framePixels(style, 40, 16);
      expect(pixels.length).toBe(w * h);
      for (const [x, y] of [
        [0, 0],
        [w - 1, 0],
        [0, h - 1],
        [w - 1, h - 1],
      ] as const)
        expect(pixels[y * w + x], `${id} corner`).toBe(0);
      expect(rgb(pixels[w + 0]!), `${id} left edge`).toBe(style.outline);
      expect(rgb(pixels[5]!), `${id} top edge`).toBe(style.outline);
      // Inside, nothing is clear.
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) expect(alpha(pixels[y * w + x]!)).toBe(0xff);
    }
  });

  it('lights a trim from the top left and stands a button on its lip', () => {
    const panel = framePixels(FRAME_STYLES.panel, 30, 20);
    const at = (x: number, y: number) => rgb(panel.pixels[y * panel.w + x]!);
    expect(at(10, 1)).toBe(FRAME_STYLES.panel.trim.light);
    expect(at(10, panel.h - 2)).toBe(FRAME_STYLES.panel.trim.dark);
    expect(at(panel.w - 2, 10)).toBe(FRAME_STYLES.panel.trim.dark);
    const button = framePixels(FRAME_STYLES.button, 30, 12);
    expect(rgb(button.pixels[(button.h - 2) * button.w + 10]!)).toBe(FRAME_STYLES.button.lip.color);
  });

  it('draws the same backdrop every time, with no holes', () => {
    const a = backdropPixels(60, 40);
    expect(a.pixels).toEqual(backdropPixels(60, 40).pixels);
    expect(a.pixels.every((p) => alpha(p) === 0xff)).toBe(true);
  });
});

describe('walls', () => {
  it('draws every kind as a block: cut corners, a lit top and a shaded front along the bottom', () => {
    for (const kind of ['brick', 'rock', 'iron', 'palisade'] as WallKind[]) {
      const { w, h, pixels } = wallPixels(20, 30, kind);
      expect(pixels[0]).toBe(0);
      const brightness = (p: number) => ((p >>> 16) & 0xff) + ((p >>> 8) & 0xff) + (p & 0xff);
      const row = (y: number) => {
        let sum = 0;
        for (let x = 1; x < w - 1; x++) sum += brightness(pixels[y * w + x]!);
        return sum / (w - 2);
      };
      // The top edge is the brightest row; the front face is darker than the top face.
      expect(row(1), kind).toBeGreaterThan(row(h - 3));
      expect(row(h / 2), kind).toBeGreaterThan(row(h - 1 - Math.floor(WALL_FRONT / 2)));
    }
  });
});

describe('the title screen', () => {
  it('paints the same dusk every time, with no holes, the sun above the castle hill', () => {
    const a = titlePixels(120, 88);
    expect(a.pixels).toEqual(titlePixels(120, 88).pixels);
    expect(a.pixels.every((p) => alpha(p) === 0xff)).toBe(true);
    const layout = titleLayout(120, 88);
    expect(layout.sun.y).toBeLessThan(layout.hill.y);
    expect(layout.sun.x).toBe(layout.hill.x);
    // The top of the sky is darker than the sky by the sun.
    const brightness = (p: number) => ((p >>> 16) & 0xff) + ((p >>> 8) & 0xff) + (p & 0xff);
    expect(brightness(a.pixels[1 * 120 + 2]!)).toBeLessThan(brightness(a.pixels[(layout.sun.y - layout.sun.r - 2) * 120 + layout.sun.x]!));
  });
});

describe('the world map', () => {
  const capital = { x: 143, y: 138 };
  const plan: WorldMapPlan = {
    w: 288,
    h: 258,
    capital,
    regions: REGION_IDS.map((region, i) => {
      const angle = ((-90 + 72 * i) * Math.PI) / 180;
      return { region, x: Math.round(capital.x + 97.5 * Math.cos(angle)), y: Math.round(capital.y + 97.5 * Math.sin(angle)) };
    }),
  };

  it('puts the Capital and every region on land, with sea all around the edge', () => {
    expect(landAt(plan, capital.x, capital.y)).toBe(true);
    for (const r of plan.regions) {
      for (const [dx, dy] of [
        [0, 0],
        [-10, 0],
        [10, 0],
        [0, -10],
        [0, 10],
      ] as const)
        expect(landAt(plan, r.x + dx, r.y + dy), `${r.region}`).toBe(true);
    }
    expect(landAt(plan, 0, 0)).toBe(false);
    expect(landAt(plan, plan.w - 1, 0)).toBe(false);
    expect(landAt(plan, 0, plan.h - 1)).toBe(false);
  });

  it('runs a road from the Capital to each region', () => {
    const road = roadPixels(plan);
    const near = (p: { x: number; y: number }) => [...road].some((i) => Math.abs((i % plan.w) - p.x) <= 1 && Math.abs(Math.floor(i / plan.w) - p.y) <= 1);
    expect(near(capital)).toBe(true);
    for (const r of plan.regions) expect(near(r), r.region).toBe(true);
  });

  it('looks the same every time, every pixel filled', () => {
    const a = worldMapPixels(plan);
    expect(a.pixels).toEqual(worldMapPixels(plan).pixels);
    expect(a.pixels.every((p) => alpha(p) === 0xff)).toBe(true);
    for (const region of REGION_IDS) expect(regionLandPixels(60, 30, region).pixels.every((p) => alpha(p) === 0xff)).toBe(true);
  });

  it('makes fog clouds see-through at their edges and medallions round', () => {
    const cloud = cloudPixels(40, 22, 1);
    expect(cloud.pixels[0]).toBe(0);
    expect(alpha(cloud.pixels[12 * 40 + 20]!)).toBeGreaterThan(0);
    const medallion = medallionPixels(20, { light: 0xffffff, dark: 0x888888 }, 0x224422);
    expect(medallion.pixels[0]).toBe(0);
    expect(rgb(medallion.pixels[10 * 20 + 10]!)).toBe(0x224422);
  });
});
