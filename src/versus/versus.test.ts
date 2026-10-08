import { describe, expect, it } from 'vitest';
import type { Card } from '../cards/types';
import { STARTER_ARMY, STARTER_RESERVES } from '../data/armies';
import { MAPS } from '../data/maps';
import { createBattle, stateHash, stepBattle, type BattleState } from '../sim';
import { armyProblems, mirrored, versusBattle } from './army';
import { HASH_EVERY_TICKS, INPUT_DELAY_TICKS, Lockstep, type TickBatch } from './lockstep';
import { readMatchMessage, type MatchRules, type VersusArmy } from './messages';

const hold: Card = { condition: null, steps: [{ action: 'hold', actors: { kind: 'all' } }], auto: false };
const rules: MatchRules = { map: 'openField', rank: 3 };

function army(overrides: Partial<VersusArmy> = {}): VersusArmy {
  return {
    general: 'captain',
    placement: STARTER_ARMY.map((t) => ({ ...t })),
    reserves: [...STARTER_RESERVES],
    specs: { vanguard: 'breaker' },
    loadout: { slots: [hold, null], legendary: null },
    learned: [],
    ...overrides,
  };
}

describe('match messages', () => {
  it('read what the other game sends, and nothing else', () => {
    expect(readMatchMessage({ kind: 'hello', protocol: 1 })).toEqual({ kind: 'hello', protocol: 1 });
    expect(readMatchMessage({ kind: 'inputs', round: 1, tick: 9, presses: [{ kind: 'slot', slot: 2 }, { kind: 'ultimate' }] })).toEqual({
      kind: 'inputs',
      round: 1,
      tick: 9,
      presses: [{ kind: 'slot', slot: 2 }, { kind: 'ultimate' }],
    });
    for (const bad of [null, 'hi', { kind: 'nope' }, { kind: 'inputs', round: 1, tick: -1, presses: [] }, { kind: 'inputs', round: 1, tick: 2, presses: [{ kind: 'slot', slot: 9 }] }, { kind: 'hash', round: 1, tick: 2, hash: 'x' }]) {
      expect(readMatchMessage(bad)).toBeNull();
    }
  });
});

describe('checking the other army', () => {
  it('lets a fair army play', () => {
    expect(armyProblems(army(), rules)).toEqual([]);
  });

  it('stops troops out of place, too many troops, unknown Generals and cards the rank does not allow', () => {
    const outside = army({ placement: STARTER_ARMY.map((t, i) => (i === 0 ? { ...t, x: 700 } : { ...t })) });
    expect(armyProblems(outside, rules)).toEqual(['A troop stands outside their deploy zone.']);
    expect(armyProblems(army({ placement: [...STARTER_ARMY, STARTER_ARMY[0]!] }), rules)).toEqual(['They must field 5 troops.']);
    expect(armyProblems(army({ general: 'nobody' as never }), rules)).toEqual(['Their General is unknown.']);
    const auto: Card = { ...hold, auto: true };
    expect(armyProblems(army({ loadout: { slots: [auto], legendary: null } }), rules)[0]).toMatch(/^Their card 1 /);
    expect(armyProblems(army({ loadout: { slots: ['junk' as never], legendary: null } }), rules)).toEqual(['Their card 1 is not a card.']);
    const fortify: Card = { condition: null, steps: [{ action: 'fortify', at: { kind: 'forward' } }], auto: false };
    expect(armyProblems(army({ loadout: { slots: [], legendary: fortify } }), rules)).toHaveLength(1);
    expect(armyProblems(army({ loadout: { slots: [], legendary: fortify }, learned: ['fortify'] }), { ...rules, rank: 5 })).toEqual([]);
  });

  it('speaks to you about your own army', () => {
    const auto: Card = { ...hold, auto: true };
    expect(armyProblems(army({ loadout: { slots: [auto], legendary: null } }), rules, 'yours')[0]).toMatch(/^Your card 1 /);
    expect(armyProblems(army({ placement: [] }), rules, 'yours')).toEqual(['You must field 5 troops.']);
    const outside = army({ placement: STARTER_ARMY.map((t, i) => (i === 0 ? { ...t, x: 700 } : { ...t })) });
    expect(armyProblems(outside, rules, 'yours')).toEqual(['A troop stands outside your deploy zone.']);
  });
});

describe('the versus battle', () => {
  it('puts the host on the left and the guest, mirrored, on the right, commanding by hand', () => {
    const state = createBattle(versusBattle(rules, 5, army(), army({ general: 'warlord' })));
    const enemies = state.units.filter((u) => u.side === 'enemy');
    expect(enemies.map((u) => u.x)).toEqual(mirrored(STARTER_ARMY, MAPS.openField.width).map((t) => t.x));
    expect(state.enemyCommand?.human).toBe(true);
    expect(state.generals).toEqual({ player: 'captain', enemy: 'warlord' });
    expect(state.enemyCommand!.slots[0]!.card).not.toBeNull();
  });

  it('keeps no typed words in either side’s cards, even from a game that sent them', () => {
    const worded = army({ loadout: { slots: [{ ...hold, text: 'everyone hold, my secret plan' }, null], legendary: null } });
    const setup = versusBattle(rules, 5, worded, worded);
    expect(JSON.stringify(setup)).not.toContain('secret plan');
    expect(setup.loadout?.slots[0]).toEqual(hold);
    const state = createBattle(setup);
    expect(stateHash(state)).toBe(stateHash(createBattle(versusBattle(rules, 5, army(), army()))));
  });
});

