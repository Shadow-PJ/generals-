// Lockstep (session 6D): both games run the same battle tick by tick, and the only thing that
// travels is each player's key presses. A press is scheduled a few ticks ahead (the input delay),
// and sent at once with every other press for that tick, even when there are none, so the other
// game knows that tick is settled. A game runs a tick only once it has both sides' presses for
// it; if the other's haven't arrived, it waits. Because the battle engine is deterministic, both
// then compute the same battle; fingerprints of it are compared every few seconds to be sure.
// Pure: the caller sends and receives the messages.

import { otherSide, type BattleInput, type Side } from '../sim';
import type { VersusPress } from './messages';

/** Ticks between a press and the tick it acts on: 150 ms at 20 ticks a second, room for the trip through the relay. */
export const INPUT_DELAY_TICKS = 3;
/** How often the games compare fingerprints, in ticks (3 s). */
export const HASH_EVERY_TICKS = 60;

/** A batch of presses for one tick, ready to send. */
export interface TickBatch {
  tick: number;
  presses: VersusPress[];
}

export type HashCheck = 'agree' | 'pending' | 'desync';

export class Lockstep {
  private readonly own: Side;
  private readonly delay: number;
  /** Presses made since the last batch went out. */
  private queued: VersusPress[] = [];
  private readonly local = new Map<number, VersusPress[]>();
  private readonly remote = new Map<number, VersusPress[]>();
  /** The next tick a batch of ours will be for. */
  private nextBatch: number;
  private readonly ownHashes = new Map<number, number>();
  private readonly otherHashes = new Map<number, number>();
  private desynced = false;

  /** `own` is this game's side: the host commands the player's side, the guest the enemy's. */
  constructor(own: Side, delay = INPUT_DELAY_TICKS) {
    this.own = own;
    this.delay = delay;
    // Nobody can press anything for the first ticks: they are settled already.
    for (let t = 0; t < delay; t++) {
      this.local.set(t, []);
      this.remote.set(t, []);
    }
    this.nextBatch = delay;
  }

  /** A key pressed now; it goes out with the next batch. */
  press(press: VersusPress): void {
    this.queued.push(press);
  }

  /**
   * Called before running `tick`: settles our presses for `tick + delay` and returns the batch
   * to send, or null if that tick is settled already (we are waiting for the other game).
   */
  batchFor(tick: number): TickBatch | null {
    const target = tick + this.delay;
    if (target < this.nextBatch) return null;
    const presses = this.queued.slice(0, 10);
    this.queued = this.queued.slice(10);
    this.local.set(target, presses);
    this.nextBatch = target + 1;
    return { tick: target, presses };
  }

  /** The other game's presses for a tick. */
  receive(batch: TickBatch): void {
    if (!this.remote.has(batch.tick)) this.remote.set(batch.tick, batch.presses);
  }

  /** True once both games' presses for the tick are known. */
  canRun(tick: number): boolean {
    return this.local.has(tick) && this.remote.has(tick);
  }

  /**
   * The tick's inputs for the battle engine, the player's side first then the enemy's, the
   * same order in both games. Forgets the tick.
   */
  inputsFor(tick: number): BattleInput[] {
    const mine = this.local.get(tick) ?? [];
    const theirs = this.remote.get(tick) ?? [];
    this.local.delete(tick);
    this.remote.delete(tick);
    const stamp = (side: Side) => (p: VersusPress): BattleInput => (p.kind === 'slot' ? { tick, kind: 'slot', slot: p.slot, side } : { tick, kind: 'ultimate', side });
    const ours = mine.map(stamp(this.own));
    const others = theirs.map(stamp(otherSide(this.own)));
    return this.own === 'player' ? [...ours, ...others] : [...others, ...ours];
  }

  /** Our fingerprint after a tick; says whether it agrees with theirs. */
  ownHash(tick: number, hash: number): HashCheck {
    this.ownHashes.set(tick, hash);
    return this.compare(tick);
  }

  /** Their fingerprint after a tick. */
  otherHash(tick: number, hash: number): HashCheck {
    this.otherHashes.set(tick, hash);
    return this.compare(tick);
  }

  /** True once any fingerprint differed. */
  get isDesynced(): boolean {
    return this.desynced;
  }

  private compare(tick: number): HashCheck {
    const mine = this.ownHashes.get(tick);
    const theirs = this.otherHashes.get(tick);
    if (mine === undefined || theirs === undefined) return 'pending';
    this.ownHashes.delete(tick);
    this.otherHashes.delete(tick);
    if (mine === theirs) return 'agree';
    this.desynced = true;
    return 'desync';
  }
}
