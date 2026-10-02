// Cards in words, for the card builder and (in 2B) the slot bar:
// "When an enemy Assassin reaches your backline: Protect your Rangers, then Focus the Assassin".

import { TROOP_NAMES } from '../data/units';
import type { ActionName, Actors, Card, Condition, Place, Step, Target, Trigger } from './types';

export const ACTION_NAMES: Record<ActionName, string> = {
  focus: 'Focus',
  move: 'Move',
  fallBack: 'Fall Back',
  overcharge: 'Overcharge',
  protect: 'Protect',
  hold: 'Hold',
  callReserve: 'Call Reserve',
};

export function describeTrigger(t: Trigger): string {
  switch (t.kind) {
    case 'enemyReachesBackline':
      return t.enemy === 'any'
        ? 'any enemy reaches your backline'
        : `an enemy ${TROOP_NAMES[t.enemy].one} reaches your backline`;
    case 'allyBelowHp':
      return t.ally === 'any'
        ? `any ally drops below ${t.hpPercent}% HP`
        : `your ${TROOP_NAMES[t.ally].one} drops below ${t.hpPercent}% HP`;
    case 'enemiesGrouped':
      return `${t.count} or more enemies are close together`;
    case 'enemyUltimateCharging':
      return 'the enemy ultimate is charging';
  }
}

export function describeCondition(c: Condition): string {
  return `${c.repeat ? 'Every time' : 'When'} ${c.triggers.map(describeTrigger).join(' and ')}`;
}

/** How "the one that set off the condition" reads on this card. */
function triggerName(card: Card | undefined, side: 'enemy' | 'ally'): string {
  for (const t of card?.condition?.triggers ?? []) {
    if (side === 'enemy' && t.kind === 'enemyReachesBackline') {
      return t.enemy === 'any' ? 'the attacker' : `the ${TROOP_NAMES[t.enemy].one}`;
    }
    if (side === 'enemy' && t.kind === 'enemiesGrouped') return 'the group';
    if (side === 'ally' && t.kind === 'allyBelowHp') {
      return t.ally === 'any' ? 'that ally' : `your ${TROOP_NAMES[t.ally].one}`;
    }
  }
  return side === 'enemy' ? 'the enemy that set it off' : 'the ally that set it off';
}

export function describeTarget(target: Target, side: 'enemy' | 'ally', card?: Card): string {
  switch (target.kind) {
    case 'class':
      return `${side === 'enemy' ? 'enemy' : 'your'} ${TROOP_NAMES[target.cls].many}`;
    case 'named':
      return target.name;
    case 'nearest':
      return side === 'enemy' ? 'the nearest enemy' : 'your nearest troop';
    case 'weakest':
      return side === 'enemy' ? 'the weakest enemy' : 'your weakest troop';
    case 'trigger':
      return triggerName(card, side);
  }
}

export function describePlace(place: Place, card?: Card): string {
  switch (place.kind) {
    case 'forward':
      return 'forward';
    case 'back':
      return 'back';
    case 'behindEnemies':
      return 'behind the enemy';
    case 'ally':
      return `to ${describeTarget(place.ally, 'ally', card)}`;
  }
}

export function describeActors(actors: Actors): string {
  if (actors.kind === 'all') return 'everyone';
  return actors.kind === 'class' ? TROOP_NAMES[actors.cls].many : actors.name;
}

/** One step, e.g. "Rangers focus enemy Guardians" or "Fall back to your Guardians". */
export function describeStep(step: Step, card?: Card): string {
  let verb: string;
  switch (step.action) {
    case 'focus':
      verb = `Focus ${describeTarget(step.target, 'enemy', card)}`;
      break;
    case 'move':
      verb = `Move ${describePlace(step.to, card)}`;
      break;
    case 'fallBack':
      verb = step.to ? `Fall back to ${describeTarget(step.to, 'ally', card)}` : 'Fall back';
      break;
    case 'overcharge':
      return step.actors.kind === 'all' ? 'Overcharge everyone' : `Overcharge ${describeActorsAsObject(step.actors)}`;
    case 'protect':
      verb = `Protect ${describeTarget(step.target, 'ally', card)}`;
      break;
    case 'hold':
      verb = 'Hold';
      break;
    case 'callReserve':
      return step.reserve ? `Call the reserve ${TROOP_NAMES[step.reserve].one}` : 'Call a reserve';
  }
  if (step.actors.kind === 'all') return verb;
  return `${describeActors(step.actors)} ${verb.charAt(0).toLowerCase()}${verb.slice(1)}`;
}

function describeActorsAsObject(actors: Actors): string {
  return actors.kind === 'class' ? `your ${TROOP_NAMES[actors.cls].many}` : describeActors(actors);
}

export function describeCard(card: Card): string {
  const steps = card.steps.map((s) => describeStep(s, card)).join(', then ') || 'No steps yet';
  return card.condition ? `${describeCondition(card.condition)}: ${steps}` : steps;
}
