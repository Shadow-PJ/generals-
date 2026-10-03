// Finding a spot to blink to.

import { clamp, distance, type Point } from './geometry';
import { isSpaceFree } from './movement';
import type { BattleState, Unit } from './types';

/**
 * Where a troop blinks to behind a target: just past it, on the far side from where the troop
 * stands now (Shadowstep, Phase Shift). Null if there is no room there or a little to either side.
 */
export function spotBehind(state: BattleState, mover: Unit, target: Unit): Point | null {
  const d = distance(mover.x, mover.y, target.x, target.y);
  const dx = d === 0 ? (mover.side === 'player' ? 1 : -1) : (target.x - mover.x) / d;
  const dy = d === 0 ? 0 : (target.y - mover.y) / d;
  const reach = target.stats.radius + mover.stats.radius + 2;
  const r = mover.stats.radius;
  // Straight behind first, then a little to either side.
  for (const turn of [0, 0.5, -0.5, 1, -1]) {
    const rx = dx - dy * turn;
    const ry = dy + dx * turn;
    const len = Math.sqrt(rx * rx + ry * ry);
    const x = clamp(target.x + (rx / len) * reach, r, state.map.width - r);
    const y = clamp(target.y + (ry / len) * reach, r, state.map.height - r);
    if (isSpaceFree(state, x, y, r)) return { x, y };
  }
  return null;
}
