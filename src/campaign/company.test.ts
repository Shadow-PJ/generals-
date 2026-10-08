import { describe, expect, it } from 'vitest';
import { PERK_IDS } from '../data/perks';
import { RUN_RULES } from '../data/runs';
import { COMPANY_RULES, FIGHTER_NAMES, VETERAN_RANKS } from '../data/veterans';
import { fieldPlacement, withRole } from './army';
import { MAPS } from '../data/maps';
import {
  defaultKeep,
  equip,
  equipProblem,
  freeArtifacts,
  freshName,
  newCampaign,
  rankIndex,
  startingCompany,
  veteranRank,
  withIronman,
} from './company';
import { abandonRun, closeRun, enterNode, finishFight, newRun, pickSpoils, toggleKeep } from './run';
import { runOf, runThrough } from './testing';
import type { Campaign, FighterRecord } from './types';

const won = (fighters: { id: number; hp: number | null; kills?: number }[] = [], insight = 3) => ({ won: true, fighters, xp: 50, insight });
const lost = (fighters: { id: number; hp: number | null; kills?: number }[] = []) => ({ won: false, fighters, xp: 20, insight: 1 });
const record = (battles: number): FighterRecord => ({ battles, kills: 0, bossKills: 0 });

/** The spoils' first fighter on offer. */
function fighterOffer(c: Campaign): number {
  const stop = runOf(c).stop;
  const i = stop?.kind === 'spoils' ? stop.offers.findIndex((o) => o.kind === 'fighter') : -1;
  if (i < 0) throw new Error('No fighter on offer');
  return i;
}

describe('your company', () => {
  it('starts as eight named Recruits in the starter army’s classes', () => {
    const company = startingCompany();
    expect(company).toHaveLength(COMPANY_RULES.size);
    expect(company.map((v) => v.cls)).toEqual(COMPANY_RULES.recruitClasses);
    expect(new Set(company.map((v) => v.name)).size).toBe(company.length);
    expect(company.every((v) => v.rarity === 'common' && v.perks.length === 0 && v.record.battles === 0 && v.artifact === null)).toBe(true);
  });

  it('sets out on every run: the field first, then the reserves, each fighter linked to its company troop', () => {
    const c = newRun({ ...newCampaign(), company: startingCompany().map((v, i) => (i === 0 ? { ...v, artifact: 'ironHeart' } : v)), artifacts: ['ironHeart'] }, 'deepForest', 4);
    const run = runOf(c);
    expect(run.roster.map((f) => f.name)).toEqual(startingCompany().map((v) => v.name));
    expect(run.roster.map((f) => f.veteranId)).toEqual(startingCompany().map((v) => v.id));
    expect(run.field).toHaveLength(5);
    expect(run.reserves).toHaveLength(3);
    expect(run.roster[0]!.artifact).toBe('ironHeart');
    // The starter troops stand where the starter army does.
    expect(fieldPlacement(run, MAPS.deepForest).map((t) => t.cls)).toEqual(['vanguard', 'vanguard', 'ranger', 'ranger', 'guardian']);
  });

  it('fills empty places with fresh Recruits who join the company, with names nobody has', () => {
    const c = newRun({ ...newCampaign(), company: startingCompany().slice(0, 3) }, 'deepForest', 9);
    expect(c.company).toHaveLength(COMPANY_RULES.size);
    expect(runOf(c).roster).toHaveLength(COMPANY_RULES.size);
    expect(new Set(c.company.map((v) => v.name)).size).toBe(COMPANY_RULES.size);
    expect(new Set(c.company.map((v) => v.id)).size).toBe(COMPANY_RULES.size);
  });

  it('names come round again with a numeral once all are taken', () => {
    expect(freshName([], 0)).toBe(FIGHTER_NAMES[0]);
    expect(freshName(FIGHTER_NAMES, 0)).toBe(`${FIGHTER_NAMES[0]} II`);
  });
});

