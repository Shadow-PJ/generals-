// Translators turn your words into a card, literally (docs/DESIGN.md, How orders become cards).
// The rule parser reads simple sentences; the order reader (a small trained model) reads most
// free-form ones; an experimental language model can be switched on after them. All give the
// same card format, and the validator always runs after them.

import { CARD_GRAMMAR, cardFromModelOutput, promptFor, type ChatMessage } from './modelFormat';
import { parseOrder, type ParseResult } from './parser';

export type TranslatorName = 'parser' | 'reader' | 'model';

export interface Translator {
  readonly name: TranslatorName;
  translate(text: string): Promise<ParseResult>;
}

/** A translation and who made it. */
export type Translation = ParseResult & { by: TranslatorName; note?: string };

export const ruleParser: Translator = {
  name: 'parser',
  translate: async (text) => parseOrder(text),
};

/** Anything that answers a chat with text forced to match a grammar: the small model, or a stand-in in tests. */
export interface GrammarModel {
  complete(messages: ChatMessage[], grammar: string, maxTokens: number): Promise<string>;
}

/** Enough room for the longest card: a condition with two triggers and three steps. */
export const MODEL_MAX_TOKENS = 320;

/** The small model as a translator: the order goes in with the prompt, a card comes out, or a refusal. */
export function modelTranslator(model: GrammarModel): Translator {
  return {
    name: 'model',
    async translate(text) {
      const output = await model.complete(promptFor(text), CARD_GRAMMAR, MODEL_MAX_TOKENS);
      return cardFromModelOutput(output, text);
    },
  };
}

/** The order reader as a translator: its card, or why it didn't make one, and nothing else. */
export function readerTranslator(reader: { read(text: string): ParseResult }): Translator {
  return {
    name: 'reader',
    async translate(text) {
      const reading = reader.read(text);
      return reading.ok ? { ok: true, card: reading.card } : { ok: false, error: reading.error };
    },
  };
}

const LABELS: Record<TranslatorName, string> = { parser: 'The parser', reader: 'The order reader', model: 'The model' };

/**
 * The rule parser first. An order it can't read goes to the next translator in `others` (the
 * order reader, then the experimental model when it is on) until one reads it. A translator that
 * fails, throws or takes longer than `timeoutMs` passes the order on. When none reads it, you get
 * the parser's answer, with a note when the model was asked.
 */
export async function translateOrder(text: string, others: readonly (Translator | null)[], timeoutMs: number): Promise<Translation> {
  const parsed = parseOrder(text);
  if (parsed.ok || text.trim() === '') return { ...parsed, by: 'parser' };
  let note: string | undefined;
  for (const translator of others) {
    if (!translator) continue;
    const label = LABELS[translator.name];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tooSlow = new Promise<'tooSlow'>((resolve) => {
      timer = setTimeout(() => resolve('tooSlow'), timeoutMs);
    });
    try {
      const result = await Promise.race([translator.translate(text), tooSlow]);
      if (result === 'tooSlow') note = `${label} took too long, so the parser answered.`;
      else if (result.ok) return { ...result, by: translator.name };
      // The order reader refusing is normal: it says so whenever it isn't sure.
      else if (translator.name === 'model') note = `${label} couldn't read it either: ${result.error}`;
    } catch (error) {
      note = `${label} failed (${String(error)}), so the parser answered.`;
    } finally {
      clearTimeout(timer);
    }
  }
  return note ? { ...parsed, by: 'parser', note } : { ...parsed, by: 'parser' };
}
