import { describe, expect, it } from 'vitest';
import { browserRecognition, webSpeech, type RecognitionLike, type SpeechResult } from './speech';

/** A stand-in for the browser's SpeechRecognition that the test drives by hand. */
class FakeRecognition implements RecognitionLike {
  static last: FakeRecognition | null = null;
  static failStart = false;
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: RecognitionLike['onresult'] = null;
  onerror: RecognitionLike['onerror'] = null;
  onend: RecognitionLike['onend'] = null;
  calls: string[] = [];

  constructor() {
    FakeRecognition.last = this;
  }
  start(): void {
    if (FakeRecognition.failStart) throw new Error('already started');
    this.calls.push('start');
  }
  stop(): void {
    this.calls.push('stop');
  }
  abort(): void {
    this.calls.push('abort');
  }
  hear(...parts: string[]): void {
    this.onresult?.({ results: parts.map((transcript) => [{ transcript }]) });
  }
  fail(error: string): void {
    this.onerror?.({ error });
  }
  end(): void {
    this.onend?.();
  }
}

function listen() {
  const speech = webSpeech(FakeRecognition)!;
  const words: string[] = [];
  const ends: SpeechResult[] = [];
  const listening = speech.listen({ onWords: (w) => words.push(w), onEnd: (r) => ends.push(r) });
  return { listening, words, ends, recognition: FakeRecognition.last! };
}

describe('speech input', () => {
  it('is missing when the browser has no speech recognition', () => {
    expect(webSpeech(undefined)).toBeNull();
    expect(browserRecognition({})).toBeUndefined();
    expect(browserRecognition({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
    expect(browserRecognition({ SpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
  });

  it('listens in English, keeps listening while held, and shows the words as they come', () => {
    const { listening, words, ends, recognition } = listen();
    expect(recognition).toMatchObject({ lang: 'en-US', continuous: true, interimResults: true, maxAlternatives: 1 });
    expect(recognition.calls).toEqual(['start']);
    recognition.hear('rangers ');
    recognition.hear('rangers ', ' fall back to  the healer');
    expect(words).toEqual(['rangers', 'rangers fall back to the healer']);
    listening.stop();
    expect(recognition.calls).toEqual(['start', 'stop']);
    expect(ends).toEqual([]);
    recognition.end();
    recognition.end();
    expect(ends).toEqual([{ ok: true, text: 'rangers fall back to the healer' }]);
  });

  it('says why there are no words', () => {
    const cases: [string | null, SpeechResult][] = [
      [null, { ok: false, problem: 'no-speech' }],
      ['no-speech', { ok: false, problem: 'no-speech' }],
      ['not-allowed', { ok: false, problem: 'blocked' }],
      ['audio-capture', { ok: false, problem: 'no-microphone' }],
      ['network', { ok: false, problem: 'offline' }],
      ['bad-grammar', { ok: false, problem: 'failed' }],
    ];
    for (const [error, expected] of cases) {
      const { ends, recognition } = listen();
      if (error) recognition.fail(error);
      recognition.end();
      expect(ends, String(error)).toEqual([expected]);
    }
  });

  it('keeps words heard before an error', () => {
    const { ends, recognition } = listen();
    recognition.hear('hold the line');
    recognition.fail('network');
    recognition.end();
    expect(ends).toEqual([{ ok: true, text: 'hold the line' }]);
  });

  it('throws the words away when cancelled', () => {
    const { listening, words, ends, recognition } = listen();
    listening.cancel();
    recognition.hear('too late');
    recognition.end();
    expect(recognition.calls).toEqual(['start', 'abort']);
    expect(words).toEqual([]);
    expect(ends).toEqual([]);
  });

  it('reports a failure when listening cannot start', async () => {
    FakeRecognition.failStart = true;
    try {
      const { ends } = listen();
      await Promise.resolve();
      expect(ends).toEqual([{ ok: false, problem: 'failed' }]);
    } finally {
      FakeRecognition.failStart = false;
    }
  });
});
