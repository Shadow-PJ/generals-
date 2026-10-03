// The Generals' troop skills: every troop of a General's side has its General's skill.
// Warlord: Vampiric Link. Engineer: Venting. Hive Mother: Assimilation. Strategist: Phase Shift
// and Conductor: Echo Strike work inside a hit, so they live in combat.ts. The Captain has none.

import { TROOP_SKILLS } from '../data/generals';
import { dealDamage } from './combat';
import { centerDistance, edgeDistance, findUnit, hpShare, livingAllies, livingEnemies, nearestTo } from './queries';
import { payHp } from './status';
import { secondsToTicks } from './time';
import type { BattleState, Unit } from './types';

/**
 * Warlord's Vampiric Link, before troops decide: a healthy troop whose skill is ready pays some
 * HP to make the nearest ally that has an enemy in reach attack much faster for a while.
 */
export function vampiricLinks(state: BattleState): void {
  const link = TROOP_SKILLS.vampiricLink;
  for (const unit of state.units) {
    if (!unit.alive || state.generals[unit.side] !== 'warlord' || unit.troopSkillCooldown > 0) continue;
    if (unit.knockback || unit.stunTicks > 0 || unit.casting || unit.wraithTicks > 0 || hpShare(unit) < link.minHpShare) continue;
    const fighting = livingAllies(state, unit).filter(
      (ally) => !ally.haste && centerDistance(unit, ally) <= link.range && livingEnemies(state, ally).some((e) => edgeDistance(ally, e) <= ally.stats.range),
    );
    const ally = nearestTo(fighting, unit.x, unit.y);
    if (!ally) continue;
    payHp(state, unit, unit.stats.maxHp * link.hpCostShare, 'drain');
    ally.haste = { bonus: link.attackSpeedBonus, ticksLeft: secondsToTicks(link.durationSeconds) };
    unit.troopSkillCooldown = secondsToTicks(link.cooldownSeconds);
    state.events.push({ tick: state.tick, type: 'skill', unitId: unit.id, skill: 'vampiricLink', targetIds: [ally.id] });
  }
}

/**
 * Engineer's Venting, after each attack: the troop heats up, and every few attacks it vents
 * (ventHeat). Thermal Detonation uses the heat.
 */
export function afterAttack(state: BattleState, unit: Unit): void {
  if (state.generals[unit.side] === 'engineer') unit.heat += 1;
}

/**
 * Engineer's Venting, once every troop has acted: each troop hot enough vents, burning the enemies
 * around it, and then takes a little damage itself. Every burn lands before anyone pays, so the HP a
 * troop keeps (it never pays its last point) doesn't depend on which side acted first.
 */
export function ventHeat(state: BattleState): void {
  const venting = TROOP_SKILLS.venting;
  const venters = state.units.filter((u) => u.alive && u.heat >= venting.everyAttacks);
  for (const unit of venters) {
    unit.heat = 0;
    const burned = livingEnemies(state, unit).filter((e) => centerDistance(unit, e) <= venting.radius + e.stats.radius);
    state.events.push({ tick: state.tick, type: 'skill', unitId: unit.id, skill: 'vent', targetIds: burned.map((e) => e.id) });
    for (const enemy of burned) dealDamage(state, unit.id, enemy, venting.damage, 0, 'vent');
  }
  for (const unit of venters) payHp(state, unit, unit.stats.maxHp * venting.selfDamageShare, 'vent');
}

/**
 * Hive Mother's Assimilation, when a troop falls: the enemy that killed it grows a shell (from a
 * Vanguard or Guardian) or claws (from anyone else) for a while. A killer falling in the same tick
 * grows nothing, whichever of the two falls is handled first.
 */
export function assimilate(state: BattleState, fallen: Unit): void {
  const killer = findUnit(state, fallen.lastHitBy);
  if (!killer?.alive || killer.hp <= 0 || killer.side === fallen.side || state.generals[killer.side] !== 'hiveMother') return;
  const assimilation = TROOP_SKILLS.assimilation;
  const kind = assimilation.shellFrom.includes(fallen.cls) ? 'shell' : 'claws';
  killer.adaptation = { kind, ticksLeft: secondsToTicks(assimilation.durationSeconds) };
  state.events.push({ tick: state.tick, type: 'skill', unitId: killer.id, skill: 'assimilation', targetIds: [fallen.id] });
}
