import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from '../data/battle';
import { stepBattle } from './battle';
import { dealDamage } from './combat';
import { overtimeMultiplier, overtimeStartTick } from './overtime';
import { battleWith } from './testing/fixtures';
import { secondsToTicks } from './time';

describe('Overtime', () => {
  it('starts at the time set in src/data', () => {
    expect(overtimeStartTick()).toBe(secondsToTicks(BATTLE_RULES.overtime.startSeconds));
  });

  it('leaves damage alone before it starts, then grows it every second', () => {
    const start = overtimeStartTick();
    const perSecond = BATTLE_RULES.overtime.damageBonusPerSecond;
    expect(overtimeMultiplier(0)).toBe(1);
    expect(overtimeMultiplier(start - 1)).toBe(1);
    expect(overtimeMultiplier(start)).toBe(1);
    expect(overtimeMultiplier(start + secondsToTicks(10))).toBeCloseTo(1 + 10 * perSecond);
  });

  it('makes the same hit hurt more in Overtime', () => {
    const state = battleWith([{ cls: 'ranger', x: 100, y: 100 }], [{ cls: 'vanguard', x: 900, y: 500 }]);
    const [ranger, target] = state.units;
    dealDamage(state, ranger!.id, target!, 100, 0, 'attack');
    const before = target!.stats.maxHp - target!.hp;
    state.tick = overtimeStartTick() + secondsToTicks(10);
    const hpBefore = target!.hp;
    dealDamage(state, ranger!.id, target!, 100, 0, 'attack');
    expect(hpBefore - target!.hp).toBeGreaterThan(before * 1.5);
  });

  it('is announced in the event log', () => {
    // A wall across the map keeps two Vanguards apart until the time limit.
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 700, y: 300 }], {
      walls: [{ x: 480, y: 0, w: 40, h: 600 }],
    });
    while (!state.result) stepBattle(state);
    expect(state.events.filter((e) => e.type === 'overtime')).toEqual([{ tick: overtimeStartTick(), type: 'overtime' }]);
  });
});
