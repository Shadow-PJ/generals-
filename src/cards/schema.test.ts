import { describe, expect, it } from 'vitest';
import { parseOrder } from './parser';
import { readCard } from './schema';
import type { Card } from './types';

// Orders that between them use every action, target, place and trigger.
const ORDERS = [
  'Rangers, focus their healer',
  'Everyone fall back to the Guardian',
  'Focus the nearest enemy',
  'Vanguards, attack the weakest enemy',
  'Move a Vanguard behind enemies',
  'Guardians, move to my rangers',
  'Rangers move back',
  'Move forward',
  'Fall back',
  'Guard the weakest ally',
  'Overcharge the Vanguard',
  'Hold the line',
  'Call in the reserves',
  'Bring in the reserve Vanguard',
  'When my Ranger drops below 50%, protect her',
  'When 3 or more enemies are close together, focus them',
  'When their ultimate is charging, fall back',
  'Every time their Assassin dives, focus him',
  'When their Assassin dives, protect my Ranger, then everyone focus him',
];

function parsed(text: string): Card {
  const result = parseOrder(text);
  if (!result.ok) throw new Error(`could not parse "${text}"`);
  return result.card;
}

/** The card after a trip through a save file. */
const roundTrip = (card: Card) => readCard(JSON.parse(JSON.stringify(card)));

describe('reading cards from saved data', () => {
  it.each(ORDERS)('keeps "%s" exactly as it was', (text) => {
    const card = parsed(text);
    expect(roundTrip(card)).toEqual(card);
  });

  it('keeps cards without words, Auto and combined conditions included', () => {
    const card: Card = {
      condition: {
        triggers: [
          { kind: 'enemiesGrouped', count: 4 },
          { kind: 'allyBelowHp', ally: 'any', hpPercent: 25 },
        ],
        repeat: true,
      },
      steps: [
        { action: 'callReserve', reserve: null },
        { action: 'move', actors: { kind: 'named', name: 'Raven' }, to: { kind: 'ally', ally: { kind: 'trigger' } } },
      ],
      auto: true,
    };
    expect(roundTrip(card)).toEqual(card);
  });

  it('drops fields a card does not have', () => {
    const data = { ...parsed('Fall back'), extra: 'junk', steps: [{ action: 'fallBack', actors: { kind: 'all', x: 1 }, to: null, y: 2 }] };
    expect(readCard(data)).toEqual({ text: 'Fall back', condition: null, steps: [{ action: 'fallBack', actors: { kind: 'all' }, to: null }], auto: false });
  });

  it('refuses data that is not shaped like a card', () => {
    const good = parsed('When my Ranger drops below 50%, protect her');
    const broken: unknown[] = [
      null,
      42,
      'card',
      [],
      {},
      { ...good, steps: 'focus' },
      { ...good, auto: 'yes' },
      { ...good, condition: { triggers: [{ kind: 'moonRises' }], repeat: false } },
      { ...good, condition: { triggers: [{ kind: 'allyBelowHp', ally: 'ranger', hpPercent: '50' }], repeat: false } },
      { ...good, condition: { triggers: [], repeat: 'often' } },
      { ...good, steps: [{ action: 'nuke', actors: { kind: 'all' } }] },
      { ...good, steps: [{ action: 'focus', actors: { kind: 'all' } }] },
      { ...good, steps: [{ action: 'focus', actors: { kind: 'class', cls: 'dragon' }, target: { kind: 'nearest' } }] },
      { ...good, steps: [{ action: 'move', actors: { kind: 'all' }, to: { kind: 'moon' } }] },
      { ...good, steps: [{ action: 'callReserve', reserve: 'dragon' }] },
    ];
    for (const data of broken) expect(readCard(data)).toBeNull();
  });

  it('leaves rank rules to the validator: a too-big card still reads', () => {
    const card = parsed('When their Assassin dives, protect my Ranger, then everyone focus him');
    const big = { ...card, steps: [...card.steps, ...card.steps, ...card.steps] };
    expect(readCard(big)?.steps).toHaveLength(6);
  });
});
