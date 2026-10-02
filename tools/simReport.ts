// Formatting for the headless battle runner: a short, readable log and a summary.

import { UNIT_CLASSES } from '../src/data/units';
import { formatBattleTime, type BattleState, type Side, type Unit } from '../src/sim';

export interface SimOptions {
  seed: number;
  verbose: boolean;
}

/** Reads `--seed 42` (or `--seed=42`) and `--verbose` from command-line arguments. */
export function parseSimArgs(args: readonly string[]): SimOptions {
  const options: SimOptions = { seed: 42, verbose: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--seed' || arg.startsWith('--seed=')) {
      const value = arg === '--seed' ? args[++i] : arg.slice('--seed='.length);
      options.seed = parseSeed(value);
    } else {
      throw new Error(`Unknown option "${arg}". Usage: npm run sim -- --seed 42 [--verbose]`);
    }
  }
  return options;
}

function parseSeed(value: string | undefined): number {
  const seed = Number(value);
  if (value === undefined || value.trim() === '' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`The seed must be a whole number from 0 to 4294967295, got "${value ?? ''}".`);
  }
  return seed;
}

const SIDE_NAMES: Record<Side, string> = { player: 'Player', enemy: 'Enemy' };

export function unitLabel(unit: Unit): string {
  return `${SIDE_NAMES[unit.side]} ${UNIT_CLASSES[unit.cls].name} #${unit.id}`;
}

function armySummary(state: BattleState, side: Side): string {
  const counts = new Map<string, number>();
  for (const u of state.units) {
    if (u.side !== side) continue;
    const name = UNIT_CLASSES[u.cls].name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => `${n} ${name}`).join(', ');
}

const SKILL_VERBS = { shove: 'Shoved', mark: 'Marked', barrier: 'gave a Barrier to' } as const;

/** One line per notable event: deaths always, skills when verbose. */
export function formatLog(state: BattleState, verbose: boolean): string[] {
  const byId = new Map(state.units.map((u) => [u.id, u]));
  const label = (id: number | null) => {
    const unit = id === null ? undefined : byId.get(id);
    return unit ? unitLabel(unit) : 'nobody';
  };
  const lines: string[] = [];
  for (const e of state.events) {
    const time = formatBattleTime(e.tick).padStart(8);
    if (e.type === 'death') {
      lines.push(`${time}  ${label(e.unitId)} fell (by ${label(e.killerId)})`);
    } else if (e.type === 'skill' && verbose) {
      lines.push(`${time}  ${label(e.unitId)} ${SKILL_VERBS[e.skill]} ${e.targetIds.map(label).join(', ')}`);
    }
  }
  return lines;
}

function resultLine(state: BattleState): string {
  const result = state.result;
  if (!result) return 'Result: the battle has not ended.';
  const time = formatBattleTime(result.durationTicks);
  const how =
    result.reason === 'eliminated'
      ? result.winner === 'draw'
        ? 'both armies destroyed'
        : `${result.winner === 'player' ? 'enemy' : 'player'} army destroyed`
      : `time limit, by HP left (player ${percent(result.hpShare.player)}, enemy ${percent(result.hpShare.enemy)})`;
  const headline = result.winner === 'draw' ? 'DRAW' : `${result.winner.toUpperCase()} WINS`;
  return `Result: ${headline}: ${how}, after ${time} (${result.durationTicks} ticks)`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function unitTable(state: BattleState): string[] {
  const dealt = new Map<number, number>();
  const kills = new Map<number, number>();
  const skills = new Map<number, number>();
  for (const e of state.events) {
    if (e.type === 'damage') dealt.set(e.sourceId, (dealt.get(e.sourceId) ?? 0) + e.amount + e.absorbed);
    if (e.type === 'death' && e.killerId !== null) kills.set(e.killerId, (kills.get(e.killerId) ?? 0) + 1);
    if (e.type === 'skill') skills.set(e.unitId, (skills.get(e.unitId) ?? 0) + 1);
  }
  const rows = state.units.map((u) => [
    unitLabel(u),
    u.alive ? `${u.hp}/${u.stats.maxHp}` : 'fallen',
    String(Math.round(dealt.get(u.id) ?? 0)),
    String(kills.get(u.id) ?? 0),
    String(skills.get(u.id) ?? 0),
  ]);
  const header = ['Unit', 'HP', 'Damage', 'Kills', 'Skills'];
  const widths = header.map((h, col) => Math.max(h.length, ...rows.map((r) => r[col]!.length)));
  const format = (cells: string[]) =>
    cells.map((c, col) => (col === 0 ? c.padEnd(widths[col]!) : c.padStart(widths[col]!))).join('  ');
  return [format(header), ...rows.map(format)];
}

export function formatReport(state: BattleState, verbose: boolean): string {
  const log = formatLog(state, verbose);
  return [
    `Generals headless battle: seed ${state.seed}, map ${state.map.name}`,
    `  Player: ${armySummary(state, 'player')}`,
    `  Enemy:  ${armySummary(state, 'enemy')}`,
    '',
    verbose ? 'Log (skills and deaths):' : 'Log (deaths; add --verbose for skills):',
    ...(log.length > 0 ? log : ['  (nothing happened)']),
    '',
    resultLine(state),
    '',
    ...unitTable(state).map((line) => `  ${line}`),
  ].join('\n');
}
