// Dataset generator: combines actions, troops, targets and conditions into sentence and card
// pairs, for training the order reader (session 3C) and for prompts. The card is built from the
// same choices as the sentence, so every label is right by construction; the validator checks
// each. Every word also comes labeled with its part of the card (see src/cards/reader/tags.ts):
// condition, trigger, step, and its role there (who acts, what they do, whom or where).
//   npm run dataset -- --count 5000 --seed 1   writes tools/dataset/out/generated.jsonl

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Role } from '../../src/cards/reader/tags';
import type { Actors, Card, Condition, Step, Target, Trigger } from '../../src/cards/types';
import { validateCard } from '../../src/cards/validator';
import { HURT_WORDS } from '../../src/data/cards';
import type { TroopClass } from '../../src/data/units';

/** Some words of a sentence and their role; `start` marks the first piece of a trigger or step. */
export interface Piece {
  text: string;
  role: Role;
  start?: true;
}

export interface Pair {
  text: string;
  card: Card;
  pieces: Piece[];
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

const piece = (role: Role) => (text: string): Piece => ({ text, role });
const o = piece('O');
const c = piece('C');
const t = piece('T');
const e = piece('E');
const a = piece('A');
const v = piece('V');
const g = piece('G');
const x = piece('X');

type Own = 'vanguard' | 'ranger' | 'guardian';
const OWN: readonly Own[] = ['vanguard', 'ranger', 'guardian'];
const ENEMY: readonly TroopClass[] = ['vanguard', 'ranger', 'guardian', 'assassin', 'invoker'];

// Names ------------------------------------------------------------------------------------

/** Your own troops, as the ones who act. */
const OWN_NAMES: Record<Own, string[]> = {
  vanguard: ['vanguards', 'vanguards', 'vanguard', 'tanks', 'tanks', 'tank', 'frontline', 'front line', 'frontliners', 'melee', 'vanguard squad', 'tank squad'],
  ranger: ['rangers', 'rangers', 'ranger', 'archers', 'archers', 'archer', 'snipers', 'sniper', 'shooters', 'bowmen', 'marksmen', 'ranged', 'ranged units', 'ranger squad'],
  guardian: ['guardians', 'guardians', 'guardian', 'healers', 'healers', 'healer', 'medics', 'medic', 'supports', 'support', 'heals', 'priests'],
};
const OWN_DETS = ['', '', 'my ', 'the ', 'our ', 'all ', 'all the ', 'all my ', 'all of my '];
/** Your own troops, as the ones a step protects or moves to. */
const ALLY_NAMES: Record<Own, string[]> = {
  vanguard: ['vanguard', 'vanguards', 'tank', 'tanks', 'frontline', 'front line', 'tanky boys'],
  ranger: ['ranger', 'rangers', 'archer', 'archers', 'sniper', 'snipers', 'shooters', 'marksmen', 'ranged'],
  guardian: ['guardian', 'guardians', 'healer', 'healers', 'medic', 'medics', 'support', 'heals', 'priest'],
};
const ALLY_DETS = ['my ', 'my ', 'our ', 'the ', 'the ', '', 'our own '];
const ENEMY_NAMES: Record<TroopClass, string[]> = {
  vanguard: ['vanguard', 'vanguards', 'tank', 'tanks', 'frontline', 'front line', 'frontliner', 'melee', 'bruiser'],
  ranger: ['ranger', 'rangers', 'archer', 'archers', 'sniper', 'snipers', 'shooter', 'shooters', 'bowman', 'marksman', 'ranged unit', 'adc'],
  guardian: ['guardian', 'guardians', 'healer', 'healers', 'medic', 'medics', 'support', 'supports', 'heals', 'priest', 'cleric', 'healbot'],
  assassin: ['assassin', 'assassins', 'rogue', 'rogues', 'ninja', 'ninjas', 'stabber', 'backstabber', 'thief'],
  invoker: ['invoker', 'invokers', 'mage', 'mages', 'caster', 'casters', 'wizard', 'wizards', 'spellcaster', 'sorcerer', 'warlock'],
};
const ENEMY_DETS = ['their ', 'their ', 'their ', 'the ', 'the ', 'the enemy ', 'enemy ', 'that ', 'those ', '', 'there ', "the enemy's "];
const RESERVE_NAMES: Record<Own, string[]> = {
  vanguard: ['vanguard', 'tank'],
  ranger: ['ranger', 'archer', 'sniper'],
  guardian: ['guardian', 'healer', 'medic'],
};

const ALL_ACTORS = [
  'everyone', 'everyone', 'everybody', 'all units', 'all of you', 'all troops', 'the whole team', 'whole team', 'team',
  'the team', 'squad', 'the squad', 'guys', 'you all', 'yall', 'the army', 'my army', 'all my troops', 'every unit',
  'every single one of you', 'the whole army', 'all', 'my troops', 'our troops', 'all of us', 'boys',
];
const MODALS = ['should', 'need to', 'must', 'will', 'gotta', 'have to', 'can'];

const NUMBER_NAMES: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 10: 'ten', 20: 'twenty', 25: 'twenty five', 30: 'thirty', 40: 'forty', 50: 'fifty', 75: 'seventy five' };

// Steps ------------------------------------------------------------------------------------

const FOCUS_VERBS = [
  'focus', 'focus', 'focus', 'focus on', 'focus fire on', 'focus fire', 'attack', 'attack', 'kill', 'kill', 'kill', 'target',
  'target', 'take out', 'take out', 'take down', 'hit', 'hit', 'shoot', 'shoot at', 'go after', 'go for', 'go for',
  'gang up on', 'destroy', 'eliminate', 'hunt', 'hunt down', 'charge at', 'strike', 'burn down', 'burn', 'finish off',
  'finish', 'deal with', 'burst', 'burst down', 'drop', 'smash', 'murder', 'delete', 'nuke', 'gank', 'pick off', 'snipe',
  'engage', 'fight', 'smack', 'punish', 'shut down', 'jump on', 'pile on', 'pile onto', 'collapse on', 'wreck',
  'clean up', 'secure the kill on', 'switch to', 'get', 'go kill', 'go hit', 'blast', 'tear down', 'break', 'beat up',
  'rush', 'swarm', 'zone in on', 'lock onto', 'prioritize',
];
/** Verbs that work as "verb ... down" or "verb ... out". */
const FOCUS_SPLIT: [string, string][] = [['burn', 'down'], ['burst', 'down'], ['take', 'out'], ['take', 'down'], ['shut', 'down'], ['gun', 'down'], ['cut', 'down'], ['bring', 'down'], ['knock', 'out']];
/** Focus verbs that mean "the nearest enemy" on their own. */
const FOCUS_ALONE = ['attack', 'attack', 'charge', 'fight', 'engage', 'kill', 'strike', 'shoot', 'go fight'];

