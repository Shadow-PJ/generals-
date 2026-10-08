// Hard-choice events (session 5B): an event node on a run's path tells a short story and makes you
// trade one thing for another. Each choice is a list of effects on your run. Starting values to tune.

import type { Rarity } from './rarity';
import type { UnitClass } from './units';

export type EventEffect =
  /** Gold gained, or spent when negative (the choice needs that much). */
  | { kind: 'gold'; amount: number }
  /** Every fighter heals this share of their max HP. */
  | { kind: 'heal'; share: number }
  /** Every fighter loses this share of their max HP, but never drops below `RUN_EVENT_RULES.minHp`. */
  | { kind: 'hurt'; share: number }
  /** `count` fighters join (one when left out): of this rarity, of `cls` or a class you have, at `hp` share of their HP. */
  | { kind: 'fighter'; rarity: Rarity; cls?: UnitClass; hp?: number; count?: number }
  /** A fighter leaves: one at random, or the one with the least HP. Never your last. */
  | { kind: 'loseFighter'; which: 'random' | 'weakest' }
  /** One of your fighters, at random, rises a rarity. */
  | { kind: 'upgrade' }
  /** A boon of this rarity, one you don't have yet. */
  | { kind: 'boon'; rarity: Rarity }
  /** One of your boons, at random, is lost. */
  | { kind: 'loseBoon' }
  /** An artifact you don't have yet, carried until you bank it. */
  | { kind: 'artifact' };

export interface EventChoice {
  label: string;
  /** What happens, in plain words. */
  text: string;
  effects: readonly EventEffect[];
}

export interface EventData {
  title: string;
  story: string;
  choices: readonly EventChoice[];
}

export const RUN_EVENT_RULES = {
  /** Events never hurt a fighter below this share of their HP. */
  minHp: 0.1,
} as const;

export const EVENT_IDS = [
  'oldShrine',
  'sellswords',
  'deserters',
  'fieldHospital',
  'blackBlade',
  'quartermaster',
  'abandonedArmory',
  'recruiter',
  'stormOnThePass',
  'wanderingTactician',
] as const;
export type EventId = (typeof EVENT_IDS)[number];

