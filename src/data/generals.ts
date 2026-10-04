// The six Generals: who they are, the numbers behind how each one writes your cards (the rules
// live in src/cards/personality.ts, their reply lines in replies.ts), and each one's troop
// skill, doctrine, ultimate and mana twist (the battle engine reads these numbers).

import type { ActionName, Trigger } from '../cards/types';
import type { TroopClass } from './units';

export const GENERAL_IDS = ['captain', 'warlord', 'engineer', 'hiveMother', 'strategist', 'conductor'] as const;
export type GeneralId = (typeof GENERAL_IDS)[number];

export type UltimateId = 'rally' | 'reapersToll' | 'thermalDetonation' | 'forcedEvolution' | 'gravityWell' | 'shatterstorm';

/** A named part of a General, with what it does, for the select screen. */
export interface GeneralPart {
  name: string;
  text: string;
}

export interface GeneralInfo {
  name: string;
  /** The faction the General leads; the Captain has none. */
  faction: string | null;
  /** The General's way to win, in a few words. */
  motto: string;
  /** How the General writes your cards, in a few words. */
  writes: string;
  troopSkill: GeneralPart | null;
  doctrine: string;
  /** `needs`: what the ultimate waits for, when it has nothing to work on yet. */
  ultimate: GeneralPart & { id: UltimateId; needs: string | null };
  twist: GeneralPart | null;
}

/** You start with the Captain and recruit the others by beating them (phase 5). */
export const STARTING_GENERAL: GeneralId = 'captain';

export const WARLORD_RULES = {
  /** Writing any of these keeps a Fall Back a plain retreat. */
  insistWords: ['hold back'],
} as const;

export const HIVE_MOTHER_RULES = {
  /** Steps past this many are dropped from the end of the card. */
  maxSteps: 2,
} as const;

/**
 * A suggested trigger. 'target' means the class the card's first step aims at, when it aims at
 * a class; otherwise any troop.
 */
export type SuggestedTrigger =
  | { kind: 'enemyReachesBackline'; enemy: TroopClass | 'any' | 'target' }
  | { kind: 'allyBelowHp'; ally: TroopClass | 'any' | 'target'; hpPercent: number }
  | Extract<Trigger, { kind: 'enemiesGrouped' | 'enemyUltimateCharging' }>;

export const STRATEGIST_RULES = {
  /** The condition the Strategist suggests for a card without one, by its first step's action. */
  suggestions: {
    focus: { kind: 'enemyReachesBackline', enemy: 'target' },
    move: { kind: 'enemiesGrouped', count: 3 },
    fallBack: { kind: 'allyBelowHp', ally: 'any', hpPercent: 50 },
    protect: { kind: 'allyBelowHp', ally: 'target', hpPercent: 50 },
    // Not "when their ultimate charges": enemy Generals don't fire ultimates until session 4D.
    hold: { kind: 'enemiesGrouped', count: 3 },
    overcharge: { kind: 'enemiesGrouped', count: 3 },
    callReserve: { kind: 'allyBelowHp', ally: 'any', hpPercent: 50 },
    // Legendary actions: take a diver, rescue or spend a troop in trouble, wall off a crowd,
    // and echo when the enemy gathers.
    hijack: { kind: 'enemyReachesBackline', enemy: 'any' },
    swap: { kind: 'allyBelowHp', ally: 'any', hpPercent: 50 },
    bloodPact: { kind: 'allyBelowHp', ally: 'any', hpPercent: 25 },
    fortify: { kind: 'enemiesGrouped', count: 3 },
    echo: { kind: 'enemiesGrouped', count: 3 },
  } satisfies Record<ActionName, SuggestedTrigger>,
  /** Only these classes dive at your backline, so "wait for them to reach it" fits only them. */
  divers: ['vanguard', 'assassin'] as readonly TroopClass[],
} as const;

// Troop skills, doctrines, ultimates and mana twists (session 4C). Starting values to tune.

