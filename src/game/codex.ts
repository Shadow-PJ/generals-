// The Combo Codex: which combos a battle's events show you landed, and what each entry says.
// Combos you haven't found yet stay hidden until you do.

import { CODEX_ENTRY_IDS, FINISHER_TEXT, SIGNATURE_COMBOS, type CodexEntryId } from '../data/combos';
import type { BattleEvent } from '../sim';

/** The Codex entries these events show: each signature combo that landed, and a Finisher. */
export function codexFinds(events: readonly BattleEvent[]): CodexEntryId[] {
  const found = new Set<CodexEntryId>();
  for (const e of events) {
    if (e.type === 'combo' && e.side === 'player') found.add(e.combo);
    if (e.type === 'ultimate' && e.side === 'player' && e.finisher) found.add('finisher');
  }
  return CODEX_ENTRY_IDS.filter((id) => found.has(id));
}

export interface CodexEntry {
  id: CodexEntryId;
  name: string;
  stepsText: string;
  bonusText: string;
}

export function codexEntry(id: CodexEntryId): CodexEntry {
  if (id === 'finisher') return { id, ...FINISHER_TEXT };
  const combo = SIGNATURE_COMBOS.find((c) => c.id === id)!;
  return { id, name: combo.name, stepsText: combo.stepsText, bonusText: combo.bonusText };
}
