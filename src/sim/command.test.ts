import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { COMMAND_RULES, ULTIMATES } from '../data/command';
import { stepBattle } from './battle';
import { slotReadiness, ultimateReady } from './command';
import { battleWith, cardOf } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleState } from './types';

const hold = cardOf({ action: 'hold', actors: { kind: 'all' } });
const hurtRanger: Card = {
  condition: { triggers: [{ kind: 'allyBelowHp', ally: 'ranger', hpPercent: 50 }], repeat: false },
  steps: [{ action: 'protect', actors: { kind: 'class', cls: 'vanguard' }, target: { kind: 'trigger' } }],
  auto: false,
};

/** Your Vanguard and Ranger far from one enemy Vanguard, so nothing fights for a while. */
function quiet(cards: (Card | null)[], options: Parameters<typeof battleWith>[2] = {}): BattleState {
  return battleWith(
    [
      { cls: 'vanguard', x: 100, y: 300 },
      { cls: 'ranger', x: 60, y: 200 },
    ],
    [{ cls: 'vanguard', x: 950, y: 300 }],
    { cards, ...options },
  );
}

function steps(state: BattleState, n: number): void {
  for (let i = 0; i < n; i++) stepBattle(state);
}

function press(state: BattleState, slot: number): void {
  stepBattle(state, [{ tick: state.tick, kind: 'slot', slot }]);
}

const fired = (state: BattleState) => state.events.filter((e) => e.type === 'cardFired');

describe('Command pips', () => {
  it('start at 2, with the max set by rank', () => {
    expect(quiet([], { rank: 1 }).command).toMatchObject({ pips: 2, maxPips: 4 });
    expect(quiet([], { rank: 5 }).command).toMatchObject({ pips: 2, maxPips: 6 });
  });

  it('refill one every 6 seconds, and a full bar wastes them', () => {
    const state = quiet([], { rank: 1 });
    steps(state, secondsToTicks(COMMAND_RULES.pipRefillSeconds));
    expect(state.command.pips).toBe(3);
    steps(state, secondsToTicks(60));
    expect(state.command.pips).toBe(4);
  });

  it('refill twice as fast once you have lost half your troops', () => {
    const state = quiet([]);
    state.units.find((u) => u.cls === 'ranger')!.hp = 0;
    stepBattle(state);
    steps(state, secondsToTicks(3));
    expect(state.command.pips).toBe(3);
  });
});

