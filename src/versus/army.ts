// Checking the other player's army before a versus battle, and building the battle both games
// run (session 6D). Each side checks the other's army against the match's rules, with the same
// validator that gates every card, before the battle starts; a card the rules don't allow stops
// the battle instead of being quietly dropped, so both players know why. Pure.

import { validateCard } from '../cards/validator';
import { LEGENDARY_ACTIONS, type Card } from '../cards/types';
import { ARMY_SIZE, RESERVE_COUNT, type TroopPlacement } from '../data/armies';
import { GENERAL_IDS } from '../data/generals';
import { MAP_IDS, MAPS } from '../data/maps';
import { RANKS } from '../data/ranks';
import { SPECIALIZATIONS_OF } from '../data/specializations';
import { TROOP_CLASSES } from '../data/units';
import { isArmyPlaced, type BattleSetup } from '../sim';
import type { MatchRules, VersusArmy } from './messages';

/** True if the rules name a real map and rank. */
export function rulesProblem(rules: MatchRules): string | null {
  if (!MAP_IDS.includes(rules.map)) return 'an unknown map';
  if (!RANKS.some((r) => r.rank === rules.rank)) return 'an unknown rank';
  return null;
}

const PROBLEM_WORDS: Readonly<Record<string, string>> = {
  noSteps: 'has no steps',
  actionLocked: 'uses an action this rank has not unlocked',
  tooManySteps: 'has more steps than this rank allows',
  conditionLocked: 'uses a condition this rank has not unlocked',
  autoLocked: 'is Auto before this rank allows it',
  autoNeedsCondition: 'is Auto without a condition',
  namedLocked: 'names a troop before this rank allows it',
  tooExpensive: 'costs more pips than this rank holds',
  tooManyTriggers: 'has too many triggers',
  triggerTargetMismatch: 'aims at a trigger it does not have',
  numberOutOfRange: 'has a number out of range',
  legendaryOutsideSlot: 'has a Legendary action outside the Legendary slot',
  legendaryMissing: 'has no Legendary action',
  tooManyLegendary: 'has more than one Legendary action',
  legendaryNotLearned: 'uses a Legendary action not yet learned',
};

/** What is wrong with a card in a slot, in words, or null if the rules allow it. */
function cardProblem(card: unknown, slotName: string, rules: MatchRules, legendarySlot: boolean, learned: VersusArmy['learned']): string | null {
  try {
    const verdict = validateCard(card as Card, rules.rank, { legendarySlot, learned });
    if (verdict.ok) return null;
    return `${slotName} ${PROBLEM_WORDS[verdict.problems[0]!.kind] ?? 'breaks the rules'}`;
  } catch {
    return `${slotName} is not a card`;
  }
}

/** Whose army the words are about: the other player's (checked as it arrives), or yours (checked before you send it). */
export type Whose = 'theirs' | 'yours';

/** "Their card 1 ..." about the other player's army, "Your card 1 ..." about yours. */
export function wordsFor(whose: Whose, problem: string): string {
  if (whose === 'theirs') return problem;
  return problem.replace(/^Their /, 'Your ').replace(/^They /, 'You ').replace(/ their /g, ' your ');
}

/**
 * Everything wrong with an army under the match's rules, in words; empty when it may play. It
 * checks the troops (classes, how many, where they stand in the deploy zone), the reserves, the
 * specializations, the General and every card at the match's rank.
 */
export function armyProblems(army: VersusArmy, rules: MatchRules, whose: Whose = 'theirs'): string[] {
  return theirProblems(army, rules).map((p) => wordsFor(whose, p));
}

function theirProblems(army: VersusArmy, rules: MatchRules): string[] {
  const problems: string[] = [];
  const map = MAPS[rules.map];
  if (!GENERAL_IDS.includes(army.general)) problems.push('Their General is unknown.');
  const placement = Array.isArray(army.placement) ? army.placement : [];
  const known = (cls: unknown) => (TROOP_CLASSES as readonly unknown[]).includes(cls);
  const numbers = (t: TroopPlacement) => Number.isFinite(t?.x) && Number.isFinite(t?.y);
  if (placement.length !== ARMY_SIZE || !placement.every((t) => known(t?.cls) && numbers(t))) problems.push(`They must field ${ARMY_SIZE} troops.`);
  else if (!isArmyPlaced(map, 'player', placement)) problems.push('A troop stands outside their deploy zone.');
  const reserves = Array.isArray(army.reserves) ? army.reserves : [];
  if (reserves.length > RESERVE_COUNT || !reserves.every(known)) problems.push(`They may keep at most ${RESERVE_COUNT} reserves.`);
  for (const [cls, spec] of Object.entries(army.specs ?? {})) {
    const options = SPECIALIZATIONS_OF[cls as keyof typeof SPECIALIZATIONS_OF] as readonly string[] | undefined;
    if (!options?.includes(spec as string)) problems.push(`A specialization is unknown.`);
  }
  const learned = Array.isArray(army.learned) ? army.learned.filter((a) => LEGENDARY_ACTIONS.includes(a)) : [];
  const slots = Array.isArray(army.loadout?.slots) ? army.loadout.slots : [];
  if (slots.length > 4) problems.push('They have too many card slots.');
  slots.slice(0, 4).forEach((card, i) => {
    const problem = card === null ? null : cardProblem(card, `Their card ${i + 1}`, rules, false, learned);
    if (problem) problems.push(`${problem}.`);
  });
  const legendary = army.loadout?.legendary ?? null;
  if (legendary !== null) {
    const problem = learned.length === 0 ? 'Their Legendary card has no learned action to use' : cardProblem(legendary, 'Their Legendary card', rules, true, learned);
    if (problem) problems.push(`${problem}.`);
  }
  return problems;
}

/** Troops placed on the left, as their player set them up, moved to the same spots on the right. */
export function mirrored(placement: readonly TroopPlacement[], mapWidth: number): TroopPlacement[] {
  return placement.map((t) => ({ ...t, x: mapWidth - t.x }));
}

/**
 * The battle both games run: the host is the player's side, on the left; the guest is the
 * enemy's, its troops mirrored onto the right, commanding by hand. Both fight at the match's
 * rank, with their own Generals, specializations, reserves and learned Legendary actions.
 */
export function versusBattle(rules: MatchRules, seed: number, host: VersusArmy, guest: VersusArmy): BattleSetup {
  const map = MAPS[rules.map];
  return {
    seed,
    map,
    player: host.placement.map((t) => ({ cls: t.cls, x: t.x, y: t.y })),
    enemy: mirrored(
      guest.placement.map((t) => ({ cls: t.cls, x: t.x, y: t.y })),
      map.width,
    ),
    loadout: host.loadout,
    rank: rules.rank,
    reserves: { player: [...host.reserves], enemy: [...guest.reserves] },
    general: host.general,
    enemyGeneral: guest.general,
    enemyCommander: { rank: rules.rank, loadout: guest.loadout, human: true, learned: [...guest.learned] },
    specs: { player: host.specs, enemy: guest.specs },
    learned: [...host.learned],
  };
}
