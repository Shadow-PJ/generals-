import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from '../data/battle';
import { stepBattle } from './battle';
import { performAttack, updateProjectiles } from './combat';
import { isLineClear } from './navigation';
import { battleWith } from './testing/fixtures';

// A wall between a Ranger on the left and a Guardian on the right.
const wall = { x: 480, y: 200, w: 40, h: 200 };

function shootingAcrossWall(hp?: number) {
  const state = battleWith([{ cls: 'ranger', x: 380, y: 300 }], [{ cls: 'guardian', x: 600, y: 300 }], {
    walls: [hp === undefined ? wall : { ...wall, hp }],
  });
  const [ranger, target] = state.units;
  return { state, ranger: ranger!, target: target! };
}

function fireOneShot(state: ReturnType<typeof shootingAcrossWall>['state'], from: number, to: number) {
  performAttack(state, state.units[from]!, state.units[to]!);
  while (state.projectiles.length > 0) updateProjectiles(state);
}

describe('walls', () => {
  it('start with the HP from src/data, or the HP the map gives them', () => {
    expect(shootingAcrossWall().state.walls[0]).toMatchObject({ id: 1, hp: BATTLE_RULES.walls.hp });
    expect(shootingAcrossWall(80).state.walls[0]).toMatchObject({ hp: 80, maxHp: 80 });
  });

  it('stop a shot like a shield: the wall takes the hit, the target takes nothing', () => {
    const { state, target } = shootingAcrossWall();
    fireOneShot(state, 0, 1);
    expect(target.hp).toBe(target.stats.maxHp);
    expect(state.walls[0]!.hp).toBeLessThan(state.walls[0]!.maxHp);
    expect(state.events).toEqual([expect.objectContaining({ type: 'wallHit', wallId: 1, sourceId: 1 })]);
  });

  it('break when their HP runs out, then let shots and units through', () => {
    const { state, target } = shootingAcrossWall(40);
    expect(isLineClear(state.nav, 380, 300, 600, 300)).toBe(false);

    fireOneShot(state, 0, 1);
    fireOneShot(state, 0, 1);
    expect(state.walls[0]!.hp).toBe(0);
    expect(state.events.some((e) => e.type === 'wallBreak' && e.wallId === 1)).toBe(true);
    // The path graph was rebuilt without the broken wall.
    expect(isLineClear(state.nav, 380, 300, 600, 300)).toBe(true);

    fireOneShot(state, 0, 1);
    expect(target.hp).toBeLessThan(target.stats.maxHp);
  });

  it('stop every shot that reaches them in the same tick, even when the first of them breaks them', () => {
    // Two Rangers shoot at each other across a worn wall at the same moment. Whichever shot is
    // handled first breaks the wall; the other must not fly through, or that side would gain.
    const state = battleWith([{ cls: 'ranger', x: 380, y: 300 }], [{ cls: 'ranger', x: 620, y: 300 }], {
      walls: [{ ...wall, hp: 1 }],
    });
    const [left, right] = state.units;
    performAttack(state, left!, right!);
    performAttack(state, right!, left!);
    while (state.projectiles.length > 0) updateProjectiles(state);
    expect(state.walls[0]!.hp).toBe(0);
    expect(left!.hp).toBe(left!.stats.maxHp);
    expect(right!.hp).toBe(right!.stats.maxHp);
  });

  it('wear down in a real battle until the troops behind them can be hit', () => {
    // This wall spans the whole map, so the Guardian can't walk around it.
    const state = battleWith([{ cls: 'ranger', x: 380, y: 300 }], [{ cls: 'guardian', x: 600, y: 300 }], {
      walls: [{ x: 480, y: 0, w: 40, h: 600 }],
    });
    const target = state.units[1]!;
    while (!state.result && state.walls[0]!.hp > 0) stepBattle(state);
    expect(target.hp).toBe(target.stats.maxHp);
    expect(state.walls[0]!.hp).toBe(0);
    const hpWhenWallBroke = target.hp;
    for (let i = 0; i < 200; i++) stepBattle(state);
    expect(target.hp).toBeLessThan(hpWhenWallBroke);
  });
});
