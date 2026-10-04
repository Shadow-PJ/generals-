// Between the run and the battle screens: the setup a run's fight is played with, and what the
// finished battle means for the run's fighters. Pure functions, tested without the game running.

import { fieldPlacement, reserveTroops } from '../campaign/army';
import type { FightOutcome } from '../campaign/run';
import type { RunState } from '../campaign/types';
import { isBoss, type BossId } from '../data/bosses';
import { MAPS } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import type { BattleState } from '../sim';
import type { MatchSetup } from './match';

/**
 * The fight waiting at your run's node, set up for the Prep, Orders and Battle screens: your
 * fielded fighters where they stood last, your reserve fighters and boons, on the region's map,
 * at the rank you have earned. Your cards, General and specializations come from `base`.
 */
export function fightSetup(base: MatchSetup, run: RunState, earned: RankNumber): MatchSetup | null {
  if (run.stop?.kind !== 'fight') return null;
  const encounter = run.stop.encounter;
  return {
    ...base,
    placement: fieldPlacement(run, MAPS[encounter.map]),
    rank: earned,
    practiceRank: null,
    map: encounter.map,
    fight: { encounter, reserves: reserveTroops(run), boons: [...run.boons] },
  };
}

/** The ruler the enemy is, when the fight is a run's boss fight. */
export function bossOf(setup: MatchSetup): BossId | undefined {
  const e = setup.fight?.encounter;
  return e?.kind === 'boss' && isBoss(e.general) ? e.general : undefined;
}

/** How the battle went for each of your run's fighters who took the field. */
export function fightOutcome(state: BattleState, xp: number): FightOutcome {
  const fighters = state.units
    .filter((u) => u.side === 'player' && u.fighterId !== null)
    .map((u) => ({ id: u.fighterId!, hp: u.alive && u.hp > 0 ? u.hp / u.stats.maxHp : null }));
  return { won: state.result?.winner === 'player', fighters, xp };
}
