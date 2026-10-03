import { describe, expect, it } from 'vitest';
import { TROOP_SKILLS } from '../data/generals';
import { UNIT_CLASSES } from '../data/units';
import { stepBattle } from './battle';
import { dealDamage, resolvePhaseShifts } from './combat';
import { attackSpeedFactor, damageFactor, effectiveArmor } from './status';
import { battleWith, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import { afterAttack, vampiricLinks, ventHeat } from './troopSkills';
import type { BattleEvent, BattleState } from './types';

function skills(state: BattleState, skill: string): Extract<BattleEvent, { type: 'skill' }>[] {
  return state.events.filter((e): e is Extract<BattleEvent, { type: 'skill' }> => e.type === 'skill' && e.skill === skill);
}

describe("the Generals' troop skills", () => {
  it('Vampiric Link (Warlord): a healthy troop pays HP to make a fighting ally attack three times as fast', () => {
    const link = TROOP_SKILLS.vampiricLink;
    const make = (general: 'warlord' | 'captain') => {
      const state = battleWith(
        [
          { cls: 'vanguard', x: 300, y: 300 },
          { cls: 'ranger', x: 360, y: 300 },
        ],
        [{ cls: 'vanguard', x: 520, y: 300 }],
        { general },
      );
      freeze(...state.units.slice(1));
      sideUnits(state, 'player')[0]!.troopSkillCooldown = 0;
      vampiricLinks(state);
      return state;
    };
    const state = make('warlord');
    const [vanguard, ranger] = sideUnits(state, 'player');
    expect(ranger!.haste).toEqual({ bonus: link.attackSpeedBonus, ticksLeft: secondsToTicks(link.durationSeconds) });
    expect(attackSpeedFactor(ranger!)).toBe(1 + link.attackSpeedBonus);
    expect(vanguard!.hp).toBe(vanguard!.stats.maxHp - Math.round(vanguard!.stats.maxHp * link.hpCostShare));
    expect(vanguard!.troopSkillCooldown).toBe(secondsToTicks(link.cooldownSeconds));
    expect(skills(state, 'vampiricLink')).toHaveLength(1);
    expect(sideUnits(make('captain'), 'player')[1]!.haste).toBeNull();
    // A troop below half HP doesn't pay.
    const low = make('warlord');
    const [v2, r2] = sideUnits(low, 'player');
    r2!.haste = null;
    v2!.hp = v2!.stats.maxHp * 0.4;
    v2!.troopSkillCooldown = 0;
    vampiricLinks(low);
    expect(r2!.haste).toBeNull();
  });

  it('Venting (Engineer): every 5th attack burns the enemies around the troop and costs it a little HP', () => {
    const venting = TROOP_SKILLS.venting;
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'ranger', x: 330, y: 300 }, { cls: 'ranger', x: 600, y: 300 }], {
      general: 'engineer',
    });
    const vanguard = sideUnits(state, 'player')[0]!;
    const [near, far] = sideUnits(state, 'enemy');
    for (let i = 0; i < venting.everyAttacks - 1; i++) afterAttack(state, vanguard);
    ventHeat(state);
    expect(vanguard.heat).toBe(venting.everyAttacks - 1);
    expect(skills(state, 'vent')).toHaveLength(0);
    afterAttack(state, vanguard);
    ventHeat(state);
    expect(vanguard.heat).toBe(0);
    expect(skills(state, 'vent')[0]!.targetIds).toEqual([near!.id]);
    expect(near!.hp).toBe(near!.stats.maxHp - venting.damage);
    expect(far!.hp).toBe(far!.stats.maxHp);
    expect(vanguard.hp).toBe(vanguard.stats.maxHp - Math.round(vanguard.stats.maxHp * venting.selfDamageShare));
  });

  it('Venting (Engineer): every burn of a tick lands before anyone pays, so two troops venting at each other end even', () => {
    const venting = TROOP_SKILLS.venting;
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 330, y: 300 }], {
      general: 'engineer',
      enemyGeneral: 'engineer',
    });
    const [left, right] = state.units;
    for (const unit of [left!, right!]) {
      unit.heat = venting.everyAttacks;
      unit.hp = 40;
    }
    ventHeat(state);
    // Each takes the other's burn first, then pays what it can without falling.
    expect(left!.hp).toBe(1);
    expect(right!.hp).toBe(1);
  });

  it('Assimilation (Hive Mother): a troop that kills grows a shell from a tank, claws from anyone else', () => {
    const kill = (victim: 'vanguard' | 'ranger') => {
      const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: victim, x: 330, y: 300 }, { cls: 'ranger', x: 900, y: 300 }], {
        general: 'hiveMother',
      });
      freeze(...state.units);
      const [killer] = sideUnits(state, 'player');
      const target = sideUnits(state, 'enemy')[0]!;
      target.hp = 1;
      dealDamage(state, killer!.id, target, 50, 0, 'attack');
      stepBattle(state);
      return killer!;
    };
    const shelled = kill('vanguard');
    expect(shelled.adaptation?.kind).toBe('shell');
    expect(effectiveArmor(shelled)).toBeCloseTo(UNIT_CLASSES.vanguard.stats.armor + TROOP_SKILLS.assimilation.shellArmor);
    const clawed = kill('ranger');
    expect(clawed.adaptation?.kind).toBe('claws');
    expect(damageFactor(clawed)).toBeCloseTo(1 + TROOP_SKILLS.assimilation.clawsDamageBonus);
  });

  it('Assimilation (Hive Mother): a killer that falls in the same tick grows nothing', () => {
    const state = battleWith([{ cls: 'ranger', x: 300, y: 300 }], [{ cls: 'vanguard', x: 330, y: 300 }], { enemyGeneral: 'hiveMother' });
    freeze(...state.units);
    const [ranger, vanguard] = state.units;
    dealDamage(state, vanguard!.id, ranger!, 10_000, 1, 'attack');
    dealDamage(state, ranger!.id, vanguard!, 10_000, 1, 'attack');
    stepBattle(state);
    expect(state.result?.winner).toBe('draw');
    expect(skills(state, 'assimilation')).toHaveLength(0);
  });

  it('Phase Shift (Strategist): once per battle, a troop about to fall teleports behind its attacker and stuns it', () => {
    const state = battleWith([{ cls: 'ranger', x: 300, y: 300 }], [{ cls: 'vanguard', x: 330, y: 300 }], { general: 'strategist' });
    const ranger = sideUnits(state, 'player')[0]!;
    const attacker = sideUnits(state, 'enemy')[0]!;
    ranger.hp = 10;
    dealDamage(state, attacker.id, ranger, 100, 0, 'attack');
    expect(ranger.hp).toBe(10);
    // No more damage this tick; the teleport and stun come when the tick ends.
    dealDamage(state, attacker.id, ranger, 100, 0, 'attack');
    expect(ranger.hp).toBe(10);
    resolvePhaseShifts(state);
    expect(ranger.x).toBeGreaterThan(attacker.x);
    expect(attacker.stunTicks).toBe(secondsToTicks(TROOP_SKILLS.phaseShift.stunSeconds));
    expect(skills(state, 'phaseShift')[0]!.targetIds).toEqual([attacker.id]);
    dealDamage(state, attacker.id, ranger, 100, 0, 'attack');
    expect(ranger.hp).toBe(0);
    // Without the Strategist, the blow lands.
    const plain = battleWith([{ cls: 'ranger', x: 300, y: 300 }], [{ cls: 'vanguard', x: 330, y: 300 }]);
    sideUnits(plain, 'player')[0]!.hp = 10;
    dealDamage(plain, sideUnits(plain, 'enemy')[0]!.id, sideUnits(plain, 'player')[0]!, 100, 0, 'attack');
    expect(sideUnits(plain, 'player')[0]!.hp).toBe(0);
  });

  it('Echo Strike (Conductor): attacks stack Vibration; 3 stacks shatter the enemy’s armor for a while', () => {
    const echo = TROOP_SKILLS.echoStrike;
    const state = battleWith([{ cls: 'ranger', x: 300, y: 300 }], [{ cls: 'vanguard', x: 500, y: 300 }], { general: 'conductor' });
    const ranger = sideUnits(state, 'player')[0]!;
    const enemy = sideUnits(state, 'enemy')[0]!;
    dealDamage(state, ranger.id, enemy, 10, 0, 'splash');
    expect(enemy.vibration).toBeNull();
    for (let i = 0; i < 2; i++) dealDamage(state, ranger.id, enemy, 10, 0, 'attack');
    expect(enemy.vibration?.stacks).toBe(2);
    expect(enemy.shatterTicks).toBe(0);
    dealDamage(state, ranger.id, enemy, 10, 0, 'attack');
    dealDamage(state, ranger.id, enemy, 10, 0, 'attack');
    expect(enemy.vibration?.stacks).toBe(echo.maxStacks);
    expect(enemy.shatterTicks).toBe(secondsToTicks(echo.shatterSeconds));
    expect(effectiveArmor(enemy)).toBeCloseTo(UNIT_CLASSES.vanguard.stats.armor - echo.shatterArmorLoss);
    expect(skills(state, 'shatter')).toHaveLength(1);
  });
});
