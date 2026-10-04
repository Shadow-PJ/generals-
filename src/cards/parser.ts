// The rule parser: turns a simple English order into a card, literally. It never improves,
// adds to or "fixes" an order: a weak order makes a weak card. The validator runs after it.
//
// Grammar, roughly:
//   order     = [condition ","] step {separator step} [condition]
//   condition = ("when" | "if" | "every time" ...) trigger ["and" trigger]
//   step      = [who ","] verb [target] [place]

import { CARD_RULES, HURT_WORDS } from '../data/cards';
import type { TroopClass } from '../data/units';
import type { Actors, Card, Condition, Place, Step, Target, Trigger } from './types';
import * as V from './vocabulary';

export type ParseResult = { ok: true; card: Card } | { ok: false; error: string };

class ParseError extends Error {}

function fail(message: string): never {
  throw new ParseError(message);
}

/** Splits text into lowercase words, numbers, commas and percent signs. */
function splitWords(text: string): string[] {
  return text.toLowerCase().replace(/[‘’`]/g, "'").match(/\d+|[a-z']+|,|%/g) ?? [];
}

/** An order as words: punctuation becomes commas, filler words go. */
export function tokenize(text: string): string[] {
  const cleaned = text
    .replace(/\+/g, ' or more ')
    .replace(/right away/gi, ' ')
    .replace(/[.!?;:\-]/g, ',');
  const tokens = splitWords(cleaned).filter((t) => !V.FILLER_WORDS.has(t));
  // Collapse repeated commas and drop commas at either end.
  return tokens
    .filter((t, i) => !(t === ',' && (i === 0 || tokens[i - 1] === ',')))
    .filter((t, i, all) => !(t === ',' && i === all.length - 1));
}

/** A phrase table: phrases split into words, longest first so "fall back" beats "fall". */
class Phrases<T> {
  readonly entries: { words: string[]; value: T }[];
  constructor(table: Record<string, T> | readonly string[]) {
    const pairs: [string, T][] = Array.isArray(table)
      ? (table as readonly string[]).map((p) => [p, p as unknown as T])
      : Object.entries(table as Record<string, T>);
    this.entries = pairs
      .map(([phrase, value]) => ({ words: splitWords(phrase), value }))
      .filter((e) => e.words.length > 0)
      .sort((a, b) => b.words.length - a.words.length);
  }
}

const cache = new Map<object, Phrases<unknown>>();
function phrases<T>(table: Record<string, T> | readonly string[]): Phrases<T> {
  let p = cache.get(table);
  if (!p) cache.set(table, (p = new Phrases<T>(table)));
  return p as Phrases<T>;
}

class Cursor {
  pos = 0;
  /** Pronouns met so far, so "him" with no condition can be reported clearly. */
  readonly pronouns: string[] = [];
  constructor(readonly tokens: string[]) {}

  done(): boolean {
    return this.pos >= this.tokens.length;
  }

  rest(): string {
    return this.tokens.slice(this.pos).join(' ').replace(/ ,/g, ',');
  }

  /** If the words at the cursor spell a phrase from the table, consume them and return its value. */
  match(table: readonly string[]): string | undefined;
  match<T>(table: Record<string, T>): T | undefined;
  match<T>(table: Record<string, T> | readonly string[]): T | string | undefined {
    for (const { words, value } of phrases<T | string>(table).entries) {
      if (words.every((w, i) => this.tokens[this.pos + i] === w)) {
        this.pos += words.length;
        return value;
      }
    }
    return undefined;
  }

  accept(...words: string[]): boolean {
    return this.match(words) !== undefined;
  }

  number(): number | undefined {
    const t = this.tokens[this.pos];
    if (t === undefined) return undefined;
    if (/^\d+$/.test(t)) {
      this.pos++;
      return Number(t);
    }
    const n = V.NUMBER_WORDS[t];
    if (n !== undefined) this.pos++;
    return n;
  }

  /** Runs a sub-parser and rewinds if it finds nothing. */
  attempt<T>(parse: () => T | undefined): T | undefined {
    const start = this.pos;
    const result = parse();
    if (result === undefined) this.pos = start;
    return result;
  }
}

export function parseOrder(text: string): ParseResult {
  try {
    const card = parseCard(new Cursor(tokenize(text)));
    return { ok: true, card: { text: text.trim(), ...card } };
  } catch (error) {
    if (error instanceof ParseError) return { ok: false, error: error.message };
    throw error;
  }
}

function parseCard(c: Cursor): Card {
  if (c.done()) fail('Write an order first.');
  let condition = parseCondition(c);
  if (condition) c.match([',', 'then', ', then']);
  const steps = [parseStep(c)];
  while (!c.done()) {
    const before = c.pos;
    if (!condition) {
      c.accept(',');
      condition = parseCondition(c);
      if (condition) break;
      c.pos = before;
    }
    if (c.match(V.STEP_SEPARATORS) === undefined) break;
    if (c.done()) break;
    steps.push(parseStep(c));
  }
  if (!c.done()) fail(`I didn't understand "${c.rest()}".`);
  const card: Card = { condition, steps, auto: false };
  checkPronouns(card, c.pronouns[0] ?? 'them');
  return card;
}

// Conditions -----------------------------------------------------------------------------

function parseCondition(c: Cursor): Condition | null {
  const repeat = c.match(V.CONDITION_STARTS);
  if (repeat === undefined) return null;
  const first = parseTrigger(c) ?? fail(`I didn't understand the condition "${c.rest()}".`);
  const triggers: Trigger[] = [first];
  for (;;) {
    const before = c.pos;
    if (!c.match(['and', 'and also', 'and when', 'and if', 'while'])) break;
    const next = parseTrigger(c);
    if (!next) {
      c.pos = before;
      break;
    }
    triggers.push(next);
  }
  return { triggers, repeat };
}

function parseTrigger(c: Cursor): Trigger | undefined {
  return (
    c.attempt(() => parseUltimate(c)) ??
    c.attempt(() => parseGrouped(c)) ??
    c.attempt(() => parseAllyHp(c)) ??
    c.attempt(() => parseBackline(c))
  );
}

function parseUltimate(c: Cursor): Trigger | undefined {
  const charging: Trigger = { kind: 'enemyUltimateCharging' };
  const viaOwner = c.attempt(() =>
    c.match(V.ULTIMATE_OWNER) && c.match(V.ULTIMATE_WORDS) && c.match(V.ULTIMATE_STATES) ? charging : undefined,
  );
  if (viaOwner) return viaOwner;
  return c.match(V.ULTIMATE_CHARGERS) &&
    c.match(V.ULTIMATE_CHARGE_VERBS) &&
    c.match(V.ULTIMATE_PRONOUNS) &&
    c.match(V.ULTIMATE_WORDS)
    ? charging
    : undefined;
}

function parseGrouped(c: Cursor): Trigger | undefined {
  c.accept('at', 'least');
  const count = c.number();
  if (count !== undefined) c.match(['or more', 'or more of']);
  const noun = count !== undefined ? c.match(V.GROUP_NOUNS) : c.match(V.GROUP_SUBJECTS_ANY);
  if (noun === undefined) return undefined;
  c.match(V.GROUP_VERBS);
  if (c.match(V.GROUP_WORDS) === undefined) return undefined;
  return { kind: 'enemiesGrouped', count: count ?? CARD_RULES.groupedDefaultCount };
}

function parseAllyHp(c: Cursor): Trigger | undefined {
  c.match(V.ALLY_OWNER);
  const cls = c.match(V.CLASS_WORDS);
  const ally: TroopClass | 'any' | undefined = cls ?? (c.match(V.ALLY_ANY) !== undefined ? 'any' : undefined);
  if (ally === undefined) return undefined;
  if (c.match(V.HP_VERBS) === undefined) return undefined;
  const hpPercent = c.attempt(() => parseThreshold(c)) ?? c.match(HURT_WORDS);
  if (hpPercent === undefined) return undefined;
  return { kind: 'allyBelowHp', ally, hpPercent };
}

function parseThreshold(c: Cursor): number | undefined {
  if (c.match(V.HP_BELOW) === undefined) return undefined;
  const fraction = c.match(V.HP_FRACTIONS);
  const value = fraction ?? c.number();
  if (value === undefined) return undefined;
  c.match(['%', 'percent', 'per cent']);
  c.match(V.HP_UNITS);
  return value;
}

function parseBackline(c: Cursor): Trigger | undefined {
  let enemy: TroopClass | 'any' | undefined = c.attempt(() => {
    c.match(V.ENEMY_OWNER);
    return c.match(V.CLASS_WORDS);
  });
  if (enemy === undefined && c.match(V.BACKLINE_ANY) !== undefined) enemy = 'any';
  if (enemy === undefined) return undefined;
  if (c.match(V.DIVE_VERBS) !== undefined) {
    c.match(V.BACKLINE_PLACES);
    return { kind: 'enemyReachesBackline', enemy };
  }
  if (c.match(V.REACH_VERBS) !== undefined && c.match(V.BACKLINE_PLACES) !== undefined) {
    return { kind: 'enemyReachesBackline', enemy };
  }
  return undefined;
}

// Steps ----------------------------------------------------------------------------------

function parseStep(c: Cursor): Step {
  const start = c.pos;
  const actors = parseActors(c);
  if (actors) {
    c.accept(',');
    c.match(V.ACTOR_FILLERS);
    const step = parseVerbPhrase(c, actors);
    if (step) return step;
    c.pos = start;
  }
  return parseVerbPhrase(c, { kind: 'all' }) ?? fail(`I didn't understand "${c.rest()}".`);
}

function parseActors(c: Cursor): Actors | undefined {
  const cls = c.attempt(() => {
    c.match(['my', 'our', 'the', 'all', 'all my', 'all the', 'all of my', 'all of the']);
    return c.match(V.CLASS_WORDS);
  });
  if (cls) return { kind: 'class', cls };
  return c.match(V.ACTORS_ALL) !== undefined ? { kind: 'all' } : undefined;
}

function parseVerbPhrase(c: Cursor, actors: Actors): Step | undefined {
  return (
    c.attempt(() => parseLegendary(c, actors)) ??
    c.attempt(() => parseCallReserve(c)) ??
    c.attempt(() => parseFallBack(c, actors)) ??
    c.attempt(() => parseFocus(c, actors)) ??
    c.attempt(() => parseProtect(c, actors)) ??
    c.attempt(() => parseOvercharge(c, actors)) ??
    c.attempt(() => parseHold(c, actors)) ??
    c.attempt(() => parseMove(c, actors))
  );
}

function parseFocus(c: Cursor, actors: Actors): Step | undefined {
  const verb = c.match(V.FOCUS_VERBS);
  if (verb === undefined) return undefined;
  const target = parseEnemyTarget(c) ?? (V.FOCUS_ALONE.includes(verb) ? ({ kind: 'nearest' } as const) : undefined);
  if (!target) fail(`${capitalize(verb)} whom?`);
  return { action: 'focus', actors, target };
}

function parseEnemyTarget(c: Cursor): Target | undefined {
  const pronoun = c.match(V.ENEMY_PRONOUNS);
  if (pronoun !== undefined) {
    c.pronouns.push(pronoun);
    return { kind: 'trigger' };
  }
  if (c.match(V.ENEMY_WEAKEST) !== undefined) return { kind: 'weakest' };
  const cls = c.attempt(() => {
    c.match(V.ENEMY_OWNER);
    return c.match(V.CLASS_WORDS);
  });
  if (cls) return { kind: 'class', cls };
  if (c.match(V.ENEMY_NEAREST) !== undefined) return { kind: 'nearest' };
  return undefined;
}

function parseAllyTarget(c: Cursor): Target | undefined {
  const pronoun = c.match(V.ALLY_PRONOUNS);
  if (pronoun !== undefined) {
    c.pronouns.push(pronoun);
    return { kind: 'trigger' };
  }
  if (c.match(V.ALLY_WEAKEST) !== undefined) return { kind: 'weakest' };
  if (c.match(V.ALLY_NEAREST) !== undefined) return { kind: 'nearest' };
  const cls = c.attempt(() => {
    c.match(V.ALLY_OWNER);
    return c.match(V.CLASS_WORDS);
  });
  return cls ? { kind: 'class', cls } : undefined;
}

function parseProtect(c: Cursor, actors: Actors): Step | undefined {
  // "keep my Rangers alive"
  const kept = c.attempt(() => {
    if (!c.accept('keep')) return undefined;
    const target = parseAllyTarget(c);
    return target && c.match(V.KEEP_STATES) !== undefined ? target : undefined;
  });
  if (kept) return { action: 'protect', actors, target: kept };
  const verb = c.match(V.PROTECT_VERBS);
  if (verb === undefined) return undefined;
  const target = parseAllyTarget(c) ?? fail(`${capitalize(verb)} whom?`);
  return { action: 'protect', actors, target };
}

function parseFallBack(c: Cursor, actors: Actors): Step | undefined {
  if (c.match(V.FALLBACK_VERBS) === undefined) return undefined;
  const to = c.attempt(() => (c.match(V.FALLBACK_TOWARD) !== undefined ? parseAllyTarget(c) : undefined)) ?? null;
  return { action: 'fallBack', actors, to };
}

function parseMove(c: Cursor, actors: Actors): Step | undefined {
  const verb = c.match(V.MOVE_VERBS);
  if (verb === undefined) return undefined;
  // "Move a Vanguard behind enemies": who moves can come after the verb.
  const object = c.attempt(() => {
    c.match(['a', 'the', 'my', 'our', 'your', 'all', 'all the', 'all my']);
    return c.match(V.CLASS_WORDS);
  });
  if (object && actors.kind !== 'all') fail('Name either who moves or whom, not both.');
  const movers: Actors = object ? { kind: 'class', cls: object } : actors;
  const to = parsePlace(c) ?? impliedPlace(verb) ?? fail(`${capitalize(verb)} where?`);
  if (verb === 'flank') c.match(['them', 'the enemy', 'the enemies']);
  return { action: 'move', actors: movers, to };
}

function impliedPlace(verb: string): Place | undefined {
  const implied = V.MOVE_IMPLIED[verb];
  return implied ? { kind: implied } : undefined;
}

function parsePlace(c: Cursor): Place | undefined {
  if (c.match(V.MOVE_BEHIND) !== undefined) return { kind: 'behindEnemies' };
  if (c.match(V.MOVE_FORWARD) !== undefined) return { kind: 'forward' };
  if (c.match(V.MOVE_BACK) !== undefined) return { kind: 'back' };
  return c.attempt(() => {
    if (c.match(V.MOVE_TOWARD) === undefined) return undefined;
    const ally = parseAllyTarget(c);
    return ally ? { kind: 'ally', ally } : undefined;
  });
}

function parseHold(c: Cursor, actors: Actors): Step | undefined {
  if (c.match(V.HOLD_VERBS) === undefined) return undefined;
  c.match(V.HOLD_EXTRAS);
  return { action: 'hold', actors };
}

function parseOvercharge(c: Cursor, actors: Actors): Step | undefined {
  const skillOwner = c.match(V.SKILL_VERBS);
  if (skillOwner !== undefined) {
    c.match(V.SKILL_OBJECTS);
    return { action: 'overcharge', actors: actors.kind === 'all' ? { kind: 'class', cls: skillOwner } : actors };
  }
  if (c.match(V.OVERCHARGE_VERBS) === undefined) return undefined;
  // "Overcharge the Vanguard": the object says whose skill fires.
  const object = c.attempt(() => {
    c.match(['the', 'my', 'our', 'your', 'all']);
    return c.match(V.CLASS_WORDS);
  });
  if (object && actors.kind !== 'all') fail('Name either who overcharges or whom, not both.');
  return { action: 'overcharge', actors: object ? { kind: 'class', cls: object } : actors };
}

function parseCallReserve(c: Cursor): Step | undefined {
  if (c.match(V.RESERVE_ALONE) !== undefined) return { action: 'callReserve', reserve: null };
  if (c.match(V.RESERVE_VERBS) === undefined) return undefined;
  if (c.match(V.RESERVE_WORDS) !== undefined) {
    // "the reserve Vanguard", or just "the reserves".
    const cls = c.match(V.CLASS_WORDS);
    return { action: 'callReserve', reserve: cls ?? null };
  }
  // "call in a Vanguard from the reserves"
  return c.attempt(() => {
    c.match(['a', 'the', 'my', 'our', 'another']);
    const cls = c.match(V.CLASS_WORDS);
    if (!cls) return undefined;
    c.match(V.RESERVE_FROM);
    return { action: 'callReserve', reserve: cls } as const;
  });
}

// Legendary actions ----------------------------------------------------------------------

function parseLegendary(c: Cursor, actors: Actors): Step | undefined {
  return (
    c.attempt(() => parseHijack(c, actors)) ??
    c.attempt(() => parseSwap(c, actors)) ??
    c.attempt(() => parseBloodPact(c, actors)) ??
    c.attempt(() => parseFortify(c, actors)) ??
    c.attempt(() => parseEcho(c, actors))
  );
}

/** Hijack, Blood Pact, Fortify and Echo are the commander's own: no troops carry them out. */
function noActors(actors: Actors, name: string): void {
  if (actors.kind !== 'all') fail(`${name} is yours to do: don't name troops for it.`);
}

function parseHijack(c: Cursor, actors: Actors): Step | undefined {
  const verb = c.match(V.HIJACK_VERBS);
  if (verb === undefined) return undefined;
  noActors(actors, 'Hijack');
  const target = parseEnemyTarget(c) ?? fail(`${capitalize(verb)} whom?`);
  return { action: 'hijack', target };
}

function parseSwap(c: Cursor, actors: Actors): Step | undefined {
  const verb = c.match(V.SWAP_VERBS);
  if (verb === undefined) return undefined;
  // "swap my Vanguard with my Ranger": who moves can come after the verb.
  const object = c.attempt(() => {
    c.match(['a', 'the', 'my', 'our', 'your']);
    return c.match(V.CLASS_WORDS);
  });
  if (object && actors.kind !== 'all') fail('Name either who swaps or with whom, not both.');
  const movers: Actors = object ? { kind: 'class', cls: object } : actors;
  const target =
    c.attempt(() => (c.match(V.SWAP_WITH) !== undefined ? parseAllyTarget(c) : undefined)) ??
    c.attempt(() => parseSwapSpot(c)) ??
    fail(`${capitalize(verb)} with whom?`);
  return { action: 'swap', actors: movers, target };
}

/** "into my Ranger's spot" */
function parseSwapSpot(c: Cursor): Target | undefined {
  if (c.match(V.SWAP_INTO) === undefined) return undefined;
  c.match(V.ALLY_OWNER);
  const word = c.tokens[c.pos];
  if (!word?.endsWith("'s")) return undefined;
  const cls = V.CLASS_WORDS[word.slice(0, -2)];
  if (!cls) return undefined;
  c.pos++;
  return c.match(V.SWAP_SPOTS) !== undefined ? { kind: 'class', cls } : undefined;
}

function parseBloodPact(c: Cursor, actors: Actors): Step | undefined {
  const verb = c.match(V.BLOOD_PACT_VERBS);
  if (verb === undefined) return undefined;
  noActors(actors, 'Blood Pact');
  const target = parseAllyTarget(c) ?? fail(`${capitalize(verb)} whom?`);
  return { action: 'bloodPact', target };
}

function parseFortify(c: Cursor, actors: Actors): Step | undefined {
  if (c.match(V.FORTIFY_VERBS) === undefined) return undefined;
  noActors(actors, 'Fortify');
  return { action: 'fortify', at: parseWallPlace(c) ?? { kind: 'forward' } };
}

function parseWallPlace(c: Cursor): Place | undefined {
  if (c.match(V.MOVE_BEHIND) !== undefined) return { kind: 'behindEnemies' };
  const atAlly = c.attempt(() => {
    if (c.match(V.WALL_AT) === undefined) return undefined;
    const ally = parseAllyTarget(c);
    return ally ? ({ kind: 'ally', ally } as const) : undefined;
  });
  if (atAlly) return atAlly;
  if (c.match(V.WALL_FORWARD) !== undefined) return { kind: 'forward' };
  if (c.match(V.WALL_BACK) !== undefined) return { kind: 'back' };
  return undefined;
}

function parseEcho(c: Cursor, actors: Actors): Step | undefined {
  if (c.match(V.ECHO_VERBS) === undefined) return undefined;
  noActors(actors, 'Echo');
  c.match(V.ECHO_OBJECTS);
  return { action: 'echo' };
}

// Checks ---------------------------------------------------------------------------------

/** "him" and "her" must point at a unit named by the condition, on the right side. */
function checkPronouns(card: Card, word: string): void {
  if (!pronounsFit(card)) fail(`Who is "${word}"? Start the order with a condition that names them.`);
}

/** Whether every step aimed at "him" or "her" has a condition naming such a unit: an enemy for Focus, an ally otherwise. */
export function pronounsFit(card: Card): boolean {
  const triggers = card.condition?.triggers ?? [];
  const hasEnemy = triggers.some((t) => t.kind === 'enemyReachesBackline' || t.kind === 'enemiesGrouped');
  const hasAlly = triggers.some((t) => t.kind === 'allyBelowHp');
  return card.steps.every((step) => {
    const enemyRef = (step.action === 'focus' || step.action === 'hijack') && step.target.kind === 'trigger';
    const allyRef =
      ((step.action === 'protect' || step.action === 'swap' || step.action === 'bloodPact') && step.target.kind === 'trigger') ||
      (step.action === 'fallBack' && step.to?.kind === 'trigger') ||
      (step.action === 'move' && step.to.kind === 'ally' && step.to.ally.kind === 'trigger') ||
      (step.action === 'fortify' && step.at.kind === 'ally' && step.at.ally.kind === 'trigger');
    return !(enemyRef && !hasEnemy) && !(allyRef && !hasAlly);
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
