import { describe, expect, it } from 'vitest';
import type { TroopPlacement } from '../data/armies';
import { BOONS } from '../data/boons';
import { COMMAND_RULES } from '../data/command';
import { RARITY_RULES } from '../data/rarity';
import { UNIT_CLASSES } from '../data/units';
import { createBattle, runBattle, stepBattle } from './battle';
import { spawnReserve } from './spawn';
import { openMap, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleSetup } from './types';

const ENEMY: TroopPlacement[] = [{ cls: 'vanguard', x: 900, y: 300 }];

function battle(player: TroopPlacement[], extra: Partial<BattleSetup> = {}) {
  return createBattle({ seed: 3, map: openMap(), player, enemy: ENEMY, rank: 1, ...extra });
}

describe('run fighters in battle', () => {
  it('a rarer troop has more HP and damage', () => {
    const state = battle([
      { cls: 'vanguard', x: 100, y: 100 },
      { cls: 'vanguard', x: 100, y: 300, rarity: 'rare' },
      { cls: 'vanguard', x: 100, y: 500, rarity: 'legendary' },
    ]);
    const [common, rare, legendary] = sideUnits(state, 'player');
    const base = UNIT_CLASSES.vanguard.stats;
    expect(common!.stats.maxHp).toBe(base.maxHp);
    expect(rare!.stats.maxHp).toBe(Math.round(base.maxHp * (1 + RARITY_RULES.rare.statBonus)));
    expect(rare!.stats.damage).toBeCloseTo(base.damage * (1 + RARITY_RULES.rare.statBonus));
    expect(legendary!.stats.damage).toBeCloseTo(base.damage * (1 + RARITY_RULES.legendary.statBonus));
    expect(rare!.rarity).toBe('rare');
  });

  it('a wounded fighter starts hurt, keeps its fighter id, and brings only the HP it has', () => {
    const state = battle([
      { cls: 'ranger', x: 100, y: 100, hp: 0.5, fighterId: 7 },
      { cls: 'ranger', x: 100, y: 300, hp: 0 },
    ]);
    const [hurt, barely] = sideUnits(state, 'player');
    const max = UNIT_CLASSES.ranger.stats.maxHp;
    expect(hurt!.hp).toBe(Math.round(max / 2));
    expect(hurt!.fighterId).toBe(7);
    // Never less than 1 HP: a fighter on the field is never already down.
    expect(barely!.hp).toBe(1);
    expect(barely!.fighterId).toBeNull();
    expect(state.startHp.player).toBe(hurt!.hp + 1);
  });

  it('a reserve fighter keeps its rarity, wounds and id when it is called in', () => {
    const state = battle([{ cls: 'vanguard', x: 100, y: 300 }], {
      reserves: { player: ['guardian', { cls: 'ranger', rarity: 'epic', hp: 0.4, fighterId: 3 }], enemy: [] },
    });
    const before = state.startHp.player;
    const called = spawnReserve(state, 'player', 'ranger')!;
    expect(called).toMatchObject({ cls: 'ranger', rarity: 'epic', fighterId: 3 });
    expect(called.hp).toBe(Math.round(called.stats.maxHp * 0.4));
    expect(state.startHp.player).toBe(before + called.hp);
    expect(state.reserves.player).toEqual([{ cls: 'guardian' }]);
  });
});

describe('boons in battle', () => {
  it('troop boons raise the stats of their class, or of every troop, on their side only', () => {
    const state = battle(
      [
        { cls: 'vanguard', x: 100, y: 200 },
        { cls: 'ranger', x: 100, y: 400 },
      ],
      { boons: { player: ['whetstones', 'fieldRations', 'quickMarch'] } },
    );
    const [vanguard, ranger] = sideUnits(state, 'player');
    const [enemy] = sideUnits(state, 'enemy');
    const v = UNIT_CLASSES.vanguard.stats;
    const r = UNIT_CLASSES.ranger.stats;
    expect(vanguard!.stats.damage).toBeCloseTo(v.damage * 1.15);
    expect(ranger!.stats.damage).toBeCloseTo(r.damage);
    expect(ranger!.stats.maxHp).toBe(Math.round(r.maxHp * 1.08));
    expect(ranger!.stats.moveSpeed).toBeCloseTo(r.moveSpeed * 1.1);
    expect(enemy!.stats).toEqual(UNIT_CLASSES.vanguard.stats);
  });

  it('a rarity and a boon for the same stat add up', () => {
    const state = battle([{ cls: 'vanguard', x: 100, y: 300, rarity: 'rare' }], { boons: { player: ['veteranCore'] } });
    const [vanguard] = sideUnits(state, 'player');
    expect(vanguard!.stats.damage).toBeCloseTo(UNIT_CLASSES.vanguard.stats.damage * (1 + RARITY_RULES.rare.statBonus + 0.12));
  });

  it('Command boons: more pips and Momentum at the start, and pips that refill faster', () => {
    const plain = battle([{ cls: 'vanguard', x: 100, y: 300 }]);
    const boosted = battle([{ cls: 'vanguard', x: 100, y: 300 }], { boons: { player: ['headStart', 'warDrums', 'supplyLines'] } });
    expect(boosted.command.pips).toBe(plain.command.pips + 1);
    expect(boosted.command.momentum).toBe(30);
    expect(plain.command.momentum).toBe(0);
    // With 25% faster refills a pip comes in 4/5 of the time. Spend the pips first so none is wasted.
    for (const s of [plain, boosted]) s.command.pips = 0;
    const firstPip = (s: typeof plain) => {
      while (s.command.pips === 0) stepBattle(s);
      return s.tick;
    };
    const interval = secondsToTicks(COMMAND_RULES.pipRefillSeconds);
    expect(firstPip(plain)).toBeGreaterThanOrEqual(interval);
    expect(firstPip(boosted)).toBeLessThanOrEqual(Math.ceil(interval / 1.25) + 1);
  });

  it('every boon in the data is one the battle can read', () => {
    for (const [id, boon] of Object.entries(BOONS)) {
      expect(boon.effects.length, id).toBeGreaterThan(0);
      expect(() => battle([{ cls: 'vanguard', x: 100, y: 300 }], { boons: { player: [id as keyof typeof BOONS] } }), id).not.toThrow();
    }
  });

  it('replays exactly with fighters and boons', () => {
    const setup: BattleSetup = {
      seed: 11,
      map: openMap(),
      player: [
        { cls: 'vanguard', x: 300, y: 250, rarity: 'epic', hp: 0.6 },
        { cls: 'ranger', x: 150, y: 300, rarity: 'rare' },
      ],
      enemy: [
        { cls: 'vanguard', x: 700, y: 300, rarity: 'rare' },
        { cls: 'ranger', x: 850, y: 250 },
      ],
      reserves: { player: [{ cls: 'guardian', hp: 0.5 }], enemy: ['vanguard'] },
      boons: { player: ['veteranCore', 'warDrums'], enemy: ['fletching'] },
    };
    const a = runBattle(setup, []);
    const b = runBattle(setup, []);
    expect(a.result).not.toBeNull();
    expect(b.events).toEqual(a.events);
    expect(b.result).toEqual(a.result);
  });
});
