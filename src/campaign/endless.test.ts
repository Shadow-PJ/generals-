import { describe, expect, it } from 'vitest';
import { ENDLESS_RULES } from '../data/endless';
import { BOSS_ORDER } from '../data/legendary';
import { REGIONS } from '../data/regions';
import { fightTier, nodeEncounter } from './encounters';
import { abandonRun, closeRun, endlessOpen, enterNode, finishFight, goHome, marchOn, toggleKeep } from './run';
import { runOf, runThrough } from './testing';
import type { Campaign } from './types';

const won = { won: true, fighters: [], xp: 50 };
const lost = (ids: number[] = []) => ({ won: false, fighters: ids.map((id) => ({ id, hp: null })), xp: 10 });
const ALL = [...BOSS_ORDER];

/** A run straight to its ruler, with these rulers beaten before it. */
function toRuler(bossesBeaten = ALL, ironman = false): Campaign {
  const c = runThrough(['battle', 'boss'], { bossesBeaten });
  return { ...c, run: { ...runOf(c), ironman } };
}

/** Clears the stop after a won battle (spoils or crossroads) the quickest way. */
function onward(c: Campaign): Campaign {
  const stop = runOf(c).stop;
  return stop?.kind === 'spoils' || stop?.kind === 'crossroads' ? { ...c, run: { ...runOf(c), stop: null } } : c;
}

/** Beats the ruler of a run standing at the start of its two-node path. */
const beatRuler = (c: Campaign): Campaign => finishFight(enterNode(onward(finishFight(enterNode(c, 0), won)), 0), won);

describe('endless (session 7G)', () => {
  it('opens only once every ruler has fallen, counting the run’s own', () => {
    const deepForest = REGIONS.deepForest.ruler;
    expect(endlessOpen(toRuler(ALL), runOf(toRuler(ALL)))).toBe(true);
    // The run's own ruler need not be beaten yet: beating it now is the last one.
    const others = ALL.filter((g) => g !== deepForest);
    expect(endlessOpen(toRuler(others), runOf(toRuler(others)))).toBe(true);
    const missing = ALL.filter((g) => g !== 'conductor' && g !== deepForest);
    expect(endlessOpen(toRuler(missing), runOf(toRuler(missing)))).toBe(false);
  });

  it('before then, beating the ruler ends the run as always', () => {
    expect(runOf(beatRuler(toRuler([]))).stop).toMatchObject({ kind: 'end', won: true, endless: null });
  });

  it('beating the ruler with every ruler fallen offers the road on; going home is the win it was', () => {
    const c = beatRuler(toRuler());
    expect(runOf(c).stop).toEqual({ kind: 'endless', lap: 0 });
    const home = goHome(c);
    expect(runOf(home).stop).toMatchObject({ kind: 'end', won: true, endless: null });
    expect(home.endlessBest).toBe(0);
  });

  it('marching on starts a fresh lap of the region, harder, with your army, gold and boons', () => {
    let c = onward(finishFight(enterNode(toRuler(), 0), won));
    c = finishFight(enterNode(c, 0), won);
    const before = runOf(c);
    c = marchOn(c);
    const run = runOf(c);
    expect(run.endless).toEqual({ lap: 1, score: 0 });
    expect(run.path).toEqual([]);
    expect(run.stop).toBeNull();
    expect(run.map.length).toBeGreaterThan(2);
    expect(run.roster).toEqual(before.roster);
    expect(run.gold).toBe(before.gold);
    expect(run.boons).toEqual(before.boons);
    // A lap's fights are its own: the same node on the same floor brings a different army.
    const plain = { ...run, endless: null };
    expect(nodeEncounter(run, 0, 0)).not.toEqual(nodeEncounter(plain, 0, 0));
  });

  it('every lap makes the armies rarer and their commanders sharper, with Legendary troops later on', () => {
    const ruler = REGIONS.deepForest.ruler as Parameters<typeof fightTier>[3];
    const base = fightTier('battle', 4, 0, ruler);
    const lap1 = fightTier('battle', 4, 0, ruler, {}, 1);
    expect(lap1.rare).toBe(base.rare + ENDLESS_RULES.perLap.rare);
    expect(lap1.epic).toBe(base.epic + ENDLESS_RULES.perLap.epic);
    expect(lap1.legendary).toBe(0);
    const deep = fightTier('battle', 4, 0, ruler, {}, ENDLESS_RULES.legendaryAfterLap + 2);
    expect(deep.legendary).toBe(2);
    if (base.commander !== null) expect(deep.commander).toBe(5);
  });

  it('scores the fights won past the ruler, more for beating it again; the best is kept', () => {
    let c = onward(finishFight(enterNode(toRuler(), 0), won));
    c = marchOn(finishFight(enterNode(c, 0), won));
    // Lap 1 on a straight path: a battle, then the ruler again.
    const run = runOf(c);
    c = { ...c, run: { ...run, map: [[{ kind: 'battle', next: [0] }], [{ kind: 'boss', next: [] }]] } };
    c = onward(finishFight(enterNode(c, 0), won));
    expect(runOf(c).endless!.score).toBe(ENDLESS_RULES.score.fight);
    c = finishFight(enterNode(c, 0), won);
    const score = 2 * ENDLESS_RULES.score.fight + ENDLESS_RULES.score.ruler;
    expect(runOf(c).endless!.score).toBe(score);
    expect(runOf(c).stop).toEqual({ kind: 'endless', lap: 1 });
    c = goHome(c);
    expect(runOf(c).stop).toMatchObject({ kind: 'end', won: true, endless: { score, best: true } });
    expect(c.endlessBest).toBe(score);
  });

  it('a lost fight past the ruler ends the run as a win, keeping its score; in Ironman the fallen die', () => {
    let c = onward(finishFight(enterNode(toRuler(ALL, true), 0), won));
    c = marchOn(finishFight(enterNode(c, 0), won));
    c = { ...c, endlessBest: 9 };
    const run = runOf(c);
    c = { ...c, run: { ...run, endless: { lap: 1, score: 4 }, map: [[{ kind: 'battle', next: [0] }], [{ kind: 'boss', next: [] }]] } };
    const fallen = run.field[0]!;
    c = finishFight(enterNode(c, 0), lost([fallen]));
    const stop = runOf(c).stop;
    expect(stop).toMatchObject({ kind: 'end', won: true, endless: { score: 4, best: false }, died: [fallen] });
    expect(c.endlessBest).toBe(9);
    // The fallen can't stay in the company.
    expect((stop as { keep: number[] }).keep).not.toContain(fallen);
    expect(runOf(toggleKeep(c, fallen)).stop).toEqual(stop);
    expect(closeRun(c).company.some((v) => v.id === fallen)).toBe(false);
  });

  it('giving up past the ruler goes home with the win', () => {
    let c = onward(finishFight(enterNode(toRuler(), 0), won));
    c = finishFight(enterNode(c, 0), won);
    expect(runOf(abandonRun(c)).stop).toMatchObject({ kind: 'end', won: true });
    c = marchOn(c);
    expect(runOf(abandonRun(c)).stop).toMatchObject({ kind: 'end', won: true, endless: { score: 0, best: false } });
  });
});
