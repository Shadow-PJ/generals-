import { describe, expect, it } from 'vitest';
import type { TroopPlacement } from '../data/armies';
import { COMMAND_RULES } from '../data/command';
import { ULTIMATE_RULES, type GeneralId } from '../data/generals';
import { stepBattle } from './battle';
import { dealDamage } from './combat';
import { ultimateReady } from './command';
import { battleWith, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import { ultimateUsable } from './ultimates';
import type { BattleEvent, BattleState } from './types';

function charged(player: TroopPlacement[], enemy: TroopPlacement[], general: GeneralId): BattleState {
  const state = battleWith(player, enemy, { general });
  freeze(...state.units);
  state.command.momentum = COMMAND_RULES.momentum.max;
  return state;
}

function fire(state: BattleState): Extract<BattleEvent, { type: 'ultimate' }> | undefined {
  stepBattle(state, [{ tick: state.tick, kind: 'ultimate' }]);
  return state.events.find((e): e is Extract<BattleEvent, { type: 'ultimate' }> => e.type === 'ultimate');
}

const mine = (state: BattleState, i = 0) => sideUnits(state, 'player')[i]!;
const theirs = (state: BattleState, i = 0) => sideUnits(state, 'enemy')[i]!;
const pair: TroopPlacement[] = [
  { cls: 'vanguard', x: 200, y: 300 },
  { cls: 'ranger', x: 100, y: 300 },
];

describe("the Generals' ultimates", () => {
  it("Reaper's Toll (Warlord): troops below 20% HP become invulnerable wraiths that hit harder, then fall", () => {
    const rules = ULTIMATE_RULES.reapersToll;
    const state = charged(pair, [{ cls: 'vanguard', x: 800, y: 300 }], 'warlord');
    // With no troop that low, it waits.
    expect(ultimateReady(state)).toBe(false);
    expect(fire(state)).toBeUndefined();
    const ranger = mine(state, 1);
    ranger.hp = 40;
    expect(ultimateReady(state)).toBe(true);
    expect(fire(state)).toMatchObject({ name: 'reapersToll', side: 'player' });
    expect(ranger.wraithTicks).toBeGreaterThan(0);
    expect(mine(state, 0).wraithTicks).toBe(0);
    dealDamage(state, theirs(state).id, ranger, 500, 0, 'attack');
    expect(ranger.hp).toBe(40);
    for (let i = 0; i < secondsToTicks(rules.wraithSeconds); i++) stepBattle(state);
    expect(ranger.alive).toBe(false);
    expect(state.events.some((e) => e.type === 'death' && e.unitId === ranger.id)).toBe(true);
  });

  it('Thermal Detonation (Engineer): heat heals your troops and fires a beam through the enemy', () => {
    const rules = ULTIMATE_RULES.thermalDetonation;
    const state = charged(
      [
        { cls: 'vanguard', x: 200, y: 300 },
        { cls: 'vanguard', x: 200, y: 340 },
      ],
      [
        { cls: 'ranger', x: 700, y: 320 },
        { cls: 'ranger', x: 740, y: 320 },
        { cls: 'ranger', x: 60, y: 320 },
      ],
      'engineer',
    );
    const [a, b] = sideUnits(state, 'player');
    a!.hp = 500;
    b!.hp = 500;
    a!.heat = 4;
    b!.heat = 2;
    const event = fire(state);
    expect(event).toMatchObject({ name: 'thermalDetonation', at: { x: 200, y: 320 } });
    expect(a!.hp).toBe(500 + Math.round(a!.stats.maxHp * (rules.healShare + rules.healSharePerHeat * 4)));
    expect(a!.heat).toBe(0);
    // The beam runs from your middle through theirs, forward only: it misses the Ranger behind your troops.
    const hit = state.events.filter((e) => e.type === 'damage' && e.cause === 'beam').map((e) => e.type === 'damage' && e.targetId);
    expect(hit).toEqual([theirs(state, 0).id, theirs(state, 1).id]);
    expect(theirs(state, 0).hp).toBe(theirs(state, 0).stats.maxHp - (rules.beamDamage + rules.beamDamagePerHeat * 6));
  });

  it('Forced Evolution (Hive Mother): once two troops are below 50%, the two most hurt merge into one elite at full HP', () => {
    const state = charged(
      [
        { cls: 'vanguard', x: 200, y: 300 },
        { cls: 'ranger', x: 100, y: 250 },
        { cls: 'ranger', x: 100, y: 350 },
      ],
      [{ cls: 'vanguard', x: 800, y: 300 }],
      'hiveMother',
    );
    const [vanguard, r1, r2] = sideUnits(state, 'player');
    vanguard!.hp = 600;
    r1!.hp = 300;
    // Only one troop below 50%: it waits.
    expect(ultimateUsable(state, 'player')).toBe(false);
    r1!.hp = 200;
    const damage = vanguard!.stats.damage;
    expect(fire(state)).toMatchObject({ name: 'forcedEvolution' });
    // The Vanguard (39% HP) and the first Ranger (44%) are the most hurt; the Vanguard has more HP left, so it stays.
    expect(vanguard!.elite).toBe(true);
    expect(vanguard!.stats.maxHp).toBe(1550 + 450);
    expect(vanguard!.hp).toBe(1550 + 450);
    expect(vanguard!.stats.damage).toBeCloseTo(damage * (1 + ULTIMATE_RULES.forcedEvolution.damageBonus));
    expect(r1!.alive).toBe(false);
    expect(r2!.alive).toBe(true);
    expect(state.events.find((e) => e.type === 'evolved')).toMatchObject({ unitId: vanguard!.id, mergedId: r1!.id });
    expect(state.events.some((e) => e.type === 'death')).toBe(false);
  });

  it('Gravity Well (Strategist): drags every unit near the enemy army, friend and foe, to one point', () => {
    const state = charged(
      [
        { cls: 'vanguard', x: 560, y: 300 },
        { cls: 'ranger', x: 100, y: 300 },
      ],
      [
        { cls: 'vanguard', x: 700, y: 200 },
        { cls: 'vanguard', x: 700, y: 400 },
      ],
      'strategist',
    );
    const event = fire(state);
    expect(event).toMatchObject({ name: 'gravityWell', at: { x: 700, y: 300 } });
    for (let i = 0; i < 20; i++) stepBattle(state);
    expect(theirs(state, 0).y).toBeGreaterThan(250);
    expect(theirs(state, 1).y).toBeLessThan(350);
    expect(mine(state, 0).x).toBeGreaterThan(600);
    // Your Ranger is far from the point and stays put.
    expect(mine(state, 1).x).toBe(100);
  });

  it('Shatterstorm (Conductor): every Vibration stack explodes, hurting the enemies around it too', () => {
    const rules = ULTIMATE_RULES.shatterstorm;
    const state = charged(
      [{ cls: 'ranger', x: 100, y: 300 }],
      [
        { cls: 'ranger', x: 700, y: 300 },
        { cls: 'ranger', x: 730, y: 300 },
        { cls: 'ranger', x: 700, y: 500 },
      ],
      'conductor',
    );
    expect(ultimateReady(state)).toBe(false);
    const [stacked, beside, far] = sideUnits(state, 'enemy');
    stacked!.vibration = { stacks: 3, ticksLeft: 50 };
    expect(fire(state)).toMatchObject({ name: 'shatterstorm' });
    const blast = 3 * rules.damagePerStack;
    expect(stacked!.hp).toBe(450 - blast);
    expect(beside!.hp).toBe(450 - Math.round(blast * rules.blastShare));
    expect(far!.hp).toBe(450);
    expect(stacked!.vibration).toBeNull();
  });

  it("is the Captain's Rally with no General", () => {
    const state = charged(pair, [{ cls: 'vanguard', x: 800, y: 300 }], 'captain');
    expect(fire(state)).toMatchObject({ name: 'rally' });
    expect(mine(state).rallyTicks).toBeGreaterThan(0);
  });
});
