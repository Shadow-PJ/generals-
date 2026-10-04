// Artifacts (sessions 5B and 5E): rare items found in a run, from elite fights and some events.
// You carry them until you bank them at a rest camp or win the run; lose the run first and you
// lose the ones you carry. Banked artifacts are yours for good: in the Capital you equip each on
// one troop of your company, one per troop, and it works in every battle that troop fights.
// Starting values to tune.

import type { PerkEffect } from './perks';

export const ARTIFACT_IDS = [
  'lifestealCore',
  'ironHeart',
  'couriersBoots',
  'eagleEye',
  'warHorn',
  'stoneskinCharm',
  'berserkersTorc',
  'quickdrawGloves',
  'phoenixFeather',
  'wardingCloak',
] as const;
export type ArtifactId = (typeof ARTIFACT_IDS)[number];

export interface ArtifactData {
  name: string;
  /** What it does for the troop that carries it. */
  text: string;
  effects: readonly PerkEffect[];
}

export const ARTIFACTS: Readonly<Record<ArtifactId, ArtifactData>> = {
  lifestealCore: { name: 'Lifesteal Core', text: 'Its troop heals 15% of the damage it deals', effects: [{ kind: 'lifesteal', share: 0.15 }] },
  ironHeart: { name: 'Iron Heart', text: 'Its troop has 25% more HP', effects: [{ kind: 'stat', stat: 'maxHp', bonus: 0.25 }] },
  couriersBoots: { name: "Courier's Boots", text: 'Its troop moves 25% faster', effects: [{ kind: 'stat', stat: 'moveSpeed', bonus: 0.25 }] },
  eagleEye: { name: 'Eagle Eye', text: 'Its troop reaches 15% further', effects: [{ kind: 'stat', stat: 'range', bonus: 0.15 }] },
  warHorn: { name: 'War Horn', text: "Its troop's skill comes back 30% sooner", effects: [{ kind: 'skillHaste', cut: 0.3 }] },
  stoneskinCharm: { name: 'Stoneskin Charm', text: 'Its troop has 8% more armor', effects: [{ kind: 'armor', amount: 0.08 }] },
  berserkersTorc: {
    name: "Berserker's Torc",
    text: 'Its troop deals 25% more damage, but has 10% less HP',
    effects: [
      { kind: 'stat', stat: 'damage', bonus: 0.25 },
      { kind: 'stat', stat: 'maxHp', bonus: -0.1 },
    ],
  },
  quickdrawGloves: { name: 'Quickdraw Gloves', text: 'Its troop attacks 15% faster', effects: [{ kind: 'stat', stat: 'attacksPerSecond', bonus: 0.15 }] },
  phoenixFeather: {
    name: 'Phoenix Feather',
    text: 'Once a battle, instead of falling, its troop gets back up with 30% HP',
    effects: [{ kind: 'revive', hp: 0.3 }],
  },
  wardingCloak: { name: 'Warding Cloak', text: 'Its troop takes 35% less area damage', effects: [{ kind: 'areaWard', cut: 0.35 }] },
};
