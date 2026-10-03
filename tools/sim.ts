// Headless battle runner: `npm run sim -- --seed 42 [--verbose] [--general warlord] [--enemy-general captain]`.
// Runs one full battle with the preset armies and prints the winner and a short log.

import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../src/data/armies';
import { OPEN_FIELD } from '../src/data/maps';
import { runBattle } from '../src/sim';
import { formatReport, parseSimArgs } from './simReport';

try {
  const options = parseSimArgs(process.argv.slice(2));
  const state = runBattle({
    seed: options.seed,
    map: OPEN_FIELD,
    player: STARTER_ARMY,
    enemy: STARTER_ARMY_MIRRORED,
    general: options.general,
    enemyGeneral: options.enemyGeneral,
  });
  console.log(formatReport(state, options.verbose));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
