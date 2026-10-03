import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '../cards/types';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED, STARTER_RESERVES } from '../data/armies';
import { OPEN_FIELD } from '../data/maps';
import { isArmyPlaced } from '../sim';
import type { MatchSetup } from './match';
import { cycle, enemyArmyOf, nextClass, specOptions, withClass, withSpec, yourSynergies } from './troops';

function setup(change: Partial<MatchSetup> = {}): MatchSetup {
  return {
    placement: STARTER_ARMY.map((t) => ({ ...t })),
    loadout: emptyLoadout(),
    rank: 3,
    tactical: false,
    general: 'captain',
    reserves: [...STARTER_RESERVES],
    specs: {},
    enemyArmy: 'starter',
    ...change,
  };
}

describe('your army on the debug Troops screen', () => {
  it('cycles through the five classes, both ways', () => {
    expect(nextClass('vanguard', 1)).toBe('ranger');
    expect(nextClass('assassin', 1)).toBe('vanguard');
    expect(nextClass('vanguard', -1)).toBe('assassin');
    expect(cycle([1, 2, 3], 3, 1)).toBe(1);
  });

  it('changes a troop’s class where it stands, or sends it back to its starting spot if it no longer fits', () => {
    const changed = withClass(STARTER_ARMY, 2, 'invoker');
    expect(changed[2]).toEqual({ ...STARTER_ARMY[2], cls: 'invoker' });
    expect(STARTER_ARMY[2]!.cls).toBe('ranger');
    // A small troop pressed against the zone's edge: a bigger class would stick out, so it moves back.
    const edge = STARTER_ARMY.map((t, i) => (i === 2 ? { cls: 'ranger' as const, x: 50, y: 190 } : { ...t }));
    expect(isArmyPlaced(OPEN_FIELD, 'player', edge)).toBe(true);
    expect(withClass(edge, 2, 'vanguard')[2]).toEqual({ ...STARTER_ARMY[2], cls: 'vanguard' });
  });

  it('offers no specialization or one of the class’s two', () => {
    expect(specOptions('invoker')).toEqual([null, 'pyromancer', 'frostcaller']);
    expect(withSpec({ ranger: 'volley' }, 'invoker', 'frostcaller')).toEqual({ ranger: 'volley', invoker: 'frostcaller' });
    expect(withSpec({ ranger: 'volley' }, 'ranger', null)).toEqual({});
  });

  it('brings the starter enemy, or a mirror of your army', () => {
    expect(enemyArmyOf(setup()).placement).toEqual(STARTER_ARMY_MIRRORED);
    const yours = setup({
      placement: withClass(STARTER_ARMY, 1, 'assassin'),
      reserves: ['invoker', 'invoker', 'ranger'],
      specs: { assassin: 'blade' },
      enemyArmy: 'mirror',
    });
    const enemy = enemyArmyOf(yours);
    expect(enemy.placement.map((t) => t.cls)).toEqual(['vanguard', 'assassin', 'ranger', 'ranger', 'guardian']);
    expect(isArmyPlaced(OPEN_FIELD, 'enemy', enemy.placement)).toBe(true);
    expect(enemy).toMatchObject({ reserves: ['invoker', 'invoker', 'ranger'], specs: { assassin: 'blade' }, general: 'captain' });
    expect(enemyArmyOf({ ...yours, general: 'conductor' }).general).toBe('conductor');
    expect(enemyArmyOf({ ...setup(), general: 'conductor' }).general).toBe('captain');
  });

  it('shows the synergies your troops and reserves switch on', () => {
    expect(yourSynergies(setup())).toEqual(['ironWall']);
    expect(yourSynergies(setup({ reserves: ['invoker', 'assassin', 'guardian'], specs: { invoker: 'pyromancer' } }))).toEqual([
      'fireBreak',
      'executionProtocol',
      'ironWall',
      'crossfire',
      'shadowEscort',
    ]);
  });
});
