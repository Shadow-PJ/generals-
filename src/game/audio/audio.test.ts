import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../sim';
import { eventSounds, menuSound } from './cues';
import { frequencyOf, midiOf, partNotes, stepSeconds, trackProblems, TRACK_IDS, TRACKS } from './music';
import { SOUND_IDS, SOUNDS, soundLength } from './sounds';

describe('sound effects', () => {
  it('every recipe is sane: audible pitches, gentle levels, short enough', () => {
    for (const id of SOUND_IDS) {
      const sound = SOUNDS[id];
      expect(sound.voices.length, id).toBeGreaterThan(0);
      expect(soundLength(sound), id).toBeLessThan(2);
      for (const v of sound.voices) {
        expect(v.from, id).toBeGreaterThanOrEqual(20);
        expect(v.to, id).toBeGreaterThanOrEqual(20);
        expect(v.gain, id).toBeGreaterThan(0);
        expect(v.gain, id).toBeLessThanOrEqual(0.6);
        expect(v.attack + v.decay, id).toBeGreaterThan(0);
      }
    }
  });
});

describe('music', () => {
  it('reads note names', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('Bb3')).toBe(58);
    expect(midiOf('C#5')).toBe(73);
    expect(midiOf('H2')).toBeNull();
    expect(frequencyOf(69)).toBe(440);
    expect(frequencyOf(81)).toBeCloseTo(880);
  });

  it('every part of every piece fills its bars with real notes', () => {
    for (const id of TRACK_IDS) expect(trackProblems(id, TRACKS[id])).toEqual([]);
    expect(stepSeconds(TRACKS.battle)).toBeCloseTo(60 / 132 / 2);
  });

  it('holds a note through its dashes and leaves rests silent', () => {
    expect(partNotes({ instrument: 'lead', gain: 1, steps: 'A4 - - . C5 | D5 - .' })).toEqual([
      { step: 0, length: 3, midi: 69 },
      { step: 4, length: 1, midi: 72 },
      { step: 5, length: 2, midi: 74 },
    ]);
    expect(partNotes({ instrument: 'kick', gain: 1, steps: 'x . x .' })).toEqual([
      { step: 0, length: 1, midi: null },
      { step: 2, length: 1, midi: null },
    ]);
  });
});

describe('cues', () => {
  const e = (event: Record<string, unknown>) => ({ tick: 1, ...event }) as BattleEvent;

  it('gives blows, deaths and walls their sounds', () => {
    expect(eventSounds(e({ type: 'damage', sourceId: 1, targetId: 2, amount: 10, absorbed: 0, cause: 'attack' }))).toEqual(['hit']);
    expect(eventSounds(e({ type: 'damage', sourceId: 1, targetId: 2, amount: 0, absorbed: 8, cause: 'attack' }))).toEqual(['block']);
    expect(eventSounds(e({ type: 'damage', sourceId: 1, targetId: 2, amount: 4, absorbed: 0, cause: 'burn' }))).toEqual([]);
    expect(eventSounds(e({ type: 'death', unitId: 2, killerId: 1 }))).toEqual(['death']);
    expect(eventSounds(e({ type: 'wallBreak', wallId: 1, sourceId: 2 }))).toEqual(['wallBreak']);
  });

  it('makes your cards sound brighter than the enemy commander’s, and a Perfect sparkle', () => {
    const fired = { type: 'cardFired', slot: 0, auto: false, cost: 1 };
    expect(eventSounds(e({ ...fired, side: 'player', perfect: false, link: 1 }))).toEqual(['card']);
    expect(eventSounds(e({ ...fired, side: 'player', perfect: true, link: 2 }))).toEqual(['perfect', 'chain']);
    expect(eventSounds(e({ ...fired, side: 'enemy', perfect: false, link: 1 }))).toEqual(['enemyCard']);
    expect(eventSounds(e({ type: 'ultimateReady', side: 'enemy' }))).toEqual([]);
    expect(eventSounds(e({ type: 'ultimateReady', side: 'player' }))).toEqual(['ultimateReady']);
  });

  it('clicks for moving, choosing and going back in the menus, and nothing else', () => {
    expect(menuSound('up')).toBe('uiMove');
    expect(menuSound('confirm')).toBe('uiConfirm');
    expect(menuSound('back')).toBe('uiBack');
    expect(menuSound('slot1')).toBeNull();
    expect(menuSound('ultimate')).toBeNull();
  });
});
