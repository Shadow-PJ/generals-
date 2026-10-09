import { describe, expect, it } from 'vitest';
import { readableSize, titleCase } from './theme';

describe('text', () => {
  it('turns shouted titles into mixed case for the display font', () => {
    expect(titleCase('THE CAPITAL')).toBe('The Capital');
    expect(titleCase('BOSS: THE HIVE MOTHER')).toBe('Boss: The Hive Mother');
    expect(titleCase('DEEP FOREST · RUN')).toBe('Deep Forest · Run');
    expect(titleCase('FIGHT!')).toBe('Fight!');
    expect(titleCase('RAGE ×2')).toBe('Rage ×2');
    expect(titleCase("FINISHER: REAPER'S TOLL!")).toBe("Finisher: Reaper's Toll!");
  });

  it('keeps small words small, except first, last and after a colon (session 7H)', () => {
    expect(titleCase('STORM ON THE PASS')).toBe('Storm on the Pass');
    expect(titleCase('THE ROAD GOES ON')).toBe('The Road Goes On');
    expect(titleCase('BOSS: THE WARLORD')).toBe('Boss: The Warlord');
    expect(titleCase('BACK TO THE CAPITAL')).toBe('Back to the Capital');
    expect(titleCase('WEAPONS OF THE FALLEN · LAP 2')).toBe('Weapons of the Fallen · Lap 2');
  });

  it('never draws text smaller than the smallest readable size', () => {
    expect(readableSize(8)).toBe(11);
    expect(readableSize(16)).toBe(16);
  });
});
