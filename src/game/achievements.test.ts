import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../data/achievements';
import { CODEX_ENTRY_IDS, SIGNATURE_COMBOS } from '../data/combos';
import { GENERAL_IDS } from '../data/generals';
import { MASTERY, type MasteryId } from '../data/mastery';
import { RANK_XP } from '../data/progression';
import achievementsPage from '../../docs/store/steam/achievements.md?raw';
import epicAchievementsPage from '../../docs/store/epic/achievements.md?raw';
import { AchievementReporter, earnedAchievements, type Progress } from './achievements';

const fresh: Progress = { xp: 0, bossesBeaten: [], codex: [], mastery: [] };
const allMastery = GENERAL_IDS.flatMap((g) => MASTERY[g].map((_, i) => `${g}.${i}` as MasteryId));

describe('the achievements list', () => {
  it('has unique store names a store accepts, and a name and a line for each', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toMatch(/^[A-Z0-9_]{1,64}$/);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.text).toMatch(/\.$/);
    }
  });

  it('covers ranks, every ruler, combos and mastery', () => {
    const kinds = new Set(ACHIEVEMENTS.map((a) => a.goal.kind));
    for (const kind of ['rank', 'boss', 'allBosses', 'signatureCombos', 'codexEntry', 'fullCodex', 'masteryTitles', 'allMastery'] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
    const bosses = ACHIEVEMENTS.flatMap((a) => (a.goal.kind === 'boss' ? [a.goal.boss] : []));
    expect(bosses.sort()).toEqual(GENERAL_IDS.filter((g) => g !== 'captain').sort());
  });
});

describe('earning achievements from your save', () => {
  it('earns none on a fresh save, and all of them with everything done', () => {
    expect(earnedAchievements(fresh)).toEqual([]);
    const everything: Progress = { xp: RANK_XP[5], bossesBeaten: [...GENERAL_IDS], codex: [...CODEX_ENTRY_IDS], mastery: allMastery };
    expect(earnedAchievements(everything)).toEqual(ACHIEVEMENTS.map((a) => a.id));
  });

  it('earns ranks from Command XP, and rulers one by one', () => {
    expect(earnedAchievements({ ...fresh, xp: RANK_XP[3] })).toEqual(['RANK_2', 'RANK_3']);
    expect(earnedAchievements({ ...fresh, bossesBeaten: ['warlord'] })).toEqual(['BOSS_WARLORD']);
    expect(earnedAchievements({ ...fresh, bossesBeaten: ['hiveMother', 'strategist', 'warlord', 'engineer', 'conductor'] })).toContain('ALL_RULERS');
  });

  it('reads the Combo Codex: a first signature combo, the Finisher, and every entry', () => {
    expect(earnedAchievements({ ...fresh, codex: [SIGNATURE_COMBOS[0]!.id] })).toEqual(['COMBO_FIRST']);
    expect(earnedAchievements({ ...fresh, codex: ['finisher'] })).toEqual(['FINISHER']);
    const allButOne = CODEX_ENTRY_IDS.slice(0, -1);
    expect(earnedAchievements({ ...fresh, codex: allButOne })).not.toContain('CODEX_FULL');
  });

  it('reads Mastery: a first title, then all three of one General', () => {
    expect(earnedAchievements({ ...fresh, mastery: ['warlord.0'] })).toEqual(['MASTERY_FIRST']);
    expect(earnedAchievements({ ...fresh, mastery: ['warlord.0', 'warlord.1', 'captain.2'] })).toEqual(['MASTERY_FIRST']);
    expect(earnedAchievements({ ...fresh, mastery: ['warlord.0', 'warlord.1', 'warlord.2'] })).toEqual(['MASTERY_FIRST', 'MASTERY_GENERAL']);
  });
});

describe('reporting achievements to the store', () => {
  it('tells the store about each one once, as it is earned', () => {
    const unlocked: string[] = [];
    const reporter = new AchievementReporter((id) => unlocked.push(id));
    expect(reporter.report({ ...fresh, xp: RANK_XP[2] })).toEqual(['RANK_2']);
    expect(reporter.report({ ...fresh, xp: RANK_XP[2] })).toEqual([]);
    reporter.report({ ...fresh, xp: RANK_XP[2], bossesBeaten: ['hiveMother'] });
    expect(unlocked).toEqual(['RANK_2', 'BOSS_HIVE_MOTHER']);
  });
});

describe('the achievements pages for the stores', () => {
  // Lines end in \r\n where git checks files out that way (Windows).
  const tableRows = (page: string) => page.split(/\r?\n/).filter((line) => line.startsWith('| `'));

  it('lists every achievement for Steam with its store name, name and text, and nothing else', () => {
    expect(tableRows(achievementsPage)).toEqual(ACHIEVEMENTS.map((a) => `| \`${a.id}\` | ${a.name} | ${a.text} |`));
  });

  it('lists the same for Epic, with XP that follows Epic’s rules: 5 to 200 each, 1,000 in all', () => {
    const rows = tableRows(epicAchievementsPage).map((line) => line.split(' | '));
    expect(rows.map(([id, name, text]) => `${id} | ${name} | ${text}`)).toEqual(ACHIEVEMENTS.map((a) => `| \`${a.id}\` | ${a.name} | ${a.text}`));
    let total = 0;
    for (const row of rows) {
      const xp = Number(row[3]);
      const tier = row[4]!.replace(/\s*\|$/, '');
      expect(Number.isInteger(xp) && xp >= 5 && xp <= 200 && xp % 5 === 0, row[0]).toBe(true);
      expect(tier, row[0]).toBe(xp < 50 ? 'Bronze' : xp < 100 ? 'Silver' : 'Gold');
      total += xp;
    }
    expect(total).toBe(1000);
  });
});
