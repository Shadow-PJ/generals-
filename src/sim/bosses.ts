// Boss fights (session 5D): the enemy is a region's ruler, with the one rule only their boss fight
// has. Hive Mother: her army steals a trait from each of your troops it kills. Strategist: her
// troops phase out of their first big hits. Warlord: each of his troops that falls sends the rest
// into a rage. Engineer: turrets that never move (in spawn.ts and battle.ts). Conductor: her
// Vibration spreads through your packed troops and speeds up her Shatterstorm. The boss is always
// the enemy side.

import { BOSS_RULES, type BossId } from '../data/bosses';
import { COMMAND_RULES } from '../data/command';
import { distance } from './geometry';
import { findUnit } from './queries';
import { addVibration } from './status';
import { secondsToTicks } from './time';
import type { BattleState, Side, Unit } from './types';

/** The side the boss leads, if this is a boss fight. */
export const BOSS_SIDE: Side = 'enemy';

function bossIs(state: BattleState, boss: BossId): boolean {
  return state.boss === boss;
}

/** A troop joins a boss fight: the Strategist's troops get their phases. */
export function prepareForBoss(state: BattleState, unit: Unit): void {
  if (bossIs(state, 'strategist') && unit.side === BOSS_SIDE) unit.bossPhases = BOSS_RULES.strategist.phases;
}

/** Strategist: true if the troop phases out of a hit this big (and uses up a phase). */
export function bossPhasesOut(state: BattleState, target: Unit, hit: number): boolean {
  if (!bossIs(state, 'strategist') || target.side !== BOSS_SIDE || target.bossPhases <= 0) return false;
  if (hit < target.stats.maxHp * BOSS_RULES.strategist.burstShare) return false;
  target.bossPhases -= 1;
  return true;
}

/** After a troop falls: the Hive steals its trait, or the Warlord's army rages. */
export function bossAfterDeath(state: BattleState, fallen: Unit): void {
  if (bossIs(state, 'hiveMother') && fallen.side !== BOSS_SIDE) {
    const killer = findUnit(state, fallen.lastHitBy);
    if (killer?.side === BOSS_SIDE) steal(state, fallen);
  }
  if (bossIs(state, 'warlord') && fallen.side === BOSS_SIDE) enrage(state);
}

function steal(state: BattleState, fallen: Unit): void {
  const trait = BOSS_RULES.hiveMother.steals[fallen.cls];
  for (const u of state.units) {
    if (!u.alive || u.side !== BOSS_SIDE) continue;
    if (trait.stat === 'armor') u.stats.armor = Math.min(0.9, u.stats.armor + trait.amount);
    else if (trait.stat === 'maxHp') {
      const more = Math.round(u.stats.maxHp * trait.amount);
      u.stats.maxHp += more;
      u.hp += more;
    } else u.stats[trait.stat] *= 1 + trait.amount;
  }
  state.events.push({ tick: state.tick, type: 'stolen', side: BOSS_SIDE, victimId: fallen.id, trait: fallen.cls });
}

function enrage(state: BattleState): void {
  const rage = BOSS_RULES.warlord.rage;
  let stacks = 0;
  for (const u of state.units) {
    if (!u.alive || u.hp <= 0 || u.side !== BOSS_SIDE) continue;
    u.rage = { stacks: Math.min(rage.maxStacks, (u.rage?.stacks ?? 0) + 1), ticksLeft: secondsToTicks(rage.seconds) };
    stacks = Math.max(stacks, u.rage.stacks);
  }
  if (stacks > 0) state.events.push({ tick: state.tick, type: 'enraged', side: BOSS_SIDE, stacks });
}

/**
 * Conductor: a Vibration stack her troop lands on one of yours also goes to your troops close to
 * it, and each stack brings her Shatterstorm closer.
 */
export function bossSpreadsVibration(state: BattleState, source: Unit, target: Unit): void {
  if (!bossIs(state, 'conductor') || source.side !== BOSS_SIDE) return;
  const rules = BOSS_RULES.conductor;
  let stacks = 1;
  for (const u of state.units) {
    if (!u.alive || u.side !== target.side || u.id === target.id) continue;
    if (distance(u.x, u.y, target.x, target.y) > rules.spreadRadius) continue;
    addVibration(state, u, source.id);
    stacks += 1;
  }
  const command = state.enemyCommand;
  if (command) command.momentum = Math.min(COMMAND_RULES.momentum.max, command.momentum + rules.momentumPerStack * stacks);
}
