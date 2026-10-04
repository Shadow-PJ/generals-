import { describe, expect, it } from 'vitest';
import type { TroopPlacement } from '../data/armies';
import { FACTIONS, FACTION_RULES } from '../data/factions';
import { rankRules } from '../data/ranks';
import { UNIT_CLASSES } from '../data/units';
import { createBattle, runBattle } from './battle';
import { dealDamage, performAttack } from './combat';
import { factionAttackFactor, factionCounts, lifestealOf } from './factions';
import { skillCooldownFor, skillCooldownTicks } from './skills';
import { effectiveArmor } from './status';
import { openMap, sideUnits } from './testing/fixtures';
import type { BattleSetup } from './types';

const row = (troops: Omit<TroopPlacement, 'x' | 'y'>[], x = 100): TroopPlacement[] => troops.map((t, i) => ({ ...t, x, y: 60 + i * 70 }));

function battle(player: TroopPlacement[], extra: Partial<BattleSetup> = {}) {
  return createBattle({ seed: 2, map: openMap(), player, enemy: [{ cls: 'guardian', x: 900, y: 300 }], rank: 1, ...extra });
}

describe('faction counts', () => {
  it('count troops, reserves and faction boons; Legion’s Standard adds to the faction you field most of', () => {
    expect(factionCounts([{ cls: 'vanguard', faction: 'hive' }, { cls: 'ranger', faction: 'hive' }, { cls: 'ranger', faction: null }, { cls: 'guardian' }], [])).toEqual({ hive: 2 });
    expect(factionCounts([{ cls: 'vanguard', faction: 'hive' }], ['hiveSpawn', 'bloodOath'])).toEqual({ hive: 2, bloodbound: 1 });
    // Ties go to the first faction in faction order.
    expect(factionCounts([{ cls: 'vanguard', faction: 'resonance' }, { cls: 'ranger', faction: 'forgeborn' }], ['legionStandard'])).toEqual({ forgeborn: 3, resonance: 1 });
    expect(factionCounts([{ cls: 'vanguard' }], ['legionStandard'])).toEqual({});
    const state = battle(row([{ cls: 'vanguard', faction: 'hive' }]), { reserves: { player: [{ cls: 'ranger', faction: 'hive' }], enemy: [] } });
    expect(state.factions.player).toEqual({ hive: 2 });
    expect(state.factions.enemy).toEqual({});
  });
});

