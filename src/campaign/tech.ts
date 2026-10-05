// The Tech Web (session 5E), bought with Insight in the Capital: for each class, Drills and Better
// Arms first, then one of its two specializations, then Honed Skill. Between runs, a class's web
// can be taken back for free and its Insight spent again. Pure functions.

import { SPECIALIZATIONS, type SpecChoice, type SpecializationId } from '../data/specializations';
import { SPEC_COST, TECH_NODES, type TechChoice, type TechNodeId } from '../data/tech';
import { TROOP_CLASSES, type TroopClass } from '../data/units';
import { unlockedClasses } from '../data/regions';
import type { Campaign, TechWeb } from './types';

/** A node of a class's web: one of the shared nodes, or a specialization. */
export type TechPick = TechNodeId | SpecializationId;

function isSpec(pick: TechPick): pick is SpecializationId {
  return pick in SPECIALIZATIONS;
}

/** What a class has bought: its nodes and its specialization. */
export function classTech(web: TechWeb, cls: TroopClass): { nodes: TechNodeId[]; spec: SpecializationId | null } {
  return web[cls] ?? { nodes: [], spec: null };
}

export function techCost(pick: TechPick): number {
  return isSpec(pick) ? SPEC_COST : TECH_NODES[pick].cost;
}

/** Whether the class has the node, or that specialization. */
export function hasTech(web: TechWeb, cls: TroopClass, pick: TechPick): boolean {
  const own = classTech(web, cls);
  return isSpec(pick) ? own.spec === pick : own.nodes.includes(pick);
}

/** Why the class can't buy the node now, or null if it can. */
export function techProblem(campaign: Campaign, cls: TroopClass, pick: TechPick): string | null {
  if (!unlockedClasses(campaign.bossesBeaten).includes(cls)) return 'Unlock the class in the campaign first';
  if (isSpec(pick) && SPECIALIZATIONS[pick].cls !== cls) return 'Not this class’s specialization';
  const own = classTech(campaign.tech, cls);
  if (hasTech(campaign.tech, cls, pick)) return 'Already yours';
  if (isSpec(pick)) {
    if (own.spec) return 'One specialization per class: take this one back first';
    if (!own.nodes.includes('drills') && !own.nodes.includes('arms')) return 'Needs Drills or Better Arms first';
  }
  if (pick === 'honed' && !own.spec) return 'Needs a specialization first';
  if (campaign.insight < techCost(pick)) return `Needs ${techCost(pick)} Insight`;
  return null;
}

export function buyTech(campaign: Campaign, cls: TroopClass, pick: TechPick): Campaign {
  const problem = techProblem(campaign, cls, pick);
  if (problem) throw new Error(problem);
  const own = classTech(campaign.tech, cls);
  const next = isSpec(pick) ? { ...own, spec: pick } : { ...own, nodes: [...own.nodes, pick] };
  return { ...campaign, insight: campaign.insight - techCost(pick), tech: { ...campaign.tech, [cls]: next } };
}

/** The Insight a class's web holds. */
export function techSpent(web: TechWeb, cls: TroopClass): number {
  const own = classTech(web, cls);
  return own.nodes.reduce((sum, n) => sum + TECH_NODES[n].cost, 0) + (own.spec ? SPEC_COST : 0);
}

/** Why the class's web can't be taken back now, or null. */
export function respecProblem(campaign: Campaign, cls: TroopClass): string | null {
  if (campaign.run) return 'Take it back between runs';
  if (techSpent(campaign.tech, cls) === 0) return 'Nothing to take back';
  return null;
}

/** Takes back everything the class bought, for all its Insight. */
export function respecTech(campaign: Campaign, cls: TroopClass): Campaign {
  const problem = respecProblem(campaign, cls);
  if (problem) throw new Error(problem);
  const { [cls]: _gone, ...rest } = campaign.tech;
  return { ...campaign, insight: campaign.insight + techSpent(campaign.tech, cls), tech: rest };
}

/** Your specializations in campaign battles: the ones the Tech Web gives. */
export function techSpecs(web: TechWeb): SpecChoice {
  const specs: SpecChoice = {};
  for (const cls of TROOP_CLASSES) {
    const spec = classTech(web, cls).spec;
    if (spec) specs[cls] = spec;
  }
  return specs;
}

/** The Tech Web's other nodes, by class, for the battle. */
export function techChoice(web: TechWeb): TechChoice {
  const choice: TechChoice = {};
  for (const cls of TROOP_CLASSES) {
    const nodes = classTech(web, cls).nodes;
    if (nodes.length > 0) choice[cls] = [...nodes];
  }
  return choice;
}
