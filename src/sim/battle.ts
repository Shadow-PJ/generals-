// The battle loop: create a battle from a setup, then advance it one fixed tick at a time.

import type { Troop } from '../data/armies';
import { BATTLE_RULES } from '../data/battle';
import type { UnitClass } from '../data/units';
import { tauntIntent, think } from './behaviors';
import { aroundRock, type Action, type SkillCast } from './intents';
import { applyInput, createCommand, fed, updateCommand } from './command';
import { performAttack, resolvePhaseShifts, updateProjectiles } from './combat';
import { isSpaceFree, moveUnitBy, separateUnits, stepAwayFrom, updateKnockbacks, walkToward } from './movement';
import { advanceOrders, orderIntent, tickOrder } from './orders';
import { overtimeStartTick } from './overtime';
import { findUnit, livingUnits } from './queries';
import { burnShoved, startRift, tickCast, updateZones } from './rift';
import { createRng } from './rng';
import { castShadowstep } from './shadowstep';
import { castBarrier, castMark, castShove, ironWallTaunts } from './skills';
import { specFor } from './specs';
import { bossAfterDeath, prepareForBoss } from './bosses';
import { factionCounts } from './factions';
import { createUnit } from './spawn';
import { activeSynergies } from './synergies';
import { updatePacks } from './doctrine';
import { afterAttack, assimilate, vampiricLinks } from './troopSkills';
import { secondsToTicks, TICKS_PER_SECOND } from './time';
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
import { ageWalls, hijackIntent } from './legendary';

