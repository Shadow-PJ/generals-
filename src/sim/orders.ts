// Card steps become orders for the troops that carry them out. Each troop works through its
// orders one after another ("Protect your Rangers, then Focus the Assassin"); a newer card
// replaces the orders of the troops it names. With no orders left, a troop acts on its own.
// A step that completes a signature combo carries the combo, which changes what it does.

import { COMBO_BONUSES, type SignatureComboId } from '../data/combos';
import { ORDER_RULES } from '../data/command';
import { UNIT_CLASSES } from '../data/units';
import { isLegendaryAction, type Actors, type Card, type Place, type Step, type Target } from '../cards/types';
import { clamp, distance, type Point } from './geometry';
import {
  centerDistance,
  edgeDistance,
  findUnit,
  hpShare,
  isHidden,
  livingAllies,
  livingEnemies,
  livingUnits,
  nearestTo,
  visibleEnemies,
} from './queries';
import { isSpaceFree } from './movement';
import { openRift, riftSpot } from './rift';
import { castShadowstep, choosePrey } from './shadowstep';
import { castBarrier, castMark, castShove, shoveTargets, skillCooldownTicks } from './skills';
import { spawnReserve } from './spawn';
import { secondsToTicks } from './time';
import type { BattleState, Side, Unit, UnitOrder } from './types';
import { attackOrApproach, type Intent, type SkillCast } from './intents';

export interface CardTriggers {
  enemyId: number | null;
  allyId: number | null;
}

/** A signature combo that the card's step `step` completes, with the step before it or the last card's. */
export interface ComboAt {
  combo: SignatureComboId;
  step: number;
  acrossCards: boolean;
}

/**
 * Gives the card's steps to the troops it names; Call Reserve happens at once. `combos` says
 * which steps complete a signature combo; `chainedReserves` are the reserves the last card of a
 * chain called in, which an Ambush across the chain moves behind the focused enemy.
 * Returns the reserves this card called in.
 */
export function issueCard(
  state: BattleState,
  side: Side,
  card: Card,
  power: number,
  triggers: CardTriggers,
  combos: readonly ComboAt[] = [],
  chainedReserves: readonly number[] = [],
): number[] {
  const comboOf = (i: number) => combos.find((c) => c.step === i)?.combo ?? null;
  const called: number[] = [];
  const queues = new Map<number, UnitOrder[]>();
  card.steps.forEach((step, i) => {
    // Ambush: the reserve arrives behind the enemy the next step focuses.
    const ambush = comboOf(i) === 'ambush' ? focusTarget(state, side, card.steps[i], triggers) : undefined;
    if (ambush) {
      const reserves = combos.find((c) => c.step === i)!.acrossCards ? chainedReserves : called.slice(-1);
      for (const id of reserves) {
        const unit = findUnit(state, id);
        if (unit?.alive) placeBehind(state, unit, ambush);
      }
    }
    if (step.action === 'callReserve') {
      const unit = spawnReserve(state, side, step.reserve);
      if (unit) called.push(unit.id);
      return;
    }
    // Legendary actions happen at once when the card fires (legendary.ts), not as troop orders.
    if (!isTroopStep(step)) return;
    for (const unit of actorsOf(state, side, step.actors)) {
      const queue = queues.get(unit.id) ?? [];
      queue.push(orderFor(step, power, triggers, comboOf(i)));
      queues.set(unit.id, queue);
    }
  });
  for (const [id, queue] of queues) {
    const unit = findUnit(state, id);
    if (unit) unit.orders = queue;
  }
  return called;
}

/** The enemy a Focus step aims at, seen from the middle of the side's army. */
function focusTarget(state: BattleState, side: Side, step: Step | undefined, triggers: CardTriggers): Unit | undefined {
  if (step?.action !== 'focus') return undefined;
  const army = livingUnits(state, side);
  if (army.length === 0) return undefined;
  return resolveEnemy(state, side, centroid(army), step.target, triggers.enemyId);
}

