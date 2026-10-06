import { describe, expect, it } from 'vitest';
import { readableSize, titleCase } from './theme';

describe('text', () => {
  it('turns shouted titles into mixed case for the display font', () => {
    expect(titleCase('THE CAPITAL')).toBe('The Capital');
    expect(titleCase('BOSS: THE HIVE MOTHER')).toBe('Boss: The Hive Mother');
    expect(titleCase('DEEP FOREST · RUN')).toBe('Deep Forest · Run');
    expect(titleCase('FIGHT!')).toBe('Fight!');
    expect(titleCase('RAGE ×2')).toBe('Rage ×2');
  });

  it('never draws text smaller than the smallest readable size', () => {
    expect(readableSize(8)).toBe(11);
    expect(readableSize(16)).toBe(16);
  });
});
