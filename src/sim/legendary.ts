// Legendary actions (session 5A): taught by boss Generals, fired from the Legendary slot. The
// commander does them at once when the card fires, before the card's other steps become troop
// orders. A card waits (it can't fire) while one of its Legendary actions has nothing to work on.

import { COMMAND_RULES } from '../data/command';
import { LEGENDARY_RULES } from '../data/legendary';
import type { Rect } from '../data/maps';
import { isLegendaryAction, type Card, type Place, type Step } from '../cards/types';
import { circleOverlapsRect, clamp, distance, type Point } from './geometry';
import { HOLD, attackOrApproach, type Intent } from './intents';
import { actorsOf, centroid, issueCard, resolveEnemy, resolveOwn, type CardTriggers } from './orders';
import { livingUnits, nearestTo } from './queries';
import { secondsToTicks } from './time';
import type { BattleState, CommandState, Side, Unit } from './types';
import { rebuildNav } from './walls';

type LegendaryStep = Extract<Step, { action: 'hijack' | 'swap' | 'bloodPact' | 'fortify' | 'echo' }>;

function legendarySteps(card: Card): LegendaryStep[] {
  return card.steps.filter((s): s is LegendaryStep => isLegendaryAction(s.action));
}

/** True if every Legendary action on the card has something to work on now. */
export function legendaryReady(state: BattleState, command: CommandState, card: Card, triggers: CardTriggers): boolean {
  return legendarySteps(card).every((step) => usable(state, command, step, triggers));
}

function usable(state: BattleState, command: CommandState, step: LegendaryStep, triggers: CardTriggers): boolean {
  const side = command.side;
  switch (step.action) {
    case 'hijack':
      return hijackTarget(state, side, step, triggers) !== undefined;
    case 'swap':
      return swapPair(state, side, step, triggers) !== null;
    case 'bloodPact':
      // Never your last troop: that would lose the battle.
      return livingUnits(state, side).length > 1 && sacrifice(state, side, step, triggers) !== undefined;
    case 'fortify':
      return livingUnits(state, side).length > 0;
    case 'echo':
      return command.lastCard !== null;
  }
}

/** Carries out the card's Legendary actions, in order. `power` is above 1 after a Perfect timing. */
export function castLegendary(state: BattleState, command: CommandState, card: Card, triggers: CardTriggers, power: number): void {
  for (const step of legendarySteps(card)) {
    if (usable(state, command, step, triggers)) cast(state, command, step, triggers, power);
  }
}

function cast(state: BattleState, command: CommandState, step: LegendaryStep, triggers: CardTriggers, power: number): void {
  const side = command.side;
  const note = (unitIds: number[], extra: { wallId?: number; at?: Point } = {}) =>
    state.events.push({ tick: state.tick, type: 'legendary', side, action: step.action, unitIds, ...extra });
  switch (step.action) {
    case 'hijack': {
      const target = hijackTarget(state, side, step, triggers)!;
      target.hijackTicks = Math.round(secondsToTicks(LEGENDARY_RULES.hijack.seconds) * power);
      target.orders = [];
      target.casting = null;
      target.taunt = null;
      target.path = [];
      note([target.id]);
      return;
    }
    case 'swap': {
      const [a, b] = swapPair(state, side, step, triggers)!;
      [a.x, a.y, b.x, b.y] = [b.x, b.y, a.x, a.y];
      a.path = [];
      b.path = [];
      note([a.id, b.id]);
      return;
    }
    case 'bloodPact': {
      const victim = sacrifice(state, side, step, triggers)!;
      state.events.push({ tick: state.tick, type: 'damage', sourceId: victim.id, targetId: victim.id, amount: victim.hp, absorbed: 0, cause: 'sacrifice' });
      // It falls at the end of the tick, given up rather than killed.
      victim.hp = 0;
      victim.wraithTicks = 0;
      victim.lastHitBy = null;
      command.pips = command.maxPips;
      command.pipProgress = 0;
      command.momentum = COMMAND_RULES.momentum.max;
      note([victim.id]);
      return;
    }
    case 'fortify': {
      const wall = raiseWall(state, side, step.at, triggers, power);
      if (wall) note([], { wallId: wall.id, at: { x: wall.x + wall.w / 2, y: wall.y + wall.h / 2 } });
      return;
    }
    case 'echo': {
      // The last card again, as the General read it, for free: its troops get their orders again.
      const last = command.lastCard!;
      issueCard(state, side, last.card, power, { enemyId: last.triggerEnemyId, allyId: last.triggerAllyId });
      note([]);
      return;
    }
  }
}

// Hijack ---------------------------------------------------------------------------------------

function hijackTarget(state: BattleState, side: Side, step: Extract<Step, { action: 'hijack' }>, triggers: CardTriggers): Unit | undefined {
  const army = livingUnits(state, side);
  if (army.length === 0) return undefined;
  return resolveEnemy(state, side, centroid(army), step.target, triggers.enemyId);
}

/**
 * A hijacked troop attacks the nearest troop of its own army; it uses no skills. Its army
 * doesn't fight back, and yours leaves it alone (queries.ts) until control runs out.
 */
export function hijackIntent(state: BattleState, unit: Unit): Intent | null {
  if (unit.hijackTicks <= 0) return null;
  const own = livingUnits(state, unit.side).filter((u) => u.id !== unit.id);
  const target = nearestTo(own, unit.x, unit.y);
  return target ? { action: attackOrApproach(unit, target), cast: null } : HOLD;
}

