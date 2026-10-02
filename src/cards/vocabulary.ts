// The words the rule parser knows, as phrase tables. Each phrase maps to what it means.
// Phase 3 reuses these when it generates training sentences for the small model.

import type { TroopClass } from '../data/units';

export const CLASS_WORDS: Record<string, TroopClass> = {
  vanguard: 'vanguard', vanguards: 'vanguard', tank: 'vanguard', tanks: 'vanguard',
  ranger: 'ranger', rangers: 'ranger', archer: 'ranger', archers: 'ranger', sniper: 'ranger', snipers: 'ranger',
  shooter: 'ranger', shooters: 'ranger',
  guardian: 'guardian', guardians: 'guardian', healer: 'guardian', healers: 'guardian', support: 'guardian',
  supports: 'guardian', medic: 'guardian', medics: 'guardian',
  invoker: 'invoker', invokers: 'invoker', mage: 'invoker', mages: 'invoker', caster: 'invoker', casters: 'invoker',
  wizard: 'invoker', wizards: 'invoker',
  assassin: 'assassin', assassins: 'assassin', rogue: 'assassin', rogues: 'assassin',
};

export const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** Words that start a condition. The ones marked true repeat ("every time"). */
export const CONDITION_STARTS: Record<string, boolean> = {
  when: false, if: false, once: false, 'as soon as': false, 'the moment': false, 'in case': false,
  whenever: true, 'every time': true, 'each time': true, anytime: true, 'any time': true,
};

export const STEP_SEPARATORS = [
  ',', 'then', ', then', 'and then', ', and then', 'and', ', and', 'after that', ', after that', 'and after that',
  'afterwards', 'next', 'followed by',
];

export const ENEMY_OWNER = ['their', 'the enemy', "the enemy's", 'enemy', "enemy's", 'an enemy', 'any enemy', 'the', 'a', 'an', 'that', 'any'];
export const ALLY_OWNER = ['my', 'our', 'your', 'the', 'a', 'an', 'any', 'one of my', 'one of our'];

export const ACTORS_ALL = [
  'everyone', 'everybody', 'all', 'all of you', 'all troops', 'all units', 'the whole army', 'the army', 'my army',
  'the team', 'team', 'my troops', 'our troops', 'troops', 'squad', 'the squad', 'all my troops', 'you all', 'everyone else',
];
export const ACTOR_FILLERS = ['should', 'must', 'need to', 'needs to', 'will', 'can'];

// Conditions -------------------------------------------------------------------------------

export const ULTIMATE_OWNER = ['their', 'the enemy', "the enemy's", 'enemy', "enemy's", 'the enemies', "their general's"];
export const ULTIMATE_WORDS = ['ultimate', 'ult', 'ulti', 'super'];
export const ULTIMATE_STATES = [
  'is charging', 'charges', 'starts charging', 'begins charging', 'is ready', 'is almost ready', 'is coming', 'is up',
  'is charged', 'charging', 'gets charged',
];
export const ULTIMATE_CHARGERS = ['they', 'the enemy', 'their general', 'the enemy general', 'the enemies'];
export const ULTIMATE_CHARGE_VERBS = [
  'charge', 'charges', 'start charging', 'starts charging', 'begin charging', 'begins charging', 'are charging',
  'is charging', 'ready', 'readies',
];
export const ULTIMATE_PRONOUNS = ['their', 'its', 'the', 'his', 'her'];

export const GROUP_NOUNS = [
  'enemies', 'enemy units', 'enemy troops', 'of them', 'of their troops', 'foes', 'of the enemies', 'enemy',
];
export const GROUP_SUBJECTS_ANY = ['they', 'the enemy', 'the enemies', 'enemies'];
export const GROUP_VERBS = ['are', 'get', 'stand', 'gather', 'come', 'are standing', 'end up', 'is'];
export const GROUP_WORDS = [
  'close together', 'together', 'grouped', 'grouped up', 'group up', 'groups up', 'bunched', 'bunched up', 'bunch up',
  'bunches up', 'clumped', 'clumped up', 'clump up', 'clumps up', 'clustered', 'cluster', 'cluster up', 'stacked',
  'stack up', 'stacked up', 'packed together', 'huddle up', 'huddled up', 'in a group', 'in a clump', 'close to each other',
  'near each other',
];

