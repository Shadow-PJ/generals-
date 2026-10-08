// Which achievements your save has earned (session 7A), and telling the store about them. The
// session reports after every change to your profile, and once as the game starts, so
// achievements earned before the game ran in a store still unlock there.

import { ACHIEVEMENTS, type AchievementGoal } from '../data/achievements';
import { SIGNATURE_COMBOS, CODEX_ENTRY_IDS, type CodexEntryId } from '../data/combos';
import { GENERAL_IDS, type GeneralId } from '../data/generals';
import { MASTERY, type MasteryId } from '../data/mastery';
import { SYNERGIES } from '../data/synergies';
import { rankForXp } from './progress';

/** What achievements are earned from: the parts of your profile they read. */
export interface Progress {
  xp: number;
  bossesBeaten: readonly GeneralId[];
  codex: readonly CodexEntryId[];
  mastery: readonly MasteryId[];
}

const RULERS = GENERAL_IDS.filter((id) => id !== 'captain');

/** Each General's Mastery challenges, as the ids your profile records. */
function masteryIds(general: GeneralId): MasteryId[] {
  return MASTERY[general].map((_, i) => `${general}.${i}` as MasteryId);
}

export function goalMet(goal: AchievementGoal, progress: Progress): boolean {
  const has = <T>(list: readonly T[], item: T) => list.includes(item);
  switch (goal.kind) {
    case 'rank':
      return rankForXp(progress.xp) >= goal.rank;
    case 'boss':
      return has(progress.bossesBeaten, goal.boss);
    case 'allBosses':
      return RULERS.every((ruler) => has(progress.bossesBeaten, ruler));
    case 'signatureCombos':
      return SIGNATURE_COMBOS.filter((combo) => has(progress.codex, combo.id)).length >= goal.count;
    case 'allSignatureCombos':
      return SIGNATURE_COMBOS.every((combo) => has(progress.codex, combo.id));
    case 'codexEntry':
      return has(progress.codex, goal.entry);
    case 'allSynergies':
      return SYNERGIES.every((synergy) => has(progress.codex, synergy.id));
    case 'fullCodex':
      return CODEX_ENTRY_IDS.every((entry) => has(progress.codex, entry));
    case 'masteryTitles':
      return new Set(progress.mastery).size >= goal.count;
    case 'masteredGeneral':
      return GENERAL_IDS.some((general) => masteryIds(general).every((id) => has(progress.mastery, id)));
    case 'allMastery':
      return GENERAL_IDS.every((general) => masteryIds(general).every((id) => has(progress.mastery, id)));
  }
}

/** The ids of every achievement the progress has earned, in the list's order. */
export function earnedAchievements(progress: Progress): string[] {
  return ACHIEVEMENTS.filter((a) => goalMet(a.goal, progress)).map((a) => a.id);
}

/** Tells the store about each earned achievement once a session (the store remembers them for good). */
export class AchievementReporter {
  private readonly told = new Set<string>();

  constructor(private readonly unlock: (id: string) => void) {}

  /** Reports what is newly earned; returns those ids. */
  report(progress: Progress): string[] {
    const fresh = earnedAchievements(progress).filter((id) => !this.told.has(id));
    for (const id of fresh) {
      this.told.add(id);
      this.unlock(id);
    }
    return fresh;
  }
}
