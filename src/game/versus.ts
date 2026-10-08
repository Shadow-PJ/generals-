// A versus match against a friend (session 6D), from the lobby to the last battle. It holds the
// connection to the relay through the platform's network and follows the match: the host gets a
// room code, the guest joins with it, the host sets the rules (map and rank) and starts; each
// player sets up an army, and when both are ready each checks the other's against the rules
// before the battle starts. During the battle the screen runs the lockstep (src/versus) and this
// carries its messages. It lives across screens, like the session, and screens listen to it.

import { CODE_LENGTH, normalizeCode, type ClientMessage, type RelayMessage } from '../../server/protocol';
import type { BattleSetup } from '../sim';
import { armyProblems, rulesProblem, versusBattle } from '../versus/army';
import { HASH_EVERY_TICKS, Lockstep, type TickBatch } from '../versus/lockstep';
import { readMatchMessage, VERSUS_PROTOCOL, type MatchMessage, type MatchRules, type VersusArmy, type VersusPress } from '../versus/messages';
import type { Connection, Network } from '../platform';
import { newSeed } from './seed';

export type VersusRole = 'host' | 'guest';

/** What the screens hear from the match. */
export type VersusEvent =
  | { kind: 'room'; code: string }
  | { kind: 'paired' }
  | { kind: 'rules'; rules: MatchRules }
  | { kind: 'begin'; rules: MatchRules }
  /** The other player sent their army and is waiting for you. */
  | { kind: 'otherReady' }
  /** Both armies passed: fight. */
  | { kind: 'start'; setup: BattleSetup }
  /** An army failed the other's check: back to the cards. `yours` says whose. */
  | { kind: 'refused'; problems: string[]; yours: boolean }
  | { kind: 'desync' }
  /** The other player left, or the connection was lost. */
  | { kind: 'gone'; why: 'left' | 'lost' }
  | { kind: 'error'; text: string };

/** Where the match is. */
export type VersusPhase = 'connecting' | 'waiting' | 'lobby' | 'setup' | 'ready' | 'battle' | 'over' | 'closed';

const ERRORS: Readonly<Record<string, string>> = {
  noRoom: 'No match has that code. Check it with your friend.',
  full: 'That match already has two players.',
  serverFull: 'The server is full. Try again in a while.',
  tooFast: 'The connection sent too much and was cut off.',
};

/** What the screens say when the match ends early. */
export const GONE_TEXT: Readonly<Record<'left' | 'lost', string>> = {
  left: 'Your opponent left the match.',
  lost: 'The connection to your opponent was lost.',
};

export class VersusMatch {
  role: VersusRole;
  phase: VersusPhase = 'connecting';
  code = '';
  rules: MatchRules;
  /** Battles fought so far count rounds; messages for another round are stale and ignored. */
  round = 1;
  lockstep: Lockstep | null = null;
  private connection: Connection | null = null;
  private readonly listeners = new Set<(event: VersusEvent) => void>();
  private ownArmy: VersusArmy | null = null;
  private otherArmy: VersusArmy | null = null;
  private seed: number | null = null;
  /** The problems each side found: with the other's army (ours), and with ours (theirs); null until known. */
  private ourVerdict: string[] | null = null;
  private theirVerdict: string[] | null = null;
  /** The other's army for the next round, come before this game finished the battle. */
  private early: Extract<MatchMessage, { kind: 'army' }> | null = null;

  constructor(role: VersusRole, rules: MatchRules) {
    this.role = role;
    this.rules = rules;
  }

