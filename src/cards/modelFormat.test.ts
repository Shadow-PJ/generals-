import { describe, expect, it } from 'vitest';
import naturalText from '../../tools/dataset/natural.txt?raw';
import { cardFromModelOutput, CARD_JSON_SCHEMA, PROMPT_EXAMPLES, promptFor } from './modelFormat';
import { readCard } from './schema';
import { validateCard } from './validator';

const natural = naturalText.toLowerCase();

describe('the model card format', () => {
  it('has worked examples that are legal cards and not in the test data', () => {
    for (const example of PROMPT_EXAMPLES) {
      expect(validateCard({ ...example.card, auto: false }, 5).ok, example.text).toBe(true);
      expect(natural.includes(example.text.toLowerCase()), example.text).toBe(false);
    }
  });

  it('builds a chat: the format, each example as a question and answer, then the order', () => {
    const messages = promptFor('  kill their healer ');
    expect(messages[0]!.role).toBe('system');
    expect(messages).toHaveLength(2 + PROMPT_EXAMPLES.length * 2);
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'kill their healer' });
    expect(JSON.parse(messages[2]!.content)).toEqual(PROMPT_EXAMPLES[0]!.card);
  });

  it('reads a card from the model output and attaches the words', () => {
    const output = JSON.stringify(PROMPT_EXAMPLES[4]!.card);
    const result = cardFromModelOutput(output, 'whenever they clump, tanks shove then hit the closest one');
    expect(result).toEqual({ ok: true, card: { text: 'whenever they clump, tanks shove then hit the closest one', ...PROMPT_EXAMPLES[4]!.card, auto: false } });
  });

  it('refuses output that is not a card, and never lets the model set Auto', () => {
    expect(cardFromModelOutput('Sure! Here is your card', 'x').ok).toBe(false);
    expect(cardFromModelOutput('{"steps":"focus"}', 'x').ok).toBe(false);
    const sneaky = cardFromModelOutput(JSON.stringify({ ...PROMPT_EXAMPLES[0]!.card, auto: true }), 'x');
    expect(sneaky.ok && sneaky.card.auto).toBe(false);
  });

  it('has a schema whose every choice is a card the reader accepts', () => {
    // Walk the schema and build one sample per branch, then check the reader takes it.
    const sample = (s: Record<string, unknown>, pick: number): unknown => {
      if ('const' in s) return s.const;
      if ('enum' in s) return (s.enum as unknown[])[pick % (s.enum as unknown[]).length];
      if ('anyOf' in s) {
        const options = s.anyOf as Record<string, unknown>[];
        return sample(options[pick % options.length]!, pick);
      }
      if (s.type === 'null') return null;
      if (s.type === 'boolean') return pick % 2 === 0;
      if (s.type === 'array') return [sample(s.items as Record<string, unknown>, pick)];
      if (s.type === 'object') {
        const props = s.properties as Record<string, Record<string, unknown>>;
        return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, sample(v, pick)]));
      }
      throw new Error(`unknown schema ${JSON.stringify(s)}`);
    };
    for (let pick = 0; pick < 40; pick++) {
      const card = sample(CARD_JSON_SCHEMA, pick) as object;
      expect(readCard({ ...card, auto: false }), JSON.stringify(card)).not.toBeNull();
    }
  });
});
