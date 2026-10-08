// The picture at the top of a run's stop screens (session 7E): how tall it is. It takes the room
// the words and options under it leave, so a camp with one option gets a big picture and a
// merchant with a long list a short one. Shared by the stop screen and the art preview.

import { GAME_HEIGHT } from './theme';

/** How tall the stop picture is at least, in world units, when the screen below it is full. */
export const STOP_PICTURE_H = 120;
/** How tall it grows when the screen has room. */
export const STOP_PICTURE_MAX_H = 260;
/** Room kept at the bottom for the help line and the run's numbers. */
const FOOTER_ROOM = 66;
/** The gap between the picture and the words under it. */
export const PICTURE_GAP = 10;
/** The picture grows in steps this tall, so a screen that gains a line keeps its picture. */
const PICTURE_STEP = 20;

/** How tall the picture is when the words and options under it take `content` world units. */
export function pictureHeight(content: number): number {
  const room = GAME_HEIGHT - FOOTER_ROOM - PICTURE_GAP - content;
  const stepped = Math.floor(room / PICTURE_STEP) * PICTURE_STEP;
  return Math.max(STOP_PICTURE_H, Math.min(STOP_PICTURE_MAX_H, stepped));
}
