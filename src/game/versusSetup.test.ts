import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { STARTER_ARMY, STARTER_RESERVES } from '../data/armies';
import { MAPS } from '../data/maps';
import { isArmyPlaced } from '../sim';
import { armyProblems } from '../versus/army';
import type { MatchSetup } from './match';
import { versusArmy, versusSetup, yourArmyProblems } from './versusSetup';

const focus: Card = { condition: null, steps: [{ action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' } }], auto: false };

function saved(change: Partial<MatchSetup> = {}): MatchSetup {
  return {
    placement: STARTER_ARMY.map((t) => ({ ...t })),
    loadout: { slots: [focus, null, null, null], legendary: null },
    rank: 2,
    bossesBeaten: [],
    practiceRank: 4,
    tactical: true,
    general: 'captain',
    reserves: [...STARTER_RESERVES],
    specs: {},
    map: 'openField',
    enemyArmy: 'starter',
    enemyGeneral: 'warlord',
    enemyCommander: 3,
    fight: null,
    returnTo: 'Capital',
    ...change,
  };
}

describe('your side of a versus match', () => {
  it('takes your skirmish army and cards onto the match’s map, at its rank, with no practice or Tactical mode', () => {
    const setup = versusSetup(saved(), { map: 'redCanyon', rank: 3 });
    expect(setup.versus).toEqual({ map: 'redCanyon', rank: 3 });
    expect(setup.map).toBe('redCanyon');
    expect(setup.rank).toBe(3);
    expect(setup.practiceRank).toBeNull();
    expect(setup.tactical).toBe(false);
    expect(setup.returnTo).toBeUndefined();
    expect(setup.loadout.slots[0]).toEqual(focus);
    expect(isArmyPlaced(MAPS.redCanyon, 'player', setup.placement)).toBe(true);
  });

  it('moves troops that don’t fit the map back to the starting spots, keeping their classes', () => {
    const odd = STARTER_ARMY.map((t, i) => (i === 0 ? { ...t, cls: 'guardian' as const, x: 900 } : { ...t }));
    const setup = versusSetup(saved({ placement: odd }), { map: 'openField', rank: 3 });
    expect(setup.placement.map((t) => t.cls)).toEqual(odd.map((t) => t.cls));
    expect(isArmyPlaced(MAPS.openField, 'player', setup.placement)).toBe(true);
  });

  it('sends an army the other game accepts, and says what stops yours in your words', () => {
    const setup = versusSetup(saved(), { map: 'openField', rank: 3 });
    expect(armyProblems(versusArmy(setup), setup.versus!)).toEqual([]);
    expect(yourArmyProblems(setup)).toEqual([]);
    const auto: Card = { ...focus, auto: true, condition: { triggers: [{ kind: 'enemiesGrouped', count: 3 }], repeat: false } };
    const atRankOne = versusSetup(saved({ loadout: { slots: [auto], legendary: null } }), { map: 'openField', rank: 1 });
    expect(yourArmyProblems(atRankOne)[0]).toMatch(/^Your card 1 /);
    expect(yourArmyProblems(saved())).toEqual([]);
  });
});
