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
