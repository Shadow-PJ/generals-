import { describe, expect, it } from 'vitest';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED, type TroopPlacement } from '../data/armies';
import { BATTLE_RULES } from '../data/battle';
import { GENERAL_IDS, type GeneralId } from '../data/generals';
import { OPEN_FIELD } from '../data/maps';
import type { SpecChoice } from '../data/specializations';
import { UNIT_CLASSES } from '../data/units';
import { createBattle, runBattle, stepBattle } from './battle';
import type { BattleSetup, BattleState, Unit, Winner } from './types';

// A mirror match: both sides bring the same army, mirrored left to right, and the same General.
// Neither the side that acts first in a tick (the player: ids alternate player, enemy, ...)
// nor the side on the left may have an edge.

function mirrored(army: TroopPlacement[]): TroopPlacement[] {
  return army === STARTER_ARMY ? STARTER_ARMY_MIRRORED : army.map((t) => ({ ...t, x: OPEN_FIELD.width - t.x }));
}

/** Every class, so every troop skill, with specializations. */
const EVERY_CLASS: TroopPlacement[] = [
  { cls: 'vanguard', x: 260, y: 240 },
  { cls: 'assassin', x: 250, y: 330 },
  { cls: 'ranger', x: 130, y: 200 },
  { cls: 'invoker', x: 140, y: 340 },
  { cls: 'guardian', x: 190, y: 270 },
];
/** Two Assassins on each side, which Shadowstep to each other. */
const TWO_ASSASSINS: TroopPlacement[] = [
  { cls: 'assassin', x: 260, y: 200 },
  { cls: 'assassin', x: 260, y: 340 },
  { cls: 'vanguard', x: 230, y: 270 },
  { cls: 'invoker', x: 120, y: 220 },
  { cls: 'guardian', x: 130, y: 320 },
];

const ARMIES: { name: string; army: TroopPlacement[]; specs: SpecChoice }[] = [
  { name: 'the starter army', army: STARTER_ARMY, specs: {} },
  {
    name: 'every class',
    army: EVERY_CLASS,
    specs: { vanguard: 'breaker', ranger: 'volley', guardian: 'warden', invoker: 'pyromancer', assassin: 'blade' },
  },
  {
    name: 'two Assassins',
    army: TWO_ASSASSINS,
    specs: { vanguard: 'bulwark', ranger: 'sniper', guardian: 'mender', invoker: 'frostcaller', assassin: 'saboteur' },
  },
];

function mirrorMatch(seed: number, general: GeneralId, army: TroopPlacement[] = STARTER_ARMY, specs: SpecChoice = {}): BattleSetup {
  return {
    seed,
    map: OPEN_FIELD,
    player: army,
    enemy: mirrored(army),
    general,
    enemyGeneral: general,
    specs: { player: specs, enemy: specs },
  };
}

/** Runs `fn` with no damage spread and no critical hits, so nothing random is left in a battle. */
function withoutRandomness<T>(fn: () => T): T {
  const rules = BATTLE_RULES as { damageVariance: number };
  const crit = UNIT_CLASSES.assassin.crit as { chance: number };
  const saved = { variance: rules.damageVariance, crit: crit.chance };
  rules.damageVariance = 0;
  crit.chance = 0;
  try {
    return fn();
  } finally {
    rules.damageVariance = saved.variance;
    crit.chance = saved.crit;
  }
}

/** A unit's mirror image in a mirror match: the troop placed with it, the id next to it. */
function twinId(id: number): number {
  return id % 2 === 1 ? id + 1 : id - 1;
}

/** What breaks the mirror, or null if the battle is an exact mirror image left to right. */
function mirrorBreak(state: BattleState): string | null {
  const width = state.map.width;
  const same = (a: Unit, b: Unit) =>
    a.alive === b.alive &&
    a.hp === b.hp &&
    a.x === width - b.x &&
    a.y === b.y &&
    a.attackCooldown === b.attackCooldown &&
    a.skillCooldown === b.skillCooldown &&
    (a.targetId === null ? b.targetId === null : b.targetId === twinId(a.targetId)) &&
    a.stunTicks === b.stunTicks &&
    a.barrier?.amount === b.barrier?.amount &&
    !a.casting === !b.casting &&
    !a.knockback === !b.knockback;
  for (const unit of state.units) {
    if (!same(unit, state.units[twinId(unit.id) - 1]!)) return `${unit.side} ${unit.cls} (id ${unit.id})`;
  }
  for (const p of state.projectiles) {
    const twin = state.projectiles.some(
      (q) => q.ownerId === twinId(p.ownerId) && q.targetId === twinId(p.targetId) && q.x === width - p.x && q.y === p.y,
    );
    if (!twin) return `the shot of unit ${p.ownerId}`;
  }
  for (const z of state.zones) {
    const twin = state.zones.some((q) => q.ownerId === twinId(z.ownerId) && q.x === width - z.x && q.y === z.y && q.ticksLeft === z.ticksLeft);
    if (!twin) return `the Rift of unit ${z.ownerId}`;
  }
  for (const w of state.walls) {
    if (state.walls.find((o) => o.x === width - w.x - w.w && o.y === w.y)!.hp !== w.hp) return `wall ${w.id}`;
  }
  return null;
}

