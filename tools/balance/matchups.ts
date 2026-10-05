// The matchups the balance script plays (session 6A). Each pits side A against side B many times
// on different seeds; mirror matchups swap sides on every other seed, so neither side's starting
// edge counts. Each has a fair range for A's win rate: outside it, the report flags it.
//   generals      every General against every other (and itself), both with a Rank III commander
//                 firing its script and its ultimate, the starter armies and reserves
//   specs         each specialization against none, and against its class's other one
//   factions      2, 4 and 6 fighters of a faction against the same army with none
//   bosses        a strong run army against each ruler's boss fight, with and without the boss rule
// In the first three, every troop starts a little off its spot, by the seed: without that, the
// same two armies fight nearly the same battle on every seed, and a tiny edge wins them all.

import { runOf, runThrough } from '../../src/campaign/testing';
import { formation } from '../../src/campaign/army';
import { makeEncounter } from '../../src/campaign/encounters';
import { STARTER_ARMY, STARTER_RESERVES, type Troop, type TroopPlacement } from '../../src/data/armies';
import { isBoss } from '../../src/data/bosses';
import { enemyScript } from '../../src/data/enemyScripts';
import { FACTION_IDS, FACTION_TIERS, type FactionId } from '../../src/data/factions';
import { GENERAL_IDS, type GeneralId } from '../../src/data/generals';
import { MAPS, type MapId } from '../../src/data/maps';
import type { RankNumber } from '../../src/data/ranks';
import { REGION_IDS, REGIONS, type RegionId } from '../../src/data/regions';
import { SPECIALIZATIONS, type SpecChoice, type SpecializationId } from '../../src/data/specializations';
import type { TroopClass } from '../../src/data/units';
import { createRng, nextFloat, type BattleSetup, type RngState } from '../../src/sim';

export const SUITES = ['generals', 'specs', 'factions', 'bosses'] as const;
export type Suite = (typeof SUITES)[number];

export interface Matchup {
  suite: Suite;
  /** "Warlord vs Engineer". */
  name: string;
  /** A's win rate (a draw counts half) that is fair; outside it the report flags the matchup. */
  fair: readonly [number, number];
  /** Swap sides on odd seeds: true for mirror matchups, where both sides should be equal but for the thing tested. */
  swap: boolean;
  /** The battle on this seed, A as the player side or not. */
  setup: (seed: number, aIsPlayer: boolean) => BattleSetup;
  /** The player side fires its ultimate when ready (only when both sides have a commander). */
  playerUltimate: boolean;
}

export interface MatchupOptions {
  rank: RankNumber;
  map: MapId;
}

const FAIR: readonly [number, number] = [0.4, 0.6];

/** An army for one side: its troops where they stand, and its reserves. */
interface Side {
  troops: TroopPlacement[];
  reserves: Troop[];
}

function starter(): Side {
  return { troops: STARTER_ARMY.map((t) => ({ ...t })), reserves: STARTER_RESERVES.map((cls) => ({ cls })) };
}

/** Every class on the field, for specialization matchups: the starter spots with an Assassin and an Invoker in. */
function fullArmy(): Side {
  const classes: TroopClass[] = ['vanguard', 'assassin', 'ranger', 'invoker', 'guardian'];
  return { troops: STARTER_ARMY.map((t, i) => ({ ...t, cls: classes[i]! })), reserves: STARTER_RESERVES.map((cls) => ({ cls })) };
}

/** How far, at most, a troop starts from its spot (in both directions). It stays in the deploy zone. */
export const JITTER = 30;

/** The troops, each moved a little off its spot. */
function jittered(troops: readonly TroopPlacement[], rng: RngState): TroopPlacement[] {
  const shift = () => Math.round((nextFloat(rng) * 2 - 1) * JITTER);
  return troops.map((t) => ({ ...t, x: t.x + shift(), y: t.y + shift() }));
}

/** The start spots' own random numbers: from the seed, but not the battle's. */
function spotsRng(seed: number): RngState {
  return createRng(seed + 0x51ed);
}

/** The same troops on the enemy's side of the map. */
function mirrored(side: Side, map: MapId): Side {
  return { troops: side.troops.map((t) => ({ ...t, x: MAPS[map].width - t.x })), reserves: side.reserves.map((t) => ({ ...t })) };
}

/** Both sides from A's and B's view: A on the player side, or on the enemy's. */
function sides<T>(aIsPlayer: boolean, a: T, b: T): { player: T; enemy: T } {
  return aIsPlayer ? { player: a, enemy: b } : { player: b, enemy: a };
}

function generalMatchups(o: MatchupOptions): Matchup[] {
  const out: Matchup[] = [];
  GENERAL_IDS.forEach((a, i) =>
    GENERAL_IDS.slice(i).forEach((b) => {
      out.push({
        suite: 'generals',
        name: `${a} vs ${b}`,
        fair: FAIR,
        swap: true,
        playerUltimate: true,
        setup: (seed, aIsPlayer) => {
          const g = sides<GeneralId>(aIsPlayer, a, b);
          const army = starter();
          const rng = spotsRng(seed);
          return {
            seed,
            map: MAPS[o.map],
            player: jittered(army.troops, rng),
            enemy: jittered(mirrored(army, o.map).troops, rng),
            reserves: { player: army.reserves, enemy: army.reserves },
            general: g.player,
            enemyGeneral: g.enemy,
            rank: o.rank,
            loadout: enemyScript(g.player, o.rank),
            enemyCommander: { rank: o.rank, loadout: enemyScript(g.enemy, o.rank) },
          };
        },
      });
    }),
  );
  return out;
}

