// The order reader's trained weights, and the two ways it uses them: scoring a list of
// features for each answer (a linear model), and tagging every word of an order at once
// (Viterbi search over the tags, which also says how sure it is of each word).
// Weights are whole numbers, so every computer adds them up to exactly the same scores.

import { canFollow, TAGS, type Tag } from './tags';

/** A linear model: each feature adds its weight to some answers; the highest total wins. */
export interface LinearWeights {
  labels: string[];
  /** Feature → [label index, weight, label index, weight, ...]. Missing features add nothing. */
  weights: Record<string, number[]>;
}

export interface ReaderModel {
  version: 1;
  /** Words the reader knows, most common first. Unknown words are read as the closest of these. */
  words: string[];
  tagger: LinearWeights & {
    /** transitions[from][to]: from 0 is the start of the order, then 1 + the tag's index. */
    transitions: number[][];
  };
  trigger: LinearWeights;
  action: LinearWeights;
  goal: LinearWeights;
  /**
   * How far ahead the best answer must be of the next best, per decision, for the reader to
   * trust it. Below that the reader says it didn't catch the order rather than guess.
   */
  sureMargins: { tagger: number; trigger: number; action: number; goal: number };
}

/** Each label's total score for these features. */
export function scoreLabels(model: LinearWeights, features: readonly string[]): number[] {
  const scores = new Array<number>(model.labels.length).fill(0);
  for (const feature of features) {
    const pairs = model.weights[feature];
    if (!pairs) continue;
    for (let k = 0; k < pairs.length; k += 2) scores[pairs[k]!]! += pairs[k + 1]!;
  }
  return scores;
}

/** The best label among the allowed ones, and how far ahead it is of the next best. */
export function bestLabel(model: LinearWeights, features: readonly string[], allowed?: readonly string[]): { label: string; margin: number } {
  const scores = scoreLabels(model, features);
  let best = -1;
  let second = -1;
  model.labels.forEach((label, i) => {
    if (allowed && !allowed.includes(label)) return;
    if (best < 0 || scores[i]! > scores[best]!) {
      second = best;
      best = i;
    } else if (second < 0 || scores[i]! > scores[second]!) {
      second = i;
    }
  });
  if (best < 0) throw new Error('No label is allowed');
  return { label: model.labels[best]!, margin: second < 0 ? Infinity : scores[best]! - scores[second]! };
}

/**
 * The best tag sequence for an order, and for each word how much worse the best sequence that
 * tags it differently is (its margin: small means the reader wasn't sure about that word).
 */
export function bestTags(
  tagger: ReaderModel['tagger'],
  features: readonly (readonly string[])[],
): { tags: Tag[]; margins: number[] } {
  const order = TAGS.map((tag) => tagger.labels.indexOf(tag));
  const emit = features.map((f) => {
    const scores = scoreLabels(tagger, f);
    return order.map((i) => scores[i] ?? 0);
  });
  const { path, margins } = viterbi(emit, tagger.transitions);
  return { tags: path.map((t) => TAGS[t]!), margins };
}

/**
 * Viterbi search: `emit[i][t]` is how much word i likes tag t (tags in TAGS order), and
 * `transitions[from + 1][to]` how much tag `to` likes following `from` (row 0: the start).
 * Tags that can't follow each other (see canFollow) are never chosen.
 */
export function viterbi(
  emit: readonly ArrayLike<number>[],
  transitions: readonly ArrayLike<number>[],
): { path: number[]; margins: number[] } {
  const n = emit.length;
  const k = TAGS.length;
  if (n === 0) return { path: [], margins: [] };
  const trans = (from: number, to: number) => (ALLOWED[from + 1]![to] ? transitions[from + 1]![to]! : -Infinity);

  // Best score of any tags up to word i that end in tag t; and from there to the end.
  const forward: number[][] = [];
  const back: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    const from: number[] = [];
    for (let t = 0; t < k; t++) {
      let best = -Infinity;
      let arg = -1;
      if (i === 0) best = trans(-1, t);
      else {
        for (let p = 0; p < k; p++) {
          const s = forward[i - 1]![p]! + trans(p, t);
          if (s > best) {
            best = s;
            arg = p;
          }
        }
      }
      row.push(best + emit[i]![t]!);
      from.push(arg);
    }
    forward.push(row);
    back.push(from);
  }
  const backward: number[][] = Array.from({ length: n }, () => new Array<number>(k).fill(0));
  for (let i = n - 2; i >= 0; i--) {
    for (let t = 0; t < k; t++) {
      let best = -Infinity;
      for (let q = 0; q < k; q++) best = Math.max(best, trans(t, q) + emit[i + 1]![q]! + backward[i + 1]![q]!);
      backward[i]![t] = best;
    }
  }

  let last = 0;
  for (let t = 1; t < k; t++) if (forward[n - 1]![t]! > forward[n - 1]![last]!) last = t;
  const path = [last];
  for (let i = n - 1; i > 0; i--) path.unshift(back[i]![path[0]!]!);
  const total = forward[n - 1]![last]!;
  const margins = path.map((chosen, i) => {
    let other = -Infinity;
    for (let t = 0; t < k; t++) if (t !== chosen) other = Math.max(other, forward[i]![t]! + backward[i]![t]!);
    return total - other;
  });
  return { path, margins };
}

/** ALLOWED[from + 1][to]: whether tag `to` may follow tag `from` (row 0: the start). */
const ALLOWED: boolean[][] = [null, ...TAGS].map((from) => TAGS.map((to) => canFollow(from, to)));
