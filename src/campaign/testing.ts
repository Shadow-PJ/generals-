// Helpers for campaign tests: a fresh campaign and runs on hand-made maps.

import type { GeneralId } from '../data/generals';
import type { RegionId } from '../data/regions';
import type { NodeKind } from '../data/runs';
import { newRun } from './run';
import type { Campaign, RunState } from './types';

export function freshCampaign(bossesBeaten: GeneralId[] = []): Campaign {
  return { run: null, artifacts: [], bossesBeaten };
}

/**
 * A new run whose map is a single straight path through these node kinds: each floor holds one
 * node, leading to the next.
 */
export function runThrough(kinds: NodeKind[], options: { seed?: number; region?: RegionId; bossesBeaten?: GeneralId[] } = {}): Campaign {
  const campaign = newRun(freshCampaign(options.bossesBeaten), options.region ?? 'deepForest', options.seed ?? 5);
  const map = kinds.map((kind, f) => [{ kind, next: f + 1 < kinds.length ? [0] : [] }]);
  return { ...campaign, run: { ...campaign.run!, map } };
}

/** The run, which a test knows is there. */
export function runOf(campaign: Campaign): RunState {
  if (!campaign.run) throw new Error('No run');
  return campaign.run;
}
