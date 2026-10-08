import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { INSIGHT } from '../data/tech';
import { newCampaign } from '../campaign/company';
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
  const campaign = enterNode(newRun(newCampaign(), 'deepForest', 21), 0);
  return withRole({ ...campaign.run!, boons: ['whetstones'] }, 7, 'rest');
};

describe('a run’s fight on the battle screens', () => {
  it('fields your run’s fighters at your earned rank, on the region’s map, against the node’s enemy', () => {
    const run = atFight();
    const setup = fightSetup(base, run, 2)!;
    // Campaign fights take their specializations from your Tech Web, not from the Skirmish screen.
    expect(setup).toMatchObject({ rank: 2, practiceRank: null, map: 'deepForest', general: 'warlord', specs: {} });
    const webbed = fightSetup(base, run, 2, { ranger: { nodes: ['arms'], spec: 'sniper' } })!;
    expect(webbed.specs).toEqual({ ranger: 'sniper' });
    expect(webbed.fight!.tech).toEqual({ ranger: ['arms'] });
    expect(setup.placement.map((t) => t.fighterId)).toEqual(run.field);
    expect(isArmyPlaced(MAPS.deepForest, 'player', setup.placement)).toBe(true);
    expect(yourReserves(setup).map((t) => t.fighterId)).toEqual([6, 8]);
    expect(setup.fight!.boons).toEqual(['whetstones']);
    const enemy = enemyArmyOf(setup);
    const encounter = setup.fight!.encounter;
    expect(enemy).toMatchObject({ general: 'hiveMother', commander: undefined, specs: {} });
    expect(enemy.placement).toEqual(encounter.troops);
    expect(fightSetup(base, { ...run, stop: null }, 2)).toBeNull();
    expect(setup.fight!.decree).toBeNull();
  });

  it('brings the run’s decree into the battle (session 7D)', () => {
    const decree: Card = {
      condition: { triggers: [{ kind: 'allyBelowHp', ally: 'any', hpPercent: 40 }], repeat: false },
      steps: [{ action: 'hold', actors: { kind: 'all' } }],
      auto: true,
    };
    expect(fightSetup(base, { ...atFight(), decree }, 3)!.fight!.decree).toEqual(decree);
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
    expect(outcome.insight).toBe(INSIGHT[state.result.winner === 'player' ? 'win' : state.result.winner === 'draw' ? 'draw' : 'loss']);
    for (const f of outcome.fighters) {
      const unit = state.units.find((u) => u.fighterId === f.id)!;
      expect(f.hp).toBe(unit.alive ? unit.hp / unit.stats.maxHp : null);
      // Its kills: the enemies whose death the log puts on it.
      const kills = state.events.filter((e) => e.type === 'death' && e.killerId === unit.id && state.units.find((u) => u.id === e.unitId)!.side === 'enemy');
      expect(f.kills).toBe(kills.length);
    }
    expect(outcome.fighters.reduce((sum, f) => sum + (f.kills ?? 0), 0)).toBeGreaterThan(0);
    expect(outcome.fighters.map((f) => f.id)).toEqual(expect.arrayContaining(setup.placement.map((t) => t.fighterId!)));
  });
});
