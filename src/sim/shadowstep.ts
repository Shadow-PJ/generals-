// The Assassin: whom it hunts, and Shadowstep, its skill. It blinks behind its prey, strikes, and
// executes the prey if the strike leaves it low. Blades strike harder and execute sooner;
// Saboteurs silence their prey.

import { SPEC_RULES } from '../data/specializations';
import { UNIT_CLASSES } from '../data/units';
import { critMultiplier, dealDamage, rollDamage } from './combat';
import { clamp, distance, type Point } from './geometry';
import { isSpaceFree } from './movement';
import { findUnit, hpShare, mostHurt, visibleEnemies } from './queries';
import { skillCooldownTicks } from './skills';
import { silence } from './status';
import { attackIntervalTicks, secondsToTicks } from './time';
import type { BattleState, Unit } from './types';

/**
 * Whom the Assassin hunts: Guardians first, then the other backline troops (Rangers and
 * Invokers), then anyone; the weakest of them. It keeps its prey while the prey stays in the
 * first group that has anyone in it.
 */
export function choosePrey(state: BattleState, assassin: Unit): Unit | undefined {
  const enemies = visibleEnemies(state, assassin);
  const groups = [
    enemies.filter((e) => e.cls === 'guardian'),
    enemies.filter((e) => e.cls === 'ranger' || e.cls === 'invoker'),
    enemies,
  ];
  const current = findUnit(state, assassin.targetId);
  for (const group of groups) {
    if (group.length === 0) continue;
    if (current && group.includes(current)) return current;
    return mostHurt(group);
  }
  return undefined;
}

/** Where the Assassin lands: just past the target, on the far side from where it stands now. */
export function spotBehind(state: BattleState, assassin: Unit, target: Unit): Point | null {
  const d = distance(assassin.x, assassin.y, target.x, target.y);
  const dx = d === 0 ? (assassin.side === 'player' ? 1 : -1) : (target.x - assassin.x) / d;
  const dy = d === 0 ? 0 : (target.y - assassin.y) / d;
  const reach = target.stats.radius + assassin.stats.radius + 2;
  const r = assassin.stats.radius;
  // Straight behind first, then a little to either side.
  for (const turn of [0, 0.5, -0.5, 1, -1]) {
    const rx = dx - dy * turn;
    const ry = dy + dx * turn;
    const len = Math.sqrt(rx * rx + ry * ry);
    const x = clamp(target.x + (rx / len) * reach, r, state.map.width - r);
    const y = clamp(target.y + (ry / len) * reach, r, state.map.height - r);
    if (isSpaceFree(state, x, y, r)) return { x, y };
  }
  return null;
}

/**
 * Shadowstep: blink behind the target and strike it at once; a target left below the execute
 * share of its HP dies. `power` above 1 (a Perfect Overcharge, Overload) strikes harder.
 * False, and nothing happens, if there is no room behind the target.
 */
export function castShadowstep(state: BattleState, assassin: Unit, target: Unit, power = 1): boolean {
  const spot = spotBehind(state, assassin, target);
  if (!spot) return false;
  const shadowstep = UNIT_CLASSES.assassin.shadowstep;
  const blade = assassin.spec === 'blade';
  assassin.x = spot.x;
  assassin.y = spot.y;
  assassin.path = [];
  assassin.targetId = target.id;
  assassin.skillCooldown = skillCooldownTicks('assassin');
  assassin.attackCooldown = attackIntervalTicks(assassin.stats.attacksPerSecond);
  state.events.push({ tick: state.tick, type: 'skill', unitId: assassin.id, skill: 'shadowstep', targetIds: [target.id] });

  const strike = blade ? SPEC_RULES.blade.strikeMultiplier : shadowstep.strikeMultiplier;
  const raw = rollDamage(state, assassin.stats.damage) * strike * power * critMultiplier(state, assassin, target);
  dealDamage(state, assassin.id, target, raw, assassin.stats.armorPierce, 'shadowstep');

  const executeShare = blade ? SPEC_RULES.blade.executeShare : shadowstep.executeShare;
  if (target.alive && target.hp > 0 && hpShare(target) < executeShare) {
    const amount = target.hp;
    target.hp = 0;
    target.lastHitBy = assassin.id;
    state.events.push({ tick: state.tick, type: 'damage', sourceId: assassin.id, targetId: target.id, amount, absorbed: 0, cause: 'execute' });
  }
  if (assassin.spec === 'saboteur' && target.hp > 0) {
    silence(state, target, secondsToTicks(SPEC_RULES.saboteur.silenceSeconds), assassin.id);
  }
  return true;
}
