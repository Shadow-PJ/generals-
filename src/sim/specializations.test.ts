import { describe, expect, it } from 'vitest';
import { SPEC_RULES, SPECIALIZATIONS, SPECIALIZATIONS_OF } from '../data/specializations';
import { TROOP_CLASSES, UNIT_CLASSES } from '../data/units';
import { stepBattle } from './battle';
import { tauntIntent } from './behaviors';
import { performAttack, updateProjectiles } from './combat';
import { castBarrier, castShove } from './skills';
import { specFor, specStats } from './specs';
import { battleWith, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks, TICKS_PER_SECOND } from './time';
import type { BattleEvent, BattleState } from './types';

function damageTo(state: BattleState, id: number, cause?: string): number {
  return state.events
    .filter((e): e is Extract<BattleEvent, { type: 'damage' }> => e.type === 'damage' && e.targetId === id && (!cause || e.cause === cause))
    .reduce((sum, e) => sum + e.amount + e.absorbed, 0);
}

function flyAll(state: BattleState): void {
  for (let i = 0; i < 100 && state.projectiles.length > 0; i++) updateProjectiles(state);
}

describe('specializations', () => {
  it('gives every class two, each belonging to that class', () => {
    for (const cls of TROOP_CLASSES) {
      const [a, b] = SPECIALIZATIONS_OF[cls];
      expect(a).not.toBe(b);
      expect(SPECIALIZATIONS[a].cls).toBe(cls);
      expect(SPECIALIZATIONS[b].cls).toBe(cls);
    }
  });

  it('only count for their own class, and change base stats', () => {
    expect(specFor({ ranger: 'sniper' }, 'ranger')).toBe('sniper');
    expect(specFor({ vanguard: 'sniper' }, 'vanguard')).toBeNull();
    expect(specFor({}, 'ranger')).toBeNull();
    const base = UNIT_CLASSES.ranger.stats;
    const sniper = specStats(base, 'sniper');
    expect(sniper.armorPierce).toBe(0.6);
    expect(sniper.range).toBeCloseTo(base.range * 1.2);
    expect(sniper.attacksPerSecond).toBeLessThan(base.attacksPerSecond);
    expect(specStats(base, null)).toEqual(base);
    // Troops on the field get them from the battle setup.
    const state = battleWith([{ cls: 'ranger', x: 100, y: 300 }], [{ cls: 'ranger', x: 900, y: 300 }], { specs: { ranger: 'sniper' } });
    expect(sideUnits(state, 'player')[0]).toMatchObject({ spec: 'sniper', stats: sniper });
    expect(sideUnits(state, 'enemy')[0]).toMatchObject({ spec: null, stats: base });
  });

  it('Breaker: Shove pushes further and hits harder', () => {
    const shove = (specs = {}) => {
      const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'ranger', x: 330, y: 300 }], { specs });
      castShove(state, sideUnits(state, 'player')[0]!);
      const enemy = sideUnits(state, 'enemy')[0]!;
      return { push: enemy.knockback!.dx, damage: damageTo(state, enemy.id, 'shove') };
    };
    const plain = shove();
    const breaker = shove({ vanguard: 'breaker' });
    expect(breaker.push).toBeCloseTo(plain.push * SPEC_RULES.breaker.pushMultiplier);
    expect(breaker.damage).toBe(Math.round(UNIT_CLASSES.vanguard.shove.damage * SPEC_RULES.breaker.shoveDamageMultiplier));
  });

  it('Bulwark: enemy shots that cross its body hit it instead of the ally behind', () => {
    const shoot = (specs = {}) => {
      const state = battleWith(
        [
          { cls: 'ranger', x: 100, y: 300 },
          { cls: 'vanguard', x: 220, y: 300 },
        ],
        [{ cls: 'ranger', x: 400, y: 300 }],
        { specs },
      );
      const [ranger, vanguard] = sideUnits(state, 'player');
      performAttack(state, sideUnits(state, 'enemy')[0]!, ranger!);
      flyAll(state);
      return { ranger: damageTo(state, ranger!.id), vanguard: damageTo(state, vanguard!.id) };
    };
    expect(shoot()).toMatchObject({ vanguard: 0 });
    expect(shoot().ranger).toBeGreaterThan(0);
    const blocked = shoot({ vanguard: 'bulwark' });
    expect(blocked.ranger).toBe(0);
    expect(blocked.vanguard).toBeGreaterThan(0);
  });

  it('Volley: arrows also hit enemies near the target for half damage', () => {
    const state = battleWith(
      [{ cls: 'ranger', x: 100, y: 300 }],
      [
        { cls: 'ranger', x: 300, y: 300 },
        { cls: 'ranger', x: 300, y: 330 },
        { cls: 'ranger', x: 300, y: 420 },
      ],
      { specs: { ranger: 'volley' } },
    );
    const [target, near, far] = sideUnits(state, 'enemy');
    performAttack(state, sideUnits(state, 'player')[0]!, target!);
    const raw = state.projectiles[0]!.damage;
    flyAll(state);
    expect(damageTo(state, target!.id, 'attack')).toBe(Math.round(raw));
    expect(damageTo(state, near!.id, 'splash')).toBe(Math.round(raw * SPEC_RULES.volley.splashShare));
    expect(damageTo(state, far!.id)).toBe(0);
  });

  it('Warden: bigger Barriers, and enemies near the shielded ally must attack it', () => {
    const state = battleWith(
      [
        { cls: 'guardian', x: 100, y: 300 },
        { cls: 'vanguard', x: 250, y: 300 },
      ],
      [
        { cls: 'assassin', x: 290, y: 300 },
        { cls: 'ranger', x: 600, y: 300 },
      ],
      { specs: { guardian: 'warden' } },
    );
    const [guardian, vanguard] = sideUnits(state, 'player');
    const [assassin, ranger] = sideUnits(state, 'enemy');
    castBarrier(state, guardian!, vanguard!);
    expect(vanguard!.barrier!.amount).toBe(Math.round(UNIT_CLASSES.guardian.barrier.amount * SPEC_RULES.warden.barrierMultiplier));
    expect(assassin!.taunt).toEqual({ unitId: vanguard!.id, ticksLeft: secondsToTicks(SPEC_RULES.warden.tauntSeconds) });
    expect(ranger!.taunt).toBeNull();
    expect(tauntIntent(state, assassin!)?.action).toMatchObject({ targetId: vanguard!.id });
  });

  it('Mender: smaller Barriers that heal the ally every second for a while', () => {
    const state = battleWith(
      [
        { cls: 'guardian', x: 100, y: 300 },
        { cls: 'ranger', x: 150, y: 300 },
      ],
      [{ cls: 'vanguard', x: 900, y: 300 }],
      { specs: { guardian: 'mender' } },
    );
    freeze(...state.units);
    const [guardian, ranger] = sideUnits(state, 'player');
    ranger!.hp = 100;
    castBarrier(state, guardian!, ranger!);
    expect(ranger!.barrier!.amount).toBe(Math.round(UNIT_CLASSES.guardian.barrier.amount * SPEC_RULES.mender.barrierMultiplier));
    for (let i = 0; i < TICKS_PER_SECOND; i++) stepBattle(state);
    expect(ranger!.hp).toBe(100 + SPEC_RULES.mender.healPerSecond);
    for (let i = 0; i < TICKS_PER_SECOND * SPEC_RULES.mender.healSeconds; i++) stepBattle(state);
    expect(ranger!.hp).toBe(100 + SPEC_RULES.mender.healPerSecond * SPEC_RULES.mender.healSeconds);
    expect(ranger!.regen).toBeNull();
  });
});
