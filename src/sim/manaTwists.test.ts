import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { COMMAND_RULES } from '../data/command';
import { MANA_TWISTS, type GeneralId } from '../data/generals';
import { rankRules } from '../data/ranks';
import { stepBattle } from './battle';
import { slotReadiness } from './command';
import { battleWith, cardOf, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleState } from './types';

const hold = cardOf({ action: 'hold', actors: { kind: 'all' } });

function quiet(general: GeneralId, cards: (Card | null)[] = []): BattleState {
  const state = battleWith(
    [
      { cls: 'vanguard', x: 100, y: 300 },
      { cls: 'ranger', x: 60, y: 200 },
    ],
    [{ cls: 'vanguard', x: 950, y: 300 }],
    { general, cards, rank: 3 },
  );
  freeze(...state.units);
  return state;
}

function steps(state: BattleState, n: number): void {
  for (let i = 0; i < n; i++) stepBattle(state);
}

describe("the Generals' mana twists", () => {
  it('Blood Price (Warlord): short on pips, your healthiest troop pays the rest with HP', () => {
    const state = quiet('warlord', [hold]);
    state.command.pips = 0;
    expect(slotReadiness(state, 0)).toBe('ready');
    const ranger = sideUnits(state, 'player')[1]!;
    const vanguard = sideUnits(state, 'player')[0]!;
    vanguard.hp = 1000;
    stepBattle(state, [{ tick: state.tick, kind: 'slot', slot: 0 }]);
    expect(state.events.some((e) => e.type === 'cardFired')).toBe(true);
    expect(ranger.hp).toBe(450 - Math.round(450 * MANA_TWISTS.bloodPrice.hpSharePerPip));
    expect(state.command.pips).toBe(0);
    // A troop that would fall paying can't; the Captain never pays in blood.
    const weak = quiet('warlord', [hold]);
    weak.command.pips = 0;
    for (const u of sideUnits(weak, 'player')) u.hp = 30;
    expect(slotReadiness(weak, 0)).toBe('noPips');
    const captain = quiet('captain', [hold]);
    captain.command.pips = 0;
    expect(slotReadiness(captain, 0)).toBe('noPips');
  });

  it('Build-Up (Engineer): max pips +1 every 30 s, up to +3', () => {
    const state = quiet('engineer');
    const base = rankRules(3).maxPips;
    const every = secondsToTicks(MANA_TWISTS.buildUp.everySeconds);
    steps(state, every - 1);
    expect(state.command.maxPips).toBe(base);
    steps(state, 2);
    expect(state.command.maxPips).toBe(base + 1);
    steps(state, every * 5);
    expect(state.command.maxPips).toBe(base + MANA_TWISTS.buildUp.maxExtraPips);
    expect(quiet('captain').command.maxPips).toBe(base);
  });

  it('Feeding (Hive Mother): pips refill at half speed, and every enemy killed gives one', () => {
    const state = quiet('hiveMother');
    const refill = secondsToTicks(COMMAND_RULES.pipRefillSeconds);
    steps(state, refill);
    expect(state.command.pips).toBe(COMMAND_RULES.startingPips);
    steps(state, refill);
    expect(state.command.pips).toBe(COMMAND_RULES.startingPips + 1);
    sideUnits(state, 'enemy')[0]!.hp = 0;
    stepBattle(state);
    expect(state.command.pips).toBe(COMMAND_RULES.startingPips + 2);
  });

  it('Prepared (Strategist): every battle starts with full pips, which refill 25% slower', () => {
    const state = quiet('strategist');
    expect(state.command.pips).toBe(state.command.maxPips);
    state.command.pips = 0;
    const refill = secondsToTicks(COMMAND_RULES.pipRefillSeconds);
    steps(state, refill);
    expect(state.command.pips).toBe(0);
    steps(state, Math.ceil(refill / MANA_TWISTS.prepared.refillRate) - refill);
    expect(state.command.pips).toBe(1);
  });

  it('Rhythm (Conductor): Perfect timing gives 2 pips back, and cards glow longer', () => {
    const hurt: Card = {
      condition: { triggers: [{ kind: 'allyBelowHp', ally: 'any', hpPercent: 50 }], repeat: false },
      steps: hold.steps,
      auto: false,
    };
    const glowing = (general: GeneralId) => {
      const state = quiet(general, [hurt]);
      sideUnits(state, 'player')[1]!.hp = 100;
      stepBattle(state);
      return state;
    };
    const perfect = (general: GeneralId) => {
      const state = glowing(general);
      state.command.pips = 2;
      stepBattle(state, [{ tick: state.tick, kind: 'slot', slot: 0 }]);
      expect(state.events.filter((e) => e.type === 'cardFired' && e.perfect)).toHaveLength(1);
      return state;
    };
    // The card costs 1; a Perfect gives 1 back, or 2 with the Conductor.
    expect(perfect('captain').command.pips).toBe(2);
    expect(perfect('conductor').command.pips).toBe(3);
    const state = glowing('conductor');
    expect(state.command.slots[0]!.lingerTicks).toBe(secondsToTicks(MANA_TWISTS.rhythm.glowLingerSeconds));
  });
});
