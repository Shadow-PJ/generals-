import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { COMMAND_RULES, ORDER_RULES } from '../data/command';
import { UNIT_CLASSES } from '../data/units';
import { stepBattle } from './battle';
import { distance } from './geometry';
import { orderPower } from './queries';
import { battleWith, cardOf } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleState, Unit } from './types';

function fire(state: BattleState, slot = 0): void {
  stepBattle(state, [{ tick: state.tick, kind: 'slot', slot }]);
}

function run(state: BattleState, seconds: number): void {
  for (let i = 0; i < secondsToTicks(seconds); i++) stepBattle(state);
}

const mine = (state: BattleState, cls: Unit['cls']) => state.units.find((u) => u.side === 'player' && u.cls === cls)!;
const theirs = (state: BattleState, cls: Unit['cls']) => state.units.find((u) => u.side === 'enemy' && u.cls === cls)!;

describe('card orders', () => {
  it('Focus: the named troops go after the named enemy instead of their own choice', () => {
    const card = cardOf({ action: 'focus', actors: { kind: 'class', cls: 'vanguard' }, target: { kind: 'class', cls: 'ranger' } });
    const state = battleWith(
      [{ cls: 'vanguard', x: 300, y: 300 }],
      [
        { cls: 'vanguard', x: 600, y: 300 },
        { cls: 'ranger', x: 800, y: 100 },
      ],
      { cards: [card] },
    );
    fire(state);
    run(state, 0.5);
    expect(mine(state, 'vanguard').targetId).toBe(theirs(state, 'ranger').id);
    expect(mine(state, 'vanguard').orders[0]).toMatchObject({ kind: 'focus', started: true });
  });

  it('Focus ends when its target falls, and the troop goes back to its own ideas', () => {
    const card = cardOf({ action: 'focus', actors: { kind: 'all' }, target: { kind: 'class', cls: 'ranger' } });
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [
      { cls: 'ranger', x: 340, y: 300 },
      { cls: 'vanguard', x: 600, y: 300 },
    ], { cards: [card] });
    fire(state);
    theirs(state, 'ranger').hp = 0;
    run(state, 0.2);
    expect(mine(state, 'vanguard').orders).toEqual([]);
  });

  it('Fall Back: troops walk away from the enemy and do not attack meanwhile', () => {
    const card = cardOf({ action: 'fallBack', actors: { kind: 'all' }, to: null });
    const state = battleWith([{ cls: 'vanguard', x: 400, y: 300 }], [{ cls: 'vanguard', x: 430, y: 300 }], { cards: [card] });
    const enemy = theirs(state, 'vanguard');
    fire(state);
    run(state, 1);
    expect(mine(state, 'vanguard').x).toBeLessThan(400);
    expect(state.events.some((e) => e.type === 'damage' && e.sourceId === mine(state, 'vanguard').id && e.cause === 'attack')).toBe(false);
    expect(enemy.alive).toBe(true);
  });

  it('Move forward and Move behind the enemy go where they say', () => {
    const forward = cardOf({ action: 'move', actors: { kind: 'class', cls: 'ranger' }, to: { kind: 'forward' } });
    const behind = cardOf({ action: 'move', actors: { kind: 'class', cls: 'vanguard' }, to: { kind: 'behindEnemies' } });
    const state = battleWith(
      [
        { cls: 'ranger', x: 100, y: 200 },
        { cls: 'vanguard', x: 200, y: 400 },
      ],
      [{ cls: 'guardian', x: 700, y: 400 }],
      { cards: [forward, behind] },
    );
    fire(state, 0);
    fire(state, 1);
    const vanguardOrder = mine(state, 'vanguard').orders[0]!;
    expect(vanguardOrder.point!.x).toBeGreaterThan(700);
    run(state, 1);
    expect(mine(state, 'ranger').x).toBeGreaterThan(130);
  });

  it('Hold: troops stay put', () => {
    const card = cardOf({ action: 'hold', actors: { kind: 'all' } });
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 700, y: 300 }], { cards: [card] });
    fire(state);
    run(state, 2);
    expect(mine(state, 'vanguard').x).toBe(300);
  });

  it('Protect: troops go to the ward and stand between it and the enemy', () => {
    const card = cardOf({ action: 'protect', actors: { kind: 'class', cls: 'vanguard' }, target: { kind: 'class', cls: 'ranger' } });
    const state = battleWith(
      [
        { cls: 'vanguard', x: 200, y: 330 },
        { cls: 'ranger', x: 100, y: 450 },
      ],
      [{ cls: 'vanguard', x: 600, y: 450 }],
      { cards: [card] },
    );
    fire(state);
    run(state, 3);
    const ranger = mine(state, 'ranger');
    expect(distance(mine(state, 'vanguard').x, mine(state, 'vanguard').y, ranger.x, ranger.y)).toBeLessThan(60);
  });

  it('Protect by a Guardian also gives the ward a Barrier', () => {
    const card = cardOf({ action: 'protect', actors: { kind: 'class', cls: 'guardian' }, target: { kind: 'class', cls: 'ranger' } });
    const state = battleWith(
      [
        { cls: 'guardian', x: 150, y: 300 },
        { cls: 'ranger', x: 100, y: 300 },
      ],
      [{ cls: 'vanguard', x: 900, y: 300 }],
      { cards: [card] },
    );
    mine(state, 'guardian').skillCooldown = 0;
    fire(state);
    stepBattle(state);
    expect(mine(state, 'ranger').barrier).not.toBeNull();
  });

  it('Overcharge: the skill fires at once, ignoring its usual conditions', () => {
    const card = cardOf({ action: 'overcharge', actors: { kind: 'all' } });
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'guardian', x: 250, y: 300 },
      ],
      [{ cls: 'vanguard', x: 330, y: 300 }],
      { cards: [card] },
    );
    for (const u of state.units) u.skillCooldown = 100;
    fire(state);
    const skills = state.events.filter((e) => e.type === 'skill').map((e) => (e.type === 'skill' ? e.skill : ''));
    expect(skills).toEqual(expect.arrayContaining(['shove', 'barrier']));
    // The Vanguard at full HP still got a Barrier: Overcharge ignores the usual HP threshold.
    expect(mine(state, 'vanguard').barrier?.amount).toBe(UNIT_CLASSES.guardian.barrier.amount);
  });

  it('carries steps out one after another', () => {
    const card: Card = cardOf(
      { action: 'fallBack', actors: { kind: 'all' }, to: null },
      { action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' } },
    );
    const state = battleWith([{ cls: 'ranger', x: 400, y: 300 }], [{ cls: 'vanguard', x: 800, y: 300 }], { cards: [card] });
    fire(state);
    expect(mine(state, 'ranger').orders.map((o) => o.kind)).toEqual(['fallBack', 'focus']);
    run(state, ORDER_RULES.fallBackSeconds + 0.2);
    expect(mine(state, 'ranger').orders[0]?.kind).toBe('focus');
  });

  it('a newer card replaces the orders of the troops it names, and only theirs', () => {
    const allHold = cardOf({ action: 'hold', actors: { kind: 'all' } });
    const rangersBack = cardOf({ action: 'fallBack', actors: { kind: 'class', cls: 'ranger' }, to: null });
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 200, y: 300 },
      ],
      [{ cls: 'vanguard', x: 800, y: 300 }],
      { cards: [allHold, rangersBack] },
    );
    fire(state, 0);
    fire(state, 1);
    expect(mine(state, 'ranger').orders[0]?.kind).toBe('fallBack');
    expect(mine(state, 'vanguard').orders[0]?.kind).toBe('hold');
  });

  it('a Perfect order makes the troop hit harder and move faster while it lasts', () => {
    const card: Card = {
      condition: { triggers: [{ kind: 'allyBelowHp', ally: 'any', hpPercent: 90 }], repeat: false },
      steps: [{ action: 'move', actors: { kind: 'all' }, to: { kind: 'forward' } }],
      auto: false,
    };
    const state = battleWith([{ cls: 'vanguard', x: 100, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], { cards: [card] });
    mine(state, 'vanguard').hp = 100;
    stepBattle(state);
    fire(state);
    expect(orderPower(mine(state, 'vanguard'))).toBe(1 + COMMAND_RULES.perfect.effectBonus);
  });
});