/** Each General's troop skill: every troop of the General's side has it. */
export const TROOP_SKILLS = {
  /** Warlord: a troop pays HP to make a nearby ally that is fighting attack much faster. */
  vampiricLink: {
    cooldownSeconds: 14,
    initialCooldownSeconds: 6,
    /** The ally must be this close, center to center. */
    range: 140,
    hpCostShare: 0.1,
    /** Only troops with at least this share of their HP left pay. */
    minHpShare: 0.5,
    /** +200% attack speed: three times as fast. */
    attackSpeedBonus: 2,
    durationSeconds: 1.5,
  },
  /** Engineer: every few attacks a troop vents its heat. */
  venting: { everyAttacks: 5, radius: 55, damage: 30, selfDamageShare: 0.02 },
  /** Hive Mother: a troop that kills adapts for a while. */
  assimilation: {
    durationSeconds: 10,
    /** Killing a Vanguard or Guardian grows a shell; killing anything else, claws. */
    shellFrom: ['vanguard', 'guardian'] as readonly TroopClass[],
    shellArmor: 0.2,
    clawsDamageBonus: 0.25,
  },
  /** Strategist: once per battle, a troop dodges a blow that would kill it. */
  phaseShift: { stunSeconds: 1.5 },
  /** Conductor: hits stack Vibration; a full stack shatters the enemy's armor. */
  echoStrike: { maxStacks: 3, stackSeconds: 4, shatterArmorLoss: 0.1, shatterSeconds: 4 },
} as const;

/** How each General's doctrine changes troop behavior. */
export const DOCTRINES = {
  engineer: {
    /** The doctrine holds for the opening of the battle only, while Build-Up grows your pips; then troops fight as usual. */
    holdSeconds: 40,
    /** Vanguards hold their ground: they leave their spot only for enemies this close to it. */
    holdRadius: 260,
    /** ...and go back once they are this far from it. */
    holdSlack: 14,
    /** Rangers stand this far behind the nearest Vanguard, away from the enemy... */
    coverDistance: 45,
    /** ...until an enemy comes this much closer than their range; then they fight. */
    coverLeaveDistance: 80,
  },
  strategist: {
    /** Rangers back away between shots from enemies closer than this share of their range. */
    keepRangeShare: 0.85,
  },
} as const;

/** Each General's ultimate (the Captain's Rally is in src/data/command.ts). */
export const ULTIMATE_RULES = {
  reapersToll: { hpShareBelow: 0.2, wraithSeconds: 10, wraithDamageBonus: 0.5 },
  thermalDetonation: {
    /** Every troop heals this share of its max HP, plus this much more per point of heat it had. */
    healShare: 0.08,
    healSharePerHeat: 0.03,
    beamDamage: 60,
    beamDamagePerHeat: 12,
    /** Enemies this close to the beam's line are hit. */
    beamWidth: 30,
  },
  forcedEvolution: { damageBonus: 0.5, armorBonus: 0.1 },
  gravityWell: {
    /** Units this close to the enemy army's middle are pulled. */
    radius: 240,
    pullDistance: 150,
    pullSeconds: 0.6,
  },
  shatterstorm: { damagePerStack: 45, blastRadius: 60, blastShare: 0.5 },
} as const;

/** Each General's mana twist. */
export const MANA_TWISTS = {
  bloodPrice: { hpSharePerPip: 0.1 },
  buildUp: { everySeconds: 30, maxExtraPips: 3 },
  /** Pip refill speed as a share of the usual. */
  feeding: { refillRate: 0.5, pipsPerKill: 1 },
  prepared: { refillRate: 0.75 },
  rhythm: { perfectPipRefund: 2, glowLingerSeconds: 2.5 },
} as const;

