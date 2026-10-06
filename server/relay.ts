// The multiplayer relay (session 6D): a small Node server that pairs two players by a room code
// and passes their messages between them over WebSockets. Both computers run the same battle
// (lockstep), so all the relay carries is each player's army and cards before the battle and
// their key presses during it; it never runs a battle and never looks inside a message.
//
// `npm run relay` starts it on port 8787 (or PORT). GET /health answers "ok", for hosting
// platforms that check the server is up. server/README.md says how to host it.

import { randomInt } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  isRoomCode,
  normalizeCode,
  RELAY_LIMITS,
  RELAY_PORT,
  type ClientMessage,
  type RelayError,
  type RelayMessage,
} from './protocol.js';

interface Room {
  code: string;
  host: Player;
  guest: Player | null;
  /** When the host made it, for rooms nobody joins. */
  openedAt: number;
}

interface Player {
  socket: WebSocket;
  room: Room | null;
  /** Messages it may still send now: the burst left, refilling with time. */
  allowance: number;
  lastRefill: number;
  /** It answered the last heartbeat. */
  alive: boolean;
}

export interface Relay {
  /** The port it listens on (useful when started on port 0, a free one). */
  port: number;
  /** Rooms open now. */
  rooms(): number;
  close(): Promise<void>;
}

export interface RelayOptions {
  port?: number;
  host?: string;
  log?: (line: string) => void;
  /** The current time in milliseconds; tests pass their own. */
  now?: () => number;
}

/** Starts the relay and resolves once it is listening. */
export function startRelay(options: RelayOptions = {}): Promise<Relay> {
  const log = options.log ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => Date.now());
  const rooms = new Map<string, Room>();
  const players = new Set<Player>();

  const http: Server = createServer((request, response) => {
    if (request.method === 'GET' && (request.url === '/health' || request.url === '/')) {
      response.writeHead(200, { 'Content-Type': 'text/plain' }).end(request.url === '/health' ? 'ok' : 'Generals relay');
      return;
    }
    response.writeHead(404).end();
  });
  const wss = new WebSocketServer({ server: http, maxPayload: RELAY_LIMITS.maxMessageBytes });

  const send = (player: Player, message: RelayMessage) => {
    if (player.socket.readyState === WebSocket.OPEN) player.socket.send(JSON.stringify(message));
  };
  const refuse = (player: Player, reason: RelayError) => send(player, { type: 'error', reason });

  const newCode = (): string | null => {
    for (let tries = 0; tries < 50; tries++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!rooms.has(code)) return code;
    }
    return null;
  };

  /** The player leaves its room: the other one is told, and the room closes. */
  const leave = (player: Player) => {
    const room = player.room;
    if (!room) return;
    rooms.delete(room.code);
    for (const member of [room.host, room.guest]) {
      if (!member) continue;
      member.room = null;
      if (member !== player) send(member, { type: 'peerLeft' });
    }
  };

  /** A message counts against the player's allowance; false once it is spent. */
  const allowed = (player: Player): boolean => {
    const t = now();
    player.allowance = Math.min(
      RELAY_LIMITS.messageBurst,
      player.allowance + ((t - player.lastRefill) / 1000) * RELAY_LIMITS.messagesPerSecond,
    );
    player.lastRefill = t;
    if (player.allowance < 1) return false;
    player.allowance -= 1;
    return true;
  };

  const handle = (player: Player, message: ClientMessage) => {
    switch (message.type) {
      case 'host': {
        leave(player);
        if (rooms.size >= RELAY_LIMITS.maxRooms) return refuse(player, 'serverFull');
        const code = newCode();
        if (!code) return refuse(player, 'serverFull');
        const room: Room = { code, host: player, guest: null, openedAt: now() };
        rooms.set(code, room);
        player.room = room;
        send(player, { type: 'room', code });
        return;
      }
      case 'join': {
        const code = normalizeCode(String(message.code ?? ''));
        const room = isRoomCode(code) ? rooms.get(code) : undefined;
        if (!room) return refuse(player, 'noRoom');
        if (room.guest || room.host === player) return refuse(player, 'full');
        leave(player);
        room.guest = player;
        player.room = room;
        send(player, { type: 'joined', code });
        send(room.host, { type: 'peer' });
        return;
      }
      case 'relay': {
        const room = player.room;
        const other = room ? (room.host === player ? room.guest : room.host) : null;
        if (!other) return refuse(player, 'notInRoom');
        send(other, { type: 'relay', data: message.data });
        return;
      }
      default:
        refuse(player, 'badMessage');
    }
  };

  wss.on('connection', (socket) => {
    const player: Player = { socket, room: null, allowance: RELAY_LIMITS.messageBurst, lastRefill: now(), alive: true };
    players.add(player);
    socket.on('pong', () => {
      player.alive = true;
    });
    socket.on('message', (raw, isBinary) => {
      if (!allowed(player)) {
        refuse(player, 'tooFast');
        socket.close(1008, 'too many messages');
        return;
      }
      let message: ClientMessage;
      try {
        message = JSON.parse(isBinary ? '' : raw.toString()) as ClientMessage;
      } catch {
        refuse(player, 'badMessage');
        return;
      }
      if (typeof message !== 'object' || message === null) refuse(player, 'badMessage');
      else handle(player, message);
    });
    socket.on('close', () => {
      leave(player);
      players.delete(player);
    });
    socket.on('error', () => socket.terminate());
  });

  // Every so often: drop players who stopped answering, and rooms nobody joined in time.
  const heartbeat = setInterval(() => {
    for (const player of players) {
      if (!player.alive) {
        player.socket.terminate();
        continue;
      }
      player.alive = false;
      player.socket.ping();
    }
    for (const room of [...rooms.values()]) {
      if (!room.guest && now() - room.openedAt > RELAY_LIMITS.waitForGuestMs) {
        leave(room.host);
        room.host.socket.close(1000, 'nobody joined');
      }
    }
  }, RELAY_LIMITS.heartbeatMs);

  return new Promise((resolve) => {
    http.listen(options.port ?? RELAY_PORT, options.host ?? '0.0.0.0', () => {
      const address = http.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? RELAY_PORT);
      log(`Generals relay listening on port ${port}`);
      resolve({
        port,
        rooms: () => rooms.size,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(heartbeat);
            for (const player of players) player.socket.terminate();
            wss.close();
            http.close(() => done());
          }),
      });
    });
  });
}

// Run directly (npm run relay, or node server/build/relay.js): listen on PORT.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startRelay({ port: Number(process.env.PORT) || RELAY_PORT });
}
