import { describe, expect, it } from 'vitest';
import { describeCard } from './describe';
import { parseOrder } from './parser';
import type { Card } from './types';

function parsed(text: string): Card {
  const result = parseOrder(text);
  if (!result.ok) throw new Error(`"${text}" did not parse: ${result.error}`);
  return result.card;
}

// Each order and the card it must become, in the card's own words.
const EXAMPLES: [string, string][] = [
  // The design's Rank III loadout.
  ['Rangers, focus their healer', 'Rangers focus enemy Guardians'],
  [
    'When their Assassin dives, protect my Ranger, then everyone focus him',
    'When an enemy Assassin reaches your backline: Protect your Rangers, then Focus the Assassin',
  ],
  ['Everyone fall back to the Guardian', 'Fall back to your Guardians'],
  // The design's "how one order grows" (Rank I).
  ['Everyone focus their Assassin.', 'Focus enemy Assassins'],
  // Focus.
  ['Focus the nearest enemy', 'Focus the nearest enemy'],
  ['attack!', 'Focus the nearest enemy'],
  ['Kill their rangers', 'Focus enemy Rangers'],
  ['Take out the healer', 'Focus enemy Guardians'],
  ['Vanguards, attack the weakest enemy', 'Vanguards focus the weakest enemy'],
  ['Focus fire on the enemy mage', 'Focus enemy Invokers'],
  ['go after their archers', 'Focus enemy Rangers'],
  ['all rangers shoot the closest enemy', 'Rangers focus the nearest enemy'],
  ['Gang up on their tank', 'Focus enemy Vanguards'],
  ['Charge!', 'Focus the nearest enemy'],
  ['Rangers should target the assassin', 'Rangers focus enemy Assassins'],
  // Move.
  ['Move forward', 'Move forward'],
  ['Vanguards, advance', 'Vanguards move forward'],
  ['Push up', 'Move forward'],
  ['Rangers move back', 'Rangers move back'],
  ['Move a Vanguard behind enemies', 'Vanguards move behind the enemy'],
  ['Vanguards, go behind enemy lines', 'Vanguards move behind the enemy'],
  ['Flank them', 'Move behind the enemy'],
  ['Guardians, move to my rangers', 'Guardians move to your Rangers'],
  // Fall Back.
  ['Fall back', 'Fall back'],
  ['Retreat!', 'Fall back'],
  ['Rangers, pull back to the vanguard', 'Rangers fall back to your Vanguards'],
  ['regroup at the guardian', 'Fall back to your Guardians'],
  // Protect.
  ['Protect my Ranger', 'Protect your Rangers'],
  ['Vanguards, cover the healer', 'Vanguards protect your Guardians'],
  ['Guard the weakest ally', 'Protect your weakest troop'],
  ['keep my archers alive', 'Protect your Rangers'],
  // Overcharge.
  ['Overcharge the Vanguard', 'Overcharge your Vanguards'],
  ['Rangers, use your skill', 'Overcharge your Rangers'],
  ['Shove them', 'Overcharge your Vanguards'],
  ['everyone overcharge', 'Overcharge everyone'],
  // Hold.
  ['Hold the line', 'Hold'],
  ['Vanguards, hold your ground', 'Vanguards hold'],
  ["Rangers don't move", 'Rangers hold'],
  ['Stay put', 'Hold'],
  // Call Reserve.
  ['Call in the reserves', 'Call a reserve'],
  ['Bring in the reserve Vanguard', 'Call the reserve Vanguard'],
  ['call in a ranger from the reserves', 'Call the reserve Ranger'],
  ['Reinforce!', 'Call a reserve'],
  // Several steps.
  ['Fall back, then focus the nearest enemy', 'Fall back, then Focus the nearest enemy'],
  ['Protect my rangers and hold', 'Protect your Rangers, then Hold'],
  [
    'Vanguards move behind the enemy, then overcharge the vanguards',
    'Vanguards move behind the enemy, then Overcharge your Vanguards',
  ],
  [
    'call in the reserves then everyone focus the healer',
    'Call a reserve, then Focus enemy Guardians',
  ],
  ['Rangers fall back, vanguards hold, guardians protect the rangers', 'Rangers fall back, then Vanguards hold, then Guardians protect your Rangers'],
  // Conditions.
  ['If an enemy reaches my backline, focus it', 'When any enemy reaches your backline: Focus the attacker'],
  ['When anyone dives, kill the attacker', 'When any enemy reaches your backline: Focus the attacker'],
  ['When my Ranger drops below 50%, protect her', 'When your Ranger drops below 50% HP: Protect your Ranger'],
  ['when my guardian falls under 30 percent hp, fall back to him', 'When your Guardian drops below 30% HP: Fall back to your Guardian'],
  ['If any ally is hurt, guardians protect them', 'When any ally drops below 50% HP: Guardians protect that ally'],
  ['When my vanguard is low, pull back', 'When your Vanguard drops below 30% HP: Fall back'],
  ['When my ranger drops below half health, retreat', 'When your Ranger drops below 50% HP: Fall back'],
  ['When 3 or more enemies are close together, focus them', 'When 3 or more enemies are close together: Focus the group'],
  ['When three enemies bunch up, overcharge the vanguard', 'When 3 or more enemies are close together: Overcharge your Vanguards'],
  ['if 4+ enemies are grouped, shove', 'When 4 or more enemies are close together: Overcharge your Vanguards'],
  ['invokers, rift', 'Overcharge your Invokers'],
  ['When 3 enemies group up, open a rift', 'When 3 or more enemies are close together: Overcharge your Invokers'],
  ['assassins shadowstep', 'Overcharge your Assassins'],
  ['shadow step', 'Overcharge your Assassins'],
  ['When they group up, call in the reserves', 'When 3 or more enemies are close together: Call a reserve'],
  ['When their ultimate is charging, fall back', 'When the enemy ultimate is charging: Fall back'],
  ['If the enemy charges their ultimate, spread out and hold', null as unknown as string],
  ['when the enemy ult is ready, everyone retreat to the guardian', 'When the enemy ultimate is charging: Fall back to your Guardians'],
  // Combined and repeating conditions.
  [
    'When their assassin dives and my ranger drops below 40%, protect my ranger',
    'When an enemy Assassin reaches your backline and your Ranger drops below 40% HP: Protect your Rangers',
  ],
  ['Every time their Assassin dives, focus him', 'Every time an enemy Assassin reaches your backline: Focus the Assassin'],
  ['Whenever enemies cluster, overcharge the vanguards', 'Every time 3 or more enemies are close together: Overcharge your Vanguards'],
  ['Each time my healer is low, protect him', 'Every time your Guardian drops below 30% HP: Protect your Guardian'],
  // Condition at the end.
  ['Focus their assassin when it dives', null as unknown as string],
  ['Fall back when their ultimate is charging', 'When the enemy ultimate is charging: Fall back'],
  ['Protect the rangers if an enemy assassin reaches our backline', 'When an enemy Assassin reaches your backline: Protect your Rangers'],
  // Style: no punctuation, extra words, capitals.
  ['WHEN THEIR ASSASSIN DIVES PROTECT MY RANGER THEN EVERYONE FOCUS HIM', 'When an enemy Assassin reaches your backline: Protect your Rangers, then Focus the Assassin'],
  ['please focus the healer now', 'Focus enemy Guardians'],
  ['Rangers - focus their healer!', 'Rangers focus enemy Guardians'],
];

