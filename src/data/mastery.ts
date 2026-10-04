// General Mastery (session 5E): three challenges for each General, each met by winning one
// campaign battle in a certain way while leading with them. Each challenge gives a title; all
// three give that General's look, a gold trim on your troops when you lead with them.
// Starting values to tune.

import type { GeneralId } from './generals';

/** What a won battle must show. Every challenge needs a win, while leading with the General. */
export type MasteryGoal =
  /** Fired this many cards or fewer. */
  | { kind: 'fewCards'; max: number }
  /** Lost no troop. */
  | { kind: 'noLosses' }
  /** Lost this many troops or more, and still won. */
  | { kind: 'comeback'; lost: number }
  /** Landed this many Perfect timings or more. */
  | { kind: 'perfects'; min: number }
  /** Landed this many signature combos or more. */
  | { kind: 'combos'; min: number }
  /** Fired the ultimate this many times or more. */
  | { kind: 'ultimates'; min: number }
  /** Landed a Finisher. */
  | { kind: 'finisher' }
  /** Won in under this many seconds. */
  | { kind: 'fast'; seconds: number }
  /** Fired no card in the battle's first this many seconds. */
  | { kind: 'patient'; seconds: number };

export interface MasteryChallenge {
  goal: MasteryGoal;
  text: string;
  /** The title it gives. */
  title: string;
}

export const MASTERY: Readonly<Record<GeneralId, readonly MasteryChallenge[]>> = {
  captain: [
    { goal: { kind: 'fewCards', max: 2 }, text: 'Win firing 2 cards or fewer', title: 'the Calm' },
    { goal: { kind: 'noLosses' }, text: 'Win without losing a troop', title: 'the Shepherd' },
    { goal: { kind: 'perfects', min: 3 }, text: 'Land 3 Perfect timings in one win', title: 'the Punctual' },
  ],
  warlord: [
    { goal: { kind: 'fast', seconds: 60 }, text: 'Win in under 60 seconds', title: 'the Swift Blade' },
    { goal: { kind: 'comeback', lost: 3 }, text: 'Win after losing 3 or more troops', title: 'the Unbowed' },
    { goal: { kind: 'ultimates', min: 2 }, text: 'Fire your ultimate twice in one win', title: 'the Reaper' },
  ],
  engineer: [
    { goal: { kind: 'patient', seconds: 30 }, text: 'Win without firing a card in the first 30 seconds', title: 'the Patient' },
    { goal: { kind: 'finisher' }, text: 'Land a Finisher in a win', title: 'the Architect' },
    { goal: { kind: 'noLosses' }, text: 'Win without losing a troop', title: 'the Ironclad' },
  ],
  hiveMother: [
    { goal: { kind: 'fast', seconds: 75 }, text: 'Win in under 75 seconds', title: 'the Ravenous' },
    { goal: { kind: 'comeback', lost: 4 }, text: 'Win after losing 4 or more troops', title: 'the Undying Swarm' },
    { goal: { kind: 'ultimates', min: 2 }, text: 'Fire your ultimate twice in one win', title: 'the Evolved' },
  ],
  strategist: [
    { goal: { kind: 'perfects', min: 5 }, text: 'Land 5 Perfect timings in one win', title: 'the Foresighted' },
    { goal: { kind: 'combos', min: 2 }, text: 'Land 2 signature combos in one win', title: 'the Schemer' },
    { goal: { kind: 'noLosses' }, text: 'Win without losing a troop', title: 'the Flawless' },
  ],
  conductor: [
    { goal: { kind: 'combos', min: 3 }, text: 'Land 3 signature combos in one win', title: 'the Virtuoso' },
    { goal: { kind: 'finisher' }, text: 'Land a Finisher in a win', title: 'the Crescendo' },
    { goal: { kind: 'perfects', min: 4 }, text: 'Land 4 Perfect timings in one win', title: 'the Metronome' },
  ],
};

/** A challenge: the General and which of their three, 0 to 2. Saved as "captain.0". */
export type MasteryId = `${GeneralId}.${0 | 1 | 2}`;
