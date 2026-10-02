// The battle loop: create a battle from a setup, then advance it one fixed tick at a time.

import { BATTLE_RULES } from '../data/battle';
import { think, type Action, type SkillCast } from './behaviors';
import { applyInput, createCommand, updateCommand } from './command';
import { performAttack, updateProjectiles } from './combat';
import { isSpaceFree, moveUnitBy, separateUnits, stepAwayFrom, updateKnockbacks, walkToward } from './movement';
import { advanceOrders, orderIntent, tickOrder } from './orders';
import { overtimeStartTick } from './overtime';
import { findUnit, livingUnits } from './queries';
import { createRng } from './rng';
import { castBarrier, castMark, castShove } from './skills';
import { createUnit } from './spawn';
import { secondsToTicks } from './time';
import {
  SIDES,
  type BattleInput,
  type BattleSetup,
  type BattleState,
  type Side,
  type Unit,
  type Wall,
  type Winner,
} from './types';
import { rebuildNav } from './walls';

export function createBattle(setup: BattleSetup): BattleState {
  const rng = createRng(setup.seed);
  const units: Unit[] = [];

  // Ids alternate between the sides (player, enemy, player, ...) so neither side always acts first.
  const count = Math.max(setup.player.length, setup.enemy.length);
  for (let i = 0; i < count; i++) {
    for (const side of SIDES) {
      const placement = setup[side][i];
      if (placement) units.push(createUnit(units.length + 1, side, placement, rng));
    }
  }

  const walls: Wall[] = setup.map.walls.map((w, i) => {
    const hp = w.hp ?? BATTLE_RULES.walls.hp;
    return { id: i + 1, x: w.x, y: w.y, w: w.w, h: w.h, hp, maxHp: hp };
  });

  const state: BattleState = {
    seed: setup.seed,
    tick: 0,
    rng,
    map: setup.map,
    walls,
    nav: { walls: [], blockers: [], corners: [] },
    units,
    projectiles: [],
    nextProjectileId: 1,
    startHp: {
      player: totalMaxHp(units, 'player'),
      enemy: totalMaxHp(units, 'enemy'),
    },
    events: [],
    result: null,
    command: createCommand('player', setup.rank ?? 1, setup.loadout, setup.general),
    reserves: {
      player: [...(setup.reserves?.player ?? [])],
      enemy: [...(setup.reserves?.enemy ?? [])],
    },
    tactical: setup.tactical ?? false,
    inputLog: [],
  };
  rebuildNav(state);

  for (const unit of units) {
    if (!isSpaceFree(state, unit.x, unit.y, unit.stats.radius)) {
      throw new Error(`${unit.side} ${unit.cls} at (${unit.x}, ${unit.y}) is inside a wall or off the map`);
    }
  }
  return state;
}

function totalMaxHp(units: Unit[], side: Side): number {
  return units.filter((u) => u.side === side).reduce((sum, u) => sum + u.stats.maxHp, 0);
}

/**
 * Advances the battle by one tick (1/20 s). `inputs` are the player's key presses for this tick;
 * each is stamped with the tick it belongs to and logged, so the battle can be replayed.
 * Does nothing once the battle is over.
 */
export function stepBattle(state: BattleState, inputs: readonly BattleInput[] = []): void {
  if (state.result) return;

  if (state.tick === overtimeStartTick()) state.events.push({ tick: state.tick, type: 'overtime' });
  updateCommand(state);
  for (const input of inputs) applyInput(state, input);
  advanceOrders(state);
  tickTimers(state);

  // Decide: every unit looks at the same start-of-tick state. Card orders come before a troop's own ideas.
  const intents = state.units.map((u) => {
    if (!u.alive || u.knockback) return null;
    const own = think(state, u);
    return orderIntent(state, u, own) ?? own;
  });

  // Act, in id order: first every skill, while all units still stand where they decided,
  // then every move and attack. A unit shoved earlier in the tick still does what it
  // decided, so being first in id order is no advantage; pushes start after everyone acted.
  state.units.forEach((unit, i) => {
    const intent = intents[i];
    if (intent?.cast && unit.alive) castSkill(state, unit, intent.cast);
  });
  state.units.forEach((unit, i) => {
    const intent = intents[i];
    if (intent && unit.alive) carryOut(state, unit, intent.action);
  });

  updateKnockbacks(state);
  updateProjectiles(state);
  separateUnits(state);
  resolveDeaths(state);
  checkForEnd(state);
  state.tick += 1;
}

