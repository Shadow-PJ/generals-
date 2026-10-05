// The balance script (session 6A): plays thousands of headless battles per matchup and reports
// what wins too often. It changes no numbers: proposals go in the pull request.
//   npm run balance                                   every suite, 1,000 battles per matchup
//   npm run balance -- --battles 2000 --suite generals --map redCanyon --rank 4 --out report.md
// Battles run on every core but one; the same options always give the same report.

import { availableParallelism } from 'node:os';
import { writeFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { MAP_IDS, type MapId } from '../../src/data/maps';
import { RANKS, type RankNumber } from '../../src/data/ranks';
import { matchups, SUITES, type MatchupOptions, type Suite } from './matchups';
import { addTallies, EMPTY_TALLY, type Tally } from './play';
import { formatReport, type Row } from './report';
import type { Job } from './worker';

export interface BalanceOptions extends MatchupOptions {
  battles: number;
  suites: Suite[];
  workers: number;
  out: string | null;
}

const USAGE = 'Usage: npm run balance -- [--battles 1000] [--suite generals|specs|factions|bosses|all] [--map openField] [--rank 3] [--workers 3] [--out report.md]';

export function parseBalanceArgs(args: readonly string[]): BalanceOptions {
  const options: BalanceOptions = { battles: 1000, suites: [...SUITES], map: 'openField', rank: 3, workers: Math.max(1, availableParallelism() - 1), out: null };
  for (let i = 0; i < args.length; i++) {
    const name = args[i]!;
    const value = args[++i];
    if (name === '--battles' && Number.isInteger(Number(value)) && Number(value) > 0) options.battles = Number(value);
    else if (name === '--suite' && value === 'all') options.suites = [...SUITES];
    else if (name === '--suite' && (SUITES as readonly string[]).includes(value ?? '')) options.suites = [value as Suite];
    else if (name === '--map' && (MAP_IDS as readonly string[]).includes(value ?? '')) options.map = value as MapId;
    else if (name === '--rank' && RANKS.some((r) => String(r.rank) === value)) options.rank = Number(value) as RankNumber;
    else if (name === '--workers' && Number.isInteger(Number(value)) && Number(value) > 0) options.workers = Number(value);
    else if (name === '--out' && value) options.out = value;
    else throw new Error(`Bad option "${name} ${value ?? ''}". ${USAGE}`);
  }
  return options;
}

/** Splits every matchup's seeds into jobs of `size` battles. */
export function jobsFor(matchupCount: number, battles: number, size = 100): Job[] {
  const jobs: Job[] = [];
  for (let m = 0; m < matchupCount; m++) {
    for (let from = 0; from < battles; from += size) {
      jobs.push({ matchup: m, seeds: Array.from({ length: Math.min(size, battles - from) }, (_, i) => from + i + 1) });
    }
  }
  return jobs;
}

async function runAll(options: BalanceOptions): Promise<Row[]> {
  const list = matchups(options.suites, options);
  const tallies: Tally[] = list.map(() => ({ ...EMPTY_TALLY }));
  const jobs = jobsFor(list.length, options.battles);
  const total = jobs.length;
  let done = 0;
  const started = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(options.workers, jobs.length) }, () => {
      const worker = new Worker(new URL('./thread.mjs', import.meta.url), { workerData: { suites: options.suites, options } });
      return new Promise<void>((resolve, reject) => {
        const next = () => worker.postMessage(jobs.shift() ?? null);
        worker.on('message', ({ matchup, tally }: { matchup: number; tally: Tally }) => {
          tallies[matchup] = addTallies(tallies[matchup]!, tally);
          done++;
          if (done % 20 === 0 || done === total) process.stderr.write(`\r  ${done}/${total} jobs, ${((Date.now() - started) / 1000).toFixed(0)} s`);
          next();
        });
        worker.on('error', reject);
        worker.on('exit', () => resolve());
        next();
      });
    }),
  );
  process.stderr.write('\n');
  return list.map((matchup, i) => ({ matchup, tally: tallies[i]! }));
}

if (process.argv[1]?.endsWith('run.ts')) {
  try {
    const options = parseBalanceArgs(process.argv.slice(2));
    const rows = await runAll(options);
    const report = formatReport(rows, options.battles);
    if (options.out) writeFileSync(options.out, report);
    console.log(report);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
