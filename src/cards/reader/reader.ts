// The order reader: a small trained model that reads free-form orders into cards (session 3C).
//
//   1. Split the order into words and fix typos against the words it knows.
//   2. Tag every word with its part of the card (see tags.ts): condition word, trigger, step,
//      and its role there: who acts, what they do, whom or where.
//   3. Decide the kind of each trigger, the action of each step, and what each step aims at.
//   4. Read the values from the words themselves: troop classes, numbers, "hurt" = 50% HP.
//
// It assembles the card literally from those parts and adds nothing: a part it can't find is
// "I didn't catch that", never a guess. When any decision is too close to call, it refuses too.
// The validator runs after it, as after every translator.

import { CARD_RULES } from '../../data/cards';
import type { TroopClass } from '../../data/units';
import { pronounsFit, type ParseResult } from '../parser';
import type { ActionName, Actors, Card, Step, Target, Trigger, TriggerKind } from '../types';
import { goalFeatures, stepFeatures, triggerFeatures, wordFeatures, type StepContext } from './features';
import { bestLabel, bestTags, type ReaderModel } from './model';
import { roleOf, segmentsOf, type Role, type Segment, type Tag } from './tags';
import { classesIn, hpPercentIn, KnownWords, normalizeWords, numbersIn, SKILL_OF, splitOrder } from './words';

/** What a step aims at: whom, or where to. */
export const GOALS = ['none', 'class', 'nearest', 'weakest', 'trigger', 'forward', 'back', 'behind'] as const;
export type Goal = (typeof GOALS)[number];

const TARGET_GOALS: readonly Goal[] = ['class', 'nearest', 'weakest', 'trigger'];
/** The goals each action can have; null for actions that aim at nothing. */
export const GOALS_FOR: Readonly<Record<ActionName, readonly Goal[] | null>> = {
  focus: TARGET_GOALS,
  protect: TARGET_GOALS,
  move: ['forward', 'back', 'behind', ...TARGET_GOALS],
  fallBack: ['none', ...TARGET_GOALS],
  overcharge: null,
  hold: null,
  callReserve: null,
};

/** A step's goal, as the reader names it; null when it has none the reader can read. */
export function goalOf(step: Step): Goal | null {
  // Named troops (legendary units, later) are picked in the card builder, never read from words.
  const aim = (target: Target): Goal | null => (target.kind === 'named' ? null : target.kind);
  switch (step.action) {
    case 'focus':
    case 'protect':
      return aim(step.target);
    case 'move':
      return step.to.kind === 'ally' ? aim(step.to.ally) : step.to.kind === 'behindEnemies' ? 'behind' : step.to.kind;
    case 'fallBack':
      return step.to ? aim(step.to) : 'none';
    default:
      return null;
  }
}

/** A reading: the card or why not, and how sure the reader was (1 or more = sure enough). */
export type Reading = ParseResult & {
  /** The weakest decision's margin as a share of the margin needed: below 1, the reader refuses. */
  sureness: number;
  /** The smallest margin of each kind of decision (Infinity when there was none). */
  margins: Record<SurePart, number>;
  words: string[];
  tags: Tag[];
};

type SurePart = keyof ReaderModel['sureMargins'];

export const NOT_CAUGHT = "I didn't catch that order.";

class Unsure extends Error {}

export class OrderReader {
  private readonly known: KnownWords;

  constructor(private readonly model: ReaderModel) {
    this.known = new KnownWords(model.words);
  }

  read(text: string): Reading {
    const words = normalizeWords(splitOrder(text), this.known);
    const none = { tagger: Infinity, trigger: Infinity, action: Infinity, goal: Infinity };
    if (words.length === 0) return { ok: false, error: 'Write an order first.', sureness: 0, margins: none, words, tags: [] };
    const { tags, margins } = bestTags(this.model.tagger, wordFeatures(words));
    const reading = new ReadingState(this.model, this.known, words, tags);
    margins.forEach((m, i) => reading.sure('tagger', m, `the word "${words[i]}"`));
    try {
      const card = reading.card();
      if (reading.sureness < 1) throw new Unsure(`${NOT_CAUGHT} I wasn't sure about ${reading.leastSure}.`);
      return { ok: true, card: { text: text.trim(), ...card }, sureness: reading.sureness, margins: reading.margins, words, tags };
    } catch (error) {
      if (!(error instanceof Unsure)) throw error;
      return { ok: false, error: error.message, sureness: reading.sureness, margins: reading.margins, words, tags };
    }
  }
}

