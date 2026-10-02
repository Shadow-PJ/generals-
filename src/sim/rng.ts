// Seeded random numbers for the battle engine.
//
// The generator is sfc32: four 32-bit integers of state, stepped with integer adds,
// xors and shifts only, so every JavaScript engine produces the same sequence.
// The state is plain data, so it is saved with the battle and replays continue exactly.

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Number of outputs thrown away after seeding, so nearby seeds start far apart. */
const WARM_UP_ROUNDS = 15;

export function createRng(seed: number): RngState {
  const state: RngState = {
    a: 0x9e3779b9 | 0,
    b: 0x243f6a88 | 0,
    c: 0xb7e15162 | 0,
    d: (seed ^ 0x5bd1e995) | 0,
  };
  for (let i = 0; i < WARM_UP_ROUNDS; i++) nextUint32(state);
  return state;
}

/** Next integer in [0, 2^32). Advances the state. */
export function nextUint32(s: RngState): number {
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  s.d = (s.d + 1) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) | 0;
  return t >>> 0;
}

/** Next number in [0, 1). */
export function nextFloat(s: RngState): number {
  return nextUint32(s) / 4294967296;
}

/** Next number in [min, max). */
export function nextRange(s: RngState, min: number, max: number): number {
  return min + (max - min) * nextFloat(s);
}

/** Next integer in [0, n). */
export function nextInt(s: RngState, n: number): number {
  return Math.floor(nextFloat(s) * n);
}
