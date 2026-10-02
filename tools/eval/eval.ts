// Runs the rule parser over the natural orders and prints the report:
//   npm run eval                 the held-out test set
//   npm run eval -- --set all    every sentence
//   npm run eval -- --out report.md
// The small model is evaluated in a real browser by tools/eval/model/run.ts, with the same scoring.

import { writeFileSync } from 'node:fs';
import { parseOrder } from '../../src/cards/parser';
import { loadNatural, splitNatural, type Example } from '../dataset/natural';
import { reportSection, type Outcome } from './score';

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function runParser(examples: readonly Example[]): Outcome[] {
  return examples.map((example) => {
    const start = performance.now();
    const result = parseOrder(example.text);
    return { example, result, ms: performance.now() - start, by: 'parser' };
  });
}

const all = loadNatural();
const set = option('set') ?? 'test';
const examples = set === 'all' ? all : splitNatural(all)[set === 'train' ? 'train' : 'test'];
const report = [`## Rule parser on the ${set === 'all' ? 'whole' : set} set (${examples.length} orders)`, '', reportSection('Rule parser', runParser(examples))].join('\n');
const out = option('out');
if (out) writeFileSync(out, report);
console.log(report);
