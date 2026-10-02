// Scores translations against the dataset and writes the report: accuracy, speed, and every
// failure with what was expected and what came out. Used for the parser and for the model.

import { describeCard } from '../../src/cards/describe';
import type { ParseResult } from '../../src/cards/parser';
import { cardKey, type Example } from '../dataset/natural';

export interface Outcome {
  example: Example;
  result: ParseResult;
  /** Time to translate this sentence, in milliseconds. */
  ms: number;
  /** Who produced the card when translators are chained. */
  by?: string;
}

export interface Score {
  total: number;
  correct: number;
  accuracy: number;
  failures: Outcome[];
  /** Failures that produced a card, but the wrong one: worse than no card, since nothing catches them. */
  wrong: number;
  medianMs: number;
  p90Ms: number;
}

export function isCorrect(outcome: Outcome): boolean {
  return outcome.result.ok && cardKey(outcome.result.card) === cardKey(outcome.example.card);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!;
}

export function score(outcomes: readonly Outcome[]): Score {
  const failures = outcomes.filter((o) => !isCorrect(o));
  const correct = outcomes.length - failures.length;
  const times = outcomes.map((o) => o.ms);
  return {
    total: outcomes.length,
    correct,
    accuracy: outcomes.length ? correct / outcomes.length : 0,
    failures,
    wrong: failures.filter((f) => f.result.ok).length,
    medianMs: percentile(times, 0.5),
    p90Ms: percentile(times, 0.9),
  };
}

export function percent(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** One line per failure: the sentence, what was expected, and what came out. */
export function failureLines(failures: readonly Outcome[]): string[] {
  return failures.map((f) => {
    const got = f.result.ok ? describeCard(f.result.card) : `no card (${f.result.error})`;
    return `- "${f.example.text}"\n  expected: ${describeCard(f.example.card)}\n  got:      ${got}${f.by ? `  [${f.by}]` : ''}`;
  });
}

export function reportSection(title: string, outcomes: readonly Outcome[]): string {
  const s = score(outcomes);
  return [
    `### ${title}`,
    '',
    `Accuracy: **${percent(s.accuracy)}** (${s.correct} of ${s.total} exact cards). Of the misses, ${s.wrong} gave a wrong card and ${s.failures.length - s.wrong} gave no card. Time per order: median ${s.medianMs.toFixed(0)} ms, 90th percentile ${s.p90Ms.toFixed(0)} ms.`,
    '',
    s.failures.length ? `<details><summary>All ${s.failures.length} failures</summary>\n\n${failureLines(s.failures).join('\n')}\n\n</details>` : 'No failures.',
    '',
  ].join('\n');
}
