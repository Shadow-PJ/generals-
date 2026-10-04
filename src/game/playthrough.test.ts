// The campaign end to end, headless: a new save sets out into the first region, fights every
// battle it meets (troops on their own, no cards fired), takes the spoils, and goes on until the
// run ends; a won run recruits the ruler and keeps its fighters in the company. Session 5E's
// "done when": a new save can be played through the first region and its boss.

import { describe, expect, it } from 'vitest';
import { closeRun, chooseEvent, enterNode, eventChoiceProblem, finishFight, leaveStop, newRun, pickSpoils } from '../campaign/run';
import { nextChoices } from '../campaign/runMap';
import type { Campaign } from '../campaign/types';
import { emptyLoadout } from '../cards/types';
import { recruitedGenerals } from '../data/bosses';
import { STARTER_ARMY, STARTER_RESERVES } from '../data/armies';
import { MAPS } from '../data/maps';
import { EVENTS } from '../data/events';
import { newProfile } from '../save/profile';
import { runBattle } from '../sim';
import { battleIq } from './battleIq';
import { fightOutcome, fightSetup } from './campaignFlow';
import type { MatchSetup } from './match';
import { battleXp } from './progress';
import { enemyArmyOf, yourReserves } from './troops';

const base: MatchSetup = {
  placement: STARTER_ARMY.map((t) => ({ ...t })),
  loadout: emptyLoadout(),
  rank: 1,
  practiceRank: null,
  bossesBeaten: [],
  tactical: false,
  general: 'captain',
  reserves: [...STARTER_RESERVES],
  specs: {},
  map: 'openField',
  enemyArmy: 'starter',
  enemyGeneral: 'captain',
  enemyCommander: null,
  fight: null,
};

/** A new save's campaign, as the game loads it. */
function newSave(): Campaign {
  const { run, artifacts, bossesBeaten, company, insight, tech, ironman, mastery } = newProfile();
  return { run, artifacts, bossesBeaten, company, insight, tech, ironman, mastery };
}

/** Plays one run to its end: the first way on, the first offer, the first event choice that can be made. */
function playRun(start: Campaign, seed: number): Campaign {
  let c = newRun(start, 'deepForest', seed);
  for (let guard = 0; guard < 100; guard++) {
    const run = c.run!;
    const stop = run.stop;
    if (stop?.kind === 'end') return c;
    if (!stop) {
      c = enterNode(c, nextChoices(run)[0]!);
      continue;
    }
    switch (stop.kind) {
      case 'fight': {
        const setup = fightSetup(base, run, 1, c.tech)!;
        const enemy = enemyArmyOf(setup);
        const state = runBattle({
          seed: stop.encounter.seed,
          map: MAPS[setup.map],
          player: setup.placement,
          enemy: enemy.placement,
          reserves: { player: yourReserves(setup), enemy: enemy.reserves },
          enemyGeneral: enemy.general,
          enemyCommander: enemy.commander,
          boons: { player: setup.fight!.boons },
          tech: { player: setup.fight!.tech },
        });
        expect(battleIq(state).grade).toMatch(/[ABCD]/);
        c = finishFight(c, fightOutcome(state, battleXp(state.events, state.result!).total));
        break;
      }
      case 'spoils':
        c = pickSpoils(c, 0);
        break;
      case 'event': {
        const index = EVENTS[stop.event].choices.findIndex((_, i) => eventChoiceProblem(run, i) === null);
        c = stop.chosen === null ? chooseEvent(c, index) : leaveStop(c);
        break;
      }
      default:
        c = leaveStop(c);
    }
  }
  throw new Error('The run never ended');
}


describe('a new save', () => {
  it('plays through the first region to its boss; a win recruits the ruler and keeps the company', () => {
    let won: Campaign | null = null;
    let insight = 0;
    for (let seed = 1; seed <= 12 && !won; seed++) {
      const ended = playRun(newSave(), seed);
      const stop = ended.run!.stop;
      if (stop?.kind !== 'end') throw new Error('Not over');
      insight = Math.max(insight, ended.insight);
      if (stop.won) won = ended;
      // Win or lose, your company comes home (records and all), and nobody is lost without Ironman.
      const home = closeRun(ended);
      expect(home.company.length).toBeGreaterThan(0);
      expect(home.run).toBeNull();
    }
    expect(insight).toBeGreaterThan(0);
    expect(won).not.toBeNull();
    const home = closeRun(won!);
    expect(recruitedGenerals(home.bossesBeaten)).toContain('hiveMother');
    expect(home.company).toHaveLength(8);
    // The troops who fought every fight of the run carry them all on their record.
    expect(Math.max(...home.company.map((v) => v.record.battles))).toBe(won!.run!.fightsWon);
  });
});
