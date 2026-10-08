import { describe, expect, it } from 'vitest';
import type { Campaign } from '../campaign/types';
import { newCampaign } from '../campaign/company';
import richPresence from '../../docs/store/steam/rich-presence-english.vdf?raw';
import type { MatchSetup } from './match';
import { PRESENCE_LINES, presenceFor } from './presence';

const noRun: Pick<Campaign, 'run'> = { run: null };
const onRun = { run: { region: 'redCanyon' } } as unknown as Pick<Campaign, 'run'>;
const skirmish = { placement: [], fight: null } as unknown as MatchSetup;

describe('presence', () => {
  it('says where you are: the Capital, a run, a ruler’s fight, a skirmish or a versus match', () => {
    expect(presenceFor('Capital', undefined, noRun)).toEqual({ line: 'Capital', params: {} });
    expect(presenceFor('Title', undefined, noRun)).toEqual({ line: 'Capital', params: {} });
    expect(presenceFor('Run', undefined, onRun)).toEqual({ line: 'Run', params: { region: 'Red Canyon' } });
    const fight = { ...skirmish, fight: { encounter: { kind: 'battle', general: 'captain' } } };
    expect(presenceFor('Battle', fight, onRun)).toEqual({ line: 'Run', params: { region: 'Red Canyon' } });
    const boss = { ...skirmish, fight: { encounter: { kind: 'boss', general: 'warlord' } } };
    expect(presenceFor('Battle', boss, onRun)).toEqual({ line: 'Boss', params: { ruler: 'The Warlord', region: 'Red Canyon' } });
    expect(presenceFor('Prep', skirmish, onRun)).toEqual({ line: 'Skirmish', params: {} });
    expect(presenceFor('Versus', undefined, noRun)).toEqual({ line: 'Versus', params: {} });
    expect(presenceFor('Battle', { ...skirmish, versus: { map: 'openField', rank: 3 } }, noRun)).toEqual({ line: 'Versus', params: {} });
  });

  it('keeps the General and Codex screens with the place that opened them', () => {
    expect(presenceFor('Generals', { ...skirmish, returnTo: 'Capital' }, noRun)).toEqual({ line: 'Capital', params: {} });
    expect(presenceFor('Generals', skirmish, noRun)).toEqual({ line: 'Skirmish', params: {} });
    expect(presenceFor('Boot', undefined, noRun)).toBeNull();
  });

  it('fills in only the words its line has', () => {
    const campaign = newCampaign();
    for (const screen of ['Capital', 'Run', 'Prep', 'Battle', 'Versus', 'Settings']) {
      const presence = presenceFor(screen, skirmish, campaign)!;
      expect(Object.keys(presence.params).sort()).toEqual([...PRESENCE_LINES[presence.line as keyof typeof PRESENCE_LINES]].sort());
    }
  });

  it('has every line, with its words, in the rich presence file the store keeps', () => {
    for (const [name, params] of Object.entries(PRESENCE_LINES)) {
      const entry = richPresence.match(new RegExp(`"#${name}"\\s+"([^"]+)"`));
      expect(entry, name).not.toBeNull();
      for (const param of params) expect(entry![1]).toContain(`%${param}%`);
    }
  });
});
