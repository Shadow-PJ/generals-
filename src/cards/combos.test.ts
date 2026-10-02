import { describe, expect, it } from 'vitest';
import { signatureCombos } from './combos';
import type { Step } from './types';

const all = { kind: 'all' } as const;
const vanguards = { kind: 'class', cls: 'vanguard' } as const;
const rangers = { kind: 'class', cls: 'ranger' } as const;

const focus: Step = { action: 'focus', actors: all, target: { kind: 'nearest' } };
const fallBack: Step = { action: 'fallBack', actors: all, to: null };
const reserve: Step = { action: 'callReserve', reserve: null };
const protect: Step = { action: 'protect', actors: all, target: { kind: 'class', cls: 'ranger' } };
const hold: Step = { action: 'hold', actors: all };
const overchargeVanguards: Step = { action: 'overcharge', actors: vanguards };
const overchargeRangers: Step = { action: 'overcharge', actors: rangers };
const vanguardsBehind: Step = { action: 'move', actors: vanguards, to: { kind: 'behindEnemies' } };

describe('signature combos', () => {
  it('finds each combo from the design', () => {
    expect(signatureCombos([fallBack, focus])).toEqual(['feignedRetreat']);
    expect(signatureCombos([reserve, focus])).toEqual(['ambush']);
    expect(signatureCombos([overchargeVanguards, overchargeVanguards])).toEqual(['overload']);
    expect(signatureCombos([vanguardsBehind, overchargeVanguards])).toEqual(['hammerAndAnvil']);
    expect(signatureCombos([protect, hold])).toEqual(['ironShell']);
  });

  it('needs the steps in that order, and next to each other', () => {
    expect(signatureCombos([focus, fallBack])).toEqual([]);
    expect(signatureCombos([fallBack, hold, focus])).toEqual([]);
    expect(signatureCombos([hold, fallBack, focus])).toEqual(['feignedRetreat']);
  });

  it('needs the same troops for Overload and Hammer and Anvil, and Vanguards going behind the enemy', () => {
    expect(signatureCombos([overchargeVanguards, overchargeRangers])).toEqual([]);
    expect(signatureCombos([vanguardsBehind, overchargeRangers])).toEqual([]);
    expect(signatureCombos([{ ...vanguardsBehind, to: { kind: 'forward' } }, overchargeVanguards])).toEqual([]);
    expect(signatureCombos([{ ...vanguardsBehind, actors: rangers }, overchargeRangers])).toEqual([]);
  });

  it('finds more than one in a long card', () => {
    expect(signatureCombos([protect, hold, fallBack, focus])).toEqual(['ironShell', 'feignedRetreat']);
  });
});
