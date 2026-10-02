import { describe, expect, it } from 'vitest';
import { OPEN_FIELD } from '../data/maps';
import { SYNERGY_RULES } from '../data/synergies';
import { UNIT_CLASSES } from '../data/units';
import { createBattle, runBattle, stepBattle } from './battle';
import { critMultiplier, dealDamage, performAttack, updateProjectiles } from './combat';
import { openRift } from './rift';
import { castShove, ironWallTaunts } from './skills';
import { activeSynergies } from './synergies';
import { battleWith, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import { visibleEnemies } from './queries';
import type { BattleEvent, BattleSetup, BattleState } from './types';

function ofType<T extends BattleEvent['type']>(state: BattleState, type: T): Extract<BattleEvent, { type: T }>[] {
  return state.events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
}

function damageTo(state: BattleState, id: number, cause: string): number {
  return ofType(state, 'damage')
    .filter((e) => e.targetId === id && e.cause === cause)
    .reduce((sum, e) => sum + e.amount + e.absorbed, 0);
}

describe('troop synergies', () => {
  it('switch on when both classes are in the army, reserves included', () => {
    expect(activeSynergies(['vanguard', 'vanguard', 'ranger', 'ranger', 'guardian'], {})).toEqual(['ironWall']);
    expect(activeSynergies(['ranger', 'assassin'], {})).toEqual(['executionProtocol']);
    expect(activeSynergies(['ranger', 'invoker'], {})).toEqual(['crossfire']);
    expect(activeSynergies(['guardian', 'assassin'], {})).toEqual(['shadowEscort']);
    // Fire Break needs the Invoker to be a Pyromancer.
    expect(activeSynergies(['vanguard', 'invoker'], {})).toEqual([]);
    expect(activeSynergies(['vanguard', 'invoker'], { invoker: 'frostcaller' })).toEqual([]);
    expect(activeSynergies(['vanguard', 'invoker'], { invoker: 'pyromancer' })).toEqual(['fireBreak']);
    const state = battleWith([{ cls: 'ranger', x: 100, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], {
      reserves: ['invoker'],
      enemyReserves: ['guardian'],
    });
    expect(state.synergies).toEqual({ player: ['crossfire'], enemy: ['ironWall'] });
  });

  it('Fire Break: an enemy Shoved through a fire Rift burns for triple, once per Shove', () => {
    const shoveInto = (element: 'fire' | 'arcane') => {
      const state = battleWith(
        [
          { cls: 'vanguard', x: 300, y: 300 },
          { cls: 'invoker', x: 100, y: 100 },
        ],
        [{ cls: 'ranger', x: 330, y: 300 }],
        { specs: { invoker: element === 'fire' ? 'pyromancer' : 'frostcaller' } },
      );
      freeze(...state.units);
      const [vanguard, invoker] = sideUnits(state, 'player');
      openRift(state, invoker!, { x: 380, y: 300 });
      state.zones[0]!.pulseIn = 1000;
      castShove(state, vanguard!);
      for (let i = 0; i < 10; i++) stepBattle(state);
      return state;
    };
    const fire = shoveInto('fire');
    const enemy = sideUnits(fire, 'enemy')[0]!;
    const zone = fire.zones[0]!;
    expect(ofType(fire, 'damage').filter((e) => e.cause === 'burn')).toHaveLength(1);
    expect(damageTo(fire, enemy.id, 'burn')).toBe(Math.round(zone.damage * SYNERGY_RULES.fireBreak.pulses));
    expect(ofType(fire, 'synergy')).toEqual([{ tick: 0, type: 'synergy', side: 'player', synergy: 'fireBreak' }]);
    expect(ofType(shoveInto('arcane'), 'damage').filter((e) => e.cause === 'burn')).toHaveLength(0);
  });

  it('Execution Protocol: the Assassin always crits a Marked target', () => {
    const state = battleWith(
      [
        { cls: 'assassin', x: 300, y: 300 },
        { cls: 'ranger', x: 100, y: 300 },
      ],
      [{ cls: 'vanguard', x: 330, y: 300 }],
    );
    const assassin = sideUnits(state, 'player')[0]!;
    const target = sideUnits(state, 'enemy')[0]!;
    target.mark = { ticksLeft: 100, damageTakenBonus: 0.2 };
    for (let i = 0; i < 30; i++) expect(critMultiplier(state, assassin, target)).toBe(UNIT_CLASSES.assassin.crit.multiplier);
    expect(ofType(state, 'synergy')).toHaveLength(1);
    // Without a Ranger in the army, a Mark is just a Mark.
    const alone = battleWith([{ cls: 'assassin', x: 300, y: 300 }], [{ cls: 'vanguard', x: 330, y: 300 }]);
    const marked = sideUnits(alone, 'enemy')[0]!;
    marked.mark = { ticksLeft: 100, damageTakenBonus: 0.2 };
    const rolls = Array.from({ length: 30 }, () => critMultiplier(alone, sideUnits(alone, 'player')[0]!, marked));
    expect(rolls).toContain(1);
  });

  it("Iron Wall: a Vanguard with a Barrier can't be pushed and taunts enemies near it", () => {
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'guardian', x: 100, y: 300 },
      ],
      [
        { cls: 'vanguard', x: 330, y: 300 },
        { cls: 'ranger', x: 600, y: 300 },
      ],
    );
    const [vanguard] = sideUnits(state, 'player');
    const [enemy, farRanger] = sideUnits(state, 'enemy');
    castShove(state, enemy!);
    expect(vanguard!.knockback).not.toBeNull();
    vanguard!.knockback = null;
    vanguard!.barrier = { amount: 100, ticksLeft: 100 };
    castShove(state, enemy!);
    expect(vanguard!.knockback).toBeNull();
    ironWallTaunts(state);
    expect(enemy!.taunt).toEqual({ unitId: vanguard!.id, ticksLeft: secondsToTicks(SYNERGY_RULES.ironWall.tauntSeconds) });
    expect(farRanger!.taunt).toBeNull();
    expect(ofType(state, 'synergy').map((e) => e.synergy)).toEqual(['ironWall']);
  });

  it('Crossfire: arrows shot through a Rift burn, or slow in frost', () => {
    const shoot = (spec: 'pyromancer' | 'frostcaller' | null, withZone = true) => {
      const state = battleWith(
        [
          { cls: 'ranger', x: 100, y: 300 },
          { cls: 'invoker', x: 100, y: 400 },
        ],
        [{ cls: 'ranger', x: 300, y: 300 }],
        { specs: spec ? { invoker: spec } : {} },
      );
      const [ranger, invoker] = sideUnits(state, 'player');
      const target = sideUnits(state, 'enemy')[0]!;
      if (withZone) {
        openRift(state, invoker!, { x: 250, y: 300 });
        state.zones[0]!.pulseIn = 1000;
      }
      performAttack(state, ranger!, target);
      const raw = state.projectiles[0]!.damage;
      for (let i = 0; i < 20 && state.projectiles.length > 0; i++) updateProjectiles(state);
      return { state, target, raw };
    };
    const plain = shoot(null, false);
    expect(damageTo(plain.state, plain.target.id, 'attack')).toBe(Math.round(plain.raw));
    for (const spec of [null, 'pyromancer'] as const) {
      const burn = shoot(spec);
      expect(damageTo(burn.state, burn.target.id, 'attack')).toBe(Math.round(burn.raw * (1 + SYNERGY_RULES.crossfire.burnBonus)));
      expect(ofType(burn.state, 'synergy').map((e) => e.synergy)).toEqual(['crossfire']);
    }
    const frost = shoot('frostcaller');
    expect(damageTo(frost.state, frost.target.id, 'attack')).toBe(Math.round(frost.raw));
    expect(frost.target.slow?.share).toBe(SYNERGY_RULES.crossfire.frostSlow);
  });

  it("Shadow Escort: when an Assassin's Barrier breaks, it turns invisible for 2 s", () => {
    const state = battleWith(
      [
        { cls: 'assassin', x: 300, y: 300 },
        { cls: 'guardian', x: 100, y: 300 },
      ],
      [{ cls: 'vanguard', x: 340, y: 300 }],
    );
    const assassin = sideUnits(state, 'player')[0]!;
    const enemy = sideUnits(state, 'enemy')[0]!;
    assassin.barrier = { amount: 30, ticksLeft: 100 };
    dealDamage(state, enemy.id, assassin, 10, 0, 'attack');
    expect(assassin.invisibleTicks).toBe(0);
    dealDamage(state, enemy.id, assassin, 100, 0, 'attack');
    expect(assassin.barrier).toBeNull();
    expect(assassin.invisibleTicks).toBe(secondsToTicks(SYNERGY_RULES.shadowEscort.invisibleSeconds));
    expect(visibleEnemies(state, enemy).map((u) => u.id)).not.toContain(assassin.id);
    expect(ofType(state, 'synergy').map((e) => e.synergy)).toEqual(['shadowEscort']);
    for (let i = 0; i < secondsToTicks(SYNERGY_RULES.shadowEscort.invisibleSeconds); i++) stepBattle(state);
    expect(visibleEnemies(state, enemy).map((u) => u.id)).toContain(assassin.id);
  });

  it('keep a battle with every class, specialization and synergy the same from the same seed', () => {
    const setup: BattleSetup = {
      seed: 7,
      map: OPEN_FIELD,
      player: [
        { cls: 'vanguard', x: 260, y: 220 },
        { cls: 'assassin', x: 260, y: 320 },
        { cls: 'ranger', x: 120, y: 190 },
        { cls: 'invoker', x: 120, y: 350 },
        { cls: 'guardian', x: 180, y: 270 },
      ],
      enemy: [
        { cls: 'vanguard', x: 700, y: 220 },
        { cls: 'vanguard', x: 700, y: 320 },
        { cls: 'invoker', x: 840, y: 190 },
        { cls: 'assassin', x: 840, y: 350 },
        { cls: 'guardian', x: 780, y: 270 },
      ],
      specs: {
        player: { vanguard: 'bulwark', ranger: 'volley', guardian: 'mender', invoker: 'pyromancer', assassin: 'saboteur' },
        enemy: { vanguard: 'breaker', ranger: 'sniper', guardian: 'warden', invoker: 'frostcaller', assassin: 'blade' },
      },
    };
    const a = runBattle(setup);
    const b = runBattle(setup);
    expect(a.result).not.toBeNull();
    expect(b.events).toEqual(a.events);
    expect(a.events.some((e) => e.type === 'skill' && e.skill === 'rift')).toBe(true);
    expect(a.events.some((e) => e.type === 'skill' && e.skill === 'shadowstep')).toBe(true);
    expect(createBattle(setup).synergies.player).toEqual(['fireBreak', 'executionProtocol', 'ironWall', 'crossfire', 'shadowEscort']);
  });
});
