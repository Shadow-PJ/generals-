// Speech to text, for speaking orders (session 3D). The browser build uses the browser's own
// speech recognition (the Web Speech API) where it has one: Chrome, Edge and Safari do, Firefox
// doesn't. The browser may send the sound to its maker's speech service to turn it into words;
// the game itself sends nothing anywhere. The desktop app has none yet: Electron's Chromium has
// the API but not the service behind it, so there the player types.

/** Why listening gave no words. */
export type SpeechProblem = 'no-speech' | 'no-microphone' | 'blocked' | 'offline' | 'failed';

export type SpeechResult = { ok: true; text: string } | { ok: false; problem: SpeechProblem };

export interface Listening {
  /** Stops listening; the words heard so far come to `onEnd`. */
  stop(): void;
  /** Stops listening and throws the words away: `onEnd` is not called. */
  cancel(): void;
}

export interface SpeechInput {
  /** Starts listening to the microphone. */
  listen(handlers: {
    /** The words so far, as they are heard. */
    onWords(text: string): void;
    /** Listening ended: the words heard, or why there are none. Called once, unless cancelled. */
    onEnd(result: SpeechResult): void;
  }): Listening;
}

/** The parts of the Web Speech API the game uses (TypeScript's DOM types don't include it). */
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type RecognitionConstructor = new () => RecognitionLike;

/** The browser's speech recognition, if it has one. */
export function browserRecognition(scope: object = globalThis): RecognitionConstructor | undefined {
  const w = scope as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const PROBLEMS: Readonly<Record<string, SpeechProblem>> = {
  'no-speech': 'no-speech',
  'audio-capture': 'no-microphone',
  'not-allowed': 'blocked',
  'service-not-allowed': 'blocked',
  network: 'offline',
};

/** Speech input on the Web Speech API, or null when there is no recognition to use. */
export function webSpeech(Recognition: RecognitionConstructor | undefined, lang = 'en-US'): SpeechInput | null {
  if (!Recognition) return null;
  return {
    listen({ onWords, onEnd }) {
      const recognition = new Recognition();
      recognition.lang = lang;
      // Keep listening while the talk key is held, and show the words as they come.
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      let words = '';
      let problem: SpeechProblem | null = null;
      let ended = false;
      let cancelled = false;
      const end = () => {
        if (ended) return;
        ended = true;
        if (!cancelled) onEnd(words ? { ok: true, text: words } : { ok: false, problem: problem ?? 'no-speech' });
      };
      recognition.onresult = (event) => {
        words = Array.from(event.results, (result) => result[0]?.transcript ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!cancelled) onWords(words);
      };
      recognition.onerror = (event) => {
        problem ??= PROBLEMS[event.error] ?? 'failed';
      };
      recognition.onend = end;
      try {
        recognition.start();
      } catch {
        problem = 'failed';
        queueMicrotask(end);
      }
      return {
        stop: () => recognition.stop(),
        cancel: () => {
          cancelled = true;
          recognition.abort();
        },
      };
    },
  };
}
