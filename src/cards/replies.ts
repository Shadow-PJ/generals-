// What the General answers when you save a card.

import { CAPTAIN_REPLIES, type ReplyKind } from '../data/replies';
import { rankRules, type RankNumber } from '../data/ranks';
import type { Verdict } from './validator';

export function reply(kind: ReplyKind, rank?: RankNumber): string {
  const line = CAPTAIN_REPLIES[kind][0];
  return rank ? line.replace('{rank}', rankRules(rank).numeral) : line;
}

/** "Understood." for a legal card, otherwise why it was refused. */
export function replyToVerdict(verdict: Verdict): string {
  if (verdict.ok) return reply('accepted');
  if (verdict.unlockRank) return reply('notTrainedYet', verdict.unlockRank);
  if (verdict.problems.some((p) => p.kind === 'autoNeedsCondition')) return reply('autoNeedsCondition');
  return reply('impossible');
}
