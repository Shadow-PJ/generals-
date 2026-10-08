import { describe, expect, it } from 'vitest';
import { runBattle, type BattleInput } from '../sim';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED, STARTER_ORDERS } from './armies';
import { MAPS } from './maps';

/** How many of these seeds you win in the starter mirror match, pressing these slots every 2 s. */
function wins(slots: number[], seeds: number): number {
  let won = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const inputs: BattleInput[] = [];
    for (let tick = 40; tick < 20 * 180; tick += 40) for (const slot of slots) inputs.push({ tick, kind: 'slot', slot });
    const loadout = { slots: [...STARTER_ORDERS, null, null], legendary: null };
    const state = runBattle({ seed, map: MAPS.openField, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED, rank: 1, loadout }, inputs);
    if (state.result?.winner === 'player') won++;
  }
  return won;
}

describe('the starter orders (session 7E)', () => {
  it('help a new player who presses them whenever they are ready, rather than hurt', () => {
    const seeds = 20;
    // Together they win the mirror match more often than no cards at all.
    expect(wins([0, 1], seeds)).toBeGreaterThan(wins([], seeds));
    // Neither loses it alone: "Rangers fall back", once a starter order, lost every battle pressed like this.
    for (const slot of [0, 1]) expect(wins([slot], seeds)).toBeGreaterThanOrEqual(seeds * 0.4);
  }, 30_000);
});