export const ALLY_ANY = [
  'ally', 'allies', 'troop', 'troops', 'unit', 'units', 'anyone', 'someone', 'anybody', 'somebody', 'friend', 'one',
];
export const HP_VERBS = ['drops', 'drop', 'falls', 'fall', 'goes', 'go', 'gets', 'get', 'dips', 'dip', 'is', 'are', 'sinks', 'hits'];
export const HP_BELOW = ['below', 'under', 'beneath', 'lower than', 'less than', 'to', 'under the', 'at'];
export const HP_UNITS = ['hp', 'health', 'life'];
export const HP_FRACTIONS: Record<string, number> = { half: 50, 'a quarter': 25, quarter: 25, 'a third': 33 };

export const BACKLINE_ANY = [
  'anyone', 'anybody', 'someone', 'somebody', 'an enemy', 'any enemy', 'enemies', 'they', 'the enemy', 'one of them',
  'one of their troops', 'an enemy unit', 'any of them',
];
export const DIVE_VERBS = ['dives', 'dive', 'dove', 'jumps in', 'jumps', 'leaps in', 'goes in', 'flanks'];
export const REACH_VERBS = [
  'reaches', 'reach', 'gets to', 'gets into', 'breaks into', 'hits', 'attacks', 'goes after', 'reaches into',
  'gets behind', 'gets in', 'is in', 'jumps', 'dives', 'dive', 'targets', 'rushes',
];
export const BACKLINE_PLACES = [
  'my backline', 'our backline', 'the backline', 'my back line', 'our back line', 'the back line', 'my back', 'our back',
  'my rangers', 'our rangers', 'my ranger', 'our ranger', 'my guardian', 'our guardian', 'my guardians', 'our guardians',
  'my healer', 'our healer', 'my support', 'our support', 'my backliners', 'our backliners', 'us', 'on us', 'in',
];

// Steps ------------------------------------------------------------------------------------

export const FOCUS_VERBS = [
  'focus fire on', 'focus fire', 'focus on', 'focus', 'concentrate fire on', 'concentrate on', 'attack', 'kill',
  'target', 'take out', 'take down', 'hit', 'shoot', 'shoot at', 'go after', 'go for', 'gang up on', 'destroy',
  'eliminate', 'hunt', 'hunt down', 'charge at', 'charge', 'strike', 'burn down', 'finish off', 'finish', 'deal with',
];
/** Focus verbs that make sense without a target: they mean the nearest enemy. */
export const FOCUS_ALONE = ['attack', 'charge', 'kill', 'shoot', 'strike'];

export const ENEMY_PRONOUNS = [
  'him', 'her', 'it', 'them', 'the attacker', 'that attacker', 'the diver', 'that one', 'that unit', 'the intruder',
  'that enemy', 'the group', 'that group', 'those enemies', 'whoever dove',
];
export const ENEMY_NEAREST = [
  'the nearest enemy', 'the nearest one', 'the nearest', 'the closest enemy', 'the closest one', 'the closest',
  'nearest enemy', 'closest enemy', 'whoever is closest', 'whoever is nearest', 'the enemy', 'enemies', 'the enemies',
];
export const ENEMY_WEAKEST = [
  'the weakest enemy', 'the weakest one', 'the weakest', 'weakest enemy', 'the lowest hp enemy', 'the lowest health enemy',
  'the most hurt enemy', 'the most wounded enemy', 'whoever is weakest', 'the wounded enemy', 'the low one',
];

export const ALLY_PRONOUNS = ['him', 'her', 'it', 'them', 'that ally', 'that one', 'that troop'];
export const ALLY_WEAKEST = [
  'the weakest', 'my weakest', 'our weakest', 'the weakest ally', 'my weakest troop', 'whoever is hurt',
  'whoever is weakest', 'the most hurt', 'the most wounded', 'the wounded', 'the hurt one', 'whoever is low',
];
export const ALLY_NEAREST = ['the nearest ally', 'my nearest troop', 'the closest ally'];

