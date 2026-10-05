// The balance report: each suite's matchups with A's win rate, and the ones outside their fair
// range flagged as winning (or losing) too often. Plain Markdown, for the terminal or a file.

import { TICKS_PER_SECOND } from '../../src/sim';
import type { Matchup, Suite } from './matchups';
import { battlesIn, winRate, type Tally } from './play';

export interface Row {
  matchup: Pick<Matchup, 'suite' | 'name' | 'fair'>;
  tally: Tally;
}

/** ±, for a 95% interval of a win rate measured over `n` battles. */
export function margin(rate: number, n: number): number {
  return n === 0 ? 1 : 1.96 * Math.sqrt((rate * (1 - rate)) / n);
}

/** Outside the fair range by more than the measurement's own margin: 'high' wins too often, 'low' too rarely. */
export function verdict(row: Row): 'high' | 'low' | null {
  const rate = winRate(row.tally);
  const m = margin(rate, battlesIn(row.tally));
  if (rate - m > row.matchup.fair[1]) return 'high';
  if (rate + m < row.matchup.fair[0]) return 'low';
  return null;
}

const SUITE_TITLES: Readonly<Record<Suite, string>> = {
  generals: 'Generals (A vs B, both with a commander firing its script and ultimate)',
  specs: 'Specializations (every class on the field; no commanders)',
  factions: 'Factions (fighters of a faction vs the same army with none; no commanders)',
  bosses: 'Boss fights (a strong run army, Rank III commander, vs the ruler)',
};

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

export function formatReport(rows: readonly Row[], battles: number): string {
  const lines: string[] = [
    `# Balance report (${battles} battles per matchup)`,
    '',
    'A wins: draws count half; ± is the 95% margin. HP edge: on average, the share of its HP A has left at the end minus B\'s, in points: it says how big the wins are, since a small edge can still win almost every battle.',
    '',
  ];
  const flagged = rows.filter((r) => verdict(r) !== null);
  lines.push(flagged.length === 0 ? 'Nothing wins or loses too often.' : `## Flagged (${flagged.length})`, '');
  for (const r of flagged) {
    lines.push(`- **${r.matchup.name}** (${r.matchup.suite}): A wins ${pct(winRate(r.tally))}, ${verdict(r) === 'high' ? 'too often' : 'too rarely'} (fair: ${pct(r.matchup.fair[0])} to ${pct(r.matchup.fair[1])})`);
  }
  for (const suite of [...new Set(rows.map((r) => r.matchup.suite))]) {
    lines.push('', `## ${SUITE_TITLES[suite]}`, '', '| Matchup | A wins | ± | Draws | HP edge | Avg length | Fair | |', '| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |');
    for (const r of rows.filter((x) => x.matchup.suite === suite)) {
      const n = battlesIn(r.tally);
      const rate = winRate(r.tally);
      const flag = verdict(r) === 'high' ? 'too often' : verdict(r) === 'low' ? 'too rarely' : '';
      const seconds = n === 0 ? 0 : r.tally.ticks / n / TICKS_PER_SECOND;
      const edge = n === 0 ? 0 : (100 * r.tally.edge) / n;
      lines.push(`| ${r.matchup.name} | ${pct(rate)} | ${pct(margin(rate, n))} | ${r.tally.draws} | ${edge >= 0 ? '+' : '−'}${Math.abs(edge).toFixed(0)} | ${seconds.toFixed(0)} s | ${pct(r.matchup.fair[0])}–${pct(r.matchup.fair[1])} | ${flag} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}
