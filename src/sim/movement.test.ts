import { describe, expect, it } from 'vitest';
import { circleOverlapsRect, distance } from './geometry';
import { isSpaceFree, separateUnits, slideMove, walkToward } from './movement';
import { battleWith } from './testing/fixtures';

const wall = { x: 400, y: 100, w: 50, h: 400 };

/** A battle on the test map with the wall, troops far away from it. */
function walledBattle() {
  return battleWith([{ cls: 'ranger', x: 100, y: 550 }], [{ cls: 'ranger', x: 900, y: 550 }], { walls: [wall] });
}

describe('movement', () => {
  it('treats walls and the map edge as solid', () => {
    const state = walledBattle();
    expect(isSpaceFree(state, 300, 300, 10)).toBe(true);
    expect(isSpaceFree(state, 395, 300, 10)).toBe(false);
    expect(isSpaceFree(state, 5, 300, 10)).toBe(false);
    expect(isSpaceFree(state, 995, 300, 10)).toBe(false);
  });

  it('lets units through a wall once it is broken', () => {
    const state = walledBattle();
    state.walls[0]!.hp = 0;
    expect(isSpaceFree(state, 425, 300, 10)).toBe(true);
  });

  it('slides along a wall instead of entering it', () => {
    const state = walledBattle();
    // Moving diagonally into the wall's face keeps only the sideways part.
    expect(slideMove(state, 385, 300, 10, 10, 10)).toEqual({ x: 385, y: 310 });
    // Moving straight into it doesn't move at all.
    expect(slideMove(state, 385, 300, 10, 10, 0)).toEqual({ x: 385, y: 300 });
  });

  it('walks around a wall to reach a goal behind it, never touching the wall', () => {
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], {
      walls: [wall],
    });
    const unit = state.units[0]!;
    const goal = { x: 600, y: 300 };
    for (let tick = 0; tick < 400 && distance(unit.x, unit.y, goal.x, goal.y) > 1; tick++) {
      state.tick = tick;
      walkToward(state, unit, goal);
      expect(circleOverlapsRect(unit.x, unit.y, unit.stats.radius, wall)).toBe(false);
    }
    expect(distance(unit.x, unit.y, goal.x, goal.y)).toBeLessThanOrEqual(1);
  });

  it('pushes overlapping units apart, the same way whatever their order', () => {
    const state = battleWith(
      [{ cls: 'ranger', x: 300, y: 300 }],
      [{ cls: 'ranger', x: 310, y: 300 }],
    );
    separateUnits(state);
    const [a, b] = state.units;
    expect(distance(a!.x, a!.y, b!.x, b!.y)).toBeCloseTo(a!.stats.radius + b!.stats.radius);
    // Both moved the same amount, in opposite directions.
    expect(a!.x).toBeCloseTo(295);
    expect(b!.x).toBeCloseTo(315);
  });
});
