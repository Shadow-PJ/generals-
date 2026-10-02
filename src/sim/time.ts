// The battle clock. Time inside the engine is counted in ticks, never read from a real clock.

/** Fixed simulation rate. Changing it would break every saved replay. */
export const TICKS_PER_SECOND = 20;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICKS_PER_SECOND);
}

export function ticksToSeconds(ticks: number): number {
  return ticks / TICKS_PER_SECOND;
}

/** Ticks between two attacks for a unit with the given attack speed; at least 1. */
export function attackIntervalTicks(attacksPerSecond: number): number {
  return Math.max(1, Math.round(TICKS_PER_SECOND / attacksPerSecond));
}

/** Battle time as m:ss.cc, for logs. */
export function formatBattleTime(ticks: number): string {
  const totalCentis = Math.floor((ticks * 100) / TICKS_PER_SECOND);
  const minutes = Math.floor(totalCentis / 6000);
  const seconds = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}
