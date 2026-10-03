// What enemy commanders fire (session 4D). Each is a loadout of Auto cards: a card fires by
// itself the moment its condition is met and the commander has the pips. The cards go through
// the validator at the commander's rank and then through its General's personality rules, like
// yours. The ultimate fires as soon as it can.
//
// The conditions wait for the fight: none of them is met while the armies still stand in their
// starting lines, so no card is spent before the battle begins.

import type { Card, Loadout, Step } from '../cards/types';
import type { GeneralId } from './generals';
import { rankRules, unlockedActions, type RankNumber } from './ranks';

const all = { kind: 'all' } as const;

function auto(trigger: NonNullable<Card['condition']>['triggers'][number], ...steps: Step[]): Card {
  return { condition: { triggers: [trigger], repeat: false }, steps, auto: true };
}

/** Everyone turns on an enemy that reaches the backline. */
const DEFEND_BACKLINE = auto({ kind: 'enemyReachesBackline', enemy: 'any' }, { action: 'focus', actors: all, target: { kind: 'trigger' } });
/** Guardians cover a troop in trouble. */
const COVER_THE_HURT = auto(
  { kind: 'allyBelowHp', ally: 'any', hpPercent: 40 },
  { action: 'protect', actors: { kind: 'class', cls: 'guardian' }, target: { kind: 'trigger' } },
);
/** Bring in a reserve once things go badly. */
const CALL_RESERVE = auto({ kind: 'allyBelowHp', ally: 'any', hpPercent: 30 }, { action: 'callReserve', reserve: null });

/** The card each General plays differently: its signature move. */
const SIGNATURE: Readonly<Record<GeneralId, Card>> = {
  // Shove them back once the front line is hurt.
  captain: auto({ kind: 'allyBelowHp', ally: 'vanguard', hpPercent: 70 }, { action: 'overcharge', actors: { kind: 'class', cls: 'vanguard' } }),
  // Pile onto the weakest the moment one of ours bleeds.
  warlord: auto({ kind: 'allyBelowHp', ally: 'any', hpPercent: 60 }, { action: 'focus', actors: all, target: { kind: 'weakest' } }),
  // Pull back to the line and dig in.
  engineer: auto(
    { kind: 'allyBelowHp', ally: 'any', hpPercent: 60 },
    { action: 'fallBack', actors: all, to: null },
    { action: 'hold', actors: all },
  ),
  // The whole pack on the nearest prey.
  hiveMother: auto({ kind: 'allyBelowHp', ally: 'any', hpPercent: 70 }, { action: 'focus', actors: all, target: { kind: 'nearest' } }),
  // Feigned Retreat: fall back, then turn on the chasers.
  strategist: auto(
    { kind: 'allyBelowHp', ally: 'any', hpPercent: 50 },
    { action: 'fallBack', actors: all, to: null },
    { action: 'focus', actors: all, target: { kind: 'nearest' } },
  ),
  // Iron Shell against your ultimate: Guardians protect the Vanguards, then hold.
  conductor: auto(
    { kind: 'enemyUltimateCharging' },
    { action: 'protect', actors: { kind: 'class', cls: 'guardian' }, target: { kind: 'class', cls: 'vanguard' } },
    { action: 'hold', actors: { kind: 'class', cls: 'guardian' } },
  ),
};

/**
 * A card cut down to what a rank allows: its first steps up to the rank's step limit, without
 * actions the rank hasn't unlocked. Null when nothing is left, or when the rank has no Auto.
 * Scripts are written for a high rank; a lower-rank commander plays the part it knows.
 */
function fitToRank(card: Card, rank: RankNumber): Card | null {
  if (!rankRules(rank).autoMode) return null;
  const unlocked = unlockedActions(rank);
  const steps = card.steps.filter((s) => unlocked.includes(s.action)).slice(0, rankRules(rank).stepsPerCard);
  return steps.length > 0 ? { ...card, steps } : null;
}

/**
 * The cards an enemy commander under this General fires, best first, so a rank with fewer slots
 * keeps the best. A Rank I commander can't set cards to Auto, so it only fires its ultimate.
 */
export function enemyScript(general: GeneralId, rank: RankNumber): Loadout {
  const slots = [SIGNATURE[general], DEFEND_BACKLINE, COVER_THE_HURT, CALL_RESERVE].map((card) => fitToRank(card, rank));
  return { slots: slots.filter((card) => card !== null), legendary: null };
}
