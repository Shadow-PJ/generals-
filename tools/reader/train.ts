// Trains the order reader on generated orders and writes its weights to models/order-reader.json.
//   npm run train:reader                              about a minute
//   npm run train:reader -- --count 30000 --epochs 8 --seed 1
//   npm run train:reader -- --check                   fails if the file isn't what training makes
//                                                     (CI runs this, so the weights always match the code)
// Training is deterministic: the same options always give the same file. The held-out test
// orders (natural.txt's test part, fresh.txt) are never read here; the training part of
// natural.txt only sets how sure the reader must be before it answers.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseOrder } from '../../src/cards/parser';
import { goalFeatures, stepFeatures, triggerFeatures, wordFeatures } from '../../src/cards/reader/features';
import { viterbi, type LinearWeights, type ReaderModel } from '../../src/cards/reader/model';
import { GOALS, GOALS_FOR, OrderReader, type Reading } from '../../src/cards/reader/reader';
import { TAGS } from '../../src/cards/reader/tags';
import { CLASS_OF, KnownWords, normalizeWords, SKILL_OF, splitOrder } from '../../src/cards/reader/words';
import { REGULAR_ACTIONS, TRIGGER_KINDS } from '../../src/cards/types';
import { generate } from '../dataset/generate';
import { cardKey, loadNatural, splitNatural } from '../dataset/natural';
import { taggedOrder } from './examples';
import { argmax, FeatureIds, shuffled, Weights } from './perceptron';

