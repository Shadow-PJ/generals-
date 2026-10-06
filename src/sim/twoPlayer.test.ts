import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../data/armies';
import { COMMAND_RULES } from '../data/command';
import { MAPS } from '../data/maps';
import { createBattle, stepBattle } from './battle';
import { slotReadiness } from './command';
import { stateHash } from './hash';
import { cardOf } from './testing/fixtures';
import type { BattleInput, BattleSetup, BattleState } from './types';

const hold: Card = cardOf({ action: 'hold', actors: { kind: 'all' } });

/** Two players: you on the left, the other player as the enemy commander, each with a Hold card in slot 1. */
function versus(human = true, seed = 7): BattleSetup {
  return {
    seed,
    map: MAPS.openField,
    player: STARTER_ARMY,
    enemy: STARTER_ARMY_MIRRORED,
    loadout: { slots: [hold], legendary: null },
    rank: 3,
    enemyGeneral: 'warlord',
    enemyCommander: { rank: 3, loadout: { slots: [hold], legendary: null }, human },
  };
}

/** Runs a battle for `ticks`, with these inputs on their ticks. */
function play(setup: BattleSetup, inputs: readonly BattleInput[], ticks: number): BattleState {
  const state = createBattle(setup);
  for (let t = 0; t < ticks && !state.result; t++) stepBattle(state, inputs.filter((i) => i.tick === state.tick));
  return state;
}

describe('two-player battles', () => {
  it('fire the other player’s cards only by their inputs, on the enemy’s side', () => {
    const state = play(versus(), [{ tick: 5, kind: 'slot', slot: 0, side: 'enemy' }], 6);
    const fired = state.events.filter((e) => e.type === 'cardFired');
    expect(fired).toEqual([expect.objectContaining({ side: 'enemy', slot: 0, auto: false })]);
    expect(slotReadiness(state, 0, state.enemyCommand!)).toBe('resting');
    expect(slotReadiness(state, 0)).toBe('ready');
  });

  it('ignore inputs for an enemy that is a script, not a player', () => {
    const state = play(versus(false), [{ tick: 5, kind: 'slot', slot: 0, side: 'enemy' }], 6);
    expect(state.events.some((e) => e.type === 'cardFired')).toBe(false);
    expect(state.inputLog).toEqual([]);
  });

  it('never fire a player’s ultimate for them, but a scripted commander fires its own', () => {
    for (const human of [true, false]) {
      // The Captain's Rally always has troops to rally.
      const state = createBattle({ ...versus(human), enemyGeneral: 'captain' });
      state.enemyCommand!.momentum = COMMAND_RULES.momentum.max;
      for (let t = 0; t < 400 && !state.result; t++) stepBattle(state);
      const fired = state.events.some((e) => e.type === 'ultimate' && e.side === 'enemy');
      expect(fired, human ? 'a player' : 'a script').toBe(!human);
    }
  });

  it('open the other player’s Legendary slot with the actions they learned', () => {
    const fortify = cardOf({ action: 'fortify', at: { kind: 'forward' } });
    const setup = versus();
    setup.enemyCommander = { rank: 5, loadout: { slots: [], legendary: fortify }, human: true, learned: ['fortify'] };
    const state = createBattle(setup);
    expect(state.enemyCommand!.legendaryOpen).toBe(true);
    expect(state.enemyCommand!.slots[4]!.card).not.toBeNull();
  });

  it('agree on a fingerprint when played with the same inputs, and differ when not', () => {
    const inputs: BattleInput[] = [
      { tick: 3, kind: 'slot', slot: 0 },
      { tick: 3, kind: 'slot', slot: 0, side: 'enemy' },
    ];
    const a = play(versus(), inputs, 200);
    const b = play(versus(), inputs, 200);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(stateHash(play(versus(), inputs.slice(0, 1), 200))).not.toBe(stateHash(a));
    expect(stateHash(play(versus(true, 8), inputs, 200))).not.toBe(stateHash(a));
    // The input log, both sides' keys in order, replays the battle exactly.
    const replay = play(versus(), a.inputLog, 200);
    expect(stateHash(replay)).toBe(stateHash(a));
  });
});
