// Command pips, Momentum and card slots: when cards glow, rest, fire by themselves, and what
// pressing a slot or the ultimate key does. Cards fired close together form a chain (cheaper,
// more Momentum), steps in a row can make a signature combo, and the ultimate at the end of a
// long chain is a Finisher. Your General bends one rule about pips (their mana twist). The
// enemy may have a commander too, with its own Command bar; it fires its cards by script (all
// Auto) and its ultimate as soon as it can.

import { makesCombo } from '../cards/combos';
import { cardCost } from '../cards/cost';
import { applyPersonality } from '../cards/personality';
import type { Card, LegendaryAction, Loadout } from '../cards/types';
import { slotUnlockRank, validateCard, type SlotContext } from '../cards/validator';
import type { BoonId } from '../data/boons';
import { CARD_RULES } from '../data/cards';
import { COMBO_BONUSES, SIGNATURE_COMBOS } from '../data/combos';
import { COMMAND_RULES } from '../data/command';
import { MANA_TWISTS, type GeneralId } from '../data/generals';
import { rankRules, type RankNumber } from '../data/ranks';
import { extraMaxPips, extraStartingPips, pipRateBonus, startingMomentum } from './boons';
import { checkCondition } from './conditions';
import { castLegendary, legendaryReady } from './legendary';
import { issueCard, type ComboAt } from './orders';
import { hpShare, livingUnits } from './queries';
import { payHp } from './status';
import { secondsToTicks, TICKS_PER_SECOND } from './time';
import { castUltimate, ultimateOf, ultimateUsable } from './ultimates';
import type { BattleInput, BattleState, CommandState, Side, SlotState, Unit } from './types';

export const LEGENDARY_SLOT = 4;
export const SLOT_COUNT = 5;

/**
 * Sets up the slots. Each card goes through the validator as you wrote it (a card the rank
 * doesn't allow, or in a locked slot, is left out), then through your General's personality
 * rules, so the General's version is what fires. The Legendary slot opens once a boss has
 * taught a Legendary action (`learned`).
 */
