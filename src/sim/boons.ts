// Run fighters, perks and boons in battle (sessions 5B, 5C and 5E): a troop's rarity, perks,
// artifact and its class's Tech Web raise its stats, and a side's boons raise its troops' stats,
// bring their skills back sooner, let them heal from the damage they deal, and give its Command
// bar pips and Momentum. The battle reads them from the setup as plain ids and looks every number
// up in src/data.

import type { Troop } from '../data/armies';
import { ARTIFACTS } from '../data/artifacts';
import { BOONS, type BoonEffect, type BoonId, type BoonStat } from '../data/boons';
import { PERKS, type PerkEffect, type PerkId } from '../data/perks';
import { RARITY_RULES, type Rarity } from '../data/rarity';
import { TECH_NODES, type TechNodeId } from '../data/tech';
import type { UnitClass, UnitStats } from '../data/units';

function effects(boons: readonly BoonId[]): BoonEffect[] {
  return boons.flatMap((id) => [...(BOONS[id]?.effects ?? [])]);
}

function perkEffects(perks: readonly PerkId[]): PerkEffect[] {
  return perks.flatMap((id) => (PERKS[id] ? [PERKS[id].effect] : []));
}

/** Everything that makes one troop better: its perks, the artifact it carries and what its class has of the Tech Web. */
export function troopEffects(troop: Pick<Troop, 'perks' | 'artifact'>, tech: readonly TechNodeId[] = []): PerkEffect[] {
  const artifact = troop.artifact ? (ARTIFACTS[troop.artifact]?.effects ?? []) : [];
  return [...perkEffects(troop.perks ?? []), ...artifact, ...tech.flatMap((id) => (TECH_NODES[id] ? [TECH_NODES[id].effect] : []))];
}

/** The share of max HP a troop gets back up with once, instead of falling (a Phoenix Feather); 0 for none. */
export function troopRevive(own: readonly PerkEffect[]): number {
  return own.reduce((most, e) => (e.kind === 'revive' ? Math.max(most, e.hp) : most), 0);
}

/** True if a boon effect with this class filter helps a troop of `cls`. */
function helps(filter: UnitClass | null, cls: UnitClass): boolean {
  return filter === null || filter === cls;
}

/**
 * A troop's stats with its rarity, its own effects (perks, artifact, Tech Web) and its side's
 * boons added. Bonuses for the same stat add up; armor from its effects is added to the troop's own.
 */
export function boostedStats(stats: UnitStats, cls: UnitClass, rarity: Rarity, boons: readonly BoonId[], own: readonly PerkEffect[] = []): UnitStats {
  const boosted = { ...stats };
  const rarityBonus = RARITY_RULES[rarity].statBonus;
  const bonus: Record<BoonStat, number> = { damage: rarityBonus, maxHp: rarityBonus, moveSpeed: 0, attacksPerSecond: 0, range: 0 };
  for (const effect of effects(boons)) {
    if (effect.kind === 'stat' && helps(effect.cls, cls)) bonus[effect.stat] += effect.bonus;
  }
  let armor = 0;
  let ward = 0;
  for (const effect of own) {
    if (effect.kind === 'stat') bonus[effect.stat] += effect.bonus;
    if (effect.kind === 'armor') armor += effect.amount;
    if (effect.kind === 'areaWard') ward += effect.cut;
  }
  for (const stat of Object.keys(bonus) as BoonStat[]) boosted[stat] *= 1 + bonus[stat];
  boosted.maxHp = Math.round(boosted.maxHp);
  boosted.armor = Math.min(0.9, boosted.armor + armor);
  boosted.areaDamageTaken *= 1 - Math.min(0.9, ward);
  return boosted;
}

/** Share of the damage a troop's attacks deal that it heals, from its perks and its side's boons. */
export function troopLifesteal(cls: UnitClass, boons: readonly BoonId[], own: readonly PerkEffect[] = []): number {
  const fromBoons = effects(boons).reduce((sum, e) => sum + (e.kind === 'lifesteal' && helps(e.cls, cls) ? e.share : 0), 0);
  const fromPerks = own.reduce((sum, e) => sum + (e.kind === 'lifesteal' ? e.share : 0), 0);
  return fromBoons + fromPerks;
}

/** How much sooner a troop's skill comes back, from its perks and its side's boons; never more than half. */
export function troopSkillHaste(cls: UnitClass, boons: readonly BoonId[], own: readonly PerkEffect[] = []): number {
  const fromBoons = effects(boons).reduce((sum, e) => sum + (e.kind === 'skillHaste' && helps(e.cls, cls) ? e.cut : 0), 0);
  const fromPerks = own.reduce((sum, e) => sum + (e.kind === 'skillHaste' ? e.cut : 0), 0);
  return Math.min(0.5, fromBoons + fromPerks);
}

/** Extra pips every battle starts with. */
export function extraStartingPips(boons: readonly BoonId[]): number {
  return effects(boons).reduce((sum, e) => sum + (e.kind === 'startPips' ? e.amount : 0), 0);
}

/** Extra pips you can hold. */
export function extraMaxPips(boons: readonly BoonId[]): number {
  return effects(boons).reduce((sum, e) => sum + (e.kind === 'maxPips' ? e.amount : 0), 0);
}

/** Momentum every battle starts with. */
export function startingMomentum(boons: readonly BoonId[]): number {
  return effects(boons).reduce((sum, e) => sum + (e.kind === 'startMomentum' ? e.amount : 0), 0);
}

/** How much faster pips refill (0.25 = 25%). */
export function pipRateBonus(boons: readonly BoonId[]): number {
  return effects(boons).reduce((sum, e) => sum + (e.kind === 'pipRate' ? e.bonus : 0), 0);
}
