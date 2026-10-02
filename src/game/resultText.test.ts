import { describe, expect, it } from 'vitest';
import type { BattleResult } from '../sim';
import { resultReason, resultTitle } from './resultText';

const result = (r: Partial<BattleResult>): BattleResult => ({
  winner: 'player',
  reason: 'eliminated',
  durationTicks: 2000,
  hpShare: { player: 0.4, enemy: 0 },
  ...r,
});

describe('result screen text', () => {
  it('names the outcome from your side', () => {
    expect(resultTitle(result({ winner: 'player' }))).toBe('VICTORY');
    expect(resultTitle(result({ winner: 'enemy' }))).toBe('DEFEAT');
    expect(resultTitle(result({ winner: 'draw' }))).toBe('DRAW');
  });

  it('explains how the battle ended', () => {
    expect(resultReason(result({ winner: 'player' }))).toBe('The enemy army is destroyed.');
    expect(resultReason(result({ winner: 'enemy' }))).toBe('Your army is destroyed.');
    expect(resultReason(result({ winner: 'draw' }))).toBe('Both armies fell together.');
    expect(resultReason(result({ reason: 'timeout', hpShare: { player: 0.456, enemy: 0.3 } }))).toBe(
      'Time ran out. You kept 46% of your HP, the enemy kept 30%.',
    );
  });
});
