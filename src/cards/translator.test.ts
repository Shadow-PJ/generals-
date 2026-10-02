import { describe, expect, it } from 'vitest';
import { parseOrder } from './parser';
import { CARD_GRAMMAR } from './modelFormat';
import { modelTranslator, readerTranslator, ruleParser, translateOrder, type Translator } from './translator';
import type { Card } from './types';

const holdCard: Card = { condition: null, steps: [{ action: 'hold', actors: { kind: 'all' } }], auto: false };

function fakeModel(behaviour: 'hold' | 'fail' | 'throw' | 'slow'): Translator & { calls: string[] } {
  const calls: string[] = [];
  return {
    name: 'model',
    calls,
    async translate(text) {
      calls.push(text);
      if (behaviour === 'throw') throw new Error('out of memory');
      if (behaviour === 'fail') return { ok: false, error: 'not a card' };
      if (behaviour === 'slow') await new Promise((resolve) => setTimeout(resolve, 200));
      return { ok: true, card: { text, ...holdCard } };
    },
  };
}

const FREE_FORM = 'yo team just chill where u are for a sec';

describe('translators', () => {
  it('the rule parser is a translator with the same card output', async () => {
    expect(await ruleParser.translate('Hold the line')).toEqual(parseOrder('Hold the line'));
  });

  it('read simple orders with the parser, without asking the model', async () => {
    const model = fakeModel('hold');
    const result = await translateOrder('Everyone fall back', [model], 1000);
    expect(result).toMatchObject({ ok: true, by: 'parser' });
    expect(model.calls).toEqual([]);
  });

  it('send orders the parser cannot read to the model', async () => {
    expect(parseOrder(FREE_FORM).ok).toBe(false);
    const result = await translateOrder(FREE_FORM, [fakeModel('hold')], 1000);
    expect(result).toMatchObject({ ok: true, by: 'model', card: { text: FREE_FORM, steps: holdCard.steps } });
  });

  it('fall back to the parser when there is no model, it fails, throws or is too slow', async () => {
    const parserAnswer = parseOrder(FREE_FORM);
    expect(await translateOrder(FREE_FORM, [null], 1000)).toEqual({ ...parserAnswer, by: 'parser' });
    for (const behaviour of ['fail', 'throw', 'slow'] as const) {
      const result = await translateOrder(FREE_FORM, [fakeModel(behaviour)], 50);
      expect(result, behaviour).toMatchObject({ ok: false, by: 'parser' });
      expect(result.note, behaviour).toBeTruthy();
    }
  });

  it('ask the order reader next, and the model only for what the reader refuses', async () => {
    const holdReader = readerTranslator({ read: (text) => ({ ok: true, card: { text, ...holdCard } }) });
    const refusingReader = readerTranslator({ read: () => ({ ok: false, error: "I didn't catch that order." }) });
    const model = fakeModel('hold');
    expect(await translateOrder(FREE_FORM, [holdReader, model], 1000)).toMatchObject({ ok: true, by: 'reader' });
    expect(model.calls).toEqual([]);
    expect(await translateOrder(FREE_FORM, [refusingReader, model], 1000)).toMatchObject({ ok: true, by: 'model' });
    expect(model.calls).toEqual([FREE_FORM]);
    // With no model, a refusal leaves the parser's answer, quietly.
    expect(await translateOrder(FREE_FORM, [refusingReader, null], 1000)).toEqual({ ...parseOrder(FREE_FORM), by: 'parser' });
  });

  it('pass on only the card from the reader, not its working', async () => {
    const reading = { ok: true as const, card: { text: 'chill', ...holdCard }, sureness: 3, words: ['chill'] };
    const reader = readerTranslator({ read: () => reading });
    expect(await reader.translate('chill')).toEqual({ ok: true, card: { text: 'chill', ...holdCard } });
  });

  it('do not bother the model with an empty order', async () => {
    const model = fakeModel('hold');
    expect(await translateOrder('   ', [model], 1000)).toMatchObject({ ok: false, by: 'parser' });
    expect(model.calls).toEqual([]);
  });
});

describe('the model translator', () => {
  it('asks the model with the prompt and the card grammar, and reads its JSON into a card', async () => {
    const asked: unknown[] = [];
    const model = modelTranslator({
      async complete(messages, grammar) {
        asked.push(messages.at(-1), grammar);
        return JSON.stringify({ condition: null, steps: holdCard.steps });
      },
    });
    expect(await model.translate('chill there')).toEqual({ ok: true, card: { text: 'chill there', ...holdCard } });
    expect(asked).toEqual([{ role: 'user', content: 'chill there' }, CARD_GRAMMAR]);
  });

  it('refuses whatever is not a card', async () => {
    const model = modelTranslator({ complete: async () => 'I think they should hold' });
    expect((await model.translate('chill there')).ok).toBe(false);
  });
});
