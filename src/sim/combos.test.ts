import { describe, expect, it } from 'vitest';
import type { Card, Step } from '../cards/types';
import { COMBO_BONUSES } from '../data/combos';
import { COMMAND_RULES, ULTIMATES } from '../data/command';
import type { RankNumber } from '../data/ranks';
import { UNIT_CLASSES } from '../data/units';
import { stepBattle } from './battle';
import { dealDamage } from './combat';
import { chainTicksLeft, nextLink, slotCost, slotReadiness } from './command';
import { stepLength } from './movement';
import { battleWith, cardOf, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleEvent, BattleState } from './types';

const all = { kind: 'all' } as const;
const vanguards = { kind: 'class', cls: 'vanguard' } as const;
const fallBack: Step = { action: 'fallBack', actors: all, to: null };
const focusNearest: Step = { action: 'focus', actors: all, target: { kind: 'nearest' } };
const hold: Step = { action: 'hold', actors: all };

/** Your Vanguard and Ranger far from one enemy Vanguard, so nothing fights for a while. */
function quiet(cards: (Card | null)[], rank: RankNumber = 5, reserves: ('vanguard' | 'ranger' | 'guardian')[] = []): BattleState {
  return battleWith(
    [
      { cls: 'vanguard', x: 100, y: 300 },
      { cls: 'ranger', x: 60, y: 200 },
    ],
    [{ cls: 'vanguard', x: 950, y: 300 }],
    { cards, rank, reserves },
  );
}

function steps(state: BattleState, n: number): void {
  for (let i = 0; i < n; i++) stepBattle(state);
}

function press(state: BattleState, ...slots: number[]): void {
  stepBattle(state, slots.map((slot) => ({ tick: state.tick, kind: 'slot' as const, slot })));
}

function ofType<T extends BattleEvent['type']>(state: BattleState, type: T): Extract<BattleEvent, { type: T }>[] {
  return state.events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
}

const mine = (state: BattleState, cls: string) => sideUnits(state, 'player').find((u) => u.cls === cls)!;
const theirs = (state: BattleState) => sideUnits(state, 'enemy');

describe('chains', () => {
  it('link a card fired within 3 s of the last one, and break after that', () => {
    const state = quiet([cardOf(hold), cardOf(fallBack), cardOf(hold)]);
    state.command.pips = 6;
    press(state, 0);
    expect(nextLink(state)).toBe(2);
    steps(state, secondsToTicks(COMMAND_RULES.chain.windowSeconds) - 2);
    press(state, 1);
    expect(nextLink(state)).toBe(3);
    steps(state, secondsToTicks(COMMAND_RULES.chain.windowSeconds) + 1);
    expect(nextLink(state)).toBe(1);
    expect(chainTicksLeft(state)).toBe(0);
    press(state, 2);
    expect(ofType(state, 'cardFired').map((e) => e.link)).toEqual([1, 2, 1]);
  });

  it('make each link after the first cost 1 pip less, but never less than 1', () => {
    const overchargeAll: Step = { action: 'overcharge', actors: all };
    const state = quiet([cardOf(hold), cardOf(overchargeAll), cardOf(hold)]);
    state.command.pips = 6;
    expect(slotCost(state, 1)).toBe(2);
    press(state, 0);
    expect(slotCost(state, 1)).toBe(1);
    expect(slotCost(state, 2)).toBe(1);
    press(state, 1);
    expect(ofType(state, 'cardFired').map((e) => e.cost)).toEqual([1, 1]);
  });

  it('let a chained card fire with the pips a full-price one would lack', () => {
    const overchargeAll: Step = { action: 'overcharge', actors: all };
    const state = quiet([cardOf(hold), cardOf(overchargeAll)]);
    state.command.pips = 2;
    press(state, 0);
    expect(state.command.pips).toBe(1);
    expect(slotReadiness(state, 1)).toBe('ready');
    press(state, 1);
    expect(state.command.pips).toBe(0);
  });

  it('give Momentum for each link after the first, doubled', () => {
    const state = quiet([cardOf(hold), cardOf(hold)]);
    state.command.pips = 6;
    press(state, 0);
    const before = state.command.momentum;
    press(state, 1);
    const gain = state.command.momentum - before;
    const passive = COMMAND_RULES.momentum.passivePerSecond / 20;
    expect(gain).toBeCloseTo(COMMAND_RULES.momentum.chainLinkGain * COMMAND_RULES.momentum.chainMultiplier + passive, 5);
  });

  it('only exist from Rank III', () => {
    const state = quiet([cardOf(focusNearest), cardOf(fallBack)], 2);
    state.command.pips = 4;
    press(state, 0);
    expect(nextLink(state)).toBe(1);
    press(state, 1);
    expect(ofType(state, 'cardFired').map((e) => [e.link, e.cost])).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });
});

