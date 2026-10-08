import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isRoomCode, normalizeCode, RELAY_LIMITS, type ClientMessage, type RelayMessage } from './protocol.js';
import { startRelay, type Relay } from './relay.js';

/** A test player: Node's own WebSocket client, with the relay's messages queued as they come. */
interface TestClient {
  send(message: ClientMessage | string): void;
  next(): Promise<RelayMessage>;
  closed: Promise<number>;
  close(): void;
}

function connect(port: number): Promise<TestClient> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const queue: RelayMessage[] = [];
  const waiting: ((m: RelayMessage) => void)[] = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as RelayMessage;
    const waiter = waiting.shift();
    if (waiter) waiter(message);
    else queue.push(message);
  });
  const closed = new Promise<number>((resolve) => socket.addEventListener('close', (event) => resolve(event.code)));
  return new Promise((resolve, reject) => {
    socket.addEventListener('error', reject);
    socket.addEventListener('open', () =>
      resolve({
        send: (message) => socket.send(typeof message === 'string' ? message : JSON.stringify(message)),
        next: () => (queue.length > 0 ? Promise.resolve(queue.shift()!) : new Promise((r) => waiting.push(r))),
        closed,
        close: () => socket.close(),
      }),
    );
  });
}

let relay: Relay;
const clients: TestClient[] = [];
async function player(): Promise<TestClient> {
  const client = await connect(relay.port);
  clients.push(client);
  return client;
}

beforeEach(async () => {
  relay = await startRelay({ port: 0, host: '127.0.0.1', log: () => undefined });
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await relay.close();
});

describe('room codes', () => {
  it('are four clear characters, read the way a player types them', () => {
    expect(normalizeCode(' kx7p ')).toBe('KX7P');
    expect(normalizeCode('kx-7p')).toBe('KX7P');
    expect(isRoomCode('KX7P')).toBe(true);
    expect(isRoomCode('KX70')).toBe(false);
    expect(isRoomCode('KX7')).toBe(false);
  });
});

describe('the relay', () => {
  it('gives a host a room code, lets a friend join with it, and passes messages both ways', async () => {
    const host = await player();
    host.send({ type: 'host' });
    const room = await host.next();
    expect(room.type).toBe('room');
    const code = (room as { code: string }).code;
    expect(isRoomCode(code)).toBe(true);

    const guest = await player();
    guest.send({ type: 'join', code: code.toLowerCase() });
    expect(await guest.next()).toEqual({ type: 'joined', code });
    expect(await host.next()).toEqual({ type: 'peer' });

    host.send({ type: 'relay', data: { hello: 'guest', tick: 4 } });
    expect(await guest.next()).toEqual({ type: 'relay', data: { hello: 'guest', tick: 4 } });
    guest.send({ type: 'relay', data: [1, 2, 3] });
    expect(await host.next()).toEqual({ type: 'relay', data: [1, 2, 3] });
    expect(relay.rooms()).toBe(1);
  });

  it('turns away a wrong code, a third player and messages sent outside a room', async () => {
    const lost = await player();
    lost.send({ type: 'join', code: 'ZZZZ' });
    expect(await lost.next()).toEqual({ type: 'error', reason: 'noRoom' });
    lost.send({ type: 'relay', data: 1 });
    expect(await lost.next()).toEqual({ type: 'error', reason: 'notInRoom' });
    lost.send('not json');
    expect(await lost.next()).toEqual({ type: 'error', reason: 'badMessage' });

    const host = await player();
    host.send({ type: 'host' });
    const { code } = (await host.next()) as { code: string };
    const guest = await player();
    guest.send({ type: 'join', code });
    await guest.next();
    const third = await player();
    third.send({ type: 'join', code });
    expect(await third.next()).toEqual({ type: 'error', reason: 'full' });
  });

  it('tells a player when the other leaves, and closes the room', async () => {
    const host = await player();
    host.send({ type: 'host' });
    const { code } = (await host.next()) as { code: string };
    const guest = await player();
    guest.send({ type: 'join', code });
    await guest.next();
    await host.next();
    guest.close();
    expect(await host.next()).toEqual({ type: 'peerLeft' });
    expect(relay.rooms()).toBe(0);
  });

  it('cuts off a player who floods it with messages', async () => {
    const flood = await player();
    for (let i = 0; i < RELAY_LIMITS.messageBurst + 20; i++) flood.send({ type: 'relay', data: i });
    expect(await flood.closed).toBe(1008);
  });

  it('answers a health check over plain HTTP', async () => {
    const response = await fetch(`http://127.0.0.1:${relay.port}/health`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});