/** Puts a troop just past the enemy, on the far side from its own army, wherever there is room. */
function placeBehind(state: BattleState, unit: Unit, enemy: Unit): void {
  const friends = livingUnits(state, unit.side).filter((u) => u.id !== unit.id);
  const from = friends.length > 0 ? centroid(friends) : { x: unit.x, y: unit.y };
  const d = distance(from.x, from.y, enemy.x, enemy.y);
  const dx = d === 0 ? (unit.side === 'player' ? 1 : -1) : (enemy.x - from.x) / d;
  const dy = d === 0 ? 0 : (enemy.y - from.y) / d;
  const reach = enemy.stats.radius + unit.stats.radius + COMBO_BONUSES.ambush.behindDistance;
  // Straight behind first, then a little to either side.
  for (const turn of [0, 0.5, -0.5, 1, -1]) {
    const rx = dx - dy * turn;
    const ry = dy + dx * turn;
    const len = Math.sqrt(rx * rx + ry * ry);
    const spot = clampToMap(state, unit, enemy.x + (rx / len) * reach, enemy.y + (ry / len) * reach);
    if (isSpaceFree(state, spot.x, spot.y, unit.stats.radius)) {
      unit.x = spot.x;
      unit.y = spot.y;
      unit.path = [];
      return;
    }
  }
}

/** The steps troops carry out as orders: every regular action but Call Reserve. */
type TroopStep = Extract<Step, { action: UnitOrder['kind'] }>;

function isTroopStep(step: Step): step is TroopStep {
  return !isLegendaryAction(step.action) && step.action !== 'callReserve';
}

export function actorsOf(state: BattleState, side: Side, actors: Actors): Unit[] {
  const mine = livingUnits(state, side);
  if (actors.kind === 'all') return mine;
  if (actors.kind === 'class') return mine.filter((u) => u.cls === actors.cls);
  return []; // Named veterans arrive in session 5D.
}

function orderFor(
  step: TroopStep,
  power: number,
  triggers: CardTriggers,
  combo: SignatureComboId | null,
): UnitOrder {
  const base = {
    target: null as Target | null,
    place: null as Place | null,
    triggerEnemyId: triggers.enemyId,
    triggerAllyId: triggers.allyId,
    power,
    combo,
    started: false,
    ticksLeft: 0,
    unitId: null,
    point: null,
  };
  switch (step.action) {
    case 'focus':
      return { ...base, kind: 'focus', target: step.target, ticksLeft: secondsToTicks(ORDER_RULES.focusSeconds) };
    case 'protect':
      return { ...base, kind: 'protect', target: step.target, ticksLeft: secondsToTicks(ORDER_RULES.protectSeconds) };
    case 'move':
      return { ...base, kind: 'move', place: step.to, ticksLeft: secondsToTicks(ORDER_RULES.moveSeconds) };
    case 'fallBack':
      return { ...base, kind: 'fallBack', target: step.to, ticksLeft: secondsToTicks(ORDER_RULES.fallBackSeconds) };
    case 'hold':
      return { ...base, kind: 'hold', ticksLeft: secondsToTicks(ORDER_RULES.holdSeconds) };
    case 'overcharge':
      return { ...base, kind: 'overcharge' };
  }
}

/**
 * Starts, finishes and drops orders, in id order, before troops decide what to do this tick.
 * An order's target is chosen when it starts, so it fits the battle as it is by then.
 */
export function advanceOrders(state: BattleState): void {
  for (const unit of state.units) {
    if (!unit.alive) {
      unit.orders = [];
      continue;
    }
    while (unit.orders.length > 0) {
      const order = unit.orders[0]!;
      if (!order.started && !startOrder(state, unit, order)) {
        unit.orders.shift();
        continue;
      }
      if (order.kind === 'overcharge' || isFinished(state, unit, order)) {
        // Where a Move or Fall Back ends is the troop's new spot to hold (Engineer doctrine).
        if (order.kind === 'move' || order.kind === 'fallBack') unit.home = { x: unit.x, y: unit.y };
        unit.orders.shift();
        continue;
      }
      break;
    }
  }
}

/** Counts down the current order; called with the other timers. */
export function tickOrder(unit: Unit): void {
  const order = unit.orders[0];
  if (order?.started && order.ticksLeft > 0) order.ticksLeft -= 1;
}