export const EVENTS: Readonly<Record<EventId, EventData>> = {
  oldShrine: {
    title: 'The Old Shrine',
    story: 'A shrine to a forgotten General, its altar heavy with offerings. Something in the stone hums.',
    choices: [
      { label: 'Take the offerings', text: '+60 gold', effects: [{ kind: 'gold', amount: 60 }] },
      { label: 'Pray for strength', text: 'One of your fighters rises a rarity', effects: [{ kind: 'upgrade' }] },
      {
        label: 'Bleed on the altar',
        text: 'Every fighter loses 20% HP; you find an artifact',
        effects: [{ kind: 'hurt', share: 0.2 }, { kind: 'artifact' }],
      },
    ],
  },
  sellswords: {
    title: 'Sellswords by the Road',
    story: 'A band of sellswords sizes up your army over their fire. Their champion grins at you.',
    choices: [
      { label: 'Hire their best', text: '−60 gold; a Rare fighter joins', effects: [{ kind: 'gold', amount: -60 }, { kind: 'fighter', rarity: 'rare' }] },
      {
        label: 'Beat their champion',
        text: 'Every fighter loses 15% HP; a Rare boon',
        effects: [{ kind: 'hurt', share: 0.15 }, { kind: 'boon', rarity: 'rare' }],
      },
      { label: 'Walk on', text: 'Nothing happens', effects: [] },
    ],
  },
  deserters: {
    title: 'Deserters',
    story: 'Two enemy troops have thrown down their arms. They are hurt and hungry, and beg to join you.',
    choices: [
      {
        label: 'Take them in',
        text: 'Two Common fighters join, at half HP',
        effects: [{ kind: 'fighter', rarity: 'common', hp: 0.5, count: 2 }],
      },
      { label: 'Take their pay chest', text: '+35 gold', effects: [{ kind: 'gold', amount: 35 }] },
    ],
  },
  fieldHospital: {
    title: 'Field Hospital',
    story: 'Healers have pitched their tents by a stream. They will help, and one of them would march with you.',
    choices: [
      { label: 'Rest a while', text: 'Every fighter heals 40%', effects: [{ kind: 'heal', share: 0.4 }] },
      { label: 'Pay for their best care', text: '−30 gold; every fighter heals fully', effects: [{ kind: 'gold', amount: -30 }, { kind: 'heal', share: 1 }] },
      { label: 'Take the healer along', text: 'A Rare Guardian joins; nobody rests', effects: [{ kind: 'fighter', rarity: 'rare', cls: 'guardian' }] },
    ],
  },
  blackBlade: {
    title: 'The Black Blade',
    story: 'A black sword stands in the ground. Whoever draws it fights like ten, they say, and bleeds like ten.',
    choices: [
      {
        label: 'Draw it',
        text: 'An Epic boon; every fighter loses 25% HP',
        effects: [{ kind: 'boon', rarity: 'epic' }, { kind: 'hurt', share: 0.25 }],
      },
      { label: 'Leave it be', text: 'Nothing happens', effects: [] },
    ],
  },
  // The Gamblers' Tent until session 7C, when it stopped taking bets: a bet on in-game gold counts
  // as simulated gambling for age ratings.
  quartermaster: {
    title: 'The Quartermaster',
    story: 'A quartermaster sits on more supplies than he has soldiers. "Everything has a price, Commander."',
    choices: [
      {
        label: 'Sell him a boon',
        text: 'Give up one of your boons at random; +75 gold',
        effects: [{ kind: 'loseBoon' }, { kind: 'gold', amount: 75 }],
      },
      {
        label: 'Raid his stores',
        text: '+40 gold; his guards fight back: every fighter loses 10% HP',
        effects: [{ kind: 'gold', amount: 40 }, { kind: 'hurt', share: 0.1 }],
      },
      { label: 'Walk away', text: 'Nothing happens', effects: [] },
    ],
  },
  abandonedArmory: {
    title: 'Abandoned Armory',
    story: 'Rusty racks of weapons in a ruined fort. Some of it is still good.',
    choices: [
      { label: 'Arm one troop with the best', text: 'One of your fighters rises a rarity', effects: [{ kind: 'upgrade' }] },
      { label: 'Sell it by the cartload', text: '+45 gold', effects: [{ kind: 'gold', amount: 45 }] },
    ],
  },
  recruiter: {
    title: 'The Recruiter',
    story: 'A royal recruiter offers a trade: one of your troops, any she likes, for one of her veterans.',
    choices: [
      {
        label: 'Trade',
        text: 'A fighter of yours leaves, at random; an Epic fighter joins',
        effects: [{ kind: 'loseFighter', which: 'random' }, { kind: 'fighter', rarity: 'epic' }],
      },
      { label: 'Decline', text: 'Nothing happens', effects: [] },
    ],
  },
  stormOnThePass: {
    title: 'Storm on the Pass',
    story: 'A storm rolls over the pass. Somewhere ahead is a supply cache, if you push on.',
    choices: [
      {
        label: 'Push through',
        text: 'Every fighter loses 15% HP; +40 gold',
        effects: [{ kind: 'hurt', share: 0.15 }, { kind: 'gold', amount: 40 }],
      },
      { label: 'Wait it out', text: 'Every fighter heals 15%', effects: [{ kind: 'heal', share: 0.15 }] },
    ],
  },
  wanderingTactician: {
    title: 'The Wandering Tactician',
    story: 'An old tactician offers a lesson in war, for a price, or a trade of tricks.',
    choices: [
      { label: 'Pay for the lesson', text: '−45 gold; a Rare boon', effects: [{ kind: 'gold', amount: -45 }, { kind: 'boon', rarity: 'rare' }] },
      {
        label: 'Trade tricks',
        text: 'Lose one of your boons, at random; an Epic boon',
        effects: [{ kind: 'loseBoon' }, { kind: 'boon', rarity: 'epic' }],
      },
      { label: 'Decline', text: 'Nothing happens', effects: [] },
    ],
  },
};
