// Every sound effect in the game (session 6B), as a recipe for the synthesizer: no sound files,
// nothing downloaded. A recipe is a few voices, each a wave or noise that sweeps in pitch and
// fades out; together they make a sword's clang, an arrow's whoosh or a fanfare.

export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';

export interface Voice {
  wave: Wave;
  /** Pitch at the start and the end of the voice, in Hz. For noise, where its filter sits. */
  from: number;
  to: number;
  /** Seconds after the sound starts that this voice begins. */
  at?: number;
  /** Seconds to rise to full loudness, then to fade away. */
  attack: number;
  decay: number;
  /** Loudness, 0 to 1. */
  gain: number;
  /** A filter: lowpass keeps the low end, highpass the high, bandpass a band around `from`/`to`. */
  filter?: 'lowpass' | 'highpass' | 'bandpass';
  /** Where a tone's filter cuts, in Hz (noise uses `from`/`to`). */
  cutoff?: number;
  /** How narrow a bandpass is. */
  q?: number;
}

export interface Sound {
  voices: readonly Voice[];
  /** The same sound plays at most this often, in milliseconds, so a melee doesn't roar. */
  gapMs: number;
}

const tone = (wave: Wave, from: number, to: number, decay: number, gain: number, extra: Partial<Voice> = {}): Voice => ({
  wave,
  from,
  to,
  attack: 0.004,
  decay,
  gain,
  ...extra,
});
const noise = (filter: Voice['filter'], from: number, to: number, decay: number, gain: number, extra: Partial<Voice> = {}): Voice => ({
  wave: 'noise',
  from,
  to,
  attack: 0.003,
  decay,
  gain,
  filter,
  q: 1.2,
  ...extra,
});
/** Notes one after another, `every` seconds apart. */
const notes = (wave: Wave, pitches: readonly number[], every: number, decay: number, gain: number, extra: Partial<Voice> = {}): Voice[] =>
  pitches.map((p, i) => tone(wave, p, p, decay, gain, { at: i * every, ...extra }));

