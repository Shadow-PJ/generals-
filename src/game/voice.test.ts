import { describe, expect, it } from 'vitest';
import type { SpeechInput, SpeechResult } from '../platform';
import { PushToTalk, speechProblemMessage, VOICE_MESSAGES } from './voice';

/** Speech input that the test answers by hand. */
function fakeSpeech() {
  const sessions: { onWords(text: string): void; onEnd(result: SpeechResult): void; calls: string[] }[] = [];
  const speech: SpeechInput = {
    listen(handlers) {
      const session = { ...handlers, calls: [] as string[] };
      sessions.push(session);
      return { stop: () => void session.calls.push('stop'), cancel: () => void session.calls.push('cancel') };
    },
  };
  return { speech, sessions };
}

function pushToTalk(speech: SpeechInput | null) {
  const log: string[] = [];
  const talk = new PushToTalk(
    speech,
    {
      onWords: (text) => void log.push(`words: ${text}`),
      onOrder: (text) => void log.push(`order: ${text}`),
      onStatus: (text, problem) => void log.push(`${problem ? 'problem' : 'status'}: ${text}`),
    },
    'no speech here',
  );
  return { talk, log };
}

describe('push-to-talk', () => {
  it('listens while held, shows the words, and hands over the order when let go', () => {
    const { speech, sessions } = fakeSpeech();
    const { talk, log } = pushToTalk(speech);
    expect(talk.available).toBe(true);
    talk.press();
    expect(talk.busy).toBe(true);
    sessions[0]!.onWords('rangers');
    sessions[0]!.onWords('rangers fall back');
    talk.release();
    expect(sessions[0]!.calls).toEqual(['stop']);
    sessions[0]!.onEnd({ ok: true, text: 'rangers fall back' });
    expect(talk.busy).toBe(false);
    expect(log).toEqual([
      `status: ${VOICE_MESSAGES.listening}`,
      'words: rangers',
      'words: rangers fall back',
      `status: ${VOICE_MESSAGES.finishing}`,
      'order: rangers fall back',
    ]);
  });

  it('starts listening only once per press, and ignores a release without a press', () => {
    const { speech, sessions } = fakeSpeech();
    const { talk } = pushToTalk(speech);
    talk.release();
    talk.press();
    talk.press();
    expect(sessions).toHaveLength(1);
    talk.release();
    talk.release();
    expect(sessions[0]!.calls).toEqual(['stop']);
    // A new press waits until the last words are in.
    talk.press();
    expect(sessions).toHaveLength(1);
    sessions[0]!.onEnd({ ok: true, text: 'hold' });
    talk.press();
    expect(sessions).toHaveLength(2);
  });

  it('says why when there are no words, and is ready again', () => {
    const { speech, sessions } = fakeSpeech();
    const { talk, log } = pushToTalk(speech);
    talk.press();
    sessions[0]!.onEnd({ ok: false, problem: 'blocked' });
    expect(log.at(-1)).toBe(`problem: ${speechProblemMessage('blocked')}`);
    expect(talk.busy).toBe(false);
    talk.press();
    expect(sessions).toHaveLength(2);
  });

  it('when the browser has no speech, says so and leaves typing alone', () => {
    const { talk, log } = pushToTalk(null);
    expect(talk.available).toBe(false);
    talk.press();
    talk.release();
    expect(talk.busy).toBe(false);
    expect(log).toEqual(['problem: no speech here']);
  });

  it('forgets the words when the screen closes', () => {
    const { speech, sessions } = fakeSpeech();
    const { talk, log } = pushToTalk(speech);
    talk.press();
    talk.cancel();
    expect(sessions[0]!.calls).toEqual(['cancel']);
    expect(talk.busy).toBe(false);
    expect(log.some((line) => line.startsWith('order'))).toBe(false);
  });

  it('has a message for every problem, each short enough for the one-line status', () => {
    const problems = (['no-speech', 'no-microphone', 'blocked', 'offline', 'failed'] as const).map(speechProblemMessage);
    for (const message of [...problems, ...Object.values(VOICE_MESSAGES)]) {
      expect(message.length, message).toBeGreaterThan(10);
      expect(message.length, message).toBeLessThan(96);
    }
  });
});
