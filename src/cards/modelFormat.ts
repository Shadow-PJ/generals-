// What the small model sees and must produce. Its output is forced into the card format: the
// JSON schema below becomes a grammar inside the model runtime, so the model can only write a
// card's JSON, never free text. The prompt shows the format with a few examples, all different
// from the test sentences in tools/dataset/natural.txt.

import { CARD_RULES } from '../data/cards';
import { TROOP_CLASSES } from '../data/units';
import type { ParseResult } from './parser';
import { readCard } from './schema';
import type { Card } from './types';

type Schema = Record<string, unknown>;

function object(properties: Record<string, Schema>): Schema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const constant = (value: string): Schema => ({ const: value });
const nothing: Schema = { type: 'null' };
const classes: Schema = { enum: [...TROOP_CLASSES] };

const actors: Schema = { anyOf: [object({ kind: constant('all') }), object({ kind: constant('class'), cls: classes })] };
const target: Schema = {
  anyOf: [
    object({ kind: constant('class'), cls: classes }),
    object({ kind: constant('nearest') }),
    object({ kind: constant('weakest') }),
    object({ kind: constant('trigger') }),
  ],
};
const place: Schema = {
  anyOf: [
    object({ kind: constant('forward') }),
    object({ kind: constant('back') }),
    object({ kind: constant('behindEnemies') }),
    object({ kind: constant('ally'), ally: target }),
  ],
};
const step: Schema = {
  anyOf: [
    object({ action: constant('focus'), actors, target }),
    object({ action: constant('move'), actors, to: place }),
    object({ action: constant('fallBack'), actors, to: { anyOf: [target, nothing] } }),
    object({ action: constant('overcharge'), actors }),
    object({ action: constant('protect'), actors, target }),
    object({ action: constant('hold'), actors }),
    object({ action: constant('callReserve'), reserve: { anyOf: [classes, nothing] } }),
  ],
};

const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);
const trigger: Schema = {
  anyOf: [
    object({ kind: constant('enemyReachesBackline'), enemy: { enum: [...TROOP_CLASSES, 'any'] } }),
    object({
      kind: constant('allyBelowHp'),
      ally: { enum: [...TROOP_CLASSES, 'any'] },
      hpPercent: { enum: range(CARD_RULES.hpPercentRange.min, CARD_RULES.hpPercentRange.max) },
    }),
    object({ kind: constant('enemiesGrouped'), count: { enum: range(CARD_RULES.groupedCountRange.min, CARD_RULES.groupedCountRange.max) } }),
    object({ kind: constant('enemyUltimateCharging') }),
  ],
};

/** The JSON a card is written as: its condition and steps. (Auto is chosen in the card builder, never by the model.) */
export const CARD_JSON_SCHEMA: Schema = object({
  condition: { anyOf: [nothing, object({ triggers: { type: 'array', items: trigger, minItems: 1, maxItems: CARD_RULES.maxTriggers }, repeat: { type: 'boolean' } })] },
  steps: { type: 'array', items: step, minItems: 1, maxItems: 3 },
});

/**
 * The schema as a GBNF grammar, the format llama.cpp constrains output with. The model can then
 * only write compact JSON for a card. Covers just what CARD_JSON_SCHEMA uses: objects with a
 * fixed key order, const, enum, anyOf, null, boolean, and arrays with a size range.
 */
export function schemaToGrammar(root: Schema): string {
  const rules: string[] = [];
  const names = new Map<string, string>();
  const literal = (value: unknown) => JSON.stringify(JSON.stringify(value));
  const named = (body: string): string => {
    let name = names.get(body);
    if (!name) {
      name = `r${names.size}`;
      names.set(body, name);
      rules.push(`${name} ::= ${body}`);
    }
    return name;
  };
  const visit = (s: Schema): string => {
    if ('const' in s) return literal(s.const);
    if ('enum' in s) return `(${(s.enum as unknown[]).map(literal).join(' | ')})`;
    if ('anyOf' in s) return named((s.anyOf as Schema[]).map(visit).join(' | '));
    if (s.type === 'null') return '"null"';
    if (s.type === 'boolean') return '("true" | "false")';
    if (s.type === 'array') {
      const item = named(visit(s.items as Schema));
      const min = (s.minItems as number | undefined) ?? 0;
      const max = (s.maxItems as number | undefined) ?? min;
      let more = '';
      for (let i = max - 1; i >= min && i > 0; i--) more = `("," ${item} ${more})?`;
      const required = Array.from({ length: Math.max(0, min - 1) }, () => `"," ${item}`).join(' ');
      return min === 0 ? `"[" (${item} ${more})? "]"` : `"[" ${item} ${required} ${more} "]"`;
    }
    if (s.type === 'object') {
      const properties = Object.entries(s.properties as Record<string, Schema>);
      const parts = properties.map(([key, value], i) => `${i > 0 ? '"," ' : ''}${literal(key)} ":" ${visit(value)}`);
      return named(`"{" ${parts.join(' ')} "}"`);
    }
    throw new Error(`Unsupported schema: ${JSON.stringify(s)}`);
  };
  const top = visit(root);
  return [`root ::= ${top}`, ...rules].join('\n');
}

