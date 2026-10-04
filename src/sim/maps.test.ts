import { describe, expect, it } from 'vitest';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../data/armies';
import { BATTLE_RULES } from '../data/battle';
import { MAP_IDS, MAPS, OPEN_FIELD, type MapData } from '../data/maps';
import { UNIT_CLASSES } from '../data/units';
import { createBattle, runBattle } from './battle';
import { think } from './behaviors';
import { circleOverlapsRect } from './geometry';
import { aroundRock } from './intents';
import { findPath, isLineClear } from './navigation';
import { isPlacementFine } from './testing/mapChecks';
import { isHidden, visibleEnemies } from './queries';
import { battleWith, sideUnits } from './testing/fixtures';
import { damageWall } from './walls';

const key = (r: { x: number; y: number; w: number; h: number }) => `${r.x},${r.y},${r.w},${r.h}`;
const mirror = (map: MapData, r: { x: number; y: number; w: number; h: number }) => ({ ...r, x: map.width - r.x - r.w });

describe('the region maps', () => {
  for (const id of MAP_IDS) {
    const map = MAPS[id];
    describe(map.name, () => {
      it('is the size of the screen, with the usual deploy zones', () => {
        expect([map.width, map.height]).toEqual([OPEN_FIELD.width, OPEN_FIELD.height]);
        expect(map.deployZones).toEqual(OPEN_FIELD.deployZones);
        expect(map.terrainText.length).toBeGreaterThan(10);
      });

      it('is a mirror image left to right, so neither side starts better off', () => {
        expect(new Set(map.walls.map((w) => key(mirror(map, w))))).toEqual(new Set(map.walls.map(key)));
        const forests = map.forests ?? [];
        expect(new Set(forests.map((f) => key(mirror(map, f))))).toEqual(new Set(forests.map(key)));
      });

      it('leaves both starter armies where they may stand, and every deploy zone free of walls', () => {
        expect(isPlacementFine(map)).toBe(true);
        for (const zone of [map.deployZones.player, map.deployZones.enemy]) {
          for (const w of map.walls) expect(w.x + w.w <= zone.x || w.x >= zone.x + zone.w || w.y + w.h <= zone.y || w.y >= zone.y + zone.h).toBe(true);
        }
      });

      it('lets troops walk from one side to the other', () => {
        const state = createBattle({ seed: 1, map, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
        for (const y of [100, 270, 440]) {
          const from = { x: 200, y };
          const to = { x: 760, y };
          expect(isLineClear(state.nav, from.x, from.y, to.x, to.y) || findPath(state.nav, from, to).length > 0, `${map.name} at y ${y}`).toBe(true);
        }
      });

      it('plays a full battle to the end', () => {
        expect(runBattle({ seed: 3, map, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED }).result).not.toBeNull();
      });
    });
  }

  it('Red Canyon and Iron Fortress: their rock and iron stop shots and never break', () => {
    const state = createBattle({ seed: 1, map: MAPS.ironFortress, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
    const iron = state.walls.find((w) => w.unbreakable)!;
    damageWall(state, iron, 1, 100_000);
    expect(iron.hp).toBe(iron.maxHp);
    expect(state.events.some((e) => e.type === 'wallBreak')).toBe(false);
  });

  it('Void Ruins: many weak walls cut the sightlines across the middle, and break fast', () => {
    const ruins = MAPS.voidRuins;
    expect(ruins.walls.length).toBeGreaterThanOrEqual(10);
    for (const w of ruins.walls) expect(w.hp).toBeLessThan(BATTLE_RULES.walls.hp);
    const state = createBattle({ seed: 1, map: ruins, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
    const blocked = [100, 270, 440].filter((y) => !isLineClear(state.nav, 200, y, 760, y));
    expect(blocked).toEqual([100, 270, 440]);
    const wall = state.walls[0]!;
    damageWall(state, wall, 1, wall.maxHp);
    expect(state.events.some((e) => e.type === 'wallBreak')).toBe(true);
  });

  it('Red Canyon: rock leaves three narrow paths across', () => {
    const state = createBattle({ seed: 1, map: MAPS.redCanyon, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
    const across = (y: number) => isLineClear(state.nav, 200, y, 760, y);
    expect([60, 270, 480].map(across)).toEqual([true, true, true]);
    expect([150, 380].map(across)).toEqual([false, false]);
  });

  it('a ranged troop doesn’t shoot at rock that never breaks: it walks to find a clear line', () => {
    const block = { x: 380, y: 250, w: 20, h: 100 };
    for (const unbreakable of [true, false]) {
      const state = battleWith([{ cls: 'ranger', x: 300, y: 300 }], [{ cls: 'vanguard', x: 480, y: 300 }], {
        walls: [{ ...block, unbreakable }],
      });
      const [ranger] = sideUnits(state, 'player');
      const intent = aroundRock(state, ranger!, think(state, ranger!));
      // A wall that breaks is still worth shooting: it wears down.
      expect(intent.action.kind, unbreakable ? 'rock' : 'breakable wall').toBe(unbreakable ? 'walk' : 'attack');
    }
  });

  it('Iron Fortress: each army is walled in, with two gates out', () => {
    const state = createBattle({ seed: 1, map: MAPS.ironFortress, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
    const out = (y: number) => isLineClear(state.nav, 200, y, 420, y);
    expect([182, 357].map(out)).toEqual([true, true]);
    expect([60, 270, 480].map(out)).toEqual([false, false, false]);
  });

  it('Deep Forest: a troop in the woods is seen only from close by', () => {
    const forest = MAPS.deepForest.forests![0]!;
    const state = battleWith(
      [{ cls: 'ranger', x: 100, y: 300 }],
      [{ cls: 'assassin', x: forest.x + forest.w / 2, y: forest.y + forest.h / 2 }],
    );
    state.map = MAPS.deepForest;
    const ranger = sideUnits(state, 'player')[0]!;
    const assassin = sideUnits(state, 'enemy')[0]!;
    expect(isHidden(state, assassin, ranger)).toBe(true);
    expect(visibleEnemies(state, ranger)).toEqual([]);
    ranger.x = assassin.x - 80;
    ranger.y = assassin.y;
    expect(isHidden(state, assassin, ranger)).toBe(false);
    // Out of the woods, it is seen from anywhere.
    ranger.x = 100;
    assassin.x = 600;
    assassin.y = 270;
    expect(isHidden(state, assassin, ranger)).toBe(false);
  });

  it('Deep Forest: a troop that sees no enemy goes looking in the woods, so hiding armies don’t wait each other out', () => {
    const forest = MAPS.deepForest.forests![0]!;
    const state = battleWith([{ cls: 'vanguard', x: 100, y: 300 }], [{ cls: 'ranger', x: forest.x + forest.w / 2, y: forest.y + forest.h / 2 }]);
    state.map = MAPS.deepForest;
    const [vanguard] = sideUnits(state, 'player');
    const [ranger] = sideUnits(state, 'enemy');
    expect(think(state, vanguard!).action).toEqual({ kind: 'walk', to: { x: ranger!.x, y: ranger!.y }, targetId: null });
    // An invisible enemy out of the woods can't be found that way: the troop stands.
    ranger!.x = 600;
    ranger!.y = 300;
    ranger!.invisibleTicks = 20;
    expect(think(state, vanguard!).action).toEqual({ kind: 'hold' });
  });

  it('Glass Plains: ranged troops reach 15% further; melee troops don’t', () => {
    const state = createBattle({ seed: 1, map: MAPS.glassPlains, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
    const ranger = state.units.find((u) => u.cls === 'ranger')!;
    const vanguard = state.units.find((u) => u.cls === 'vanguard')!;
    expect(ranger.stats.range).toBeCloseTo(UNIT_CLASSES.ranger.stats.range * 1.15);
    expect(vanguard.stats.range).toBe(UNIT_CLASSES.vanguard.stats.range);
  });

  it('keeps every wall clear of where the starter troops stand', () => {
    for (const id of MAP_IDS) {
      for (const t of STARTER_ARMY) {
        for (const w of MAPS[id].walls) expect(circleOverlapsRect(t.x, t.y, UNIT_CLASSES[t.cls].stats.radius, w)).toBe(false);
      }
    }
  });
});
