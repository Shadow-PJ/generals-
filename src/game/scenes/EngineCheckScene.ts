// A placeholder screen until the battle renderer arrives in session 1B:
// it runs one seeded battle in the browser and shows the result as text.

import Phaser from 'phaser';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../../data/armies';
import { OPEN_FIELD } from '../../data/maps';
import { formatBattleTime, runBattle, type BattleResult } from '../../sim';

const SEED = 42;

export class EngineCheckScene extends Phaser.Scene {
  constructor() {
    super('EngineCheck');
  }

  create(): void {
    const state = runBattle({ seed: SEED, map: OPEN_FIELD, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 60, 'GENERALS', { fontFamily: 'sans-serif', fontSize: '48px', color: '#f2e6c9' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 10, `Battle engine check, seed ${SEED}: ${describe(state.result)}`, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#c9d3e0',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 50, 'The battle view arrives in session 1B. Try `npm run sim -- --seed 42`.', {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#7d8a9c',
      })
      .setOrigin(0.5);
  }
}

function describe(result: BattleResult | null): string {
  if (!result) return 'no result';
  const winner = result.winner === 'draw' ? 'draw' : `${result.winner} wins`;
  return `${winner} after ${formatBattleTime(result.durationTicks)}`;
}
