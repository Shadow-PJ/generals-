import { describe, expect, it } from 'vitest';
import type { TroopPlacement } from '../data/armies';
import { BOSS_RULES } from '../data/bosses';
import { MAPS } from '../data/maps';
import { UNIT_CLASSES } from '../data/units';
import { enemyScript } from '../data/enemyScripts';
import { createBattle, runBattle, stepBattle } from './battle';
import { dealDamage } from './combat';
import { attackSpeedFactor, damageFactor } from './status';
import { freeze, openMap, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleSetup, BattleState } from './types';

function bossFight(player: TroopPlacement[], enemy: TroopPlacement[], extra: Partial<BattleSetup> = {}): BattleState {
  return createBattle({ seed: 4, map: openMap(), player, enemy, rank: 1, ...extra });
}

/** The troop falls at the end of the next tick, killed by `killerId`. */
function fell(state: BattleState, unitId: number, killerId: number): void {
  const unit = state.units.find((u) => u.id === unitId)!;
  unit.hp = 0;
  unit.lastHitBy = killerId;
  stepBattle(state);
}

describe('the Hive Mother boss', () => {
  it('her army steals a trait from each troop of yours it kills', () => {
    const state = bossFight(
      [{ cls: 'vanguard', x: 100, y: 100 }, { cls: 'guardian', x: 100, y: 300 }, { cls: 'ranger', x: 100, y: 500 }],
      [{ cls: 'vanguard', x: 900, y: 200 }, { cls: 'assassin', x: 900, y: 400 }],
      { boss: 'hiveMother' },
    );
    freeze(...state.units);
    const [vanguard, guardian] = sideUnits(state, 'player');
    const [hiveVanguard, hiveAssassin] = sideUnits(state, 'enemy');
    const armor = hiveVanguard!.stats.armor;
    fell(state, vanguard!.id, hiveAssassin!.id);
    expect(hiveVanguard!.stats.armor).toBeCloseTo(armor + BOSS_RULES.hiveMother.steals.vanguard.amount);
    expect(state.events.find((e) => e.type === 'stolen')).toMatchObject({ side: 'enemy', victimId: vanguard!.id, trait: 'vanguard' });
    const maxHp = hiveAssassin!.stats.maxHp;
    const hp = hiveAssassin!.hp;
    fell(state, guardian!.id, hiveVanguard!.id);
    const more = Math.round(maxHp * BOSS_RULES.hiveMother.steals.guardian.amount);
    expect(hiveAssassin!.stats.maxHp).toBe(maxHp + more);
    expect(hiveAssassin!.hp).toBe(hp + more);
  });

  it('steals nothing from a troop she didn’t kill, nor outside her boss fight', () => {
    const state = bossFight([{ cls: 'ranger', x: 100, y: 100 }, { cls: 'ranger', x: 100, y: 400 }], [{ cls: 'vanguard', x: 900, y: 300 }], { boss: 'hiveMother' });
    freeze(...state.units);
    const [first] = sideUnits(state, 'player');
    fell(state, first!.id, first!.id);
    expect(state.events.some((e) => e.type === 'stolen')).toBe(false);
    const plain = bossFight([{ cls: 'ranger', x: 100, y: 100 }, { cls: 'ranger', x: 100, y: 400 }], [{ cls: 'vanguard', x: 900, y: 300 }]);
    freeze(...plain.units);
    fell(plain, sideUnits(plain, 'player')[0]!.id, sideUnits(plain, 'enemy')[0]!.id);
    expect(plain.events.some((e) => e.type === 'stolen')).toBe(false);
  });
});

describe('the Strategist boss', () => {
  it('her troops phase out of their first big hits; small hits always land', () => {
    const state = bossFight([{ cls: 'vanguard', x: 100, y: 300 }], [{ cls: 'guardian', x: 900, y: 300 }], { boss: 'strategist' });
    const [you] = sideUnits(state, 'player');
    const [guardian] = sideUnits(state, 'enemy');
    expect(guardian!.bossPhases).toBe(BOSS_RULES.strategist.phases);
    expect(you!.bossPhases).toBe(0);
    const big = guardian!.stats.maxHp;
    const small = 10;
    const hp = () => guardian!.hp;
    let before = hp();
    dealDamage(state, you!.id, guardian!, small, 0, 'attack');
    expect(hp()).toBeLessThan(before);
    for (let i = 0; i < BOSS_RULES.strategist.phases; i++) {
      before = hp();
      dealDamage(state, you!.id, guardian!, big, 1, 'beam');
      expect(hp()).toBe(before);
    }
    expect(state.events.filter((e) => e.type === 'phased')).toHaveLength(BOSS_RULES.strategist.phases);
    dealDamage(state, you!.id, guardian!, big, 1, 'beam');
    expect(guardian!.hp).toBeLessThanOrEqual(0);
  });
});