  /** Listens until the returned function is called (a screen does so when it closes). */
  listen(listener: (event: VersusEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: VersusEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  /** Connects to the relay and hosts a room, or joins one by its code. */
  async open(network: Network, relayUrl: string, code?: string): Promise<void> {
    try {
      this.connection = await network.connect(relayUrl, {
        message: (text) => this.onRelay(text),
        closed: () => this.onClosed(),
      });
    } catch {
      this.phase = 'closed';
      this.emit({ kind: 'error', text: `Can't reach the server at ${relayUrl}.` });
      return;
    }
    this.relay(code === undefined ? { type: 'host' } : { type: 'join', code: normalizeCode(code).slice(0, CODE_LENGTH) });
  }

  private relay(message: ClientMessage): void {
    this.connection?.send(JSON.stringify(message));
  }

  private send(message: MatchMessage): void {
    this.relay({ type: 'relay', data: message });
  }

  private onRelay(text: string): void {
    let message: RelayMessage;
    try {
      message = JSON.parse(text) as RelayMessage;
    } catch {
      return;
    }
    switch (message.type) {
      case 'room':
        this.code = message.code;
        this.phase = 'waiting';
        this.emit({ kind: 'room', code: message.code });
        return;
      case 'joined':
        this.code = message.code;
        this.phase = 'lobby';
        this.send({ kind: 'hello', protocol: VERSUS_PROTOCOL });
        return;
      case 'peer':
        this.phase = 'lobby';
        this.send({ kind: 'hello', protocol: VERSUS_PROTOCOL });
        this.send({ kind: 'rules', rules: this.rules });
        this.emit({ kind: 'paired' });
        return;
      case 'peerLeft':
        this.end('left');
        return;
      case 'error':
        this.emit({ kind: 'error', text: ERRORS[message.reason] ?? 'The server turned that down.' });
        if (this.phase === 'connecting') this.close();
        return;
      case 'relay': {
        const match = readMatchMessage(message.data);
        if (match) this.onMatch(match);
        return;
      }
    }
  }

  private onMatch(message: MatchMessage): void {
    switch (message.kind) {
      case 'hello':
        if (message.protocol !== VERSUS_PROTOCOL) {
          this.emit({ kind: 'error', text: 'Your friend has a different version of the game. Both need the same one.' });
          this.leave();
        } else if (this.role === 'guest') this.emit({ kind: 'paired' });
        return;
      case 'rules':
      case 'begin':
        if (this.role !== 'guest' || rulesProblem(message.rules)) return;
        this.rules = message.rules;
        if (message.kind === 'begin') this.phase = 'setup';
        this.emit({ kind: message.kind, rules: message.rules });
        return;
      case 'army':
        // The other game may finish the battle and be ready again a moment before this one ends it.
        if (message.round === this.round + 1) this.early = message;
        if (message.round !== this.round || this.otherArmy) return;
        this.takeArmy(message.army, message.seed);
        return;
      case 'verdict':
        if (message.round !== this.round) return;
        this.theirVerdict = message.problems;
        this.settle();
        return;
      case 'inputs':
        if (message.round === this.round && this.lockstep) this.lockstep.receive({ tick: message.tick, presses: message.presses });
        return;
      case 'hash':
        if (message.round === this.round && this.lockstep?.otherHash(message.tick, message.hash) === 'desync') this.emit({ kind: 'desync' });
        return;
      case 'leave':
        this.end('left');
        return;
    }
  }

  /** Host: changes the rules in the lobby. */
  setRules(rules: MatchRules): void {
    if (this.role !== 'host') return;
    this.rules = rules;
    if (this.phase === 'lobby') this.send({ kind: 'rules', rules });
  }

  /** Host: on to setting up armies. */
  begin(): void {
    if (this.role !== 'host' || this.phase !== 'lobby') return;
    this.phase = 'setup';
    this.send({ kind: 'begin', rules: this.rules });
    this.emit({ kind: 'begin', rules: this.rules });
  }

  /** You are ready to fight with this army. The host picks the battle's seed. */
  ready(army: VersusArmy): void {
    if (this.phase !== 'setup') return;
    this.phase = 'ready';
    this.ownArmy = army;
    if (this.role === 'host') this.seed = newSeed();
    this.send({ kind: 'army', round: this.round, army, ...(this.role === 'host' ? { seed: this.seed! } : {}) });
    this.check();
  }

  private takeArmy(army: VersusArmy, seed: number | undefined): void {
    this.otherArmy = army;
    if (this.role === 'guest' && seed !== undefined) this.seed = seed;
    this.emit({ kind: 'otherReady' });
    this.check();
  }

  /** With both armies in, checks the other's and says what we found. */
  private check(): void {
    if (!this.ownArmy || !this.otherArmy || this.ourVerdict) return;
    this.ourVerdict = armyProblems(this.otherArmy, this.rules);
    this.send({ kind: 'verdict', round: this.round, problems: this.ourVerdict });
    this.settle();
  }

  /** With both verdicts in: the battle starts, or both go back to their cards. */
  private settle(): void {
    if (!this.ourVerdict || !this.theirVerdict || !this.ownArmy || !this.otherArmy || this.seed === null) return;
    if (this.ourVerdict.length > 0 || this.theirVerdict.length > 0) {
      const yours = this.theirVerdict.length > 0;
      const problems = yours ? this.theirVerdict : this.ourVerdict;
      this.nextRound();
      this.phase = 'setup';
      this.emit({ kind: 'refused', problems, yours });
      return;
    }
    const [host, guest] = this.role === 'host' ? [this.ownArmy, this.otherArmy] : [this.otherArmy, this.ownArmy];
    this.lockstep = new Lockstep(this.role === 'host' ? 'player' : 'enemy');
    this.phase = 'battle';
    this.emit({ kind: 'start', setup: versusBattle(this.rules, this.seed, host, guest) });
  }

  private nextRound(): void {
    this.round += 1;
    this.ownArmy = null;
    this.otherArmy = null;
    this.ourVerdict = null;
    this.theirVerdict = null;
    this.seed = null;
    const early = this.early;
    this.early = null;
    if (early?.round === this.round) this.takeArmy(early.army, early.seed);
  }

  /** A key pressed in battle. */
  press(press: VersusPress): void {
    if (this.phase === 'battle') this.lockstep?.press(press);
  }

  /** Sends our presses for a tick (from the lockstep's batchFor). */
  sendBatch(batch: TickBatch): void {
    this.send({ kind: 'inputs', round: this.round, tick: batch.tick, presses: batch.presses });
  }

  /** After a tick: on every check tick, sends our fingerprint and compares it. */
  afterTick(tick: number, hash: () => number): void {
    if (!this.lockstep || tick % HASH_EVERY_TICKS !== 0) return;
    const value = hash();
    this.send({ kind: 'hash', round: this.round, tick, hash: value });
    if (this.lockstep.ownHash(tick, value) === 'desync') this.emit({ kind: 'desync' });
  }

  /** The battle is over (both games end it on the same tick): ready for a rematch. */
  battleOver(): void {
    if (this.phase !== 'battle') return;
    this.phase = 'over';
    this.lockstep = null;
    this.nextRound();
  }

  /** A rematch: back to setting up armies under the same rules. */
  rematch(): void {
    if (this.phase === 'over') this.phase = 'setup';
  }

  /** Leaves the match: tells the other player, and hangs up. */
  leave(): void {
    if (this.phase === 'closed') return;
    this.send({ kind: 'leave' });
    this.close();
  }

  private end(why: 'left' | 'lost'): void {
    if (this.phase === 'closed') return;
    this.close();
    this.emit({ kind: 'gone', why });
  }

  private onClosed(): void {
    if (this.phase !== 'closed') this.end('lost');
  }

  private close(): void {
    this.phase = 'closed';
    this.lockstep = null;
    const connection = this.connection;
    this.connection = null;
    connection?.close();
  }
}

/** The match in progress, if any. */
let match: VersusMatch | null = null;

export function currentMatch(): VersusMatch | null {
  return match && match.phase !== 'closed' ? match : null;
}

/** Starts a match: hosting a room, or joining one by its code. */
export function startMatch(network: Network, relayUrl: string, role: VersusRole, rules: MatchRules, code?: string): VersusMatch {
  match?.leave();
  match = new VersusMatch(role, rules);
  void match.open(network, relayUrl, role === 'guest' ? code : undefined);
  return match;
}
