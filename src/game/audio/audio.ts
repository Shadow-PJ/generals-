// Plays the game's sounds and music through the browser's Web Audio (session 6B), which the
// desktop app has too. Everything is synthesized from the recipes in sounds.ts and the notes in
// music.ts. Browsers only allow sound after the player's first key press or click, so nothing
// plays before that; music asked for earlier starts then.

import type { Volume } from '../../save/settings';
import { frequencyOf, partNotes, STEPS_PER_BAR, stepSeconds, TRACKS, type Instrument, type NoteEvent, type TrackId } from './music';
import { SOUNDS, type SoundId, type Voice } from './sounds';

/** At most this many sound effects at once; more are dropped rather than turning to noise. */
const MAX_VOICES = 28;
/** Music is scheduled this far ahead, in seconds, checked this often (ms). */
const LOOKAHEAD = 0.25;
const TICK_MS = 60;
/** How long one piece fades into the next, in seconds. */
const CROSSFADE = 0.8;

interface Playing {
  id: TrackId;
  bus: GainNode;
  notes: { instrument: Instrument; gain: number; note: NoteEvent }[];
  loopSteps: number;
  step: number;
  nextTime: number;
  timer: ReturnType<typeof setInterval>;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let effectsBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let volume: Volume = { master: 0.8, music: 0.6, effects: 0.8 };
let wantedTrack: TrackId | null = null;
let playing: Playing | null = null;
/** Sound-effect voices still sounding. */
const activeVoices = new Set<AudioScheduledSourceNode>();
const lastPlayed = new Map<SoundId, number>();

/** Starts sound on the first key press or click; call it from those events. Safe to call again. */
export function unlockAudio(): void {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    // A gentle limiter at the end, so a big fight's pile of sounds never clips.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    effectsBus = ctx.createGain();
    effectsBus.connect(master);
    noiseBuffer = makeNoise(ctx);
    applyVolume();
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  if (wantedTrack && playing?.id !== wantedTrack) startTrack(wantedTrack);
}

/** Sets how loud everything is (from Settings). */
export function setVolume(next: Volume): void {
  volume = next;
  applyVolume();
}

function applyVolume(): void {
  if (!ctx || !master || !musicBus || !effectsBus) return;
  const now = ctx.currentTime;
  // Loudness feels even when the slider squares: half way sounds about half as loud.
  master.gain.setTargetAtTime(volume.master * volume.master, now, 0.03);
  musicBus.gain.setTargetAtTime(volume.music * volume.music * 0.7, now, 0.03);
  effectsBus.gain.setTargetAtTime(volume.effects * volume.effects, now, 0.03);
}

/** Plays a sound effect, unless the same one just played or too many are playing. */
export function playSound(id: SoundId): void {
  if (!ctx || !effectsBus || ctx.state !== 'running' || volume.master === 0 || volume.effects === 0) return;
  const sound = SOUNDS[id];
  const nowMs = ctx.currentTime * 1000;
  if (nowMs - (lastPlayed.get(id) ?? -Infinity) < sound.gapMs) return;
  if (activeVoices.size + sound.voices.length > MAX_VOICES) return;
  lastPlayed.set(id, nowMs);
  for (const voice of sound.voices) playVoice(voice, ctx.currentTime + (voice.at ?? 0), effectsBus, true);
}

/** One voice of a sound or a note; `counted` voices (sound effects) count toward MAX_VOICES. */
function playVoice(voice: Voice, start: number, out: AudioNode, counted = false): void {
  if (!ctx || !noiseBuffer) return;
  const end = start + voice.attack + voice.decay;
  let source: AudioScheduledSourceNode;
  let input: AudioNode;
  if (voice.wave === 'noise') {
    const node = ctx.createBufferSource();
    node.buffer = noiseBuffer;
    node.loop = true;
    source = node;
    const filter = ctx.createBiquadFilter();
    filter.type = voice.filter ?? 'bandpass';
    filter.Q.value = voice.q ?? 1;
    filter.frequency.setValueAtTime(voice.from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, voice.to), end);
    node.connect(filter);
    input = filter;
  } else {
    const osc = ctx.createOscillator();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(voice.from, start);
    if (voice.to !== voice.from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, voice.to), end);
    source = osc;
    input = osc;
    if (voice.filter && voice.cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = voice.filter;
      filter.frequency.value = voice.cutoff;
      osc.connect(filter);
      input = filter;
    }
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(voice.gain, start + voice.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  input.connect(gain);
  gain.connect(out);
  if (counted) activeVoices.add(source);
  source.onended = () => {
    activeVoices.delete(source);
    gain.disconnect();
  };
  source.start(start);
  source.stop(end + 0.02);
}

function makeNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Sound, not the battle: an ordinary random noise is fine here.
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Plays a piece of music, fading out the one before; null fades the music out. The same piece carries on. */
export function playMusic(id: TrackId | null): void {
  wantedTrack = id;
  if (!ctx || ctx.state === 'closed') return;
  if (playing?.id === id) return;
  stopTrack();
  if (id) startTrack(id);
}

function stopTrack(): void {
  if (!ctx || !playing) return;
  const old = playing;
  playing = null;
  clearInterval(old.timer);
  old.bus.gain.setTargetAtTime(0, ctx.currentTime, CROSSFADE / 4);
  setTimeout(() => old.bus.disconnect(), CROSSFADE * 2000);
}

function startTrack(id: TrackId): void {
  if (!ctx || !musicBus) return;
  stopTrack();
  const track = TRACKS[id];
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bus.gain.linearRampToValueAtTime(1, ctx.currentTime + CROSSFADE);
  bus.connect(musicBus);
  const notes = track.parts.flatMap((part) => partNotes(part).map((note) => ({ instrument: part.instrument, gain: part.gain, note })));
  const now: Playing = {
    id,
    bus,
    notes,
    loopSteps: track.bars * STEPS_PER_BAR,
    step: 0,
    nextTime: ctx.currentTime + 0.1,
    timer: setInterval(() => schedule(now), TICK_MS),
  };
  playing = now;
  schedule(now);
}

/** Queues the notes of the steps that start within the lookahead. */
function schedule(p: Playing): void {
  if (!ctx || playing !== p) return;
  const step = stepSeconds(TRACKS[p.id]);
  // After a long pause (a hidden tab), skip ahead rather than play everything at once.
  if (p.nextTime < ctx.currentTime - 0.5) p.nextTime = ctx.currentTime + 0.05;
  while (p.nextTime < ctx.currentTime + LOOKAHEAD) {
    const at = p.step % p.loopSteps;
    for (const n of p.notes) if (n.note.step === at) playNote(n.instrument, n.gain, n.note, p.nextTime, step, p.bus);
    p.step++;
    p.nextTime += step;
  }
}

/** One note of an instrument. */
function playNote(instrument: Instrument, gain: number, note: NoteEvent, start: number, step: number, out: AudioNode): void {
  const held = note.length * step;
  const pitch = note.midi === null ? 0 : frequencyOf(note.midi);
  const g = (v: number) => v * gain;
  switch (instrument) {
    case 'lead':
      return playVoice({ wave: 'square', from: pitch, to: pitch, attack: 0.01, decay: held * 0.95, gain: g(0.05), filter: 'lowpass', cutoff: 2200 }, start, out);
    case 'arp':
      return playVoice({ wave: 'triangle', from: pitch, to: pitch, attack: 0.005, decay: Math.min(held, step) * 0.9, gain: g(0.09) }, start, out);
    case 'bass':
      return playVoice({ wave: 'triangle', from: pitch, to: pitch, attack: 0.008, decay: held * 0.9, gain: g(0.2), filter: 'lowpass', cutoff: 700 }, start, out);
    case 'pad':
      for (const detune of [0.997, 1.003]) {
        playVoice({ wave: 'sawtooth', from: pitch * detune, to: pitch * detune, attack: 0.25, decay: held, gain: g(0.02), filter: 'lowpass', cutoff: 900 }, start, out);
      }
      return;
    case 'kick':
      return playVoice({ wave: 'sine', from: 130, to: 42, attack: 0.003, decay: 0.16, gain: g(0.5) }, start, out);
    case 'snare':
      playVoice({ wave: 'noise', from: 1900, to: 1500, attack: 0.002, decay: 0.12, gain: g(0.22), filter: 'bandpass', q: 0.8 }, start, out);
      return playVoice({ wave: 'triangle', from: 190, to: 140, attack: 0.002, decay: 0.05, gain: g(0.12) }, start, out);
    case 'hat':
      return playVoice({ wave: 'noise', from: 8000, to: 8000, attack: 0.001, decay: 0.03, gain: g(0.07), filter: 'highpass', q: 0.7 }, start, out);
  }
}

/** For tests and the desktop smoke check: whether sound runs, and what is playing. */
export function audioStatus(): { state: string; track: TrackId | null; voices: number } {
  return { state: ctx?.state ?? 'locked', track: playing?.id ?? null, voices: activeVoices.size };
}
