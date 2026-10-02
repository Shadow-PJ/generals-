// Window sizes the desktop app offers, as multiples of the game's base size. Only the sizes
// that fit on the screen, with room left for the title bar and the taskbar, are offered.

const SCALES = [1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;
const MIN_SCALE = 0.5;
/** Room kept free around the window's inner area for its frame and title bar. */
const FRAME = { width: 16, height: 48 } as const;

export function windowScales(
  workArea: { width: number; height: number },
  base: { width: number; height: number },
): number[] {
  const fits = SCALES.filter(
    (s) => base.width * s <= workArea.width - FRAME.width && base.height * s <= workArea.height - FRAME.height,
  );
  if (fits.length > 0) return fits;
  // A small screen, or a big Windows display scaling: offer the largest size that still fits.
  const fit = Math.min((workArea.width - FRAME.width) / base.width, (workArea.height - FRAME.height) / base.height);
  return [Math.max(MIN_SCALE, Math.floor(fit * 20) / 20)];
}
