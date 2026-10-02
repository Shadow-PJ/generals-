import { describe, expect, it } from 'vitest';
import { UNIT_CLASSES } from '../data/units';
import { stepBattle } from './battle';
import { think } from './behaviors';
import { distance } from './geometry';
import { edgeDistance } from './queries';
import { battleWith } from './testing/fixtures';

describe('Vanguard behavior', () => {
  it('advances on the enemy closest to its nearest ally', () => {
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 200, y: 100 },
      ],
      [
        { cls: 'vanguard', x: 450, y: 320 },
        { cls: 'ranger', x: 380, y: 60 },
      ],
    );
    const vanguard = state.units[0]!;
    const enemyRanger = state.units.find((u) => u.side === 'enemy' && u.cls === 'ranger')!;
    // The enemy Vanguard is nearer to our Vanguard, but the enemy Ranger is nearer to our Ranger.
    expect(think(state, vanguard).action).toMatchObject({ kind: 'walk', targetId: enemyRanger.id });
  });

  it('keeps fighting an enemy in reach instead of walking away', () => {
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 200, y: 100 },
      ],
      [
        { cls: 'vanguard', x: 325, y: 300 },
        { cls: 'ranger', x: 380, y: 60 },
      ],
    );
    const vanguard = state.units[0]!;
    const enemyVanguard = state.units.find((u) => u.side === 'enemy' && u.cls === 'vanguard')!;
    expect(think(state, vanguard).action).toEqual({ kind: 'attack', targetId: enemyVanguard.id });
  });

  it('Shoves when an enemy is close and the skill is ready', () => {
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 325, y: 300 }]);
    const vanguard = state.units[0]!;
    vanguard.skillCooldown = 0;
    expect(think(state, vanguard).cast).toEqual({ skill: 'shove' });
    vanguard.skillCooldown = 10;
    expect(think(state, vanguard).cast).toBeNull();
  });
});

describe('Ranger behavior', () => {
  it('closes in until the nearest enemy is at max range, then stays there and shoots', () => {
    const state = battleWith([{ cls: 'ranger', x: 100, y: 300 }], [{ cls: 'guardian', x: 700, y: 300 }]);
    const [ranger, enemy] = state.units;
    enemy!.stats.moveSpeed = 0;
    enemy!.stats.range = 0;
    for (let i = 0; i < 400; i++) stepBattle(state);
    const gap = edgeDistance(ranger!, enemy!);
    expect(gap).toBeLessThanOrEqual(ranger!.stats.range);
    expect(gap).toBeGreaterThan(ranger!.stats.range - 5);
    expect(enemy!.hp).toBeLessThan(enemy!.stats.maxHp);
  });

  it('backs away from an enemy that gets too close, without shooting', () => {
    const state = battleWith([{ cls: 'ranger', x: 300, y: 300 }], [{ cls: 'vanguard', x: 340, y: 300 }]);
    const [ranger, enemy] = state.units;
    ranger!.attackCooldown = 0;
    expect(edgeDistance(ranger!, enemy!)).toBeLessThan(UNIT_CLASSES.ranger.behavior.retreatDistance);
    expect(think(state, ranger!).action).toMatchObject({ kind: 'backAway', targetId: enemy!.id });
  });

  it('stands and shoots once cornered against the map edge', () => {
    const state = battleWith([{ cls: 'ranger', x: 11, y: 300 }], [{ cls: 'vanguard', x: 60, y: 300 }]);
    const [ranger, enemy] = state.units;
    expect(think(state, ranger!).action).toEqual({ kind: 'attack', targetId: enemy!.id });
  });

  it('Marks its target when it shoots and the skill is ready', () => {
    const state = battleWith([{ cls: 'ranger', x: 100, y: 300 }], [{ cls: 'vanguard', x: 300, y: 300 }]);
    const ranger = state.units[0]!;
    ranger.skillCooldown = 0;
    expect(think(state, ranger).cast).toEqual({ skill: 'mark', targetId: state.units[1]!.id });
  });
});

describe('Guardian behavior', () => {
  it('goes to the most hurt ally and stands on its far side from the enemy', () => {
    const state = battleWith(
      [
        { cls: 'guardian', x: 100, y: 300 },
        { cls: 'vanguard', x: 300, y: 100 },
        { cls: 'vanguard', x: 300, y: 500 },
      ],
      [{ cls: 'ranger', x: 800, y: 500 }],
    );
    const guardian = state.units[0]!;
    const hurt = state.units.find((u) => u.side === 'player' && u.y === 500)!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.stats.range = 0;
    enemy.stats.moveSpeed = 0;
    hurt.stats.moveSpeed = 0;
    hurt.hp = 300;
    for (let i = 0; i < 200; i++) stepBattle(state);
    expect(distance(guardian.x, guardian.y, hurt.x, hurt.y)).toBeLessThan(
      UNIT_CLASSES.guardian.behavior.followDistance + 60,
    );
    // Behind its ward: farther from the enemy than the ward is.
    expect(distance(guardian.x, guardian.y, enemy.x, enemy.y)).toBeGreaterThan(
      distance(hurt.x, hurt.y, enemy.x, enemy.y),
    );
  });

  it('gives its Barrier to the most hurt ally in range, never to itself', () => {
    const state = battleWith(
      [
        { cls: 'guardian', x: 100, y: 300 },
        { cls: 'vanguard', x: 150, y: 300 },
        { cls: 'ranger', x: 150, y: 350 },
      ],
      [{ cls: 'ranger', x: 900, y: 300 }],
    );
    const [guardian, , vanguard, ranger] = state.units;
    guardian!.skillCooldown = 0;
    guardian!.hp = 50;
    vanguard!.hp = vanguard!.stats.maxHp * 0.5;
    ranger!.hp = ranger!.stats.maxHp * 0.7;
    expect(think(state, guardian!).cast).toEqual({ skill: 'barrier', targetId: vanguard!.id });

    vanguard!.hp = vanguard!.stats.maxHp;
    ranger!.hp = ranger!.stats.maxHp;
    expect(think(state, guardian!).cast).toBeNull();
  });

  it("doesn't guard other Guardians, and fights once only Guardians are left", () => {
    const state = battleWith(
      [
        { cls: 'guardian', x: 100, y: 300 },
        { cls: 'guardian', x: 150, y: 300 },
      ],
      [{ cls: 'ranger', x: 800, y: 300 }],
    );
    const [guardian, , other] = state.units;
    other!.hp = 100;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    // Two Guardians guarding each other would keep stepping back; instead it advances on the enemy.
    expect(think(state, guardian!).action).toMatchObject({ kind: 'walk', targetId: enemy.id });
  });

  it('deals the lowest damage of the three classes', () => {
    const dps = (c: keyof typeof UNIT_CLASSES) =>
      UNIT_CLASSES[c].stats.damage * UNIT_CLASSES[c].stats.attacksPerSecond;
    expect(dps('guardian')).toBeLessThan(dps('vanguard'));
    expect(dps('guardian')).toBeLessThan(dps('ranger'));
  });
});
