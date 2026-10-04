import { describe, expect, it } from 'vitest';
import type { Card, Step } from '../cards/types';
import { COMMAND_RULES } from '../data/command';
import { LEGENDARY_RULES } from '../data/legendary';
import { runBattle, stepBattle } from './battle';
import { LEGENDARY_SLOT, slotReadiness } from './command';
import { circleOverlapsRect } from './geometry';
import { HOLD } from './intents';
import { orderIntent } from './orders';
import { isLineClear } from './navigation';
import { visibleEnemies } from './queries';
import { battleWith, cardOf, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleInput, BattleSetup, BattleState } from './types';

const fire = (state: BattleState, slot = LEGENDARY_SLOT) => stepBattle(state, [{ tick: state.tick, kind: 'slot', slot }]);
const legendary = (...steps: Step[]): Card => cardOf(...steps);

describe('the Legendary slot', () => {
  const echo = legendary({ action: 'echo' });

  it('stays locked until a boss has taught a Legendary action', () => {
    const locked = battleWith([{ cls: 'vanguard', x: 100, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], { legendary: echo });
    expect(slotReadiness(locked, LEGENDARY_SLOT)).toBe('locked');
    expect(locked.command.slots[LEGENDARY_SLOT]!.card).toBeNull();
    const open = battleWith([{ cls: 'vanguard', x: 100, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], { legendary: echo, learned: ['echo'] });
    expect(open.command.legendaryOpen).toBe(true);
    expect(open.command.slots[LEGENDARY_SLOT]!.card).toMatchObject({ steps: [{ action: 'echo' }] });
  });

  it('leaves out a card whose Legendary action you haven’t learned, and keeps Legendary actions out of the regular slots', () => {
    const state = battleWith([{ cls: 'vanguard', x: 100, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], {
      cards: [echo],
      legendary: legendary({ action: 'swap', actors: { kind: 'all' }, target: { kind: 'weakest' } }),
      learned: ['echo'],
    });
    expect(state.command.slots[0]!.card).toBeNull();
    expect(state.command.slots[LEGENDARY_SLOT]!.card).toBeNull();
    expect(slotReadiness(state, LEGENDARY_SLOT)).toBe('empty');
  });
});

describe('Legendary actions', () => {
  it('Hijack: an enemy troop attacks its own army for a while, and your troops leave it alone', () => {
    const state = battleWith(
      [{ cls: 'ranger', x: 500, y: 300 }],
      [
        { cls: 'vanguard', x: 700, y: 300 },
        { cls: 'vanguard', x: 730, y: 300 },
      ],
      { legendary: legendary({ action: 'hijack', target: { kind: 'nearest' } }), learned: ['hijack'] },
    );
    state.command.pips = 5;
    const [ranger] = sideUnits(state, 'player');
    const [taken, other] = sideUnits(state, 'enemy');
    freeze(ranger!, other!);
    // A Focus order already on it is dropped while you control it.
    ranger!.orders = [{ kind: 'focus', target: { kind: 'nearest' }, place: null, triggerEnemyId: null, triggerAllyId: null, power: 1, combo: null, started: true, ticksLeft: 100, unitId: taken!.id, point: null }];
    fire(state);
    expect(orderIntent(state, ranger!, HOLD)).toBeNull();
    expect(state.events.find((e) => e.type === 'legendary')).toMatchObject({ side: 'player', action: 'hijack', unitIds: [taken!.id] });
    expect(taken!.hijackTicks).toBeGreaterThan(secondsToTicks(LEGENDARY_RULES.hijack.seconds) - 3);
    expect(visibleEnemies(state, ranger!)).toEqual([other]);
    for (let i = 0; i < 40; i++) stepBattle(state);
    const hits = state.events.filter((e) => e.type === 'damage' && e.sourceId === taken!.id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.type === 'damage' && e.targetId === other!.id)).toBe(true);
    // When control runs out it is an enemy again.
    while (taken!.hijackTicks > 0) stepBattle(state);
    expect(visibleEnemies(state, ranger!)).toContain(taken);
  });

  it('Swap: two of your troops trade places at once', () => {
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 100, y: 150 },
      ],
      [{ cls: 'vanguard', x: 900, y: 300 }],
      {
        legendary: legendary({ action: 'swap', actors: { kind: 'class', cls: 'vanguard' }, target: { kind: 'class', cls: 'ranger' } }),
        learned: ['swap'],
      },
    );
    state.command.pips = 5;
    freeze(...state.units);
    const [vanguard, ranger] = sideUnits(state, 'player');
    fire(state);
    expect([vanguard!.x, vanguard!.y]).toEqual([100, 150]);
    expect([ranger!.x, ranger!.y]).toEqual([300, 300]);
  });

  it('Blood Pact: one troop is given up, and pips and Momentum are full; never your last troop', () => {
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 100, y: 150 },
      ],
      [{ cls: 'vanguard', x: 900, y: 300 }],
      { legendary: legendary({ action: 'bloodPact', target: { kind: 'class', cls: 'ranger' } }), learned: ['bloodPact'] },
    );
    state.command.pips = 3;
    freeze(...state.units);
    const [vanguard, ranger] = sideUnits(state, 'player');
    fire(state);
    expect(ranger!.alive).toBe(false);
    expect(state.events.find((e) => e.type === 'death' && e.unitId === ranger!.id)).toMatchObject({ killerId: null });
    expect(state.command.pips).toBe(state.command.maxPips);
    expect(state.command.momentum).toBe(COMMAND_RULES.momentum.max);
    expect(vanguard!.alive).toBe(true);
    // Only the Vanguard is left: the card waits rather than lose the battle.
    state.command.slots[LEGENDARY_SLOT]!.card = legendary({ action: 'bloodPact', target: { kind: 'weakest' } });
    state.command.slots[LEGENDARY_SLOT]!.restTicks = 0;
    expect(slotReadiness(state, LEGENDARY_SLOT)).toBe('waiting');
  });

  it('Fortify: a wall rises in front of your army, stops shots and paths, sends troops in its way to their own side, and falls after 8 s', () => {
    // Both Vanguards stand where the wall will rise (its middle is near x 409): the enemy one on
    // your side of the middle, yours on theirs.
    const state = battleWith(
      [
        { cls: 'ranger', x: 300, y: 260 },
        { cls: 'guardian', x: 185, y: 340 },
        { cls: 'vanguard', x: 415, y: 320 },
      ],
      [
        { cls: 'vanguard', x: 405, y: 280 },
        { cls: 'ranger', x: 600, y: 280 },
      ],
      { legendary: legendary({ action: 'fortify', at: { kind: 'forward' } }), learned: ['fortify'] },
    );
    state.command.pips = 5;
    freeze(...state.units);
    const [vanguard] = sideUnits(state, 'enemy');
    const [, , yours] = sideUnits(state, 'player');
    fire(state);
    const raised = state.events.find((e) => e.type === 'legendary');
    expect(raised).toMatchObject({ action: 'fortify', wallId: 1 });
    const wall = state.walls[0]!;
    expect(wall).toMatchObject({ w: LEGENDARY_RULES.fortify.thickness, h: LEGENDARY_RULES.fortify.length, hp: LEGENDARY_RULES.fortify.hp });
    // In front of your army; each Vanguard stepped out to its own army's side.
    expect(wall.x).toBeGreaterThan(300);
    expect(circleOverlapsRect(vanguard!.x, vanguard!.y, vanguard!.stats.radius, wall)).toBe(false);
    expect(circleOverlapsRect(yours!.x, yours!.y, yours!.stats.radius, wall)).toBe(false);
    expect(vanguard!.x).toBeGreaterThan(wall.x + wall.w);
    expect(yours!.x).toBeLessThan(wall.x);
    expect(isLineClear(state.nav, 300, 300, 600, 300)).toBe(false);
    while (state.walls[0]!.hp > 0 && state.tick < 400) stepBattle(state);
    expect(state.tick).toBeLessThanOrEqual(secondsToTicks(LEGENDARY_RULES.fortify.seconds) + 2);
    expect(isLineClear(state.nav, 300, 300, 600, 300)).toBe(true);
  });

  it('Echo: your last card again, for free; it waits until a card has fired', () => {
    const focus = cardOf({ action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' } });
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], {
      cards: [focus],
      legendary: legendary({ action: 'echo' }),
      learned: ['echo'],
    });
    state.command.pips = 5;
    freeze(...state.units);
    expect(slotReadiness(state, LEGENDARY_SLOT)).toBe('waiting');
    fire(state, 0);
    const [vanguard] = sideUnits(state, 'player');
    vanguard!.orders = [];
    state.command.pips = 3;
    expect(slotReadiness(state, LEGENDARY_SLOT)).toBe('ready');
    fire(state);
    // The Echo card's own 3 pips (2 in a chain), nothing for the card it repeats.
    expect(state.command.pips).toBe(1);
    expect(vanguard!.orders[0]).toMatchObject({ kind: 'focus' });
  });

  it('replay exactly', () => {
    const setup: BattleSetup = {
      seed: 5,
      map: battleWith([], []).map,
      player: [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 150, y: 250 },
      ],
      enemy: [
        { cls: 'vanguard', x: 700, y: 300 },
        { cls: 'ranger', x: 850, y: 250 },
      ],
      rank: 5,
      loadout: { slots: [], legendary: legendary({ action: 'hijack', target: { kind: 'nearest' } }) },
      learned: ['hijack'],
    };
    const inputs: BattleInput[] = [60, 61, 62, 200].map((tick) => ({ tick, kind: 'slot', slot: LEGENDARY_SLOT }));
    const a = runBattle(setup, inputs);
    const b = runBattle(setup, inputs);
    expect(a.events.some((e) => e.type === 'legendary')).toBe(true);
    expect(b.events).toEqual(a.events);
  });
});
