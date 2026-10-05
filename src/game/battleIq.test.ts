import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { BATTLE_IQ } from '../data/battleIq';
import { MASTERY } from '../data/mastery';
import { createBattle, runBattle, secondsToTicks, type BattleEvent, type BattleState } from '../sim';
import { openMap } from '../sim/testing/fixtures';
import { battleFacts } from './battleFacts';
import { battleIq } from './battleIq';
import { meets, metChallenges } from './mastery';

const card = (...actions: ('fallBack' | 'focus' | 'hold')[]): Card => ({
  condition: null,
  auto: false,
  steps: actions.map((action) => (action === 'focus' ? { action, actors: { kind: 'all' }, target: { kind: 'nearest' } } : { action, actors: { kind: 'all' } })) as Card['steps'],
});

/** A battle that is over, with your cards in slots and the events given. Ids alternate: yours 1 (Vanguard) and 3 (Ranger); theirs 2 and 4 (Rangers) and 5 (Vanguard). */
function finished(events: Omit<BattleEvent, 'tick'>[] & { tick?: number }[], winner: 'player' | 'enemy' = 'player', seconds = 90, rank: 1 | 3 = 3): BattleState {
  const state = createBattle({
    seed: 1,
    map: openMap(),
    player: [
      { cls: 'vanguard', x: 200, y: 200 },
      { cls: 'ranger', x: 120, y: 300 },
    ],
    enemy: [
      { cls: 'ranger', x: 800, y: 200 },
      { cls: 'ranger', x: 800, y: 300 },
      { cls: 'vanguard', x: 700, y: 250 },
    ],
    rank,
    loadout: { slots: [card('focus'), card('fallBack'), null, null], legendary: null },
  });
  state.events.push(...(events as BattleEvent[]));
  state.result = { winner, reason: 'eliminated', durationTicks: secondsToTicks(seconds) } as BattleState['result'];
  return state;
}

const T = (s: number) => secondsToTicks(s);

describe('battle facts', () => {
  it('count your cards, Perfect timings, combos, ultimates, losses and time from the log', () => {
    const state = finished([
      { tick: T(10), type: 'cardFired', side: 'player', slot: 0, auto: false, perfect: true, cost: 2, link: 1 },
      { tick: T(12), type: 'cardFired', side: 'enemy', slot: 0, auto: true, perfect: false, cost: 2, link: 1 },
      { tick: T(20), type: 'combo', side: 'player', combo: 'feignedRetreat', acrossCards: true },
      { tick: T(30), type: 'ultimate', side: 'player', name: 'rally', link: 3, finisher: true },
      { tick: T(40), type: 'death', unitId: 3, killerId: 2 },
    ] as BattleEvent[]);
    expect(battleFacts(state)).toEqual({ won: true, cards: 1, perfects: 1, combos: 1, ultimates: 1, finishers: 1, lost: 1, seconds: 90, firstCardSeconds: 10 });
  });
});

describe('General Mastery', () => {
  it('meets a challenge only with a win that shows it', () => {
    const facts = battleFacts(finished([{ tick: T(40), type: 'cardFired', side: 'player', slot: 0, auto: false, perfect: false, cost: 2, link: 1 }] as BattleEvent[], 'player', 50));
    expect(meets({ kind: 'fewCards', max: 2 }, facts)).toBe(true);
    expect(meets({ kind: 'noLosses' }, facts)).toBe(true);
    expect(meets({ kind: 'fast', seconds: 60 }, facts)).toBe(true);
    expect(meets({ kind: 'patient', seconds: 30 }, facts)).toBe(true);
    expect(meets({ kind: 'perfects', min: 1 }, facts)).toBe(false);
    expect(meets({ kind: 'noLosses' }, { ...facts, won: false })).toBe(false);
    expect(metChallenges('captain', facts)).toEqual(['captain.0', 'captain.1']);
    expect(metChallenges('warlord', facts)).toEqual(['warlord.0']);
    expect(MASTERY.engineer[0]!.goal).toEqual({ kind: 'patient', seconds: 30 });
  });
});

