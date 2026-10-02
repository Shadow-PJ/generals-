// Specializations on the battlefield: which one a troop has, and how it changes its stats.
// What they change about skills is in the skill code (skills.ts, rift.ts, shadowstep.ts).

import { SPECIALIZATIONS, type SpecChoice, type SpecializationId } from '../data/specializations';
import type { UnitClass, UnitStats } from '../data/units';

/** The specialization chosen for a class, or null; a choice that belongs to another class doesn't count. */
export function specFor(choice: SpecChoice, cls: UnitClass): SpecializationId | null {
  const id = choice[cls];
  return id !== undefined && SPECIALIZATIONS[id]?.cls === cls ? id : null;
}

/** A troop's stats with its specialization's changes. */
export function specStats(base: UnitStats, spec: SpecializationId | null): UnitStats {
  const stats = { ...base };
  const changes = spec ? SPECIALIZATIONS[spec].stats : undefined;
  if (!changes) return stats;
  if (changes.moveSpeed !== undefined) stats.moveSpeed *= changes.moveSpeed;
  if (changes.damage !== undefined) stats.damage *= changes.damage;
  if (changes.attacksPerSecond !== undefined) stats.attacksPerSecond *= changes.attacksPerSecond;
  if (changes.range !== undefined) stats.range *= changes.range;
  if (changes.armorPierce !== undefined) stats.armorPierce = changes.armorPierce;
  return stats;
}
