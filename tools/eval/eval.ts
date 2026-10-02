// Runs the rule parser and the order reader over the hand-written orders and prints the report:
//   npm run eval                    the held-out test part of natural.txt
//   npm run eval -- --set fresh     fresh.txt, written before the reader was built
//   npm run eval -- --set train     (or all) natural.txt's training part, or all of it
//   npm run eval -- --out report.md
// The experimental language model is evaluated in a real browser by tools/eval/model/run.ts,
// with the same scoring.

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parseOrder } from '../../src/cards/parser';
import type { ReaderModel } from '../../src/cards/reader/model';
import { OrderReader } from '../../src/cards/reader/reader';
import { loadNatural, splitNatural, type Example } from '../dataset/natural';
import { reportSection, type Outcome } from './score';

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const READER_FILE = fileURLToPath(new URL('../../models/order-reader.json', import.meta.url));
const FRESH_FILE = fileURLToPath(new URL('../dataset/fresh.txt', import.meta.url));

function timed(example: Example, by: string, read: () => Outcome['result']): Outcome {
  const start = performance.now();
  const result = read();
  return { example, result, ms: performance.now() - start, by };
}

export function runParser(examples: readonly Example[]): Outcome[] {
  return examples.map((e) => timed(e, 'parser', () => parseOrder(e.text)));
}

export function runReader(examples: readonly Example[], reader: OrderReader): Outcome[] {
  return examples.map((e) => timed(e, 'reader', () => reader.read(e.text)));
}

/** What the game does: the parser first, the reader for what the parser can't read. */
export function runChain(examples: readonly Example[], reader: OrderReader): Outcome[] {
  return examples.map((e) => {
    const start = performance.now();
    const parsed = parseOrder(e.text);
    const outcome: Outcome = parsed.ok ? { example: e, result: parsed, ms: 0, by: 'parser' } : { example: e, result: reader.read(e.text), ms: 0, by: 'reader' };
    return { ...outcome, ms: performance.now() - start };
  });
}

export function exampleSet(set: string): Example[] {
  if (set === 'fresh') return loadNatural(readFileSync(FRESH_FILE, 'utf8'));
  const all = loadNatural();
  return set === 'all' ? all : splitNatural(all)[set === 'train' ? 'train' : 'test'];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const set = option('set') ?? 'test';
  const examples = exampleSet(set);
  const json = readFileSync(READER_FILE);
  const loadStart = performance.now();
  const reader = new OrderReader(JSON.parse(json.toString('utf8')) as ReaderModel);
  const loadMs = performance.now() - loadStart;
  // Warm up, so the first order's timing isn't the JavaScript engine starting.
  runChain(examples.slice(0, 20), reader);
  const name = set === 'fresh' ? 'fresh.txt' : set === 'all' ? 'all of natural.txt' : `natural.txt, ${set} part`;
  const report = [
    `## ${name} (${examples.length} orders)`,
    '',
    `Order reader: models/order-reader.json, ${(statSync(READER_FILE).size / 1024).toFixed(0)} KB (${(gzipSync(json).length / 1024).toFixed(0)} KB compressed), ready in ${loadMs.toFixed(0)} ms.`,
    '',
    reportSection('Rule parser alone', runParser(examples)),
    reportSection('Order reader alone', runReader(examples, reader)),
    reportSection('Parser first, then the order reader (what the game does)', runChain(examples, reader)),
  ].join('\n');
  const out = option('out');
  if (out) writeFileSync(out, report);
  console.log(report);
}
