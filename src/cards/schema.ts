// Reads a card from untrusted data: a save file today, the network later. It checks only the
// card's shape and copies the known fields, so a damaged or edited file can't crash the game.
// Whether the card is allowed at your rank is still the validator's job.

import { TROOP_CLASSES, type TroopClass } from '../data/units';
import { ACTIONS, type Actors, type Card, type Condition, type Place, type Step, type Target, type Trigger } from './types';

type Data = Record<string, unknown>;

function isData(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTroopClass(value: unknown): value is TroopClass {
  return typeof value === 'string' && (TROOP_CLASSES as readonly string[]).includes(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 40;
}

function readActors(value: unknown): Actors | null {
  if (!isData(value)) return null;
  if (value.kind === 'all') return { kind: 'all' };
  if (value.kind === 'class' && isTroopClass(value.cls)) return { kind: 'class', cls: value.cls };
  if (value.kind === 'named' && isName(value.name)) return { kind: 'named', name: value.name };
  return null;
}

function readTarget(value: unknown): Target | null {
  if (!isData(value)) return null;
  switch (value.kind) {
    case 'class':
      return isTroopClass(value.cls) ? { kind: 'class', cls: value.cls } : null;
    case 'named':
      return isName(value.name) ? { kind: 'named', name: value.name } : null;
    case 'nearest':
    case 'weakest':
    case 'trigger':
      return { kind: value.kind };
    default:
      return null;
  }
}

function readPlace(value: unknown): Place | null {
  if (!isData(value)) return null;
  switch (value.kind) {
    case 'forward':
    case 'back':
    case 'behindEnemies':
      return { kind: value.kind };
    case 'ally': {
      const ally = readTarget(value.ally);
      return ally ? { kind: 'ally', ally } : null;
    }
    default:
      return null;
  }
}

function readStep(value: unknown): Step | null {
  if (!isData(value) || !(ACTIONS as readonly unknown[]).includes(value.action)) return null;
  if (value.action === 'callReserve') {
    if (value.reserve === null) return { action: 'callReserve', reserve: null };
    return isTroopClass(value.reserve) ? { action: 'callReserve', reserve: value.reserve } : null;
  }
  // Legendary actions without troops to carry them out.
  switch (value.action) {
    case 'hijack':
    case 'bloodPact': {
      const target = readTarget(value.target);
      return target ? { action: value.action, target } : null;
    }
    case 'fortify': {
      const at = readPlace(value.at);
      return at ? { action: 'fortify', at } : null;
    }
    case 'echo':
      return { action: 'echo' };
  }
  const actors = readActors(value.actors);
  if (!actors) return null;
  switch (value.action) {
    case 'focus':
    case 'protect':
    case 'swap': {
      const target = readTarget(value.target);
      return target ? { action: value.action, actors, target } : null;
    }
    case 'move': {
      const to = readPlace(value.to);
      return to ? { action: 'move', actors, to } : null;
    }
    case 'fallBack': {
      if (value.to === null) return { action: 'fallBack', actors, to: null };
      const to = readTarget(value.to);
      return to ? { action: 'fallBack', actors, to } : null;
    }
    case 'overcharge':
    case 'hold':
      return { action: value.action, actors };
    default:
      return null;
  }
}

function readTrigger(value: unknown): Trigger | null {
  if (!isData(value)) return null;
  switch (value.kind) {
    case 'enemyReachesBackline':
      return value.enemy === 'any' || isTroopClass(value.enemy) ? { kind: value.kind, enemy: value.enemy } : null;
    case 'allyBelowHp':
      return (value.ally === 'any' || isTroopClass(value.ally)) && isNumber(value.hpPercent)
        ? { kind: value.kind, ally: value.ally, hpPercent: value.hpPercent }
        : null;
    case 'enemiesGrouped':
      return isNumber(value.count) ? { kind: value.kind, count: value.count } : null;
    case 'enemyUltimateCharging':
      return { kind: value.kind };
    default:
      return null;
  }
}

function readCondition(value: unknown): Condition | null | undefined {
  if (value === null) return null;
  if (!isData(value) || !Array.isArray(value.triggers) || typeof value.repeat !== 'boolean') return undefined;
  const triggers: Trigger[] = [];
  for (const t of value.triggers) {
    const trigger = readTrigger(t);
    if (!trigger) return undefined;
    triggers.push(trigger);
  }
  return { triggers, repeat: value.repeat };
}

/** The card, or null if the data isn't shaped like one. */
export function readCard(value: unknown): Card | null {
  if (!isData(value) || !Array.isArray(value.steps) || typeof value.auto !== 'boolean') return null;
  const condition = readCondition(value.condition);
  if (condition === undefined) return null;
  const steps: Step[] = [];
  for (const s of value.steps) {
    const step = readStep(s);
    if (!step) return null;
    steps.push(step);
  }
  // Same field order as the parser's cards, so a card read back is written out identically.
  const text = typeof value.text === 'string' ? { text: value.text.slice(0, 200) } : {};
  return { ...text, condition, steps, auto: value.auto };
}
