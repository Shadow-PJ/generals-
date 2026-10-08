import { describe, expect, it } from 'vitest';
import { DamageTally, TALLY_MS } from './damageTally';

describe('damage tally', () => {
  it('adds hits on one troop close together into one growing number', () => {
    const tally = new DamageTally();
    expect(tally.add(1, 12, 0)).toEqual({ total: 12, fresh: true });
    expect(tally.add(1, 19, 200)).toEqual({ total: 31, fresh: false });
    // Each hit keeps the number open a little longer.
    expect(tally.add(1, 16, 200 + TALLY_MS)).toEqual({ total: 47, fresh: false });
  });

  it('starts a new number once the troop has gone a moment without a hit', () => {
    const tally = new DamageTally();
    tally.add(1, 12, 0);
    expect(tally.add(1, 8, TALLY_MS + 1)).toEqual({ total: 8, fresh: true });
  });

  it('keeps each troop’s number apart', () => {
    const tally = new DamageTally();
    tally.add(1, 12, 0);
    expect(tally.add(2, 5, 10)).toEqual({ total: 5, fresh: true });
    expect(tally.add(1, 3, 20)).toEqual({ total: 15, fresh: false });
  });

  it('forgets everything when cleared', () => {
    const tally = new DamageTally();
    tally.add(1, 12, 0);
    tally.clear();
    expect(tally.add(1, 4, 10)).toEqual({ total: 4, fresh: true });
  });
});
