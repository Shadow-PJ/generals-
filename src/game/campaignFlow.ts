// Between the run and the battle screens: the setup a run's fight is played with, and what the
// finished battle means for the run's fighters. Pure functions, tested without the game running.

import { fieldPlacement, reserveTroops } from '../campaign/army';
import type { FightOutcome } from '../campaign/run';
import { techChoice, techSpecs } from '../campaign/tech';
import type { RunState, TechWeb } from '../campaign/types';
import { isBoss, type BossId } from '../data/bosses';
import { MAPS } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import { INSIGHT } from '../data/tech';
import type { BattleState } from '../sim';
import type { MatchSetup } from './match';

/**
 * The fight waiting at your run's node, set up for the Prep, Orders and Battle screens: your
 * fielded fighters where they stood last, your reserve fighters and boons, on the region's map,
 * at the rank you have earned, with your Tech Web's specializations and nodes. Your cards and
 * General come from `base`.
 */
export function fightSetup(base: MatchSetup, run: RunState, earned: RankNumber, web: TechWeb = {}): MatchSetup | null {
  if (run.stop?.kind !== 'fight') return null;
  const encounter = run.stop.encounter;
  return {
    ...base,
    placement: fieldPlacement(run, MAPS[encounter.map]),
    rank: earned,
    practiceRank: null,
    map: encounter.map,
    specs: techSpecs(web),
    fight: { encounter, reserves: reserveTroops(run), boons: [...run.boons], tech: techChoice(web) },
  };
}

/** The ruler the enemy is, when the fight is a run's boss fight. */
export function bossOf(setup: MatchSetup): BossId | undefined {
  const e = setup.fight?.encounter;
  return e?.kind === 'boss' && isBoss(e.general) ? e.general : undefined;
}

/** How the battle went for each of your run's fighters who took the field, and the Insight it earned. */
export function fightOutcome(state: BattleState, xp: number): FightOutcome {
  const kills = new Map<number, number>();
  for (const e of state.events) {
    if (e.type !== 'death' || e.killerId === null) continue;
    const killer = state.units.find((u) => u.id === e.killerId);
    const victim = state.units.find((u) => u.id === e.unitId);
    if (killer?.side === 'player' && victim?.side === 'enemy' && killer.fighterId !== null) kills.set(killer.fighterId, (kills.get(killer.fighterId) ?? 0) + 1);
  }
  const fighters = state.units
    .filter((u) => u.side === 'player' && u.fighterId !== null)
    .map((u) => ({ id: u.fighterId!, hp: u.alive && u.hp > 0 ? u.hp / u.stats.maxHp : null, kills: kills.get(u.fighterId!) ?? 0 }));
  const winner = state.result?.winner;
  const insight = INSIGHT[winner === 'player' ? 'win' : winner === 'draw' ? 'draw' : 'loss'];
  return { won: winner === 'player', fighters, xp, insight };
}