export function createCommand(
  side: Side,
  rank: RankNumber,
  loadout: Loadout | undefined,
  general: GeneralId = 'captain',
  learned: readonly LegendaryAction[] = [],
  boons: readonly BoonId[] = [],
): CommandState {
  const rules = rankRules(rank);
  const maxPips = rules.maxPips + extraMaxPips(boons);
  const regular = [...(loadout?.slots ?? []).slice(0, LEGENDARY_SLOT), null, null, null, null].slice(0, LEGENDARY_SLOT);
  const legendaryOpen = learned.length > 0;
  const regularSlot: SlotContext = { legendarySlot: false, learned };
  const legendarySlot: SlotContext = { legendarySlot: true, learned };
  const read = (card: Card | null, slot: SlotContext): Card | null =>
    card && validateCard(card, rank, slot).ok ? applyPersonality(general, card, rank, slot).card : null;
  const cards: (Card | null)[] = [
    ...regular.map((card, i) => (slotUnlockRank(i, rank) ? null : read(card, regularSlot))),
    legendaryOpen ? read(loadout?.legendary ?? null, legendarySlot) : null,
  ];
  const slots: SlotState[] = cards.map((card) => ({
    card,
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
    // Prepared (Strategist): every battle starts with full pips. Boons can add pips and Momentum.
    pips: general === 'strategist' ? maxPips : Math.min(COMMAND_RULES.startingPips + extraStartingPips(boons), maxPips),
    maxPips,
    pipProgress: 0,
    momentum: Math.min(COMMAND_RULES.momentum.max, startingMomentum(boons)),
    slots,
    chain: { links: 0, lastTick: 0, lastStep: null, lastReserveIds: [] },
    legendaryOpen,
    lastCard: null,
    pipRateBonus: pipRateBonus(boons),
    maxPipBonus: extraMaxPips(boons),
  };
}

/** Every Command bar in the battle: yours, then the enemy commander's if there is one. */
export function commandsOf(state: BattleState): CommandState[] {
  return state.enemyCommand ? [state.command, state.enemyCommand] : [state.command];
}

/** The Command bar of a side, or null when it has none (an enemy without a commander). */
export function commandOf(state: BattleState, side: Side): CommandState | null {
  return side === state.command.side ? state.command : state.enemyCommand;
}

/**
 * Pips, Momentum, rests and glows for one tick; Auto cards fire here. An enemy commander also
 * fires its ultimate as soon as it is ready.
 */
export function updateCommand(state: BattleState): void {
  for (const command of commandsOf(state)) {
    if (command.chain.links > 0 && !chainOpen(state, command)) command.chain = { links: 0, lastTick: 0, lastStep: null, lastReserveIds: [] };
    refillPips(state, command);
    command.momentum = Math.min(
      COMMAND_RULES.momentum.max,
      command.momentum + COMMAND_RULES.momentum.passivePerSecond / TICKS_PER_SECOND,
    );
    command.slots.forEach((slot, i) => {
      if (slot.restTicks > 0) slot.restTicks -= 1;
      updateGlow(state, command, slot);
      if (shouldAutoFire(state, command, slot)) fireSlot(state, command, i, true);
    });
    if (command !== state.command && ultimateReady(state, command)) fireUltimate(state, command);
  }
}

/** True once the side has lost its share of troops for the comeback rule. */
export function inComeback(state: BattleState, side: Side): boolean {
  const fielded = state.units.filter((u) => u.side === side).length;
  const lost = fielded - livingUnits(state, side).length;
  return fielded > 0 && lost >= fielded * COMMAND_RULES.comebackLossShare;
}

/**
 * Pips refill one at a time. Feeding (Hive Mother) and Prepared (Strategist) refill slower;
 * Build-Up (Engineer) raises the most you can hold as the battle goes on.
 */
function refillPips(state: BattleState, command: CommandState): void {
  const general = state.generals[command.side];
  if (general === 'engineer') {
    const buildUp = MANA_TWISTS.buildUp;
    const extra = Math.min(buildUp.maxExtraPips, Math.floor(state.tick / secondsToTicks(buildUp.everySeconds)));
    command.maxPips = rankRules(command.rank).maxPips + command.maxPipBonus + extra;
  }
  const rate = general === 'hiveMother' ? MANA_TWISTS.feeding.refillRate : general === 'strategist' ? MANA_TWISTS.prepared.refillRate : 1;
  const interval = secondsToTicks(COMMAND_RULES.pipRefillSeconds);
  command.pipProgress += rate * (1 + command.pipRateBonus) * (inComeback(state, command.side) ? COMMAND_RULES.comebackRefillMultiplier : 1);
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
    // Rhythm (Conductor): the glow lasts longer.
    const linger = state.generals[command.side] === 'conductor' ? MANA_TWISTS.rhythm.glowLingerSeconds : COMMAND_RULES.glowLingerSeconds;
    slot.lingerTicks = secondsToTicks(linger);
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
  if (!legendaryReady(state, command, card, triggersOf(slot))) return false;
  if (!canAfford(state, chainedCost(state, card, command), command)) return false;
  if (!card.condition?.repeat) return slot.autoFires === 0;
  const gap = secondsToTicks(CARD_RULES.repeatMinSeconds);
  return slot.lastAutoTick === null || state.tick - slot.lastAutoTick >= gap;
}

export type SlotReadiness = 'ready' | 'empty' | 'locked' | 'resting' | 'waiting' | 'noPips';

/** Whether a slot can fire now, and if not, why. Your slots unless another Command bar is given. */
export function slotReadiness(state: BattleState, index: number, command: CommandState = state.command): SlotReadiness {
  const slot = command.slots[index];
  if (!slot) return 'locked';
  if (index === LEGENDARY_SLOT ? !command.legendaryOpen : slotUnlockRank(index, command.rank)) return 'locked';
  if (!slot.card) return 'empty';
  if (slot.restTicks > 0) return 'resting';
  // A card with a condition can only be fired while it glows; a Legendary action needs something to work on.
  if (slot.card.condition && !slot.glowing) return 'waiting';
  if (!legendaryReady(state, command, slot.card, triggersOf(slot))) return 'waiting';
  if (!canAfford(state, chainedCost(state, slot.card, command), command)) return 'noPips';
  return 'ready';
}

// Paying for cards ---------------------------------------------------------------------------

/**
 * Blood Price (Warlord): the troop that pays the pips you lack with its HP, if one can: your
 * healthiest troop, if it would keep at least 1 HP.
 */
export function bloodPayer(state: BattleState, missingPips: number, command: CommandState = state.command): Unit | undefined {
  if (missingPips <= 0 || state.generals[command.side] !== 'warlord') return undefined;
  let healthiest: Unit | undefined;
  for (const u of livingUnits(state, command.side)) if (!healthiest || hpShare(u) > hpShare(healthiest)) healthiest = u;
  if (!healthiest) return undefined;
  const price = bloodPrice(healthiest, missingPips);
  return healthiest.hp - price >= 1 ? healthiest : undefined;
}

function bloodPrice(unit: Unit, pips: number): number {
  return Math.round(unit.stats.maxHp * MANA_TWISTS.bloodPrice.hpSharePerPip * pips);
}

/** True if the Command bar can pay `cost` now: with pips, or (Warlord) with blood for the rest. */
export function canAfford(state: BattleState, cost: number, command: CommandState = state.command): boolean {
  const missing = cost - command.pips;
  return missing <= 0 || bloodPayer(state, missing, command) !== undefined;
}

/** Pays a card's cost: pips first, then blood for what is missing. */
function pay(state: BattleState, command: CommandState, cost: number): void {
  const missing = cost - command.pips;
  const payer = bloodPayer(state, missing, command);
  if (payer) payHp(state, payer, bloodPrice(payer, missing), 'bloodPrice');
  command.pips = Math.max(0, command.pips - cost);
}

/** Feeding (Hive Mother): every enemy that falls gives a pip. Called for every troop that falls. */
export function fed(state: BattleState, fallen: Unit): void {
  for (const command of commandsOf(state)) {
    if (fallen.side === command.side || state.generals[command.side] !== 'hiveMother') continue;
    command.pips = Math.min(command.maxPips, command.pips + MANA_TWISTS.feeding.pipsPerKill);
  }
}

// Chains --------------------------------------------------------------------------------------

/** True while the last link is recent enough for the next card to join the chain. */
function chainOpen(state: BattleState, command: CommandState): boolean {
  const chain = command.chain;
  return chain.links > 0 && state.tick - chain.lastTick <= secondsToTicks(COMMAND_RULES.chain.windowSeconds);
}

/** The link a card or the ultimate fired now would be: 1 on its own, 2 or more in a chain (from Rank III). */
export function nextLink(state: BattleState, command: CommandState = state.command): number {
  if (!rankRules(command.rank).chains) return 1;
  return chainOpen(state, command) ? command.chain.links + 1 : 1;
}

/** What a card costs fired now: each link after the first costs 1 less, down to 1. */
export function chainedCost(state: BattleState, card: Card, command: CommandState = state.command): number {
  const cost = cardCost(card);
  if (nextLink(state, command) === 1) return cost;
  return Math.max(Math.min(cost, COMMAND_RULES.chain.minCost), cost - COMMAND_RULES.chain.linkDiscount);
}

/** The cost of the card in a slot if it were fired now, or null for an empty slot. */
export function slotCost(state: BattleState, index: number): number | null {
  const card = state.command.slots[index]?.card;
  return card ? chainedCost(state, card) : null;
}

/** Ticks left for the next card to join the chain, or 0 when no chain is open. */
export function chainTicksLeft(state: BattleState): number {
  if (!chainOpen(state, state.command) || !rankRules(state.command.rank).chains) return 0;
  return secondsToTicks(COMMAND_RULES.chain.windowSeconds) - (state.tick - state.command.chain.lastTick);
}

function addMomentum(command: CommandState, amount: number, link: number): void {
  const multiplier = link > 1 ? COMMAND_RULES.momentum.chainMultiplier : 1;
  command.momentum = Math.min(COMMAND_RULES.momentum.max, command.momentum + amount * multiplier);
}

/** The signature combos a card makes: with the last card of the chain, and between its own steps. */
function combosOf(command: CommandState, card: Card, link: number): ComboAt[] {
  if (!rankRules(command.rank).signatureCombos) return [];
  const found: ComboAt[] = [];
  const previous = link > 1 ? command.chain.lastStep : null;
  const steps = previous ? [previous, ...card.steps] : card.steps;
  for (let i = 0; i + 1 < steps.length; i++) {
    const combo = SIGNATURE_COMBOS.find((c) => makesCombo(c, steps[i]!, steps[i + 1]!));
    // `step` counts this card's steps: the pair's second step.
    if (combo) found.push({ combo: combo.id, step: previous ? i : i + 1, acrossCards: previous !== null && i === 0 });
  }
  return found;
}

/** Applies a player input. Inputs stamped for another tick are ignored. */
export function applyInput(state: BattleState, input: BattleInput): void {
  if (input.tick !== state.tick) return;
  state.inputLog.push(input);
  if (input.kind === 'slot') {
    if (slotReadiness(state, input.slot) === 'ready') fireSlot(state, state.command, input.slot, false);
  } else if (input.kind === 'ultimate') {
    fireUltimate(state, state.command);
  }
}

function fireSlot(state: BattleState, command: CommandState, index: number, auto: boolean): void {
  const slot = command.slots[index]!;
  const card = slot.card!;
  const link = nextLink(state, command);
  const cost = chainedCost(state, card, command);
  // Perfect timing: a manual card fired while it glows. Tactical mode has none.
  const perfect = !auto && !!card.condition && slot.glowing && !state.tactical;
  pay(state, command, cost);
  slot.restTicks = secondsToTicks(COMMAND_RULES.slotRestSeconds);
  slot.firedThisGlow = true;
  if (auto) {
    slot.autoFires += 1;
    slot.lastAutoTick = state.tick;
  }
  if (perfect) {
    // Rhythm (Conductor): Perfect timing gives more pips back.
    const refund = state.generals[command.side] === 'conductor' ? MANA_TWISTS.rhythm.perfectPipRefund : COMMAND_RULES.perfect.pipRefund;
    command.pips = Math.min(command.maxPips, command.pips + refund);
    addMomentum(command, COMMAND_RULES.momentum.perfectGain, link);
  }
  if (link > 1) addMomentum(command, COMMAND_RULES.momentum.chainLinkGain, link);
  state.events.push({ tick: state.tick, type: 'cardFired', side: command.side, slot: index, auto, perfect, cost, link });
  const combos = combosOf(command, card, link);
  for (const c of combos) {
    addMomentum(command, COMBO_BONUSES.momentumGain, link);
    state.events.push({ tick: state.tick, type: 'combo', side: command.side, combo: c.combo, acrossCards: c.acrossCards });
  }
  const power = perfect ? 1 + COMMAND_RULES.perfect.effectBonus : 1;
  const triggers = triggersOf(slot);
  // Legendary actions happen at once, then the other steps become troop orders.
  castLegendary(state, command, card, triggers, power);
  const called = issueCard(state, command.side, card, power, triggers, combos, command.chain.lastReserveIds);
  if (index !== LEGENDARY_SLOT) command.lastCard = { card, triggerEnemyId: triggers.enemyId, triggerAllyId: triggers.allyId };
  if (rankRules(command.rank).chains) {
    command.chain = { links: link, lastTick: state.tick, lastStep: card.steps.at(-1) ?? null, lastReserveIds: called };
  }
}

/** Who set off the slot's condition, for "him" and "her". */
function triggersOf(slot: SlotState): { enemyId: number | null; allyId: number | null } {
  return { enemyId: slot.triggerEnemyId, allyId: slot.triggerAllyId };
}

/** True when Momentum is full (yours, unless another Command bar is given). */
export function momentumFull(state: BattleState, command: CommandState = state.command): boolean {
  return command.momentum >= COMMAND_RULES.momentum.max;
}

/** True when Momentum is full and the General's ultimate has something to work on. */
export function ultimateReady(state: BattleState, command: CommandState = state.command): boolean {
  return momentumFull(state, command) && ultimateUsable(state, command.side);
}

/**
 * The General's ultimate (ultimates.ts). As the 3rd link of a chain or later (from Rank IV) it
 * is a Finisher, and 50% stronger.
 */
function fireUltimate(state: BattleState, command: CommandState): void {
  if (!ultimateReady(state, command)) return;
  const link = nextLink(state, command);
  const finisher = rankRules(command.rank).finishers && link >= COMMAND_RULES.finisher.minLinks;
  const power = finisher ? 1 + COMMAND_RULES.finisher.powerBonus : 1;
  const mark = castUltimate(state, command.side, power);
  command.momentum = 0;
  state.events.push({ tick: state.tick, type: 'ultimate', side: command.side, name: ultimateOf(state, command.side), link, finisher, ...mark });
  // The ultimate is a link too, but has no step to make a combo with.
  if (rankRules(command.rank).chains) command.chain = { links: link, lastTick: state.tick, lastStep: null, lastReserveIds: [] };
}
