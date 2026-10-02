// Troop synergies: pairs of classes in an army that trigger effects by themselves. They are
// switched on when the battle starts, from the troops on the field and in reserve; each logs a
// 'synergy' event the first time it takes effect, for the Combo Codex.

import type { SpecChoice } from '../data/specializations';
import { SYNERGIES, type SynergyId } from '../data/synergies';
import type { UnitClass } from '../data/units';
import { specFor } from './specs';
import type { BattleState, Side } from './types';

/** The synergies an army switches on: both classes are in it (and the second has the named specialization). */
export function activeSynergies(classes: readonly UnitClass[], specs: SpecChoice): SynergyId[] {
  return SYNERGIES.filter((s) => {
    const [a, b] = s.classes;
    if (!classes.includes(a) || !classes.includes(b)) return false;
    return s.spec === undefined || specFor(specs, b) === s.spec;
  }).map((s) => s.id);
}

export function hasSynergy(state: BattleState, side: Side, id: SynergyId): boolean {
  return state.synergies[side].includes(id);
}

/** Logs that a synergy took effect, the first time it does in this battle. */
export function noteSynergy(state: BattleState, side: Side, id: SynergyId): void {
  if (state.synergiesSeen[side].includes(id)) return;
  state.synergiesSeen[side].push(id);
  state.events.push({ tick: state.tick, type: 'synergy', side, synergy: id });
}