describe('signature combos', () => {
  it('land inside one card, and across two cards of a chain, but not after the chain breaks', () => {
    const inside = quiet([cardOf(fallBack, focusNearest)]);
    press(inside, 0);
    expect(ofType(inside, 'combo')).toEqual([{ tick: 0, type: 'combo', side: 'player', combo: 'feignedRetreat', acrossCards: false }]);

    const across = quiet([cardOf(fallBack), cardOf(focusNearest)]);
    across.command.pips = 6;
    press(across, 0);
    press(across, 1);
    expect(ofType(across, 'combo')).toMatchObject([{ combo: 'feignedRetreat', acrossCards: true }]);

    const late = quiet([cardOf(fallBack), cardOf(focusNearest)]);
    late.command.pips = 6;
    press(late, 0);
    steps(late, secondsToTicks(COMMAND_RULES.chain.windowSeconds) + 1);
    press(late, 1);
    expect(ofType(late, 'combo')).toEqual([]);
  });

  it('add Momentum, and only exist from Rank III', () => {
    const state = quiet([cardOf(fallBack, focusNearest)]);
    const before = state.command.momentum;
    press(state, 0);
    expect(state.command.momentum - before).toBeGreaterThanOrEqual(COMBO_BONUSES.momentumGain);
    const low = quiet([cardOf(fallBack), cardOf(focusNearest)], 2);
    low.command.pips = 4;
    press(low, 0);
    press(low, 1);
    expect(ofType(low, 'combo')).toEqual([]);
  });

  it('Feigned Retreat: enemies chasing the retreating troops are slowed and take more damage', () => {
    // An enemy Vanguard right on top of your Vanguard, chasing it as it falls back.
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 345, y: 300 }, { cls: 'ranger', x: 900, y: 100 }], {
      cards: [cardOf(fallBack, focusNearest)],
    });
    press(state, 0);
    // The Focus starts once the retreat is over.
    steps(state, secondsToTicks(4));
    const chaser = theirs(state).find((u) => u.cls === 'vanguard')!;
    const farAway = theirs(state).find((u) => u.cls === 'ranger')!;
    expect(chaser.chased).toMatchObject({ slow: COMBO_BONUSES.feignedRetreat.slow, damageTakenBonus: COMBO_BONUSES.feignedRetreat.damageTakenBonus });
    expect(farAway.chased).toBeNull();
    expect(stepLength(chaser)).toBeCloseTo((UNIT_CLASSES.vanguard.stats.moveSpeed * (1 - COMBO_BONUSES.feignedRetreat.slow)) / 20, 5);
  });

  it('Ambush: the reserve arrives behind the focused enemy', () => {
    const callVanguard: Step = { action: 'callReserve', reserve: 'vanguard' };
    const focusRanger: Step = { action: 'focus', actors: all, target: { kind: 'class', cls: 'ranger' } };
    const state = battleWith(
      [{ cls: 'vanguard', x: 100, y: 300 }],
      [{ cls: 'ranger', x: 700, y: 300 }, { cls: 'vanguard', x: 900, y: 500 }],
      { cards: [cardOf(callVanguard, focusRanger)], reserves: ['vanguard'] },
    );
    state.command.pips = 6;
    press(state, 0);
    const reserve = state.units.at(-1)!;
    expect(reserve.side).toBe('player');
    // Past the enemy Ranger, on the far side from your army.
    expect(reserve.x).toBeGreaterThan(700);
    expect(Math.abs(reserve.y - 300)).toBeLessThan(40);
    expect(reserve.orders[0]).toMatchObject({ kind: 'focus' });

    const across = battleWith(
      [{ cls: 'vanguard', x: 100, y: 300 }],
      [{ cls: 'ranger', x: 700, y: 300 }],
      { cards: [cardOf(callVanguard), cardOf(focusRanger)], reserves: ['vanguard'] },
    );
    across.command.pips = 6;
    press(across, 0);
    expect(across.units.at(-1)!.x).toBeLessThan(200);
    press(across, 1);
    expect(across.units.at(-1)!.x).toBeGreaterThan(700);
  });

  it('Overload: the second Overcharge on the same troops fires at double power and costs them 20% HP', () => {
    const overcharge: Step = { action: 'overcharge', actors: vanguards };
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 335, y: 300 }], {
      cards: [cardOf(overcharge, overcharge)],
    });
    const vanguard = mine(state, 'vanguard');
    state.command.pips = 6;
    press(state, 0);
    const shoves = ofType(state, 'damage').filter((e) => e.cause === 'shove');
    expect(shoves).toHaveLength(2);
    expect(shoves[1]!.amount).toBeGreaterThan(shoves[0]!.amount);
    const cost = Math.round(vanguard.stats.maxHp * COMBO_BONUSES.overload.selfDamageShare);
    expect(ofType(state, 'damage').filter((e) => e.cause === 'overload')).toMatchObject([{ targetId: vanguard.id, amount: cost }]);
    // It never takes the troop's last point of HP.
    const weak = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 335, y: 300 }], {
      cards: [cardOf(overcharge, overcharge)],
    });
    mine(weak, 'vanguard').hp = 50;
    weak.command.pips = 6;
    press(weak, 0);
    expect(mine(weak, 'vanguard').hp).toBeGreaterThanOrEqual(1);
    expect(mine(weak, 'vanguard').alive).toBe(true);
  });

  it('Hammer and Anvil: the Shove after moving behind the enemy stuns them', () => {
    const behind: Step = { action: 'move', actors: vanguards, to: { kind: 'behindEnemies' } };
    const overcharge: Step = { action: 'overcharge', actors: vanguards };
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 335, y: 300 }], {
      cards: [cardOf(behind), cardOf(overcharge)],
    });
    state.command.pips = 6;
    press(state, 0);
    press(state, 1);
    expect(ofType(state, 'combo')).toMatchObject([{ combo: 'hammerAndAnvil' }]);
    const enemy = theirs(state)[0]!;
    expect(enemy.stunTicks).toBeGreaterThan(secondsToTicks(COMBO_BONUSES.hammerAndAnvil.stunSeconds));
    // A stunned troop does nothing, even after the push ends.
    while (enemy.knockback) stepBattle(state);
    const at = { x: enemy.x, y: enemy.y };
    steps(state, secondsToTicks(1));
    const hits = ofType(state, 'damage').filter((e) => e.sourceId === enemy.id && e.cause === 'attack');
    expect(hits).toEqual([]);
    expect(Math.abs(enemy.x - at.x)).toBeLessThan(5);
  });

  it('Iron Shell: held troops with a Barrier send 30% of each hit back', () => {
    const protect: Step = { action: 'protect', actors: all, target: { kind: 'class', cls: 'ranger' } };
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'ranger', x: 200, y: 300 },
      ],
      [{ cls: 'vanguard', x: 900, y: 300 }],
      { cards: [cardOf(protect, hold)] },
    );
    press(state, 0);
    // Let the Protect order run out so the Hold is the current order.
    steps(state, secondsToTicks(7));
    const vanguard = mine(state, 'vanguard');
    expect(vanguard.orders[0]).toMatchObject({ kind: 'hold', combo: 'ironShell' });
    const enemy = theirs(state)[0]!;
    vanguard.barrier = { amount: 500, ticksLeft: 100 };
    dealDamage(state, enemy.id, vanguard, 100, 0, 'attack');
    const reflected = ofType(state, 'damage').filter((e) => e.cause === 'reflect');
    expect(reflected).toHaveLength(1);
    expect(reflected[0]).toMatchObject({ sourceId: vanguard.id, targetId: enemy.id });
    // Without a Barrier, nothing comes back.
    vanguard.barrier = null;
    dealDamage(state, enemy.id, vanguard, 100, 0, 'attack');
    expect(ofType(state, 'damage').filter((e) => e.cause === 'reflect')).toHaveLength(1);
  });
});

