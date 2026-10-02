// The words on the result screen.

import type { BattleResult } from '../sim';

export function resultTitle(result: BattleResult): string {
  if (result.winner === 'draw') return 'DRAW';
  return result.winner === 'player' ? 'VICTORY' : 'DEFEAT';
}

export function resultReason(result: BattleResult): string {
  if (result.reason === 'eliminated') {
    if (result.winner === 'player') return 'The enemy army is destroyed.';
    if (result.winner === 'enemy') return 'Your army is destroyed.';
    return 'Both armies fell together.';
  }
  const you = Math.round(result.hpShare.player * 100);
  const them = Math.round(result.hpShare.enemy * 100);
  return `Time ran out. You kept ${you}% of your HP, the enemy kept ${them}%.`;
}