/** 0.25 as "25%", for the texts below. */
function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export const GENERALS: Readonly<Record<GeneralId, GeneralInfo>> = {
  captain: {
    name: 'The Captain',
    faction: null,
    motto: 'Hold the line. A balanced General for learning the game.',
    writes: 'Literally, exactly as written',
    troopSkill: null,
    doctrine: 'Default troop behaviors',
    ultimate: { id: 'rally', name: 'Rally', text: 'All troops heal 20% and attack 30% faster for 5 s', needs: null },
    twist: null,
  },
  warlord: {
    name: 'The Warlord',
    faction: 'Bloodbound',
    motto: 'Victory is paid in blood. Health is a resource.',
    writes: 'Aggressively: retreats get a counter-attack',
    troopSkill: {
      name: 'Vampiric Link',
      text: `A healthy troop pays ${percent(TROOP_SKILLS.vampiricLink.hpCostShare)} of its HP to make a fighting ally attack ${1 + TROOP_SKILLS.vampiricLink.attackSpeedBonus}x as fast for ${TROOP_SKILLS.vampiricLink.durationSeconds} s`,
    },
    doctrine: 'Vanguards attack the strongest enemy; Assassins dive at once, from any distance',
    ultimate: { id: 'reapersToll', name: "Reaper's Toll", text: `Your troops below ${percent(ULTIMATE_RULES.reapersToll.hpShareBelow)} HP become invulnerable wraiths for ${ULTIMATE_RULES.reapersToll.wraithSeconds} s, hitting ${percent(ULTIMATE_RULES.reapersToll.wraithDamageBonus)} harder, then fall`,
      needs: `a troop below ${percent(ULTIMATE_RULES.reapersToll.hpShareBelow)} HP`,
    },
    twist: { name: 'Blood Price', text: `Short on pips? Your healthiest troop pays the rest, ${percent(MANA_TWISTS.bloodPrice.hpSharePerPip)} HP per pip` },
  },
  engineer: {
    name: 'The Engineer',
    faction: 'Forgeborn',
    motto: 'Win before the fight starts. Build up, then strike.',
    writes: 'Carefully: a Hold before every Move',
    troopSkill: { name: 'Venting', text: `Every ${TROOP_SKILLS.venting.everyAttacks}th attack a troop overheats: burn damage around it, and a little to itself` },
    doctrine: `For the first ${DOCTRINES.engineer.holdSeconds} s, Vanguards hold their ground and Rangers stay behind them`,
    ultimate: { id: 'thermalDetonation', name: 'Thermal Detonation', text: 'Takes all heat from your troops to heal them, and fires it as a laser through the enemy', needs: null },
    twist: { name: 'Build-Up', text: `Max pips +1 every ${MANA_TWISTS.buildUp.everySeconds} s of battle, up to +${MANA_TWISTS.buildUp.maxExtraPips}` },
  },
  hiveMother: {
    name: 'The Hive Mother',
    faction: 'Hive',
    motto: 'Adapt or be eaten. Swarm and mutate.',
    writes: 'On instinct: 2 steps at most, simple targets',
    troopSkill: {
      name: 'Assimilation',
      text: `A troop that kills grows a shell (from a Vanguard or Guardian) or claws (from the rest) for ${TROOP_SKILLS.assimilation.durationSeconds} s`,
    },
    doctrine: 'Troops hunt as a pack: everyone goes for the same enemy until it falls',
    ultimate: { id: 'forcedEvolution', name: 'Forced Evolution', text: `Your two most hurt troops merge into one elite: their HP together, ${percent(ULTIMATE_RULES.forcedEvolution.damageBonus)} more damage`,
      needs: '2 troops',
    },
    twist: { name: 'Feeding', text: `Pips refill at ${percent(MANA_TWISTS.feeding.refillRate)} speed, but every enemy killed gives ${MANA_TWISTS.feeding.pipsPerKill} pip` },
  },
  strategist: {
    name: 'The Strategist',
    faction: 'Voidweavers',
    motto: 'Position is power. Control the battlefield.',
    writes: 'Precisely: suggests a condition you can accept',
    troopSkill: { name: 'Phase Shift', text: 'Once per battle, a troop about to fall teleports behind its attacker and stuns it' },
    doctrine: 'Vanguards guard the nearest ally; Rangers keep their distance between shots',
    ultimate: { id: 'gravityWell', name: 'Gravity Well', text: 'Drags every troop near the enemy army, friend and foe, to one point', needs: null },
    twist: { name: 'Prepared', text: `Starts with full pips, but they refill ${percent(1 - MANA_TWISTS.prepared.refillRate)} slower` },
  },
  conductor: {
    name: 'The Conductor',
    faction: 'Resonance',
    motto: 'Everything echoes. Chain and stack.',
    writes: 'As a perfectionist: reorders steps into combos',
    troopSkill: {
      name: 'Echo Strike',
      text: `Hits stack Vibration; at ${TROOP_SKILLS.echoStrike.maxStacks} stacks the enemy shatters and loses ${percent(TROOP_SKILLS.echoStrike.shatterArmorLoss)} armor for ${TROOP_SKILLS.echoStrike.shatterSeconds} s`,
    },
    doctrine: 'Troops spread their attacks to stack Vibration on as many enemies as they can',
    ultimate: { id: 'shatterstorm', name: 'Shatterstorm', text: 'Every Vibration stack explodes at once, hurting enemies around it too', needs: 'Vibration on an enemy' },
    twist: { name: 'Rhythm', text: `Perfect timing gives ${MANA_TWISTS.rhythm.perfectPipRefund} pips back, and cards glow longer` },
  },
};
