import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../data/armies';
import { GENERAL_IDS } from '../data/generals';
import { OPEN_FIELD } from '../data/maps';
import { runBattle, stepBattle } from './battle';
import { battleWith, cardOf } from './testing/fixtures';
import type { BattleState } from './types';

const fallBack = cardOf({ action: 'fallBack', actors: { kind: 'all' }, to: null });
const moveForward = cardOf({ action: 'move', actors: { kind: 'all' }, to: { kind: 'forward' } });

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

describe('the General in battle', () => {
  it('fires the General’s version of each card', () => {
    const state = quiet([fallBack], { general: 'warlord', rank: 1 });
    expect(state.command.slots[0]!.card!.steps).toEqual([
      { action: 'fallBack', actors: { kind: 'all' }, to: null },
      { action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' }, byGeneral: true },
    ]);
  });

  it('checks your card with the validator first; the General’s steps skip the step limit and rank', () => {
    // Rank I allows 1 step and no Hold, yet the Engineer's Hold before your Move stays.
    const state = quiet([moveForward], { general: 'engineer', rank: 1 });
    expect(state.command.slots[0]!.card!.steps.map((s) => s.action)).toEqual(['hold', 'move']);
    // A card you wrote that your rank doesn't allow is still left out, whoever your General is.
    const tooLong = cardOf(moveForward.steps[0]!, fallBack.steps[0]!);
    expect(quiet([tooLong], { general: 'hiveMother', rank: 1 }).command.slots[0]!.card).toBeNull();
  });

  it('makes you pay for the General’s steps', () => {
    const state = quiet([fallBack], { general: 'warlord', rank: 1 });
    expect(state.command.pips).toBe(2);
    stepBattle(state, [{ tick: state.tick, kind: 'slot', slot: 0 }]);
    expect(state.events.some((e) => e.type === 'cardFired')).toBe(true);
    expect(state.command.pips).toBe(0);
    // Your troops fall back, then counter-attack.
    const vanguard = state.units.find((u) => u.side === 'player' && u.cls === 'vanguard')!;
    expect(vanguard.orders.map((o) => o.kind)).toEqual(['fallBack', 'focus']);
  });

  it('uses the Captain when no General is given', () => {
    expect(quiet([fallBack], { rank: 1 }).command.slots[0]!.card).toEqual(fallBack);
  });

  it('leaves a battle without cards exactly the same for every General', () => {
    const setup = { seed: 42, map: OPEN_FIELD, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED };
    const plain = runBattle(setup).result;
    for (const general of GENERAL_IDS) expect(runBattle({ ...setup, general }).result).toEqual(plain);
  });

  it('replays exactly with a General’s cards', () => {
    const setup = {
      seed: 7,
      map: OPEN_FIELD,
      player: STARTER_ARMY,
      enemy: STARTER_ARMY_MIRRORED,
      rank: 3 as const,
      general: 'warlord' as const,
      loadout: { slots: [fallBack, null, null, null], legendary: null },
    };
    const inputs = [{ tick: 400, kind: 'slot' as const, slot: 0 }];
    const first = runBattle(setup, inputs);
    const second = runBattle(setup, inputs);
    expect(second.result).toEqual(first.result);
    expect(second.events).toEqual(first.events);
    expect(first.events.some((e) => e.type === 'cardFired')).toBe(true);
  });
});
