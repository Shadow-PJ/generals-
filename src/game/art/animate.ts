// How troops move on screen (session 6B): which frame shows and how far a troop leans into a
// blow. Pure, so it can be tested; times are the renderer's milliseconds, never the battle's.

import type { TroopFrame } from './troops';

/** How long each walking frame shows, in milliseconds. */
export const STEP_MS = 140;
/** A standing troop breathes: down and up a little every this many milliseconds. */
export const BREATH_MS = 520;
/** How long a lunge (a melee blow) or a recoil (a shot) takes, out and back, in milliseconds. */
export const LUNGE_MS = 160;
/** How far a melee blow leans toward the target, and a shot rocks back, in world units. */
export const LUNGE_DISTANCE = 6;
export const RECOIL_DISTANCE = 3;

export interface Pose {
  frame: TroopFrame;
  /** World units up (negative) or down from where the troop stands. */
  bob: number;
}

/**
 * A walking troop steps through its two walking frames, bobbing on the second; a standing one
 * breathes. `id` staggers troops so they don't all step in time.
 */
export function poseAt(moving: boolean, timeMs: number, id: number): Pose {
  if (moving) {
    const step = Math.floor(timeMs / STEP_MS + id) % 2;
    return { frame: step === 0 ? 'stepA' : 'stepB', bob: step === 0 ? 0 : -1 };
  }
  return { frame: 'stand', bob: Math.floor(timeMs / BREATH_MS + id * 0.37) % 2 === 0 ? 0 : 1 };
}

/** How far along a lunge is, 0 to 1 and back to 0: out fast, back slower. 0 once it is over. */
export function lungeShare(elapsedMs: number, durationMs = LUNGE_MS): number {
  if (elapsedMs < 0 || elapsedMs >= durationMs) return 0;
  const t = elapsedMs / durationMs;
  return t < 0.35 ? t / 0.35 : (1 - t) / 0.65;
}
