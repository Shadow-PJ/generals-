// Crossroads (session 7F; from Thronefall's two clear choices, see docs/inspiration.md). Some
// battles on a run's map are crossroads, marked on the map. Winning one doesn't offer the usual
// pick of three: it offers two deals, and you take one. Each deal is a clear gain bought with a
// clear cost, and the two on offer never cost the same kind of thing (your army's blood, your gold,
// or something you have), so the choice is a sharp either/or. Starting values to tune.

import type { EventEffect } from './events';

/** What a deal costs you: two deals on offer never cost the same kind of thing. */
export type DealCost = 'blood' | 'gold' | 'loss';

export interface DealData {
  name: string;
  /** What you get, and what it costs, in plain words. */
  gainText: string;
  costText: string;
  gain: readonly EventEffect[];
  cost: readonly EventEffect[];
  costKind: DealCost;
}

export const CROSSROADS_RULES = {
  /** A battle node past the first floor, and before the floor of camps, is a crossroads with this chance. */
  chance: 0.25,
  /** How many deals a crossroads offers. */
  deals: 2,
} as const;

export const DEAL_IDS = [
  'bloodPrice',
  'battleHymn',
  'forbiddenDrill',
  'mercenaryContract',
  'royalSurgeons',
  'swornBand',
  'warChest',
  'relicHunt',
  'oldPact',
] as const;
export type DealId = (typeof DEAL_IDS)[number];

export const DEALS: Readonly<Record<DealId, DealData>> = {
  // Paid in blood: every fighter is hurt.
  bloodPrice: {
    name: 'Blood Price',
    gainText: 'An Epic fighter joins',
    costText: 'every fighter loses 25% HP',
    gain: [{ kind: 'fighter', rarity: 'epic' }],
    cost: [{ kind: 'hurt', share: 0.25 }],
    costKind: 'blood',
  },
  battleHymn: {
    name: 'Battle Hymn',
    gainText: 'An Epic boon',
    costText: 'every fighter loses 25% HP',
    gain: [{ kind: 'boon', rarity: 'epic' }],
    cost: [{ kind: 'hurt', share: 0.25 }],
    costKind: 'blood',
  },
  forbiddenDrill: {
    name: 'Forbidden Drill',
    gainText: 'Two of your fighters rise a rarity',
    costText: 'every fighter loses 30% HP',
    gain: [{ kind: 'upgrade' }, { kind: 'upgrade' }],
    cost: [{ kind: 'hurt', share: 0.3 }],
    costKind: 'blood',
  },
  // Paid in gold.
  mercenaryContract: {
    name: 'Mercenary Contract',
    gainText: 'An Epic fighter joins',
    costText: '60 gold',
    gain: [{ kind: 'fighter', rarity: 'epic' }],
    cost: [{ kind: 'gold', amount: -60 }],
    costKind: 'gold',
  },
  royalSurgeons: {
    name: 'Royal Surgeons',
    gainText: 'Every fighter heals fully, and a Rare boon',
    costText: '50 gold',
    gain: [{ kind: 'heal', share: 1 }, { kind: 'boon', rarity: 'rare' }],
    cost: [{ kind: 'gold', amount: -50 }],
    costKind: 'gold',
  },
  swornBand: {
    name: 'Sworn Band',
    gainText: 'Two Rare fighters join',
    costText: '70 gold',
    gain: [{ kind: 'fighter', rarity: 'rare', count: 2 }],
    cost: [{ kind: 'gold', amount: -70 }],
    costKind: 'gold',
  },
  // Paid with something you have: a fighter or a boon.
  warChest: {
    name: 'War Chest',
    gainText: '+110 gold',
    costText: 'one of your fighters leaves, at random',
    gain: [{ kind: 'gold', amount: 110 }],
    cost: [{ kind: 'loseFighter', which: 'random' }],
    costKind: 'loss',
  },
  relicHunt: {
    name: 'Relic Hunt',
    gainText: 'An artifact',
    costText: 'you give up one of your boons, at random',
    gain: [{ kind: 'artifact' }],
    cost: [{ kind: 'loseBoon' }],
    costKind: 'loss',
  },
  oldPact: {
    name: 'The Old Pact',
    gainText: 'A Legendary boon',
    costText: 'your most hurt fighter leaves',
    gain: [{ kind: 'boon', rarity: 'legendary' }],
    cost: [{ kind: 'loseFighter', which: 'weakest' }],
    costKind: 'loss',
  },
};
