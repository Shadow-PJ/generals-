// Formatting for the headless battle runner: a short, readable log and a summary.

import { SIGNATURE_COMBOS } from '../src/data/combos';
import { GENERAL_IDS, GENERALS, type GeneralId } from '../src/data/generals';
import { SPECIALIZATIONS } from '../src/data/specializations';
import { SYNERGIES } from '../src/data/synergies';
import { UNIT_CLASSES } from '../src/data/units';
import { formatBattleTime, type BattleState, type Side, type Unit } from '../src/sim';

export interface SimOptions {
  seed: number;
  verbose: boolean;
  /** Your General, and the enemy's: the Captain unless given. */
  general: GeneralId;
  enemyGeneral: GeneralId;
}

const USAGE = 'Usage: npm run sim -- --seed 42 [--verbose] [--general warlord] [--enemy-general captain]';

/** Reads `--seed 42` (or `--seed=42`), `--verbose`, `--general <id>` and `--enemy-general <id>` from command-line arguments. */
export function parseSimArgs(args: readonly string[]): SimOptions {
  const options: SimOptions = { seed: 42, verbose: false, general: 'captain', enemyGeneral: 'captain' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const [name, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = () => inline ?? args[++i];
    if (name === '--verbose' || name === '-v') {
      options.verbose = true;
    } else if (name === '--seed') {
      options.seed = parseSeed(value());
    } else if (name === '--general') {
      options.general = parseGeneral(value());
    } else if (name === '--enemy-general') {
      options.enemyGeneral = parseGeneral(value());
    } else {
      throw new Error(`Unknown option "${arg}". ${USAGE}`);
    }
  }
  return options;
}

function parseGeneral(value: string | undefined): GeneralId {
  if (!(GENERAL_IDS as readonly (string | undefined)[]).includes(value)) {
    throw new Error(`The General must be one of ${GENERAL_IDS.join(', ')}, got "${value ?? ''}".`);
  }
  return value as GeneralId;
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

/** "2 Vanguard, 1 Invoker (Pyromancer)", its General, then the synergies the army switched on. */
function armySummary(state: BattleState, side: Side): string {
  const counts = new Map<string, number>();
  for (const u of state.units) {
    if (u.side !== side) continue;
    const name = UNIT_CLASSES[u.cls].name + (u.spec ? ` (${SPECIALIZATIONS[u.spec].name})` : '');
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const army = `${[...counts].map(([name, n]) => `${n} ${name}`).join(', ')} under ${GENERALS[state.generals[side]].name}`;
  const synergies = state.synergies[side].map(synergyName);
  return synergies.length > 0 ? `${army}; synergies: ${synergies.join(', ')}` : army;
}

function synergyName(id: string): string {
  return SYNERGIES.find((s) => s.id === id)?.name ?? id;
}

const SKILL_VERBS = {
  shove: 'Shoved',
  mark: 'Marked',
  barrier: 'gave a Barrier to',
  rift: 'opened a Rift on',
  shadowstep: 'Shadowstepped behind',
  vampiricLink: 'paid blood to speed up',
  vent: 'vented heat on',
  assimilation: 'assimilated',
  phaseShift: 'phased behind',
  shatter: 'shattered',
} as const;

/** One line per notable event: deaths and broken walls always, skills when verbose. */
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
    } else if (e.type === 'cardFired') {
      const link = e.link > 1 ? `, chain link ${e.link}` : '';
      lines.push(`${time}  Card in slot ${e.slot + 1} fired${e.perfect ? ' (Perfect timing)' : e.auto ? ' (Auto)' : ''}${link}`);
    } else if (e.type === 'combo') {
      lines.push(`${time}  Combo: ${SIGNATURE_COMBOS.find((c) => c.id === e.combo)!.name}${e.acrossCards ? ' (across the chain)' : ''}`);
    } else if (e.type === 'ultimate') {
      const name = Object.values(GENERALS).find((g) => g.ultimate.id === e.name)!.ultimate.name;
      lines.push(`${time}  ${e.finisher ? `Finisher: ${name}!` : `${name}!`}`);
    } else if (e.type === 'evolved') {
      lines.push(`${time}  ${label(e.mergedId)} merged into ${label(e.unitId)} (Forced Evolution)`);
    } else if (e.type === 'synergy') {
      lines.push(`${time}  Synergy: ${synergyName(e.synergy)} (${SIDE_NAMES[e.side]})`);
    } else if (e.type === 'interrupted') {
      lines.push(`${time}  ${label(e.unitId)}'s Rift was interrupted (by ${label(e.byId)})`);
    } else if (e.type === 'reserveCalled') {
      lines.push(`${time}  ${label(e.unitId)} arrives from the reserves`);
    } else if (e.type === 'overtime') {
      lines.push(`${time}  Overtime: damage grows every second from here`);
    } else if (e.type === 'wallBreak') {
      lines.push(`${time}  Wall ${e.wallId} broke (shot by ${label(e.sourceId)})`);
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
    verbose ? 'Log (skills, deaths and broken walls):' : 'Log (deaths and broken walls; add --verbose for skills):',
    ...(log.length > 0 ? log : ['  (nothing happened)']),
    '',
    resultLine(state),
    '',
    ...unitTable(state).map((line) => `  ${line}`),
  ].join('\n');
}
