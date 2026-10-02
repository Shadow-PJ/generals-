import { describe, expect, it } from 'vitest';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../data/armies';
import { OPEN_FIELD } from '../data/maps';
import { isArmyPlaced, placementProblem } from './placement';
import { openMap } from './testing/fixtures';

describe('placing troops before battle', () => {
  it('accepts the starter armies on the Open Field, for both sides', () => {
    expect(isArmyPlaced(OPEN_FIELD, 'player', STARTER_ARMY)).toBe(true);
    expect(isArmyPlaced(OPEN_FIELD, 'enemy', STARTER_ARMY_MIRRORED)).toBe(true);
  });

  it("keeps troops inside their own side's deploy zone, body and all", () => {
    expect(placementProblem(OPEN_FIELD, 'player', 'ranger', 150, 270, [])).toBeNull();
    expect(placementProblem(OPEN_FIELD, 'player', 'ranger', 800, 270, [])).toBe('outsideZone');
    expect(placementProblem(OPEN_FIELD, 'enemy', 'ranger', 150, 270, [])).toBe('outsideZone');
    // The zone starts at x = 40; a Ranger's body is 10 wide on each side.
    expect(placementProblem(OPEN_FIELD, 'player', 'ranger', 45, 270, [])).toBe('outsideZone');
  });

  it('keeps troops out of walls', () => {
    const map = openMap([{ x: 100, y: 100, w: 50, h: 50 }]);
    expect(placementProblem(map, 'player', 'vanguard', 125, 125, [])).toBe('wall');
    expect(placementProblem(map, 'player', 'vanguard', 125, 200, [])).toBeNull();
  });

  it("keeps troops from standing on each other", () => {
    const others = [{ cls: 'vanguard' as const, x: 150, y: 270 }];
    expect(placementProblem(OPEN_FIELD, 'player', 'ranger', 160, 270, others)).toBe('crowded');
    expect(placementProblem(OPEN_FIELD, 'player', 'ranger', 180, 270, others)).toBeNull();
    expect(isArmyPlaced(OPEN_FIELD, 'player', [...others, { cls: 'ranger', x: 155, y: 270 }])).toBe(false);
  });
});