const ENEMY_NEAREST = [
  'the nearest enemy', 'the closest enemy', 'the nearest one', 'the closest one', 'the nearest', 'the closest', 'nearest',
  'closest', 'whoever is closest', "whoever's closest", 'whoever is nearest', 'whatever is closest', "whatever's nearest",
  'the closest guy', 'the nearest target', 'the closest target', 'the closest unit', 'nearest enemy', 'closest enemy',
  'anything close', 'whoever is near', 'the enemy closest to us', 'the nearest guy', 'the enemy', 'the enemies', 'enemies',
  'nearest target', 'closest target', 'whatever is nearest', 'the closest thing', 'anyone nearby', 'whoever is in range',
];
const ENEMY_WEAKEST = [
  'the weakest enemy', 'the weakest one', 'the weakest', 'weakest', 'the weakest guy', 'the low hp one', 'the lowest hp enemy',
  'the lowest health enemy', 'lowest hp', 'the lowest', 'whoever is weakest', "whoever's weakest", 'whoever is lowest',
  'the most hurt enemy', 'the most wounded enemy', 'the wounded enemy', 'the enemy with the least hp',
  'the enemy with the lowest health', 'whoever is almost dead', 'the low one', 'the weak one', 'the weakest target',
  'the injured one', 'weakest enemy', 'the lowest hp one', 'whoever is low', 'the one with the least health',
  'whatever is weakest', 'the weakest unit',
];
const ENEMY_TRIGGER = ['him', 'him', 'her', 'it', 'it', 'them', 'them', 'the attacker', 'that attacker', 'the diver', 'whoever dived', 'whoever dove', 'that one', 'that unit', 'the intruder', 'that enemy', 'that guy'];
const GROUP_TRIGGER = ['them', 'them', 'them', 'the group', 'that group', 'those enemies', 'the clump', 'the pack', 'the blob'];
const ALLY_TRIGGER = ['him', 'her', 'her', 'it', 'them', 'them', 'that ally', 'that one', 'that troop', 'that unit'];

const PROTECT_VERBS = [
  'protect', 'protect', 'protect', 'cover', 'cover', 'guard', 'defend', 'shield', 'save', 'help', 'watch over', 'look after',
  'escort', 'bodyguard', 'back up', 'stay with', 'stick with', 'peel for', 'babysit', 'protecc', 'cover for', 'stand by',
  'watch', 'keep an eye on', 'take care of', 'stay close to', 'guard over',
];
const KEEP_STATES = ['alive', 'safe', 'covered', 'protected', 'healthy', 'out of trouble'];
const ALLY_WEAKEST = [
  'the weakest ally', 'our weakest', 'my weakest', 'the weakest', 'the weakest one', 'whoever is hurt', 'whoever is weakest',
  'whoever is lowest', 'whoever is low', 'the most hurt', 'the most wounded', 'the wounded', 'the hurt one',
  'the lowest hp ally', 'our weakest unit', 'my weakest troop', 'whoever is hurt the most', 'the weakest troop',
  'whoever needs it most', 'the lowest ally', 'our lowest hp unit',
];
const ALLY_NEAREST = ['the nearest ally', 'the closest ally', 'my nearest troop', 'the closest friend', 'whoever is closest to you', 'our nearest unit'];

const MOVE_FORWARD_VERBS = ['move', 'move', 'go', 'walk', 'step', 'head', 'push', 'press', 'march', 'get', 'roll', 'inch', 'creep'];
const FORWARD = ['forward', 'forward', 'forwards', 'up', 'up', 'ahead', 'to the front', 'up front', 'to the frontline', 'to the front line', 'closer', 'in', 'toward the enemy', 'towards the enemy', 'onward'];
const FORWARD_ALONE = ['advance', 'advance', 'push', 'press on', 'march on', 'close in', 'close the distance', 'push it', 'take a step forward', 'take a few steps forward', 'move it', 'step it up'];
const MOVE_BACK_VERBS = ['move', 'move', 'step', 'walk', 'shuffle', 'inch'];
const BACK = ['back', 'back', 'backward', 'backwards', 'away', 'further back', 'to the back', 'back a bit'];
const BACK_ALONE = ['back up', 'take a step back', 'take a few steps back', 'move away from them', 'give them space', 'make some space'];
const BEHIND_VERBS = ['move', 'go', 'go', 'get', 'sneak', 'circle', 'slip', 'head', 'walk', 'swing', 'loop', 'wrap', 'run', 'go around', 'creep'];
const BEHIND = [
  'behind the enemy', 'behind enemies', 'behind them', 'behind enemy lines', 'behind their lines', 'around them',
  'around the enemy', 'around the back', 'to their backline', 'into their backline', 'behind their backline',
  'into their back line', 'to their back line', 'around behind them', 'behind their army', 'behind', 'round the back',
];
const FLANK = [['flank'], ['flank', 'them'], ['flank', 'the enemy'], ['outflank', 'them'], ['flank', 'around'], ['go flank'], ['flank', 'from the side']];
const MOVE_ALLY_VERBS = ['move', 'move', 'go', 'go', 'head', 'get', 'walk', 'go stand', 'rush', 'hurry', 'head over', 'make your way', 'reposition'];
const MOVE_ALLY_PREPS = ['to', 'to', 'to', 'toward', 'towards', 'next to', 'beside', 'near', 'over to', 'up to', 'with', 'by', 'close to', 'for'];

const FALLBACK_VERBS = [
  'fall back', 'fall back', 'fall back', 'retreat', 'retreat', 'retreat', 'pull back', 'pull back', 'back off', 'regroup',
  'withdraw', 'run back', 'run away', 'get back', 'go back', 'fallback', 'disengage', 'disengage', 'get out',
  'get out of there', 'bail', 'run', 'retreat back', 'escape', 'pull out', 'flee',
  'fall back together', 'peel back', 'evacuate', 'kite back', 'reset',
];
const FALLBACK_TO_VERBS = ['fall back', 'fall back', 'retreat', 'retreat', 'pull back', 'regroup', 'withdraw', 'run back', 'get back', 'go back', 'fallback', 'retreat back', 'head back', 'pull back'];
const FALLBACK_PREPS = ['to', 'to', 'to', 'toward', 'towards', 'behind', 'near', 'on', 'at', 'around', 'with'];

