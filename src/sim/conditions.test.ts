import { describe, expect, it } from 'vitest';
import { checkCondition, checkTrigger } from './conditions';
import { battleWith } from './testing/fixtures';

describe('card conditions', () => {
  it('an enemy reaches your backline: near one of your Rangers or Guardians', () => {
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 100, y: 300 },
      ],
      [{ cls: 'vanguard', x: 170, y: 300 }],
    );
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    expect(checkTrigger(state, 'player', { kind: 'enemyReachesBackline', enemy: 'any' })).toEqual({
      met: true,
      enemyId: enemy.id,
      allyId: null,
    });
    expect(checkTrigger(state, 'player', { kind: 'enemyReachesBackline', enemy: 'vanguard' }).met).toBe(true);
    expect(checkTrigger(state, 'player', { kind: 'enemyReachesBackline', enemy: 'assassin' }).met).toBe(false);
    enemy.x = 600;
    expect(checkTrigger(state, 'player', { kind: 'enemyReachesBackline', enemy: 'any' }).met).toBe(false);
  });

  it('an ally drops below a set HP: points at the most hurt one', () => {
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 100, y: 200 },
        { cls: 'ranger', x: 100, y: 400 },
      ],
      [{ cls: 'vanguard', x: 900, y: 300 }],
    );
    const [a, b] = state.units.filter((u) => u.cls === 'ranger');
    a!.hp = a!.stats.maxHp * 0.45;
    b!.hp = b!.stats.maxHp * 0.3;
    expect(checkTrigger(state, 'player', { kind: 'allyBelowHp', ally: 'ranger', hpPercent: 50 })).toMatchObject({
      met: true,
      allyId: b!.id,
    });
    expect(checkTrigger(state, 'player', { kind: 'allyBelowHp', ally: 'vanguard', hpPercent: 50 }).met).toBe(false);
  });

  it('3 or more enemies close together', () => {
    const state = battleWith(
      [{ cls: 'vanguard', x: 100, y: 300 }],
      [
        { cls: 'vanguard', x: 800, y: 300 },
        { cls: 'ranger', x: 840, y: 300 },
        { cls: 'guardian', x: 820, y: 340 },
        { cls: 'ranger', x: 950, y: 50 },
      ],
    );
    expect(checkTrigger(state, 'player', { kind: 'enemiesGrouped', count: 3 }).met).toBe(true);
    expect(checkTrigger(state, 'player', { kind: 'enemiesGrouped', count: 4 }).met).toBe(false);
  });

  it('the enemy ultimate is charging: never yet, as the enemy has no General until session 4D', () => {
    const state = battleWith([{ cls: 'vanguard', x: 100, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }]);
    expect(checkTrigger(state, 'player', { kind: 'enemyUltimateCharging' }).met).toBe(false);
  });

  it('"when X and Y" needs both at once', () => {
    const state = battleWith(
      [
        { cls: 'ranger', x: 100, y: 300 },
        { cls: 'vanguard', x: 300, y: 300 },
      ],
      [{ cls: 'vanguard', x: 160, y: 300 }],
    );
    const backline = { kind: 'enemyReachesBackline', enemy: 'any' } as const;
    const hurt = { kind: 'allyBelowHp', ally: 'ranger', hpPercent: 50 } as const;
    expect(checkCondition(state, 'player', { triggers: [backline, hurt], repeat: false }).met).toBe(false);
    state.units[0]!.hp = 50;
    const check = checkCondition(state, 'player', { triggers: [backline, hurt], repeat: false });
    expect(check).toMatchObject({ met: true, allyId: state.units[0]!.id });
    expect(check.enemyId).not.toBeNull();
  });
});