export const PROTECT_VERBS = [
  'protect', 'cover', 'guard', 'defend', 'shield', 'save', 'help', 'watch over', 'look after', 'escort', 'bodyguard',
  'back up', 'stay with', 'stick with', 'peel for',
];
/** "keep my Rangers alive" */
export const KEEP_STATES = ['alive', 'safe', 'covered', 'protected'];

export const FALLBACK_VERBS = [
  'fall back', 'retreat', 'pull back', 'back off', 'regroup', 'withdraw', 'run back', 'run away', 'get back', 'go back',
  'fall back together',
];
export const FALLBACK_TOWARD = ['to', 'toward', 'towards', 'behind', 'near', 'on', 'at', 'around', 'with'];

export const MOVE_VERBS = ['move', 'advance', 'go', 'push', 'walk', 'step', 'head', 'run', 'rush', 'flank', 'get'];
export const MOVE_FORWARD = [
  'forward', 'forwards', 'up', 'ahead', 'to the front', 'up front', 'to the frontline', 'to the front line', 'closer',
];
export const MOVE_BACK = ['back', 'backward', 'backwards', 'to the back', 'away'];
export const MOVE_BEHIND = [
  'behind the enemy', 'behind enemies', 'behind the enemies', 'behind them', 'behind enemy lines', 'around them',
  'around the enemy', 'behind their lines', 'to their backline', 'into their backline', 'behind their backline',
  'into their back line', 'to their back line',
];
export const MOVE_TOWARD = ['to', 'toward', 'towards', 'next to', 'beside', 'near', 'over to', 'up to', 'with'];
/** Move verbs that already say where: "advance" and "push" mean forward, "flank" means behind the enemy. */
export const MOVE_IMPLIED: Record<string, 'forward' | 'behindEnemies'> = { advance: 'forward', push: 'forward', flank: 'behindEnemies' };

export const HOLD_VERBS = [
  'hold the line', 'hold the position', 'hold position', 'hold your position', 'hold your ground', 'hold ground',
  'hold the ground', 'hold back', 'hold still', 'hold', 'stand your ground', 'stand ground', 'stand firm', 'stand still',
  'stay put', 'stay still', 'stay in place', 'stay', "don't move", 'dont move', 'do not move', 'wait', 'dig in',
  'sit tight', 'hunker down', 'hold in place',
];
export const HOLD_EXTRAS = ['here', 'there', 'in place', 'where you are', 'your position', 'still'];

export const OVERCHARGE_VERBS = [
  'overcharge', 'supercharge', 'power up', 'boost', 'empower', 'use your skill', 'use your skills', 'use their skill',
  'use their skills', 'use skills', 'use skill', 'use your ability', 'use your abilities', 'use abilities',
  'use ability', 'fire your skill', 'fire your skills', 'pop your skill', 'pop skills', 'unleash',
];
/** Skill names that mean "Overcharge" for the class that owns the skill. */
export const SKILL_VERBS: Record<string, TroopClass> = { shove: 'vanguard' };
export const SKILL_OBJECTS = ['them', 'them back', 'back', 'the enemy', 'the enemy back'];

export const RESERVE_VERBS = ['call in', 'call', 'bring in', 'bring', 'send in', 'send', 'summon', 'deploy'];
export const RESERVE_WORDS = [
  'the reserves', 'the reserve', 'a reserve', 'reserves', 'reserve', 'reinforcements', 'backup', 'a reinforcement',
  'the reinforcements', 'our reserves', 'my reserves', 'our reserve', 'my reserve', 'a reserve troop',
];
export const RESERVE_ALONE = ['reinforce'];
export const RESERVE_FROM = ['from reserve', 'from the reserves', 'from reserves', 'from the reserve', 'in'];

/** Words dropped before parsing. */
export const FILLER_WORDS = new Set(['please', 'now', 'immediately', 'quickly', 'asap', 'okay', 'ok']);