const SKILL_ANY = [
  'overcharge', 'overcharge', 'use your skill', 'use your skill', 'use your skills', 'use your ability', 'use your abilities',
  'use skill', 'use skills', 'use ability', 'fire your skill', 'fire your skills', 'pop your skill', 'pop skill',
  'pop your ability', 'activate your skill', 'activate your ability', 'hit your skill', 'use ur skill', 'supercharge',
  'power up', 'unleash', 'go all out', 'skill now', 'ability now', 'use your special', 'press your skill', 'cast your skill',
];
const SKILL_OWN: Record<Own, string[][]> = {
  vanguard: [['shove'], ['use shove'], ['shove', 'them'], ['shove', 'them back'], ['shove', 'the enemy'], ['use shove', 'on them'], ['shove', 'now']],
  ranger: [['mark'], ['use mark'], ['mark', 'them'], ['mark', 'the target'], ['cast mark'], ['mark', 'now'], ['mark', 'the enemy']],
  guardian: [['barrier'], ['use barrier'], ['cast barrier'], ['barrier up'], ['shield up'], ['pop barrier'], ['put up a barrier'], ['use your shield'], ['barrier', 'now']],
};
const SKILL_NAMES: Record<Own, string> = { vanguard: 'shove', ranger: 'mark', guardian: 'barrier' };
const OVERCHARGE_OBJECT_VERBS = ['overcharge', 'overcharge', 'supercharge', 'boost', 'empower', 'power up', 'buff'];
const SKILL_ALL = [
  'everyone use your skills', 'use all skills', 'all abilities now', 'pop everything', 'skills now', 'dump all skills',
  'use everything', 'full send', 'all skills', 'pop all abilities', 'every skill now', 'use all abilities', 'go all out',
];

const HOLD_VERBS = [
  'hold', 'hold', 'hold', 'hold the line', 'hold the line', 'hold position', 'hold the position', 'hold your position',
  'hold your ground', 'hold ground', 'stand your ground', 'stand firm', 'stand still', 'stay put', 'stay put', 'stay still',
  'stay in place', 'stay', 'dont move', 'do not move', 'wait', 'dig in', 'sit tight', 'hunker down', 'hold in place',
  'freeze', 'hold still', 'hold fast', 'stay where you are', 'keep your position', 'keep position', 'camp', 'chill',
  'stop', 'stop moving', 'halt', 'stand there', 'stay there', 'hold steady', 'hold tight',
];
const HOLD_EXTRAS = ['here', 'there', 'in place', 'where you are', 'for now', 'for a sec', 'for a bit', 'right there', 'right here', 'for a moment'];

const RESERVE_ANY = [
  'call the reserves', 'call in the reserves', 'call reserves', 'call a reserve', 'call in a reserve', 'bring in reinforcements',
  'bring in a reserve', 'send in backup', 'send backup', 'call backup', 'call for backup', 'get the reserves in', 'reinforce',
  'call reinforcements', 'call in reinforcements', 'deploy the reserves', 'bring in backup', 'summon reinforcements',
  'send in a fresh unit', 'bring in fresh troops', 'bring the reserves in', 'send in the reserves', 'get backup in',
  'call in backup', 'reinforcements now', 'bring the backup in', 'call the reserve', 'deploy a reserve', 'reinforce us',
  'call in the reinforcements', 'get reinforcements', 'we need backup', 'we need reinforcements', 'need backup', 'more troops',
];

// Conditions -------------------------------------------------------------------------------

const ONCE_WORDS = ['when', 'when', 'when', 'when', 'if', 'if', 'once', 'as soon as', 'the moment', 'the second', 'in case', 'soon as', 'right when', 'the instant'];
const REPEAT_WORDS = ['every time', 'every time', 'whenever', 'whenever', 'each time', 'any time', 'anytime', 'every single time', 'each and every time'];
const TRIGGER_JOINERS: Piece[][] = [[o('and')], [o('and')], [o('and')], [o('and'), c('when')], [o('and'), c('if')], [o('while')], [o('and also')], [o(','), o('and')]];

const ANY_ENEMY = [
  'an enemy', 'any enemy', 'anyone', 'anybody', 'someone', 'somebody', 'something', 'anything', 'they', 'enemies',
  'the enemy', 'one of them', 'one of their troops', 'an enemy unit', 'any of them', 'a diver', 'their divers', 'enemy',
];
const DIVE_ALONE = ['dives', 'dives', 'dives in', 'jumps in', 'leaps in', 'goes in', 'comes in', 'dives us', 'jumps us', 'flanks us', 'gets in', 'breaks through', 'gets through', 'dove in', 'dive', 'jump in', 'dives on us'];
const REACH_VERBS = ['reaches', 'reaches', 'gets to', 'gets into', 'breaks into', 'breaks through to', 'goes for', 'comes for', 'attacks', 'hits', 'touches', 'is in', 'gets behind', 'runs at', 'rushes', 'jumps', 'dives', 'targets', 'makes it to', 'gets through to', 'dives into', 'jumps on', 'is on', 'reach', 'dive'];
const BACKLINE_PLACES = [
  'our backline', 'our backline', 'my backline', 'the backline', 'the backline', 'our back line', 'the back line', 'our back',
  'my back line', 'our backliners', 'the back', 'my rangers', 'our rangers', 'our healer', 'my guardian', 'the archers',
  'our squishies', 'us', 'our support', 'my snipers',
];

const ANY_ALLY = [
  'any ally', 'any ally', 'an ally', 'anyone', 'someone', 'anybody', 'somebody', 'one of ours', 'one of my troops',
  'one of our units', 'any of my troops', 'any unit', 'a unit', 'any troop', 'ally', 'any of us', 'one of us', 'a teammate',
  'any teammate', 'one of my units', 'any of my units', 'an ally unit',
];
const HP_VERBS = [
  'drops below', 'drops below', 'drops under', 'drops to', 'falls below', 'falls under', 'falls to', 'goes below', 'goes under',
  'gets below', 'gets under', 'dips below', 'dips under', 'sinks below', 'is below', 'is under', 'is at', 'hits', 'reaches',
  'gets to', 'is less than', 'is lower than', 'has less than', 'goes down to', 'is on', 'below', 'under', 'at', 'drop below',
  'is at or below',
];
const HP_NUMBERS = [10, 15, 20, 25, 25, 30, 30, 30, 35, 40, 40, 45, 50, 50, 50, 50, 60, 65, 70, 75, 75, 80, 90];
const HURT_PHRASES: string[] = [
  'gets hurt', 'is hurt', 'is hurt', 'is wounded', 'gets wounded', 'is badly hurt', 'is in trouble', 'gets in trouble',
  'is in danger', 'is low', 'is low', 'gets low', 'is low on health', 'gets low on health', 'is low on hp', 'is low hp',
  'goes low', 'is weak', 'gets weak', 'is getting low', 'is dying', 'is almost dead', 'is nearly dead', 'is low health',
];

