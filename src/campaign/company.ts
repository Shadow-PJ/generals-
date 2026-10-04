// Your company and its veterans (session 5E): the troops you set out with on every run. Each is
// a named individual with a record; battles fought raise its rank, and each new rank brings a
// perk. In the Capital you equip artifacts on them. A won run lets the fighters who finished it
// stay; after a lost run your company comes home without the run's newcomers. Pure functions.

import type { ArtifactId } from '../data/artifacts';
import { PERK_IDS, type PerkId } from '../data/perks';
import { RARITIES } from '../data/rarity';
import { COMPANY_RULES, FIGHTER_NAMES, VETERAN_RANKS, type VeteranRank } from '../data/veterans';
import { nextInt, type RngState } from '../sim';
import type { Campaign, Fighter, FighterRecord, Veteran } from './types';

export const NO_RECORD: FighterRecord = { battles: 0, kills: 0, bossKills: 0 };

/** The rank a record gives: 0 Recruit, 1 Veteran, 2 Elite. */
export function rankIndex(record: FighterRecord): number {
  let rank = 0;
  VETERAN_RANKS.forEach((r, i) => {
    if (record.battles >= r.battles) rank = i;
  });
  return rank;
}

export function veteranRank(record: FighterRecord): VeteranRank {
  return VETERAN_RANKS[rankIndex(record)]!;
}

/** A name not in `used`, picked from `start` on; once every name is taken, names come round again with a numeral. */
export function freshName(used: readonly string[], start: number): string {
  const n = FIGHTER_NAMES.length;
  const from = ((Math.floor(Math.abs(start)) % n) + n) % n;
  for (let round = 1; ; round++) {
    for (let k = 0; k < n; k++) {
      const base = FIGHTER_NAMES[(from + k * 7) % n]!;
      const name = round === 1 ? base : `${base} ${toRoman(round)}`;
      if (!used.includes(name)) return name;
    }
  }
}

function toRoman(n: number): string {
  const numerals: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [value, letters] of numerals) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
}

/** The campaign of a new save: no run, nothing banked or beaten, the starting company. */
export function newCampaign(bossesBeaten: Campaign['bossesBeaten'] = []): Campaign {
  return { run: null, artifacts: [], bossesBeaten, company: startingCompany(), insight: 0, tech: {}, ironman: false, mastery: [] };
}

/** A fresh Recruit of your company: common, no faction, no perks. */
export function recruit(id: number, name: string, cls: Veteran['cls']): Veteran {
  return { id, name, cls, rarity: 'common', faction: null, perks: [], record: { ...NO_RECORD }, artifact: null };
}

/** The company a new save starts with: eight Recruits in the starter army's classes, field first. */
export function startingCompany(): Veteran[] {
  return COMPANY_RULES.recruitClasses.map((cls, i) => recruit(i + 1, FIGHTER_NAMES[i]!, cls));
}

/** Your company filled up to its size with fresh Recruits, named from `seed`. */
export function filledCompany(company: readonly Veteran[], seed: number): Veteran[] {
  const filled = [...company];
  let nextId = Math.max(0, ...company.map((v) => v.id)) + 1;
  for (let i = filled.length; i < COMPANY_RULES.size; i++) {
    const name = freshName(filled.map((v) => v.name), seed + nextId * 13);
    filled.push(recruit(nextId++, name, COMPANY_RULES.recruitClasses[i]!));
  }
  return filled;
}

/** A company troop as it sets out on a run, full HP. */
export function fighterFromVeteran(v: Veteran, id: number): Fighter {
  return {
    id,
    name: v.name,
    cls: v.cls,
    rarity: v.rarity,
    faction: v.faction,
    perks: [...v.perks],
    record: { ...v.record },
    artifact: v.artifact,
    veteranId: v.id,
    hp: 1,
    wounded: false,
    spot: null,
  };
}

/** A fighter as a troop of your company, back in the Capital (healed). */
export function veteranFromFighter(f: Fighter, id: number): Veteran {
  return { id, name: f.name, cls: f.cls, rarity: f.rarity, faction: f.faction, perks: [...f.perks], record: { ...f.record }, artifact: f.artifact };
}

/**
 * The record after a battle the fighter fought, and a perk it doesn't have yet for each rank it
 * reached (rolled from the run's generator).
 */
export function afterBattle(rng: RngState, f: Fighter, kills: number, bossFight: boolean): Fighter {
  const record = { battles: f.record.battles + 1, kills: f.record.kills + kills, bossKills: f.record.bossKills + (bossFight ? kills : 0) };
  const perks = [...f.perks];
  for (let r = rankIndex(f.record); r < rankIndex(record); r++) {
    const free = PERK_IDS.filter((p) => !perks.includes(p));
    if (free.length > 0) perks.push(free[nextInt(rng, free.length)]! as PerkId);
  }
  return { ...f, record, perks };
}

/** Who stays in your company after a won run, unless you change it: company troops first, then the rarest and most seasoned. */
export function defaultKeep(roster: readonly Fighter[]): number[] {
  const rarity = (f: Fighter) => RARITIES.indexOf(f.rarity);
  return [...roster]
    .sort(
      (a, b) =>
        Number(b.veteranId !== null) - Number(a.veteranId !== null) || rarity(b) - rarity(a) || b.record.battles - a.record.battles || a.id - b.id,
    )
    .slice(0, COMPANY_RULES.size)
    .map((f) => f.id);
}

/** Banked artifacts no company troop carries. */
export function freeArtifacts(campaign: Campaign): ArtifactId[] {
  return campaign.artifacts.filter((a) => !campaign.company.some((v) => v.artifact === a));
}

/** Why the artifact can't go on that troop now, or null if it can. */
export function equipProblem(campaign: Campaign, veteranId: number, artifact: ArtifactId | null): string | null {
  if (campaign.run) return 'Your company is out on a run: equip artifacts between runs';
  if (!campaign.company.some((v) => v.id === veteranId)) return 'No such troop';
  if (artifact !== null && !campaign.artifacts.includes(artifact)) return 'Bank the artifact first';
  return null;
}

/** The troop carries the artifact (taken off whoever had it), or nothing (null). */
export function equip(campaign: Campaign, veteranId: number, artifact: ArtifactId | null): Campaign {
  const problem = equipProblem(campaign, veteranId, artifact);
  if (problem) throw new Error(problem);
  const company = campaign.company.map((v) => {
    if (v.id === veteranId) return { ...v, artifact };
    return artifact !== null && v.artifact === artifact ? { ...v, artifact: null } : v;
  });
  return { ...campaign, company };
}

/** Why Ironman mode can't be switched now, or null. */
export function ironmanProblem(campaign: Campaign): string | null {
  return campaign.run ? 'Ironman is set when a run begins: switch it between runs' : null;
}

export function withIronman(campaign: Campaign, on: boolean): Campaign {
  if (ironmanProblem(campaign)) return campaign;
  return { ...campaign, ironman: on };
}