describe('firing cards', () => {
  it('costs pips and rests the slot for 8 seconds', () => {
    const state = quiet([hold]);
    press(state, 0);
    expect(fired(state)).toEqual([expect.objectContaining({ slot: 0, auto: false, perfect: false, cost: 1 })]);
    expect(state.command.pips).toBe(1);
    expect(slotReadiness(state, 0)).toBe('resting');
    press(state, 0);
    expect(fired(state)).toHaveLength(1);
    steps(state, secondsToTicks(COMMAND_RULES.slotRestSeconds));
    expect(slotReadiness(state, 0)).toBe('ready');
  });

  it('needs enough pips', () => {
    const state = quiet([cardOf({ action: 'overcharge', actors: { kind: 'all' } }, { action: 'callReserve', reserve: null })]);
    expect(slotReadiness(state, 0)).toBe('noPips');
    press(state, 0);
    expect(fired(state)).toHaveLength(0);
  });

  it('only lets a card with a condition fire while it glows', () => {
    const state = quiet([hurtRanger]);
    expect(slotReadiness(state, 0)).toBe('waiting');
    press(state, 0);
    expect(fired(state)).toHaveLength(0);
    state.units.find((u) => u.cls === 'ranger')!.hp = 100;
    stepBattle(state);
    expect(state.command.slots[0]!.glowing).toBe(true);
    expect(slotReadiness(state, 0)).toBe('ready');
  });

  it('makes a manual press during the glow a Perfect timing: +25% effect, a pip back and Momentum', () => {
    const state = quiet([hurtRanger]);
    const ranger = state.units.find((u) => u.cls === 'ranger')!;
    ranger.hp = 100;
    stepBattle(state);
    const momentum = state.command.momentum;
    press(state, 0);
    expect(fired(state)).toEqual([expect.objectContaining({ perfect: true })]);
    expect(state.command.pips).toBe(2); // paid 1, got 1 back
    expect(state.command.momentum).toBeGreaterThanOrEqual(momentum + COMMAND_RULES.momentum.perfectGain);
    const vanguard = state.units.find((u) => u.cls === 'vanguard' && u.side === 'player')!;
    expect(vanguard.orders[0]).toMatchObject({ kind: 'protect', power: 1 + COMMAND_RULES.perfect.effectBonus, unitId: ranger.id });
  });

  it('gives no Perfect timing in Tactical mode', () => {
    const state = quiet([hurtRanger], { tactical: true });
    state.units.find((u) => u.cls === 'ranger')!.hp = 100;
    stepBattle(state);
    press(state, 0);
    expect(fired(state)).toEqual([expect.objectContaining({ perfect: false })]);
  });

  it('keeps glowing a moment after the condition ends', () => {
    const state = quiet([hurtRanger]);
    const ranger = state.units.find((u) => u.cls === 'ranger')!;
    ranger.hp = 100;
    stepBattle(state);
    ranger.hp = ranger.stats.maxHp;
    steps(state, secondsToTicks(COMMAND_RULES.glowLingerSeconds) - 1);
    expect(state.command.slots[0]!.glowing).toBe(true);
    steps(state, 2);
    expect(state.command.slots[0]!.glowing).toBe(false);
  });

  it('fires an Auto "when" card by itself once per battle', () => {
    const state = quiet([{ ...hurtRanger, auto: true }]);
    const ranger = state.units.find((u) => u.cls === 'ranger')!;
    ranger.hp = 100;
    stepBattle(state);
    expect(fired(state)).toEqual([expect.objectContaining({ auto: true, perfect: false })]);
    // The condition goes away and comes back after the rest: a "when" card stays quiet.
    ranger.hp = ranger.stats.maxHp;
    steps(state, secondsToTicks(10));
    ranger.hp = 100;
    steps(state, 2);
    expect(fired(state)).toHaveLength(1);
  });

  it('fires a repeating Auto card each time the condition returns, at least 10 seconds apart', () => {
    const repeating: Card = { ...hurtRanger, auto: true, condition: { ...hurtRanger.condition!, repeat: true } };
    const state = quiet([repeating]);
    const ranger = state.units.find((u) => u.cls === 'ranger')!;
    ranger.hp = 100;
    stepBattle(state);
    expect(fired(state)).toHaveLength(1);
    // Still hurt: it waits for the condition to return.
    steps(state, secondsToTicks(12));
    expect(fired(state)).toHaveLength(1);
    ranger.hp = ranger.stats.maxHp;
    steps(state, secondsToTicks(3));
    ranger.hp = 100;
    steps(state, 2);
    expect(fired(state)).toHaveLength(2);
  });

  it('leaves out cards your rank does not allow, cards in locked slots, and the Legendary slot', () => {
    const focus = cardOf({ action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' } });
    const twoSteps = cardOf(focus.steps[0]!, focus.steps[0]!);
    const state = quiet([twoSteps, focus, focus, focus], { rank: 1 });
    expect(state.command.slots.map((s) => s.card !== null)).toEqual([false, true, false, false, false]);
    expect(slotReadiness(state, 2)).toBe('locked');
    expect(slotReadiness(state, 4)).toBe('locked');
  });

  it('ignores inputs stamped for another tick, and logs the ones it applies', () => {
    const state = quiet([hold]);
    stepBattle(state, [{ tick: state.tick + 5, kind: 'slot', slot: 0 }]);
    expect(fired(state)).toHaveLength(0);
    expect(state.inputLog).toEqual([]);
    const tick = state.tick;
    press(state, 0);
    expect(state.inputLog).toEqual([{ tick, kind: 'slot', slot: 0 }]);
  });
});

describe('Momentum and Rally', () => {
  it('fills on its own and the ultimate needs a full bar', () => {
    // A wall across the map keeps two Vanguards apart, so the battle lasts.
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 700, y: 300 }], {
      walls: [{ x: 480, y: 0, w: 40, h: 600 }],
    });
    stepBattle(state, [{ tick: 0, kind: 'ultimate' }]);
    expect(state.events.some((e) => e.type === 'ultimate')).toBe(false);
    const seconds = COMMAND_RULES.momentum.max / COMMAND_RULES.momentum.passivePerSecond;
    steps(state, secondsToTicks(seconds) + 1);
    expect(ultimateReady(state)).toBe(true);
  });

  it('Rally heals every troop 20% and speeds up their attacks for 5 seconds, then the bar empties', () => {
    const state = quiet([]);
    state.command.momentum = COMMAND_RULES.momentum.max;
    const vanguard = state.units.find((u) => u.cls === 'vanguard' && u.side === 'player')!;
    vanguard.hp = 500;
    stepBattle(state, [{ tick: 0, kind: 'ultimate' }]);
    expect(vanguard.hp).toBe(500 + Math.round(vanguard.stats.maxHp * ULTIMATES.rally.healShare));
    expect(vanguard.rallyTicks).toBe(secondsToTicks(ULTIMATES.rally.durationSeconds) - 1);
    expect(state.command.momentum).toBeLessThan(1);
    expect(state.events).toContainEqual({ tick: 0, type: 'ultimate', side: 'player', name: 'rally' });
  });
});