const GROUP_PLURAL = [
  'group up', 'group up', 'are grouped', 'are grouped up', 'bunch up', 'bunch up', 'are bunched up', 'are bunched together',
  'clump up', 'are clumped', 'are clumped together', 'cluster', 'cluster up', 'are clustered', 'stack up', 'are stacked',
  'are stacked up', 'are close together', 'are close together', 'stand close together', 'get close together',
  'are packed together', 'huddle up', 'ball up', 'are in a group', 'are near each other', 'are close to each other',
  'gather', 'gather up', 'group', 'group together', 'come together', 'are all together', 'stack', 'clump together',
];
const GROUP_SINGULAR = [
  'groups up', 'groups up', 'bunches up', 'clumps up', 'clusters', 'clusters up', 'stacks up', 'is grouped', 'is bunched up',
  'is clumped together', 'gets close together', 'balls up', 'huddles up', 'gathers', 'groups together', 'stacks',
];
const GROUP_THEYRE = ['all bunched up', 'grouped up', 'stacked together', 'clumped up', 'close together', 'all stacked', 'bunched together', 'all grouped'];
const GROUPED_PLURAL_SUBJECTS = ['they', 'they', 'enemies', 'the enemies', 'their troops', 'their units', 'enemy units', 'their guys'];
const GROUPED_SINGULAR_SUBJECTS = ['the enemy', 'the enemy', 'their army', 'the enemy team', 'the enemy army', 'their team'];

const ULT_OWNERS = ['their', 'their', 'the enemy', "the enemy's", 'enemy', "their general's", "the enemy general's"];
const ULT_WORDS = ['ultimate', 'ultimate', 'ult', 'ult', 'ulti', 'super', 'ultimate ability'];
const ULT_STATES = [
  'is charging', 'is charging', 'charges', 'starts charging', 'is charging up', 'is ready', 'is almost ready',
  'is nearly ready', 'is coming', 'is up', 'is almost up', 'is charged', 'gets charged', 'is about to go off', 'is close',
  'charging', 'is filling up', 'is full',
];
const ULT_CHARGERS = ['they', 'they', 'the enemy', 'their general', 'the enemy general', 'the enemies'];
const ULT_CHARGE_VERBS = ['charge', 'charges', 'start charging', 'are charging', 'begin charging', 'ready', 'are readying', 'are about to use', 'is about to use', 'are going to use', 'is charging', 'pop'];
const ULT_PRONOUNS = ['their', 'its', 'the', 'his', 'her'];
const ULT_WHOLE = ['they are about to ult', "they're about to ult", 'they ult', 'they start their ult', 'the enemy is about to ult', 'ult charging', 'they go for their ult', 'their ult comes', "they're ulting", 'they pop ult'];

// Sentences --------------------------------------------------------------------------------

const STEP_SEPARATORS: Piece[][] = [
  [o(','), o('then')], [o(','), o('then')], [o('then')], [o('then')], [o('then')], [o('and then')], [o('and then')],
  [o(','), o('and then')], [o(','), o('after that')], [o('after that')], [o(',')], [o(',')], [o('and')], [o(','), o('and')],
  [o(','), o('next')], [o('then after that')], [o(';'), o('then')], [o('-'), o('then')], [o(','), o('afterwards')],
  [o('and after that')], [o(','), o('and finally')], [o('->')], [o('.'), o('then')], [o('.')],
];
const PREFIX_FILLERS = ['yo', 'ok', 'okay', 'alright', 'listen', 'right', 'hey', 'ok so', 'quick', 'go', 'lets go', 'oi'];
/** Names players give a plan, written before it: "ambush: call the reserves, then ...". */
const PLAN_NAMES = ['ambush', 'plan a', 'plan b', 'the trap', 'feint', 'combo', 'opener', 'panic button', 'the wall', 'pincer', 'blitz', 'turtle', 'counter', 'kite', 'bait', 'big push', 'last stand', 'the classic'];
const SUFFIX_FILLERS = ['pls', 'please', 'now', 'now', 'asap', 'right now', 'quickly', 'go go go', 'lets go', 'right away', 'immediately', 'fast', 'thx', 'ok', 'quick', 'guys', 'boys', 'for now', 'okay'];

/** Words a step can point at with "him", "her" or "them": what the condition names. */
interface Sides {
  enemy: 'diver' | 'group' | null;
  ally: boolean;
}

interface StepOut {
  step: Step;
  pieces: Piece[];
}

class Writer {
  /** Typos come from their own random numbers, so the same seed without typos gives the same orders. */
  constructor(
    private readonly next: () => number,
    private readonly typoNext: (() => number) | null,
  ) {}

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Picks by weight: `[[weight, value], ...]`. */
  weighted<T>(options: readonly (readonly [number, T])[]): T {
    const total = options.reduce((sum, [w]) => sum + w, 0);
    let roll = this.next() * total;
    for (const [w, value] of options) {
      roll -= w;
      if (roll < 0) return value;
    }
    return options.at(-1)![1];
  }

  // Who acts ---------------------------------------------------------------------------------

  actors(allowAll = true): Actors {
    return allowAll && this.chance(0.5) ? { kind: 'all' } : { kind: 'class', cls: this.pick(OWN) };
  }

  actorWords(actors: Actors): string {
    return actors.kind === 'class' ? `${this.pick(OWN_DETS)}${this.pick(OWN_NAMES[actors.cls as Own])}` : this.pick(ALL_ACTORS);
  }

