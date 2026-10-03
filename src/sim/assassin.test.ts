import { describe, expect, it } from 'vitest';
import { SPEC_RULES } from '../data/specializations';
import { UNIT_CLASSES } from '../data/units';
import { stepBattle } from './battle';
import { critMultiplier, dealDamage } from './combat';
import { choosePrey, castShadowstep } from './shadowstep';
import { spotBehind } from './spots';
import { battleWith, cardOf, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleEvent, BattleState } from './types';

const shadowstep = UNIT_CLASSES.assassin.shadowstep;

function damageBy(state: BattleState, cause: string): Extract<BattleEvent, { type: 'damage' }>[] {
  return state.events.filter((e): e is Extract<BattleEvent, { type: 'damage' }> => e.type === 'damage' && e.cause === cause);
}

/** Your Assassin facing an enemy Vanguard, Ranger and Guardian that stand still. */
function hunt(specs = {}): BattleState {
  const state = battleWith(
    [{ cls: 'assassin', x: 300, y: 300 }],
    [
      { cls: 'vanguard', x: 420, y: 300 },
      { cls: 'ranger', x: 480, y: 200 },
      { cls: 'guardian', x: 500, y: 380 },
    ],
    { specs },
  );
  freeze(...sideUnits(state, 'enemy'));
  return state;
}

