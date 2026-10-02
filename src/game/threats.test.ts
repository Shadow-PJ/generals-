import { describe, expect, it } from 'vitest';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../data/armies';
import { OPEN_FIELD } from '../data/maps';
import { createBattle } from '../sim';
import { threats } from './threats';

function battle() {
  return createBattle({ seed: 1, map: OPEN_FIELD, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
}

describe('Threat Readout', () => {
  it('warns about a troop that would fall within a few seconds at its current damage rate', () => {
    const state = battle();
    const ranger = state.units.find((u) => u.side === 'player' && u.cls === 'ranger')!;
    state.tick = 100;
    ranger.hp = 120;
    // 200 damage in the last 2 seconds: 100 per second, so 120 HP lasts about 1.2 s.
    state.events.push({ tick: 90, type: 'damage', sourceId: 2, targetId: ranger.id, amount: 200, absorbed: 0, cause: 'attack' });
    expect(threats(state)).toEqual([{ unitId: ranger.id, text: 'Ranger falls in ~2 s' }]);
  });

  it('stays quiet about troops taking little or old damage, and about the enemy', () => {
    const state = battle();
    const ranger = state.units.find((u) => u.side === 'player' && u.cls === 'ranger')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    state.tick = 200;
    state.events.push({ tick: 100, type: 'damage', sourceId: 2, targetId: ranger.id, amount: 400, absorbed: 0, cause: 'attack' });
    state.events.push({ tick: 190, type: 'damage', sourceId: 2, targetId: ranger.id, amount: 10, absorbed: 0, cause: 'attack' });
    state.events.push({ tick: 195, type: 'damage', sourceId: 1, targetId: enemy.id, amount: 900, absorbed: 0, cause: 'attack' });
    enemy.hp = 50;
    expect(threats(state)).toEqual([]);
  });
});