  /** Puts who acts around what they do: "rangers, fall back", "have the rangers fall back", "fall back, rangers". */
  withActors(actors: Actors, vp: Piece[]): Piece[] {
    if (actors.kind === 'all' && this.chance(0.55)) return vp;
    const who = a(this.actorWords(actors));
    const named = actors.kind === 'class' ? a(`${this.pick(['the ', 'the ', 'my ', 'our ', ''])}${this.pick(OWN_NAMES[actors.cls as Own])}`) : who;
    return this.weighted<Piece[]>([
      [45, [who, ...vp]],
      [14, [who, x(','), ...vp]],
      [7, [who, x(this.pick(MODALS)), ...vp]],
      [5, [x('have'), named, ...vp]],
      [3, [x('get'), named, x('to'), ...vp]],
      [3, [x('tell'), named, x('to'), ...vp]],
      [2, [x('i want'), named, x('to'), ...vp]],
      [2, [x('make'), named, ...vp]],
      [2, [x('order'), named, x('to'), ...vp]],
      [8, [...vp, x(','), who]],
      [actors.kind === 'class' || who.text.startsWith('every') ? 3 : 0, [...vp, who]],
      [4, [who, x(':'), ...vp]],
      [actors.kind === 'class' ? 2 : 0, [x('you'), who, x(','), ...vp]],
    ]);
  }

  // Targets ----------------------------------------------------------------------------------

  enemyClassWords(cls: TroopClass): string {
    return `${this.pick(ENEMY_DETS)}${this.pick(ENEMY_NAMES[cls])}`;
  }

  allyClassWords(cls: Own): string {
    return `${this.pick(ALLY_DETS)}${this.pick(ALLY_NAMES[cls])}`;
  }

  enemyTarget(sides: Sides): { target: Target; words: string } {
    const kind = this.weighted<Target['kind']>([[58, 'class'], [17, 'nearest'], [14, 'weakest'], [sides.enemy ? 22 : 0, 'trigger']]);
    switch (kind) {
      case 'class': {
        const cls = this.pick(ENEMY);
        return { target: { kind, cls }, words: this.enemyClassWords(cls) };
      }
      case 'nearest':
        return { target: { kind }, words: this.pick(ENEMY_NEAREST) };
      case 'weakest':
        return { target: { kind }, words: this.pick(ENEMY_WEAKEST) };
      default:
        return { target: { kind: 'trigger' }, words: this.pick(sides.enemy === 'group' ? GROUP_TRIGGER : ENEMY_TRIGGER) };
    }
  }

  allyTarget(sides: Sides): { target: Target; words: string } {
    const kind = this.weighted<Target['kind']>([[66, 'class'], [16, 'weakest'], [4, 'nearest'], [sides.ally ? 20 : 0, 'trigger']]);
    switch (kind) {
      case 'class': {
        const cls = this.pick(OWN);
        return { target: { kind, cls }, words: this.allyClassWords(cls) };
      }
      case 'weakest':
        return { target: { kind }, words: this.pick(ALLY_WEAKEST) };
      case 'nearest':
        return { target: { kind }, words: this.pick(ALLY_NEAREST) };
      default:
        return { target: { kind: 'trigger' }, words: this.pick(ALLY_TRIGGER) };
    }
  }

  // Steps ------------------------------------------------------------------------------------

  step(sides: Sides, previous: Step | null): StepOut {
    // "kill their healer, then their ranger" is common, so a Focus often follows a Focus.
    if (previous?.action === 'focus' && this.chance(0.15)) return this.focus(sides, previous);
    const action = this.weighted<Step['action']>([
      [30, 'focus'], [14, 'protect'], [15, 'move'], [14, 'fallBack'], [12, 'overcharge'], [11, 'hold'], [10, 'callReserve'],
    ]);
    switch (action) {
      case 'focus':
        return this.focus(sides, previous);
      case 'protect':
        return this.protect(sides);
      case 'move':
        return this.move(sides);
      case 'fallBack':
        return this.fallBack(sides);
      case 'overcharge':
        return this.overcharge();
      case 'hold':
        return this.hold();
      case 'callReserve':
        return this.callReserve();
    }
  }

  focus(sides: Sides, previous: Step | null): StepOut {
    // "kill their healer, then their ranger": a second Focus can leave out the verb.
    if (previous?.action === 'focus' && this.chance(0.35)) {
      const { target, words } = this.enemyTarget(sides);
      const pieces = this.weighted<Piece[]>([[6, [g(words)]], [2, [x('switch to'), g(words)]], [1, [g(words), x('next')]]]);
      return { step: { action: 'focus', actors: { kind: 'all' }, target }, pieces };
    }
    const actors = this.actors();
    const { target, words } = this.enemyTarget(sides);
    const step: Step = { action: 'focus', actors, target };
    // "everyone on him"
    if (actors.kind === 'all' && this.chance(0.05)) {
      return { step, pieces: [a(this.pick(['everyone', 'everybody', 'all', 'all units', 'all of you'])), v(this.pick(['on', 'onto', 'jump on'])), g(words)] };
    }
    if (target.kind === 'nearest' && this.chance(0.22)) {
      return { step, pieces: this.withActors(actors, [v(this.pick(FOCUS_ALONE))]) };
    }
    const [splitVerb, splitEnd] = this.pick(FOCUS_SPLIT);
    const vp = this.weighted<Piece[]>([
      [60, [v(this.pick(FOCUS_VERBS)), g(words)]],
      [8, [v(this.pick(FOCUS_VERBS)), g(words), x('first')]],
      [6, [v(splitVerb), g(words), v(splitEnd)]],
      [target.kind === 'class' ? 6 : 1, [g(words), x('first')]],
      [target.kind === 'class' ? 3 : 0, [g(words), v(this.pick(['needs to die', 'must die', 'dies first', 'is the priority', 'is priority', 'goes down first']))]],
      [3, [x('just'), v(this.pick(FOCUS_VERBS)), g(words)]],
      [3, [v(this.pick(FOCUS_VERBS)), g(words), x(this.pick(['down', 'fast', 'together', 'hard', 'as a team']))]],
    ]);
    return { step, pieces: this.withActors(actors, vp) };
  }

  protect(sides: Sides): StepOut {
    const actors = this.actors();
    const { target, words } = this.allyTarget(sides);
    const vp = this.weighted<Piece[]>([
      [70, [v(this.pick(PROTECT_VERBS)), g(words)]],
      [12, [v('keep'), g(words), v(this.pick(KEEP_STATES))]],
      [4, [v(this.pick(PROTECT_VERBS)), g(words), x(this.pick(['at all costs', 'no matter what', 'first']))]],
      [3, [v(this.pick(['dont let', 'do not let', "don't let"])), g(words), v(this.pick(['die', 'get hurt', 'get killed']))]],
      [3, [x('just'), v(this.pick(PROTECT_VERBS)), g(words)]],
    ]);
    return { step: { action: 'protect', actors, target }, pieces: this.withActors(actors, vp) };
  }

