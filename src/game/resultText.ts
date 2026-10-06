// The words on the result screen, for your side: the player's, or in versus as the guest, the enemy's.

import { otherSide, type BattleResult, type Side } from '../sim';

export function resultTitle(result: BattleResult, own: Side = 'player'): string {
  if (result.winner === 'draw') return 'DRAW';
  return result.winner === own ? 'VICTORY' : 'DEFEAT';
}

export function resultReason(result: BattleResult, own: Side = 'player'): string {
  if (result.reason === 'eliminated') {
    if (result.winner === own) return 'The enemy army is destroyed.';
    if (result.winner === otherSide(own)) return 'Your army is destroyed.';
    return 'Both armies fell together.';
  }
  const you = Math.round(result.hpShare[own] * 100);
  const them = Math.round(result.hpShare[otherSide(own)] * 100);
  return `Time ran out. You kept ${you}% of your HP, the enemy kept ${them}%.`;
}