describe('Finishers', () => {
  function chainThenUltimate(rank: RankNumber, cards: number): BattleState {
    const state = quiet([cardOf(hold), cardOf(fallBack)], rank);
    state.command.pips = 6;
    for (let i = 0; i < cards; i++) press(state, i);
    state.command.momentum = COMMAND_RULES.momentum.max;
    mine(state, 'vanguard').hp = 500;
    stepBattle(state, [{ tick: state.tick, kind: 'ultimate' }]);
    return state;
  }

  it('the ultimate as the 3rd link of a chain is 50% stronger, from Rank IV', () => {
    const state = chainThenUltimate(4, 2);
    const ultimate = ofType(state, 'ultimate')[0]!;
    expect(ultimate).toMatchObject({ link: 3, finisher: true });
    const vanguard = mine(state, 'vanguard');
    const power = 1 + COMMAND_RULES.finisher.powerBonus;
    expect(vanguard.hp).toBe(500 + Math.round(vanguard.stats.maxHp * ULTIMATES.rally.healShare * power));
    expect(vanguard.rallyBonus).toBeCloseTo(ULTIMATES.rally.attackSpeedBonus * power, 5);
  });

  it('needs a chain of 3 with the ultimate, and Rank IV', () => {
    expect(ofType(chainThenUltimate(4, 1), 'ultimate')[0]).toMatchObject({ link: 2, finisher: false });
    expect(ofType(chainThenUltimate(3, 2), 'ultimate')[0]).toMatchObject({ link: 3, finisher: false });
    const plain = chainThenUltimate(3, 2);
    expect(mine(plain, 'vanguard').rallyBonus).toBeCloseTo(ULTIMATES.rally.attackSpeedBonus, 5);
  });
});
