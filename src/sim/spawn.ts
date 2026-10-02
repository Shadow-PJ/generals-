// Creating troops: the armies at the start, and reserves called in during the battle.

import type { TroopPlacement } from '../data/armies';
import { UNIT_CLASSES, type TroopClass } from '../data/units';
import { isSpaceFree } from './movement';
import { nextInt, type RngState } from './rng';
import { initialSkillCooldownTicks } from './skills';
import { attackIntervalTicks } from './time';
import type { BattleState, Side, Unit } from './types';

export function createUnit(id: number, side: Side, placement: TroopPlacement, rng: RngState): Unit {
  const stats = { ...UNIT_CLASSES[placement.cls].stats };
  return {
    id,
    side,
    cls: placement.cls,
    stats,
    x: placement.x,
    y: placement.y,
    hp: stats.maxHp,
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
    lastHitBy: null,
    path: [],
    repathTick: 0,
    orders: [],
    rallyTicks: 0,
    rallyBonus: 0,
  };
}

/** How far apart the spots tried for an arriving reserve are. */
const SPAWN_STEP = 32;

/**
 * Brings in a reserve troop at its side's edge of the map: one of the asked class, or the next
 * in line when `cls` is null. Returns the new unit, or null if no such reserve is left.
 */
export function spawnReserve(state: BattleState, side: Side, cls: TroopClass | null): Unit | null {
  const waiting = state.reserves[side];
  const index = cls === null ? 0 : waiting.findIndex((c) => c === cls);
  const chosen = waiting[index];
  if (index < 0 || chosen === undefined) return null;

  const radius = UNIT_CLASSES[chosen].stats.radius;
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
  const unit = createUnit(state.units.length + 1, side, { cls: chosen, x, y }, state.rng);
  state.units.push(unit);
  state.startHp[side] += unit.stats.maxHp;
  state.events.push({ tick: state.tick, type: 'reserveCalled', side, unitId: unit.id });
  return unit;
}
