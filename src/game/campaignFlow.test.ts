import { describe, expect, it } from 'vitest';
import { withRole } from '../campaign/army';
import { enterNode, newRun } from '../campaign/run';
import { emptyLoadout } from '../cards/types';
import { STARTER_ARMY, STARTER_RESERVES } from '../data/armies';
import { MAPS } from '../data/maps';
import { createBattle, isArmyPlaced, stepBattle } from '../sim';
import { fightOutcome, fightSetup } from './campaignFlow';
import type { MatchSetup } from './match';
import { enemyArmyOf, yourReserves } from './troops';

const base: MatchSetup = {
  placement: STARTER_ARMY.map((t) => ({ ...t })),
  loadout: emptyLoadout(),
  rank: 5,
  practiceRank: 5,
  bossesBeaten: [],
  tactical: false,
  general: 'warlord',
  reserves: [...STARTER_RESERVES],
  specs: { vanguard: 'bulwark' },
  map: 'openField',
  enemyArmy: 'mirror',
  enemyGeneral: 'captain',
  enemyCommander: 4,
  fight: null,
};

const atFight = () => {
  const campaign = enterNode(newRun({ run: null, artifacts: [], bossesBeaten: [] }, 'deepForest', 21), 0);
  return withRole({ ...campaign.run!, boons: ['whetstones'] }, 7, 'rest');
};

describe('a run’s fight on the battle screens', () => {
  it('fields your run’s fighters at your earned rank, on the region’s map, against the node’s enemy', () => {
    const run = atFight();
    const setup = fightSetup(base, run, 2)!;
    expect(setup).toMatchObject({ rank: 2, practiceRank: null, map: 'deepForest', general: 'warlord', specs: { vanguard: 'bulwark' } });
    expect(setup.placement.map((t) => t.fighterId)).toEqual(run.field);
    expect(isArmyPlaced(MAPS.deepForest, 'player', setup.placement)).toBe(true);
    expect(yourReserves(setup).map((t) => t.fighterId)).toEqual([6, 8]);
    expect(setup.fight!.boons).toEqual(['whetstones']);
    const enemy = enemyArmyOf(setup);
    const encounter = setup.fight!.encounter;
    expect(enemy).toMatchObject({ general: 'hiveMother', commander: undefined, specs: {} });
    expect(enemy.placement).toEqual(encounter.troops);
    expect(fightSetup(base, { ...run, stop: null }, 2)).toBeNull();
  });

  it('tells the run how each fighter came out of the battle', () => {
    const setup = fightSetup(base, atFight(), 1)!;
    const enemy = enemyArmyOf(setup);
    const state = createBattle({
      seed: setup.fight!.encounter.seed,
      map: MAPS[setup.map],
      player: setup.placement,
      enemy: enemy.placement,
      reserves: { player: yourReserves(setup), enemy: enemy.reserves },
      boons: { player: setup.fight!.boons },
    });
    while (!state.result) stepBattle(state);
    const outcome = fightOutcome(state, 60);
    expect(outcome.won).toBe(state.result.winner === 'player');
    expect(outcome.xp).toBe(60);
    for (const f of outcome.fighters) {
      const unit = state.units.find((u) => u.fighterId === f.id)!;
      expect(f.hp).toBe(unit.alive ? unit.hp / unit.stats.maxHp : null);
    }
    expect(outcome.fighters.map((f) => f.id)).toEqual(expect.arrayContaining(setup.placement.map((t) => t.fighterId!)));
  });
});