export const SOUNDS = {
  // Menus.
  uiMove: { voices: [tone('triangle', 1320, 1320, 0.045, 0.09)], gapMs: 30 },
  uiConfirm: { voices: notes('square', [660, 990], 0.05, 0.08, 0.06, { filter: 'lowpass', cutoff: 3000 }), gapMs: 60 },
  uiBack: { voices: notes('square', [660, 440], 0.05, 0.08, 0.06, { filter: 'lowpass', cutoff: 3000 }), gapMs: 60 },
  uiDenied: { voices: [tone('sawtooth', 170, 120, 0.15, 0.08, { filter: 'lowpass', cutoff: 900 })], gapMs: 80 },
  coin: { voices: notes('square', [988, 1319], 0.05, 0.16, 0.06, { filter: 'lowpass', cutoff: 5000 }), gapMs: 60 },

  // Blows and skills.
  hit: { voices: [noise('bandpass', 1900, 900, 0.07, 0.32), tone('triangle', 190, 90, 0.06, 0.22)], gapMs: 45 },
  heavy: { voices: [noise('lowpass', 700, 180, 0.2, 0.5), tone('sine', 130, 45, 0.18, 0.5)], gapMs: 70 },
  arrow: { voices: [noise('bandpass', 3800, 1500, 0.07, 0.16), tone('triangle', 900, 650, 0.03, 0.05)], gapMs: 40 },
  block: { voices: [tone('sine', 1500, 1400, 0.12, 0.08), noise('highpass', 5000, 5000, 0.04, 0.08)], gapMs: 70 },
  magic: { voices: [tone('sine', 420, 1260, 0.35, 0.11, { attack: 0.02 }), tone('triangle', 840, 2500, 0.3, 0.05, { at: 0.05 })], gapMs: 90 },
  barrier: { voices: [tone('sine', 1320, 1320, 0.4, 0.09), tone('sine', 1980, 1980, 0.3, 0.05, { at: 0.03 })], gapMs: 120 },
  mark: { voices: notes('square', [1760, 2349], 0.04, 0.05, 0.035, { filter: 'lowpass', cutoff: 6000 }), gapMs: 90 },
  whoosh: { voices: [noise('bandpass', 600, 3000, 0.18, 0.22, { attack: 0.05 })], gapMs: 90 },
  vent: { voices: [noise('highpass', 2500, 1800, 0.45, 0.2, { attack: 0.02 })], gapMs: 150 },
  shatter: { voices: [noise('bandpass', 5000, 2500, 0.25, 0.25, { q: 3 }), tone('sine', 2000, 700, 0.2, 0.06)], gapMs: 90 },
  heal: { voices: [tone('sine', 660, 990, 0.25, 0.07, { attack: 0.02 }), tone('sine', 990, 1320, 0.25, 0.05, { at: 0.06 })], gapMs: 100 },
  death: { voices: [tone('square', 300, 80, 0.35, 0.06, { filter: 'lowpass', cutoff: 1200 }), noise('lowpass', 900, 300, 0.25, 0.18)], gapMs: 60 },
  wallHit: { voices: [noise('lowpass', 450, 200, 0.1, 0.22)], gapMs: 90 },
  wallBreak: {
    voices: [
      noise('lowpass', 1300, 180, 0.75, 0.55),
      tone('sine', 95, 38, 0.5, 0.5),
      noise('bandpass', 3000, 1500, 0.3, 0.14, { at: 0.12 }),
    ],
    gapMs: 200,
  },

  // Command.
  card: { voices: notes('triangle', [523, 784], 0.04, 0.14, 0.12), gapMs: 50 },
  enemyCard: { voices: notes('triangle', [330, 247], 0.05, 0.14, 0.1), gapMs: 50 },
  perfect: {
    voices: [...notes('sine', [784, 988, 1175, 1568], 0.05, 0.2, 0.09), noise('highpass', 7000, 7000, 0.3, 0.05, { at: 0.1 })],
    gapMs: 80,
  },
  chain: { voices: [tone('square', 659, 1319, 0.15, 0.05, { filter: 'lowpass', cutoff: 4000 })], gapMs: 60 },
  combo: { voices: notes('square', [523, 659, 784, 1047], 0.06, 0.25, 0.06, { filter: 'lowpass', cutoff: 4000 }), gapMs: 200 },
  ultimate: {
    voices: [
      noise('lowpass', 3200, 200, 1.0, 0.5, { attack: 0.02 }),
      tone('sine', 220, 55, 0.9, 0.55),
      tone('sawtooth', 110, 110, 0.8, 0.06, { filter: 'lowpass', cutoff: 600 }),
    ],
    gapMs: 300,
  },
  ultimateReady: { voices: notes('sine', [1047, 1568], 0.08, 0.5, 0.09), gapMs: 300 },
  reserve: {
    voices: [
      tone('sawtooth', 220, 233, 0.45, 0.07, { attack: 0.05, filter: 'lowpass', cutoff: 1400 }),
      tone('sawtooth', 330, 349, 0.45, 0.05, { attack: 0.05, at: 0.02, filter: 'lowpass', cutoff: 1400 }),
    ],
    gapMs: 200,
  },
  fight: {
    voices: [
      tone('sine', 70, 40, 0.5, 0.5),
      ...[220, 330, 440].map((p) => tone('sawtooth', p, p, 0.6, 0.045, { attack: 0.03, filter: 'lowpass', cutoff: 1600 } as Partial<Voice>)),
    ],
    gapMs: 500,
  },
  overtime: { voices: notes('square', [880, 660, 880, 660], 0.16, 0.1, 0.06, { filter: 'lowpass', cutoff: 3000 }), gapMs: 1000 },

  // Endings.
  victory: {
    voices: [
      ...notes('square', [523, 659, 784], 0.12, 0.28, 0.07, { filter: 'lowpass', cutoff: 4000 }),
      tone('square', 1047, 1047, 0.8, 0.07, { at: 0.36, filter: 'lowpass', cutoff: 4000 }),
      tone('triangle', 262, 262, 0.9, 0.14, { at: 0.36 }),
    ],
    gapMs: 1000,
  },
  defeat: {
    voices: [
      ...notes('triangle', [392, 349, 311], 0.22, 0.4, 0.12),
      tone('triangle', 262, 262, 1.1, 0.13, { at: 0.66 }),
      tone('sine', 131, 131, 1.1, 0.12, { at: 0.66 }),
    ],
    gapMs: 1000,
  },
} satisfies Record<string, Sound>;

export type SoundId = keyof typeof SOUNDS;
export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

/** How long a sound lasts, in seconds: when its last voice has faded. */
export function soundLength(sound: Sound): number {
  return Math.max(...sound.voices.map((v) => (v.at ?? 0) + v.attack + v.decay));
}