describe('faction bonuses', () => {
  it('Bloodbound: from 2 fighters, they heal a share of the damage their attacks deal; others don’t', () => {
    const state = battle(row([{ cls: 'vanguard', faction: 'bloodbound', hp: 0.5 }, { cls: 'vanguard', faction: 'bloodbound' }, { cls: 'vanguard', hp: 0.5 }]));
    const [blood, , plain] = sideUnits(state, 'player');
    const [enemy] = sideUnits(state, 'enemy');
    expect(lifestealOf(state, blood!)).toBe(FACTIONS.bloodbound.values[0]);
    const before = blood!.hp;
    const hpBefore = enemy!.hp;
    dealDamage(state, blood!.id, enemy!, 100, 0, 'attack');
    const dealt = hpBefore - enemy!.hp;
    expect(blood!.hp).toBe(before + Math.round(dealt * FACTIONS.bloodbound.values[0]));
    const plainBefore = plain!.hp;
    dealDamage(state, plain!.id, enemy!, 100, 0, 'attack');
    expect(plain!.hp).toBe(plainBefore);
    // One Bloodbound alone switches nothing on.
    const alone = battle(row([{ cls: 'vanguard', faction: 'bloodbound' }]));
    expect(lifestealOf(alone, sideUnits(alone, 'player')[0]!)).toBe(0);
  });

  it('Forgeborn: each attack adds armor, up to the step’s cap', () => {
    const state = battle(row([{ cls: 'vanguard', faction: 'forgeborn' }, { cls: 'ranger', faction: 'forgeborn' }, { cls: 'guardian', faction: 'forgeborn' }, { cls: 'vanguard', faction: 'forgeborn' }]));
    const [forge] = sideUnits(state, 'player');
    const [enemy] = sideUnits(state, 'enemy');
    const base = effectiveArmor(forge!);
    performAttack(state, forge!, enemy!);
    expect(effectiveArmor(forge!)).toBeCloseTo(base + FACTION_RULES.forgeArmorPerAttack);
    for (let i = 0; i < 30; i++) performAttack(state, forge!, enemy!);
    // Four Forgeborn: the second step's cap.
    expect(forge!.forgeArmor).toBeCloseTo(FACTIONS.forgeborn.values[1]);
  });

  it('Hive: each attack hits harder for every other Hive troop still standing', () => {
    const state = battle(row([{ cls: 'vanguard', faction: 'hive' }, { cls: 'ranger', faction: 'hive' }, { cls: 'ranger', faction: 'hive' }, { cls: 'guardian', faction: 'hive' }, { cls: 'vanguard' }]));
    const [first, second] = sideUnits(state, 'player');
    expect(factionAttackFactor(state, first!)).toBeCloseTo(1 + FACTIONS.hive.values[1] * 3);
    second!.alive = false;
    expect(factionAttackFactor(state, first!)).toBeCloseTo(1 + FACTIONS.hive.values[1] * 2);
  });

  it('Resonance: every 3rd attack resonates for more damage', () => {
    const state = battle(row([{ cls: 'ranger', faction: 'resonance' }, { cls: 'ranger', faction: 'resonance' }]));
    const [ranger] = sideUnits(state, 'player');
    const factors = [1, 2, 3, 4, 5, 6].map(() => factionAttackFactor(state, ranger!));
    const boost = 1 + FACTIONS.resonance.values[0];
    expect(factors).toEqual([1, 1, boost, 1, 1, boost]);
  });

  it('Voidweavers: every few hits from attacks, the troop phases out and takes no damage', () => {
    const state = battle(row([{ cls: 'guardian', faction: 'voidweavers' }, { cls: 'guardian', faction: 'voidweavers' }]));
    const [weaver] = sideUnits(state, 'player');
    const [enemy] = sideUnits(state, 'enemy');
    const every = FACTIONS.voidweavers.values[0];
    const losses: number[] = [];
    for (let i = 0; i < every * 2; i++) {
      const before = weaver!.hp;
      dealDamage(state, enemy!.id, weaver!, 20, 0, 'attack');
      losses.push(before - weaver!.hp);
    }
    expect(losses.map((l) => l === 0)).toEqual(Array.from({ length: every * 2 }, (_, i) => (i + 1) % every === 0));
    expect(state.events.filter((e) => e.type === 'phased')).toHaveLength(2);
    // Area damage isn't an attack: it always lands.
    const before = weaver!.hp;
    dealDamage(state, enemy!.id, weaver!, 20, 0, 'rift');
    expect(weaver!.hp).toBeLessThan(before);
  });
});

describe('perks', () => {
  it('make one troop better at one thing', () => {
    const state = battle(row([{ cls: 'vanguard', perks: ['tough', 'hardened'] }, { cls: 'ranger', perks: ['keenEyed', 'leech'] }, { cls: 'invoker', perks: ['drilled'] }, { cls: 'assassin', perks: ['swift', 'quick', 'fierce'] }]));
    const [vanguard, ranger, invoker, assassin] = sideUnits(state, 'player');
    expect(vanguard!.stats.maxHp).toBe(Math.round(UNIT_CLASSES.vanguard.stats.maxHp * 1.15));
    expect(vanguard!.stats.armor).toBeCloseTo(UNIT_CLASSES.vanguard.stats.armor + 0.06);
    expect(ranger!.stats.range).toBeCloseTo(UNIT_CLASSES.ranger.stats.range * 1.12);
    expect(ranger!.lifesteal).toBe(0.1);
    expect(skillCooldownFor(invoker!)).toBe(Math.round(skillCooldownTicks('invoker') * 0.75));
    expect(assassin!.stats.moveSpeed).toBeCloseTo(UNIT_CLASSES.assassin.stats.moveSpeed * 1.2);
    expect(assassin!.stats.attacksPerSecond).toBeCloseTo(UNIT_CLASSES.assassin.stats.attacksPerSecond * 1.12);
    expect(assassin!.stats.damage).toBeCloseTo(UNIT_CLASSES.assassin.stats.damage * 1.12);
  });
});

