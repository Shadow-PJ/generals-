// Artifacts (session 5B): rare items found in a run, from elite fights and some events. You carry
// them until you bank them at a rest camp or win the run; lose the run first and you lose the
// ones you carry. Banked artifacts are yours for good. Equipping them on a troop in the Capital,
// and what each one does in battle, comes with the full set in session 5E.

export const ARTIFACT_IDS = ['lifestealCore', 'ironHeart', 'couriersBoots', 'eagleEye', 'warHorn'] as const;
export type ArtifactId = (typeof ARTIFACT_IDS)[number];

export interface ArtifactData {
  name: string;
  /** What it will do for the troop that carries it. */
  text: string;
}

export const ARTIFACTS: Readonly<Record<ArtifactId, ArtifactData>> = {
  lifestealCore: { name: 'Lifesteal Core', text: 'Its troop heals 15% of the damage it deals' },
  ironHeart: { name: 'Iron Heart', text: 'Its troop has 25% more HP' },
  couriersBoots: { name: "Courier's Boots", text: 'Its troop moves 25% faster' },
  eagleEye: { name: 'Eagle Eye', text: 'Its troop reaches 15% further' },
  warHorn: { name: 'War Horn', text: "Its troop's skill comes back 30% sooner" },
};
