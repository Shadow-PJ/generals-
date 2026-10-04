import { describe, expect, it } from 'vitest';
import { BOSS_RULES } from '../data/bosses';
import { MAPS } from '../data/maps';
import { REGION_IDS, REGIONS } from '../data/regions';
import { FIGHT_TIERS } from '../data/runs';
import { createBattle, createRng, isArmyPlaced, runBattle } from '../sim';
import { enemyScript } from '../data/enemyScripts';
import { fightTier, makeEncounter } from './encounters';
import { runOf, runThrough } from './testing';

describe('enemies along a run', () => {
  const run = runOf(runThrough(['battle', 'boss']));

  it('start small, with no commander, and grow into full armies with commanders of rising rank', () => {
    expect(fightTier('battle', 0, 0)).toMatchObject({ troops: 3, reserves: 0, commander: null, epic: 0, rare: 0 });
    const tiers = FIGHT_TIERS.map((_, floor) => fightTier('battle', floor, 0));
    for (let f = 1; f < tiers.length; f++) {
      expect(tiers[f]!.troops + tiers[f]!.reserves).toBeGreaterThanOrEqual(tiers[f - 1]!.troops + tiers[f - 1]!.reserves);
      expect(tiers[f]!.commander ?? 0).toBeGreaterThanOrEqual(tiers[f - 1]!.commander ?? 0);
    }
    expect(tiers.at(-1)!.commander).not.toBeNull();
  });

  it('elite fights bring a stronger commander and rarer troops; the boss brings the most', () => {
    const elite = fightTier('elite', 2, 0);
    expect(elite.commander).toBeGreaterThanOrEqual(2);
    expect(elite.epic).toBeGreaterThanOrEqual(1);
    expect(fightTier('boss', 7, 0)).toMatchObject({ troops: 5, reserves: 3 });
  });

  it('every boss beaten before the run makes its fights harder', () => {
    expect(fightTier('battle', 4, 2).commander).toBe(fightTier('battle', 4, 0).commander! + 2);
    expect(fightTier('battle', 4, 2).rare).toBe(fightTier('battle', 4, 0).rare + 2);
    expect(fightTier('battle', 0, 3).commander).toBeNull();
    expect(fightTier('elite', 5, 4).commander).toBe(5);
  });

  it('are the region ruler’s troops, on the region’s map, placed validly, with the rarities the tier asks for', () => {
    for (const region of REGION_IDS) {
      for (const [kind, floor] of [['battle', 0], ['battle', 5], ['elite', 3], ['boss', 7]] as const) {
        const encounter = makeEncounter(createRng(9), { ...run, region }, kind, floor);
        const tier = fightTier(kind, floor, 0);
        expect(encounter).toMatchObject({ kind, map: REGIONS[region].map, general: REGIONS[region].ruler, commander: tier.commander });
        // The Engineer brings her turrets on top of her army.
        const turrets = encounter.troops.filter((t) => t.turret);
        expect(turrets).toHaveLength(kind === 'boss' && region === 'ironFortress' ? BOSS_RULES.engineer.turrets.length : 0);
        expect(encounter.troops.length - turrets.length).toBe(tier.troops);
        expect(encounter.reserves).toHaveLength(tier.reserves);
        const all = [...encounter.troops.filter((t) => !t.turret), ...encounter.reserves];
        expect(all.filter((t) => t.rarity === 'epic')).toHaveLength(tier.epic);
        expect(all.filter((t) => t.rarity === 'rare')).toHaveLength(Math.min(tier.rare, all.length - tier.epic));
        expect(isArmyPlaced(MAPS[encounter.map], 'enemy', encounter.troops)).toBe(true);
        if (kind === 'boss') expect(all.map((t) => t.cls)).toEqual(REGIONS[region].bossArmy);
      }
    }
  });

  it('are the same for the same generator, and make a battle that plays out', () => {
    const a = makeEncounter(createRng(4), run, 'elite', 4);
    expect(makeEncounter(createRng(4), run, 'elite', 4)).toEqual(a);
    const battle = runBattle({
      seed: a.seed,
      map: MAPS[a.map],
      player: [{ cls: 'vanguard', x: 260, y: 270 }],
      enemy: a.troops,
      reserves: { player: [], enemy: a.reserves },
      enemyGeneral: a.general,
      enemyCommander: a.commander ? { rank: a.commander, loadout: enemyScript(a.general, a.commander) } : undefined,
    });
    expect(battle.result).not.toBeNull();
    expect(() => createBattle({ seed: 1, map: MAPS[a.map], player: [], enemy: a.troops })).not.toThrow();
  });
});
