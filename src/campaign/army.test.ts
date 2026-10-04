import { describe, expect, it } from 'vitest';
import { ARMY_SIZE, RESERVE_COUNT } from '../data/armies';
import { MAPS } from '../data/maps';
import { REGION_IDS, REGIONS } from '../data/regions';
import type { Rarity } from '../data/rarity';
import { TROOP_CLASSES, type TroopClass } from '../data/units';
import { isArmyPlaced } from '../sim';
import { addFighter, fieldPlacement, formation, nextRole, removeFighter, reserveTroops, roleOf, withRole, withSpots } from './army';
import { runOf, runThrough } from './testing';
import type { FighterTraits } from './types';

const start = () => runOf(runThrough(['battle', 'boss']));
const fighter = (cls: TroopClass, rarity: Rarity = 'common'): FighterTraits => ({ cls, rarity, faction: null, perks: [] });

describe('the run roster', () => {
  it('starts with the starter squad: 5 on the field, 3 in reserve, all Common and fit', () => {
    const run = start();
    expect(run.roster.map((f) => f.cls)).toEqual(['vanguard', 'vanguard', 'ranger', 'ranger', 'guardian', 'vanguard', 'ranger', 'guardian']);
    expect(run.field).toEqual([1, 2, 3, 4, 5]);
    expect(run.reserves).toEqual([6, 7, 8]);
    expect(run.roster.every((f) => f.rarity === 'common' && f.hp === 1)).toBe(true);
  });

  it('puts new fighters on the field, then in reserve, then waiting', () => {
    let run = start();
    run = withRole(run, 1, 'rest');
    run = withRole(run, 6, 'rest');
    run = addFighter(run, fighter('assassin', 'rare'));
    expect(roleOf(run, 9)).toBe('field');
    run = addFighter(run, fighter('invoker', 'epic'));
    expect(roleOf(run, 10)).toBe('reserve');
    run = addFighter(run, fighter('ranger'), 0.5);
    expect(roleOf(run, 11)).toBe('rest');
    expect(run.roster.find((f) => f.id === 11)).toMatchObject({ cls: 'ranger', hp: 0.5 });
  });

  it('holds 5 on the field and 3 in reserve, and never empties the field', () => {
    let run = addFighter(start(), fighter('ranger'));
    expect(roleOf(run, 9)).toBe('rest');
    expect(withRole(run, 9, 'field')).toBe(run);
    expect(withRole(run, 9, 'reserve')).toBe(run);
    expect(nextRole(run, 9, 1)).toBe('rest');
    run = withRole(run, 1, 'rest');
    expect(nextRole(run, 9, 1)).toBe('field');
    run = withRole(run, 9, 'field');
    expect(run.field).toHaveLength(ARMY_SIZE);
    for (const id of [2, 3, 4, 5]) run = withRole(run, id, 'rest');
    expect(run.field).toEqual([9]);
    expect(withRole(run, 9, 'rest')).toBe(run);
    expect(run.reserves).toHaveLength(RESERVE_COUNT);
  });

  it('keeps someone on the field when a fighter leaves', () => {
    let run = start();
    for (const id of [2, 3, 4, 5]) run = withRole(run, id, 'rest');
    run = { ...run, roster: run.roster.map((f) => (f.id === 7 ? { ...f, hp: 1 } : { ...f, hp: 0.5 })) };
    run = removeFighter(run, 1);
    expect(run.roster.some((f) => f.id === 1)).toBe(false);
    expect(run.field).toEqual([7]);
    expect(run.reserves).toEqual([6, 8]);
  });
});

describe('placing an army', () => {
  it('lines up any 5 troops validly on every region map, for either side', () => {
    for (const region of REGION_IDS) {
      const map = MAPS[REGIONS[region].map];
      for (const cls of TROOP_CLASSES) {
        const five = Array.from({ length: 5 }, () => ({ cls }));
        for (const side of ['player', 'enemy'] as const) expect(isArmyPlaced(map, side, formation(map, side, five)), `${region} ${cls} ${side}`).toBe(true);
      }
      const mixed = TROOP_CLASSES.map((cls) => ({ cls }));
      expect(isArmyPlaced(map, 'enemy', formation(map, 'enemy', mixed))).toBe(true);
    }
  });

  it('puts melee troops in front and shooters behind', () => {
    const map = MAPS.openField;
    const [ranger, vanguard] = formation(map, 'player', [{ cls: 'ranger' }, { cls: 'vanguard' }]);
    expect(vanguard!.x).toBeGreaterThan(ranger!.x);
    const [enemyRanger, enemyVanguard] = formation(map, 'enemy', [{ cls: 'ranger' }, { cls: 'vanguard' }]);
    expect(enemyVanguard!.x).toBeLessThan(enemyRanger!.x);
  });

  it('places fielded fighters where they stood last, or on a free spot, as troops with their rarity, wounds and id', () => {
    let run = addFighter(withRole(start(), 1, 'rest'), { cls: 'assassin', rarity: 'epic', faction: 'hive', perks: ['swift'] }, 0.6);
    run = withSpots(run, [{ cls: 'ranger', x: 70, y: 470, fighterId: 3 }]);
    const map = MAPS.ironFortress;
    const placement = fieldPlacement(run, map);
    expect(placement.map((t) => t.fighterId)).toEqual(run.field);
    expect(placement.find((t) => t.fighterId === 3)).toMatchObject({ x: 70, y: 470 });
    expect(placement.find((t) => t.fighterId === 9)).toMatchObject({ cls: 'assassin', rarity: 'epic', hp: 0.6, faction: 'hive', perks: ['swift'] });
    expect(isArmyPlaced(map, 'player', placement)).toBe(true);
    expect(reserveTroops(run).map((t) => t.fighterId)).toEqual([6, 7, 8]);
  });
});
