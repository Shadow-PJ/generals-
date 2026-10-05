// The Captain's tutorial, apart from the screens (session 6A): which tip to say now, and its text.
// Each tip shows once, the first time its moment comes, while tips are on.

import { GENERALS, type GeneralId } from '../data/generals';
import { TIPS, TIP_IDS, type TipId, type TipScene } from '../data/tutorial';
import { newTutorial, type Tutorial } from '../save/profile';
import { SLOT_COUNT, slotReadiness, ultimateReady, type BattleState } from '../sim';
import { keyLabel, type InputAction } from './bindings';

/** A tip to say, with the slot it is about when it is about one. */
export interface TipCall {
  id: TipId;
  slot?: number;
}

/** The first tip among these that is still unseen; null when tips are off or all are seen. */
export function nextTip(tutorial: Tutorial, calls: readonly TipCall[]): TipCall | null {
  if (!tutorial.on) return null;
  return calls.find((c) => !tutorial.seen.includes(c.id)) ?? null;
}

/** A screen's tips, in order: for a screen other than the battle, said when it opens. */
export function sceneTips(scene: TipScene): TipCall[] {
  return TIP_IDS.filter((id) => TIPS[id].scene === scene).map((id) => ({ id }));
}

/** The battle moments true now, most pressing first: the ultimate, a ready card, a fallen troop, full pips. */
export function battleMoments(state: BattleState): TipCall[] {
  const calls: TipCall[] = [];
  if (ultimateReady(state)) calls.push({ id: 'ultimateReady' });
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    if (slotReadiness(state, slot) === 'ready') {
      calls.push({ id: 'cardReady', slot: slot + 1 });
      break;
    }
  }
  if (state.units.some((u) => u.side === 'player' && !u.alive)) calls.push({ id: 'troopLost' });
  if (state.command.pips >= state.command.maxPips) calls.push({ id: 'pipsFull' });
  return calls;
}

/** The tip's words, with its keys, slot and your General's ultimate filled in. */
export function tipText(call: TipCall, general: GeneralId): string {
  return TIPS[call.id].text
    .replace(/\{key:(\w+)\}/g, (_, action: string) => keyName(action as InputAction))
    .replace(/\{slot\}/g, String(call.slot ?? 1))
    .replace(/\{ultimate\}/g, GENERALS[general].ultimate.name);
}

const ARROWS: Partial<Record<InputAction, string>> = { left: '←', right: '→', up: '↑', down: '↓' };

function keyName(action: InputAction): string {
  return ARROWS[action] ?? keyLabel(action);
}

/** The tip marked seen; tips you have seen stay seen. */
export function seeTip(tutorial: Tutorial, id: TipId): Tutorial {
  return tutorial.seen.includes(id) ? tutorial : { ...tutorial, seen: TIP_IDS.filter((t) => t === id || tutorial.seen.includes(t)) };
}

/** Tips back on, from the start. */
export function replayTips(): Tutorial {
  return newTutorial();
}
