import { describe, expect, it } from 'vitest';
import { attackIntervalTicks, formatBattleTime, secondsToTicks, TICKS_PER_SECOND, ticksToSeconds } from './time';

describe('battle clock', () => {
  it('runs at a fixed 20 ticks per second', () => {
    expect(TICKS_PER_SECOND).toBe(20);
    expect(secondsToTicks(180)).toBe(3600);
    expect(ticksToSeconds(30)).toBe(1.5);
  });

  it('turns attack speed into whole ticks between attacks', () => {
    expect(attackIntervalTicks(1)).toBe(20);
    expect(attackIntervalTicks(0.8)).toBe(25);
    expect(attackIntervalTicks(1000)).toBe(1);
  });

  it('formats battle time for logs', () => {
    expect(formatBattleTime(0)).toBe('0:00.00');
    expect(formatBattleTime(2181)).toBe('1:49.05');
    expect(formatBattleTime(3600)).toBe('3:00.00');
  });
});
