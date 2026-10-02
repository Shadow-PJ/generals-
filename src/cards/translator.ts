// Translators turn your words into a card, literally (docs/DESIGN.md, How orders become cards).
// The rule parser reads simple sentences at once; a small model on your computer can read
// free-form ones. Both give the same card format, and the validator always runs after them.

import { CARD_GRAMMAR, cardFromModelOutput, promptFor, type ChatMessage } from './modelFormat';
import { parseOrder, type ParseResult } from './parser';

export type TranslatorName = 'parser' | 'model';

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

/**
 * The rule parser first; an order it can't read goes to the model. When there is no model, or it
 * fails, or it takes longer than `timeoutMs`, you get the parser's answer instead.
 */
export async function translateOrder(text: string, model: Translator | null, timeoutMs: number): Promise<Translation> {
  const parsed = parseOrder(text);
  if (parsed.ok || !model || text.trim() === '') return { ...parsed, by: 'parser' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tooSlow = new Promise<'tooSlow'>((resolve) => {
    timer = setTimeout(() => resolve('tooSlow'), timeoutMs);
  });
  try {
    const result = await Promise.race([model.translate(text), tooSlow]);
    if (result === 'tooSlow') return { ...parsed, by: 'parser', note: 'The model took too long, so the parser answered.' };
    if (result.ok) return { ...result, by: 'model' };
    return { ...parsed, by: 'parser', note: `The model couldn't read it either: ${result.error}` };
  } catch (error) {
    return { ...parsed, by: 'parser', note: `The model failed (${String(error)}), so the parser answered.` };
  } finally {
    clearTimeout(timer);
  }
}