describe('the Assassin', () => {
  it('hunts Guardians first, then the other backline troops, then the weakest enemy', () => {
    const state = hunt();
    const assassin = sideUnits(state, 'player')[0]!;
    const [vanguard, ranger, guardian] = sideUnits(state, 'enemy');
    expect(choosePrey(state, assassin)?.id).toBe(guardian!.id);
    guardian!.alive = false;
    expect(choosePrey(state, assassin)?.id).toBe(ranger!.id);
    ranger!.alive = false;
    expect(choosePrey(state, assassin)?.id).toBe(vanguard!.id);
  });

  it('Shadowsteps behind its prey and strikes it as soon as the skill is ready', () => {
    const state = hunt();
    const assassin = sideUnits(state, 'player')[0]!;
    const guardian = sideUnits(state, 'enemy')[2]!;
    assassin.skillCooldown = 0;
    stepBattle(state);
    // It landed on the far side of the Guardian, touching it.
    expect(assassin.x).toBeGreaterThan(guardian.x);
    const gap = Math.hypot(assassin.x - guardian.x, assassin.y - guardian.y) - assassin.stats.radius - guardian.stats.radius;
    expect(gap).toBeGreaterThan(-1);
    expect(gap).toBeLessThan(3);
    expect(state.events.some((e) => e.type === 'skill' && e.skill === 'shadowstep' && e.targetIds[0] === guardian.id)).toBe(true);
    expect(damageBy(state, 'shadowstep')).toHaveLength(1);
    expect(assassin.skillCooldown).toBeGreaterThan(secondsToTicks(shadowstep.cooldownSeconds) - 2);
  });

  it('waits until its prey is within reach of the Shadowstep', () => {
    const state = battleWith([{ cls: 'assassin', x: 60, y: 300 }], [{ cls: 'guardian', x: 900, y: 300 }]);
    freeze(...sideUnits(state, 'enemy'));
    const assassin = sideUnits(state, 'player')[0]!;
    assassin.skillCooldown = 0;
    stepBattle(state);
    expect(damageBy(state, 'shadowstep')).toHaveLength(0);
    expect(assassin.x).toBeGreaterThan(60);
  });

  it('executes a target its strike leaves below 15% HP', () => {
    const state = hunt();
    const assassin = sideUnits(state, 'player')[0]!;
    const guardian = sideUnits(state, 'enemy')[2]!;
    guardian.hp = Math.round(guardian.stats.maxHp * 0.2);
    expect(castShadowstep(state, assassin, guardian)).toBe(true);
    expect(guardian.hp).toBe(0);
    expect(damageBy(state, 'execute')).toHaveLength(1);
    stepBattle(state);
    expect(state.events.some((e) => e.type === 'death' && e.unitId === guardian.id && e.killerId === assassin.id)).toBe(true);
  });

  it('leaves a target that stays above 15% HP alive', () => {
    const state = hunt();
    const assassin = sideUnits(state, 'player')[0]!;
    const vanguard = sideUnits(state, 'enemy')[0]!;
    castShadowstep(state, assassin, vanguard);
    expect(vanguard.hp).toBeGreaterThan(0);
    expect(damageBy(state, 'execute')).toHaveLength(0);
  });

  it('takes 50% more damage from area attacks', () => {
    const state = hunt();
    const assassin = sideUnits(state, 'player')[0]!;
    const enemy = sideUnits(state, 'enemy')[0]!;
    const before = assassin.hp;
    dealDamage(state, enemy.id, assassin, 100, 0, 'attack');
    const plain = before - assassin.hp;
    dealDamage(state, enemy.id, assassin, 100, 0, 'rift');
    expect(before - plain - assassin.hp).toBe(Math.round(100 * UNIT_CLASSES.assassin.stats.areaDamageTaken * (1 - UNIT_CLASSES.assassin.stats.armor)));
  });

  it('lands critical hits now and then, from the seeded generator; other troops never crit', () => {
    const state = hunt();
    const assassin = sideUnits(state, 'player')[0]!;
    const [vanguard] = sideUnits(state, 'enemy');
    const rolls = Array.from({ length: 200 }, () => critMultiplier(state, assassin, vanguard!));
    const crits = rolls.filter((r) => r === UNIT_CLASSES.assassin.crit.multiplier).length;
    expect(crits).toBeGreaterThan(20);
    expect(crits).toBeLessThan(60);
    expect(rolls.every((r) => r === 1 || r === UNIT_CLASSES.assassin.crit.multiplier)).toBe(true);
    const rng = { ...state.rng };
    expect(critMultiplier(state, vanguard!, assassin)).toBe(1);
    expect(state.rng).toEqual(rng);
  });

  it('as a Blade, strikes harder and executes below 25% HP', () => {
    const state = hunt({ assassin: 'blade' });
    const assassin = sideUnits(state, 'player')[0]!;
    const guardian = sideUnits(state, 'enemy')[2]!;
    guardian.hp = Math.round(guardian.stats.maxHp * SPEC_RULES.blade.executeShare) + 60;
    castShadowstep(state, assassin, guardian);
    expect(guardian.hp).toBe(0);
    expect(damageBy(state, 'execute')).toHaveLength(1);
  });

  it('as a Saboteur, silences its target: no skills, and a cast breaks', () => {
    const state = battleWith([{ cls: 'assassin', x: 300, y: 300 }], [{ cls: 'invoker', x: 400, y: 300 }], { specs: { assassin: 'saboteur' } });
    const assassin = sideUnits(state, 'player')[0]!;
    const invoker = sideUnits(state, 'enemy')[0]!;
    invoker.casting = { ticksLeft: 20, x: 300, y: 300, damageTaken: 0 };
    castShadowstep(state, assassin, invoker);
    expect(invoker.casting).toBeNull();
    expect(invoker.silencedTicks).toBe(secondsToTicks(SPEC_RULES.saboteur.silenceSeconds));
    invoker.skillCooldown = 0;
    stepBattle(state);
    expect(invoker.casting).toBeNull();
  });

  it('Shadowsteps to its prey at any distance when Overcharged', () => {
    const state = battleWith([{ cls: 'assassin', x: 60, y: 300 }], [{ cls: 'ranger', x: 900, y: 300 }], {
      cards: [cardOf({ action: 'overcharge', actors: { kind: 'class', cls: 'assassin' } })],
    });
    state.command.pips = 4;
    stepBattle(state, [{ tick: 0, kind: 'slot', slot: 0 }]);
    expect(damageBy(state, 'shadowstep')).toHaveLength(1);
    expect(sideUnits(state, 'player')[0]!.x).toBeGreaterThan(900);
  });

  it('lands once every skill is cast, so two Assassins Shadowstepping to each other land alike', () => {
    const state = battleWith([{ cls: 'assassin', x: 400, y: 300 }], [{ cls: 'assassin', x: 600, y: 300 }]);
    const [left, right] = state.units;
    left!.skillCooldown = 0;
    right!.skillCooldown = 0;
    stepBattle(state);
    expect(damageBy(state, 'shadowstep')).toHaveLength(2);
    // Each lands behind where the other stood, not behind where the other just landed.
    expect(left!.x).toBeGreaterThan(600);
    expect(right!.x).toBeLessThan(400);
    expect(left!.x).toBe(1000 - right!.x);
    expect(left!.y).toBe(right!.y);
  });

  it('steps to the same side of its prey whichever army it fights for, when straight behind is blocked', () => {
    // Your Assassin and an enemy one at mirrored spots, each facing a prey with a post just behind it.
    const state = battleWith(
      [
        { cls: 'assassin', x: 300, y: 300 },
        { cls: 'guardian', x: 560, y: 300 },
      ],
      [
        { cls: 'assassin', x: 700, y: 300 },
        { cls: 'guardian', x: 440, y: 300 },
      ],
      {
        walls: [
          { x: 469, y: 296, w: 8, h: 8 },
          { x: 523, y: 296, w: 8, h: 8 },
        ],
      },
    );
    const [mine, theirs] = sideUnits(state, 'player');
    const [enemyAssassin, enemyGuardian] = sideUnits(state, 'enemy');
    const a = spotBehind(state, mine!, enemyGuardian!)!;
    const b = spotBehind(state, enemyAssassin!, theirs!)!;
    expect(a.y).not.toBe(300);
    expect(a.x).toBe(1000 - b.x);
    expect(a.y).toBe(b.y);
  });
});
