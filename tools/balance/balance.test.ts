import { describe, expect, it } from 'vitest';
import { GENERAL_IDS } from '../../src/data/generals';
import { MAPS } from '../../src/data/maps';
import { REGION_IDS } from '../../src/data/regions';
import { matchups, SUITES } from './matchups';
import { autoBattle, hpLeft, playMatchup, winRate } from './play';
import { formatReport, margin, verdict } from './report';
import { jobsFor, parseBalanceArgs } from './run';

const options = { rank: 3 as const, map: 'openField' as const };

describe('the balance script', () => {
  it('has every General against every other, every specialization, every faction tier and every boss', () => {
    const all = matchups([...SUITES], options);
    const n = GENERAL_IDS.length;
    expect(all.filter((m) => m.suite === 'generals')).toHaveLength((n * (n + 1)) / 2);
    expect(all.filter((m) => m.suite === 'specs')).toHaveLength(15);
    expect(all.filter((m) => m.suite === 'factions')).toHaveLength(15);
    expect(all.filter((m) => m.suite === 'bosses')).toHaveLength(REGION_IDS.length * 2);
  });

  it('swaps sides in a mirror matchup: the same seed, A on the other side', () => {
    const m = matchups(['generals'], options).find((x) => x.name === 'warlord vs engineer')!;
    const asPlayer = m.setup(4, true);
    const asEnemy = m.setup(4, false);
    expect([asPlayer.general, asPlayer.enemyGeneral]).toEqual(['warlord', 'engineer']);
    expect([asEnemy.general, asEnemy.enemyGeneral]).toEqual(['engineer', 'warlord']);
  });

  it('starts every troop a little off its spot, by the seed, and inside the deploy zone', () => {
    const m = matchups(['specs'], options).find((x) => x.name === 'sniper vs none')!;
    expect(m.setup(5, true)).toEqual(m.setup(5, true));
    expect(m.setup(5, true).player).not.toEqual(m.setup(6, true).player);
    const zones = MAPS.openField.deployZones;
    for (let seed = 1; seed <= 50; seed++) {
      const setup = m.setup(seed, seed % 2 === 0);
      for (const [troops, zone] of [[setup.player, zones.player], [setup.enemy, zones.enemy]] as const) {
        for (const t of troops) {
          expect(t.x).toBeGreaterThanOrEqual(zone.x);
          expect(t.x).toBeLessThanOrEqual(zone.x + zone.w);
          expect(t.y).toBeGreaterThanOrEqual(zone.y);
          expect(t.y).toBeLessThanOrEqual(zone.y + zone.h);
        }
      }
    }
  });

  it('plays the same battles for the same seeds, and the player fires its ultimate when ready', () => {
    const m = matchups(['generals'], options).find((x) => x.name === 'captain vs warlord')!;
    expect(playMatchup(m, [1, 2, 3, 4])).toEqual(playMatchup(m, [1, 2, 3, 4]));
    const fired = [2, 4, 6].map((seed) => autoBattle(m.setup(seed, true), true)).filter((state) => state.events.some((e) => e.type === 'ultimate' && e.side === 'player'));
    expect(fired.length).toBeGreaterThan(0);
  });

  it('measures how big a win is: the winner keeps a share of its HP, the loser none', () => {
    const m = matchups(['generals'], options).find((x) => x.name === 'captain vs warlord')!;
    const state = autoBattle(m.setup(2, true), true);
    const winner = state.result!.winner;
    expect(winner).not.toBe('draw');
    const loser = winner === 'player' ? 'enemy' : 'player';
    expect(hpLeft(state, winner as 'player' | 'enemy')).toBeGreaterThan(0);
    expect(hpLeft(state, loser)).toBe(0);
    const tally = playMatchup(m, [2]);
    expect(tally.edge).toBeCloseTo(tally.wins === 1 ? hpLeft(state, 'player') : -hpLeft(state, 'enemy'));
  });

  it('flags a matchup only when it is outside its fair range by more than its own margin', () => {
    const row = (wins: number, losses: number) => ({ matchup: { suite: 'generals' as const, name: 'x', fair: [0.4, 0.6] as const }, tally: { wins, losses, draws: 0, ticks: 0, edge: 0 } });
    expect(verdict(row(700, 300))).toBe('high');
    expect(verdict(row(300, 700))).toBe('low');
    expect(verdict(row(6, 4))).toBeNull();
    expect(margin(0.5, 1000)).toBeCloseTo(0.031, 3);
    expect(winRate({ wins: 3, losses: 1, draws: 2, ticks: 0, edge: 0 })).toBeCloseTo(4 / 6);
    expect(formatReport([row(700, 300)], 1000)).toMatch(/\*\*x\*\* \(generals\): A wins 70\.0%, too often/);
  });

  it('reads its options and splits the battles into jobs', () => {
    expect(parseBalanceArgs(['--battles', '50', '--suite', 'bosses', '--rank', '4'])).toMatchObject({ battles: 50, suites: ['bosses'], rank: 4 });
    expect(() => parseBalanceArgs(['--suite', 'nonsense'])).toThrow(/Usage/);
    const jobs = jobsFor(2, 250);
    expect(jobs.map((j) => j.seeds.length)).toEqual([100, 100, 50, 100, 100, 50]);
    expect(new Set(jobs.filter((j) => j.matchup === 0).flatMap((j) => j.seeds)).size).toBe(250);
  });
});