/** One order being read: its words and tags, and how sure the reader has been so far. */
class ReadingState {
  sureness = Infinity;
  leastSure = '';
  readonly margins: Record<SurePart, number> = { tagger: Infinity, trigger: Infinity, action: Infinity, goal: Infinity };

  constructor(
    private readonly model: ReaderModel,
    private readonly known: KnownWords,
    private readonly words: readonly string[],
    private readonly tags: readonly Tag[],
  ) {}

  sure(part: SurePart, margin: number, what: string): void {
    this.margins[part] = Math.min(this.margins[part], margin);
    const share = margin / Math.max(1, this.model.sureMargins[part]);
    if (share < this.sureness) {
      this.sureness = share;
      this.leastSure = what;
    }
  }

  card(): Omit<Card, 'text'> {
    const segments = segmentsOf(this.tags);
    const conditionWords = this.words.filter((_, i) => this.tags[i] === 'C');
    const triggerSegments = segments.filter((s) => s.kind === 'trigger');
    const stepSegments = segments.filter((s) => s.kind === 'step');
    if (stepSegments.length === 0) throw new Unsure(`${NOT_CAUGHT} I couldn't find what to do.`);
    if (triggerSegments.length > CARD_RULES.maxTriggers) throw new Unsure(`${NOT_CAUGHT} I found too many conditions.`);
    if ((conditionWords.length > 0) !== (triggerSegments.length > 0)) throw new Unsure(`${NOT_CAUGHT} I couldn't tell the condition apart.`);

    // Words saying who acts, what they do, or who sets off a trigger must be ones the reader
    // knows: reading around an unknown one there is a guess (half the time a wrong one, on the
    // training orders), so it asks instead.
    const unknown = this.words.find((w, i) => ['A', 'V', 'E'].includes(roleOf(this.tags[i]!)) && !this.known.has(w));
    if (unknown !== undefined) throw new Unsure(`${NOT_CAUGHT} I don't know the word "${unknown}".`);

    const triggers = triggerSegments.map((seg) => this.trigger(seg));
    const stepParts = this.addressed(stepSegments);
    const repeat = conditionWords.some((w) => w === 'whenever' || w === 'every' || w === 'each' || w === 'anytime' || w === 'time');
    const context: StepContext = { previous: null, triggers: triggers.map((t) => t.kind) };
    const steps: Step[] = [];
    for (const { seg, who } of stepParts) {
      const step = this.step(seg, who, context);
      steps.push(step);
      context.previous = step.action;
    }
    const card: Omit<Card, 'text'> = { condition: triggers.length ? { triggers, repeat } : null, steps, auto: false };
    if (!pronounsFit(card)) throw new Unsure(`${NOT_CAUGHT} Who is "him" or "them"? Start the order with a condition that names them.`);
    return card;
  }