/** Turns what the card named into a unit or a point. False if there is nothing to act on. */
function startOrder(state: BattleState, unit: Unit, order: UnitOrder): boolean {
  order.started = true;
  switch (order.kind) {
    case 'focus':
      order.unitId = resolveEnemy(state, unit.side, unit, order.target!, order.triggerEnemyId)?.id ?? null;
      if (order.combo === 'feignedRetreat') slowChasers(state, unit);
      return order.unitId !== null;
    case 'protect':
      order.unitId = resolveAlly(state, unit, order.target!, order.triggerAllyId)?.id ?? null;
      return order.unitId !== null;
    case 'fallBack':
      if (order.target) {
        order.unitId = resolveAlly(state, unit, order.target, order.triggerAllyId)?.id ?? null;
        return order.unitId !== null;
      }
      order.point = pointAway(state, unit, ORDER_RULES.fallBackDistance);
      return true;
    case 'move':
      return startMove(state, unit, order);
    case 'hold':
      return true;
    case 'overcharge':
      if (order.combo === 'overload') {
        castOvercharge(state, unit, order.power * COMBO_BONUSES.overload.powerMultiplier);
        overloadCost(state, unit);
      } else {
        const stun = order.combo === 'hammerAndAnvil' ? secondsToTicks(COMBO_BONUSES.hammerAndAnvil.stunSeconds) : 0;
        castOvercharge(state, unit, order.power, stun);
      }
      return true;
  }
}

/** Feigned Retreat: enemies close behind the troop as it turns to fight are slowed and exposed. */
function slowChasers(state: BattleState, unit: Unit): void {
  const bonus = COMBO_BONUSES.feignedRetreat;
  for (const enemy of livingEnemies(state, unit)) {
    if (centerDistance(enemy, unit) > bonus.chaseRadius) continue;
    enemy.chased = { ticksLeft: secondsToTicks(bonus.durationSeconds), slow: bonus.slow, damageTakenBonus: bonus.damageTakenBonus };
  }
}

/** Overload's price: the troop loses a share of its max HP, but never its last point. */
function overloadCost(state: BattleState, unit: Unit): void {
  const amount = Math.min(unit.hp - 1, Math.round(unit.stats.maxHp * COMBO_BONUSES.overload.selfDamageShare));
  if (amount <= 0) return;
  unit.hp -= amount;
  state.events.push({ tick: state.tick, type: 'damage', sourceId: unit.id, targetId: unit.id, amount, absorbed: 0, cause: 'overload' });
}

function startMove(state: BattleState, unit: Unit, order: UnitOrder): boolean {
  const place = order.place!;
  switch (place.kind) {
    case 'forward':
      order.point = pointAway(state, unit, -ORDER_RULES.moveDistance);
      return true;
    case 'back':
      order.point = pointAway(state, unit, ORDER_RULES.moveDistance);
      return true;
    case 'behindEnemies': {
      const enemies = livingEnemies(state, unit);
      const friends = livingUnits(state, unit.side);
      if (enemies.length === 0) return false;
      const them = centroid(enemies);
      const us = centroid(friends);
      const d = distance(us.x, us.y, them.x, them.y);
      const dx = d === 0 ? (unit.side === 'player' ? 1 : -1) : (them.x - us.x) / d;
      const dy = d === 0 ? 0 : (them.y - us.y) / d;
      order.point = clampToMap(state, unit, them.x + dx * ORDER_RULES.behindOffset, them.y + dy * ORDER_RULES.behindOffset);
      return true;
    }
    case 'ally':
      order.unitId = resolveAlly(state, unit, place.ally, order.triggerAllyId)?.id ?? null;
      return order.unitId !== null;
  }
}

function isFinished(state: BattleState, unit: Unit, order: UnitOrder): boolean {
  if (order.ticksLeft <= 0) return true;
  if (order.unitId !== null && !findUnit(state, order.unitId)?.alive) return true;
  if (order.kind === 'move' || order.kind === 'fallBack') {
    const goal = orderGoal(state, order);
    if (!goal) return true;
    const ally = order.unitId !== null ? findUnit(state, order.unitId) : undefined;
    const reach = ally ? ally.stats.radius + unit.stats.radius + ORDER_RULES.arriveDistance : ORDER_RULES.arriveDistance;
    return distance(unit.x, unit.y, goal.x, goal.y) <= reach;
  }
  return false;
}

function orderGoal(state: BattleState, order: UnitOrder): Point | null {
  if (order.point) return order.point;
  const ally = order.unitId !== null ? findUnit(state, order.unitId) : undefined;
  return ally ? { x: ally.x, y: ally.y } : null;
}

