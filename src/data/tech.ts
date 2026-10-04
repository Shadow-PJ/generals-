// The Tech Web (session 5E): each troop class has a small branching web of upgrades, bought with
// Insight. Drills and Better Arms come first, in either order; either one opens the class's two
// specializations, of which you take one; the specialization opens Honed Skill. What you buy
// works on every troop of that class in your campaign battles. Between runs you can take it all
// back for free and spend the Insight again. Starting values to tune.

import type { PerkEffect } from './perks';
import type { TroopClass } from './units';

/** Insight: earned in every campaign battle, win or lose, and kept when a run ends. */
export const INSIGHT = { win: 3, draw: 2, loss: 1 } as const;

/** The web's nodes other than the two specializations. */
export const TECH_NODE_IDS = ['drills', 'arms', 'honed'] as const;
export type TechNodeId = (typeof TECH_NODE_IDS)[number];

export interface TechNodeData {
  name: string;
  text: string;
  cost: number;
  effect: PerkEffect;
}

export const TECH_NODES: Readonly<Record<TechNodeId, TechNodeData>> = {
  drills: { name: 'Drills', text: '8% more HP', cost: 2, effect: { kind: 'stat', stat: 'maxHp', bonus: 0.08 } },
  arms: { name: 'Better Arms', text: '8% more damage', cost: 2, effect: { kind: 'stat', stat: 'damage', bonus: 0.08 } },
  honed: { name: 'Honed Skill', text: 'the class skill comes back 15% sooner', cost: 6, effect: { kind: 'skillHaste', cut: 0.15 } },
};

/** A specialization costs this much Insight, and needs Drills or Better Arms first. */
export const SPEC_COST = 4;

/** The Tech Web nodes one side's classes have, besides their specializations (those go with the side's specializations). */
export type TechChoice = Partial<Record<TroopClass, TechNodeId[]>>;
