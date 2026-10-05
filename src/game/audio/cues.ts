// Which sound goes with what (session 6B): battle events and menu keys to sound effects. Pure,
// so it can be tested; the player (audio.ts) keeps the same sound from piling up.

import type { BattleEvent, SkillName } from '../../sim';
import type { InputAction } from '../bindings';
import type { SoundId } from './sounds';

const SKILL_SOUNDS: Readonly<Partial<Record<SkillName, SoundId>>> = {
  shove: 'heavy',
  mark: 'mark',
  barrier: 'barrier',
  rift: 'magic',
  shadowstep: 'whoosh',
  vampiricLink: 'heal',
  vent: 'vent',
  assimilation: 'heal',
  phaseShift: 'magic',
  shatter: 'shatter',
};

/** The sounds a battle event makes, if any. Your cards and ultimate sound brighter than the enemy's. */
export function eventSounds(e: BattleEvent): SoundId[] {
  switch (e.type) {
    case 'damage':
      if (e.amount <= 0) return e.absorbed > 0 ? ['block'] : [];
      if (e.cause === 'attack') return ['hit'];
      if (e.cause === 'shove' || e.cause === 'execute') return ['heavy'];
      return [];
    case 'skill': {
      const sound = SKILL_SOUNDS[e.skill];
      return sound ? [sound] : [];
    }
    case 'death':
      return ['death'];
    case 'wallHit':
      return ['wallHit'];
    case 'wallBreak':
      return ['wallBreak'];
    case 'overtime':
      return ['overtime'];
    case 'cardFired':
      if (e.side === 'enemy') return ['enemyCard'];
      return [e.perfect ? 'perfect' : 'card', ...(e.link > 1 ? (['chain'] as const) : [])];
    case 'combo':
    case 'synergy':
      return e.side === 'player' ? ['combo'] : [];
    case 'ultimate':
    case 'legendary':
      return ['ultimate'];
    case 'ultimateReady':
      return e.side === 'player' ? ['ultimateReady'] : [];
    case 'reserveCalled':
      return ['reserve'];
    case 'phased':
    case 'stolen':
      return ['magic'];
    case 'revived':
      return ['heal'];
    case 'evolved':
      return ['perfect'];
    case 'enraged':
      return ['heavy'];
    default:
      return [];
  }
}

/** The click a menu key makes, for the keys a screen listens to: moving, choosing, going back. */
export function menuSound(action: InputAction): SoundId | null {
  switch (action) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
    case 'prev':
    case 'next':
      return 'uiMove';
    case 'confirm':
      return 'uiConfirm';
    case 'back':
      return 'uiBack';
    default:
      return null;
  }
}