/**
 * What a troop with an order does this tick, given what it would have done on its own (`base`).
 * Skills it would cast anyway still go off, except while it is moving to a spot.
 */
export function orderIntent(state: BattleState, unit: Unit, base: Intent): Intent | null {
  const order = unit.orders[0];
  if (!order?.started) return null;
  switch (order.kind) {
    case 'focus': {
      // An invisible target can't be chased, nor one your side controls (Hijack); the troop acts
      // on its own until it shows again.
      const target = findUnit(state, order.unitId);
      if (!target?.alive || isHidden(state, target, unit) || target.hijackTicks > 0) return null;
      return { action: attackOrApproach(unit, target), cast: base.cast };
    }
    case 'move':
    case 'fallBack': {
      const goal = orderGoal(state, order);
      if (!goal) return null;
      return { action: { kind: 'walk', to: goal, targetId: order.unitId }, cast: null };
    }
    case 'hold': {
      const inReach = visibleEnemies(state, unit).filter((e) => edgeDistance(unit, e) <= unit.stats.range);
      const target = nearestTo(inReach, unit.x, unit.y);
      return { action: target ? { kind: 'attack', targetId: target.id } : { kind: 'hold' }, cast: base.cast };
    }
    case 'protect':
      return protectIntent(state, unit, order, base);
    case 'overcharge':
      return null;
  }
}

/** Stay between the ward and the enemy closest to it, and fight that enemy when it comes in reach. */
function protectIntent(state: BattleState, unit: Unit, order: UnitOrder, base: Intent): Intent | null {
  const ward = findUnit(state, order.unitId);
  if (!ward?.alive) return null;
  let cast: SkillCast | null = base.cast;
  if (unit.cls === 'guardian' && unit.skillCooldown <= 0 && !ward.barrier && ward.id !== unit.id) {
    cast = { skill: 'barrier', targetId: ward.id };
  }
  const threat = nearestTo(visibleEnemies(state, unit), ward.x, ward.y);
  if (threat && edgeDistance(unit, threat) <= unit.stats.range) {
    return { action: { kind: 'attack', targetId: threat.id }, cast };
  }
  const spot = threat ? between(ward, threat, ward.stats.radius + unit.stats.radius + 8) : { x: ward.x, y: ward.y };
  if (distance(unit.x, unit.y, spot.x, spot.y) <= ORDER_RULES.arriveDistance) return { action: { kind: 'hold' }, cast };
  return { action: { kind: 'walk', to: spot, targetId: ward.id }, cast };
}

/**
 * Overcharge: the troop's skill fires now, ignoring its usual conditions, at the order's power.
 * An Invoker's Rift opens at once, with no cast; an Assassin Shadowsteps to its prey at any
 * distance. A silenced troop can't.
 */
function castOvercharge(state: BattleState, unit: Unit, power: number, stunTicks = 0): void {
  if (unit.silencedTicks > 0) return;
  switch (unit.cls) {
    case 'vanguard':
      if (shoveTargets(state, unit).length > 0) castShove(state, unit, power, stunTicks);
      else unit.skillCooldown = 0;
      return;
    case 'ranger': {
      const inReach = visibleEnemies(state, unit).filter((e) => edgeDistance(unit, e) <= unit.stats.range);
      const target = findUnit(state, unit.targetId);
      const pick = target?.alive && inReach.includes(target) ? target : nearestTo(inReach, unit.x, unit.y);
      if (pick) castMark(state, unit, pick, power);
      else unit.skillCooldown = 0;
      return;
    }
    case 'guardian': {
      const allies = livingAllies(state, unit);
      const inRange = allies.filter((a) => centerDistance(unit, a) <= UNIT_CLASSES.guardian.barrier.range);
      const ward = inRange.filter((a) => !a.barrier).sort((a, b) => hpShare(a) - hpShare(b) || a.id - b.id)[0];
      if (ward) castBarrier(state, unit, ward, power);
      else unit.skillCooldown = 0;
      return;
    }
    case 'invoker': {
      const spot = riftSpot(state, unit, Infinity, 1);
      unit.casting = null;
      if (spot) openRift(state, unit, spot, power);
      unit.skillCooldown = spot ? skillCooldownTicks('invoker') : 0;
      return;
    }
    case 'assassin': {
      const current = findUnit(state, unit.targetId);
      const target = current?.alive && current.side !== unit.side && !isHidden(state, current, unit) ? current : choosePrey(state, unit);
      if (!target || !castShadowstep(state, unit, target, power)) unit.skillCooldown = 0;
      return;
    }
  }
}

