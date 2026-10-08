import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { achievementIcon, ICON_SIZE } from './achievementIcons';

describe('achievement icons', () => {
  it('draws every achievement, earned in color and not yet earned in gray', () => {
    const seen = new Set<string>();
    for (const achievement of ACHIEVEMENTS) {
      const earned = achievementIcon(achievement, true);
      const locked = achievementIcon(achievement, false);
      expect([earned.width, earned.height]).toEqual([ICON_SIZE, ICON_SIZE]);
      let colorful = false;
      let gray = true;
      for (let p = 0; p < ICON_SIZE * ICON_SIZE * 4; p += 4) {
        if (earned.rgba[p] !== earned.rgba[p + 2]) colorful = true;
        if (locked.rgba[p] !== locked.rgba[p + 1] || locked.rgba[p + 1] !== locked.rgba[p + 2]) gray = false;
      }
      expect(colorful, achievement.id).toBe(true);
      expect(gray, achievement.id).toBe(true);
      seen.add(Buffer.from(earned.rgba).toString('base64'));
    }
    // Rulers and ranks each look different; a few others share a picture.
    expect(seen.size).toBeGreaterThanOrEqual(ACHIEVEMENTS.length - 2);
  });
});

describe('scaling an icon up for a store that wants it bigger', () => {
  it('turns each pixel into a square block, so the pixel art stays sharp', () => {
    const icon = achievementIcon(ACHIEVEMENTS[0]!, true);
    const big = icon.scaled(4);
    expect([big.width, big.height]).toEqual([ICON_SIZE * 4, ICON_SIZE * 4]);
    let same = true;
    for (let y = 0; y < big.height && same; y += 7) {
      for (let x = 0; x < big.width; x += 5) {
        const a = (y * big.width + x) * 4;
        const b = (Math.floor(y / 4) * ICON_SIZE + Math.floor(x / 4)) * 4;
        if (big.rgba.subarray(a, a + 4).join() !== icon.rgba.subarray(b, b + 4).join()) same = false;
      }
    }
    expect(same).toBe(true);
    expect(() => icon.scaled(1.5)).toThrow();
  });
});
