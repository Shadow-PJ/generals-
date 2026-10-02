// Averaged perceptrons, for training the order reader. A perceptron guesses, and when it guesses
// wrong it moves weight from the wrong answer's features to the right answer's. Averaging the
// weights over all of training makes the final model steadier than the last weights alone.

/** Feature names as numbers. */
export class FeatureIds {
  private readonly ids = new Map<string, number>();
  readonly names: string[] = [];

  /** The feature's number; a new feature gets the next number when `add` is true, else -1. */
  id(name: string, add: boolean): number {
    let id = this.ids.get(name);
    if (id === undefined) {
      if (!add) return -1;
      id = this.names.length;
      this.ids.set(name, id);
      this.names.push(name);
    }
    return id;
  }

  list(names: readonly string[], add: boolean): Int32Array {
    return Int32Array.from(names.map((n) => this.id(n, add)).filter((id) => id >= 0));
  }
}

/** Weights for each feature and label, averaged over training with the usual timestamp trick. */
export class Weights {
  private readonly w: Float64Array[] = [];
  private readonly u: Float64Array[] = [];
  /** How many examples have been seen; updates are stamped with it. */
  clock = 1;

  constructor(readonly labels: number) {}

  private rows(f: number): [Float64Array, Float64Array] {
    while (this.w.length <= f) {
      this.w.push(new Float64Array(this.labels));
      this.u.push(new Float64Array(this.labels));
    }
    return [this.w[f]!, this.u[f]!];
  }

  /** The current score of each label. */
  scores(features: Int32Array): Float64Array {
    const out = new Float64Array(this.labels);
    for (const f of features) {
      const row = this.w[f];
      if (!row) continue;
      for (let l = 0; l < this.labels; l++) out[l]! += row[l]!;
    }
    return out;
  }

  add(features: Int32Array, label: number, amount: number): void {
    for (const f of features) {
      const [w, u] = this.rows(f);
      w[label]! += amount;
      u[label]! += amount * this.clock;
    }
  }

  /** The averaged weights of one feature. */
  averaged(f: number): Float64Array {
    const out = new Float64Array(this.labels);
    const w = this.w[f];
    const u = this.u[f];
    if (!w || !u) return out;
    for (let l = 0; l < this.labels; l++) out[l] = w[l]! - u[l]! / this.clock;
    return out;
  }

  get size(): number {
    return this.w.length;
  }
}

/** The index of the highest score among the allowed labels (all when `allowed` is missing). */
export function argmax(scores: ArrayLike<number>, allowed?: readonly number[]): number {
  let best = -1;
  for (let l = 0; l < scores.length; l++) {
    if (allowed && !allowed.includes(l)) continue;
    if (best < 0 || scores[l]! > scores[best]!) best = l;
  }
  return best;
}

/** A seeded shuffle, so training is the same every run. */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
