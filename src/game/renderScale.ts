// How many canvas pixels the game draws per world unit (see display.ts).

import type { Resolution } from '../save/settings';
import { GAME_HEIGHT, GAME_WIDTH } from './theme';

const MAX_RENDER_SCALE = 3;
/** Auto rounds up to steps of this size, so small window changes don't redraw everything. */
const RENDER_SCALE_STEP = 0.25;

/** Canvas pixels per world unit for this setting, window size and screen pixel density. */
export function renderScale(resolution: Resolution, view: { width: number; height: number }, pixelRatio: number): number {
  if (resolution !== 'auto') return resolution;
  const shown = Math.min(view.width / GAME_WIDTH, view.height / GAME_HEIGHT) * pixelRatio;
  const stepped = Math.ceil(shown / RENDER_SCALE_STEP - 1e-6) * RENDER_SCALE_STEP;
  return Math.max(1, Math.min(MAX_RENDER_SCALE, stepped));
}
