// What every versus screen does (session 6D): it follows the match while it is open, and when the
// other player leaves or the connection drops, it goes back to the Versus screen and says so.

import type Phaser from 'phaser';
import { currentMatch, GONE_TEXT, type VersusEvent, type VersusMatch } from './versus';

export interface FollowOptions {
  /** What to do when the match ends early; by default, back to the Versus screen. */
  onGone?: (why: 'left' | 'lost') => void;
}

/**
 * Follows the match from a screen until the screen closes. Returns the match, or null when it is
 * already over, in which case the screen goes back to the Versus screen.
 */
export function followMatch(scene: Phaser.Scene, onEvent: (event: VersusEvent) => void = () => undefined, options: FollowOptions = {}): VersusMatch | null {
  const match = currentMatch();
  if (!match) {
    scene.scene.start('Versus', { notice: GONE_TEXT.lost });
    return null;
  }
  const stop = match.listen((event) => {
    if (event.kind !== 'gone') onEvent(event);
    else if (options.onGone) options.onGone(event.why);
    else scene.scene.start('Versus', { notice: GONE_TEXT[event.why] });
  });
  scene.events.once('shutdown', stop);
  return match;
}

/** Leaves the match and goes back to the Versus screen. */
export function leaveMatch(scene: Phaser.Scene): void {
  currentMatch()?.leave();
  scene.scene.start('Versus', { notice: 'You left the match.', calm: true });
}
