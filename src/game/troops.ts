// Your army for a battle: the classes of your 5 troops and 3 reserves, your specializations, and
// the enemy you face. The Skirmish screen changes them for a skirmish; in the campaign they come
// from your run and your Tech Web.

import type { Loadout } from '../cards/types';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED, STARTER_RESERVES, type Troop, type TroopPlacement } from '../data/armies';
import { enemyScript } from '../data/enemyScripts';
import type { GeneralId } from '../data/generals';
import type { RankNumber } from '../data/ranks';
import { OPEN_FIELD } from '../data/maps';
import { SPECIALIZATIONS_OF, type SpecChoice, type SpecializationId } from '../data/specializations';
import type { SynergyId } from '../data/synergies';
import { TROOP_CLASSES, type UnitClass } from '../data/units';
import { activeSynergies, placementProblem } from '../sim';
import type { MatchSetup } from './match';

/** The next item of a list, wrapping around; `step` -1 goes back. */
export function cycle<T>(list: readonly T[], current: T, step: number): T {
  const i = list.indexOf(current);
  return list[(((i < 0 ? 0 : i + step) % list.length) + list.length) % list.length]!;
}

/** The next class for a troop or reserve. */
export function nextClass(cls: UnitClass, step: number): UnitClass {
  return cycle(TROOP_CLASSES, cls, step);
}

/**
 * Your troops with troop `index` turned into another class. It keeps its spot if it still fits
 * there, else it goes back to its starting spot.
 */
export function withClass(placement: readonly TroopPlacement[], index: number, cls: UnitClass): TroopPlacement[] {
  const army = placement.map((t) => ({ ...t }));
  const troop = { ...army[index]!, cls };
  const others = army.filter((_, i) => i !== index);
  const fits = placementProblem(OPEN_FIELD, 'player', cls, troop.x, troop.y, others) === null;
  const start = STARTER_ARMY[index]!;
  army[index] = fits ? troop : { cls, x: start.x, y: start.y };
  return army;
}

/** A class's specialization choices in menu order: none, then its two. */
export function specOptions(cls: UnitClass): readonly (SpecializationId | null)[] {
  return [null, ...SPECIALIZATIONS_OF[cls]];
}

/** Your specializations with the one for `cls` changed. */
export function withSpec(specs: SpecChoice, cls: UnitClass, spec: SpecializationId | null): SpecChoice {
  const next = { ...specs };
  if (spec === null) delete next[cls];
  else next[cls] = spec;
  return next;
}

/** What the enemy brings to the skirmish: its army, its General, and its commander's cards if it has one. */
export interface EnemySide {
  placement: TroopPlacement[];
  reserves: (UnitClass | Troop)[];
  specs: SpecChoice;
  general: GeneralId;
  /** Its commander's rank and script, or undefined for no commander. */
  commander: { rank: RankNumber; loadout: Loadout } | undefined;
}

/**
 * The enemy you face. In a campaign fight, the one waiting at your run's node; in a skirmish,
 * the starter army or a mirror of yours (troops, reserves and specializations), under the chosen
 * enemy General, with a commander firing its General's script if you set one.
 */
export function enemyArmyOf(setup: MatchSetup): EnemySide {
  if (setup.fight) {
    const e = setup.fight.encounter;
    return {
      placement: e.troops.map((t) => ({ ...t })),
      reserves: e.reserves.map((t) => ({ ...t })),
      specs: {},
      general: e.general,
      commander: e.commander === null ? undefined : { rank: e.commander, loadout: enemyScript(e.general, e.commander) },
    };
  }
  const mirror = setup.enemyArmy === 'mirror';
  return {
    placement: mirror ? setup.placement.map((t, i) => ({ ...STARTER_ARMY_MIRRORED[i]!, cls: t.cls })) : STARTER_ARMY_MIRRORED.map((t) => ({ ...t })),
    reserves: mirror ? [...setup.reserves] : [...STARTER_RESERVES],
    specs: mirror ? { ...setup.specs } : {},
    general: setup.enemyGeneral,
    commander: setup.enemyCommander === null ? undefined : { rank: setup.enemyCommander, loadout: enemyScript(setup.enemyGeneral, setup.enemyCommander) },
  };
}

/** Your reserves: a campaign fight's reserve fighters, or the skirmish reserves. */
export function yourReserves(setup: MatchSetup): Troop[] {
  return setup.fight ? setup.fight.reserves.map((t) => ({ ...t })) : setup.reserves.map((cls) => ({ cls }));
}

/** The troop synergies your army switches on: troops and reserves. */
export function yourSynergies(setup: MatchSetup): SynergyId[] {
  return activeSynergies([...setup.placement.map((t) => t.cls), ...yourReserves(setup).map((t) => t.cls)], setup.specs);
}