/** Runs a battle from start to finish, feeding in the inputs at their ticks, and returns its final state. */
export function runBattle(setup: BattleSetup, inputs: readonly BattleInput[] = []): BattleState {
  const state = createBattle(setup);
  let next = 0;
  const sorted = [...inputs].sort((a, b) => a.tick - b.tick);
  while (!state.result) {
    const now: BattleInput[] = [];
    while (next < sorted.length && sorted[next]!.tick <= state.tick) {
      if (sorted[next]!.tick === state.tick) now.push(sorted[next]!);
      next++;
    }
    stepBattle(state, now);
  }
  return state;
}

function tickTimers(state: BattleState): void {
  for (const unit of state.units) {
    if (!unit.alive) continue;
    if (unit.attackCooldown > 0) unit.attackCooldown -= 1;
    if (unit.skillCooldown > 0) unit.skillCooldown -= 1;
    if (unit.mark && --unit.mark.ticksLeft <= 0) unit.mark = null;
    if (unit.barrier && --unit.barrier.ticksLeft <= 0) unit.barrier = null;
    if (unit.rallyTicks > 0) unit.rallyTicks -= 1;
    tickOrder(unit);
  }
}

function castSkill(state: BattleState, unit: Unit, cast: SkillCast): void {
  if (cast.skill === 'shove') {
    castShove(state, unit);
    return;
  }
  const target = findUnit(state, cast.targetId);
  if (!target?.alive) return;
  if (cast.skill === 'mark') castMark(state, unit, target);
  else castBarrier(state, unit, target);
}

function carryOut(state: BattleState, unit: Unit, action: Action): void {
  switch (action.kind) {
    case 'hold':
      unit.targetId = null;
      break;
    case 'walk':
      unit.targetId = action.targetId;
      walkToward(state, unit, action.to);
      break;
    case 'backAway': {
      unit.targetId = action.targetId;
      const step = stepAwayFrom(unit, action.from);
      if (step) moveUnitBy(state, unit, step.x, step.y);
      break;
    }
    case 'attack': {
      unit.targetId = action.targetId;
      const target = findUnit(state, action.targetId);
      if (target?.alive && unit.attackCooldown <= 0) performAttack(state, unit, target);
      break;
    }
  }
}

function resolveDeaths(state: BattleState): void {
  for (const unit of state.units) {
    if (!unit.alive || unit.hp > 0) continue;
    unit.alive = false;
    unit.hp = 0;
    unit.mark = null;
    unit.barrier = null;
    unit.knockback = null;
    unit.path = [];
    unit.targetId = null;
    unit.orders = [];
    unit.rallyTicks = 0;
    state.events.push({ tick: state.tick, type: 'death', unitId: unit.id, killerId: unit.lastHitBy });
  }
}

/**
 * A battle ends when an army is gone, or when the time limit is reached; then the side
 * with the larger share of its starting HP left wins.
 */
function checkForEnd(state: BattleState): void {
  const ticksElapsed = state.tick + 1;
  const living = { player: livingUnits(state, 'player'), enemy: livingUnits(state, 'enemy') };
  const left = {
    player: living.player.reduce((sum, u) => sum + u.hp, 0),
    enemy: living.enemy.reduce((sum, u) => sum + u.hp, 0),
  };
  const playerAlive = living.player.length > 0;
  const enemyAlive = living.enemy.length > 0;

  let winner: Winner;
  let reason: 'eliminated' | 'timeout';
  if (!playerAlive || !enemyAlive) {
    reason = 'eliminated';
    winner = playerAlive ? 'player' : enemyAlive ? 'enemy' : 'draw';
  } else if (ticksElapsed >= secondsToTicks(BATTLE_RULES.timeLimitSeconds)) {
    reason = 'timeout';
    // Compare left/start shares without dividing, so equal shares are exactly a draw.
    const playerScore = left.player * state.startHp.enemy;
    const enemyScore = left.enemy * state.startHp.player;
    winner = playerScore > enemyScore ? 'player' : enemyScore > playerScore ? 'enemy' : 'draw';
  } else {
    return;
  }

  state.result = {
    winner,
    reason,
    durationTicks: ticksElapsed,
    hpShare: {
      player: state.startHp.player > 0 ? left.player / state.startHp.player : 0,
      enemy: state.startHp.enemy > 0 ? left.enemy / state.startHp.enemy : 0,
    },
  };
  state.events.push({ tick: state.tick, type: 'end', winner, reason });
}
