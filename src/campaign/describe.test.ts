import { describe, expect, it } from 'vitest';
import { aOrAn, capitalized, fighterLabel } from './describe';

describe('words for the campaign (session 7H)', () => {
  it('puts "an" before a vowel and "a" before the rest', () => {
    expect(aOrAn('Ambush')).toBe('an Ambush');
    expect(aOrAn('Iron Fortress')).toBe('an Iron Fortress');
    expect(aOrAn(fighterLabel('assassin', 'common'))).toBe('an Assassin');
    expect(aOrAn(fighterLabel('ranger', 'epic'))).toBe('an Epic Ranger');
    expect(aOrAn('Hammer and Anvil')).toBe('a Hammer and Anvil');
    expect(aOrAn(fighterLabel('ranger', 'rare'))).toBe('a Rare Ranger');
  });

  it('starts a sentence with a capital', () => {
    expect(capitalized(aOrAn('Invoker'))).toBe('An Invoker');
    expect(capitalized('')).toBe('');
  });
});
