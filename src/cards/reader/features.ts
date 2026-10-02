// What the order reader looks at. Each decision is made from a list of features: short strings
// such as "w=retreat" (the word is "retreat") or "V:w=flank" (a verb word in this step is
// "flank"). The trained weights say how much each feature counts for each answer.

import type { TriggerKind } from '../types';
import { roleOf, type Role, type Segment, type Tag } from './tags';
import { classesIn, hpPercentIn, numbersIn, wordGroup } from './words';

const START = '<s>';
const END = '</s>';

/** Features for tagging each word: the word, its neighbours, and where it sits in the order. */
export function wordFeatures(words: readonly string[]): string[][] {
  const groups = words.map(wordGroup);
  const w = (i: number) => (i < 0 ? START : i >= words.length ? END : words[i]!);
  const gr = (i: number) => (i < 0 ? START : i >= words.length ? END : groups[i]!);
  const condAt = words.map((_, i) => groups[i] === 'cond' || groups[i] === 'repeat');
  const breakAt = words.map((word, i) => word === ',' || groups[i] === 'sep');
  return words.map((word, i) => {
    const f = [
      'b',
      `w=${word}`,
      `w-1=${w(i - 1)}`,
      `w+1=${w(i + 1)}`,
      `w-2=${w(i - 2)}`,
      `w+2=${w(i + 2)}`,
      `w-1w=${w(i - 1)}|${word}`,
      `ww+1=${word}|${w(i + 1)}`,
      `g=${gr(i)}`,
      `g-1=${gr(i - 1)}`,
      `g+1=${gr(i + 1)}`,
      `g-2=${gr(i - 2)}`,
      `g+2=${gr(i + 2)}`,
      `g-1g=${gr(i - 1)}|${gr(i)}`,
      `gg+1=${gr(i)}|${gr(i + 1)}`,
      `g-1w=${gr(i - 1)}|${word}`,
      `wg+1=${word}|${gr(i + 1)}`,
    ];
    if (word.length >= 4) f.push(`s3=${word.slice(-3)}`, `p3=${word.slice(0, 3)}`);
    // Is this word inside a condition ("when ... ,") or before one ("fall back if ...")?
    let inCondition = false;
    for (let j = i - 1; j >= 0; j--) {
      if (breakAt[j]) break;
      if (condAt[j]) {
        inCondition = true;
        break;
      }
    }
    if (inCondition) f.push('inCond', `inCond,g=${gr(i)}`);
    if (condAt.some((isCond, j) => isCond && j > i)) f.push('condLater');
    if (condAt.some((isCond, j) => isCond && j < i)) f.push('condBefore');
    return f;
  });
}

/** The words of a segment that play a role. */
function wordsWith(words: readonly string[], tags: readonly Tag[], seg: Segment, role: Role): string[] {
  const out: string[] = [];
  for (let i = seg.start; i < seg.end; i++) if (roleOf(tags[i]!) === role) out.push(words[i]!);
  return out;
}

function bag(prefix: string, words: readonly string[]): string[] {
  const f: string[] = [];
  words.forEach((word, i) => {
    f.push(`${prefix}w=${word}`, `${prefix}g=${wordGroup(word)}`);
    if (i > 0) f.push(`${prefix}bg=${words[i - 1]}|${word}`);
  });
  return f;
}

/** Features for the kind of a trigger: "dives" or "drops below 50%", and who does it. */
export function triggerFeatures(words: readonly string[], tags: readonly Tag[], seg: Segment): string[] {
  const all = words.slice(seg.start, seg.end);
  const who = wordsWith(words, tags, seg, 'E');
  const what = wordsWith(words, tags, seg, 'T');
  const f = ['b', ...bag('', all), ...bag('E:', who), ...bag('T:', what), `first=${all[0]}`, `last=${all.at(-1)}`];
  if (numbersIn(all).length > 0) f.push('hasNumber');
  if (hpPercentIn(all) !== undefined) f.push('hasHp');
  if (classesIn(who).length > 0) f.push('whoClass');
  if (classesIn(what).length > 0) f.push('whatClass');
  if (who.length === 0) f.push('noWho');
  return f;
}

/** What the reader already knows about the card when it reads a step. */
export interface StepContext {
  /** The step before this one, if any. */
  previous: string | null;
  /** The kinds of trigger in the condition. */
  triggers: readonly TriggerKind[];
}

/** Features for the action of a step: mostly its verb words. */
export function stepFeatures(words: readonly string[], tags: readonly Tag[], seg: Segment, context: StepContext): string[] {
  const all = words.slice(seg.start, seg.end);
  const verb = wordsWith(words, tags, seg, 'V');
  const goal = wordsWith(words, tags, seg, 'G');
  const who = wordsWith(words, tags, seg, 'A');
  const other = wordsWith(words, tags, seg, 'X');
  const f = ['b', ...bag('', all), ...bag('V:', verb), ...bag('G:', goal), ...other.map((w) => `X:w=${w}`), ...who.map((w) => `A:g=${wordGroup(w)}`)];
  f.push(`prev=${context.previous ?? 'none'}`);
  for (const kind of context.triggers) f.push(`trig=${kind}`);
  if (verb.length === 0) f.push('noVerb', `noVerb,prev=${context.previous ?? 'none'}`);
  else f.push(`V1=${verb[0]}`, `Vlast=${verb.at(-1)}`);
  if (goal.length === 0) f.push('noGoal');
  if (who.length > 0) f.push('hasWho');
  if (classesIn(goal).length > 0) f.push('goalClass');
  return f;
}

/** Features for whom or where a step aims, given its action. */
export function goalFeatures(words: readonly string[], tags: readonly Tag[], seg: Segment, action: string, context: StepContext): string[] {
  const all = words.slice(seg.start, seg.end);
  const verb = wordsWith(words, tags, seg, 'V');
  const goal = wordsWith(words, tags, seg, 'G');
  const base = ['b', ...bag('G:', goal), ...verb.map((w) => `V:w=${w}`), ...all.map((w) => `w=${w}`)];
  if (goal.length === 0) base.push('noGoal');
  if (classesIn(goal).length > 0) base.push('goalClass');
  for (const kind of context.triggers) base.push(`trig=${kind}`);
  // Each feature also counts separately per action: "back" means something else after "move" than after "fall back".
  return [...base, ...base.map((feature) => `${action}:${feature}`)];
}