/** The card format as a grammar for the model runtime. */
export const CARD_GRAMMAR = schemaToGrammar(CARD_JSON_SCHEMA);

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM = `You turn a player's order in a strategy game into a Command card, written as JSON. Be literal: never add, improve or fix anything.
Troop classes: vanguard (tank, frontline), ranger (archer, sniper), guardian (healer, medic, support), invoker (mage, caster), assassin (rogue).
Steps, in the order given: focus (attack a target), move (forward, back, behindEnemies = flank, or to an ally), fallBack (retreat, pull back; to an ally or null), overcharge (use the troops' skill: shove, mark, barrier, rift, shadowstep), protect (cover an ally), hold (stand ground), callReserve (bring in a reserve troop, or null for any).
actors is who does a step: all, or a class of the player's troops. A step with no subject is done by all.
Targets: a class, nearest, weakest, or trigger (the unit that set off the condition: him, her, it, them).
condition is null, or when something happens: enemyReachesBackline (an enemy dives), allyBelowHp (hurt or wounded = 50, in trouble = 40, low or weak = 30), enemiesGrouped (group up = 3), enemyUltimateCharging. repeat is true for "every time" or "whenever".`;

/** Worked examples for the prompt. None of these sentences is in the test data. */
export const PROMPT_EXAMPLES: readonly { text: string; card: Pick<Card, 'condition' | 'steps'> }[] = [
  { text: 'archers, take out their mage', card: { condition: null, steps: [{ action: 'focus', actors: { kind: 'class', cls: 'ranger' }, target: { kind: 'class', cls: 'invoker' } }] } },
  { text: 'everybody retreat to our tank', card: { condition: null, steps: [{ action: 'fallBack', actors: { kind: 'all' }, to: { kind: 'class', cls: 'vanguard' } }] } },
  {
    text: 'when the rogue jumps in, medics cover the snipers',
    card: {
      condition: { triggers: [{ kind: 'enemyReachesBackline', enemy: 'assassin' }], repeat: false },
      steps: [{ action: 'protect', actors: { kind: 'class', cls: 'guardian' }, target: { kind: 'class', cls: 'ranger' } }],
    },
  },
  {
    text: 'if one of ours goes under half, send in a reserve healer',
    card: { condition: { triggers: [{ kind: 'allyBelowHp', ally: 'any', hpPercent: 50 }], repeat: false }, steps: [{ action: 'callReserve', reserve: 'guardian' }] },
  },
  {
    text: 'whenever they clump, tanks shove then hit the closest one',
    card: {
      condition: { triggers: [{ kind: 'enemiesGrouped', count: 3 }], repeat: true },
      steps: [
        { action: 'overcharge', actors: { kind: 'class', cls: 'vanguard' } },
        { action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' } },
      ],
    },
  },
  { text: 'snipers, keep your position', card: { condition: null, steps: [{ action: 'hold', actors: { kind: 'class', cls: 'ranger' } }] } },
  {
    text: 'when my medic is low, shield her',
    card: {
      condition: { triggers: [{ kind: 'allyBelowHp', ally: 'guardian', hpPercent: 30 }], repeat: false },
      steps: [{ action: 'protect', actors: { kind: 'all' }, target: { kind: 'trigger' } }],
    },
  },
  {
    text: 'tanks sneak round their flank and then go up front again',
    card: {
      condition: null,
      steps: [
        { action: 'move', actors: { kind: 'class', cls: 'vanguard' }, to: { kind: 'behindEnemies' } },
        { action: 'move', actors: { kind: 'class', cls: 'vanguard' }, to: { kind: 'forward' } },
      ],
    },
  },
];

/** The chat the model reads: the format, the worked examples, then your order. */
export function promptFor(text: string): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM }];
  for (const example of PROMPT_EXAMPLES) {
    messages.push({ role: 'user', content: example.text }, { role: 'assistant', content: JSON.stringify(example.card) });
  }
  messages.push({ role: 'user', content: text.trim() });
  return messages;
}

/** The card in the model's output, with your words attached; anything that isn't a card is refused. */
export function cardFromModelOutput(output: string, text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(output);
  } catch {
    return { ok: false, error: "The model's answer wasn't a card." };
  }
  const card = readCard(typeof data === 'object' && data !== null ? { ...data, auto: false } : data);
  if (!card) return { ok: false, error: "The model's answer wasn't a card." };
  return { ok: true, card: { text: text.trim(), ...card } };
}
