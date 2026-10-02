// When a card's condition is met, and which units set it off ("him", "her", "the group").

import { CONDITION_RULES } from '../data/command';
import type { Condition, Trigger } from '../cards/types';
import { distance } from './geometry';
import { hpShare, livingUnits } from './queries';
import { otherSide, type BattleState, type Side, type Unit } from './types';

export interface ConditionCheck {
  met: boolean;
  /** The enemy that set it off, when the condition is about an enemy. */
  enemyId: number | null;
  /** The ally that set it off, when the condition is about one of your troops. */
  allyId: number | null;
}

const NOT_MET: ConditionCheck = { met: false, enemyId: null, allyId: null };

/** All triggers must hold at once ("when X and Y"). */
export function checkCondition(state: BattleState, side: Side, condition: Condition): ConditionCheck {
  let enemyId: number | null = null;
  let allyId: number | null = null;
  for (const trigger of condition.triggers) {
    const check = checkTrigger(state, side, trigger);
    if (!check.met) return NOT_MET;
    enemyId ??= check.enemyId;
    allyId ??= check.allyId;
  }
  return { met: condition.triggers.length > 0, enemyId, allyId };
}

export function checkTrigger(state: BattleState, side: Side, trigger: Trigger): ConditionCheck {
  const mine = livingUnits(state, side);
  const theirs = livingUnits(state, otherSide(side));
  switch (trigger.kind) {
    case 'enemyReachesBackline': {
      // Your backline is your Rangers, Guardians and Invokers; an enemy close to one of them has reached it.
      const backline = mine.filter((u) => u.cls === 'ranger' || u.cls === 'guardian' || u.cls === 'invoker');
      let best: Unit | undefined;
      let bestDistance = Infinity;
      for (const enemy of theirs) {
        if (trigger.enemy !== 'any' && enemy.cls !== trigger.enemy) continue;
        for (const friend of backline) {
          const d = distance(enemy.x, enemy.y, friend.x, friend.y);
          if (d <= CONDITION_RULES.backlineRadius && d < bestDistance) {
            best = enemy;
            bestDistance = d;
          }
        }
      }
      return best ? { met: true, enemyId: best.id, allyId: null } : NOT_MET;
    }
    case 'allyBelowHp': {
      let worst: Unit | undefined;
      for (const u of mine) {
        if (trigger.ally !== 'any' && u.cls !== trigger.ally) continue;
        if (hpShare(u) * 100 < trigger.hpPercent && (!worst || hpShare(u) < hpShare(worst))) worst = u;
      }
      return worst ? { met: true, enemyId: null, allyId: worst.id } : NOT_MET;
    }
    case 'enemiesGrouped': {
      let center: Unit | undefined;
      let most = 0;
      for (const enemy of theirs) {
        const near = theirs.filter((o) => distance(enemy.x, enemy.y, o.x, o.y) <= CONDITION_RULES.groupRadius).length;
        if (near > most) {
          center = enemy;
          most = near;
        }
      }
      return center && most >= trigger.count ? { met: true, enemyId: center.id, allyId: null } : NOT_MET;
    }
    case 'enemyUltimateCharging':
      // The enemy has no General firing an ultimate until session 4D.
      return NOT_MET;
  }
}
