// Dataset generator: combines actions, troops, targets and conditions into sentence and card
// pairs, for training a model (session 3C) and for prompts. The card is built from the same
// choices as the sentence, so every label is right by construction; the validator checks each.
//   npm run dataset -- --count 5000 --seed 1   writes tools/dataset/out/generated.jsonl

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Actors, Card, Condition, Step, Target, Trigger } from '../../src/cards/types';
import { validateCard } from '../../src/cards/validator';
import type { TroopClass } from '../../src/data/units';

export interface Pair {
  text: string;
  card: Card;
}

/** A small seeded random number generator, so a seed always gives the same dataset. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Own = 'vanguard' | 'ranger' | 'guardian';
const OWN: readonly Own[] = ['vanguard', 'ranger', 'guardian'];
const ENEMY: readonly TroopClass[] = ['vanguard', 'ranger', 'guardian', 'assassin', 'invoker'];

const OWN_NAMES: Record<Own, string[]> = {
  vanguard: ['vanguards', 'tanks', 'the vanguards', 'my vanguards'],
  ranger: ['rangers', 'archers', 'snipers', 'the rangers'],
  guardian: ['guardians', 'healers', 'medics', 'the guardians'],
};
const ALL_NAMES = ['everyone', 'everybody', 'all units', 'all of you', 'whole team'];

const ENEMY_NAMES: Record<TroopClass, string[]> = {
  vanguard: ['their vanguard', 'the tank', 'their tanks', 'the enemy vanguard', 'their frontline'],
  ranger: ['their ranger', 'the archer', 'their archers', 'the enemy rangers', 'their sniper'],
  guardian: ['their healer', 'the medic', 'their guardian', 'their support', 'the enemy healer'],
  assassin: ['their assassin', 'the assassin', 'the rogue', 'the enemy assassin'],
  invoker: ['their mage', 'the caster', 'their invoker', 'the wizard', 'the enemy mage'],
};
const ALLY_NAMES: Record<Own, string[]> = {
  vanguard: ['my vanguard', 'the tanks', 'our vanguards', 'my tank'],
  ranger: ['my rangers', 'the archers', 'our ranger', 'my archer'],
  guardian: ['the healer', 'my guardian', 'our medic', 'the guardians'],
};
const DIVE_NAMES: Record<TroopClass, string[]> = {
  vanguard: ['their tank', 'their vanguard'],
  ranger: ['their ranger', 'their archer'],
  guardian: ['their healer', 'their guardian'],
  assassin: ['their assassin', 'the assassin', 'the rogue'],
  invoker: ['their mage', 'their invoker'],
};
const SKILLS: Record<Own, string[]> = {
  vanguard: ['shove', 'use shove', 'use your skill', 'overcharge'],
  ranger: ['mark them', 'use mark', 'use your skill', 'overcharge'],
  guardian: ['use barrier', 'cast barrier', 'use your skill', 'overcharge'],
};
const RESERVE_NAMES: Record<Own, string[]> = {
  vanguard: ['vanguard', 'tank'],
  ranger: ['ranger', 'archer'],
  guardian: ['guardian', 'healer'],
};

class Writer {
  constructor(private readonly next: () => number) {}

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  actors(allowAll = true): { actors: Actors; words: string; own: Own | null } {
    if (allowAll && this.chance(0.45)) {
      return { actors: { kind: 'all' }, words: this.chance(0.5) ? '' : this.pick(ALL_NAMES), own: null };
    }
    const cls = this.pick(OWN);
    return { actors: { kind: 'class', cls }, words: this.pick(OWN_NAMES[cls]), own: cls };
  }

  enemyTarget(): { target: Target; words: string } {
    const roll = this.next();
    if (roll < 0.65) {
      const cls = this.pick(ENEMY);
      return { target: { kind: 'class', cls }, words: this.pick(ENEMY_NAMES[cls]) };
    }
    if (roll < 0.85) return { target: { kind: 'nearest' }, words: this.pick(['the nearest enemy', 'the closest enemy', 'whoever is closest', 'the closest one']) };
    return { target: { kind: 'weakest' }, words: this.pick(['the weakest enemy', 'the low hp one', 'whoever is weakest', 'the lowest health enemy']) };
  }

  allyTarget(): { target: Target; words: string } {
    if (this.chance(0.8)) {
      const cls = this.pick(OWN);
      return { target: { kind: 'class', cls }, words: this.pick(ALLY_NAMES[cls]) };
    }
    return { target: { kind: 'weakest' }, words: this.pick(['the weakest ally', 'whoever is lowest', 'our weakest']) };
  }

  /** One step; `trigger` says what "him/her/it" can point at, if the card has a condition. */
  step(trigger: 'enemy' | 'ally' | null): { step: Step; words: string } {
    const who = this.actors();
    const lead = who.words ? `${who.words} ` : '';
    const action = this.pick(['focus', 'focus', 'move', 'fallBack', 'overcharge', 'protect', 'hold', 'callReserve'] as const);
    switch (action) {
      case 'focus': {
        if (trigger === 'enemy' && this.chance(0.5)) {
          const words = this.pick(['him', 'it', 'them', 'the attacker']);
          return { step: { action, actors: who.actors, target: { kind: 'trigger' } }, words: `${lead}${this.pick(['focus', 'kill', 'attack', 'take out'])} ${words}` };
        }
        const t = this.enemyTarget();
        return { step: { action, actors: who.actors, target: t.target }, words: `${lead}${this.pick(['focus', 'kill', 'attack', 'take out', 'go for', 'target', 'hit'])} ${t.words}` };
      }
      case 'move': {
        const roll = this.next();
        if (roll < 0.3) return { step: { action, actors: who.actors, to: { kind: 'forward' } }, words: `${lead}${this.pick(['move forward', 'advance', 'push up', 'move up', 'go forward'])}` };
        if (roll < 0.5) return { step: { action, actors: who.actors, to: { kind: 'back' } }, words: `${lead}${this.pick(['move back', 'step back', 'back up', 'walk back'])}` };
        if (roll < 0.75) {
          return { step: { action, actors: who.actors, to: { kind: 'behindEnemies' } }, words: `${lead}${this.pick(['flank them', 'get behind their lines', 'go behind the enemy', 'move behind enemy lines'])}` };
        }
        const t = this.allyTarget();
        return { step: { action, actors: who.actors, to: { kind: 'ally', ally: t.target } }, words: `${lead}${this.pick(['move to', 'go to', 'head to', 'get to'])} ${t.words}` };
      }
      case 'fallBack': {
        if (this.chance(0.4)) {
          const t = this.allyTarget();
          return { step: { action, actors: who.actors, to: t.target }, words: `${lead}${this.pick(['fall back to', 'retreat to', 'pull back to'])} ${t.words}` };
        }
        return { step: { action, actors: who.actors, to: null }, words: `${lead}${this.pick(['fall back', 'retreat', 'pull back', 'disengage'])}` };
      }
      case 'overcharge': {
        if (!who.own) {
          return { step: { action, actors: { kind: 'all' } }, words: this.pick(['everyone use your skills', 'everyone overcharge', 'pop all abilities', 'use all skills']) };
        }
        return { step: { action, actors: who.actors }, words: `${who.words} ${this.pick(SKILLS[who.own])}` };
      }
      case 'protect': {
        if (trigger === 'ally' && this.chance(0.5)) {
          return { step: { action, actors: who.actors, target: { kind: 'trigger' } }, words: `${lead}${this.pick(['protect', 'cover', 'shield', 'guard'])} ${this.pick(['her', 'him', 'them'])}` };
        }
        const t = this.allyTarget();
        return { step: { action, actors: who.actors, target: t.target }, words: `${lead}${this.pick(['protect', 'cover', 'guard', 'shield', 'look after'])} ${t.words}` };
      }
      case 'hold':
        return { step: { action, actors: who.actors }, words: `${lead}${this.pick(['hold', 'hold position', 'stand your ground', 'stay put', 'hold the line'])}` };
      case 'callReserve': {
        if (this.chance(0.5)) return { step: { action, reserve: null }, words: this.pick(['call the reserves', 'bring in reinforcements', 'send in backup', 'reinforce']) };
        const cls = this.pick(OWN);
        const name = this.pick(RESERVE_NAMES[cls]);
        return { step: { action, reserve: cls }, words: this.pick([`call the reserve ${name}`, `bring in the reserve ${name}`, `send in a ${name} from the reserves`]) };
      }
    }
  }

  trigger(): { trigger: Trigger; words: string } {
    const roll = this.next();
    if (roll < 0.35) {
      if (this.chance(0.3)) return { trigger: { kind: 'enemyReachesBackline', enemy: 'any' }, words: this.pick(['any enemy reaches our backline', 'anyone dives our backline', 'an enemy dives']) };
      const cls = this.pick(ENEMY);
      const name = this.pick(DIVE_NAMES[cls]);
      return { trigger: { kind: 'enemyReachesBackline', enemy: cls }, words: this.pick([`${name} dives`, `${name} reaches our backline`, `${name} gets to our backline`]) };
    }
    if (roll < 0.7) {
      const pct = this.pick([25, 30, 40, 50, 50, 75]);
      const amount = pct === 50 && this.chance(0.4) ? 'half' : this.pick([`${pct}%`, `${pct} percent`, `${pct}% hp`]);
      if (this.chance(0.3)) return { trigger: { kind: 'allyBelowHp', ally: 'any', hpPercent: pct }, words: `${this.pick(['any ally', 'anyone', 'one of ours'])} ${this.pick(['drops below', 'falls under', 'is under'])} ${amount}` };
      const cls = this.pick(OWN);
      return { trigger: { kind: 'allyBelowHp', ally: cls, hpPercent: pct }, words: `${this.pick(ALLY_NAMES[cls]).replace(/^the /, 'my ')} ${this.pick(['drops below', 'falls under', 'is under'])} ${amount}` };
    }
    if (roll < 0.9) {
      const count = this.pick([2, 3, 3, 4, 5]);
      return { trigger: { kind: 'enemiesGrouped', count }, words: this.pick([`${count} enemies group up`, `${count} or more enemies are close together`, `${count} of them bunch up`]) };
    }
    return { trigger: { kind: 'enemyUltimateCharging' }, words: this.pick(['their ultimate is charging', 'the enemy ult is ready', 'they are about to ult']) };
  }

  pair(): Pair {
    let condition: Condition | null = null;
    let conditionWords = '';
    let triggerSide: 'enemy' | 'ally' | null = null;
    if (this.chance(0.45)) {
      const repeat = this.chance(0.2);
      const first = this.trigger();
      const triggers = [first.trigger];
      let words = first.words;
      if (this.chance(0.12)) {
        const second = this.trigger();
        if (second.trigger.kind !== first.trigger.kind) {
          triggers.push(second.trigger);
          words += ` and ${second.words}`;
        }
      }
      condition = { triggers, repeat };
      conditionWords = `${repeat ? this.pick(['every time', 'whenever', 'each time']) : this.pick(['when', 'if', 'once'])} ${words}`;
      const kinds = triggers.map((t) => t.kind);
      triggerSide = kinds.includes('allyBelowHp') ? 'ally' : kinds.some((k) => k === 'enemyReachesBackline' || k === 'enemiesGrouped') ? 'enemy' : null;
    }
    const count = this.pick([1, 1, 1, 2, 2, 3]);
    const steps: Step[] = [];
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const s = this.step(triggerSide);
      steps.push(s.step);
      parts.push(s.words);
    }
    const body = parts.reduce((text, part, i) => (i === 0 ? part : `${text}${this.pick([', then ', ' then ', ' and then ', ', after that '])}${part}`), '');
    const text = condition ? (this.chance(0.8) ? `${conditionWords}, ${body}` : `${body} ${conditionWords}`) : body;
    return { text: this.chance(0.5) ? text : text.charAt(0).toUpperCase() + text.slice(1), card: { condition, steps, auto: false } };
  }
}

/** `count` distinct, legal sentence and card pairs for a seed. */
export function generate(count: number, seed = 1): Pair[] {
  const writer = new Writer(random(seed));
  const pairs: Pair[] = [];
  const seen = new Set<string>();
  for (let tries = 0; pairs.length < count && tries < count * 20; tries++) {
    const pair = writer.pair();
    if (seen.has(pair.text) || !validateCard(pair.card, 5).ok) continue;
    seen.add(pair.text);
    pairs.push(pair);
  }
  return pairs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name: string, fallback: number) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? Number(process.argv[i + 1]) : fallback;
  };
  const pairs = generate(arg('count', 5000), arg('seed', 1));
  const folder = fileURLToPath(new URL('./out/', import.meta.url));
  mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}generated.jsonl`, pairs.map((p) => JSON.stringify(p)).join('\n') + '\n');
  console.log(`Wrote ${pairs.length} pairs to tools/dataset/out/generated.jsonl`);
}
