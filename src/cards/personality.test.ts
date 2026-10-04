import { describe, expect, it } from 'vitest';
import { GENERAL_IDS, type GeneralId } from '../data/generals';
import { GENERAL_REPLIES } from '../data/replies';
import { cardCost } from './cost';
import { describeCard } from './describe';
import { parseOrder } from './parser';
import { applyPersonality, type PersonalityRule } from './personality';
import { generalReply } from './replies';
import type { Card, Step } from './types';
import { validateCard } from './validator';

function card(text: string): Card {
  const result = parseOrder(text);
  if (!result.ok) throw new Error(`could not parse "${text}": ${result.error}`);
  return result.card;
}

/** A card built from the menus: no words. */
function built(...steps: Step[]): Card {
  return { condition: null, steps, auto: false };
}

const read = (general: GeneralId, c: Card, rank: 1 | 2 | 3 | 4 | 5 = 5) => applyPersonality(general, c, rank);

const ORDERS = [
  'Everyone fall back',
  'Move forward',
  'Focus the weakest enemy',
  'Rangers, focus their healer',
  'When their Assassin dives, protect my Ranger, then everyone focus him',
  'Focus the nearest enemy, then fall back',
  'Hold, then protect my rangers',
];

describe('the Captain', () => {
  it.each(ORDERS)('keeps "%s" exactly as written', (text) => {
    const reading = read('captain', card(text));
    expect(reading.card).toEqual(card(text));
    expect(reading.rules).toEqual([]);
    expect(reading.suggestion).toBeNull();
  });
});