describe('the rule parser', () => {
  const working = EXAMPLES.filter(([, expected]) => expected !== null);

  it('is tested on at least 50 example orders', () => {
    expect(working.length).toBeGreaterThanOrEqual(50);
  });

  for (const [text, expected] of working) {
    it(`reads "${text}"`, () => {
      expect(describeCard(parsed(text))).toBe(expected);
    });
  }

  it('keeps the words the card was written from', () => {
    expect(parsed('  Charge!  ').text).toBe('Charge!');
  });

  it('makes "whenever" and "every time" repeating, and "when" and "if" not', () => {
    expect(parsed('Every time they group up, hold').condition?.repeat).toBe(true);
    expect(parsed('Whenever they group up, hold').condition?.repeat).toBe(true);
    expect(parsed('When they group up, hold').condition?.repeat).toBe(false);
    expect(parsed('If they group up, hold').condition?.repeat).toBe(false);
  });

  it('never sets Auto: that is chosen in the card builder', () => {
    expect(parsed('When they group up, hold').auto).toBe(false);
  });

  it('turns orders literally, without improving them', () => {
    // A weak order stays weak: one step, no condition added.
    expect(parsed('Hold')).toEqual({ text: 'Hold', condition: null, steps: [{ action: 'hold', actors: { kind: 'all' } }], auto: false });
    // "Whenever" asks for a repeating card even though it needs Rank V; the validator decides.
    expect(parsed('Whenever they bunch up, focus them').condition).toEqual({
      triggers: [{ kind: 'enemiesGrouped', count: 3 }],
      repeat: true,
    });
  });
});

describe('orders the parser refuses', () => {
  const REFUSED: [string, RegExp][] = [
    ['', /Write an order/],
    ['Focus him', /Who is "him"/],
    ['When my ranger is hurt, focus him', /Who is "him"/],
    ['Protect', /Protect whom/],
    ['Move', /Move where/],
    ['Dance around', /didn't understand/],
    ['When the moon is full, attack', /didn't understand the condition/],
    ['Rangers focus their healer and bake a cake', /didn't understand/],
    ['If the enemy charges their ultimate, spread out and hold', /didn't understand/],
    ['Focus their assassin when it dives', /didn't understand/],
  ];
  for (const [text, error] of REFUSED) {
    it(`refuses "${text}"`, () => {
      const result = parseOrder(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(error);
    });
  }
});