/** Runs a mirror match with nothing random left; returns where the mirror first broke, or the winner. */
function runExactMirror(seed: number, general: GeneralId, army: TroopPlacement[], specs: SpecChoice): string {
  return withoutRandomness(() => {
    const state = createBattle(mirrorMatch(seed, general, army, specs));
    // Each troop's first attack comes on the same tick as its mirror image's.
    for (const unit of state.units) if (unit.side === 'enemy') unit.attackCooldown = state.units[twinId(unit.id) - 1]!.attackCooldown;
    while (!state.result) {
      stepBattle(state);
      const broken = mirrorBreak(state);
      if (broken) return `mirror broke at tick ${state.tick - 1}: ${broken}`;
    }
    return state.result.winner;
  });
}

/** 6 battles checked on every tick: well under a second here, but give the Windows runner room. */
const EXACT_MIRRORS_MS = 30_000;

describe('a mirror match with nothing random left', () => {
  // With equal first-attack timers and no damage spread or crits, the two sides of a mirror
  // match do exactly the same thing on every tick, whichever side acts first in it. So the
  // battle stays an exact mirror image (positions included, to the last bit) and both armies
  // fall on the same tick. The timers differ from seed to seed, so the battles do too.
  it.each(GENERAL_IDS)('stays an exact mirror to the end, with %s on both sides', (general) => {
    for (const { name, army, specs } of ARMIES) {
      for (const seed of [1, 2]) {
        expect(runExactMirror(seed, general, army, specs), `${name}, seed ${seed}`).toBe('draw');
      }
    }
  }, EXACT_MIRRORS_MS);
});

// With real randomness, every General's mirror match should be a coin flip. A General plays 50
// battles, which give a fair side 50% ± 7 points: it passes from 30% to 70%, almost 3 standard
// deviations, so a fair engine doesn't fail by chance after some unrelated change. That catches
// a strong lean. All 300 battles together give 50% ± 3 points and pass from 42% to 58%, which
// catches a smaller lean shared by the Generals. Leans can also go both ways and cancel out, so
// each General's lean in standard deviations is squared and summed (a chi-squared test): about 6
// for a fair engine, above 18.5 only one time in 200. (Narrower bands need thousands of battles;
// the exact mirror tests above are the sharp check.)
const SEEDS_PER_GENERAL = 50;
/** 50 battles take 2 to 5 s here (Strategist battles run longest); the Windows runner is slower. */
const MIRROR_MATCH_MS = 120_000;

const mirrorResults = new Map<GeneralId, Record<Winner, number>>();

/** Wins of each side over the General's mirror matches; each General's battles run once per file. */
function mirrorWins(general: GeneralId): Record<Winner, number> {
  let wins = mirrorResults.get(general);
  if (!wins) {
    wins = { player: 0, enemy: 0, draw: 0 };
    for (let seed = 1; seed <= SEEDS_PER_GENERAL; seed++) wins[runBattle(mirrorMatch(seed, general)).result!.winner] += 1;
    mirrorResults.set(general, wins);
  }
  return wins;
}

function playerShare(wins: Record<Winner, number>): number {
  return wins.player / (wins.player + wins.enemy);
}

/** How far the player's wins are from an even split, in standard deviations of a coin flip. */
function lean(wins: Record<Winner, number>): number {
  const decided = wins.player + wins.enemy;
  return (wins.player - decided / 2) / Math.sqrt(decided / 4);
}

describe('a mirror match with real randomness', () => {
  it.each(GENERAL_IDS)("is a coin flip with %s on both sides", (general) => {
    const wins = mirrorWins(general);
    expect(playerShare(wins), JSON.stringify(wins)).toBeGreaterThanOrEqual(0.3);
    expect(playerShare(wins), JSON.stringify(wins)).toBeLessThanOrEqual(0.7);
  }, MIRROR_MATCH_MS);

  it('is a coin flip over every General together', () => {
    const all = GENERAL_IDS.map(mirrorWins);
    const total = { player: 0, enemy: 0, draw: 0 };
    for (const wins of all) for (const w of ['player', 'enemy', 'draw'] as const) total[w] += wins[w];
    expect(playerShare(total), JSON.stringify(total)).toBeGreaterThanOrEqual(0.42);
    expect(playerShare(total), JSON.stringify(total)).toBeLessThanOrEqual(0.58);
    const leans = all.map(lean);
    expect(leans.reduce((sum, z) => sum + z * z, 0), leans.map((z) => z.toFixed(2)).join(', ')).toBeLessThan(18.5);
  }, MIRROR_MATCH_MS * GENERAL_IDS.length);
});
