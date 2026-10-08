// Your side of a versus match (session 6D): your skirmish army and cards set up under the
// match's rules, and the army your game sends the other player's. Pure.

import { STARTER_ARMY, type TroopPlacement } from '../data/armies';
import { learnedActions } from '../data/legendary';
import { MAPS, type MapData } from '../data/maps';
import { isArmyPlaced } from '../sim';
import { armyProblems, cardsOnly } from '../versus/army';
import type { MatchRules, VersusArmy } from '../versus/messages';
import type { MatchSetup } from './match';

/** Your troops where they stood, if they fit the match's map; else at the starting spots, same classes. */
function placedOn(map: MapData, placement: readonly TroopPlacement[]): TroopPlacement[] {
  const troops = placement.map(({ cls, x, y }) => ({ cls, x, y }));
  if (troops.length === STARTER_ARMY.length && isArmyPlaced(map, 'player', troops)) return troops;
  const starting = STARTER_ARMY.map((t, i) => ({ cls: troops[i]?.cls ?? t.cls, x: t.x, y: t.y }));
  return isArmyPlaced(map, 'player', starting) ? starting : STARTER_ARMY.map(({ cls, x, y }) => ({ cls, x, y }));
}

/**
 * Your setup for a versus match: your skirmish army, reserves, specializations, General and cards,
 * on the match's map at its rank. Versus has no practice rank, no Tactical mode and no campaign.
 */
export function versusSetup(saved: MatchSetup, rules: MatchRules): MatchSetup {
  const { returnTo: _returnTo, ...setup } = saved;
  return {
    ...setup,
    versus: { ...rules },
    map: rules.map,
    rank: rules.rank,
    practiceRank: null,
    tactical: false,
    fight: null,
    placement: placedOn(MAPS[rules.map], saved.placement),
  };
}

/** The army your game sends: troops, reserves, specializations, General, cards (not the words you typed for them) and the Legendary actions you know. */
export function versusArmy(setup: MatchSetup): VersusArmy {
  return {
    general: setup.general,
    placement: setup.placement.map(({ cls, x, y }) => ({ cls, x, y })),
    reserves: [...setup.reserves],
    specs: { ...setup.specs },
    loadout: cardsOnly(setup.loadout),
    learned: learnedActions(setup.bossesBeaten),
  };
}

/** What would make the other game turn your army down, in words to you; empty when it may play. */
export function yourArmyProblems(setup: MatchSetup): string[] {
  return setup.versus ? armyProblems(versusArmy(setup), setup.versus, 'yours') : [];
}
