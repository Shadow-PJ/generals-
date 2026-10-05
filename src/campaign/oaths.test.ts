import { describe, expect, it } from 'vitest';
import { MAX_FEAR, OATH_IDS, OATH_RULES, OATHS, fearOf, maxRank, type OathRanks } from '../data/oaths';
import { RUN_RULES } from '../data/runs';
import { scoutText } from './describe';
import { fightTier, nodeEncounter } from './encounters';
import { fearBounty, oathGold, oathInsight, withOath } from './oaths';
import { closeRun, enterNode, finishFight, leaveStop, merchantPrices, newRun, pickSpoils } from './run';
import { nextChoices } from './runMap';
import { freshCampaign, runOf } from './testing';
import type { Campaign } from './types';
import type { NodeKind } from '../data/runs';

/** A run under these oaths on a straight path through these node kinds. */
function sworn(oaths: OathRanks, kinds: NodeKind[], seed = 5): Campaign {
  const campaign = newRun({ ...freshCampaign(), oaths }, 'deepForest', seed);
  const map = kinds.map((kind, f) => [{ kind, next: f + 1 < kinds.length ? [0] : [] }]);
  return { ...campaign, run: { ...campaign.run!, map } };
}

const won = (fighters: { id: number; hp: number | null }[] = [], insight = 3) => ({ won: true, fighters, xp: 50, insight });

describe('Oaths of Command', () => {
  it('sets an oath for the next run, within its ranks; rank 0 lifts it', () => {
    let c = withOath(freshCampaign(), 'veteranFoes', 2);
    expect(c.oaths).toEqual({ veteranFoes: 2 });
    c = withOath(c, 'veteranFoes', 9);
    expect(c.oaths.veteranFoes).toBe(maxRank('veteranFoes'));
    expect(withOath(c, 'veteranFoes', 0).oaths).toEqual({});
  });

  it('adds up Fear, rank by rank', () => {
    expect(fearOf({})).toBe(0);
    expect(fearOf({ veteranFoes: 2, eliteGuard: 1 })).toBe(2 * OATHS.veteranFoes.fearPerRank + OATHS.eliteGuard.fearPerRank);
    const all = Object.fromEntries(OATH_IDS.map((id) => [id, maxRank(id)])) as OathRanks;
    expect(fearOf(all)).toBe(MAX_FEAR);
    expect(MAX_FEAR).toBe(21);
  });

  it('a run keeps the oaths it began with', () => {
    const c = newRun({ ...freshCampaign(), oaths: { leanPurse: 1 } }, 'deepForest', 3);
    const changed = withOath(c, 'eliteGuard', 2);
    expect(runOf(changed).oaths).toEqual({ leanPurse: 1 });
  });

  it('makes enemy armies tougher: rarer troops, sharper commanders, a crueler ruler', () => {
    const plain = fightTier('battle', 5, 0, 'hiveMother');
    const sworn = fightTier('battle', 5, 0, 'hiveMother', { veteranFoes: 2, eliteGuard: 1, cunningCommanders: 1 });
    expect(sworn.rare).toBe(plain.rare + 2);
    expect(sworn.epic).toBe(plain.epic + 1);
    expect(sworn.commander).toBe(plain.commander! + 1);
    // A fight with no commander keeps none.
    expect(fightTier('battle', 0, 0, 'hiveMother', { cunningCommanders: 2 }).commander).toBeNull();
    const boss = fightTier('boss', 7, 0, 'warlord');
    const wrath = fightTier('boss', 7, 0, 'warlord', { tyrantsWrath: 1 });
    expect(wrath.epic).toBe(boss.epic + OATH_RULES.tyrantsWrath.epic[0]);
    expect(wrath.commander).toBe(boss.commander! + OATH_RULES.tyrantsWrath.commander[0]);
    // Only the boss feels Tyrant's Wrath.
    expect(fightTier('battle', 5, 0, 'warlord', { tyrantsWrath: 2 })).toEqual(fightTier('battle', 5, 0, 'warlord'));
  });

  it('the run map scouts the oath-hardened army', () => {
    const c = sworn({ veteranFoes: 3 }, ['battle', 'boss']);
    const scouted = nodeEncounter(runOf(c), 0, 0)!;
    const all = [...scouted.troops, ...scouted.reserves];
    expect(all.filter((t) => t.rarity === 'rare')).toHaveLength(Math.min(all.length, OATH_RULES.veteranFoes.rare[2]));
  });

  it('Lean Purse cuts the gold; No Quarter offers fewer picks', () => {
    const plain = runOf(finishFight(enterNode(sworn({}, ['battle', 'battle']), 0), won()));
    const lean = runOf(finishFight(enterNode(sworn({ leanPurse: 2, noQuarter: 1 }, ['battle', 'battle']), 0), won()));
    if (plain.stop?.kind !== 'spoils' || lean.stop?.kind !== 'spoils') throw new Error('No spoils');
    expect(lean.stop.gold).toBe(oathGold(plain.stop.gold, { leanPurse: 2 }));
    expect(lean.stop.gold).toBeLessThan(plain.stop.gold);
    expect(lean.stop.offers).toHaveLength(RUN_RULES.offers - 1);
    const skipped = runOf(pickSpoils(finishFight(enterNode(sworn({ leanPurse: 1 }, ['battle', 'battle']), 0), won()), null));
    expect(skipped.gold - lean.gold).toBeGreaterThanOrEqual(0);
  });

  it('Lasting Wounds: the fallen get back up weaker, and camps heal less', () => {
    const c = sworn({ lastingWounds: 1 }, ['battle', 'camp', 'battle']);
    const fallenId = runOf(c).field[0]!;
    const after = runOf(finishFight(enterNode(c, 0), won([{ id: fallenId, hp: null }])));
    expect(after.roster.find((f) => f.id === fallenId)!.hp).toBe(OATH_RULES.lastingWounds.fallenHp[0]);
    const camped = runOf(enterNode(pickSpoils(finishFight(enterNode(c, 0), won()), null), 0));
    if (camped.stop?.kind !== 'camp') throw new Error('No camp');
    expect(camped.stop.healed).toBe(RUN_RULES.campHeal * OATH_RULES.lastingWounds.campHealShare[0]);
  });

  it('Short Supply raises the merchant’s prices', () => {
    const plain = runOf(enterNode(sworn({}, ['merchant']), 0));
    const short = runOf(enterNode(sworn({ shortSupply: 1 }, ['merchant']), 0));
    expect(merchantPrices(short).heal).toBe(Math.round(merchantPrices(plain).heal * (1 + OATH_RULES.shortSupply.priceRise[0])));
    if (short.stop?.kind !== 'merchant' || plain.stop?.kind !== 'merchant') throw new Error('No merchant');
    expect(short.stop.stock[0]!.price).toBeGreaterThan(plain.stop.stock[0]!.price);
    expect(leaveStop({ ...freshCampaign(), run: short }).run!.stop).toBeNull();
  });

  it('Fear makes every battle earn more Insight', () => {
    expect(oathInsight(3, {})).toBe(3);
    expect(oathInsight(3, { eliteGuard: 2, cunningCommanders: 2 })).toBe(Math.round(3 * (1 + 8 * OATH_RULES.insightPerFear)));
    const c = finishFight(enterNode(sworn({ eliteGuard: 2, cunningCommanders: 2 }, ['battle', 'battle']), 0), won([], 3));
    expect(c.insight).toBe(oathInsight(3, { eliteGuard: 2, cunningCommanders: 2 }));
  });

  it('winning a region above its highest Fear yet pays a bounty, once per point', () => {
    expect(fearBounty({}, 'deepForest', 0)).toEqual({ bounty: 0, record: 0 });
    expect(fearBounty({}, 'deepForest', 4)).toEqual({ bounty: 4 * OATH_RULES.bountyPerFear, record: 4 });
    expect(fearBounty({ deepForest: 4 }, 'deepForest', 6)).toEqual({ bounty: 2 * OATH_RULES.bountyPerFear, record: 6 });
    expect(fearBounty({ deepForest: 6 }, 'deepForest', 3)).toEqual({ bounty: 0, record: 6 });
    // A won boss fight at Fear 3: the bounty is paid and the record kept.
    const c = finishFight(enterNode(sworn({ veteranFoes: 3 }, ['boss']), 0), won([], 0));
    const stop = runOf(c).stop;
    expect(stop).toMatchObject({ kind: 'end', won: true, fear: 3, bounty: 3 * OATH_RULES.bountyPerFear });
    expect(c.insight).toBe(3 * OATH_RULES.bountyPerFear);
    expect(closeRun(c).fearRecords).toEqual({ deepForest: 3 });
    // A lost run pays nothing and keeps no record.
    const lost = finishFight(enterNode(sworn({ veteranFoes: 3 }, ['boss']), 0), { won: false, fighters: [], xp: 0 });
    expect(runOf(lost).stop).toMatchObject({ kind: 'end', won: false, fear: 3, bounty: 0 });
    expect(closeRun(lost).fearRecords).toEqual({});
  });
});

