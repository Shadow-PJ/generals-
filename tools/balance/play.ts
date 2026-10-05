// Playing the balance script's battles: headless, both sides' Auto cards firing by themselves,
// and the player side firing its ultimate as soon as it is ready, as the enemy commander does.

import { createBattle, stepBattle, ultimateReady, type BattleSetup, type BattleState } from '../../src/sim';
import type { Matchup } from './matchups';

/** A whole battle; with `ultimate`, the player side presses U the moment its ultimate is ready. */
export function autoBattle(setup: BattleSetup, ultimate: boolean): BattleState {
  const state = createBattle(setup);
  while (!state.result) stepBattle(state, ultimate && ultimateReady(state) ? [{ tick: state.tick, kind: 'ultimate' }] : []);
  return state;
}

/** How a matchup's battles went for side A. */
export interface Tally {
  wins: number;
  losses: number;
  draws: number;
  /** All battles' lengths added up, in ticks. */
  ticks: number;
  /** All battles' HP edges added up: A's share of its HP left, minus B's. How big the wins are. */
  edge: number;
}

export const EMPTY_TALLY: Tally = { wins: 0, losses: 0, draws: 0, ticks: 0, edge: 0 };

/** The share of its troops' total HP a side has left; troops that joined later count too. */
export function hpLeft(state: BattleState, side: 'player' | 'enemy'): number {
  let hp = 0;
  let max = 0;
  for (const u of state.units) {
    if (u.side !== side) continue;
    max += u.stats.maxHp;
    if (u.alive) hp += u.hp;
  }
  return max === 0 ? 0 : hp / max;
}

/** Plays the matchup on these seeds. On odd seeds a mirror matchup puts A on the enemy side. */
export function playMatchup(matchup: Matchup, seeds: readonly number[]): Tally {
  const tally = { ...EMPTY_TALLY };
  for (const seed of seeds) {
    const aIsPlayer = !matchup.swap || seed % 2 === 0;
    const state = autoBattle(matchup.setup(seed, aIsPlayer), matchup.playerUltimate);
    const winner = state.result!.winner;
    const aSide = aIsPlayer ? 'player' : 'enemy';
    if (winner === 'draw') tally.draws++;
    else if (winner === aSide) tally.wins++;
    else tally.losses++;
    tally.ticks += state.result!.durationTicks;
    tally.edge += hpLeft(state, aSide) - hpLeft(state, aIsPlayer ? 'enemy' : 'player');
  }
  return tally;
}

export function addTallies(a: Tally, b: Tally): Tally {
  return { wins: a.wins + b.wins, losses: a.losses + b.losses, draws: a.draws + b.draws, ticks: a.ticks + b.ticks, edge: a.edge + b.edge };
}

export function battlesIn(t: Tally): number {
  return t.wins + t.losses + t.draws;
}

/** A's win rate, a draw counting half. */
export function winRate(t: Tally): number {
  const n = battlesIn(t);
  return n === 0 ? 0 : (t.wins + t.draws / 2) / n;
}
