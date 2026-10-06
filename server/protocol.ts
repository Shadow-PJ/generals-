// What the relay server and the game say to each other (session 6D). The relay knows only rooms:
// a player hosts one and gets a code, a friend joins with the code, and from then on the relay
// passes whatever one sends on to the other. It never looks inside: the game's own messages
// (armies, cards, key presses by tick) ride in `data`. The game imports this file too, so both
// sides agree on it.

/** Room codes: letters and digits that can't be mistaken for each other (no O/0, I/1). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export const RELAY_LIMITS = {
  /** The biggest message the relay passes on, in bytes. An army with its cards is a few kilobytes. */
  maxMessageBytes: 32 * 1024,
  /** Messages a player may send: a burst of this many, refilled at `messagesPerSecond`. A battle sends about 21 a second. */
  messageBurst: 120,
  messagesPerSecond: 60,
  /** Rooms open at once, and how long a room may wait for its guest, in milliseconds. */
  maxRooms: 5000,
  waitForGuestMs: 30 * 60 * 1000,
  /** How often the relay checks that each player is still there, in milliseconds. */
  heartbeatMs: 20 * 1000,
} as const;

/** The default port the relay listens on. */
export const RELAY_PORT = 8787;

/** What a player sends the relay. */
export type ClientMessage = { type: 'host' } | { type: 'join'; code: string } | { type: 'relay'; data: unknown };

/** Why the relay refused something. */
export type RelayError = 'noRoom' | 'full' | 'badMessage' | 'tooFast' | 'serverFull' | 'notInRoom';

/** What the relay sends a player. */
export type RelayMessage =
  /** You host a room: give your friend this code. */
  | { type: 'room'; code: string }
  /** You joined the room with this code. */
  | { type: 'joined'; code: string }
  /** To the host: a friend joined your room. */
  | { type: 'peer' }
  /** A message from the other player. */
  | { type: 'relay'; data: unknown }
  /** The other player left; the room is closed. */
  | { type: 'peerLeft' }
  | { type: 'error'; reason: RelayError };

/** A code as typed: upper case, letters and digits only. */
export function normalizeCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** True if a text is shaped like a room code. */
export function isRoomCode(text: string): boolean {
  return text.length === CODE_LENGTH && [...text].every((c) => CODE_ALPHABET.includes(c));
}
