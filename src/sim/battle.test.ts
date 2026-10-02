import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED, STARTER_RESERVES } from '../data/armies';
import { BATTLE_RULES } from '../data/battle';
import { OPEN_FIELD } from '../data/maps';
import { UNIT_CLASSES } from '../data/units';
import { createBattle, runBattle, stepBattle } from './battle';
import { battleWith, openMap } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleInput, BattleSetup } from './types';

function presetBattle(seed: number): BattleSetup {
  return { seed, map: OPEN_FIELD, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED };
}

describe('creating a battle', () => {
  it('builds each unit from its class stats in src/data, as its own copy', () => {
    const state = createBattle(presetBattle(1));
    for (const unit of state.units) {
      expect(unit.stats).toEqual(UNIT_CLASSES[unit.cls].stats);
      expect(unit.stats).not.toBe(UNIT_CLASSES[unit.cls].stats);
      expect(unit.hp).toBe(unit.stats.maxHp);
    }
  });

  it('numbers units 1, 2, 3 ... alternating sides, and keeps them in id order', () => {
    const state = createBattle(presetBattle(1));
    expect(state.units.map((u) => u.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(state.units.slice(0, 4).map((u) => u.side)).toEqual(['player', 'enemy', 'player', 'enemy']);
  });

  it('refuses a troop placed inside a wall', () => {
    expect(() =>
      createBattle({
        seed: 1,
        map: openMap([{ x: 100, y: 100, w: 100, h: 100 }]),
        player: [{ cls: 'vanguard', x: 150, y: 150 }],
        enemy: [{ cls: 'vanguard', x: 800, y: 300 }],
      }),
    ).toThrow(/inside a wall/);
  });
});

describe('ending a battle', () => {
  it('ends when one army is gone, and the other side wins', () => {
    const state = battleWith(
      [
        { cls: 'vanguard', x: 300, y: 300 },
        { cls: 'vanguard', x: 300, y: 340 },
      ],
      [{ cls: 'ranger', x: 400, y: 300 }],
    );
    while (!state.result) stepBattle(state);
    expect(state.result).toMatchObject({ winner: 'player', reason: 'eliminated' });
    expect(state.result.hpShare.enemy).toBe(0);
    expect(state.events.at(-1)).toMatchObject({ type: 'end', winner: 'player', reason: 'eliminated' });
  });

  it('ends after 3 minutes, won by the side with the larger share of its HP left', () => {
    // A wall across the whole map keeps two Vanguards apart.
    const wall = { x: 480, y: 0, w: 40, h: 600 };
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 700, y: 300 }], {
      walls: [wall],
    });
    const [player, enemy] = state.units;
    player!.hp -= 100;
    enemy!.hp -= 300;
    while (!state.result) stepBattle(state);
    expect(state.result).toMatchObject({ winner: 'player', reason: 'timeout' });
    expect(state.result.durationTicks).toBe(secondsToTicks(BATTLE_RULES.timeLimitSeconds));
    expect(state.result.durationTicks).toBe(3600);
  });

  it('calls a draw when time runs out with equal HP shares', () => {
    const wall = { x: 480, y: 0, w: 40, h: 600 };
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 700, y: 300 }], {
      walls: [wall],
    });
    while (!state.result) stepBattle(state);
    expect(state.result).toMatchObject({ winner: 'draw', reason: 'timeout' });
  });

  it('does nothing when stepped after the end', () => {
    const state = runBattle(presetBattle(3));
    const snapshot = JSON.stringify(state);
    stepBattle(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('determinism', () => {
  it('gives the same battle, tick by tick, for the same seed', () => {
    const a = createBattle(presetBattle(42));
    const b = createBattle(presetBattle(42));
    while (!a.result) {
      stepBattle(a);
      stepBattle(b);
      expect(b.units).toEqual(a.units);
    }
    expect(b).toEqual(a);
    expect(JSON.stringify(b.events)).toBe(JSON.stringify(a.events));
  });

  it('gives different battles for different seeds', () => {
    const logs = new Set([1, 2, 3, 4].map((seed) => JSON.stringify(runBattle(presetBattle(seed)).events)));
    expect(logs.size).toBe(4);
  });

  it('continues identically from a copy of the state taken mid-battle', () => {
    const original = createBattle(presetBattle(7));
    for (let i = 0; i < 700; i++) stepBattle(original);
    const copy = structuredClone(original);
    while (!original.result) {
      stepBattle(original);
      stepBattle(copy);
    }
    expect(copy).toEqual(original);
  });

  it('runs a full battle in the terminal with a winner and a log', () => {
    const state = runBattle(presetBattle(42));
    expect(state.result).not.toBeNull();
    expect(state.events.some((e) => e.type === 'death')).toBe(true);
    expect(state.events.some((e) => e.type === 'skill')).toBe(true);
    expect(state.events.at(-1)?.type).toBe('end');
  });
});

/** 60 full battles take about 2 s here and 3 s on the Windows runner, more when it is busy: give them room. */
const MANY_BATTLES_MS = 30_000;

describe('fairness', () => {
  it("doesn't favor either side in a mirror match", () => {
    const wins = { player: 0, enemy: 0, draw: 0 };
    for (let seed = 0; seed < 60; seed++) wins[runBattle(presetBattle(seed)).result!.winner] += 1;
    expect(wins.player).toBeLessThanOrEqual(39);
    expect(wins.enemy).toBeLessThanOrEqual(39);
  }, MANY_BATTLES_MS);

  it('is an exact mirror when there is no randomness left to break the tie', () => {
    // With equal first-attack timers and no damage spread, mirrored armies must stay mirrored.
    const state = createBattle(presetBattle(1));
    for (let k = 0; k < 5; k++) state.units[2 * k + 1]!.attackCooldown = state.units[2 * k]!.attackCooldown;
    const spread = BATTLE_RULES.damageVariance;
    try {
      (BATTLE_RULES as { damageVariance: number }).damageVariance = 0;
      for (let i = 0; i < 200; i++) stepBattle(state);
    } finally {
      (BATTLE_RULES as { damageVariance: number }).damageVariance = spread;
    }
    for (let k = 0; k < 5; k++) {
      const p = state.units[2 * k]!;
      const e = state.units[2 * k + 1]!;
      expect(p.hp).toBe(e.hp);
      expect(p.x).toBeCloseTo(OPEN_FIELD.width - e.x, 3);
      expect(p.y).toBeCloseTo(e.y, 3);
    }
  });
});

describe('replays', () => {
  const healer: Card = {
    condition: null,
    steps: [{ action: 'focus', actors: { kind: 'class', cls: 'ranger' }, target: { kind: 'class', cls: 'guardian' } }],
    auto: false,
  };
  const saveRanger: Card = {
    condition: { triggers: [{ kind: 'allyBelowHp', ally: 'ranger', hpPercent: 60 }], repeat: true },
    steps: [{ action: 'protect', actors: { kind: 'class', cls: 'vanguard' }, target: { kind: 'trigger' } }],
    auto: true,
  };
  const feint: Card = {
    condition: null,
    steps: [
      { action: 'fallBack', actors: { kind: 'all' }, to: null },
      { action: 'focus', actors: { kind: 'all' }, target: { kind: 'nearest' } },
    ],
    auto: false,
  };
  const reserve: Card = { condition: null, steps: [{ action: 'callReserve', reserve: null }], auto: false };

  const setup: BattleSetup = {
    ...presetBattle(9),
    loadout: { slots: [healer, saveRanger, feint, reserve], legendary: null },
    rank: 5,
    reserves: { player: [...STARTER_RESERVES], enemy: [] },
  };
  const presses: BattleInput[] = [
    { tick: 100, kind: 'slot', slot: 0 },
    { tick: 300, kind: 'slot', slot: 3 },
    { tick: 640, kind: 'slot', slot: 2 },
    { tick: 900, kind: 'slot', slot: 0 },
    { tick: 1200, kind: 'slot', slot: 3 },
    { tick: 1550, kind: 'ultimate' },
    { tick: 1700, kind: 'ultimate' },
  ];

  it('replays the same battle from its seed and input log, cards and all', () => {
    const original = runBattle(setup, presses);
    // Presses after the battle ended were never applied, so they are not in the log.
    expect(original.inputLog).toEqual(presses.filter((p) => p.tick < original.result!.durationTicks));
    expect(original.inputLog.length).toBeGreaterThanOrEqual(5);
    expect(original.events.filter((e) => e.type === 'cardFired').length).toBeGreaterThanOrEqual(4);
    expect(original.events.some((e) => e.type === 'reserveCalled')).toBe(true);
    const replay = runBattle(setup, original.inputLog);
    expect(replay).toEqual(original);
  });

  it('plays out differently when the inputs differ', () => {
    const without = runBattle(setup);
    const withCards = runBattle(setup, presses);
    expect(JSON.stringify(without.events)).not.toBe(JSON.stringify(withCards.events));
  });
});
