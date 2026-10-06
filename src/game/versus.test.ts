import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startRelay, type Relay } from '../../server/relay';
import type { Card } from '../cards/types';
import { STARTER_ARMY, STARTER_RESERVES } from '../data/armies';
import { webSocketNetwork } from '../platform/network';
import { createBattle, stateHash, stepBattle } from '../sim';
import type { VersusArmy } from '../versus/messages';
import { VersusMatch, type VersusEvent } from './versus';

// Falling back is unlocked from Rank I, so this card is fair at every rank.
const fallBack: Card = { condition: null, steps: [{ action: 'fallBack', actors: { kind: 'all' }, to: null }], auto: false };

function army(overrides: Partial<VersusArmy> = {}): VersusArmy {
  return {
    general: 'captain',
    placement: STARTER_ARMY.map((t) => ({ ...t })),
    reserves: [...STARTER_RESERVES],
    specs: {},
    loadout: { slots: [fallBack], legendary: null },
    learned: [],
    ...overrides,
  };
}

let relay: Relay;
const matches: VersusMatch[] = [];
/** The relay's clock: the tests run battles faster than real time, so it is moved by hand. */
let clock = 0;

beforeEach(async () => {
  relay = await startRelay({ port: 0, host: '127.0.0.1', log: () => undefined, now: () => clock });
});

afterEach(async () => {
  for (const m of matches.splice(0)) m.leave();
  await relay.close();
});

/** A match and every event it heard, with a way to wait for the next of a kind. */
function watch(match: VersusMatch) {
  const events: VersusEvent[] = [];
  match.listen((e) => events.push(e));
  matches.push(match);
  return {
    events,
    async next<K extends VersusEvent['kind']>(kind: K): Promise<Extract<VersusEvent, { kind: K }>> {
      for (let i = 0; i < 400; i++) {
        const found = events.find((e) => e.kind === kind);
        if (found) {
          events.splice(events.indexOf(found), 1);
          return found as Extract<VersusEvent, { kind: K }>;
        }
        await new Promise((r) => setTimeout(r, 5));
      }
      throw new Error(`no ${kind} event`);
    },
  };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('a versus match through the relay', () => {
  it('pairs two players by code, checks both armies, and keeps their battles in step', async () => {
    const network = webSocketNetwork(`ws://127.0.0.1:${relay.port}`);
    const url = `ws://127.0.0.1:${relay.port}`;
    const host = new VersusMatch('host', { map: 'openField', rank: 3 });
    const h = watch(host);
    await host.open(network, url);
    const { code } = await h.next('room');

    const guest = new VersusMatch('guest', { map: 'openField', rank: 1 });
    const g = watch(guest);
    await guest.open(network, url, code.toLowerCase());
    await h.next('paired');
    await g.next('paired');
    // The guest takes the host's rules, as they are and as they change.
    expect((await g.next('rules')).rules).toEqual({ map: 'openField', rank: 3 });
    host.setRules({ map: 'redCanyon', rank: 3 });
    expect((await g.next('rules')).rules).toEqual({ map: 'redCanyon', rank: 3 });
    host.begin();
    await g.next('begin');

    host.ready(army());
    guest.ready(army({ general: 'warlord' }));
    const hostStart = await h.next('start');
    const guestStart = await g.next('start');
    expect(guestStart.setup).toEqual(hostStart.setup);
    expect(hostStart.setup.map.id).toBe('redCanyon');

    // Play 200 ticks in lockstep through the relay, each pressing its first card once. Each
    // round is a tick's worth of time (50 ms) on the relay's clock, so its flood limit holds.
    const games = [
      { match: host, state: createBattle(hostStart.setup) },
      { match: guest, state: createBattle(guestStart.setup) },
    ];
    host.press({ kind: 'slot', slot: 0 });
    guest.press({ kind: 'slot', slot: 0 });
    for (let round = 0; round < 2000 && games.some((x) => x.state.tick < 200); round++) {
      for (const { match, state } of games) {
        if (state.tick >= 200) continue;
        const batch = match.lockstep!.batchFor(state.tick);
        if (batch) match.sendBatch(batch);
        if (match.lockstep!.canRun(state.tick)) {
          stepBattle(state, match.lockstep!.inputsFor(state.tick));
          match.afterTick(state.tick, () => stateHash(state));
        }
      }
      clock += 50;
      await pause(1);
    }
    const [a, b] = [games[0]!, games[1]!];
    expect(a.state.tick).toBe(200);
    expect(stateHash(b.state)).toBe(stateHash(a.state));
    expect(b.state.inputLog).toEqual(a.state.inputLog);
    expect(a.state.inputLog.map((i) => i.side)).toEqual(['player', 'enemy']);
    await pause(50);
    expect([...h.events, ...g.events].some((e) => e.kind === 'desync')).toBe(false);
  });

  it('refuses an army the rules don’t allow, and tells both players whose it was', async () => {
    const network = webSocketNetwork(`ws://127.0.0.1:${relay.port}`);
    const url = `ws://127.0.0.1:${relay.port}`;
    const host = new VersusMatch('host', { map: 'openField', rank: 1 });
    const h = watch(host);
    await host.open(network, url);
    const { code } = await h.next('room');
    const guest = new VersusMatch('guest', { map: 'openField', rank: 1 });
    const g = watch(guest);
    await guest.open(network, url, code);
    await h.next('paired');
    host.begin();
    await g.next('begin');
    // Auto cards aren't allowed at Rank I.
    host.ready(army());
    guest.ready(army({ loadout: { slots: [{ ...fallBack, auto: true }], legendary: null } }));
    const told = await g.next('refused');
    expect(told.yours).toBe(true);
    expect(told.problems[0]).toMatch(/^Their card 1 /);
    expect((await h.next('refused')).yours).toBe(false);
    // Both are back to setting up, and can try again.
    expect(host.phase).toBe('setup');
    expect(guest.phase).toBe('setup');
    host.ready(army());
    guest.ready(army());
    await h.next('start');
    await g.next('start');
  });

  it('tells a player when the other leaves', async () => {
    const network = webSocketNetwork(`ws://127.0.0.1:${relay.port}`);
    const url = `ws://127.0.0.1:${relay.port}`;
    const host = new VersusMatch('host', { map: 'openField', rank: 3 });
    const h = watch(host);
    await host.open(network, url);
    const { code } = await h.next('room');
    const guest = new VersusMatch('guest', { map: 'openField', rank: 3 });
    const g = watch(guest);
    await guest.open(network, url, code);
    await g.next('paired');
    guest.leave();
    expect(await h.next('gone')).toEqual({ kind: 'gone', why: 'left' });
    expect(host.phase).toBe('closed');
  });

  it('says so when the code is wrong or the server can’t be reached', async () => {
    const network = webSocketNetwork(`ws://127.0.0.1:${relay.port}`);
    const guest = new VersusMatch('guest', { map: 'openField', rank: 3 });
    const g = watch(guest);
    await guest.open(network, `ws://127.0.0.1:${relay.port}`, 'ZZZZ');
    expect((await g.next('error')).text).toMatch(/No match has that code/);
    const lost = new VersusMatch('host', { map: 'openField', rank: 3 });
    const l = watch(lost);
    await lost.open(network, 'ws://127.0.0.1:1');
    expect((await l.next('error')).text).toMatch(/Can't reach the server/);
  });
});
