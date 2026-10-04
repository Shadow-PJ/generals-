// Faction bonuses in battle (session 5C). Each side counts its fighters of each faction (troops
// and reserves, plus faction boons); at 2, 4 and 6 the faction's bonus switches on for the troops
// of that faction, stronger at each step:
// Bloodbound heal from the damage they deal, Forgeborn harden with every attack, Hive hit harder
// for every Hive ally still standing, Voidweavers phase out of every few hits, and every 3rd
// attack of a Resonance troop resonates for more damage.

import type { Troop } from '../data/armies';
import { BOONS, type BoonId } from '../data/boons';
import { FACTION_IDS, FACTION_RULES, factionTier, factionValue, type FactionId } from '../data/factions';
import type { BattleState, Side, Unit } from './types';

/** How many fighters of each faction an army counts: its troops and reserves, plus its faction boons. */
export function factionCounts(troops: readonly Troop[], boons: readonly BoonId[]): Partial<Record<FactionId, number>> {
  const counts: Partial<Record<FactionId, number>> = {};
  for (const t of troops) if (t.faction) counts[t.faction] = (counts[t.faction] ?? 0) + 1;
  const effects = boons.flatMap((id) => [...(BOONS[id]?.effects ?? [])]);
  for (const e of effects) if (e.kind === 'faction') counts[e.faction] = (counts[e.faction] ?? 0) + e.count;
  // The faction you field most of (the first in faction order on a tie) counts a little more.
  const largest = FACTION_IDS.reduce<FactionId | null>((best, f) => ((counts[f] ?? 0) > (best ? (counts[best] ?? 0) : 0) ? f : best), null);
  for (const e of effects) if (e.kind === 'largestFaction' && largest) counts[largest] = (counts[largest] ?? 0) + e.count;
  return counts;
}

/** The step (0 to 3) of a faction's bonus on a side. */
export function tierOf(state: BattleState, side: Side, faction: FactionId): number {
  return factionTier(state.factions[side][faction] ?? 0);
}

/** The faction bonus's number for this troop, if it belongs to `faction` and its side has the bonus on; else 0. */
function bonusFor(state: BattleState, unit: Unit, faction: FactionId): number {
  return unit.faction === faction ? factionValue(faction, tierOf(state, unit.side, faction)) : 0;
}

/** Share of the damage the troop's attacks deal that it heals: its own, plus Bloodbound. */
export function lifestealOf(state: BattleState, unit: Unit): number {
  return unit.lifesteal + bonusFor(state, unit, 'bloodbound');
}

/**
 * How many times harder the troop's attack hits: Hive for every other Hive troop of its side still
 * standing, and Resonance on every 3rd attack. Counts the attack for Resonance.
 */
export function factionAttackFactor(state: BattleState, unit: Unit): number {
  let factor = 1;
  const swarm = bonusFor(state, unit, 'hive');
  if (swarm > 0) {
    const others = state.units.filter((u) => u.alive && u.side === unit.side && u.id !== unit.id && u.faction === 'hive').length;
    factor *= 1 + swarm * others;
  }
  unit.attacksMade += 1;
  const resonance = bonusFor(state, unit, 'resonance');
  if (resonance > 0 && unit.attacksMade % FACTION_RULES.resonanceEvery === 0) factor *= 1 + resonance;
  return factor;
}

/** Forgeborn: an attack hardens the troop, up to its bonus's cap. */
export function forgeAfterAttack(state: BattleState, unit: Unit): void {
  const cap = bonusFor(state, unit, 'forgeborn');
  if (cap > 0) unit.forgeArmor = Math.min(cap, unit.forgeArmor + FACTION_RULES.forgeArmorPerAttack);
}

/** Voidweavers: counts a hit from an attack, and true if the troop phases out of this one. */
export function phasesOut(state: BattleState, unit: Unit): boolean {
  const every = bonusFor(state, unit, 'voidweavers');
  if (every <= 0) return false;
  unit.hitsTaken += 1;
  return unit.hitsTaken % every === 0;
}