describe('the Warlord boss', () => {
  it('each of his troops that falls sends the rest into a rage, stacking, that fades', () => {
    const state = bossFight(
      [{ cls: 'vanguard', x: 100, y: 300 }],
      [{ cls: 'vanguard', x: 900, y: 100 }, { cls: 'vanguard', x: 900, y: 300 }, { cls: 'ranger', x: 900, y: 500 }],
      { boss: 'warlord' },
    );
    freeze(...state.units);
    const [you] = sideUnits(state, 'player');
    const [first, second, ranger] = sideUnits(state, 'enemy');
    fell(state, first!.id, you!.id);
    expect(ranger!.rage?.stacks).toBe(1);
    fell(state, second!.id, you!.id);
    expect(ranger!.rage?.stacks).toBe(2);
    const rage = BOSS_RULES.warlord.rage;
    expect(damageFactor(ranger!)).toBeCloseTo(1 + rage.damage * 2);
    expect(attackSpeedFactor(ranger!)).toBeCloseTo(1 + rage.attackSpeed * 2);
    expect(state.events.filter((e) => e.type === 'enraged').map((e) => (e.type === 'enraged' ? e.stacks : 0))).toEqual([1, 2]);
    for (let i = 0; i < secondsToTicks(rage.seconds); i++) stepBattle(state);
    expect(ranger!.rage).toBeNull();
    expect(you!.rage).toBeNull();
  });
});

describe('the Engineer boss', () => {
  it('has turrets that never move, tough but weak to area damage', () => {
    const turrets = BOSS_RULES.engineer.turrets.map((t) => ({ ...t, turret: true }));
    const state = createBattle({
      seed: 3,
      map: MAPS.ironFortress,
      player: [{ cls: 'vanguard', x: 260, y: 270 }],
      enemy: [{ cls: 'vanguard', x: 700, y: 270 }, ...turrets],
      boss: 'engineer',
    });
    const turret = sideUnits(state, 'enemy')[1]!;
    const t = BOSS_RULES.engineer.turret;
    expect(turret).toMatchObject({ rooted: true, cls: 'ranger' });
    expect(turret.stats.maxHp).toBe(Math.round(UNIT_CLASSES.ranger.stats.maxHp * (1 + t.maxHp)));
    expect(turret.stats.range).toBeCloseTo(UNIT_CLASSES.ranger.stats.range * (1 + t.range));
    expect(turret.stats.areaDamageTaken).toBeCloseTo(UNIT_CLASSES.ranger.stats.areaDamageTaken * t.areaDamageTaken);
    const at = { x: turret.x, y: turret.y };
    for (let i = 0; i < 300; i++) stepBattle(state);
    expect({ x: turret.x, y: turret.y }).toEqual(at);
    // Not even a Shove moves it.
    turret.knockback = { dx: -5, dy: 0, ticksLeft: 10, byId: null, burned: false };
    for (let i = 0; i < 10; i++) stepBattle(state);
    expect({ x: turret.x, y: turret.y }).toEqual(at);
  });
});

describe('the Conductor boss', () => {
  it('her Vibration spreads to your troops close to the one hit, and brings her Shatterstorm closer', () => {
    const state = bossFight(
      [{ cls: 'vanguard', x: 300, y: 300 }, { cls: 'vanguard', x: 300, y: 340 }, { cls: 'vanguard', x: 300, y: 500 }],
      [{ cls: 'ranger', x: 900, y: 300 }],
      { boss: 'conductor', enemyGeneral: 'conductor', enemyCommander: { rank: 3, loadout: enemyScript('conductor', 3) } },
    );
    const [hit, near, far] = sideUnits(state, 'player');
    const [ranger] = sideUnits(state, 'enemy');
    const momentum = state.enemyCommand!.momentum;
    dealDamage(state, ranger!.id, hit!, 10, 0, 'attack');
    expect(hit!.vibration?.stacks).toBe(1);
    expect(near!.vibration?.stacks).toBe(1);
    expect(far!.vibration).toBeNull();
    expect(state.enemyCommand!.momentum).toBeCloseTo(momentum + BOSS_RULES.conductor.momentumPerStack * 2);
  });
});

describe('boss fights', () => {
  it('replay exactly', () => {
    for (const boss of ['hiveMother', 'strategist', 'warlord', 'conductor'] as const) {
      const setup: BattleSetup = {
        seed: 8,
        map: openMap(),
        player: [
          { cls: 'vanguard', x: 300, y: 250 },
          { cls: 'ranger', x: 150, y: 300 },
          { cls: 'guardian', x: 200, y: 400 },
        ],
        enemy: [
          { cls: 'vanguard', x: 700, y: 250 },
          { cls: 'assassin', x: 760, y: 350 },
          { cls: 'ranger', x: 850, y: 300 },
        ],
        enemyGeneral: boss,
        boss,
      };
      const a = runBattle(setup);
      const b = runBattle(setup);
      expect(a.result, boss).not.toBeNull();
      expect(b.events).toEqual(a.events);
    }
  });
});
