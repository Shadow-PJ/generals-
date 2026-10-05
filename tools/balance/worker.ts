// One of the balance script's worker threads: plays the battles it is sent and posts back the tallies.

import { parentPort, workerData } from 'node:worker_threads';
import { matchups, type MatchupOptions, type Suite } from './matchups';
import { playMatchup } from './play';

export interface Job {
  matchup: number;
  seeds: number[];
}

const { suites, options } = workerData as { suites: Suite[]; options: MatchupOptions };
const all = matchups(suites, options);
parentPort!.on('message', (job: Job | null) => {
  if (job === null) {
    process.exit(0);
  }
  parentPort!.postMessage({ matchup: job.matchup, tally: playMatchup(all[job.matchup]!, job.seeds) });
});