  /**
   * "use your skills, all of you": a step that only says who ("all of you") goes with the step
   * before it, or the one after it, when that one doesn't say who itself.
   */
  private addressed(segments: readonly Segment[]): { seg: Segment; who: string[] }[] {
    const parts = segments.map((seg) => ({ seg, who: this.segmentWords(seg, 'A') }));
    const onlyWho = (seg: Segment) => this.segmentWords(seg).every((w, i) => ['A', 'X'].includes(roleOf(this.tags[seg.start + i]!)) || w === ',');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (parts.length < 2 || !onlyWho(part.seg) || part.who.length === 0) continue;
      const host = [parts[i - 1], parts[i + 1]].find((p) => p && p.who.length === 0 && !onlyWho(p.seg));
      if (!host) continue;
      host.who = part.who;
      parts.splice(i, 1);
      i--;
    }
    return parts;
  }

  private segmentWords(seg: Segment, role?: Role): string[] {
    const out: string[] = [];
    for (let i = seg.start; i < seg.end; i++) if (!role || roleOf(this.tags[i]!) === role) out.push(this.words[i]!);
    return out;
  }

  private quote(seg: Segment): string {
    return `"${this.segmentWords(seg).join(' ').replace(/ ,/g, ',')}"`;
  }

  /** The one troop class these words name; null for none. Two different ones are too many. */
  private oneClass(words: readonly string[], seg: Segment): TroopClass | null {
    const classes = [...new Set(classesIn(words))];
    if (classes.length > 1) throw new Unsure(`${NOT_CAUGHT} ${this.quote(seg)} names more than one kind of troop.`);
    return classes[0] ?? null;
  }

  private trigger(seg: Segment): Trigger {
    const { label, margin } = bestLabel(this.model.trigger, triggerFeatures(this.words, this.tags, seg));
    this.sure('trigger', margin, `the condition ${this.quote(seg)}`);
    const kind = label as TriggerKind;
    const all = this.segmentWords(seg);
    const who = this.segmentWords(seg, 'E');
    switch (kind) {
      case 'enemyReachesBackline':
        return { kind, enemy: this.oneClass(who, seg) ?? 'any' };
      case 'allyBelowHp': {
        // "one of my troops drops below 50%": the amount is in what happens, not in who.
        const hpPercent = hpPercentIn(this.segmentWords(seg, 'T')) ?? hpPercentIn(all);
        if (hpPercent === undefined) throw new Unsure(`${NOT_CAUGHT} How low is "low" in ${this.quote(seg)}?`);
        // The only troop an HP condition names is the one whose HP it watches.
        return { kind, ally: this.oneClass(who, seg) ?? this.oneClass(all, seg) ?? 'any', hpPercent };
      }
      case 'enemiesGrouped':
        return { kind, count: numbersIn(who)[0] ?? numbersIn(all)[0] ?? CARD_RULES.groupedDefaultCount };
      case 'enemyUltimateCharging':
        return { kind };
    }
  }

  private step(seg: Segment, whoWords: readonly string[], context: StepContext): Step {
    const { label, margin } = bestLabel(this.model.action, stepFeatures(this.words, this.tags, seg, context));
    this.sure('action', margin, `what to do in ${this.quote(seg)}`);
    const action = label as ActionName;
    const goal = this.goal(seg, action, context);
    const aims = this.segmentWords(seg, 'G');
    const cls = this.oneClass(whoWords, seg);
    const actors: Actors = cls ? { kind: 'class', cls } : { kind: 'all' };
    switch (action) {
      case 'focus':
      case 'protect':
        return { action, actors, target: this.target(goal!, aims, seg) };
      case 'move':
        return {
          action,
          actors,
          to: goal === 'forward' || goal === 'back' ? { kind: goal } : goal === 'behind' ? { kind: 'behindEnemies' } : { kind: 'ally', ally: this.target(goal!, aims, seg) },
        };
      case 'fallBack':
        return { action, actors, to: goal === 'none' ? null : this.target(goal!, aims, seg) };
      case 'hold':
        return { action, actors };
      case 'overcharge': {
        if (cls) return { action, actors };
        // "use shove", "overcharge the rangers": the skill's name or the troop named says whose.
        const skill = this.segmentWords(seg).map((w) => SKILL_OF[w]).find((c) => c !== undefined);
        const named = skill ?? this.oneClass(aims, seg);
        return { action, actors: named ? { kind: 'class', cls: named } : actors };
      }
      case 'callReserve':
        return { action, reserve: this.oneClass(aims, seg) };
    }
  }

  private goal(seg: Segment, action: ActionName, context: StepContext): Goal | null {
    const allowed = GOALS_FOR[action];
    if (!allowed) return null;
    const { label, margin } = bestLabel(this.model.goal, goalFeatures(this.words, this.tags, seg, action, context), allowed);
    this.sure('goal', margin, `whom or where in ${this.quote(seg)}`);
    return label as Goal;
  }

  private target(goal: Goal, aims: readonly string[], seg: Segment): Target {
    switch (goal) {
      case 'nearest':
      case 'weakest':
      case 'trigger':
        return { kind: goal };
      default: {
        const cls = this.oneClass(aims, seg);
        if (!cls) throw new Unsure(`${NOT_CAUGHT} Which troops in ${this.quote(seg)}?`);
        return { kind: 'class', cls };
      }
    }
  }
}
