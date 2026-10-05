// The game's music (session 6B): three short looping pieces written for Generals, as notes the
// synthesizer plays. The Capital's theme is a calm march, the battle theme drives, and the boss
// theme is darker and faster.
//
// Each part is one line of steps, an eighth note each, eight to a bar ('|' between bars is only
// for reading): a note like D4 or Bb3 starts a note, '-' holds the one before, '.' is a rest.
// Drum parts use 'x' for a hit.

export type Instrument = 'lead' | 'arp' | 'bass' | 'pad' | 'kick' | 'snare' | 'hat';
export const DRUMS: readonly Instrument[] = ['kick', 'snare', 'hat'];

export interface Part {
  instrument: Instrument;
  /** Loudness of this part, 0 to 1. */
  gain: number;
  steps: string;
}

export interface Track {
  /** Beats (quarter notes) a minute. */
  bpm: number;
  bars: number;
  parts: readonly Part[];
}

export const STEPS_PER_BAR = 8;

const bars = (...lines: string[]) => lines.join(' | ');

export const TRACKS = {
  // The Capital: D minor, a calm march. Dm Bb F C Dm Bb C A.
  capital: {
    bpm: 92,
    bars: 8,
    parts: [
      {
        instrument: 'lead',
        gain: 0.5,
        steps: bars(
          'A4 - D5 - E5 - F5 -',
          'D5 - - - C5 - Bb4 -',
          'A4 - - - C5 - F5 -',
          'E5 - - - - - . .',
          'A4 - D5 - E5 - F5 G5',
          'F5 - - - D5 - Bb4 -',
          'C5 - E5 - G5 - E5 -',
          'C#5 - - - - - . .',
        ),
      },
      {
        instrument: 'pad',
        gain: 0.5,
        steps: bars('D4 - - - - - - -', 'D4 - - - - - - -', 'C4 - - - - - - -', 'C4 - - - - - - -', 'D4 - - - - - - -', 'D4 - - - - - - -', 'E4 - - - - - - -', 'C#4 - - - - - - -'),
      },
      {
        instrument: 'pad',
        gain: 0.5,
        steps: bars('F4 - - - - - - -', 'F4 - - - - - - -', 'F4 - - - - - - -', 'G4 - - - - - - -', 'F4 - - - - - - -', 'F4 - - - - - - -', 'G4 - - - - - - -', 'E4 - - - - - - -'),
      },
      {
        instrument: 'bass',
        gain: 0.8,
        steps: bars('D2 - - - A2 - - -', 'Bb1 - - - F2 - - -', 'F2 - - - C3 - - -', 'C2 - - - G2 - - -', 'D2 - - - A2 - - -', 'Bb1 - - - F2 - - -', 'C2 - - - G2 - - -', 'A1 - - - E2 - A2 -'),
      },
      { instrument: 'kick', gain: 0.5, steps: bars(...Array<string>(8).fill('x . . . . . . .')) },
      { instrument: 'hat', gain: 0.35, steps: bars(...Array<string>(8).fill('. . x . . . x .')) },
    ],
  },

  // Battle: A minor, driving. Am Am F G Am Am F E.
  battle: {
    bpm: 132,
    bars: 8,
    parts: [
      {
        instrument: 'lead',
        gain: 0.55,
        steps: bars(
          'A4 - - C5 E5 - D5 C5',
          'D5 - - C5 B4 - A4 -',
          'F4 - A4 - C5 - F5 -',
          'G5 - - F5 E5 - D5 -',
          'A4 - - C5 E5 - A5 -',
          'G5 - E5 - D5 - C5 -',
          'D5 - - E5 F5 - A5 -',
          'G#5 - - - E5 - - -',
        ),
      },
      {
        instrument: 'arp',
        gain: 0.35,
        steps: bars(
          'A3 C4 E4 C4 A3 C4 E4 C4',
          'A3 C4 E4 C4 A3 C4 E4 C4',
          'F3 A3 C4 A3 F3 A3 C4 A3',
          'G3 B3 D4 B3 G3 B3 D4 B3',
          'A3 C4 E4 C4 A3 C4 E4 C4',
          'A3 C4 E4 C4 A3 C4 E4 C4',
          'F3 A3 C4 A3 F3 A3 C4 A3',
          'E3 G#3 B3 G#3 E3 G#3 B3 G#3',
        ),
      },
      {
        instrument: 'bass',
        gain: 0.8,
        steps: bars(
          'A1 A1 A2 A1 A1 A1 A2 A1',
          'A1 A1 A2 A1 A1 A1 A2 A1',
          'F1 F1 F2 F1 F1 F1 F2 F1',
          'G1 G1 G2 G1 G1 G1 G2 G1',
          'A1 A1 A2 A1 A1 A1 A2 A1',
          'A1 A1 A2 A1 A1 A1 A2 A1',
          'F1 F1 F2 F1 F1 F1 F2 F1',
          'E1 E1 E2 E1 E1 E1 E2 E1',
        ),
      },
      { instrument: 'kick', gain: 0.8, steps: bars(...Array<string>(8).fill('x . . . x . . .')) },
      { instrument: 'snare', gain: 0.6, steps: bars(...Array<string>(7).fill('. . x . . . x .'), '. . x . . x x x') },
      { instrument: 'hat', gain: 0.4, steps: bars(...Array<string>(8).fill('x x x x x x x x')) },
    ],
  },

  // A ruler's army: D minor with a flat second, faster and darker. Dm Eb Dm Eb Bb C Dm A.
  boss: {
    bpm: 144,
    bars: 8,
    parts: [
      {
        instrument: 'lead',
        gain: 0.55,
        steps: bars(
          'D5 - - - A4 - - -',
          'Eb5 - - - Bb4 - - -',
          'D5 - F5 - E5 - D5 -',
          'Eb5 - - - D5 - C5 -',
          'Bb4 - D5 - F5 - Bb5 -',
          'A5 - G5 - E5 - C5 -',
          'D5 - - - F5 - A5 -',
          'C#5 - - - - - . .',
        ),
      },
      {
        instrument: 'pad',
        gain: 0.5,
        steps: bars('D3 - - - - - - -', 'Eb3 - - - - - - -', 'D3 - - - - - - -', 'Eb3 - - - - - - -', 'Bb2 - - - - - - -', 'C3 - - - - - - -', 'D3 - - - - - - -', 'A2 - - - - - - -'),
      },
      {
        instrument: 'pad',
        gain: 0.5,
        steps: bars('A3 - - - - - - -', 'Bb3 - - - - - - -', 'A3 - - - - - - -', 'Bb3 - - - - - - -', 'F3 - - - - - - -', 'G3 - - - - - - -', 'A3 - - - - - - -', 'E3 - - - - - - -'),
      },
      {
        instrument: 'bass',
        gain: 0.85,
        steps: bars(
          'D1 D1 D2 D1 D1 D2 D1 D1',
          'Eb1 Eb1 Eb2 Eb1 Eb1 Eb2 Eb1 Eb1',
          'D1 D1 D2 D1 D1 D2 D1 D1',
          'Eb1 Eb1 Eb2 Eb1 Eb1 Eb2 Eb1 Eb1',
          'Bb0 Bb0 Bb1 Bb0 Bb0 Bb1 Bb0 Bb0',
          'C1 C1 C2 C1 C1 C2 C1 C1',
          'D1 D1 D2 D1 D1 D2 D1 D1',
          'A0 A0 A1 A0 A1 A1 C#2 E2',
        ),
      },
      { instrument: 'kick', gain: 0.9, steps: bars(...Array<string>(8).fill('x . . x x . . .')) },
      { instrument: 'snare', gain: 0.65, steps: bars(...Array<string>(7).fill('. . x . . . x .'), '. . x . x x x x') },
      { instrument: 'hat', gain: 0.4, steps: bars(...Array<string>(8).fill('x x x x x x x x')) },
    ],
  },
} satisfies Record<string, Track>;

