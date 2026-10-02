// Runs the small model over the natural orders in a real browser (headless Chromium), with the
// same loader the game uses, and writes the eval report: accuracy, speed and download size.
//   npx tsx tools/eval/model/run.ts --model qwen2.5-0.5b --threads 0 --isolated --out report.md
//   --model           an id from src/platform/models.ts, or a URL to a .gguf file
//   --model-file      a local .gguf file to serve instead of downloading it
//   --threads         CPU threads; 0 = as many as the page allows, 1 = single-threaded
//   --isolated        serve the page cross-origin isolated (needed for more than 1 thread),
//                     as the desktop app does; GitHub Pages can't, so the browser build runs with 1
//   --set, --limit    which sentences: test (default), train or all; and how many at most
//   --minutes         stop reading orders after this long and report what was done (default 45)
// Orders are taken round-robin across the groups, so a run cut short still covers every kind.
// The report file is rewritten every 10 orders, so even a killed run leaves one.
// Set CHROMIUM_PATH to use a Chromium that Playwright didn't download.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { cardFromModelOutput, PROMPT_EXAMPLES } from '../../../src/cards/modelFormat';
import { parseOrder } from '../../../src/cards/parser';
import { ORDER_MODELS } from '../../../src/platform/models';
import { loadNatural, splitNatural } from '../../dataset/natural';
import { reportSection, score, percent, type Outcome } from '../score';
import type { EvalPage } from './protocol';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const modelFile = option('model-file');
// --model names the model (and says where to download it); --model-file serves a local copy instead.
const modelArg = option('model') ?? (modelFile ? path.basename(modelFile) : 'qwen2.5-0.5b');
const choice = ORDER_MODELS.find((m) => m.id === modelArg);
const threads = Number(option('threads') ?? '0');
const isolated = flag('isolated');
const set = option('set') ?? 'test';
const limit = Number(option('limit') ?? '0');

const minutes = Number(option('minutes') ?? '45');

/** The first sentence of every group, then the second of every group, and so on. */
function roundRobin<T extends { group: string }>(items: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  const lists = [...groups.values()];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  return Array.from({ length: longest }, (_, i) => lists.flatMap((l) => (l[i] ? [l[i]] : []))).flat();
}

const all = loadNatural();
const pool = roundRobin(set === 'all' ? all : splitNatural(all)[set === 'train' ? 'train' : 'test']);
const examples = limit > 0 ? pool.slice(0, limit) : pool;

const server = await createServer({
  configFile: false,
  root: here,
  publicDir: modelFile ? path.dirname(path.resolve(modelFile)) : false,
  logLevel: 'warn',
  server: {
    port: 0,
    fs: { allow: [root] },
    // What the desktop app sends, so the model can use more than one thread.
    headers: isolated ? { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' } : {},
  },
});
await server.listen();
const pageUrl = server.resolvedUrls?.local[0];
if (!pageUrl) throw new Error('The eval page server did not start');
const modelUrl = modelFile ? `${pageUrl}${path.basename(modelFile)}` : (choice?.url ?? modelArg);

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const page = await browser.newPage();
const pageErrors: string[] = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text());
});

try {
  await page.goto(pageUrl);
  await page.waitForFunction(() => 'evalLoad' in globalThis);
  console.log(`Loading ${modelUrl} ...`);
  const load = await page.evaluate(([u, t]) => (globalThis as unknown as EvalPage).evalLoad(u as string, t as number), [modelUrl, threads] as const);
  console.log(`Loaded in ${(load.ms / 1000).toFixed(1)} s on ${load.threads} thread(s), ${(load.bytes / 1e6).toFixed(0)} MB, isolated: ${load.isolated}`);

  // The first order also reads the long prompt; later orders reuse it from the cache.
  const translate = (text: string) => page.evaluate((t) => (globalThis as unknown as EvalPage).evalTranslate(t), text);
  const warmUp = await translate(PROMPT_EXAMPLES[0]!.text);

  const name = choice?.name ?? path.basename(modelFile ?? modelArg);
  const out = option('out');
  const report = (outcomes: readonly Outcome[], finished: boolean) => {
    // What the game does: the parser first, the model only for what the parser can't read.
    const chained: Outcome[] = outcomes.map((o) => {
      const parsed = parseOrder(o.example.text);
      return parsed.ok ? { example: o.example, result: parsed, ms: 0, by: 'parser' } : o;
    });
    const parserOnly: Outcome[] = outcomes.map((o) => ({ example: o.example, result: parseOrder(o.example.text), ms: 0, by: 'parser' }));
    const text = [
      `## ${name}: ${load.threads === 1 ? 'single-threaded (browser build)' : `${load.threads} threads (desktop app)`}`,
      '',
      `- Model: ${choice ? `[${choice.name}](${choice.url}) (${choice.license})` : modelUrl}`,
      `- Download: **${(load.bytes / 1e6).toFixed(0)} MB** for the model, plus 8.8 MB for the runtime. Loading took ${(load.ms / 1000).toFixed(1)} s${modelFile ? ' from a local copy (no download time)' : ', download included'}.`,
      `- Threads: ${load.threads}; cross-origin isolated: ${load.isolated}. First order (also reads the prompt): ${(warmUp.ms / 1000).toFixed(1)} s.`,
      `- Orders: ${outcomes.length} of the ${examples.length} in the ${set} set${limit ? ` (first ${limit})` : ''}, taken round-robin across the ${new Set(examples.map((e) => e.group)).size} groups${finished ? '' : ` (stopped at the ${minutes}-minute limit)`}.`,
      '',
      reportSection('Model alone', outcomes),
      reportSection('Parser first, then the model (what the game does)', chained),
      reportSection('Parser alone, on the same orders', parserOnly),
      pageErrors.length ? `Errors in the page: ${pageErrors.join(' | ')}` : '',
    ].join('\n');
    if (out) writeFileSync(out, text);
    return text;
  };

  const modelOutcomes: Outcome[] = [];
  const deadline = Date.now() + minutes * 60_000;
  let finished = true;
  for (const [i, example] of examples.entries()) {
    if (Date.now() > deadline) {
      finished = false;
      break;
    }
    const { raw, ms } = await translate(example.text);
    modelOutcomes.push({ example, result: cardFromModelOutput(raw, example.text), ms, by: 'model' });
    if ((i + 1) % 10 === 0 || i === examples.length - 1) {
      const s = score(modelOutcomes);
      console.log(`${i + 1}/${examples.length}  accuracy so far ${percent(s.accuracy)}  median ${s.medianMs.toFixed(0)} ms`);
      report(modelOutcomes, false);
    }
  }
  console.log(report(modelOutcomes, finished));
} finally {
  await browser.close();
  await server.close();
}
