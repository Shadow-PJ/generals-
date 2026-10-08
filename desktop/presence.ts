// What the game sends as presence (src/platform/store.ts), checked before any store sees it: a
// line by name and the words that fill it in. Steam keeps the lines' text itself, in the rich
// presence file uploaded to Steamworks (docs/store/steam/rich-presence-english.vdf); Epic takes
// finished text, written here from the same lines (a test checks the two match).

import type { DesktopPresence } from '../src/platform/bridge.js';

const PRESENCE_LINE = /^[A-Za-z0-9_]{1,40}$/;
const PRESENCE_KEY = /^[a-z][a-z0-9_]{0,31}$/;
/** Steam keeps at most 20 presence keys a player, steam_display among them, each value up to 256 characters. */
const MAX_PRESENCE_PARAMS = 19;
const MAX_PRESENCE_VALUE = 256;

/** A presence sent by the game, if it is well formed; anything else is dropped. */
export function readPresence(value: unknown): DesktopPresence | null {
  if (typeof value !== 'object' || value === null) return null;
  const { line, params } = value as { line?: unknown; params?: unknown };
  if (typeof line !== 'string' || !PRESENCE_LINE.test(line) || typeof params !== 'object' || params === null) return null;
  const entries = Object.entries(params);
  if (entries.length > MAX_PRESENCE_PARAMS) return null;
  for (const [key, text] of entries) {
    if (!PRESENCE_KEY.test(key) || key === 'steam_display' || typeof text !== 'string' || text.length > MAX_PRESENCE_VALUE) return null;
  }
  return { line, params: Object.fromEntries(entries) as Record<string, string> };
}

/** Each presence line in English, with %word% where the game's words go. */
export const PRESENCE_TEXT: Readonly<Record<string, string>> = {
  Capital: 'In the Capital',
  Run: 'On a run in %region%',
  Boss: 'Facing %ruler% in %region%',
  Skirmish: 'Practising in a skirmish',
  Versus: 'In a versus match',
};

/**
 * The presence as finished text, at most `maxLength` characters, or null for a line this
 * build doesn't know or one missing its words.
 */
export function presenceText(presence: DesktopPresence, maxLength: number): string | null {
  if (!Object.hasOwn(PRESENCE_TEXT, presence.line)) return null;
  const template = PRESENCE_TEXT[presence.line]!;
  let missing = false;
  const text = template.replace(/%([a-z0-9_]+)%/g, (_, key: string) => {
    const word = Object.hasOwn(presence.params, key) ? presence.params[key] : undefined;
    if (word === undefined) missing = true;
    return word ?? '';
  });
  return missing ? null : text.slice(0, maxLength);
}
