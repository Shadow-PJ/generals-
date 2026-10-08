// The store the game was started from (session 7A): Steam now, Epic in 7B, or none (the browser
// build, and the desktop app started on its own). It takes the game's achievements and tells the
// player's friends what they are doing (rich presence). Game code only names an achievement or a
// presence line; each store's own code, in the desktop app, does the rest. With no store, both
// do nothing, so the game plays the same everywhere.

/** Which store started the game. */
export type StoreName = 'none' | 'steam';

/**
 * What the player is doing, for their friends to see: a line by name ("Battle"), and the
 * words that fill it in ({ region: 'Red Canyon' }). Each store keeps the lines' text itself.
 */
export interface Presence {
  line: string;
  params: Readonly<Record<string, string>>;
}

export interface Store {
  readonly name: StoreName;
  /** Unlocks an achievement by its id; unlocking one already unlocked does nothing. */
  unlockAchievement(id: string): void;
  /** Says what the player is doing; null clears it. */
  setPresence(presence: Presence | null): void;
}

/** No store: achievements and presence go nowhere. */
export const NO_STORE: Store = {
  name: 'none',
  unlockAchievement() {},
  setPresence() {},
};
