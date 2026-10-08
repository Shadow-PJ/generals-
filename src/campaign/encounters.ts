// The enemy at a fight node. Enemies grow stronger along the path: small armies with no commander
// on the first floors, then full armies with reserves, Rare and Epic troops and commanders of
// rising rank. Elite fights bring a stronger commander and rarer troops, and the boss the
// ruler's own army. Every boss you had beaten before the run makes its fights harder still, and
// so does every lap of an endless run (session 7G).

import type { Rarity } from '../data/rarity';
import { BOSS_RULES, type BossId } from '../data/bosses';
import type { TroopPlacement } from '../data/armies';
import type { GeneralId } from '../data/generals';
import { REGIONS } from '../data/regions';
import { OATH_RULES, oathValue, type OathRanks } from '../data/oaths';
import { BOSS_FIGHTS, ELITE_FIGHT, FIGHT_TIERS, RUN_LEVEL_STEP, type FightTier } from '../data/runs';
import { ENDLESS_RULES } from '../data/endless';
import { MAPS } from '../data/maps';
import type { RankNumber } from '../data/ranks';
import type { UnitClass } from '../data/units';
import { createRng, nextUint32, type RngState } from '../sim';
import { formation } from './army';
import { shuffled, weighted } from './random';
import type { Encounter, RunState } from './types';

const MAX_RANK = 5;

function rankAtMost(rank: number): RankNumber {
  return Math.max(1, Math.min(MAX_RANK, rank)) as RankNumber;
}

/**
 * The enemy army for a fight of this kind on this floor of a region ruled by `ruler`, `level`
 * bosses into the campaign, under the run's Oaths of Command (session 5F), `lap` laps into an
 * endless run (session 7G).
 */
export function fightTier(kind: Encounter['kind'], floor: number, level: number, ruler: BossId, oaths: OathRanks = {}, lap = 0): FightTier {
  const base = kind === 'boss' ? BOSS_FIGHTS[ruler] : FIGHT_TIERS[Math.min(floor, FIGHT_TIERS.length - 1)]!;
  let { commander, epic, rare } = base;
  if (kind === 'elite') {
    commander = rankAtMost(Math.max(ELITE_FIGHT.minCommander, (commander ?? 0) + ELITE_FIGHT.commanderBonus));
    epic += ELITE_FIGHT.epic;
    rare += ELITE_FIGHT.rare;
  }
  if (commander !== null) commander = rankAtMost(commander + level * RUN_LEVEL_STEP.commander);
  rare += level * RUN_LEVEL_STEP.rare;
  // Oaths: rarer troops everywhere, sharper commanders, and a crueler ruler.
  rare += oathValue(oaths, OATH_RULES.veteranFoes.rare, 'veteranFoes');
  epic += oathValue(oaths, OATH_RULES.eliteGuard.epic, 'eliteGuard');
  if (commander !== null) commander = rankAtMost(commander + oathValue(oaths, OATH_RULES.cunningCommanders.ranks, 'cunningCommanders'));
  if (kind === 'boss') {
    epic += oathValue(oaths, OATH_RULES.tyrantsWrath.epic, 'tyrantsWrath');
    if (commander !== null) commander = rankAtMost(commander + oathValue(oaths, OATH_RULES.tyrantsWrath.commander, 'tyrantsWrath'));
  }
  // An endless run (session 7G): every lap past the ruler, rarer troops and sharper commanders.
  if (lap > 0) {
    rare += lap * ENDLESS_RULES.perLap.rare;
    epic += lap * ENDLESS_RULES.perLap.epic;
    if (commander !== null) commander = rankAtMost(commander + lap * ENDLESS_RULES.perLap.commander);
    return { ...base, commander, epic, rare, legendary: Math.max(0, lap - ENDLESS_RULES.legendaryAfterLap) };
  }
  return { ...base, commander, epic, rare };
}

/** The encounter at a fight node, rolled from the run's generator. */
export function makeEncounter(rng: RngState, run: RunState, kind: Encounter['kind'], floor: number): Encounter {
  const region = REGIONS[run.region];
  const tier = fightTier(kind, floor, run.level, region.ruler, run.oaths, run.endless?.lap ?? 0);
  const count = tier.troops + tier.reserves;
  const classes: UnitClass[] =
    kind === 'boss' ? [...region.bossArmy].slice(0, count) : Array.from({ length: count }, () => weighted(rng, region.enemyClasses));
  // The rarest troops go where the dice put them, field first.
  const legendary = tier.legendary ?? 0;
  const rarities: Rarity[] = Array.from({ length: count }, (_, i) =>
    i < legendary ? 'legendary' : i < legendary + tier.epic ? 'epic' : i < legendary + tier.epic + tier.rare ? 'rare' : 'common',
  );
  const order = [...shuffled(rng, Array.from({ length: tier.troops }, (_, i) => i)), ...Array.from({ length: tier.reserves }, (_, i) => tier.troops + i)];
  const troops = classes.map((cls, i) => ({ cls, rarity: rarities[order.indexOf(i)]! }));
  return {
    kind,
    seed: nextUint32(rng),
    map: region.map,
    general: region.ruler,
    commander: tier.commander,
    troops: [...formation(MAPS[region.map], 'enemy', troops.slice(0, tier.troops)), ...bossExtras(kind, region.ruler)],
    reserves: troops.slice(tier.troops),
  };
}

/** A node's own seed: every fight on a run's map is fixed when the map is made; an endless lap's map has its own. */
function nodeSeed(run: RunState, floor: number, index: number): number {
  return (run.seed ^ ((floor + 1) * 0x9e3779b1) ^ ((index + 1) * 0x85ebca6b) ^ ((run.endless?.lap ?? 0) * 0xc2b2ae35)) | 0;
}

/**
 * The fight waiting at a node (session 5F: scouting). It comes from the node's own seed, not the
 * run's generator, so the run map can show it before you choose a path, and taking the node
 * brings exactly that army. Null for a node that isn't a fight.
 */
export function nodeEncounter(run: RunState, floor: number, index: number): Encounter | null {
  const kind = run.map[floor]?.[index]?.kind;
  if (kind !== 'battle' && kind !== 'elite' && kind !== 'boss') return null;
  return makeEncounter(createRng(nodeSeed(run, floor, index)), run, kind, floor);
}

/** What a boss brings on top of their army: the Engineer's turrets. */
function bossExtras(kind: Encounter['kind'], ruler: GeneralId): TroopPlacement[] {
  if (kind !== 'boss' || ruler !== 'engineer') return [];
  return BOSS_RULES.engineer.turrets.map((t) => ({ ...t, rarity: 'common', turret: true }));
}
