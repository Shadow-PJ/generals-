import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from '../data/battle';
import { UNIT_CLASSES } from '../data/units';
import { damageAfterDefenses, dealDamage, performAttack, updateProjectiles } from './combat';
import { battleWith } from './testing/fixtures';

describe('damage', () => {
  it('lets armor block its share of damage', () => {
    expect(damageAfterDefenses(100, 0.4, 0, 0)).toBe(60);
    expect(damageAfterDefenses(100, 0, 0, 0)).toBe(100);
  });

  it('makes the Vanguard weak to armor-piercing attacks', () => {
    const armor = UNIT_CLASSES.vanguard.stats.armor;
    expect(armor).toBeGreaterThan(0);
    expect(damageAfterDefenses(100, armor, 1, 0)).toBe(100);
    expect(damageAfterDefenses(100, armor, 0.5, 0)).toBeGreaterThan(damageAfterDefenses(100, armor, 0, 0));
  });

  it('adds the Mark bonus on top: +20%', () => {
    const bonus = UNIT_CLASSES.ranger.mark.damageTakenBonus;
    expect(bonus).toBe(0.2);
    expect(damageAfterDefenses(100, 0, 0, bonus)).toBe(120);
  });

  it('always does at least the minimum damage', () => {
    expect(damageAfterDefenses(0.1, 0.9, 0, 0)).toBe(BATTLE_RULES.minDamage);
  });

  it('lets a Barrier soak damage before HP, logs the hit and never takes HP below 0', () => {
    const state = battleWith([{ cls: 'vanguard', x: 100, y: 100 }], [{ cls: 'ranger', x: 900, y: 500 }]);
    const [vanguard, ranger] = state.units;
    ranger!.barrier = { amount: 50, ticksLeft: 100 };
    dealDamage(state, vanguard!.id, ranger!, 80, 0, 'attack');
    expect(ranger!.barrier).toBeNull();
    expect(ranger!.hp).toBe(ranger!.stats.maxHp - 30);
    expect(state.events.at(-1)).toMatchObject({ type: 'damage', amount: 30, absorbed: 50, targetId: ranger!.id });
    expect(ranger!.lastHitBy).toBe(vanguard!.id);

    dealDamage(state, vanguard!.id, ranger!, 10_000, 0, 'attack');
    expect(ranger!.hp).toBe(0);
  });
});

describe('attacks', () => {
  it('lands melee hits at once', () => {
    const state = battleWith([{ cls: 'vanguard', x: 100, y: 100 }], [{ cls: 'vanguard', x: 130, y: 100 }]);
    const [a, b] = state.units;
    performAttack(state, a!, b!);
    expect(b!.hp).toBeLessThan(b!.stats.maxHp);
    expect(state.projectiles).toHaveLength(0);
    expect(a!.attackCooldown).toBe(25);
  });

  it('fires ranged attacks as projectiles that hit after flying', () => {
    const state = battleWith([{ cls: 'ranger', x: 100, y: 100 }], [{ cls: 'vanguard', x: 300, y: 100 }]);
    const [ranger, target] = state.units;
    performAttack(state, ranger!, target!);
    expect(state.projectiles).toHaveLength(1);
    let ticks = 0;
    while (state.projectiles.length > 0) {
      updateProjectiles(state);
      ticks++;
    }
    // 200 units apart at 480 units per second: about 8 ticks of flight.
    expect(ticks).toBeGreaterThan(5);
    expect(ticks).toBeLessThan(10);
    expect(target!.hp).toBeLessThan(target!.stats.maxHp);
  });

  it('drops projectiles whose target died before they arrived', () => {
    const state = battleWith([{ cls: 'ranger', x: 100, y: 100 }], [{ cls: 'vanguard', x: 300, y: 100 }]);
    const [ranger, target] = state.units;
    performAttack(state, ranger!, target!);
    target!.alive = false;
    updateProjectiles(state);
    expect(state.projectiles).toHaveLength(0);
    expect(state.events.filter((e) => e.type === 'damage')).toHaveLength(0);
  });
});
