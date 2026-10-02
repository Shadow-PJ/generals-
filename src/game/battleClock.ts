// Turns real frame time into battle ticks. The battle engine always advances in fixed
// ticks; this clock decides how many to run each frame for pause, 1x and 2x.

import { TICKS_PER_SECOND } from '../sim';

export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** Most ticks run in one frame. After a long stall (a hidden tab) the rest is skipped, not raced through. */
export const MAX_TICKS_PER_FRAME = 8;

export type Speed = 1 | 2;

export interface BattleClock {
  speed: Speed;
  paused: boolean;
  /** Real time not yet turned into a tick, in milliseconds of battle time. */
  carryMs: number;
}

export function createClock(): BattleClock {
  return { speed: 1, paused: false, carryMs: 0 };
}

/** How many ticks to run for a frame that took `deltaMs`; keeps the leftover for the next frame. */
export function ticksForFrame(clock: BattleClock, deltaMs: number): number {
  if (clock.paused) return 0;
  clock.carryMs += Math.max(0, deltaMs) * clock.speed;
  const ticks = Math.floor(clock.carryMs / TICK_MS);
  if (ticks > MAX_TICKS_PER_FRAME) {
    clock.carryMs = 0;
    return MAX_TICKS_PER_FRAME;
  }
  clock.carryMs -= ticks * TICK_MS;
  return ticks;
}

/** How far the screen is between the last tick and the next, 0 to 1, for smooth drawing. */
export function frameBlend(clock: BattleClock): number {
  return Math.min(1, Math.max(0, clock.carryMs / TICK_MS));
}

export function togglePause(clock: BattleClock): void {
  clock.paused = !clock.paused;
}

/** Choosing a speed also resumes a paused battle. */
export function setSpeed(clock: BattleClock, speed: Speed): void {
  clock.speed = speed;
  clock.paused = false;
}

export function toggleSpeed(clock: BattleClock): void {
  setSpeed(clock, clock.speed === 1 ? 2 : 1);
}