/** A game in a lockstep match: its battle, its lockstep and what it saw. */
interface Game {
  state: BattleState;
  lockstep: Lockstep;
  outbox: { arrives: number; send: () => void }[];
  checks: string[];
}

describe('lockstep', () => {
  it('keeps two games in the same battle over a slow, uneven connection, with both players pressing keys', () => {
    const LAST_TICK = 900;
    const setup = versusBattle(rules, 11, army(), army({ general: 'warlord' }));
    const games: Record<'host' | 'guest', Game> = {
      host: { state: createBattle(setup), lockstep: new Lockstep('player'), outbox: [], checks: [] },
      guest: { state: createBattle(setup), lockstep: new Lockstep('enemy'), outbox: [], checks: [] },
    };
    // Each frame (50 ms) a game runs the ticks it can; messages take 1 to 6 frames, by a fixed pattern.
    const lag = (n: number) => 1 + ((n * 7919) % 6);
    let sent = 0;
    const presses: Record<'host' | 'guest', Record<number, () => void>> = {
      host: { 30: () => games.host.lockstep.press({ kind: 'slot', slot: 0 }) },
      guest: { 45: () => games.guest.lockstep.press({ kind: 'slot', slot: 0 }), 46: () => games.guest.lockstep.press({ kind: 'ultimate' }) },
    };
    for (let frame = 0; frame < 2000; frame++) {
      for (const name of ['host', 'guest'] as const) {
        const game = games[name];
        const other = games[name === 'host' ? 'guest' : 'host'];
        presses[name][frame]?.();
        // Deliver what has arrived.
        game.outbox = game.outbox.filter((m) => (m.arrives <= frame ? (m.send(), false) : true));
        // Run up to two ticks: settle and send our presses, then step if both sides' are in.
        for (let i = 0; i < 2 && !game.state.result && game.state.tick < LAST_TICK; i++) {
          const batch: TickBatch | null = game.lockstep.batchFor(game.state.tick);
          if (batch) other.outbox.push({ arrives: frame + lag(sent++), send: () => other.lockstep.receive(batch) });
          if (!game.lockstep.canRun(game.state.tick)) break;
          stepBattle(game.state, game.lockstep.inputsFor(game.state.tick));
          if (game.state.tick % HASH_EVERY_TICKS === 0) {
            const tick = game.state.tick;
            const hash = stateHash(game.state);
            game.checks.push(game.lockstep.ownHash(tick, hash));
            other.outbox.push({ arrives: frame + lag(sent++), send: () => other.checks.push(other.lockstep.otherHash(tick, hash)) });
          }
        }
      }
      const done = (g: Game) => g.state.result !== null || g.state.tick >= LAST_TICK;
      if (done(games.host) && done(games.guest) && games.host.outbox.length + games.guest.outbox.length === 0) break;
    }
    const { host, guest } = games;
    expect(guest.state.tick).toBe(host.state.tick);
    expect(host.state.tick).toBeGreaterThan(600);
    expect(guest.state.result).toEqual(host.state.result);
    expect(stateHash(guest.state)).toBe(stateHash(host.state));
    expect(guest.state.inputLog).toEqual(host.state.inputLog);
    // Both players' presses reached the battle, each on its own side, a delay after they were made.
    const fired = host.state.events.filter((e) => e.type === 'cardFired').map((e) => e.side);
    expect(fired).toEqual(expect.arrayContaining(['player', 'enemy']));
    expect(host.state.inputLog.every((i) => i.tick >= INPUT_DELAY_TICKS)).toBe(true);
    // Every fingerprint compared agreed.
    expect([...host.checks, ...guest.checks].filter((c) => c !== 'pending').length).toBeGreaterThan(4);
    expect([...host.checks, ...guest.checks]).not.toContain('desync');
  });

  it('notices when the two battles differ', () => {
    const setup = versusBattle(rules, 2, army(), army());
    const a = createBattle(setup);
    const b = createBattle(setup);
    for (let t = 0; t < 20; t++) {
      stepBattle(a);
      stepBattle(b);
    }
    b.units[0]!.hp -= 1;
    const lockstep = new Lockstep('player');
    expect(lockstep.ownHash(20, stateHash(a))).toBe('pending');
    expect(lockstep.otherHash(20, stateHash(b))).toBe('desync');
    expect(lockstep.isDesynced).toBe(true);
  });

  it('waits rather than run a tick before the other side’s presses for it arrive', () => {
    const lockstep = new Lockstep('enemy');
    for (let t = 0; t < INPUT_DELAY_TICKS; t++) expect(lockstep.canRun(t)).toBe(true);
    expect(lockstep.batchFor(0)).toEqual({ tick: INPUT_DELAY_TICKS, presses: [] });
    expect(lockstep.batchFor(0)).toBeNull();
    expect(lockstep.canRun(INPUT_DELAY_TICKS)).toBe(false);
    lockstep.receive({ tick: INPUT_DELAY_TICKS, presses: [{ kind: 'ultimate' }] });
    expect(lockstep.canRun(INPUT_DELAY_TICKS)).toBe(true);
    // The other player is the player's side: theirs come first.
    lockstep.press({ kind: 'slot', slot: 1 });
    expect(lockstep.inputsFor(INPUT_DELAY_TICKS)).toEqual([{ tick: INPUT_DELAY_TICKS, kind: 'ultimate', side: 'player' }]);
  });
});
