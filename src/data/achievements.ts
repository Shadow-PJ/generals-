// The game's achievements (session 7A), for the stores that keep them. Each is earned from what
// your save already records, so none can be missed: your Command Rank, the rulers you have beaten,
// the Combo Codex and your Generals' Mastery titles. An achievement's id is its store name, so
// it never changes once the game is out; its name and text can.

import type { BossId } from './bosses';
import type { CodexEntryId } from './combos';
import { rankRules, type RankNumber } from './ranks';

export type AchievementGoal =
  /** Reach a Command Rank. */
  | { kind: 'rank'; rank: RankNumber }
  /** Beat one ruler, or all five. */
  | { kind: 'boss'; boss: BossId }
  | { kind: 'allBosses' }
  /** Land this many different signature combos, or every one. */
  | { kind: 'signatureCombos'; count: number }
  | { kind: 'allSignatureCombos' }
  /** One entry of the Combo Codex, such as the Finisher. */
  | { kind: 'codexEntry'; entry: CodexEntryId }
  /** Switch on every troop synergy, and fill the whole Codex. */
  | { kind: 'allSynergies' }
  | { kind: 'fullCodex' }
  /** Earn this many Mastery titles; all three of one General's; every one. */
  | { kind: 'masteryTitles'; count: number }
  | { kind: 'masteredGeneral' }
  | { kind: 'allMastery' };

export interface Achievement {
  /** The store's name for it: capitals, digits and underscores. */
  id: string;
  name: string;
  /** How to earn it, as the store shows it. */
  text: string;
  goal: AchievementGoal;
}

function rank(rankNumber: RankNumber): Achievement {
  const rules = rankRules(rankNumber);
  return { id: `RANK_${rankNumber}`, name: rules.name, text: `Reach Command Rank ${rules.numeral}.`, goal: { kind: 'rank', rank: rankNumber } };
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Ranks, earned with Command XP in the campaign.
  rank(2),
  rank(3),
  rank(4),
  rank(5),
  // The five rulers, in the order their regions open.
  { id: 'BOSS_HIVE_MOTHER', name: 'Swarm Breaker', text: 'Beat the Hive Mother, ruler of Deep Forest.', goal: { kind: 'boss', boss: 'hiveMother' } },
  { id: 'BOSS_STRATEGIST', name: 'Outthought', text: 'Beat the Strategist, ruler of Void Ruins.', goal: { kind: 'boss', boss: 'strategist' } },
  { id: 'BOSS_WARLORD', name: 'Blood Spent', text: 'Beat the Warlord, ruler of Red Canyon.', goal: { kind: 'boss', boss: 'warlord' } },
  { id: 'BOSS_ENGINEER', name: 'Walls Come Down', text: 'Beat the Engineer, ruler of Iron Fortress.', goal: { kind: 'boss', boss: 'engineer' } },
  { id: 'BOSS_CONDUCTOR', name: 'Silence', text: 'Beat the Conductor, ruler of Glass Plains.', goal: { kind: 'boss', boss: 'conductor' } },
  { id: 'ALL_RULERS', name: 'Master of the Realm', text: 'Beat all five rulers.', goal: { kind: 'allBosses' } },
  // The Combo Codex.
  { id: 'COMBO_FIRST', name: 'Chain Reaction', text: 'Land a signature combo.', goal: { kind: 'signatureCombos', count: 1 } },
  { id: 'COMBO_ALL', name: 'Combo Scholar', text: 'Land every signature combo.', goal: { kind: 'allSignatureCombos' } },
  { id: 'FINISHER', name: 'Finishing Blow', text: 'Fire your ultimate as the 3rd link of a chain: a Finisher.', goal: { kind: 'codexEntry', entry: 'finisher' } },
  { id: 'SYNERGY_ALL', name: 'In Harmony', text: 'Switch on every troop synergy.', goal: { kind: 'allSynergies' } },
  { id: 'CODEX_FULL', name: 'The Complete Codex', text: 'Fill every entry of the Combo Codex.', goal: { kind: 'fullCodex' } },
  // Mastery.
  { id: 'MASTERY_FIRST', name: 'Titled', text: 'Earn a Mastery title.', goal: { kind: 'masteryTitles', count: 1 } },
  { id: 'MASTERY_GENERAL', name: 'Gold Trim', text: 'Meet all three Mastery challenges of one General.', goal: { kind: 'masteredGeneral' } },
  { id: 'MASTERY_ALL', name: 'Grand Master', text: 'Meet every Mastery challenge of every General.', goal: { kind: 'allMastery' } },
];