describe('the Battle IQ report', () => {
  it('names your biggest mistake: an ultimate left ready, pips left full, or a troop lost early', () => {
    const idle = battleIq(
      finished([
        { tick: T(20), type: 'ultimateReady', side: 'player' },
        { tick: T(35), type: 'ultimate', side: 'player', name: 'rally', link: 1, finisher: false },
      ] as BattleEvent[]),
    );
    expect(idle.mistake).toMatch(/ultimate was ready for 15 s before you used it \(from 0:20\)/);
    const never = battleIq(finished([{ tick: T(20), type: 'ultimateReady', side: 'player' }] as BattleEvent[]));
    expect(never.mistake).toMatch(/never used it/);
    const pips = battleIq(finished([{ tick: T(5), type: 'pipsFull', side: 'player' }, { tick: T(25), type: 'cardFired', side: 'player', slot: 0, auto: false, perfect: false, cost: 2, link: 1 }] as BattleEvent[]));
    expect(pips.mistake).toMatch(/pips sat full for 20 s/);
    const early = battleIq(finished([{ tick: T(8), type: 'death', unitId: 3, killerId: 2 }] as BattleEvent[]));
    expect(early.mistake).toMatch(/Ranger fell only 8 s in/);
    expect(battleIq(finished([])).mistake).toMatch(/No clear mistake/);
  });

  it('names your best decision: a Finisher, a combo, kills after a card', () => {
    const report = battleIq(
      finished([
        { tick: T(10), type: 'cardFired', side: 'player', slot: 0, auto: false, perfect: false, cost: 2, link: 1 },
        { tick: T(12), type: 'death', unitId: 4, killerId: 1 },
      ] as BattleEvent[]),
    );
    expect(report.best).toMatch(/slot 1 at 0:10 led to 1 kill/);
    const combo = battleIq(finished([{ tick: T(30), type: 'combo', side: 'player', combo: 'feignedRetreat', acrossCards: true }] as BattleEvent[]));
    expect(combo.best).toMatch(/Feigned Retreat at 0:30/);
  });

  it('names a missed opportunity: two cards fired the wrong way round for a combo, or just too far apart to chain', () => {
    const fire = (s: number, slot: number) => ({ tick: T(s), type: 'cardFired', side: 'player', slot, auto: false, perfect: false, cost: 2, link: 1 });
    // Focus (slot 1), then Fall Back (slot 2): the other way round is a Feigned Retreat.
    expect(battleIq(finished([fire(10, 0), fire(12, 1)] as BattleEvent[])).missed).toMatch(/Fall Back then Focus would have made a Feigned Retreat/);
    expect(battleIq(finished([fire(10, 1), fire(15, 0)] as BattleEvent[])).missed).toMatch(/5 s apart: within 3 s they would have chained/);
    // Before Rank III there are no chains to miss.
    expect(battleIq(finished([fire(10, 1), fire(15, 0)] as BattleEvent[], 'player', 90, 1)).missed).not.toMatch(/chained/);
  });

  it('finds an enemy weakness: the class that fell first', () => {
    const report = battleIq(
      finished([
        { tick: T(15), type: 'death', unitId: 2, killerId: 1 },
        { tick: T(25), type: 'death', unitId: 4, killerId: 1 },
      ] as BattleEvent[]),
    );
    expect(report.weakness).toMatch(/Their Rangers fell first \(2 of 2/);
    expect(battleIq(finished([])).weakness).toMatch(/none of their troops fell/);
  });

  it('grades the battle, and a better grade earns more XP', () => {
    const good = battleIq(
      finished([
        { tick: T(10), type: 'cardFired', side: 'player', slot: 0, auto: false, perfect: true, cost: 2, link: 1 },
        { tick: T(11), type: 'cardFired', side: 'player', slot: 1, auto: false, perfect: true, cost: 2, link: 2 },
        { tick: T(11), type: 'combo', side: 'player', combo: 'feignedRetreat', acrossCards: true },
        { tick: T(30), type: 'ultimate', side: 'player', name: 'rally', link: 3, finisher: true },
      ] as BattleEvent[]),
    );
    const bad = battleIq(finished([{ tick: T(1), type: 'pipsFull', side: 'player' }, { tick: T(5), type: 'death', unitId: 1, killerId: 2 }] as BattleEvent[], 'enemy'));
    expect(good.grade).toBe('A');
    expect(bad.grade).toBe('D');
    expect(good.xp).toBeGreaterThan(bad.xp);
    expect(BATTLE_IQ.grades.map((g) => g.grade)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('reads a real battle', () => {
    const state = runBattle({ seed: 5, map: openMap(), player: [{ cls: 'vanguard', x: 200, y: 270 }], enemy: [{ cls: 'ranger', x: 760, y: 270 }] });
    const report = battleIq(state);
    expect(['A', 'B', 'C', 'D']).toContain(report.grade);
    for (const line of [report.mistake, report.best, report.missed, report.weakness]) expect(line.length).toBeGreaterThan(10);
  });
});