  move(sides: Sides): StepOut {
    const actors = this.actors();
    const place = this.weighted<'forward' | 'back' | 'behindEnemies' | 'ally'>([[30, 'forward'], [14, 'back'], [26, 'behindEnemies'], [30, 'ally']]);
    let step: Step;
    let vp: Piece[];
    switch (place) {
      case 'forward':
        step = { action: 'move', actors, to: { kind: 'forward' } };
        vp = this.weighted<Piece[]>([
          [65, [v(this.pick(MOVE_FORWARD_VERBS)), g(this.pick(FORWARD))]],
          [actors.kind === 'class' ? 4 : 0, [g(this.pick(['forward', 'forward', 'up', 'ahead']))]],
          [20, [v(this.pick(FORWARD_ALONE))]],
          [6, [v(this.pick(MOVE_FORWARD_VERBS)), g(this.pick(FORWARD)), x(this.pick(['a bit', 'a little', 'slowly', 'together', 'carefully']))]],
          [4, [v('advance'), g(this.pick(['forward', 'up', 'ahead']))]],
        ]);
        break;
      case 'back':
        step = { action: 'move', actors, to: { kind: 'back' } };
        vp = this.weighted<Piece[]>([
          [70, [v(this.pick(MOVE_BACK_VERBS)), g(this.pick(BACK))]],
          [20, [v(this.pick(BACK_ALONE))]],
          [6, [v(this.pick(MOVE_BACK_VERBS)), g(this.pick(BACK)), x(this.pick(['a bit', 'a little', 'slowly']))]],
        ]);
        break;
      case 'behindEnemies':
        step = { action: 'move', actors, to: { kind: 'behindEnemies' } };
        vp = this.chance(0.65)
          ? [v(this.pick(BEHIND_VERBS)), g(this.pick(BEHIND))]
          : (() => {
              const [verb, rest] = this.pick(FLANK);
              return rest ? [v(verb!), g(rest)] : [v(verb!)];
            })();
        break;
      case 'ally': {
        const { target, words } = this.allyTarget(sides);
        step = { action: 'move', actors, to: { kind: 'ally', ally: target } };
        vp = this.chance(0.12) ? [v('join'), g(words)] : [v(this.pick(MOVE_ALLY_VERBS)), g(`${this.pick(MOVE_ALLY_PREPS)} ${words}`)];
        break;
      }
    }
    // "send the vanguards behind enemy lines": who moves can come after the verb.
    if (actors.kind === 'class' && vp.length === 2 && vp[1]!.role === 'G' && this.chance(0.2)) {
      return { step, pieces: [v(this.pick(['send', 'send', 'move', 'take', 'bring'])), a(`the ${this.pick(OWN_NAMES[actors.cls as Own])}`), vp[1]!] };
    }
    return { step, pieces: this.withActors(actors, vp) };
  }

  fallBack(sides: Sides): StepOut {
    const actors = this.actors();
    if (this.chance(0.36)) {
      const { target, words } = this.allyTarget(sides);
      const vp = [v(this.pick(FALLBACK_TO_VERBS)), g(`${this.pick(FALLBACK_PREPS)} ${words}`)];
      return { step: { action: 'fallBack', actors, to: target }, pieces: this.withActors(actors, vp) };
    }
    if (actors.kind === 'class' && this.chance(0.06)) {
      const who = a(`the ${this.pick(OWN_NAMES[actors.cls as Own])}`);
      return { step: { action: 'fallBack', actors, to: null }, pieces: [v(this.pick(['get', 'pull', 'take'])), who, v(this.pick(['out', 'out of there', 'back', 'away']))] };
    }
    const vp = this.weighted<Piece[]>([
      [85, [v(this.pick(FALLBACK_VERBS))]],
      [6, [v(this.pick(FALLBACK_VERBS)), x(this.pick(['a bit', 'now', 'quickly', 'together', 'fast']))]],
      [4, [x('just'), v(this.pick(FALLBACK_VERBS))]],
    ]);
    return { step: { action: 'fallBack', actors, to: null }, pieces: this.withActors(actors, vp) };
  }

  overcharge(): StepOut {
    if (this.chance(0.28)) {
      // Everyone fires their skill.
      const pieces = this.weighted<Piece[]>([
        [40, this.withActors({ kind: 'all' }, [v(this.pick(SKILL_ANY))])],
        [30, [v(this.pick(SKILL_ALL))]],
        [15, [v(this.pick(OVERCHARGE_OBJECT_VERBS)), a(this.pick(['everyone', 'everybody', 'all', 'all units', 'the whole team']))]],
        [15, [a(this.pick(['everyone', 'everybody', 'all units', 'all of you'])), v(this.pick(SKILL_ANY))]],
      ]);
      return { step: { action: 'overcharge', actors: { kind: 'all' } }, pieces };
    }
    const cls = this.pick(OWN);
    const step: Step = { action: 'overcharge', actors: { kind: 'class', cls } };
    const skill = this.pick(SKILL_OWN[cls]);
    const skillPieces = [v(skill[0]!), ...(skill[1] ? [x(skill[1])] : [])];
    // On its own, only the skill's name says whose skill it is: "use shove", not "shield up".
    const named = this.pick(SKILL_OWN[cls].filter((s) => s[0]!.includes(SKILL_NAMES[cls])));
    const pieces = this.weighted<Piece[]>([
      [30, this.withActors(step.actors, [v(this.pick(SKILL_ANY))])],
      [25, this.withActors(step.actors, skillPieces)],
      [15, [v(this.pick(OVERCHARGE_OBJECT_VERBS)), a(`${this.pick(['the ', 'my ', 'our ', '', 'all '])}${this.pick(OWN_NAMES[cls])}`)]],
      [6, [v(this.pick(['pop', 'use', 'fire', 'activate'])), a(`the ${this.pick(RESERVE_NAMES[cls])}`), v(this.pick(['skill', 'ability']))]],
      [14, [v(named[0]!), ...(named[1] ? [x(named[1])] : [])]],
      [4, [v(`${this.pick(['use', 'cast', 'pop'])} ${SKILL_NAMES[cls]}`), x('with the'), a(this.pick(OWN_NAMES[cls]))]],
    ]);
    return { step, pieces };
  }