function option(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

export const TRAINING = {
  count: option('count', 30000),
  seed: option('seed', 1),
  epochs: option('epochs', 8),
  /** Weights are stored as whole numbers: the averaged weight times this, rounded. */
  scale: 100,
  /** How much worse a wrong card is than no card, when choosing how sure the reader must be. */
  wrongCardCost: 4,
};

const MODEL_FILE = fileURLToPath(new URL('../../models/order-reader.json', import.meta.url));

// Words ------------------------------------------------------------------------------------

/** The words of the orders without typos: everything the generator says, plus every word with a meaning. */
function knownWords(): KnownWords {
  const counts = new Map<string, number>();
  for (const pair of generate(TRAINING.count, TRAINING.seed, { typos: false })) {
    for (const w of splitOrder(pair.text)) if (w !== ',') counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  for (const w of [...Object.keys(CLASS_OF), ...Object.keys(SKILL_OF)]) counts.set(w, counts.get(w) ?? 0);
  const words = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([w]) => w);
  return new KnownWords(words);
}

// Training ---------------------------------------------------------------------------------

interface TaggerExample {
  features: Int32Array[];
  gold: number[];
}

function trainTagger(examples: readonly TaggerExample[], featureCount: number): { emit: Weights; transitions: Weights } {
  const k = TAGS.length;
  const emit = new Weights(k);
  // Transitions as features: one per "from" tag (0 = the start), weights per "to" tag.
  const transitions = new Weights(k);
  for (let f = 0; f <= k; f++) transitions.add(Int32Array.of(f), 0, 0);
  for (let epoch = 0; epoch < TRAINING.epochs; epoch++) {
    let mistakes = 0;
    for (const ex of shuffled(examples, TRAINING.seed + epoch)) {
      const scores = ex.features.map((f) => emit.scores(f));
      const trans = Array.from({ length: k + 1 }, (_, f) => transitions.scores(Int32Array.of(f)));
      const { path } = viterbi(scores, trans);
      let prevGold = -1;
      let prevPath = -1;
      let wrong = false;
      path.forEach((tag, i) => {
        const gold = ex.gold[i]!;
        if (tag !== gold) {
          wrong = true;
          emit.add(ex.features[i]!, gold, 1);
          emit.add(ex.features[i]!, tag, -1);
        }
        if (tag !== gold || prevPath !== prevGold) {
          transitions.add(Int32Array.of(prevGold + 1), gold, 1);
          transitions.add(Int32Array.of(prevPath + 1), tag, -1);
        }
        prevGold = gold;
        prevPath = tag;
      });
      if (wrong) mistakes++;
      emit.clock++;
      transitions.clock++;
    }
    console.log(`  tagger epoch ${epoch + 1}: ${mistakes} of ${examples.length} orders tagged wrong`);
  }
  void featureCount;
  return { emit, transitions };
}

interface ClassExample {
  features: Int32Array;
  gold: number;
  allowed?: readonly number[];
}

function trainClassifier(name: string, examples: readonly ClassExample[], labels: number): Weights {
  const weights = new Weights(labels);
  for (let epoch = 0; epoch < TRAINING.epochs; epoch++) {
    let mistakes = 0;
    for (const ex of shuffled(examples, TRAINING.seed + 100 + epoch)) {
      const guess = argmax(weights.scores(ex.features), ex.allowed);
      if (guess !== ex.gold) {
        mistakes++;
        weights.add(ex.features, ex.gold, 1);
        weights.add(ex.features, guess, -1);
      }
      weights.clock++;
    }
    if (epoch === TRAINING.epochs - 1) console.log(`  ${name}: ${mistakes} of ${examples.length} wrong in the last epoch`);
  }
  return weights;
}

/** Averaged weights as whole numbers, dropping the ones that round to nothing. */
function exportWeights(weights: Weights, ids: FeatureIds, labels: readonly string[]): LinearWeights {
  const out: Record<string, number[]> = {};
  for (let f = 0; f < weights.size; f++) {
    const avg = weights.averaged(f);
    const pairs: number[] = [];
    avg.forEach((w, label) => {
      const n = Math.round(w * TRAINING.scale);
      if (n !== 0) pairs.push(label, n);
    });
    if (pairs.length) out[ids.names[f]!] = pairs;
  }
  return { labels: [...labels], weights: out };
}

// How sure is sure enough ------------------------------------------------------------------

type Part = keyof ReaderModel['sureMargins'];
const PARTS: Part[] = ['tagger', 'trigger', 'action', 'goal'];

/**
 * The smallest margins that, on orders the parser can't read, give the most right cards for the
 * fewest wrong ones (a wrong card costs `wrongCardCost` right ones).
 */
function tuneSureMargins(readings: readonly { reading: Reading; right: boolean }[]): ReaderModel['sureMargins'] {
  const margins: ReaderModel['sureMargins'] = { tagger: 0, trigger: 0, action: 0, goal: 0 };
  const value = (m: ReaderModel['sureMargins']) =>
    readings.reduce((sum, { reading, right }) => {
      if (!reading.ok || PARTS.some((p) => reading.margins[p] < m[p])) return sum;
      return sum + (right ? 1 : -TRAINING.wrongCardCost);
    }, 0);
  for (let round = 0; round < 3; round++) {
    for (const part of PARTS) {
      const candidates = [0, ...new Set(readings.map((r) => r.reading.margins[part]).filter((m) => Number.isFinite(m)))].sort((a, b) => a - b);
      let best = margins[part];
      let bestValue = value(margins);
      for (const candidate of candidates) {
        const v = value({ ...margins, [part]: candidate });
        if (v > bestValue) {
          bestValue = v;
          best = candidate;
        }
      }
      margins[part] = best;
    }
  }
  return margins;
}

// Main -------------------------------------------------------------------------------------

export function train(): ReaderModel {
  console.log(`Generating ${TRAINING.count} orders (seed ${TRAINING.seed}) ...`);
  const orders = generate(TRAINING.count, TRAINING.seed).map(taggedOrder);
  const known = knownWords();
  for (const o of orders) o.words = normalizeWords(o.words, known);

  const taggerIds = new FeatureIds();
  const triggerIds = new FeatureIds();
  const actionIds = new FeatureIds();
  const goalIds = new FeatureIds();
  const taggerExamples: TaggerExample[] = [];
  const triggerExamples: ClassExample[] = [];
  const actionExamples: ClassExample[] = [];
  const goalExamples: ClassExample[] = [];
  for (const o of orders) {
    taggerExamples.push({ features: wordFeatures(o.words).map((f) => taggerIds.list(f, true)), gold: o.tags.map((t) => TAGS.indexOf(t)) });
    for (const t of o.triggers) {
      triggerExamples.push({ features: triggerIds.list(triggerFeatures(o.words, o.tags, t.segment), true), gold: TRIGGER_KINDS.indexOf(t.kind) });
    }
    const context = { previous: null as string | null, triggers: o.triggers.map((t) => t.kind) };
    for (const s of o.steps) {
      actionExamples.push({ features: actionIds.list(stepFeatures(o.words, o.tags, s.segment, context), true), gold: REGULAR_ACTIONS.indexOf(s.action) });
      const allowed = GOALS_FOR[s.action];
      if (allowed && s.goal) {
        goalExamples.push({
          features: goalIds.list(goalFeatures(o.words, o.tags, s.segment, s.action, context), true),
          gold: GOALS.indexOf(s.goal),
          allowed: allowed.map((g) => GOALS.indexOf(g)),
        });
      }
      context.previous = s.action;
    }
  }

  console.log('Training ...');
  const tagger = trainTagger(taggerExamples, taggerIds.names.length);
  const triggerWeights = trainClassifier('trigger kinds', triggerExamples, TRIGGER_KINDS.length);
  const actionWeights = trainClassifier('step actions', actionExamples, REGULAR_ACTIONS.length);
  const goalWeights = trainClassifier('step goals', goalExamples, GOALS.length);

  const transitions = Array.from({ length: TAGS.length + 1 }, (_, f) => [...tagger.transitions.averaged(f)].map((w) => Math.round(w * TRAINING.scale)));
  const model: ReaderModel = {
    version: 1,
    words: [...known.words],
    tagger: { ...exportWeights(tagger.emit, taggerIds, TAGS), transitions },
    trigger: exportWeights(triggerWeights, triggerIds, TRIGGER_KINDS),
    action: exportWeights(actionWeights, actionIds, REGULAR_ACTIONS),
    goal: exportWeights(goalWeights, goalIds, GOALS),
    sureMargins: { tagger: 0, trigger: 0, action: 0, goal: 0 },
  };

  // How sure it must be: tuned on the hand-written training orders the parser can't read.
  const unsure = new OrderReader(model);
  const natural = splitNatural(loadNatural()).train.filter((e) => !parseOrder(e.text).ok);
  const readings = natural.map((e) => {
    const reading = unsure.read(e.text);
    return { reading, right: reading.ok && cardKey(reading.card) === cardKey(e.card) };
  });
  model.sureMargins = tuneSureMargins(readings);
  const sure = new OrderReader(model);
  const report = (name: string, results: readonly { ok: boolean; right: boolean }[]) => {
    const right = results.filter((r) => r.right).length;
    const wrong = results.filter((r) => r.ok && !r.right).length;
    console.log(`  ${name}: ${right} of ${results.length} right (${((100 * right) / results.length).toFixed(1)}%), ${wrong} wrong cards, ${results.length - right - wrong} refused`);
  };
  console.log(`Sure margins: ${JSON.stringify(model.sureMargins)}`);
  report('natural.txt training part the parser cannot read, before the sure margins', readings.map((r) => ({ ok: r.reading.ok, right: r.right })));
  report(
    'natural.txt training part the parser cannot read',
    natural.map((e) => {
      const r = sure.read(e.text);
      return { ok: r.ok, right: r.ok && cardKey(r.card) === cardKey(e.card) };
    }),
  );
  const dev = generate(2000, TRAINING.seed + 1000);
  report(
    'generated orders it has not seen',
    dev.map((p) => {
      const r = sure.read(p.text);
      return { ok: r.ok, right: r.ok && cardKey(r.card) === cardKey(p.card) };
    }),
  );
  return model;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const started = Date.now();
  const model = train();
  const json = JSON.stringify(model);
  if (process.argv.includes('--check')) {
    const committed = existsSync(MODEL_FILE) ? readFileSync(MODEL_FILE, 'utf8') : '';
    if (committed !== json) {
      console.error('models/order-reader.json is not what training makes from this code. Run `npm run train:reader` and commit the file.');
      process.exit(1);
    }
    console.log('models/order-reader.json matches what training makes from this code.');
    process.exit(0);
  }
  mkdirSync(fileURLToPath(new URL('../../models/', import.meta.url)), { recursive: true });
  writeFileSync(MODEL_FILE, json);
  const features = Object.keys(model.tagger.weights).length + Object.keys(model.trigger.weights).length + Object.keys(model.action.weights).length + Object.keys(model.goal.weights).length;
  console.log(`Wrote models/order-reader.json: ${(json.length / 1024).toFixed(0)} KB, ${features} features, ${model.words.length} known words, in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