// Choosing targets ---------------------------------------------------------------------------

/**
 * The enemy of `side` that a target names, seen from `from` (a troop, or the middle of an army).
 * Hidden enemies can't be named, nor one `side` controls (Hijack).
 */
export function resolveEnemy(state: BattleState, side: Side, from: Point, target: Target, triggerId: number | null): Unit | undefined {
  const enemies = state.units.filter((u) => u.alive && u.side !== side && u.hijackTicks <= 0 && !isHidden(state, u, from));
  switch (target.kind) {
    case 'class':
      return nearestTo(enemies.filter((e) => e.cls === target.cls), from.x, from.y);
    case 'nearest':
      return nearestTo(enemies, from.x, from.y);
    case 'weakest':
      return weakest(enemies);
    case 'trigger': {
      const u = findUnit(state, triggerId);
      return u?.alive && u.side !== side && !isHidden(state, u, from) ? u : undefined;
    }
    case 'named':
      return undefined;
  }
}

function resolveAlly(state: BattleState, unit: Unit, target: Target, triggerId: number | null): Unit | undefined {
  const allies = livingAllies(state, unit);
  switch (target.kind) {
    case 'class':
      return nearestTo(allies.filter((a) => a.cls === target.cls), unit.x, unit.y);
    case 'nearest':
      return nearestTo(allies, unit.x, unit.y);
    case 'weakest':
      return weakest(allies);
    case 'trigger': {
      const u = findUnit(state, triggerId);
      return u?.alive && u.side === unit.side && u.id !== unit.id ? u : undefined;
    }
    case 'named':
      return undefined;
  }
}

/** One of `side`'s own troops that a target names, seen from `from` (the middle of the army); `except` can't be it. */
export function resolveOwn(
  state: BattleState,
  side: Side,
  from: Point,
  target: Target,
  triggerId: number | null,
  except: number | null = null,
): Unit | undefined {
  const mine = livingUnits(state, side).filter((u) => u.id !== except);
  switch (target.kind) {
    case 'class':
      return nearestTo(mine.filter((a) => a.cls === target.cls), from.x, from.y);
    case 'nearest':
      return nearestTo(mine, from.x, from.y);
    case 'weakest':
      return weakest(mine);
    case 'trigger':
      return mine.find((u) => u.id === triggerId);
    case 'named':
      return undefined;
  }
}

function weakest(units: Unit[]): Unit | undefined {
  let best: Unit | undefined;
  for (const u of units) if (!best || hpShare(u) < hpShare(best)) best = u;
  return best;
}

// Geometry helpers -----------------------------------------------------------------------------

export function centroid(units: Unit[]): Point {
  let x = 0;
  let y = 0;
  for (const u of units) {
    x += u.x;
    y += u.y;
  }
  return { x: x / units.length, y: y / units.length };
}

/** A point `by` away from the enemy's middle (negative: toward it). */
function pointAway(state: BattleState, unit: Unit, by: number): Point {
  const enemies = livingEnemies(state, unit);
  const fallback = unit.side === 'player' ? -1 : 1;
  let dx = fallback;
  let dy = 0;
  if (enemies.length > 0) {
    const them = centroid(enemies);
    const d = distance(unit.x, unit.y, them.x, them.y);
    if (d > 0) {
      dx = (unit.x - them.x) / d;
      dy = (unit.y - them.y) / d;
    }
  }
  return clampToMap(state, unit, unit.x + dx * by, unit.y + dy * by);
}

function between(ward: Unit, threat: Unit, offset: number): Point {
  const d = distance(ward.x, ward.y, threat.x, threat.y);
  if (d === 0) return { x: ward.x, y: ward.y };
  return { x: ward.x + ((threat.x - ward.x) / d) * offset, y: ward.y + ((threat.y - ward.y) / d) * offset };
}

function clampToMap(state: BattleState, unit: Unit, x: number, y: number): Point {
  const r = unit.stats.radius;
  return { x: clamp(x, r, state.map.width - r), y: clamp(y, r, state.map.height - r) };
}
