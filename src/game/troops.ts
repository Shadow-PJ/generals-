// Your army for a battle: the classes of your 5 troops and 3 reserves, your specializations, and
// the enemy you face. The debug Troops screen changes them until the campaign unlocks classes
// and the Tech Web sells specializations (phase 5).

import {
  STARTER_ARMY,
  STARTER_ARMY_MIRRORED,
  type TroopPlacement,
} from '../data/armies';
import type { GeneralId } from '../data/generals';
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

/**
 * The army the enemy brings: the starter army under the Captain, or a mirror of yours, with
 * your specializations and your General's troop skill and doctrine.
 */
export function enemyArmyOf(setup: MatchSetup): { placement: TroopPlacement[]; reserves: UnitClass[]; specs: SpecChoice; general: GeneralId } {
  if (setup.enemyArmy === 'starter') {
    return { placement: STARTER_ARMY_MIRRORED.map((t) => ({ ...t })), reserves: [], specs: {}, general: 'captain' };
  }
  return {
    placement: setup.placement.map((t, i) => ({ ...STARTER_ARMY_MIRRORED[i]!, cls: t.cls })),
    reserves: [...setup.reserves],
    specs: { ...setup.specs },
    general: setup.general,
  };
}

/** The troop synergies your army switches on: troops and reserves. */
export function yourSynergies(setup: MatchSetup): SynergyId[] {
  return activeSynergies([...setup.placement.map((t) => t.cls), ...setup.reserves], setup.specs);
}
