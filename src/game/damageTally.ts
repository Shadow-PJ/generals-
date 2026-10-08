// Damage numbers that add up (session 7E). In a crowd a troop takes many small hits a second, and
// a number for each piled up over the troop into an unreadable blur. Hits on one troop close
// together now go into one number that grows: "12", then "31", then "47". It only decides what
// the numbers say; the battle screen draws them.

/** How long after a hit, in milliseconds, the next hit on the same troop still adds to its number. */
export const TALLY_MS = 450;

export interface Tallied {
  /** What the troop's number shows now. */
  total: number;
  /** A new number, rather than one already showing that grew. */
  fresh: boolean;
}

export class DamageTally {
  private open = new Map<number, { total: number; until: number }>();

  /** A hit of `amount` on troop `unitId` at `now` (ms of screen time). */
  add(unitId: number, amount: number, now: number): Tallied {
    const entry = this.open.get(unitId);
    if (entry && now <= entry.until) {
      entry.total += amount;
      entry.until = now + TALLY_MS;
      return { total: entry.total, fresh: false };
    }
    this.open.set(unitId, { total: amount, until: now + TALLY_MS });
    return { total: amount, fresh: true };
  }

  /** Forgets every number, for a new battle. */
  clear(): void {
    this.open.clear();
  }
}
