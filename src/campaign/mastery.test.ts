import { describe, expect, it } from 'vitest';
import { MASTERY } from '../data/mastery';
import { newCampaign } from './company';
import { hasLook, masteryId, titles, withMastery } from './mastery';

describe('General Mastery in the campaign', () => {
  it('has three challenges per General, each with a title', () => {
    for (const challenges of Object.values(MASTERY)) {
      expect(challenges).toHaveLength(3);
      for (const c of challenges) expect(c.title.length * c.text.length).toBeGreaterThan(0);
    }
  });

  it('keeps each challenge met once, gives its title, and the look once all three are met', () => {
    let c = withMastery(newCampaign(), [masteryId('warlord', 1)]);
    c = withMastery(c, [masteryId('warlord', 1), masteryId('warlord', 0)]);
    expect(c.mastery).toEqual(['warlord.1', 'warlord.0']);
    expect(titles(c)).toEqual([`Warlord ${MASTERY.warlord[1]!.title}`, `Warlord ${MASTERY.warlord[0]!.title}`]);
    expect(hasLook(c, 'warlord')).toBe(false);
    c = withMastery(c, [masteryId('warlord', 2)]);
    expect(hasLook(c, 'warlord')).toBe(true);
    expect(hasLook(c, 'captain')).toBe(false);
  });
});
