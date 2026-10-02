import { describe, expect, it } from 'vitest';
import { SPEC_RULES } from '../data/specializations';
import { UNIT_CLASSES } from '../data/units';
import { stepBattle } from './battle';
import { dealDamage } from './combat';
import { stepLength } from './movement';
import { riftSpot } from './rift';
import { castShove } from './skills';
import { battleWith, cardOf, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleEvent, BattleState } from './types';

const rift = UNIT_CLASSES.invoker.rift;

function steps(state: BattleState, n: number): void {
  for (let i = 0; i < n; i++) stepBattle(state);
}

function riftHits(state: BattleState): Extract<BattleEvent, { type: 'damage' }>[] {
  return state.events.filter((e): e is Extract<BattleEvent, { type: 'damage' }> => e.type === 'damage' && e.cause === 'rift');
}

/** Your Invoker, ready to cast, facing three enemies close together and one alone; the enemies stand still. */
function grouped(specs = {}): BattleState {
  const state = battleWith(
    [{ cls: 'invoker', x: 300, y: 300 }],
    [
      { cls: 'vanguard', x: 480, y: 300 },
      { cls: 'vanguard', x: 500, y: 330 },
      { cls: 'vanguard', x: 505, y: 280 },
      { cls: 'vanguard', x: 300, y: 140 },
    ],
    { specs },
  );
  freeze(...sideUnits(state, 'enemy'));
  sideUnits(state, 'player')[0]!.skillCooldown = 0;
  return state;
}

describe('the Invoker', () => {
  it('aims its Rift at the biggest group of enemies within reach', () => {
    const state = grouped();
    const invoker = sideUnits(state, 'player')[0]!;
    expect(riftSpot(state, invoker)).toEqual({ x: 480, y: 300 });
    // A lone enemy is not worth a Rift while others are left, unless it is the last one.
    expect(riftSpot(state, invoker, 170)).toBeNull();
    for (const enemy of sideUnits(state, 'enemy').slice(0, 3)) enemy.alive = false;
    expect(riftSpot(state, invoker)).toEqual({ x: 300, y: 140 });
  });

  it('stands still while casting, then the Rift pulses on every enemy inside until it closes', () => {
    const state = grouped();
    const invoker = sideUnits(state, 'player')[0]!;
    stepBattle(state);
    expect(invoker.casting).not.toBeNull();
    expect(invoker.skillCooldown).toBeGreaterThan(0);
    steps(state, secondsToTicks(rift.castSeconds) - 1);
    expect(invoker.x).toBe(300);
    expect(state.zones).toHaveLength(0);
    stepBattle(state);
    expect(invoker.casting).toBeNull();
    expect(state.zones).toHaveLength(1);
    expect(state.events.some((e) => e.type === 'skill' && e.skill === 'rift' && e.targetIds.length === 3)).toBe(true);
    // The first pulse lands at once, on the three grouped enemies, not the lone one.
    expect(riftHits(state)).toHaveLength(3);
    expect(new Set(riftHits(state).map((e) => e.targetId)).size).toBe(3);
    steps(state, secondsToTicks(rift.durationSeconds));
    const pulses = rift.durationSeconds / rift.pulseSeconds;
    expect(riftHits(state)).toHaveLength(3 * pulses);
    expect(state.zones).toHaveLength(0);
  });

  it('loses its cast when a hit costs it enough HP, and can cast again sooner', () => {
    const state = grouped();
    const invoker = sideUnits(state, 'player')[0]!;
    const enemy = sideUnits(state, 'enemy')[0]!;
    stepBattle(state);
    dealDamage(state, enemy.id, invoker, invoker.stats.maxHp * rift.interruptDamageShare * 0.5, 0, 'attack');
    expect(invoker.casting).not.toBeNull();
    dealDamage(state, enemy.id, invoker, invoker.stats.maxHp * rift.interruptDamageShare * 0.6, 0, 'attack');
    expect(invoker.casting).toBeNull();
    expect(invoker.skillCooldown).toBe(secondsToTicks(rift.interruptedCooldownSeconds));
    expect(state.events.filter((e) => e.type === 'interrupted')).toEqual([
      { tick: state.tick, type: 'interrupted', unitId: invoker.id, byId: enemy.id },
    ]);
    steps(state, secondsToTicks(rift.castSeconds) + 2);
    expect(riftHits(state)).toHaveLength(0);
  });

  it('loses its cast to a Shove', () => {
    const state = battleWith([{ cls: 'invoker', x: 300, y: 300 }], [{ cls: 'vanguard', x: 330, y: 300 }]);
    const invoker = sideUnits(state, 'player')[0]!;
    const vanguard = sideUnits(state, 'enemy')[0]!;
    freeze(...sideUnits(state, 'enemy'));
    invoker.casting = { ticksLeft: 10, x: 330, y: 300, damageTaken: 0 };
    castShove(state, vanguard);
    expect(invoker.casting).toBeNull();
    expect(invoker.knockback).not.toBeNull();
  });

  it('opens a Rift at once when Overcharged', () => {
    const state = battleWith(
      [{ cls: 'invoker', x: 100, y: 300 }],
      [
        { cls: 'vanguard', x: 900, y: 300 },
        { cls: 'vanguard', x: 900, y: 340 },
      ],
      { cards: [cardOf({ action: 'overcharge', actors: { kind: 'class', cls: 'invoker' } })] },
    );
    state.command.pips = 4;
    stepBattle(state, [{ tick: 0, kind: 'slot', slot: 0 }]);
    // Far beyond its usual reach, and with no cast.
    expect(state.zones).toHaveLength(1);
    expect(state.zones[0]).toMatchObject({ x: 900, y: 300 });
    expect(riftHits(state).length).toBeGreaterThan(0);
  });

  it('opens fire Rifts as a Pyromancer and slowing frost Rifts as a Frostcaller', () => {
    const plain = grouped();
    const fire = grouped({ invoker: 'pyromancer' });
    const frost = grouped({ invoker: 'frostcaller' });
    for (const state of [plain, fire, frost]) steps(state, secondsToTicks(rift.castSeconds) + 1);
    expect(plain.zones[0]).toMatchObject({ element: 'arcane', damage: rift.pulseDamage, slow: 0 });
    expect(fire.zones[0]).toMatchObject({ element: 'fire', damage: rift.pulseDamage * SPEC_RULES.pyromancer.riftDamageMultiplier });
    expect(frost.zones[0]).toMatchObject({ element: 'frost', slow: SPEC_RULES.frostcaller.slow });
    expect(frost.zones[0]!.damage).toBeCloseTo(rift.pulseDamage * SPEC_RULES.frostcaller.riftDamageMultiplier);
    const inFrost = sideUnits(frost, 'enemy')[0]!;
    const unslowed = sideUnits(plain, 'enemy')[0]!;
    expect(stepLength(inFrost)).toBeCloseTo(stepLength(unslowed) * (1 - SPEC_RULES.frostcaller.slow));
  });
});