describe('boons from session 5C', () => {
  it('skill boons bring a class’s skill (or every troop’s) back sooner, never more than twice as fast', () => {
    const state = battle(row([{ cls: 'vanguard' }, { cls: 'ranger', perks: ['drilled'] }]), { boons: { player: ['shoveDrills', 'battleHymn'] } });
    const [vanguard, ranger] = sideUnits(state, 'player');
    expect(vanguard!.skillHaste).toBeCloseTo(0.45);
    expect(ranger!.skillHaste).toBeCloseTo(0.45);
    const capped = battle(row([{ cls: 'vanguard', perks: ['drilled'] }]), { boons: { player: ['shoveDrills', 'battleHymn'] } });
    expect(sideUnits(capped, 'player')[0]!.skillHaste).toBe(0.5);
  });

  it('Bloodthirst lets every troop heal from its attacks', () => {
    const state = battle(row([{ cls: 'vanguard', hp: 0.5 }]), { boons: { player: ['bloodthirst'] } });
    const [vanguard] = sideUnits(state, 'player');
    const [enemy] = sideUnits(state, 'enemy');
    const before = vanguard!.hp;
    const enemyBefore = enemy!.hp;
    dealDamage(state, vanguard!.id, enemy!, 100, 0, 'attack');
    expect(vanguard!.hp).toBe(before + Math.round((enemyBefore - enemy!.hp) * 0.08));
  });

  it('Quartermaster and Endless Supply raise the most pips you can hold', () => {
    const plain = battle(row([{ cls: 'vanguard' }]));
    const more = battle(row([{ cls: 'vanguard' }]), { boons: { player: ['quartermaster', 'endlessSupply'] } });
    expect(plain.command.maxPips).toBe(rankRules(1).maxPips);
    expect(more.command.maxPips).toBe(rankRules(1).maxPips + 2);
    expect(more.command.pipRateBonus).toBeCloseTo(0.2);
    const strategist = battle(row([{ cls: 'vanguard' }]), { general: 'strategist', boons: { player: ['quartermaster'] } });
    expect(strategist.command.pips).toBe(rankRules(1).maxPips + 1);
  });

  it('replays exactly with factions, perks and the new boons', () => {
    const setup: BattleSetup = {
      seed: 21,
      map: openMap(),
      player: row([
        { cls: 'vanguard', faction: 'bloodbound', perks: ['tough'] },
        { cls: 'ranger', faction: 'resonance', rarity: 'epic', perks: ['leech'] },
        { cls: 'guardian', faction: 'voidweavers' },
        { cls: 'assassin', faction: 'hive', perks: ['drilled', 'swift'] },
      ], 200),
      enemy: row([
        { cls: 'vanguard', faction: 'forgeborn' },
        { cls: 'ranger', faction: 'forgeborn' },
        { cls: 'invoker', faction: 'voidweavers' },
      ], 800),
      boons: { player: ['bloodOath', 'tuningFork', 'battleHymn', 'legionStandard'], enemy: ['voidSigil'] },
    };
    const a = runBattle(setup, []);
    const b = runBattle(setup, []);
    expect(a.result).not.toBeNull();
    expect(b.events).toEqual(a.events);
  });
});
