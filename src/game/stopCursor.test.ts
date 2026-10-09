import { describe, expect, it } from 'vitest';
import { firstTakeable } from './stopCursor';

describe('where a stop’s cursor starts (session 7H)', () => {
  it('passes over what you can’t take, like stock you can’t afford', () => {
    expect(firstTakeable([{ problem: 'Not enough gold' }, { problem: 'Not enough gold' }, { problem: null }])).toBe(2);
    expect(firstTakeable([{ problem: null }, { problem: 'Not enough gold' }])).toBe(0);
  });

  it('starts on the first option when none can be taken', () => {
    expect(firstTakeable([{ problem: 'No' }, { problem: 'No' }])).toBe(0);
    expect(firstTakeable([])).toBe(0);
  });
});