describe('scouting', () => {
  it('fixes every fight when the map is made: the node shows the army you then meet', () => {
    const c = newRun(freshCampaign(), 'voidRuins', 11);
    const run = runOf(c);
    for (const index of nextChoices(run)) {
      const scouted = nodeEncounter(run, 0, index);
      expect(scouted).not.toBeNull();
      // The same every time it is looked at.
      expect(nodeEncounter(run, 0, index)).toEqual(scouted);
      const stop = runOf(enterNode(c, index)).stop;
      expect(stop).toEqual({ kind: 'fight', encounter: scouted });
    }
  });

  it('says what waits in a line: whose army, how many, how rare, and the commander', () => {
    const run = runOf(newRun(freshCampaign(), 'deepForest', 4));
    const first = nodeEncounter(run, 0, nextChoices(run)[0]!)!;
    expect(scoutText(first)).toMatch(/^The Hive Mother's army: \d troops/);
    expect(scoutText(first)).toMatch(/no commander/);
    const boss = nodeEncounter({ ...run, map: [[{ kind: 'boss', next: [] }]] }, 0, 0)!;
    expect(scoutText(boss)).toMatch(/and 3 in reserve, 3 Epic and 3 Rare  ·  commander Rank II$/);
  });

  it('scouts only fights, and different nodes hold different fights', () => {
    const c = newRun(freshCampaign(), 'deepForest', 4);
    const run = runOf(c);
    const fights = run.map.flatMap((floor, f) => floor.map((_, i) => nodeEncounter(run, f, i))).filter((e) => e !== null);
    const others = run.map.flatMap((floor, f) => floor.flatMap((n, i) => (['battle', 'elite', 'boss'].includes(n.kind) ? [] : [nodeEncounter(run, f, i)])));
    expect(others.every((e) => e === null)).toBe(true);
    expect(new Set(fights.map((e) => e!.seed)).size).toBe(fights.length);
  });
});
