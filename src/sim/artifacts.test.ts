import { describe, expect, it } from 'vitest';
import type { TroopPlacement } from '../data/armies';
import { ARTIFACT_IDS, ARTIFACTS } from '../data/artifacts';
import { TECH_NODES } from '../data/tech';
import { UNIT_CLASSES } from '../data/units';
import { createBattle, runBattle, stepBattle } from './battle';
import { dealDamage } from './combat';
import { spawnReserve } from './spawn';
import { freeze, openMap, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleSetup, BattleState } from './types';

const ENEMY: TroopPlacement[] = [{ cls: 'vanguard', x: 900, y: 300 }];

function battle(player: TroopPlacement[], extra: Partial<BattleSetup> = {}): BattleState {
  return createBattle({ seed: 3, map: openMap(), player, enemy: ENEMY, rank: 1, ...extra });
}

describe('artifacts in battle', () => {
  it('there are 10, each doing something', () => {
    expect(ARTIFACT_IDS).toHaveLength(10);
    for (const id of ARTIFACT_IDS) expect(ARTIFACTS[id].effects.length).toBeGreaterThan(0);
  });

  it('change the stats of the troop that carries one, and only that troop', () => {
    const state = battle([
      { cls: 'vanguard', x: 100, y: 100 },
      { cls: 'vanguard', x: 100, y: 200, artifact: 'ironHeart' },
      { cls: 'vanguard', x: 100, y: 300, artifact: 'berserkersTorc' },
      { cls: 'ranger', x: 100, y: 400, artifact: 'stoneskinCharm' },
      { cls: 'invoker', x: 100, y: 500, artifact: 'wardingCloak' },
    ]);
    const [plain, heart, torc, charm, cloak] = sideUnits(state, 'player');
    const base = UNIT_CLASSES.vanguard.stats;
    expect(plain!.stats.maxHp).toBe(base.maxHp);
    expect(heart!.stats.maxHp).toBe(Math.round(base.maxHp * 1.25));
    expect(torc!.stats.damage).toBeCloseTo(base.damage * 1.25);
    expect(torc!.stats.maxHp).toBe(Math.round(base.maxHp * 0.9));
    expect(charm!.stats.armor).toBeCloseTo(UNIT_CLASSES.ranger.stats.armor + 0.08);
    expect(cloak!.stats.areaDamageTaken).toBeCloseTo(UNIT_CLASSES.invoker.stats.areaDamageTaken * 0.65);
  });

  it('a Lifesteal Core heals its troop, and a War Horn brings its skill back sooner', () => {
    const state = battle([
      { cls: 'vanguard', x: 100, y: 100, artifact: 'lifestealCore' },
      { cls: 'vanguard', x: 100, y: 300, artifact: 'warHorn' },
    ]);
    const [core, horn] = sideUnits(state, 'player');
    expect(core!.lifesteal).toBeCloseTo(0.15);
    expect(horn!.skillHaste).toBeCloseTo(0.3);
  });

  it('a Phoenix Feather gets its troop back up once, instead of falling', () => {
    const state = battle([{ cls: 'ranger', x: 100, y: 100, artifact: 'phoenixFeather' }]);
    freeze(...state.units);
    const [ranger] = sideUnits(state, 'player');
    const [enemy] = sideUnits(state, 'enemy');
    dealDamage(state, enemy!.id, ranger!, 99999, 1, 'beam');
    stepBattle(state);
    expect(ranger!.alive).toBe(true);
    expect(ranger!.hp).toBe(Math.round(ranger!.stats.maxHp * 0.3));
    expect(state.events.filter((e) => e.type === 'revived')).toHaveLength(1);
    dealDamage(state, enemy!.id, ranger!, 99999, 1, 'beam');
    stepBattle(state);
    expect(ranger!.alive).toBe(false);
  });
});

describe('the Tech Web in battle', () => {
  it('raises the stats of every troop of the class, reserves included, and not other classes', () => {
    const state = battle(
      [
        { cls: 'vanguard', x: 100, y: 100 },
        { cls: 'ranger', x: 100, y: 300 },
      ],
      { tech: { player: { vanguard: ['drills', 'arms', 'honed'] } }, reserves: { player: ['vanguard'], enemy: [] } },
    );
    const [vanguard, ranger] = sideUnits(state, 'player');
    const base = UNIT_CLASSES.vanguard.stats;
    expect(vanguard!.stats.maxHp).toBe(Math.round(base.maxHp * (1 + 0.08)));
    expect(vanguard!.stats.damage).toBeCloseTo(base.damage * 1.08);
    expect(vanguard!.skillHaste).toBeCloseTo(TECH_NODES.honed.effect.kind === 'skillHaste' ? TECH_NODES.honed.effect.cut : 0);
    expect(ranger!.stats.maxHp).toBe(UNIT_CLASSES.ranger.stats.maxHp);
    const reserve = spawnReserve(state, 'player', 'vanguard');
    expect(reserve?.stats.maxHp).toBe(vanguard!.stats.maxHp);
    // The enemy's troops of that class get nothing from your web.
    expect(sideUnits(state, 'enemy')[0]!.stats.maxHp).toBe(base.maxHp);
  });
});

describe('the event log for Battle IQ', () => {
  it('notes when your pips fill up and your ultimate becomes ready, once each time', () => {
    const state = battle([{ cls: 'vanguard', x: 100, y: 300 }], { rank: 1 });
    freeze(...state.units);
    for (let i = 0; i < secondsToTicks(80); i++) stepBattle(state);
    const mine = (type: string) => state.events.filter((e) => e.type === type && 'side' in e && e.side === 'player');
    expect(mine('pipsFull')).toHaveLength(1);
    expect(mine('ultimateReady')).toHaveLength(1);
  });

  it('battles with artifacts and Tech Web replay exactly', () => {
    const setup: BattleSetup = {
      seed: 11,
      map: openMap(),
      player: [
        { cls: 'vanguard', x: 300, y: 250, artifact: 'phoenixFeather' },
        { cls: 'ranger', x: 150, y: 300, artifact: 'eagleEye' },
      ],
      enemy: [
        { cls: 'vanguard', x: 700, y: 250 },
        { cls: 'ranger', x: 850, y: 300 },
      ],
      tech: { player: { vanguard: ['drills'] }, enemy: { ranger: ['arms'] } },
    };
    const a = runBattle(setup);
    expect(runBattle(setup).events).toEqual(a.events);
  });
});
