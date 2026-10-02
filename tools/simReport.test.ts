import { describe, expect, it } from 'vitest';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../src/data/armies';
import { TRAINING_FIELD } from '../src/data/maps';
import { runBattle } from '../src/sim';
import { formatReport, parseSimArgs } from './simReport';

describe('headless runner options', () => {
  it('reads the seed in both spellings, and --verbose', () => {
    expect(parseSimArgs(['--seed', '42'])).toEqual({ seed: 42, verbose: false });
    expect(parseSimArgs(['--seed=7', '--verbose'])).toEqual({ seed: 7, verbose: true });
    expect(parseSimArgs([])).toEqual({ seed: 42, verbose: false });
  });

  it('rejects bad seeds and unknown options', () => {
    expect(() => parseSimArgs(['--seed'])).toThrow(/seed/);
    expect(() => parseSimArgs(['--seed', 'abc'])).toThrow(/seed/);
    expect(() => parseSimArgs(['--seed', '-1'])).toThrow(/seed/);
    expect(() => parseSimArgs(['--fast'])).toThrow(/Unknown option/);
  });
});

describe('headless runner report', () => {
  const state = runBattle({ seed: 42, map: TRAINING_FIELD, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED });

  it('prints the winner, the deaths and a line per unit', () => {
    const report = formatReport(state, false);
    expect(report).toMatch(/Result: (PLAYER WINS|ENEMY WINS|DRAW)/);
    expect(report).toContain('fell (by');
    expect(report).not.toContain('Shoved');
    for (const unit of state.units) expect(report).toContain(`#${unit.id} `);
  });

  it('adds skill uses when verbose', () => {
    expect(formatReport(state, true)).toMatch(/Shoved|Marked|gave a Barrier/);
  });
});
