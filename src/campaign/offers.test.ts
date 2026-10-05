import { describe, expect, it } from 'vitest';
import { BOON_IDS, BOONS, boonFaction } from '../data/boons';
import { FACTION_IDS } from '../data/factions';
import { PERK_IDS } from '../data/perks';
import { RARITIES, RARITY_RULES, rarityChances, type Rarity } from '../data/rarity';
import { RUN_RULES } from '../data/runs';
import { createRng, factionCounts } from '../sim';
import { applyChoice } from './events';
import { duoChoices, offerRarity, rollFaction, rollFighter, rollOffers, rollPerks, rollStock, takeOffer } from './offers';
import { enterNode, finishFight } from './run';
import { runOf, runThrough } from './testing';
import type { RunState } from './types';

const base = () => runOf(runThrough(['battle', 'boss']));
const withFactions = (run: RunState, factions: (RunState['roster'][number]['faction'])[]): RunState => ({
  ...run,
  roster: run.roster.map((f, i) => ({ ...f, faction: factions[i] ?? null })),
});

describe('fighters on offer', () => {
  it('have a perk for each step of rarity: none Common, one Rare or Epic, two Legendary, all different', () => {
    const rng = createRng(4);
    for (const rarity of RARITIES) {
      for (let i = 0; i < 50; i++) {
        const perks = rollPerks(rng, rarity);
        expect(perks).toHaveLength(RARITY_RULES[rarity].perks);
        expect(new Set(perks).size).toBe(perks.length);
        expect(perks.every((p) => (PERK_IDS as readonly string[]).includes(p))).toBe(true);
      }
    }
    // Rising a rarity keeps the perks a fighter has and adds one if there is room.
    expect(rollPerks(rng, 'rare', [])).toHaveLength(1);
    const kept = rollPerks(rng, 'legendary', ['tough']);
    expect(kept[0]).toBe('tough');
    expect(kept).toHaveLength(2);
    expect(rollPerks(rng, 'epic', ['tough'])).toEqual(['tough']);
  });

  it('come in every faction, or none, and more often in the factions you already have', () => {
    const rng = createRng(6);
    const tally = (run: RunState) => {
      const counts: Record<string, number> = {};
      for (let i = 0; i < 6000; i++) {
        const f = rollFaction(rng, run) ?? 'none';
        counts[f] = (counts[f] ?? 0) + 1;
      }
      return counts;
    };
    const plain = tally(base());
    for (const f of [...FACTION_IDS, 'none']) expect(plain[f]).toBeGreaterThan(700);
    const hive = tally(withFactions(base(), ['hive', 'hive', 'hive', 'hive']));
    expect(hive.hive!).toBeGreaterThan(plain.hive! * 2);
    const fighter = rollFighter(createRng(1), base(), 'epic', [], 'guardian');
    expect(fighter).toMatchObject({ cls: 'guardian', rarity: 'epic' });
    expect(fighter.perks).toHaveLength(1);
  });

  it('keep their faction and perks when they join', () => {
    const run = takeOffer(base(), { kind: 'fighter', cls: 'invoker', rarity: 'legendary', faction: 'resonance', perks: ['leech', 'quick'] });
    expect(run.roster.at(-1)).toMatchObject({ cls: 'invoker', rarity: 'legendary', faction: 'resonance', perks: ['leech', 'quick'], hp: 1 });
  });
});

describe('boons on offer', () => {
  it('offer a faction boon only when your army has that faction, and Legion’s Standard only with some faction', () => {
    const rng = createRng(12);
    const seen = (run: RunState) => {
      const boons = new Set<string>();
      for (let i = 0; i < 400; i++) for (const o of rollOffers(rng, run, [])) if (o.kind === 'boon') boons.add(o.boon);
      return boons;
    };
    const factionBoons = BOON_IDS.filter((id) => boonFaction(id) !== null);
    const plain = seen(base());
    expect(factionBoons.some((id) => plain.has(id))).toBe(false);
    const forge = seen(withFactions(base(), ['forgeborn', 'forgeborn']));
    expect(forge.has('forgeBrand')).toBe(true);
    expect(forge.has('hiveSpawn')).toBe(false);
  });
});

