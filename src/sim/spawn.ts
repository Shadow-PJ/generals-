// Creating troops: the armies at the start, and reserves called in during the battle.

import type { TroopPlacement } from '../data/armies';
import type { BoonId } from '../data/boons';
import { BOSS_RULES } from '../data/bosses';
import type { MapData } from '../data/maps';
import { TROOP_SKILLS, type GeneralId } from '../data/generals';
import type { SpecializationId } from '../data/specializations';
import { UNIT_CLASSES, type TroopClass } from '../data/units';
import { boostedStats, troopLifesteal, troopSkillHaste } from './boons';
import { prepareForBoss } from './bosses';
import { isSpaceFree } from './movement';
import { nextInt, type RngState } from './rng';
import { initialSkillCooldownTicks } from './skills';
import { specFor, specStats } from './specs';
import { attackIntervalTicks, secondsToTicks } from './time';
import type { BattleState, Side, Unit } from './types';

export function createUnit(
  id: number,
  side: Side,
  placement: TroopPlacement,
  rng: RngState,
  spec: SpecializationId | null = null,
  general: GeneralId = 'captain',
  map: MapData | null = null,
  boons: readonly BoonId[] = [],
): Unit {
  const rarity = placement.rarity ?? 'common';
  const perks = placement.perks ?? [];
  const stats = boostedStats(specStats(UNIT_CLASSES[placement.cls].stats, spec), placement.cls, rarity, boons, perks);
  // Open ground (Glass Plains): ranged troops reach further.
  if (stats.projectileSpeed > 0 && map?.rangedReachBonus) stats.range *= 1 + map.rangedReachBonus;
  // A turret (the Engineer's boss fight): tougher and longer-reaching, but weak to area damage.
  if (placement.turret) {
    const t = BOSS_RULES.engineer.turret;
    stats.maxHp = Math.round(stats.maxHp * (1 + t.maxHp));
    stats.armor = Math.min(0.9, stats.armor + t.armor);
    stats.range *= 1 + t.range;
    stats.areaDamageTaken *= t.areaDamageTaken;
  }
  const unit: Unit = {
    id,
    side,
    cls: placement.cls,
    stats,
    spec,
    x: placement.x,
    y: placement.y,
    // A run fighter still hurt from an earlier fight starts with part of its HP, never none.
    hp: Math.max(1, Math.round(stats.maxHp * Math.min(1, Math.max(0, placement.hp ?? 1)))),
    alive: true,
    targetId: null,
    // Spread first attacks out so a whole army doesn't swing on the same tick.
    attackCooldown: nextInt(rng, attackIntervalTicks(stats.attacksPerSecond)),
    skillCooldown: initialSkillCooldownTicks(placement.cls),
    mark: null,
    barrier: null,
    chased: null,
    knockback: null,
    stunTicks: 0,
    slow: null,
    taunt: null,
    silencedTicks: 0,
    invisibleTicks: 0,
    regen: null,
    casting: null,
    home: { x: placement.x, y: placement.y },
    troopSkillCooldown: secondsToTicks(TROOP_SKILLS.vampiricLink.initialCooldownSeconds),
    haste: null,
    heat: 0,
    adaptation: null,
    phaseShiftUsed: false,
    phasingFrom: null,
    vibration: null,
    shatterTicks: 0,
    wraithTicks: 0,
    elite: false,
    lastHitBy: null,
    path: [],
    repathTick: 0,
    orders: [],
    rallyTicks: 0,
    rallyBonus: 0,
    hijackTicks: 0,
    rarity,
    fighterId: placement.fighterId ?? null,
    faction: placement.faction ?? null,
    lifesteal: troopLifesteal(placement.cls, boons, perks),
    skillHaste: troopSkillHaste(placement.cls, boons, perks),
    forgeArmor: 0,
    hitsTaken: 0,
    attacksMade: 0,
    rooted: placement.turret ?? false,
    bossPhases: 0,
    rage: null,
  };
  // Warlord doctrine: Assassins dive at once.
  if (general === 'warlord' && unit.cls === 'assassin') unit.skillCooldown = 0;
  return unit;
}

/** How far apart the spots tried for an arriving reserve are. */
const SPAWN_STEP = 32;

/**
 * Brings in a reserve troop at its side's edge of the map: one of the asked class, or the next
 * in line when `cls` is null. Returns the new unit, or null if no such reserve is left.
 */
export function spawnReserve(state: BattleState, side: Side, cls: TroopClass | null): Unit | null {
  const waiting = state.reserves[side];
  const index = cls === null ? 0 : waiting.findIndex((t) => t.cls === cls);
  const chosen = waiting[index];
  if (index < 0 || chosen === undefined) return null;

  const radius = UNIT_CLASSES[chosen.cls].stats.radius;
  const zone = state.map.deployZones[side];
  const x = side === 'player' ? zone.x + radius + 4 : zone.x + zone.w - radius - 4;
  const midY = zone.y + zone.h / 2;
  let y: number | null = null;
  for (let i = 0; i * SPAWN_STEP <= zone.h / 2 && y === null; i++) {
    for (const candidate of i === 0 ? [midY] : [midY - i * SPAWN_STEP, midY + i * SPAWN_STEP]) {
      const clear = state.units.every((u) => !u.alive || Math.abs(u.x - x) + Math.abs(u.y - candidate) > radius * 3);
      if (clear && isSpaceFree(state, x, candidate, radius)) {
        y = candidate;
        break;
      }
    }
  }
  if (y === null) y = midY;

  waiting.splice(index, 1);
  const spec = specFor(state.specs[side], chosen.cls);
  const unit = createUnit(state.units.length + 1, side, { ...chosen, x, y }, state.rng, spec, state.generals[side], state.map, state.boons[side]);
  prepareForBoss(state, unit);
  state.units.push(unit);
  state.startHp[side] += unit.hp;
  state.events.push({ tick: state.tick, type: 'reserveCalled', side, unitId: unit.id });
  return unit;
}
