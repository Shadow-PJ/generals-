import { describe, expect, it } from 'vitest';
import { validateCard } from '../cards/validator';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED, STARTER_RESERVES } from '../data/armies';
import { COMMAND_RULES, CONDITION_RULES } from '../data/command';
import { enemyScript } from '../data/enemyScripts';
import { GENERAL_IDS, type GeneralId } from '../data/generals';
import { MAPS } from '../data/maps';
import { createBattle, runBattle, stepBattle } from './battle';
import { checkTrigger } from './conditions';
import { battleWith, freeze, sideUnits } from './testing/fixtures';
import type { BattleSetup, BattleState } from './types';

function commanded(general: GeneralId = 'captain', rank: 1 | 2 | 3 | 4 | 5 = 3): BattleState {
  const state = battleWith(
    [
      { cls: 'vanguard', x: 100, y: 300 },
      { cls: 'ranger', x: 60, y: 200 },
    ],
    [
      { cls: 'vanguard', x: 900, y: 300 },
      { cls: 'ranger', x: 940, y: 200 },
      { cls: 'guardian', x: 940, y: 400 },
    ],
    { enemyGeneral: general },
  );
  state.enemyCommand = createBattle({
    seed: 1,
    map: state.map,
    player: [],
    enemy: [],
    enemyGeneral: general,
    enemyCommander: { rank, loadout: enemyScript(general, rank) },
  }).enemyCommand;
  freeze(...state.units);
  return state;
}

describe('enemy commanders', () => {
  it('have scripts their rank allows, with their General’s signature card first', () => {
    for (const general of GENERAL_IDS) {
      expect(enemyScript(general, 1).slots, general).toEqual([]);
      for (const rank of [2, 3, 4, 5] as const) {
        const slots = enemyScript(general, rank).slots;
        expect(slots.length, `${general} at rank ${rank}`).toBeGreaterThanOrEqual(3);
        for (const card of slots) expect(validateCard(card!, rank).ok, `${general} at rank ${rank}`).toBe(true);
      }
    }
    // Lower ranks play the part of a card they know: the Strategist's Feigned Retreat is only a Fall Back at Rank II.
    expect(enemyScript('strategist', 2).slots[0]!.steps.map((s) => s.action)).toEqual(['fallBack']);
    expect(enemyScript('strategist', 3).slots[0]!.steps.map((s) => s.action)).toEqual(['fallBack', 'focus']);
    expect(enemyScript('captain', 4).slots.some((c) => c!.steps[0]!.action === 'callReserve')).toBe(true);
  });

  it('keep their cards for the fight: nothing fires while the armies still stand in their lines', () => {
    for (const general of GENERAL_IDS) {
      const state = createBattle({
        seed: 3,
        map: MAPS.openField,
        player: STARTER_ARMY,
        enemy: STARTER_ARMY_MIRRORED,
        enemyGeneral: general,
        enemyCommander: { rank: 5, loadout: enemyScript(general, 5) },
      });
      for (let i = 0; i < 40; i++) stepBattle(state);
      expect(state.events.filter((e) => e.type === 'cardFired'), general).toEqual([]);
    }
  });

  it('are left out unless the battle has one', () => {
    const state = createBattle({ seed: 1, map: MAPS.openField, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
    expect(state.enemyCommand).toBeNull();
  });

  it('fire their cards by themselves when the moment comes', () => {
    const state = commanded();
    state.enemyCommand!.pips = 4;
    // One of your troops walks into their backline: everyone turns on it.
    const vanguard = sideUnits(state, 'player')[0]!;
    vanguard.x = 900;
    vanguard.y = 150;
    stepBattle(state);
    const fired = state.events.filter((e) => e.type === 'cardFired' && e.side === 'enemy');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ slot: 1, auto: true });
    for (const enemy of sideUnits(state, 'enemy')) expect(enemy.orders[0]).toMatchObject({ kind: 'focus', unitId: vanguard.id });
    expect(state.command.pips).toBe(COMMAND_RULES.startingPips);
  });

  it('fire their ultimate as soon as it is ready', () => {
    const state = commanded('captain');
    state.enemyCommand!.momentum = COMMAND_RULES.momentum.max;
    stepBattle(state);
    expect(state.events.find((e) => e.type === 'ultimate')).toMatchObject({ side: 'enemy', name: 'rally' });
    expect(sideUnits(state, 'enemy')[0]!.rallyTicks).toBeGreaterThan(0);
    expect(state.enemyCommand!.momentum).toBeLessThan(10);
  });

  it('can be seen charging their ultimate: "when their ultimate charges" glows', () => {
    const state = commanded();
    const trigger = { kind: 'enemyUltimateCharging' } as const;
    expect(checkTrigger(state, 'player', trigger).met).toBe(false);
    state.enemyCommand!.momentum = COMMAND_RULES.momentum.max * CONDITION_RULES.ultimateChargingShare;
    expect(checkTrigger(state, 'player', trigger).met).toBe(true);
    // Their cards can wait for yours too.
    state.command.momentum = COMMAND_RULES.momentum.max;
    expect(checkTrigger(state, 'enemy', trigger).met).toBe(true);
  });

  it('get their General’s mana twist: a Hive Mother commander feeds on your fallen troops', () => {
    const state = commanded('hiveMother');
    const before = state.enemyCommand!.pips;
    sideUnits(state, 'player')[1]!.hp = 0;
    stepBattle(state);
    expect(state.enemyCommand!.pips).toBe(before + 1);
  });

  it('replay exactly, and battles with two commanders end', () => {
    const setup: BattleSetup = {
      seed: 11,
      map: MAPS.redCanyon,
      player: STARTER_ARMY,
      enemy: STARTER_ARMY_MIRRORED,
      reserves: { player: [...STARTER_RESERVES], enemy: [...STARTER_RESERVES] },
      general: 'strategist',
      enemyGeneral: 'warlord',
      rank: 3,
      loadout: enemyScript('strategist', 3),
      enemyCommander: { rank: 3, loadout: enemyScript('warlord', 3) },
    };
    const a = runBattle(setup);
    const b = runBattle(setup);
    expect(a.result).not.toBeNull();
    expect(b.events).toEqual(a.events);
    expect(a.events.some((e) => e.type === 'cardFired' && e.side === 'enemy')).toBe(true);
    expect(a.events.some((e) => e.type === 'cardFired' && e.side === 'player')).toBe(true);
  });
});
