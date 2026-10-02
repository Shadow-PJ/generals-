// Threat Readout: warnings over your troops that are about to fall, worked out from the
// damage they took in the last moments of the battle log.

import { THREAT_RULES } from '../data/command';
import { TROOP_NAMES } from '../data/units';
import { secondsToTicks, type BattleState } from '../sim';

export interface Threat {
  unitId: number;
  text: string;
}

/** Your troops that would fall within a few seconds at the damage rate they are taking now. */
export function threats(state: BattleState): Threat[] {
  const window = secondsToTicks(THREAT_RULES.windowSeconds);
  const since = state.tick - window;
  const taken = new Map<number, number>();
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]!;
    if (e.tick < since) break;
    if (e.type === 'damage') taken.set(e.targetId, (taken.get(e.targetId) ?? 0) + e.amount);
  }
  const result: Threat[] = [];
  for (const unit of state.units) {
    if (!unit.alive || unit.side !== 'player') continue;
    const perSecond = (taken.get(unit.id) ?? 0) / THREAT_RULES.windowSeconds;
    if (perSecond <= 0) continue;
    const seconds = unit.hp / perSecond;
    if (seconds < THREAT_RULES.warnBelowSeconds) {
      result.push({ unitId: unit.id, text: `${TROOP_NAMES[unit.cls].one} falls in ~${Math.max(1, Math.ceil(seconds))} s` });
    }
  }
  return result;
}