export type TrackId = keyof typeof TRACKS;
export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];

/** A note to play: from which step, for how many steps, at which pitch (MIDI number; drums have none). */
export interface NoteEvent {
  step: number;
  length: number;
  midi: number | null;
}

const NOTE = /^([A-G])(#|b)?(-?\d)$/;
const SEMITONES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A note name (A4, Bb3, C#5) as a MIDI number (A4 is 69), or null if it isn't one. */
export function midiOf(name: string): number | null {
  const m = NOTE.exec(name);
  if (!m) return null;
  const shift = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + SEMITONES[m[1]!]! + shift;
}

/** A MIDI number as a pitch in Hz. */
export function frequencyOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** The steps of a part, bar marks taken out. */
export function stepsOf(part: Part): string[] {
  return part.steps.split(/\s+/).filter((t) => t !== '' && t !== '|');
}

/** The part's notes, each held for as long as the '-' after it say. */
export function partNotes(part: Part): NoteEvent[] {
  const events: NoteEvent[] = [];
  const drum = DRUMS.includes(part.instrument);
  stepsOf(part).forEach((token, step) => {
    if (token === '-') {
      const last = events.at(-1);
      if (last && last.step + last.length === step) last.length++;
      return;
    }
    if (token === '.') return;
    if (drum) events.push({ step, length: 1, midi: null });
    else events.push({ step, length: 1, midi: midiOf(token) });
  });
  return events;
}

/** What is wrong with a track: parts of the wrong length, or tokens that aren't notes. Empty when it is fine. */
export function trackProblems(id: string, track: Track): string[] {
  const problems: string[] = [];
  const want = track.bars * STEPS_PER_BAR;
  track.parts.forEach((part, i) => {
    const steps = stepsOf(part);
    if (steps.length !== want) problems.push(`${id} part ${i} (${part.instrument}): ${steps.length} steps, not ${want}`);
    const drum = DRUMS.includes(part.instrument);
    for (const token of steps) {
      const ok = token === '-' || token === '.' || (drum ? token === 'x' : midiOf(token) !== null);
      if (!ok) problems.push(`${id} part ${i} (${part.instrument}): '${token}' is not a ${drum ? 'drum hit' : 'note'}`);
    }
  });
  return problems;
}

/** Seconds one step lasts. */
export function stepSeconds(track: Track): number {
  return 60 / track.bpm / 2;
}
