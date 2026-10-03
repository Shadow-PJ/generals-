// Headless battle runner:
// `npm run sim -- --seed 42 [--verbose] [--general warlord] [--enemy-general captain] [--map redCanyon] [--commanders 3]`.
// Runs one full battle with the preset armies and prints the winner and a short log. With
// --commanders, both sides fire their General's script at that rank; the enemy commander also
// fires its ultimate when ready, while yours waits for a U press that never comes here.

import { STARTER_ARMY, STARTER_ARMY_MIRRORED, STARTER_RESERVES } from '../src/data/armies';
import { enemyScript } from '../src/data/enemyScripts';
import { MAPS } from '../src/data/maps';
import { runBattle } from '../src/sim';
import { formatReport, parseSimArgs } from './simReport';

try {
  const options = parseSimArgs(process.argv.slice(2));
  const rank = options.commanders;
  const state = runBattle({
    seed: options.seed,
    map: MAPS[options.map],
    player: STARTER_ARMY,
    enemy: STARTER_ARMY_MIRRORED,
    general: options.general,
    enemyGeneral: options.enemyGeneral,
    ...(rank === null
      ? {}
      : {
          reserves: { player: [...STARTER_RESERVES], enemy: [...STARTER_RESERVES] },
          rank,
          loadout: enemyScript(options.general, rank),
          enemyCommander: { rank, loadout: enemyScript(options.enemyGeneral, rank) },
        }),
  });
  console.log(formatReport(state, options.verbose));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
