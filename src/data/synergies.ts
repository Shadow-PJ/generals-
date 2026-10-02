// Troop synergies: pairs of classes in your army that trigger effects by themselves (docs/DESIGN.md,
// Combos, layer 1). Your army is your 5 troops on the field plus your 3 reserves; a synergy is on
// when both classes are in it. All numbers are starting values to tune.

import type { SpecializationId } from './specializations';
import type { TroopClass } from './units';

export type SynergyId = 'fireBreak' | 'executionProtocol' | 'ironWall' | 'crossfire' | 'shadowEscort';

export interface Synergy {
  id: SynergyId;
  name: string;
  /** The two classes it needs. */
  classes: readonly [TroopClass, TroopClass];
  /** A specialization the second class must have, if any. */
  spec?: SpecializationId;
  /** The classes, as the Combo Codex shows them. */
  stepsText: string;
  /** What it does, as the Combo Codex shows it. */
  bonusText: string;
}

export const SYNERGIES: readonly Synergy[] = [
  {
    id: 'fireBreak',
    name: 'Fire Break',
    classes: ['vanguard', 'invoker'],
    spec: 'pyromancer',
    stepsText: 'Vanguard + Invoker (Pyromancer)',
    bonusText: 'Enemies Shoved through a fire Rift take triple burn damage',
  },
  {
    id: 'executionProtocol',
    name: 'Execution Protocol',
    classes: ['ranger', 'assassin'],
    stepsText: 'Ranger + Assassin',
    bonusText: 'The Assassin always crits a Marked target',
  },
  {
    id: 'ironWall',
    name: 'Iron Wall',
    classes: ['guardian', 'vanguard'],
    stepsText: 'Guardian + Vanguard',
    bonusText: "A Vanguard with a Barrier can't be knocked back and taunts nearby enemies",
  },
  {
    id: 'crossfire',
    name: 'Crossfire',
    classes: ['ranger', 'invoker'],
    stepsText: 'Ranger + Invoker',
    bonusText: 'Arrows shot through a Rift take its element: they burn, or slow in frost',
  },
  {
    id: 'shadowEscort',
    name: 'Shadow Escort',
    classes: ['guardian', 'assassin'],
    stepsText: 'Guardian + Assassin',
    bonusText: "When an Assassin's Barrier breaks, it turns invisible for 2 s",
  },
];

export const SYNERGY_RULES = {
  /** A Shove through a fire Rift burns the enemy for this many of the Rift's pulses at once. */
  fireBreak: { pulses: 3 },
  /** Enemies this close (edge to edge) to the Vanguard must attack it; the taunt is renewed while they stay. */
  ironWall: { tauntRadius: 90, tauntSeconds: 0.5 },
  /** A burning arrow hits this much harder; a frost arrow slows its target for a while. */
  crossfire: { burnBonus: 0.5, frostSlow: 0.3, frostSeconds: 2 },
  shadowEscort: { invisibleSeconds: 2 },
} as const;
