import { describe, expect, it } from 'vitest';
import {
  createClock,
  frameBlend,
  MAX_TICKS_PER_FRAME,
  setSpeed,
  TICK_MS,
  ticksForFrame,
  togglePause,
  toggleSpeed,
} from './battleClock';

describe('battle clock', () => {
  it('runs one tick per 50 ms at 1x, keeping the leftover time', () => {
    const clock = createClock();
    expect(TICK_MS).toBe(50);
    expect(ticksForFrame(clock, 16)).toBe(0);
    expect(ticksForFrame(clock, 16)).toBe(0);
    expect(ticksForFrame(clock, 20)).toBe(1);
    expect(clock.carryMs).toBeCloseTo(2);
    expect(ticksForFrame(clock, 1000)).toBe(MAX_TICKS_PER_FRAME);
  });

  it('runs twice as many ticks at 2x', () => {
    const clock = createClock();
    setSpeed(clock, 2);
    expect(ticksForFrame(clock, 100)).toBe(4);
    toggleSpeed(clock);
    expect(clock.speed).toBe(1);
    expect(ticksForFrame(clock, 100)).toBe(2);
  });

  it('runs nothing while paused, and choosing a speed resumes', () => {
    const clock = createClock();
    togglePause(clock);
    expect(ticksForFrame(clock, 500)).toBe(0);
    setSpeed(clock, 2);
    expect(clock.paused).toBe(false);
    expect(ticksForFrame(clock, 50)).toBe(2);
  });

  it('skips the backlog after a long stall instead of racing through it', () => {
    const clock = createClock();
    expect(ticksForFrame(clock, 10_000)).toBe(MAX_TICKS_PER_FRAME);
    expect(clock.carryMs).toBe(0);
  });

  it('reports how far the screen is between two ticks', () => {
    const clock = createClock();
    ticksForFrame(clock, 25);
    expect(frameBlend(clock)).toBeCloseTo(0.5);
  });
});