// Swap -----------------------------------------------------------------------------------------

/** The ally the step names, and the actor nearest to it (never the same troop). */
function swapPair(state: BattleState, side: Side, step: Extract<Step, { action: 'swap' }>, triggers: CardTriggers): [Unit, Unit] | null {
  const army = livingUnits(state, side);
  if (army.length < 2) return null;
  const middle = centroid(army);
  // The other troop first, then the nearest actor to it; if the target is one of the actors,
  // it trades with the nearest other actor.
  const other = resolveOwn(state, side, middle, step.target, triggers.allyId);
  if (!other) return null;
  const mover = nearestTo(actorsOf(state, side, step.actors).filter((u) => u.id !== other.id), other.x, other.y);
  return mover ? [mover, other] : null;
}

// Blood Pact -------------------------------------------------------------------------------------

function sacrifice(state: BattleState, side: Side, step: Extract<Step, { action: 'bloodPact' }>, triggers: CardTriggers): Unit | undefined {
  const army = livingUnits(state, side);
  if (army.length === 0) return undefined;
  return resolveOwn(state, side, centroid(army), step.target, triggers.allyId);
}

// Fortify --------------------------------------------------------------------------------------

/** Raises a wall line across the way between the armies, at the place the card names. */
function raiseWall(state: BattleState, side: Side, at: Place, triggers: CardTriggers, power: number) {
  const rules = LEGENDARY_RULES.fortify;
  const mine = livingUnits(state, side);
  if (mine.length === 0) return null;
  const theirs = state.units.filter((u) => u.alive && u.side !== side);
  const us = centroid(mine);
  const them = theirs.length > 0 ? centroid(theirs) : { x: side === 'player' ? state.map.width : 0, y: us.y };
  let dir = direction(us, them, side);
  let middle: Point;
  switch (at.kind) {
    case 'forward':
      middle = { x: us.x + dir.x * rules.armyOffset, y: us.y + dir.y * rules.armyOffset };
      break;
    case 'back':
      middle = { x: us.x - dir.x * rules.armyOffset, y: us.y - dir.y * rules.armyOffset };
      break;
    case 'behindEnemies':
      middle = { x: them.x + dir.x * rules.behindOffset, y: them.y + dir.y * rules.behindOffset };
      break;
    case 'ally': {
      const ally = resolveOwn(state, side, us, at.ally, triggers.allyId);
      if (!ally) return null;
      const threat = nearestTo(theirs, ally.x, ally.y);
      if (threat) dir = direction(ally, threat, side);
      middle = { x: ally.x + dir.x * rules.allyOffset, y: ally.y + dir.y * rules.allyOffset };
      break;
    }
  }
  // Across the way: upright when the armies face each other left and right, lying down otherwise.
  const upright = Math.abs(dir.x) >= Math.abs(dir.y);
  const w = upright ? rules.thickness : rules.length;
  const h = upright ? rules.length : rules.thickness;
  const rect: Rect = {
    x: clamp(middle.x - w / 2, 0, state.map.width - w),
    y: clamp(middle.y - h / 2, 0, state.map.height - h),
    w,
    h,
  };
  pushOutOf(state, rect, upright);
  const wall = {
    id: state.walls.length + 1,
    ...rect,
    hp: rules.hp,
    maxHp: rules.hp,
    unbreakable: false,
    ticksLeft: Math.round(secondsToTicks(rules.seconds) * power),
  };
  state.walls.push(wall);
  rebuildNav(state);
  return wall;
}

/**
 * Troops standing where the wall rises step out of it, to their own army's side of it (the side
 * the middle of their army is on), so the wall parts the armies rather than trapping anyone.
 */
function pushOutOf(state: BattleState, rect: Rect, upright: boolean): void {
  const middle = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  const near = (p: Point) => (upright ? p.x < middle.x : p.y < middle.y);
  const armySide = new Map<Side, boolean>();
  for (const side of ['player', 'enemy'] as const) {
    const army = livingUnits(state, side);
    if (army.length > 0) armySide.set(side, near(centroid(army)));
  }
  for (const u of state.units) {
    if (!u.alive) continue;
    const r = u.stats.radius;
    if (!circleOverlapsRect(u.x, u.y, r, rect)) continue;
    const toNear = armySide.get(u.side) ?? near(u);
    if (upright) u.x = clamp(toNear ? rect.x - r - 1 : rect.x + rect.w + r + 1, r, state.map.width - r);
    else u.y = clamp(toNear ? rect.y - r - 1 : rect.y + rect.h + r + 1, r, state.map.height - r);
    u.path = [];
  }
}

/** Fortify walls fall when their time is up. */
export function ageWalls(state: BattleState): void {
  let fell = false;
  for (const wall of state.walls) {
    if (wall.ticksLeft === null || wall.hp <= 0) continue;
    wall.ticksLeft -= 1;
    if (wall.ticksLeft <= 0) {
      wall.hp = 0;
      fell = true;
    }
  }
  if (fell) rebuildNav(state);
}

/** The direction from `a` to `b`, or straight at the enemy's side of the map when they meet. */
function direction(a: Point, b: Point, side: Side): Point {
  const d = distance(a.x, a.y, b.x, b.y);
  if (d === 0) return { x: side === 'player' ? 1 : -1, y: 0 };
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}
