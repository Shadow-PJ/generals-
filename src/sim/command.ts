// Command pips, Momentum and card slots: when cards glow, rest, fire by themselves, and what
// pressing a slot or the ultimate key does. Only your side has cards until enemy commanders (4D).

import { cardCost } from '../cards/cost';
import { applyPersonality } from '../cards/personality';
import type { Card, Loadout } from '../cards/types';
import { slotUnlockRank, validateCard } from '../cards/validator';
import { CARD_RULES } from '../data/cards';
import { COMMAND_RULES, ULTIMATES } from '../data/command';
import type { GeneralId } from '../data/generals';
import { rankRules, type RankNumber } from '../data/ranks';
import { checkCondition } from './conditions';
import { issueCard } from './orders';
import { livingUnits } from './queries';
import { secondsToTicks, TICKS_PER_SECOND } from './time';
import type { BattleInput, BattleState, CommandState, Side, SlotState } from './types';

export const LEGENDARY_SLOT = 4;
export const SLOT_COUNT = 5;

/**
 * Sets up the slots. Each card goes through the validator as you wrote it (a card the rank
 * doesn't allow, or in a locked slot, is left out), then through your General's personality
 * rules, so the General's version is what fires.
 */
export function createCommand(
  side: Side,
  rank: RankNumber,
  loadout: Loadout | undefined,
  general: GeneralId = 'captain',
): CommandState {
  const rules = rankRules(rank);
  const cards: (Card | null)[] = [...(loadout?.slots ?? []).slice(0, LEGENDARY_SLOT), null, null, null, null].slice(
    0,
    LEGENDARY_SLOT,
  );
  // The Legendary slot opens with the first boss win (session 5A).
  cards.push(null);
  const slots: SlotState[] = cards.map((card, i) => ({
    card:
      card && i < LEGENDARY_SLOT && !slotUnlockRank(i, rank) && validateCard(card, rank).ok
        ? applyPersonality(general, card, rank).card
        : null,
    restTicks: 0,
    glowing: false,
    lingerTicks: 0,
    firedThisGlow: false,
    triggerEnemyId: null,
    triggerAllyId: null,
    autoFires: 0,
    lastAutoTick: null,
  }));
  return {
    side,
    rank,
    pips: Math.min(COMMAND_RULES.startingPips, rules.maxPips),
    maxPips: rules.maxPips,
    pipProgress: 0,
    momentum: 0,
    slots,
  };
}

/** Pips, Momentum, rests and glows for one tick; Auto cards fire here. */
export function updateCommand(state: BattleState): void {
  const command = state.command;
  refillPips(state, command);
  command.momentum = Math.min(
    COMMAND_RULES.momentum.max,
    command.momentum + COMMAND_RULES.momentum.passivePerSecond / TICKS_PER_SECOND,
  );
  command.slots.forEach((slot, i) => {
    if (slot.restTicks > 0) slot.restTicks -= 1;
    updateGlow(state, command, slot);
    if (shouldAutoFire(state, command, slot)) fireSlot(state, i, true);
  });
}

/** True once the side has lost its share of troops for the comeback rule. */
export function inComeback(state: BattleState, side: Side): boolean {
  const fielded = state.units.filter((u) => u.side === side).length;
  const lost = fielded - livingUnits(state, side).length;
  return fielded > 0 && lost >= fielded * COMMAND_RULES.comebackLossShare;
}

function refillPips(state: BattleState, command: CommandState): void {
  const interval = secondsToTicks(COMMAND_RULES.pipRefillSeconds);
  command.pipProgress += inComeback(state, command.side) ? COMMAND_RULES.comebackRefillMultiplier : 1;
  while (command.pipProgress >= interval) {
    command.pipProgress -= interval;
    // A full bar wastes the pip.
    command.pips = Math.min(command.maxPips, command.pips + 1);
  }
}