describe('veterans', () => {
  it('rise from Recruit to Veteran to Elite with battles fought', () => {
    expect(veteranRank(record(0)).name).toBe('Recruit');
    expect(veteranRank(record(VETERAN_RANKS[1]!.battles)).name).toBe('Veteran');
    expect(veteranRank(record(VETERAN_RANKS[2]!.battles)).name).toBe('Elite');
  });

  it('add each battle and its kills to their record, boss kills too, and gain a new perk with each rank', () => {
    const veteranBattles = VETERAN_RANKS[1]!.battles;
    const almost = { ...newCampaign(), company: startingCompany().map((v, i) => (i === 0 ? { ...v, record: record(veteranBattles - 1) } : v)) };
    let c = finishFight(enterNode(runThrough(['battle', 'battle', 'boss'], {}), 0), won([{ id: 1, hp: 1, kills: 2 }]));
    expect(runOf(c).roster[0]!.record).toEqual({ battles: 1, kills: 2, bossKills: 0 });
    // A troop one battle short of Veteran gets there, with a perk.
    c = finishFight(enterNode(newRun(almost, 'deepForest', 3), runOf(newRun(almost, 'deepForest', 3)).map[0]!.length - 1), won([{ id: 1, hp: 1, kills: 1 }]));
    const ranked = runOf(c).roster[0]!;
    expect(rankIndex(ranked.record)).toBe(1);
    expect(ranked.perks).toHaveLength(1);
    expect(PERK_IDS).toContain(ranked.perks[0]);
    // A boss fight's kills are boss kills.
    let boss = enterNode(runThrough(['boss']), 0);
    boss = finishFight(boss, won([{ id: 2, hp: 1, kills: 3 }]));
    expect(runOf(boss).roster[1]!.record).toEqual({ battles: 1, kills: 3, bossKills: 3 });
  });

  it('a fighter who falls in a won fight gets back up hurt, sits the next fight out, then is back', () => {
    let c = finishFight(enterNode(runThrough(['battle', 'battle', 'battle']), 0), won([{ id: 1, hp: null }, { id: 2, hp: 0.5 }]));
    let run = runOf(c);
    expect(run.roster[0]).toMatchObject({ hp: RUN_RULES.fallenHp, wounded: true });
    expect(run.field).not.toContain(1);
    expect(run.reserves).not.toContain(1);
    // A reserve stepped up to the free place on the field.
    expect(run.field).toEqual([2, 3, 4, 5, 6]);
    expect(run.reserves).toEqual([7, 8]);
    expect(withRole(run, 1, 'field')).toBe(run);
    c = finishFight(enterNode(pickSpoils(c, null), 0), won([{ id: 2, hp: 0.5 }]));
    run = runOf(c);
    expect(run.roster[0]!.wounded).toBe(false);
    // Fit again, it waits for a free place: here, in reserve.
    expect(run.reserves).toContain(1);
  });

  it('in Ironman a fighter who falls dies, and the company loses it for good', () => {
    const iron = withIronman(newCampaign(), true);
    let c = newRun(iron, 'deepForest', 5);
    expect(runOf(c).ironman).toBe(true);
    c = finishFight(enterNode(c, 0), won([{ id: 1, hp: null }, { id: 2, hp: 1 }]));
    expect(runOf(c).roster.map((f) => f.id)).not.toContain(1);
    c = finishFight(enterNode(pickSpoils(c, null), 0), lost([{ id: 2, hp: null }]));
    expect(runOf(c).stop).toMatchObject({ kind: 'end', won: false, died: [2] });
    const home = closeRun(c);
    expect(home.company.map((v) => v.id)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('without Ironman, a lost run brings the company home, records and all, without the run’s newcomers', () => {
    let c = finishFight(enterNode(runThrough(['battle', 'battle']), 0), won([{ id: 1, hp: 0.5, kills: 1 }]));
    c = pickSpoils(c, fighterOffer(c));
    expect(runOf(c).roster.length).toBeGreaterThanOrEqual(COMPANY_RULES.size);
    c = finishFight(enterNode(c, 0), lost([{ id: 1, hp: null }]));
    const home = closeRun(c);
    expect(home.company).toHaveLength(COMPANY_RULES.size);
    expect(home.company.map((v) => v.id)).toEqual(startingCompany().map((v) => v.id));
    expect(home.company[0]!.record).toEqual({ battles: 2, kills: 1, bossKills: 0 });
    const abandoned = closeRun(abandonRun(newRun(newCampaign(), 'voidRuins', 2)));
    expect(abandoned.company).toEqual(newCampaign().company);
  });

  it('after a won run, the fighters you keep (up to 8) are your company; the rest leave', () => {
    let c = finishFight(enterNode(runThrough(['battle', 'boss']), 0), won());
    c = pickSpoils(c, fighterOffer(c));
    const newcomer = runOf(c).roster.find((f) => f.veteranId === null)!;
    expect(newcomer).toBeDefined();
    c = finishFight(enterNode(c, 0), won([{ id: 1, hp: 1, kills: 4 }]));
    const stop = runOf(c).stop;
    if (stop?.kind !== 'end') throw new Error('Not over');
    expect(stop.keep).toEqual(defaultKeep(runOf(c).roster));
    expect(stop.keep).toHaveLength(COMPANY_RULES.size);
    // A ninth can't join until someone else steps out.
    expect(toggleKeep(c, newcomer.id)).toBe(c);
    c = toggleKeep(toggleKeep(c, 8), newcomer.id);
    const home = closeRun(c);
    expect(home.company.map((v) => v.name)).toContain(newcomer.name);
    expect(home.company.map((v) => v.id)).not.toContain(8);
    expect(new Set(home.company.map((v) => v.id)).size).toBe(home.company.length);
    expect(home.company.find((v) => v.id === 1)!.record.bossKills).toBe(4);
  });
});

describe('equipping artifacts', () => {
  const stocked: Campaign = { ...newCampaign(), artifacts: ['ironHeart', 'warHorn'] };

  it('puts a banked artifact on one troop of your company, taking it off any other', () => {
    let c = equip(stocked, 1, 'ironHeart');
    expect(c.company[0]!.artifact).toBe('ironHeart');
    expect(freeArtifacts(c)).toEqual(['warHorn']);
    c = equip(c, 2, 'ironHeart');
    expect(c.company[0]!.artifact).toBeNull();
    expect(c.company[1]!.artifact).toBe('ironHeart');
    expect(equip(c, 2, null).company[1]!.artifact).toBeNull();
  });

  it('only between runs, and only an artifact you have banked', () => {
    expect(equipProblem(stocked, 1, 'eagleEye')).toMatch(/Bank/);
    expect(equipProblem(newRun(stocked, 'deepForest', 1), 1, 'ironHeart')).toMatch(/between runs/);
    expect(equipProblem(stocked, 99, 'ironHeart')).toMatch(/No such/);
  });

  it('an artifact on a troop who leaves the company goes back to your bank', () => {
    let c = equip(stocked, 8, 'warHorn');
    c = finishFight(enterNode(newRun(c, 'deepForest', 7), 0), won());
    // Straight to the end of the run, keeping everyone but troop 8.
    c = { ...c, run: { ...runOf(c), stop: { kind: 'end', won: true, banked: [], lost: [], learned: null, opened: [], unlocked: null, keep: [1, 2, 3, 4, 5, 6, 7], died: [], fear: 0, bounty: 0, endless: null } } };
    const home = closeRun(c);
    expect(home.company.some((v) => v.artifact === 'warHorn')).toBe(false);
    expect(freeArtifacts(home)).toContain('warHorn');
  });
});

describe('Ironman mode', () => {
  it('is switched between runs only', () => {
    expect(withIronman(newCampaign(), true).ironman).toBe(true);
    const out = newRun(newCampaign(), 'deepForest', 1);
    expect(withIronman(out, true).ironman).toBe(false);
  });
});