describe('the Warlord', () => {
  it('adds a counter-attack after a Fall Back: Focus the nearest enemy, for 1 more pip', () => {
    const reading = read('warlord', card('Everyone fall back'));
    expect(reading.card.steps).toEqual([
      { action: 'fallBack', actors: { kind: 'all' }, to: null },
      { action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' }, byGeneral: true },
    ]);
    expect(reading.rules).toEqual(['counterAttack']);
    expect(cardCost(reading.card)).toBe(2);
  });

  it('has the same troops that fell back counter-attack', () => {
    const reading = read('warlord', card('Rangers, pull back to the vanguard'));
    expect(describeCard(reading.card)).toBe('Rangers fall back to your Vanguards, then Rangers focus the nearest enemy');
  });

  it('does it for cards built from the menus too', () => {
    const reading = read('warlord', built({ action: 'fallBack', actors: { kind: 'class', cls: 'guardian' }, to: null }));
    expect(reading.card.steps).toHaveLength(2);
    expect(reading.rules).toEqual(['counterAttack']);
  });

  it('keeps a plain retreat when you write "hold back"', () => {
    const reading = read('warlord', card('Fall back and hold back'));
    expect(reading.card).toEqual(card('Fall back and hold back'));
    expect(reading.rules).toEqual(['heldBack']);
  });

  it('adds nothing when the retreat already turns into a Focus', () => {
    const reading = read('warlord', card('Fall back, then focus the nearest enemy'));
    expect(reading.card).toEqual(card('Fall back, then focus the nearest enemy'));
    expect(reading.rules).toEqual([]);
  });

  it('leaves cards without a Fall Back alone', () => {
    expect(read('warlord', card('Move forward')).rules).toEqual([]);
  });
});

describe('the Engineer', () => {
  it('adds a Hold by the same troops before a Move, for 1 more pip', () => {
    const reading = read('engineer', card('Vanguards, advance'));
    expect(reading.card.steps).toEqual([
      { action: 'hold', actors: { kind: 'class', cls: 'vanguard' }, byGeneral: true },
      { action: 'move', actors: { kind: 'class', cls: 'vanguard' }, to: { kind: 'forward' } },
    ]);
    expect(reading.rules).toEqual(['holdBeforeMove']);
    expect(cardCost(reading.card)).toBe(2);
  });

  it('adds one before every Move', () => {
    const reading = read('engineer', card('Move forward, then rangers move back'));
    expect(reading.card.steps.map((s) => s.action)).toEqual(['hold', 'move', 'hold', 'move']);
  });

  it('adds nothing when those troops already hold before moving', () => {
    const steps: Step[] = [
      { action: 'hold', actors: { kind: 'class', cls: 'vanguard' } },
      { action: 'move', actors: { kind: 'class', cls: 'vanguard' }, to: { kind: 'forward' } },
    ];
    expect(read('engineer', built(...steps)).rules).toEqual([]);
  });

  it('leaves cards without a Move alone (Fall Back is not a Move)', () => {
    expect(read('engineer', card('Everyone fall back')).rules).toEqual([]);
  });
});

describe('the Hive Mother', () => {
  it('keeps at most 2 steps, dropping the last', () => {
    const long = card('Protect my rangers, then hold, then focus the nearest enemy');
    const reading = read('hiveMother', long);
    expect(reading.card.steps).toEqual(long.steps.slice(0, 2));
    expect(reading.rules).toEqual(['dropSteps']);
  });

  it('turns the weakest enemy into the nearest one', () => {
    const reading = read('hiveMother', card('Focus the weakest enemy'));
    expect(reading.card.steps[0]).toMatchObject({ target: { kind: 'nearest' } });
    expect(reading.rules).toEqual(['simplifyTargets']);
  });

  it('turns "him" into the nearest of his class', () => {
    const reading = read('hiveMother', card('When their Assassin dives, protect my Ranger, then everyone focus him'));
    expect(reading.card.steps[1]).toMatchObject({ action: 'focus', target: { kind: 'class', cls: 'assassin' } });
    const protect = read('hiveMother', card('When my Ranger drops below 50%, protect her'));
    expect(protect.card.steps[0]).toMatchObject({ action: 'protect', target: { kind: 'class', cls: 'ranger' } });
    const group = read('hiveMother', card('When 3 or more enemies are close together, focus them'));
    expect(group.card.steps[0]).toMatchObject({ target: { kind: 'nearest' } });
  });

  it('turns a named troop into the nearest one, and simplifies where a Move goes', () => {
    const named: Step = { action: 'focus', actors: { kind: 'all' }, target: { kind: 'named', name: 'Raven' } };
    expect(read('hiveMother', built(named)).card.steps[0]).toMatchObject({ target: { kind: 'nearest' } });
    const move: Step = { action: 'move', actors: { kind: 'all' }, to: { kind: 'ally', ally: { kind: 'weakest' } } };
    expect(read('hiveMother', built(move)).card.steps[0]).toMatchObject({ to: { kind: 'ally', ally: { kind: 'nearest' } } });
  });

  it('never drops a Legendary action: the steps before it go first', () => {
    const steps: Step[] = [
      { action: 'protect', actors: { kind: 'all' }, target: { kind: 'class', cls: 'ranger' } },
      { action: 'hold', actors: { kind: 'all' } },
      { action: 'echo' },
    ];
    const reading = applyPersonality('hiveMother', built(...steps), 5, { legendarySlot: true, learned: ['echo'] });
    expect(reading.card.steps.map((s) => s.action)).toEqual(['protect', 'echo']);
    // And Legendary targets are simplified like the others.
    const hijack: Step = { action: 'hijack', target: { kind: 'weakest' } };
    expect(read('hiveMother', built(hijack)).card.steps[0]).toEqual({ action: 'hijack', target: { kind: 'nearest' } });
  });

  it('can do both at once, and leaves simple 2-step cards alone', () => {
    const both = read('hiveMother', card('Focus the weakest enemy, then hold, then fall back'));
    expect(both.rules).toEqual(['dropSteps', 'simplifyTargets']);
    expect(read('hiveMother', card('Rangers, focus their healer')).rules).toEqual([]);
    expect(read('hiveMother', card('Hold, then protect my rangers')).rules).toEqual([]);
  });
});

describe('the Strategist', () => {
  it('suggests waiting for a diver to reach your backline before focusing it', () => {
    const plain = card('Everyone focus their Assassin');
    const reading = read('strategist', plain, 3);
    expect(reading.card).toEqual(plain);
    expect(reading.rules).toEqual(['suggestCondition']);
    expect(reading.suggestion).toEqual({ triggers: [{ kind: 'enemyReachesBackline', enemy: 'assassin' }], repeat: false });
  });

  it('suggests a fitting condition for every action, and accepting it makes a legal card', () => {
    const cases: [string, string][] = [
      ['Rangers, focus their healer', 'When any enemy reaches your backline'],
      ['Move forward', 'When 3 or more enemies are close together'],
      ['Everyone fall back', 'When any ally drops below 50% HP'],
      ['Protect my Ranger', 'When your Ranger drops below 50% HP'],
      ['Hold the line', 'When 3 or more enemies are close together'],
      ['Overcharge the Vanguard', 'When 3 or more enemies are close together'],
      ['Call in the reserves', 'When any ally drops below 50% HP'],
    ];
    for (const [text, when] of cases) {
      const reading = read('strategist', card(text), 5);
      expect(reading.suggestion, text).not.toBeNull();
      const accepted = { ...reading.card, condition: reading.suggestion };
      expect(describeCard(accepted).startsWith(when), text).toBe(true);
      expect(validateCard(accepted, 5).ok, text).toBe(true);
    }
  });

  it('suggests nothing at Rank I, where cards have no conditions', () => {
    const reading = read('strategist', card('Everyone focus their Assassin'), 1);
    expect(reading.suggestion).toBeNull();
    expect(reading.rules).toEqual([]);
  });

  it('suggests nothing for a card that already has a condition', () => {
    const reading = read('strategist', card('When my Ranger drops below 50%, protect her'));
    expect(reading.suggestion).toBeNull();
    expect(reading.rules).toEqual([]);
  });
});

describe('the Conductor', () => {
  it('reorders steps into a signature combo: Fall Back, then Focus is a Feigned Retreat', () => {
    const reading = read('conductor', card('Focus the nearest enemy, then fall back'));
    expect(reading.card.steps.map((s) => s.action)).toEqual(['fallBack', 'focus']);
    expect(reading.rules).toEqual(['reorderForCombo']);
  });

  it('makes an Iron Shell out of Hold and Protect', () => {
    const reading = read('conductor', card('Hold, then protect my rangers'));
    expect(reading.card.steps.map((s) => s.action)).toEqual(['protect', 'hold']);
  });

  it('makes a Hammer and Anvil only with Vanguards moving behind the enemy', () => {
    const reading = read('conductor', card('Overcharge the vanguards, then move vanguards behind enemy lines'));
    expect(reading.card.steps.map((s) => s.action)).toEqual(['move', 'overcharge']);
    expect(read('conductor', card('Overcharge the vanguards, then move forward')).rules).toEqual([]);
  });

  it('moves as little as it can in a 3-step card', () => {
    const original = card('Focus the nearest enemy, then hold, then fall back');
    const reading = read('conductor', original);
    expect(reading.card.steps.map((s) => s.action)).toEqual(['hold', 'fallBack', 'focus']);
    expect([...reading.card.steps].sort(byJson)).toEqual([...original.steps].sort(byJson));
  });

  it('approves a card that is already a combo, and leaves one that can never be', () => {
    const combo = read('conductor', card('Fall back, then focus the nearest enemy'));
    expect(combo.rules).toEqual(['alreadyCombo']);
    expect(combo.card).toEqual(card('Fall back, then focus the nearest enemy'));
    const none = read('conductor', card('Focus the nearest enemy, then move forward'));
    expect(none.rules).toEqual([]);
    expect(none.card).toEqual(card('Focus the nearest enemy, then move forward'));
  });
});

const byJson = (a: unknown, b: unknown) => JSON.stringify(a).localeCompare(JSON.stringify(b));

describe('every General', () => {
  it('never changes the card you passed in', () => {
    for (const general of GENERAL_IDS) {
      for (const text of ORDERS) {
        const original = card(text);
        const copy = structuredClone(original);
        read(general, original);
        expect(original).toEqual(copy);
      }
    }
  });

  it('adds steps that skip the step limit and may use any action, but still cost pips', () => {
    // Rank I: one step per card, and no Hold yet.
    const engineer = read('engineer', card('Move forward'), 1);
    expect(engineer.card.steps).toHaveLength(2);
    expect(validateCard(engineer.card, 1).ok).toBe(true);
    expect(validateCard(engineer.card, 1).cost).toBe(2);
    const warlord = read('warlord', card('Everyone fall back'), 1);
    expect(validateCard(warlord.card, 1)).toMatchObject({ ok: true, cost: 2 });
  });

  it('gives the same reading every time', () => {
    for (const general of GENERAL_IDS) {
      for (const text of ORDERS) expect(read(general, card(text))).toEqual(read(general, card(text)));
    }
  });
});

describe('General replies', () => {
  const RULES_OF: Record<GeneralId, PersonalityRule[]> = {
    captain: [],
    warlord: ['counterAttack', 'heldBack'],
    engineer: ['holdBeforeMove'],
    hiveMother: ['dropSteps', 'simplifyTargets'],
    strategist: ['suggestCondition'],
    conductor: ['reorderForCombo', 'alreadyCombo'],
  };

  it('has at least 3 lines for every rule of every General, and for cards kept as written', () => {
    for (const general of GENERAL_IDS) {
      const lines: Record<string, readonly string[]> = GENERAL_REPLIES[general];
      for (const rule of [...RULES_OF[general], 'asWritten']) {
        expect(lines[rule]?.length ?? 0, `${general} ${rule}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('answers with a line for the rule that applied', () => {
    const reading = read('warlord', card('Everyone fall back'));
    expect(GENERAL_REPLIES.warlord.counterAttack).toContain(generalReply(reading));
    expect(GENERAL_REPLIES.captain.asWritten).toContain(generalReply(read('captain', card('Everyone fall back'))));
  });

  it('keeps the same line for the same card, and varies between cards', () => {
    const reading = read('captain', card('Move forward'));
    expect(generalReply(reading)).toBe(generalReply(reading));
    const lines = new Set(ORDERS.map((text) => generalReply(read('captain', card(text)))));
    expect(lines.size).toBeGreaterThan(1);
  });
});
