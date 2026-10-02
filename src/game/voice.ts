// Push-to-talk for orders (session 3D): hold the talk key (or the Talk button), say the order,
// let go. The words show in the order box as they are heard, and the order is read the moment
// you let go, by the same translators as a typed one. Speech comes from the platform; where
// there is none, pressing the key says so, and you type as before.

import type { Listening, SpeechInput, SpeechProblem } from '../platform';
import { keyLabel } from './bindings';

export interface VoiceEvents {
  /** The words heard so far, while listening. */
  onWords(text: string): void;
  /** The whole order, once you let go. */
  onOrder(text: string): void;
  /** Something to show the player: that it is listening, or why there are no words. */
  onStatus(message: string, problem: boolean): void;
}

const KEY = keyLabel('talk');

/** Messages for the Orders screen's status line, which shows one line: keep each under 96 characters. */
export const VOICE_MESSAGES = {
  listening: `Listening (your browser turns speech into words)… let go of ${KEY} when you're done.`,
  finishing: 'Reading what you said…',
  noSpeechInBrowser: "This browser can't hear orders. Type them, or use Chrome or Edge to speak them.",
  noSpeechInApp: "The desktop app can't hear orders yet. Type them (speaking works in the browser version).",
} as const;

const PROBLEMS: Readonly<Record<SpeechProblem, string>> = {
  'no-speech': `I didn't hear anything. Hold ${KEY} while you speak, then let go.`,
  'no-microphone': 'No microphone found. Plug one in, or type your order.',
  blocked: 'The microphone is blocked. Allow it for this page, or type your order.',
  offline: "Your browser's speech service needs the internet. Type your order instead.",
  failed: "Speech recognition didn't work this time. Try again, or type your order.",
};

export function speechProblemMessage(problem: SpeechProblem): string {
  return PROBLEMS[problem];
}

export class PushToTalk {
  private listening: Listening | null = null;
  /** True from the press until the words are in, including the moment after you let go. */
  private active = false;
  private held = false;

  constructor(
    private readonly speech: SpeechInput | null,
    private readonly events: VoiceEvents,
    /** What to say when there is no speech recognition here. */
    private readonly unavailable: string,
  ) {}

  get available(): boolean {
    return this.speech !== null;
  }

  /** True while listening or reading what was said. */
  get busy(): boolean {
    return this.active;
  }

  press(): void {
    if (!this.speech) return this.events.onStatus(this.unavailable, true);
    if (this.active) return;
    this.active = true;
    this.held = true;
    this.events.onStatus(VOICE_MESSAGES.listening, false);
    this.listening = this.speech.listen({
      onWords: (text) => this.events.onWords(text),
      onEnd: (result) => {
        this.active = false;
        this.held = false;
        this.listening = null;
        if (result.ok) this.events.onOrder(result.text);
        else this.events.onStatus(speechProblemMessage(result.problem), true);
      },
    });
  }

  release(): void {
    if (!this.held) return;
    this.held = false;
    this.events.onStatus(VOICE_MESSAGES.finishing, false);
    this.listening?.stop();
  }

  /** Stops listening and forgets the words, when the screen closes. */
  cancel(): void {
    this.listening?.cancel();
    this.listening = null;
    this.active = false;
    this.held = false;
  }
}