export function createBattle(setup: BattleSetup): BattleState {
  const rng = createRng(setup.seed);
  const units: Unit[] = [];
  const specs = { player: { ...setup.specs?.player }, enemy: { ...setup.specs?.enemy } };
  const generals = { player: setup.general ?? 'captain', enemy: setup.enemyGeneral ?? 'captain' };
  const asTroop = (r: UnitClass | Troop): Troop => (typeof r === 'string' ? { cls: r } : { ...r });
  const reserves = { player: (setup.reserves?.player ?? []).map(asTroop), enemy: (setup.reserves?.enemy ?? []).map(asTroop) };
  const boons = { player: [...(setup.boons?.player ?? [])], enemy: [...(setup.boons?.enemy ?? [])] };

  // Ids alternate between the sides (player, enemy, player, ...) so neither side always acts first.
  const count = Math.max(setup.player.length, setup.enemy.length);
  for (let i = 0; i < count; i++) {
    for (const side of SIDES) {
      const placement = setup[side][i];
      if (placement) {
        units.push(createUnit(units.length + 1, side, placement, rng, specFor(specs[side], placement.cls), generals[side], setup.map, boons[side]));
      }
    }
  }
  // The army each side brought, troops and reserves, switches its synergies on.
  const army = (side: Side) => [...setup[side].map((t) => t.cls), ...reserves[side].map((t) => t.cls)];

  const walls: Wall[] = setup.map.walls.map((w, i) => {
    const hp = w.hp ?? BATTLE_RULES.walls.hp;
    return { id: i + 1, x: w.x, y: w.y, w: w.w, h: w.h, hp, maxHp: hp, unbreakable: w.unbreakable ?? false, ticksLeft: null };
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
    zones: [],
    nextZoneId: 1,
    specs,
    generals,
    packPrey: { player: null, enemy: null },
    synergies: { player: activeSynergies(army('player'), specs.player), enemy: activeSynergies(army('enemy'), specs.enemy) },
    synergiesSeen: { player: [], enemy: [] },
    startHp: {
      player: totalHp(units, 'player'),
      enemy: totalHp(units, 'enemy'),
    },
    events: [],
    result: null,
    command: createCommand('player', setup.rank ?? 1, setup.loadout, setup.general, setup.learned, boons.player),
    enemyCommand: setup.enemyCommander
      ? createCommand('enemy', setup.enemyCommander.rank, setup.enemyCommander.loadout, generals.enemy, [], boons.enemy)
      : null,
    reserves,
    boons,
    factions: { player: factionCounts([...setup.player, ...reserves.player], boons.player), enemy: factionCounts([...setup.enemy, ...reserves.enemy], boons.enemy) },
    boss: setup.boss ?? null,
    tactical: setup.tactical ?? false,
    inputLog: [],
  };
  rebuildNav(state);
  for (const unit of units) prepareForBoss(state, unit);

  for (const unit of units) {
    if (!isSpaceFree(state, unit.x, unit.y, unit.stats.radius)) {
      throw new Error(`${unit.side} ${unit.cls} at (${unit.x}, ${unit.y}) is inside a wall or off the map`);
    }
  }
  return state;
}

/** The HP a side brings onto the field: full for fresh troops, less for wounded run fighters. */
function totalHp(units: Unit[], side: Side): number {
  return units.filter((u) => u.side === side).reduce((sum, u) => sum + u.hp, 0);
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
  ageWalls(state);
  ironWallTaunts(state);
  updatePacks(state);
  vampiricLinks(state);

  // Decide: every unit looks at the same start-of-tick state. A hijacked troop obeys its captor,
  // then a taunt comes first, then card orders, then a troop's own ideas; a shot that would only
  // hit rock becomes a walk around it.
  // Shoved, stunned and casting troops do nothing; silenced ones use no skills.
  const intents = state.units.map((u) => {
    if (!u.alive || u.knockback || u.stunTicks > 0 || u.casting) return null;
    const own = think(state, u);
    const intent = aroundRock(state, u, hijackIntent(state, u) ?? tauntIntent(state, u) ?? orderIntent(state, u, own) ?? own);
    return u.silencedTicks > 0 ? { ...intent, cast: null } : intent;
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

  for (const { unit, push } of updateKnockbacks(state)) burnShoved(state, unit, push);
  updateProjectiles(state);
  updateZones(state);
  resolvePhaseShifts(state);
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
    if (unit.chased && --unit.chased.ticksLeft <= 0) unit.chased = null;
    if (unit.slow && --unit.slow.ticksLeft <= 0) unit.slow = null;
    if (unit.hijackTicks > 0) unit.hijackTicks -= 1;
    if (unit.taunt && --unit.taunt.ticksLeft <= 0) unit.taunt = null;
    if (unit.stunTicks > 0) unit.stunTicks -= 1;
    if (unit.silencedTicks > 0) unit.silencedTicks -= 1;
    if (unit.invisibleTicks > 0) unit.invisibleTicks -= 1;
    if (unit.rallyTicks > 0) unit.rallyTicks -= 1;
    if (unit.troopSkillCooldown > 0) unit.troopSkillCooldown -= 1;
    if (unit.haste && --unit.haste.ticksLeft <= 0) unit.haste = null;
    if (unit.adaptation && --unit.adaptation.ticksLeft <= 0) unit.adaptation = null;
    if (unit.vibration && --unit.vibration.ticksLeft <= 0) unit.vibration = null;
    if (unit.shatterTicks > 0) unit.shatterTicks -= 1;
    if (unit.rage && --unit.rage.ticksLeft <= 0) unit.rage = null;
    if (unit.wraithTicks > 0 && --unit.wraithTicks === 0) wraithFades(state, unit);
    if (unit.regen) tickRegen(unit);
    tickCast(state, unit);
    tickOrder(unit);
  }
}

/** Reaper's Toll: a wraith's time is up, and the troop falls. */
function wraithFades(state: BattleState, unit: Unit): void {
  const amount = unit.hp;
  unit.hp = 0;
  unit.lastHitBy = unit.id;
  state.events.push({ tick: state.tick, type: 'damage', sourceId: unit.id, targetId: unit.id, amount, absorbed: 0, cause: 'execute' });
}

/** Mender: heals the regen's amount once a second while it lasts. */
function tickRegen(unit: Unit): void {
  const regen = unit.regen!;
  regen.ticksLeft -= 1;
  if (regen.ticksLeft % TICKS_PER_SECOND === 0) unit.hp = Math.min(unit.stats.maxHp, unit.hp + regen.amount);
  if (regen.ticksLeft <= 0) unit.regen = null;
}

function castSkill(state: BattleState, unit: Unit, cast: SkillCast): void {
  if (cast.skill === 'shove') {
    castShove(state, unit);
    return;
  }
  if (cast.skill === 'rift') {
    startRift(unit, cast.at);
    return;
  }
  const target = findUnit(state, cast.targetId);
  if (!target?.alive) return;
  if (cast.skill === 'mark') castMark(state, unit, target);
  else if (cast.skill === 'barrier') castBarrier(state, unit, target);
  else castShadowstep(state, unit, target);
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
      if (target?.alive && unit.attackCooldown <= 0) {
        performAttack(state, unit, target);
        afterAttack(state, unit);
      }
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
    unit.chased = null;
    unit.knockback = null;
    unit.stunTicks = 0;
    unit.slow = null;
    unit.taunt = null;
    unit.silencedTicks = 0;
    unit.invisibleTicks = 0;
    unit.regen = null;
    unit.casting = null;
    unit.path = [];
    unit.targetId = null;
    unit.orders = [];
    unit.rallyTicks = 0;
    unit.rallyBonus = 0;
    unit.haste = null;
    unit.adaptation = null;
    unit.vibration = null;
    unit.shatterTicks = 0;
    unit.wraithTicks = 0;
    unit.hijackTicks = 0;
    unit.rage = null;
    state.events.push({ tick: state.tick, type: 'death', unitId: unit.id, killerId: unit.lastHitBy });
    assimilate(state, unit);
    fed(state, unit);
    bossAfterDeath(state, unit);
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
