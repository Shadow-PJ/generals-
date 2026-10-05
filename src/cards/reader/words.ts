// The order reader's words: how an order is split into words, how typos are fixed against the
// words the reader knows, and the few word lists that carry a value the card needs (troop
// classes, numbers, "hurt" = 50% HP). Everything else the reader learns from examples.

import { HURT_WORDS } from '../../data/cards';
import type { TroopClass } from '../../data/units';
import { CLASS_WORDS, NUMBER_WORDS } from '../vocabulary';

/** Words as written, before commas are tidied: punctuation becomes a comma, "%" becomes "percent". */
export function rawWords(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[‘’`´']/g, '')
    .replace(/%/g, ' percent ')
    .replace(/\+/g, ' or more ')
    .replace(/&/g, ' and ');
  return cleaned.match(/\d+|[a-z]+|[.,!?;:\-–—/()"…]+/g)?.map((t) => (/^[a-z\d]/.test(t) ? t : ',')) ?? [];
}

/** Which raw words to keep: no comma at either end, and never two in a row. */
export function keptWords(words: readonly string[]): number[] {
  const kept: number[] = [];
  for (const [i, w] of words.entries()) {
    if (w === ',' && (kept.length === 0 || words[kept.at(-1)!] === ',')) continue;
    kept.push(i);
  }
  while (kept.length > 0 && words[kept.at(-1)!] === ',') kept.pop();
  return kept;
}

/** An order as lowercase words, numbers and commas. */
export function splitOrder(text: string): string[] {
  const words = rawWords(text);
  return keptWords(words).map((i) => words[i]!);
}

/** Chat spellings, read as the word they stand for. */
const SHORT_FORMS: Readonly<Record<string, string>> = {
  u: 'you', ur: 'your', r: 'are', ya: 'you', pls: 'please', plz: 'please', em: 'them', thru: 'through', n: 'and',
  da: 'the', tha: 'the', rdy: 'ready',
};

/** The words a reader knows, most common first, for fixing typos. */
export class KnownWords {
  private readonly rank = new Map<string, number>();

  constructor(readonly words: readonly string[]) {
    words.forEach((w, i) => this.rank.set(w, i));
  }

  has(word: string): boolean {
    return this.rank.has(word);
  }

  /**
   * The known word a typo most likely meant: the closest one (letters swapped, missing, extra or
   * wrong). On a tie, one with the same first letter (people rarely miss the first one), then the
   * most common. Words up to 7 letters may be off by one letter, longer ones by two; in words of
   * 4 letters or fewer a wrong letter doesn't count, since "turn" isn't a typo of "burn".
   */
  closest(word: string): string | undefined {
    if (word.length < 3 || /\d/.test(word)) return undefined;
    const limit = word.length >= 8 ? 2 : 1;
    let best: string | undefined;
    let bestScore = Infinity;
    for (const known of this.words) {
      if (Math.abs(known.length - word.length) > limit || known.length < 3) continue;
      const d = editDistance(word, known, limit);
      if (d > limit) continue;
      if (word.length <= 4 && known.length === word.length && !sameLetters(word, known)) continue;
      const score = d * 2 + (known[0] === word[0] ? 0 : 1);
      if (score < bestScore) {
        best = known;
        bestScore = score;
      }
    }
    return best;
  }
}

/** Short forms spelled out, then each unknown word replaced by the known word it most likely meant. */
export function normalizeWords(words: readonly string[], known: KnownWords): string[] {
  return words.map((w) => {
    const word = SHORT_FORMS[w] ?? w;
    if (word === ',' || known.has(word)) return word;
    return known.closest(word) ?? word;
  });
}

function sameLetters(a: string, b: string): boolean {
  return [...a].sort().join('') === [...b].sort().join('');
}

/** Letters to change, add, drop or swap (adjacent) to turn `a` into `b`; more than `max` returns max + 1. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2]! + 1);
      row.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return Math.min(prev[b.length]!, max + 1);
}

// Words with a value ------------------------------------------------------------------------

/** Troop class words: the parser's, plus slang. */
export const CLASS_OF: Readonly<Record<string, TroopClass>> = {
  ...CLASS_WORDS,
  frontline: 'vanguard', frontlines: 'vanguard', frontliner: 'vanguard', frontliners: 'vanguard', melee: 'vanguard',
  bruiser: 'vanguard', bruisers: 'vanguard',
  bowman: 'ranger', bowmen: 'ranger', marksman: 'ranger', marksmen: 'ranger', ranged: 'ranger', gunner: 'ranger',
  gunners: 'ranger', adc: 'ranger',
  heals: 'guardian', healbot: 'guardian', priest: 'guardian', priests: 'guardian', cleric: 'guardian', clerics: 'guardian',
  ninja: 'assassin', ninjas: 'assassin', stabber: 'assassin', backstabber: 'assassin', thief: 'assassin',
  spellcaster: 'invoker', spellcasters: 'invoker', sorcerer: 'invoker', sorcerers: 'invoker', warlock: 'invoker',
  warlocks: 'invoker',
};
/** Two-word class names: "front line". */
const CLASS_PAIRS: Readonly<Record<string, TroopClass>> = { 'front line': 'vanguard', 'front lines': 'vanguard', 'front liners': 'vanguard' };

/** The troop classes named in these words, in order (a two-word name counts once). */
export function classesIn(words: readonly string[]): TroopClass[] {
  const found: TroopClass[] = [];
  for (let i = 0; i < words.length; i++) {
    const pair = CLASS_PAIRS[`${words[i]} ${words[i + 1]}`];
    if (pair) {
      found.push(pair);
      i++;
      continue;
    }
    const cls = CLASS_OF[words[i]!];
    if (cls) found.push(cls);
  }
  return found;
}

/** Skill names: firing one is an Overcharge of the class that owns it. */
export const SKILL_OF: Readonly<Record<string, TroopClass>> = { shove: 'vanguard', mark: 'ranger', barrier: 'guardian' };

const TENS: Readonly<Record<string, number>> = {
  ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};

/** Numbers written in digits or words ("twenty five" = 25), in order. "one of" is not a number. */
export function numbersIn(words: readonly string[]): number[] {
  const found: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w === 'one' && words[i + 1] === 'of') continue;
    if (/^\d+$/.test(w)) {
      found.push(Number(w));
      continue;
    }
    const tens = TENS[w];
    if (tens !== undefined) {
      const unit = NUMBER_WORDS[words[i + 1] ?? ''];
      if (unit !== undefined && unit < 10 && tens >= 20) {
        found.push(tens + unit);
        i++;
      } else {
        found.push(tens);
      }
      continue;
    }
    const n = NUMBER_WORDS[w];
    if (n !== undefined) found.push(n);
  }
  return found;
}

const FRACTIONS: Readonly<Record<string, number>> = { half: 50, quarter: 25, third: 33 };

/** The HP threshold these words name: a number, "half", or a word like "hurt" or "low on health". */
export function hpPercentIn(words: readonly string[]): number | undefined {
  const number = numbersIn(words).find((n) => n > 0 && n < 100);
  if (number !== undefined) return number;
  const fraction = words.map((w) => FRACTIONS[w]).find((f) => f !== undefined);
  if (fraction !== undefined) return fraction;
  // The longest hurt phrase wins: "low on health" over "low".
  const text = ` ${words.join(' ')} `;
  const hurt = Object.keys(HURT_WORDS)
    .sort((a, b) => b.length - a.length)
    .find((phrase) => text.includes(` ${phrase} `));
  return hurt === undefined ? undefined : HURT_WORDS[hurt];
}

// Word groups, for the reader's features ---------------------------------------------------

const GROUPS: Readonly<Record<string, readonly string[]>> = {
  cond: ['when', 'if', 'once', 'whenever', 'soon', 'moment', 'second', 'case', 'until', 'after', 'before'],
  repeat: ['every', 'each', 'whenever', 'anytime', 'always', 'time'],
  sep: ['then', 'afterwards', 'next', 'after', 'later', 'first', 'finally'],
  and: ['and', 'while', 'also', 'plus'],
  own: ['my', 'our', 'your', 'own', 'mine', 'ours', 'us', 'we'],
  enemyOwner: ['their', 'enemy', 'enemies', 'enemys', 'opponent', 'opponents', 'foe', 'foes', 'there', 'theyre', 'they', 'them'],
  det: ['the', 'a', 'an', 'that', 'this', 'those', 'these', 'any', 'another', 'some'],
  pronoun: ['him', 'her', 'it', 'them', 'attacker', 'diver', 'intruder', 'whoever', 'whatever'],
  all: ['everyone', 'everybody', 'all', 'team', 'squad', 'units', 'troops', 'army', 'guys', 'yall', 'nobody', 'whole'],
  near: ['nearest', 'closest', 'close', 'near', 'nearby', 'closer'],
  weak: ['weakest', 'lowest', 'least', 'weak', 'low', 'hurt', 'wounded', 'injured', 'dead', 'dying', 'most'],
  forward: ['forward', 'forwards', 'up', 'ahead', 'front', 'advance', 'push', 'press', 'in'],
  backward: ['back', 'backward', 'backwards', 'away', 'further'],
  behind: ['behind', 'around', 'flank', 'flanks', 'lines', 'outflank'],
  backline: ['backline', 'backliners', 'line', 'squishies'],
  ult: ['ultimate', 'ult', 'ulti', 'super', 'ults', 'ulting'],
  charge: ['charging', 'charges', 'charge', 'charged', 'ready', 'coming', 'readying'],
  group: ['group', 'grouped', 'groups', 'bunch', 'bunched', 'bunches', 'clump', 'clumped', 'clumps', 'cluster', 'clustered',
    'stack', 'stacked', 'stacks', 'together', 'packed', 'huddle', 'huddled', 'ball', 'gather', 'gathered'],
  dive: ['dives', 'dive', 'dove', 'jumps', 'jump', 'reaches', 'reach', 'breaks', 'touches', 'gets', 'comes', 'rushes', 'leaps'],
  hpWord: ['hp', 'health', 'life', 'percent'],
  below: ['below', 'under', 'beneath', 'less', 'lower', 'drops', 'drop', 'falls', 'fall', 'dips', 'sinks', 'loses'],
  reserve: ['reserve', 'reserves', 'reinforcements', 'reinforcement', 'backup', 'reinforce', 'fresh'],
  skill: ['skill', 'skills', 'ability', 'abilities', 'overcharge', 'supercharge', 'empower', 'boost', 'shove', 'mark',
    'barrier', 'unleash', 'pop', 'cast', 'everything'],
  focus: ['focus', 'attack', 'kill', 'target', 'hit', 'shoot', 'destroy', 'eliminate', 'hunt', 'strike', 'burn', 'burst',
    'finish', 'snipe', 'engage', 'fight', 'smack', 'punish', 'gank', 'drop', 'murder', 'delete', 'nuke', 'wreck', 'blast',
    'smash', 'pick', 'take', 'go'],
  protect: ['protect', 'cover', 'guard', 'defend', 'shield', 'save', 'help', 'escort', 'bodyguard', 'babysit', 'peel',
    'keep', 'alive', 'safe', 'watch', 'look', 'stay', 'stick'],
  fallBack: ['retreat', 'fallback', 'withdraw', 'disengage', 'regroup', 'run', 'flee', 'escape', 'bail', 'off', 'out'],
  move: ['move', 'go', 'walk', 'step', 'head', 'march', 'get', 'join', 'sneak', 'circle', 'slip', 'send', 'stand'],
  hold: ['hold', 'stay', 'stand', 'wait', 'freeze', 'dig', 'sit', 'hunker', 'still', 'put', 'firm', 'ground', 'position',
    'chill', 'camp', 'halt', 'stop'],
  call: ['call', 'bring', 'summon', 'deploy', 'send'],
  filler: ['please', 'now', 'asap', 'ok', 'okay', 'yo', 'alright', 'quick', 'quickly', 'immediately', 'just', 'go', 'lets',
    'hey', 'right', 'fast', 'boys', 'thx', 'thanks'],
  // Legendary actions (session 6A).
  hijack: ['hijack', 'control', 'possess', 'seize', 'brainwash', 'convert', 'charm', 'dominate', 'puppet', 'steal', 'sides', 'against'],
  swap: ['swap', 'switch', 'trade', 'places', 'spots', 'teleport', 'where'],
  sacrifice: ['sacrifice', 'pact', 'blood', 'offer', 'spend', 'bleed', 'give'],
  wall: ['wall', 'walls', 'fortify', 'barricade', 'raise', 'build'],
  echo: ['repeat', 'echo', 'again', 'redo', 'replay', 'same', 'last'],
};

const GROUP_OF = new Map<string, string>();
for (const [group, words] of Object.entries(GROUPS)) {
  for (const w of words) if (!GROUP_OF.has(w)) GROUP_OF.set(w, group);
}

/** A rough word group for the reader's features: class, number, condition word, and so on. */
export function wordGroup(word: string): string {
  if (word === ',') return 'comma';
  if (/^\d+$/.test(word)) return 'num';
  if (CLASS_OF[word]) return 'class';
  if (NUMBER_WORDS[word] !== undefined || TENS[word] !== undefined) return 'num';
  if (FRACTIONS[word] !== undefined) return 'fraction';
  return GROUP_OF.get(word) ?? 'other';
}