describe('reserves', () => {
  it('Call Reserve brings in the named reserve at your edge, once', () => {
    const card = cardOf({ action: 'callReserve', reserve: 'ranger' });
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], {
      cards: [card],
      reserves: ['vanguard', 'ranger', 'guardian'],
    });
    const before = state.startHp.player;
    fire(state);
    const arrived = state.units.at(-1)!;
    expect(arrived).toMatchObject({ side: 'player', cls: 'ranger', alive: true });
    expect(arrived.x).toBeLessThan(80);
    expect(state.reserves.player).toEqual(['vanguard', 'guardian']);
    expect(state.startHp.player).toBe(before + arrived.stats.maxHp);
    expect(state.events).toContainEqual({ tick: 0, type: 'reserveCalled', side: 'player', unitId: arrived.id });
  });

  it('with no class named, brings in the next in line; with none left, nothing happens', () => {
    const card = cardOf({ action: 'callReserve', reserve: null });
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 900, y: 300 }], {
      cards: [card],
      reserves: ['guardian'],
    });
    state.command.pips = 6;
    fire(state);
    expect(state.units.at(-1)!.cls).toBe('guardian');
    run(state, 8.5);
    const count = state.units.length;
    state.command.pips = 6;
    fire(state);
    expect(state.units.length).toBe(count);
  });
});
