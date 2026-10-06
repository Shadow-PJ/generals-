// Talking to the multiplayer relay (session 6D). Both builds use the WebSocket built into the
// browser and into the desktop app's Chromium, so they share this one network; it sits in the
// platform layer because game code never opens a connection itself, and a store build could
// swap in its own (Steam's networking) without touching the game.

/** An open connection to the relay: text in, text out. */
export interface Connection {
  send(text: string): void;
  close(): void;
}

/** What a connection tells the game. */
export interface ConnectionEvents {
  message(text: string): void;
  /** The connection is gone: closed by either end, or lost. */
  closed(): void;
}

export interface Network {
  /** The relay this build was made for (VITE_RELAY_URL), or one on this computer. */
  readonly defaultRelay: string;
  /** Connects to a relay; rejects when it can't be reached within `timeoutMs`. */
  connect(url: string, events: ConnectionEvents, timeoutMs?: number): Promise<Connection>;
}

/** The relay a development build looks for: `npm run relay` on this computer. */
export const LOCAL_RELAY = 'ws://localhost:8787';

/** True for an address the game can try: ws:// or wss://, not too long. */
export function isRelayAddress(text: string): boolean {
  return /^wss?:\/\/[^\s]+$/.test(text) && text.length <= 200;
}

/** The relay a build points at: its VITE_RELAY_URL if that is a usable address, else the local one. */
export function buildRelay(configured: string | undefined): string {
  return configured && isRelayAddress(configured) ? configured : LOCAL_RELAY;
}

/** A network through the WebSocket of the page. */
export function webSocketNetwork(defaultRelay: string, create: (url: string) => WebSocket = (url) => new WebSocket(url)): Network {
  return {
    defaultRelay,
    connect(url, events, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        let socket: WebSocket;
        try {
          socket = create(url);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        let open = false;
        const timer = setTimeout(() => {
          if (open) return;
          socket.close();
          reject(new Error('timeout'));
        }, timeoutMs);
        socket.addEventListener('open', () => {
          open = true;
          clearTimeout(timer);
          resolve({ send: (text) => socket.readyState === WebSocket.OPEN && socket.send(text), close: () => socket.close() });
        });
        socket.addEventListener('message', (event) => {
          if (typeof event.data === 'string') events.message(event.data);
        });
        // Some WebSockets (Node's) report a failed connection only as an error, without a close.
        let gone = false;
        const lost = () => {
          if (gone) return;
          gone = true;
          clearTimeout(timer);
          if (open) events.closed();
          else reject(new Error('unreachable'));
        };
        socket.addEventListener('error', () => {
          if (!open) lost();
        });
        socket.addEventListener('close', lost);
      });
    },
  };
}
