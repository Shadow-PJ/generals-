// What the General answers when you save a card.

import { CAPTAIN_REPLIES, GENERAL_REPLIES, type ReplyKind } from '../data/replies';
import { rankRules, type RankNumber } from '../data/ranks';
import type { Reading } from './personality';
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

/**
 * What your General says about their reading of a card: a line for the first rule that applied,
 * or for a card kept as written. The same card always gets the same line; different cards vary.
 */
export function generalReply(reading: Reading): string {
  const lines: Record<string, readonly string[]> = GENERAL_REPLIES[reading.general];
  const pool = lines[reading.rules[0] ?? 'asWritten'] ?? lines.asWritten ?? [];
  return pool[textHash(JSON.stringify(reading.card)) % pool.length] ?? '';
}

function textHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 1_000_003;
  return hash;
}
