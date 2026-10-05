import { describe, expect, it } from 'vitest';
import modelJson from '../../../models/order-reader.json?raw';
import freshText from '../../../tools/dataset/fresh.txt?raw';
import legendaryText from '../../../tools/dataset/legendary.txt?raw';
import naturalText from '../../../tools/dataset/natural.txt?raw';
import { cardKey, loadNatural, splitNatural } from '../../../tools/dataset/natural';
import { describeCard } from '../describe';
import { parseOrder } from '../parser';
import { readCard } from '../schema';
import { validateCard } from '../validator';
import type { ReaderModel } from './model';
import { OrderReader } from './reader';

const model = JSON.parse(modelJson) as ReaderModel;
const reader = new OrderReader(model);

function read(text: string): string {
  const r = reader.read(text);
  return r.ok ? describeCard(r.card) : `refused: ${r.error}`;
}

/** What the game does: the parser first, the reader for what the parser can't read. */
function chain(examples: ReturnType<typeof loadNatural>) {
  let right = 0;
  let wrongByReader = 0;
  for (const e of examples) {
    const parsed = parseOrder(e.text);
    const result = parsed.ok ? parsed : reader.read(e.text);
    if (result.ok && cardKey(result.card) === cardKey(e.card)) right++;
    else if (result.ok && !parsed.ok) wrongByReader++;
  }
  return { accuracy: right / examples.length, wrongByReader };
}

describe('the order reader', () => {
  it('reads free-form orders the rule parser cannot', () => {
    expect(parseOrder('yo rangers pull back to the healer asap').ok).toBe(false);
    expect(read('yo rangers pull back to the healer asap')).toBe('Rangers fall back to your Guardians');
    expect(read('drop their ranger asap')).toBe('Focus enemy Rangers');
    expect(read('healers babysit the snipers')).toBe('Guardians protect your Rangers');
    expect(read('if their ult is about to go off, everybody back off')).toBe('When the enemy ultimate is charging: Fall back');
    expect(read('burn down their mage then their healer')).toBe('Focus enemy Invokers, then Focus enemy Guardians');
    expect(read('when my archer is in trouble, call in a fresh ranger')).toBe('When your Ranger drops below 40% HP: Call the reserve Ranger');
  });

  it('reads Legendary orders: Hijack, Swap, Blood Pact, Fortify and Echo (session 6A)', () => {
    expect(read('take control of their archer')).toBe('Hijack an enemy Ranger');
    expect(read('mind control the closest enemy')).toBe('Hijack the nearest enemy');
    expect(read('swap my tank with my archer')).toBe('Swap your Vanguard with your Ranger');
    expect(read('when my healer drops below 30%, sacrifice my weakest troop')).toBe('When your Guardian drops below 30% HP: Blood Pact: sacrifice your weakest troop');
    expect(read('put up a wall in front of us')).toBe('Fortify: raise a wall in front of your army');
    expect(read('do that again')).toBe('Echo your last card');
  });

  it('refuses Legendary orders the rules do not allow, as the rule parser does', () => {
    // Hijack, Blood Pact, Fortify and Echo are the commander's own: no troops carry them out.
    expect(read('rangers, hijack their vanguard')).toBe(`refused: I didn't catch that order. Hijack is yours to do: don't name troops for it.`);
    expect(read('tanks build a wall')).toBe(`refused: I didn't catch that order. Fortify is yours to do: don't name troops for it.`);
    // Swap trades places between two of your troops, never with an enemy.
    expect(read('swap places with their mage')).toMatch(/^refused: .*two of your own troops/);
  });

  it('fixes typos and reads chat spellings', () => {
    expect(read('rangrs retreat')).toBe('Rangers fall back');
  });

  it('reads the HP threshold from what happens, not from "one of"', () => {
    expect(read('when one of my troops drops below 40%, guardians protect them')).toBe('When any ally drops below 40% HP: Guardians protect that ally');
  });

  it('reads literally: no condition or step that is not in the words', () => {
    expect(read('kill their healer')).toBe('Focus enemy Guardians');
    expect(read('tanks get behind enemy lines')).toBe('Vanguards move behind the enemy');
  });

  it('refuses rather than guesses', () => {
    for (const text of ['the weather is nice today', 'blorp the zibble', '']) {
      expect(reader.read(text).ok, text).toBe(false);
    }
    // An unknown word where who acts or what they do should be: ask, don't leave it out.
    expect(read('flurbs fall back')).toBe(`refused: I didn't catch that order. I don't know the word "flurbs".`);
    // "him" needs a condition that names him.
    expect(read('kill him')).toMatch(/^refused: .*Who is/);
  });

  it('makes plain cards in the card format, with the words they came from', () => {
    for (const e of loadNatural(naturalText)) {
      const r = reader.read(e.text);
      if (!r.ok) continue;
      expect(r.card.text).toBe(e.text.trim());
      expect(readCard(JSON.parse(JSON.stringify(r.card))), e.text).toEqual(r.card);
    }
  });

  it('leaves rank rules to the validator: a long order makes a long card', () => {
    const r = reader.read('archers pull back, tanks hold the line, healers babysit the archers, then everybody smack the closest');
    expect(r.ok && r.card.steps.length).toBe(4);
    expect(r.ok && validateCard(r.card, 5)).toMatchObject({ ok: false, problems: [{ kind: 'tooManySteps' }] });
  });

  // Floors a little under the measured results (docs/model-eval-3c.md, with the 6A section), so retraining can move
  // them slightly; a real drop fails here.
  it('reads most held-out orders right, with few wrong cards', () => {
    const test = chain(splitNatural(loadNatural(naturalText)).test);
    expect(test.accuracy).toBeGreaterThan(0.85);
    expect(test.wrongByReader).toBeLessThanOrEqual(5);
    const fresh = chain(loadNatural(freshText));
    expect(fresh.accuracy).toBeGreaterThan(0.9);
    expect(fresh.wrongByReader).toBeLessThanOrEqual(3);
    // Hand-written before the reader learned Legendary orders, never trained on (session 6A).
    const legendary = chain(loadNatural(legendaryText));
    expect(legendary.accuracy).toBeGreaterThan(0.85);
    expect(legendary.wrongByReader).toBeLessThanOrEqual(2);
  });

  it('is small and quick: under 5 MB, and well under 10 ms an order', () => {
    expect(modelJson.length).toBeLessThan(5 * 1024 * 1024);
    const orders = loadNatural(naturalText).slice(0, 300);
    const start = performance.now();
    for (const e of orders) reader.read(e.text);
    expect((performance.now() - start) / orders.length).toBeLessThan(10);
  });
});
