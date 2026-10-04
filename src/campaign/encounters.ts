// The enemy at a fight node. Enemies grow stronger along the path: small armies with no commander
// on the first floors, then full armies with reserves, Rare and Epic troops and commanders of
// rising rank. Elite fights bring a stronger commander and rarer troops, and the boss the
// ruler's own army. Every boss you had beaten before the run makes its fights harder still.

import type { Rarity } from '../data/rarity';
import { REGIONS } from '../data/regions';
import { BOSS_FIGHT, ELITE_FIGHT, FIGHT_TIERS, RUN_LEVEL_STEP, type FightTier } from '../data/runs';
import { MAPS } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import type { UnitClass } from '../data/units';
import { nextUint32, type RngState } from '../sim';
import { formation } from './army';
import { shuffled, weighted } from './random';
import type { Encounter, RunState } from './types';

const MAX_RANK = 5;

function rankAtMost(rank: number): RankNumber {
  return Math.max(1, Math.min(MAX_RANK, rank)) as RankNumber;
}

/** The enemy army for a fight of this kind on this floor, `level` bosses into the campaign. */
export function fightTier(kind: Encounter['kind'], floor: number, level: number): FightTier {
  const base = kind === 'boss' ? BOSS_FIGHT : FIGHT_TIERS[Math.min(floor, FIGHT_TIERS.length - 1)]!;
  let { commander, epic, rare } = base;
  if (kind === 'elite') {
    commander = rankAtMost(Math.max(ELITE_FIGHT.minCommander, (commander ?? 0) + ELITE_FIGHT.commanderBonus));
    epic += ELITE_FIGHT.epic;
    rare += ELITE_FIGHT.rare;
  }
  if (commander !== null) commander = rankAtMost(commander + level * RUN_LEVEL_STEP.commander);
  rare += level * RUN_LEVEL_STEP.rare;
  return { ...base, commander, epic, rare };
}

/** The encounter at a fight node, rolled from the run's generator. */
export function makeEncounter(rng: RngState, run: RunState, kind: Encounter['kind'], floor: number): Encounter {
  const region = REGIONS[run.region];
  const tier = fightTier(kind, floor, run.level);
  const count = tier.troops + tier.reserves;
  const classes: UnitClass[] =
    kind === 'boss' ? [...region.bossArmy].slice(0, count) : Array.from({ length: count }, () => weighted(rng, region.enemyClasses));
  // The rarest troops go where the dice put them, field first.
  const rarities: Rarity[] = Array.from({ length: count }, (_, i) => (i < tier.epic ? 'epic' : i < tier.epic + tier.rare ? 'rare' : 'common'));
  const order = [...shuffled(rng, Array.from({ length: tier.troops }, (_, i) => i)), ...Array.from({ length: tier.reserves }, (_, i) => tier.troops + i)];
  const troops = classes.map((cls, i) => ({ cls, rarity: rarities[order.indexOf(i)]! }));
  return {
    kind,
    seed: nextUint32(rng),
    map: region.map,
    general: region.ruler,
    commander: tier.commander,
    troops: formation(MAPS[region.map], 'enemy', troops.slice(0, tier.troops)),
    reserves: troops.slice(tier.troops),
  };
}
