// What a finished battle shows about how you played, counted from its event log: cards fired,
// Perfect timings, combos, ultimates, troops lost and how long it took. The Battle IQ report and
// the Mastery challenges read it. Pure functions.

import { ticksToSeconds, type BattleState } from '../sim';

export interface BattleFacts {
  won: boolean;
  /** Your cards fired (Auto ones too), Perfect timings among them, and signature combos landed. */
  cards: number;
  perfects: number;
  combos: number;
  /** Your ultimates fired, and Finishers among them. */
  ultimates: number;
  finishers: number;
  /** Your troops that fell. */
  lost: number;
  /** How long the battle lasted, and when you fired your first card (null if you fired none), in seconds. */
  seconds: number;
  firstCardSeconds: number | null;
}

export function battleFacts(state: BattleState): BattleFacts {
  const mine = state.events.filter((e) => 'side' in e && e.side === 'player');
  const cards = mine.filter((e) => e.type === 'cardFired');
  const ultimates = mine.filter((e) => e.type === 'ultimate');
  const lost = state.events.filter((e) => e.type === 'death' && state.units.find((u) => u.id === e.unitId)?.side === 'player').length;
  return {
    won: state.result?.winner === 'player',
    cards: cards.length,
    perfects: cards.filter((e) => e.type === 'cardFired' && e.perfect).length,
    combos: mine.filter((e) => e.type === 'combo').length,
    ultimates: ultimates.length,
    finishers: ultimates.filter((e) => e.type === 'ultimate' && e.finisher).length,
    lost,
    seconds: ticksToSeconds(state.result?.durationTicks ?? state.tick),
    firstCardSeconds: cards.length > 0 ? ticksToSeconds(cards[0]!.tick) : null,
  };
}
