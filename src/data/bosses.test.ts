import { describe, expect, it } from 'vitest';
import { BOSSES, isBoss, recruitedGenerals } from './bosses';
import { GENERAL_IDS } from './generals';
import { REGION_IDS, REGIONS } from './regions';

describe('boss Generals', () => {
  it('every region’s ruler is a boss with a rule and a way to beat it; the Captain is not', () => {
    for (const region of REGION_IDS) {
      const ruler = REGIONS[region].ruler;
      expect(isBoss(ruler)).toBe(true);
      if (isBoss(ruler)) expect(BOSSES[ruler].rule.length * BOSSES[ruler].counter.length).toBeGreaterThan(0);
    }
    expect(isBoss('captain')).toBe(false);
  });

  it('you lead with the Captain, and with each ruler once you have beaten them', () => {
    expect(recruitedGenerals([])).toEqual(['captain']);
    expect(recruitedGenerals(['warlord', 'hiveMother'])).toEqual(GENERAL_IDS.filter((g) => ['captain', 'warlord', 'hiveMother'].includes(g)));
  });
});
