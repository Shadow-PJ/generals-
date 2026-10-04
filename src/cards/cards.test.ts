import { describe, expect, it } from 'vitest';
import { ACTION_COSTS } from '../data/cards';
import { cardCost } from './cost';
import { describeCard, describeStep, shortCard } from './describe';
import { LEGENDARY_ACTIONS, REGULAR_ACTIONS, type Card } from './types';

// The Rank III loadout from the design.
const healer: Card = {
  condition: null,
  steps: [{ action: 'focus', actors: { kind: 'class', cls: 'ranger' }, target: { kind: 'class', cls: 'guardian' } }],
  auto: false,
};
const assassinDives: Card = {
  condition: { triggers: [{ kind: 'enemyReachesBackline', enemy: 'assassin' }], repeat: false },
  steps: [
    { action: 'protect', actors: { kind: 'all' }, target: { kind: 'class', cls: 'ranger' } },
    { action: 'focus', actors: { kind: 'all' }, target: { kind: 'trigger' } },
  ],
  auto: false,
};
const fallBack: Card = {
  condition: null,
  steps: [{ action: 'fallBack', actors: { kind: 'all' }, to: { kind: 'class', cls: 'guardian' } }],
  auto: false,
};

describe('card costs', () => {
  it('match the design: 1 for Focus, Move, Fall Back, Protect and Hold; 2 for Overcharge and Call Reserve; 3 for Legendary actions', () => {
    const regular = Object.fromEntries(REGULAR_ACTIONS.map((a) => [a, ACTION_COSTS[a]]));
    expect(regular).toEqual({ focus: 1, move: 1, fallBack: 1, protect: 1, hold: 1, overcharge: 2, callReserve: 2 });
    for (const action of LEGENDARY_ACTIONS) expect(ACTION_COSTS[action]).toBe(3);
  });

  it('add up the steps, as in the design loadout', () => {
    expect(cardCost(healer)).toBe(1);
    expect(cardCost(assassinDives)).toBe(2);
    expect(cardCost(fallBack)).toBe(1);
    expect(
      cardCost({
        condition: null,
        steps: [
          { action: 'overcharge', actors: { kind: 'class', cls: 'vanguard' } },
          { action: 'callReserve', reserve: null },
        ],
        auto: false,
      }),
    ).toBe(4);
  });
});

describe('cards in words', () => {
  it('read like the design examples', () => {
    expect(describeCard(healer)).toBe('Rangers focus enemy Guardians');
    expect(describeCard(assassinDives)).toBe(
      'When an enemy Assassin reaches your backline: Protect your Rangers, then Focus the Assassin',
    );
    expect(describeCard(fallBack)).toBe('Fall back to your Guardians');
  });

  it('cover every action, condition and repeating card', () => {
    const card: Card = {
      condition: {
        triggers: [
          { kind: 'allyBelowHp', ally: 'ranger', hpPercent: 40 },
          { kind: 'enemyUltimateCharging' },
        ],
        repeat: true,
      },
      steps: [
        { action: 'move', actors: { kind: 'class', cls: 'vanguard' }, to: { kind: 'behindEnemies' } },
        { action: 'overcharge', actors: { kind: 'class', cls: 'vanguard' } },
        { action: 'hold', actors: { kind: 'all' } },
      ],
      auto: true,
    };
    expect(describeCard(card)).toBe(
      'Every time your Ranger drops below 40% HP and the enemy ultimate is charging: ' +
        'Vanguards move behind the enemy, then Overcharge your Vanguards, then Hold',
    );
    expect(describeStep({ action: 'callReserve', reserve: 'vanguard' })).toBe('Call the reserve Vanguard');
    expect(describeStep({ action: 'callReserve', reserve: null })).toBe('Call a reserve');
    expect(describeStep({ action: 'protect', actors: { kind: 'all' }, target: { kind: 'trigger' } }, card)).toBe(
      'Protect your Ranger',
    );
    expect(describeStep({ action: 'fallBack', actors: { kind: 'all' }, to: null })).toBe('Fall back');
    expect(
      describeCard({
        condition: { triggers: [{ kind: 'enemiesGrouped', count: 3 }], repeat: false },
        steps: [{ action: 'focus', actors: { kind: 'all' }, target: { kind: 'trigger' } }],
        auto: false,
      }),
    ).toBe('When 3 or more enemies are close together: Focus the group');
  });
});

describe('cards in a few words', () => {
  it('fit the slot bar', () => {
    expect(shortCard(healer)).toBe('Focus Guardians');
    expect(shortCard(assassinDives)).toBe('Assassin dives: Protect Rangers, Focus it');
    expect(shortCard(fallBack)).toBe('Fall back to Guardians');
    expect(
      shortCard({
        condition: { triggers: [{ kind: 'allyBelowHp', ally: 'any', hpPercent: 50 }, { kind: 'enemiesGrouped', count: 3 }], repeat: true },
        steps: [{ action: 'callReserve', reserve: null }],
        auto: true,
      }),
    ).toBe('Every time Ally < 50% + 3+ enemies grouped: Call reserve');
  });
});

describe('cards as data', () => {
  it('survive a JSON round trip unchanged', () => {
    for (const card of [healer, assassinDives, fallBack]) {
      expect(JSON.parse(JSON.stringify(card))).toEqual(card);
    }
  });
});