  hold(): StepOut {
    const actors = this.actors();
    if (actors.kind === 'all' && this.chance(0.06)) {
      return { step: { action: 'hold', actors }, pieces: [a(this.pick(['nobody', 'no one', 'noone'])), v(this.pick(['move', 'moves', 'move a muscle']))] };
    }
    const vp = this.weighted<Piece[]>([
      [75, [v(this.pick(HOLD_VERBS))]],
      [15, [v(this.pick(HOLD_VERBS)), x(this.pick(HOLD_EXTRAS))]],
      [6, [x('just'), v(this.pick(HOLD_VERBS))]],
      [4, [x('just'), v(this.pick(HOLD_VERBS)), x(this.pick(HOLD_EXTRAS))]],
    ]);
    return { step: { action: 'hold', actors }, pieces: this.withActors(actors, vp) };
  }

  callReserve(): StepOut {
    if (this.chance(0.5)) {
      return { step: { action: 'callReserve', reserve: null }, pieces: [v(this.pick(RESERVE_ANY))] };
    }
    const cls = this.pick(OWN);
    const name = this.pick(RESERVE_NAMES[cls]);
    const pieces = this.weighted<Piece[]>([
      [12, [v('call the reserve'), g(name)]],
      [8, [v('call in'), g(`a ${name}`), v(this.pick(['from the reserves', 'from reserve', 'from reserves', 'from the reserve']))]],
      [8, [v(this.pick(['call in', 'bring in', 'send in', 'call'])), g(`another ${name}`)]],
      [8, [v('bring in the reserve'), g(name)]],
      [6, [v(this.pick(['send in the backup', 'call in the backup', 'bring in the backup'])), g(name)]],
      [6, [v(this.pick(['get the reserve', 'get the backup', 'bring the backup', 'send the backup'])), g(name), v('in')]],
      [4, [v('deploy a reserve'), g(name)]],
      [4, [v('reinforce with'), g(`a ${name}`)]],
      [6, [v('call reserve'), g(name)]],
      [4, [v('bring the reserve'), g(name), v('in')]],
      [4, [v(this.pick(['call in a fresh', 'send in a new', 'bring in a fresh', 'get a fresh'])), g(name)]],
      [4, [v('summon a'), g(name)]],
      [3, [v('call in the reserve'), g(name)]],
      [3, [v(this.pick(['reinforcements', 'backup', 'reserve', 'reserves'])), x(':'), g(name)]],
      [3, [v('we need'), g(`${this.pick(['a', 'another'])} ${name}`), v(this.pick(['from the reserves', 'from reserve', 'in here']))]],
    ]);
    return { step: { action: 'callReserve', reserve: cls }, pieces };
  }

  // Triggers ---------------------------------------------------------------------------------

  trigger(): { trigger: Trigger; pieces: Piece[] } {
    const kind = this.weighted<Trigger['kind']>([[36, 'enemyReachesBackline'], [36, 'allyBelowHp'], [18, 'enemiesGrouped'], [10, 'enemyUltimateCharging']]);
    switch (kind) {
      case 'enemyReachesBackline':
        return this.backline();
      case 'allyBelowHp':
        return this.allyHp();
      case 'enemiesGrouped':
        return this.grouped();
      case 'enemyUltimateCharging':
        return { trigger: { kind }, pieces: this.ultimate() };
    }
  }

  backline(): { trigger: Trigger; pieces: Piece[] } {
    const cls: TroopClass | 'any' = this.chance(0.7) ? this.pick(ENEMY) : 'any';
    const who = cls === 'any' ? this.pick(ANY_ENEMY) : `${this.pick(['their ', 'their ', 'the ', 'the ', 'the enemy ', 'enemy ', 'that ', ''])}${this.pick(ENEMY_NAMES[cls])}`;
    const what = this.chance(0.45) ? this.pick(DIVE_ALONE) : `${this.pick(REACH_VERBS)} ${this.pick(BACKLINE_PLACES)}`;
    return { trigger: { kind: 'enemyReachesBackline', enemy: cls }, pieces: [e(who), t(what)] };
  }

  allyHp(): { trigger: Trigger; pieces: Piece[] } {
    const cls: Own | 'any' = this.chance(0.7) ? this.pick(OWN) : 'any';
    const who = cls === 'any' ? this.pick(ANY_ALLY) : `${this.pick(['my ', 'my ', 'our ', 'the ', '', 'my own '])}${this.pick(ALLY_NAMES[cls])}`;
    const how = this.weighted<'number' | 'fraction' | 'hurt'>([[55, 'number'], [15, 'fraction'], [30, 'hurt']]);
    let hpPercent: number;
    let what: string;
    if (how === 'hurt') {
      what = this.pick(HURT_PHRASES);
      const phrase = Object.keys(HURT_WORDS).sort((p, q) => q.length - p.length).find((p) => ` ${what} `.includes(` ${p} `))!;
      hpPercent = HURT_WORDS[phrase]!;
    } else if (how === 'fraction') {
      const [percent, amount] = this.pick<[number, string]>([
        [50, 'half'], [50, 'half'], [50, 'half hp'], [50, 'half health'], [50, 'half her hp'], [25, 'a quarter'], [25, 'a quarter hp'], [25, 'quarter health'], [33, 'a third'],
      ]);
      hpPercent = percent;
      what = percent === 50 && this.chance(0.15) ? `loses ${this.pick(['half', 'half her health', 'half his hp', 'half their health'])}` : `${this.pick(HP_VERBS)} ${amount}`;
    } else {
      hpPercent = this.pick(HP_NUMBERS);
      const n = hpPercent;
      const amount = this.weighted<string>([
        [30, `${n}%`], [12, `${n} percent`], [10, `${n}% hp`], [6, `${n}% health`], [8, `${n} hp`], [12, `${n}`], [4, `${n} health`],
        [NUMBER_NAMES[n] ? 6 : 0, `${NUMBER_NAMES[n]} percent`], [3, `${n} % hp`],
      ]);
      what = `${this.pick(HP_VERBS)} ${amount}`;
    }
    return { trigger: { kind: 'allyBelowHp', ally: cls, hpPercent }, pieces: [e(who), t(what)] };
  }