describe('duo boons (session 5F)', () => {
  const duos = BOON_IDS.filter((id) => BOONS[id].duo);

  it('are one for each pair of factions, and each counts as a fighter of both', () => {
    expect(duos).toHaveLength(10);
    const pairs = new Set(duos.map((id) => [...BOONS[id].duo!].sort().join('+')));
    expect(pairs.size).toBe(10);
    for (const id of duos) {
      const [a, b] = BOONS[id].duo!;
      expect(factionCounts([], [id])).toEqual({ [a]: 1, [b]: 1 });
    }
  });

  it('open only once both factions’ bonuses are on in your army', () => {
    expect(duoChoices(base())).toEqual([]);
    expect(duoChoices(withFactions(base(), ['bloodbound', 'bloodbound', 'forgeborn']))).toEqual([]);
    expect(duoChoices(withFactions(base(), ['bloodbound', 'bloodbound', 'forgeborn', 'forgeborn']))).toEqual(['bloodForge']);
    // A faction boon counts too: two Bloodbound and one Forgeborn fighter plus a Forge Brand.
    const branded = { ...withFactions(base(), ['bloodbound', 'bloodbound', 'forgeborn']), boons: ['forgeBrand' as const] };
    expect(duoChoices(branded)).toEqual(['bloodForge']);
    // Not one you have already.
    expect(duoChoices({ ...branded, boons: ['forgeBrand', 'bloodForge'] })).toEqual([]);
  });

  it('turn up in the spoils once open, never otherwise, and never at the merchant', () => {
    const rng = createRng(21);
    const seen = (run: RunState) => {
      const boons = new Set<string>();
      for (let i = 0; i < 300; i++) for (const o of rollOffers(rng, run, [])) if (o.kind === 'boon') boons.add(o.boon);
      return boons;
    };
    const plain = seen(base());
    expect(duos.some((id) => plain.has(id))).toBe(false);
    const mixed = withFactions(base(), ['hive', 'hive', 'resonance', 'resonance']);
    const offered = seen(mixed);
    expect(offered.has('hiveChorus')).toBe(true);
    expect(duos.filter((id) => offered.has(id))).toEqual(['hiveChorus']);
    for (let i = 0; i < 100; i++) {
      for (const item of rollStock(rng, mixed, [])) expect(item.offer.kind === 'boon' && BOONS[item.offer.boon].duo).toBeFalsy();
    }
  });
});

describe('rarity chances', () => {
  it('shift toward the rare ones deeper in a run, and more after an elite fight', () => {
    const sum = (c: Record<Rarity, number>) => RARITIES.reduce((s, r) => s + c[r], 0);
    const first = rarityChances(0);
    const deep = rarityChances(5);
    const elite = rarityChances(5, true);
    expect(first).toEqual({ common: 60, rare: 28, epic: 10, legendary: 2 });
    for (const c of [deep, elite]) expect(sum(c)).toBeCloseTo(100);
    expect(deep.common).toBeLessThan(first.common);
    expect(elite.common).toBeLessThan(deep.common);
    for (const r of ['rare', 'epic', 'legendary'] as const) {
      expect(deep[r]).toBeGreaterThan(first[r]);
      expect(elite[r]).toBeGreaterThan(deep[r]);
    }
  });

  it('make an elite fight’s spoils rarer than a battle’s', () => {
    const rank = (r: Rarity) => RARITIES.indexOf(r);
    const average = (kind: 'battle' | 'elite') => {
      let total = 0;
      let n = 0;
      for (let seed = 1; seed <= 150; seed++) {
        const c = finishFight(enterNode(runThrough([kind, 'boss'], { seed }), 0), { won: true, fighters: [], xp: 0 });
        const stop = runOf(c).stop;
        if (stop?.kind !== 'spoils') throw new Error('expected spoils');
        for (const o of stop.offers) {
          total += rank(offerRarity(o));
          n++;
        }
      }
      return total / n;
    };
    expect(average('elite')).toBeGreaterThan(average('battle') + 0.2);
  });
});

describe('Plunder and upgrades', () => {
  it('Plunder adds gold to every won fight', () => {
    const plain = finishFight(enterNode(runThrough(['battle', 'boss'], { seed: 3 }), 0), { won: true, fighters: [], xp: 0 });
    const start = runThrough(['battle', 'boss'], { seed: 3 });
    const plundering = { ...start, run: { ...runOf(start), boons: ['plunder' as const] } };
    const rich = finishFight(enterNode(plundering, 0), { won: true, fighters: [], xp: 0 });
    expect(runOf(rich).gold).toBe(runOf(plain).gold + 10);
    expect(RUN_RULES.gold.battle).toBeGreaterThan(0);
  });

  it('a fighter who rises from Common to Rare gains a perk', () => {
    const run = { ...base(), roster: base().roster.slice(0, 1) };
    const done = applyChoice(createRng(2), run, { label: 'Pray', text: '', effects: [{ kind: 'upgrade' }] }, [], []);
    expect(done.run.roster[0]).toMatchObject({ rarity: 'rare' });
    expect(done.run.roster[0]!.perks).toHaveLength(1);
    expect(done.outcome[0]).toMatch(/rises to Rare and becomes/);
  });
});