/** A battle of two armies that differ only in specializations or factions: no commanders, the Captain both sides. */
function plainBattle(o: MatchupOptions, army: () => Side, seed: number, aIsPlayer: boolean, a: (s: Side) => Side, b: (s: Side) => Side, specs?: { a: SpecChoice; b: SpecChoice }): BattleSetup {
  const armyA = a(army());
  const armyB = b(army());
  const s = sides(aIsPlayer, armyA, armyB);
  const spec = specs ? sides(aIsPlayer, specs.a, specs.b) : null;
  const enemy = mirrored(s.enemy, o.map);
  const rng = spotsRng(seed);
  return {
    seed,
    map: MAPS[o.map],
    player: jittered(s.player.troops, rng),
    enemy: jittered(enemy.troops, rng),
    reserves: { player: s.player.reserves, enemy: enemy.reserves },
    ...(spec ? { specs: { player: spec.player, enemy: spec.enemy } } : {}),
  };
}

function specMatchups(o: MatchupOptions): Matchup[] {
  const out: Matchup[] = [];
  const ids = Object.keys(SPECIALIZATIONS) as SpecializationId[];
  const same = (s: Side) => s;
  for (const id of ids) {
    const cls = SPECIALIZATIONS[id].cls;
    out.push({
      suite: 'specs',
      name: `${id} vs none`,
      // A specialization should help, a little.
      fair: [0.5, 0.72],
      swap: true,
      playerUltimate: false,
      setup: (seed, aIsPlayer) => plainBattle(o, fullArmy, seed, aIsPlayer, same, same, { a: { [cls]: id }, b: {} }),
    });
  }
  for (const id of ids) {
    const cls = SPECIALIZATIONS[id].cls;
    const other = ids.find((x) => x !== id && SPECIALIZATIONS[x].cls === cls)!;
    if (ids.indexOf(other) < ids.indexOf(id)) continue;
    out.push({
      suite: 'specs',
      name: `${id} vs ${other}`,
      fair: FAIR,
      swap: true,
      playerUltimate: false,
      setup: (seed, aIsPlayer) => plainBattle(o, fullArmy, seed, aIsPlayer, same, same, { a: { [cls]: id }, b: { [cls]: other } }),
    });
  }
  return out;
}

/** What each faction tier should win against the same army with no faction: a bonus should matter, not decide. */
const FACTION_FAIR: Readonly<Record<number, readonly [number, number]>> = { 2: [0.52, 0.72], 4: [0.58, 0.82], 6: [0.62, 0.9] };

function factionMatchups(o: MatchupOptions): Matchup[] {
  const out: Matchup[] = [];
  const withFaction = (faction: FactionId, n: number) => (s: Side): Side => {
    let left = n;
    const mark = <T extends Troop>(t: T): T => (left-- > 0 ? { ...t, faction } : t);
    return { troops: s.troops.map(mark), reserves: s.reserves.map(mark) };
  };
  for (const faction of FACTION_IDS) {
    for (const tier of FACTION_TIERS) {
      out.push({
        suite: 'factions',
        name: `${faction} ${tier} vs none`,
        fair: FACTION_FAIR[tier] ?? FAIR,
        swap: true,
        playerUltimate: false,
        setup: (seed, aIsPlayer) => plainBattle(o, starter, seed, aIsPlayer, withFaction(faction, tier), (s) => s),
      });
    }
  }
  return out;
}

/** A strong run army near a region's end: one Epic and four Rare starter-class fighters, and three reserves. */
const BOSS_ARMY: Troop[] = [
  { cls: 'vanguard', rarity: 'epic' },
  { cls: 'vanguard', rarity: 'rare' },
  { cls: 'ranger', rarity: 'rare' },
  { cls: 'ranger', rarity: 'rare' },
  { cls: 'guardian', rarity: 'rare' },
];
const BOSS_RESERVES: Troop[] = [{ cls: 'vanguard', rarity: 'rare' }, { cls: 'ranger' }, { cls: 'guardian' }];

function bossMatchups(o: MatchupOptions): Matchup[] {
  const run = runOf(runThrough(['battle', 'boss']));
  const out: Matchup[] = [];
  for (const region of REGION_IDS) {
    for (const rule of [true, false]) {
      out.push({
        suite: 'bosses',
        name: `vs ${REGIONS[region].ruler}${rule ? '' : ' (no boss rule)'}`,
        // Hard but winnable for a strong army whose commander fires cards and an ultimate.
        fair: rule ? [0.3, 0.85] : [0, 1],
        swap: false,
        playerUltimate: true,
        setup: (seed) => bossBattle(o, region, rule, seed, run),
      });
    }
  }
  return out;
}

function bossBattle(o: MatchupOptions, region: RegionId, rule: boolean, seed: number, run: ReturnType<typeof runOf>): BattleSetup {
  const e = makeEncounter(createRng(seed), { ...run, region }, 'boss', 7);
  const map = MAPS[e.map];
  const ruler = REGIONS[region].ruler;
  return {
    seed: e.seed,
    map,
    player: formation(map, 'player', BOSS_ARMY),
    enemy: rule ? e.troops : e.troops.filter((t) => !t.turret),
    reserves: { player: BOSS_RESERVES.map((t) => ({ ...t })), enemy: e.reserves },
    rank: o.rank,
    loadout: enemyScript('captain', o.rank),
    enemyGeneral: ruler,
    enemyCommander: e.commander ? { rank: e.commander, loadout: enemyScript(ruler, e.commander) } : undefined,
    boss: rule && isBoss(ruler) ? ruler : undefined,
  };
}

export function matchups(suites: readonly Suite[], o: MatchupOptions): Matchup[] {
  const build: Record<Suite, (o: MatchupOptions) => Matchup[]> = { generals: generalMatchups, specs: specMatchups, factions: factionMatchups, bosses: bossMatchups };
  return suites.flatMap((s) => build[s](o));
}