  grouped(): { trigger: Trigger; pieces: Piece[] } {
    if (this.chance(0.55)) {
      const count = this.pick([2, 3, 3, 4, 4, 5]);
      const n = this.chance(0.25) ? NUMBER_NAMES[count]! : String(count);
      const who = this.pick([`${n} enemies`, `${n} enemies`, `${n} or more enemies`, `${n}+ enemies`, `at least ${n} enemies`, `${n} of them`, `${n} or more of them`, `${n} enemy units`, `${n} of their troops`, `${n} foes`, `${n} or more`]);
      const pieces = this.chance(0.08)
        ? [t(this.pick(['there are', "there's"])), e(`${n} of them`), t(this.pick(['close together', 'grouped up', 'bunched up', 'in a group']))]
        : [e(who), t(this.pick(GROUP_PLURAL))];
      return { trigger: { kind: 'enemiesGrouped', count }, pieces };
    }
    const form = this.weighted<'plural' | 'singular' | 'theyre'>([[60, 'plural'], [25, 'singular'], [15, 'theyre']]);
    const pieces =
      form === 'plural'
        ? [e(this.pick(GROUPED_PLURAL_SUBJECTS)), t(this.pick(GROUP_PLURAL))]
        : form === 'singular'
          ? [e(this.pick(GROUPED_SINGULAR_SUBJECTS)), t(this.pick(GROUP_SINGULAR))]
          : [e("they're"), t(this.pick(GROUP_THEYRE))];
    return { trigger: { kind: 'enemiesGrouped', count: 3 }, pieces };
  }

  ultimate(): Piece[] {
    return this.weighted<Piece[]>([
      [55, [t(`${this.pick(ULT_OWNERS)} ${this.pick(ULT_WORDS)} ${this.pick(ULT_STATES)}`)]],
      [25, [t(`${this.pick(ULT_CHARGERS)} ${this.pick(ULT_CHARGE_VERBS)} ${this.pick(ULT_PRONOUNS)} ${this.pick(ULT_WORDS)}`)]],
      [20, [t(this.pick(ULT_WHOLE))]],
    ]);
  }

  // Whole orders -----------------------------------------------------------------------------

  condition(): { condition: Condition; pieces: Piece[] } {
    const repeat = this.chance(0.22);
    const first = this.trigger();
    const triggers = [first.trigger];
    const pieces = [c(this.pick(repeat ? REPEAT_WORDS : ONCE_WORDS)), ...startOf(first.pieces)];
    if (this.chance(0.14)) {
      const second = this.trigger();
      if (second.trigger.kind !== first.trigger.kind) {
        triggers.push(second.trigger);
        pieces.push(...this.pick(TRIGGER_JOINERS), ...startOf(second.pieces));
      }
    }
    return { condition: { triggers, repeat }, pieces };
  }

  pair(): Pair {
    let condition: Condition | null = null;
    let conditionPieces: Piece[] = [];
    if (this.chance(0.47)) ({ condition, pieces: conditionPieces } = this.condition());
    const kinds = condition?.triggers.map((tr) => tr.kind) ?? [];
    const sides: Sides = {
      enemy: kinds.includes('enemyReachesBackline') ? 'diver' : kinds.includes('enemiesGrouped') ? 'group' : null,
      ally: kinds.includes('allyBelowHp'),
    };

    const count = this.weighted([[46, 1], [37, 2], [17, 3]] as const);
    const steps: Step[] = [];
    const body: Piece[] = [];
    if (count > 1 && this.chance(0.07)) body.push(o('first'));
    for (let i = 0; i < count; i++) {
      const { step, pieces } = this.step(sides, steps.at(-1) ?? null);
      if (i > 0) body.push(...this.pick(STEP_SEPARATORS));
      steps.push(step);
      body.push(...startOf(pieces));
    }

    let pieces = body;
    if (condition) {
      pieces = this.chance(0.76)
        ? [...conditionPieces, ...(this.chance(0.72) ? [o(',')] : this.chance(0.1) ? [o(','), o('then')] : []), ...body]
        : [...body, ...(this.chance(0.3) ? [o(',')] : []), ...conditionPieces];
    }
    if (this.chance(0.1)) pieces = [o(this.pick(PREFIX_FILLERS)), ...(this.chance(0.5) ? [o(',')] : []), ...pieces];
    else if (this.chance(0.04)) pieces = [o(this.pick(PLAN_NAMES)), o(':'), ...pieces];
    if (this.chance(0.12)) pieces = [...pieces, o(this.pick(SUFFIX_FILLERS))];
    if (this.chance(0.25)) pieces = [...pieces, o(this.pick(['!', '!', '.', '!!', '...', '?']))];
    if (this.typoNext) pieces = pieces.map((p) => ({ ...p, text: this.typos(p.text, this.typoNext!) }));
    const text = joinPieces(pieces);
    return { text: this.chance(0.5) ? text : text.charAt(0).toUpperCase() + text.slice(1), card: { condition, steps, auto: false }, pieces };
  }

  /** Now and then a typo: two letters swapped, one dropped, doubled or hit next to the right key. */
  typos(text: string, next: () => number): string {
    return text
      .split(' ')
      .map((word) => (word.length >= 4 && /^[a-z]+$/.test(word) && next() < 0.025 ? typo(word, next) : word))
      .join(' ');
  }
}

const NEAR_KEYS: Record<string, string> = {
  a: 'sq', b: 'vn', c: 'xv', d: 'sf', e: 'wr', f: 'dg', g: 'fh', h: 'gj', i: 'uo', j: 'hk', k: 'jl', l: 'ko', m: 'nk', n: 'bm',
  o: 'ip', p: 'ol', q: 'wa', r: 'et', s: 'ad', t: 'ry', u: 'yi', v: 'cb', w: 'qe', x: 'zc', y: 'tu', z: 'xa',
};

function typo(word: string, next: () => number): string {
  const i = 1 + Math.floor(next() * (word.length - 2));
  const kind = next();
  if (kind < 0.4) return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
  if (kind < 0.65) return word.slice(0, i) + word.slice(i + 1);
  if (kind < 0.8) return word.slice(0, i) + word[i] + word.slice(i);
  return word.slice(0, i) + (NEAR_KEYS[word[i]!] ?? word[i]!).charAt(Math.floor(next() * 2)) + word.slice(i + 1);
}

/** Marks the first piece as the start of a trigger or step. */
function startOf(pieces: Piece[]): Piece[] {
  return pieces.map((p, i) => (i === 0 ? { ...p, start: true as const } : p));
}

/** The sentence: pieces joined by spaces, with punctuation against the word before it. */
export function joinPieces(pieces: readonly Piece[]): string {
  return pieces.reduce((text, p) => (text === '' ? p.text : /^[,.!?;:]/.test(p.text) ? `${text}${p.text}` : `${text} ${p.text}`), '');
}

/** `count` distinct, legal sentence and card pairs for a seed; `typos: false` leaves out the typos. */
export function generate(count: number, seed = 1, options: { typos?: boolean } = {}): Pair[] {
  const writer = new Writer(random(seed), options.typos === false ? null : random(seed ^ 0x5eed));
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
