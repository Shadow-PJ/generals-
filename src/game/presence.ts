// What your friends see you doing in a store's friends list (session 7A): a line by name, filled
// in with the region or ruler. Each screen sets it as it opens. The lines' words live with the
// store (docs/store), so this names them only; it is pure, given the screen and its data.

import type { Campaign } from '../campaign/types';
import { GENERALS } from '../data/generals';
import { REGIONS } from '../data/regions';
import type { Presence } from '../platform';
import type { MatchSetup } from './match';

/** The presence lines, each with the words that fill it in. */
export const PRESENCE_LINES = {
  Capital: [],
  Run: ['region'],
  Boss: ['ruler', 'region'],
  Skirmish: [],
  Versus: [],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type PresenceLine = keyof typeof PRESENCE_LINES;

/** Screens of a run, between its fights. */
const RUN_SCREENS = new Set(['Run', 'Army', 'Stop']);
/** Screens that set up or fight a battle. */
const BATTLE_SCREENS = new Set(['Prep', 'Orders', 'Battle', 'Result', 'Troops']);

/** The presence for a screen as it opens, from the data it opened with and your campaign. */
export function presenceFor(screen: string, data: unknown, campaign: Pick<Campaign, 'run'>): Presence | null {
  if (screen === 'Boot') return null;
  if (screen === 'Versus') return line('Versus');
  const setup = (typeof data === 'object' && data !== null ? data : {}) as Partial<MatchSetup>;
  if (setup.versus) return line('Versus');
  const region = campaign.run ? REGIONS[campaign.run.region].name : null;
  const fight = setup.fight;
  if (fight && region) {
    if (fight.encounter.kind === 'boss') return line('Boss', { ruler: GENERALS[fight.encounter.general].name, region });
    return line('Run', { region });
  }
  if (RUN_SCREENS.has(screen) && region) return line('Run', { region });
  // A General, Codex or Settings screen opened from the Capital belongs to the Capital.
  if (BATTLE_SCREENS.has(screen) || (setup.returnTo === undefined && 'placement' in setup)) return line('Skirmish');
  return line('Capital');
}

function line(name: PresenceLine, params: Record<string, string> = {}): Presence {
  return { line: name, params };
}
