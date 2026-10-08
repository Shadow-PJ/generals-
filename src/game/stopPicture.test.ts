import { describe, expect, it } from 'vitest';
import { PICTURE_GAP, pictureHeight, STOP_PICTURE_H, STOP_PICTURE_MAX_H } from './stopPicture';
import { GAME_HEIGHT } from './theme';

describe('the stop picture', () => {
  it('grows into the room the options leave, up to its tallest', () => {
    // A rest camp: a line or two and one option.
    expect(pictureHeight(120)).toBe(STOP_PICTURE_MAX_H);
    // A long merchant list leaves it at its shortest.
    expect(pictureHeight(520)).toBe(STOP_PICTURE_H);
    expect(pictureHeight(2000)).toBe(STOP_PICTURE_H);
  });

  it('never pushes the options into the help line, and grows in steps', () => {
    for (let content = 0; content < 700; content += 7) {
      const h = pictureHeight(content);
      if (h > STOP_PICTURE_H) expect(h + PICTURE_GAP + content).toBeLessThanOrEqual(GAME_HEIGHT - 66);
      expect(h % 20).toBe(0);
    }
  });
});