function updateGlow(state: BattleState, command: CommandState, slot: SlotState): void {
  const condition = slot.card?.condition;
  if (!condition) return;
  const check = checkCondition(state, command.side, condition);
  if (check.met) {
    slot.glowing = true;
    slot.lingerTicks = secondsToTicks(COMMAND_RULES.glowLingerSeconds);
    slot.triggerEnemyId = check.enemyId;
    slot.triggerAllyId = check.allyId;
    return;
  }
  if (!slot.glowing) return;
  slot.lingerTicks -= 1;
  if (slot.lingerTicks <= 0) {
    slot.glowing = false;
    slot.firedThisGlow = false;
    slot.triggerEnemyId = null;
    slot.triggerAllyId = null;
  }
}

/** Auto: fires the moment its condition is met: once per battle, or every time for a repeating card. */
function shouldAutoFire(state: BattleState, command: CommandState, slot: SlotState): boolean {
  const card = slot.card;
  if (!card?.auto || !slot.glowing || slot.firedThisGlow || slot.restTicks > 0) return false;
  if (command.pips < cardCost(card)) return false;
  if (!card.condition?.repeat) return slot.autoFires === 0;
  const gap = secondsToTicks(CARD_RULES.repeatMinSeconds);
  return slot.lastAutoTick === null || state.tick - slot.lastAutoTick >= gap;
}

export type SlotReadiness = 'ready' | 'empty' | 'locked' | 'resting' | 'waiting' | 'noPips';

/** Whether a slot can fire now, and if not, why. */
export function slotReadiness(state: BattleState, index: number): SlotReadiness {
  const slot = state.command.slots[index];
  if (!slot) return 'locked';
  if (index === LEGENDARY_SLOT || slotUnlockRank(index, state.command.rank)) return 'locked';
  if (!slot.card) return 'empty';
  if (slot.restTicks > 0) return 'resting';
  // A card with a condition can only be fired while it glows.
  if (slot.card.condition && !slot.glowing) return 'waiting';
  if (state.command.pips < cardCost(slot.card)) return 'noPips';
  return 'ready';
}

/** Applies a player input. Inputs stamped for another tick are ignored. */
export function applyInput(state: BattleState, input: BattleInput): void {
  if (input.tick !== state.tick) return;
  state.inputLog.push(input);
  if (input.kind === 'slot') {
    if (slotReadiness(state, input.slot) === 'ready') fireSlot(state, input.slot, false);
  } else if (input.kind === 'ultimate') {
    fireUltimate(state);
  }
}

function fireSlot(state: BattleState, index: number, auto: boolean): void {
  const command = state.command;
  const slot = command.slots[index]!;
  const card = slot.card!;
  const cost = cardCost(card);
  // Perfect timing: a manual card fired while it glows. Tactical mode has none.
  const perfect = !auto && !!card.condition && slot.glowing && !state.tactical;
  command.pips -= cost;
  slot.restTicks = secondsToTicks(COMMAND_RULES.slotRestSeconds);
  slot.firedThisGlow = true;
  if (auto) {
    slot.autoFires += 1;
    slot.lastAutoTick = state.tick;
  }
  if (perfect) {
    command.pips = Math.min(command.maxPips, command.pips + COMMAND_RULES.perfect.pipRefund);
    command.momentum = Math.min(COMMAND_RULES.momentum.max, command.momentum + COMMAND_RULES.momentum.perfectGain);
  }
  state.events.push({ tick: state.tick, type: 'cardFired', side: command.side, slot: index, auto, perfect, cost });
  const power = perfect ? 1 + COMMAND_RULES.perfect.effectBonus : 1;
  issueCard(state, command.side, card, power, { enemyId: slot.triggerEnemyId, allyId: slot.triggerAllyId });
}

export function ultimateReady(state: BattleState): boolean {
  return state.command.momentum >= COMMAND_RULES.momentum.max;
}

/** The Captain's Rally: every troop heals and attacks faster for a few seconds. */
function fireUltimate(state: BattleState): void {
  if (!ultimateReady(state)) return;
  const command = state.command;
  const rally = ULTIMATES.rally;
  for (const unit of livingUnits(state, command.side)) {
    unit.hp = Math.min(unit.stats.maxHp, unit.hp + Math.round(unit.stats.maxHp * rally.healShare));
    unit.rallyTicks = secondsToTicks(rally.durationSeconds);
  }
  command.momentum = 0;
  state.events.push({ tick: state.tick, type: 'ultimate', side: command.side, name: 'rally' });
}
