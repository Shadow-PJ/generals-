import { describe, expect, it } from 'vitest';
import { parseOrder } from '../cards/parser';
import type { Card } from '../cards/types';
import { STARTER_ARMY } from '../data/armies';
import { DEBUG_DEFAULT_RANK } from '../data/ranks';
import { newProfile, readProfile, writeProfile, type Profile } from './profile';

function card(text: string): Card {
  const result = parseOrder(text);
  if (!result.ok) throw new Error(text);
  return result.card;
}

function saved(): Profile {
  const profile = newProfile();
  profile.loadout.slots[0] = card('Everyone focus their Ranger');
  profile.loadout.slots[2] = card('When my Ranger drops below 50%, protect her');
  profile.placement[0] = { cls: 'vanguard', x: 230, y: 150 };
  profile.rank = 5;
  profile.tactical = true;
  profile.general = 'warlord';
  return profile;
}

describe('the saved profile', () => {
  it('starts with empty slots, the starter army, the debug rank, Tactical mode off and the Captain', () => {
    const profile = readProfile(null);
    expect(profile.loadout.slots).toEqual([null, null, null, null]);
    expect(profile.loadout.legendary).toBeNull();
    expect(profile.placement).toEqual(STARTER_ARMY);
    expect(profile.rank).toBe(DEBUG_DEFAULT_RANK);
    expect(profile.tactical).toBe(false);
    expect(profile.general).toBe('captain');
  });

  it('comes back exactly as it was written', () => {
    const profile = saved();
    expect(readProfile(writeProfile(profile))).toEqual(profile);
  });

  it('carries a version number for later migrations', () => {
    expect(JSON.parse(writeProfile(saved())).version).toBe(1);
  });

  it('starts fresh from a damaged file instead of failing', () => {
    for (const text of ['', '{', 'null', '42', '"text"', '[]']) expect(readProfile(text)).toEqual(newProfile());
  });

  it('keeps the parts that read correctly and drops the rest', () => {
    const data = JSON.parse(writeProfile(saved()));
    data.loadout.slots[2].steps = 'oops';
    data.rank = 9;
    data.tactical = 'yes';
    data.general = 'napoleon';
    const profile = readProfile(JSON.stringify(data));
    expect(profile.general).toBe('captain');
    expect(profile.loadout.slots[0]).toEqual(card('Everyone focus their Ranger'));
    expect(profile.loadout.slots[2]).toBeNull();
    expect(profile.rank).toBe(DEBUG_DEFAULT_RANK);
    expect(profile.tactical).toBe(false);
    expect(profile.placement[0]).toEqual({ cls: 'vanguard', x: 230, y: 150 });
  });

  it('puts troops back at the start if the saved spots are not allowed', () => {
    const data = JSON.parse(writeProfile(saved()));
    data.placement[1] = { cls: 'vanguard', x: 800, y: 300 }; // the enemy's side
    expect(readProfile(JSON.stringify(data)).placement).toEqual(STARTER_ARMY);
    data.placement = data.placement.slice(0, 3);
    expect(readProfile(JSON.stringify(data)).placement).toEqual(STARTER_ARMY);
    data.placement = STARTER_ARMY.map((t) => ({ ...t, cls: 'ranger' }));
    expect(readProfile(JSON.stringify(data)).placement).toEqual(STARTER_ARMY);
  });

  it('keeps a card the current rank does not allow; the validator decides when it is used', () => {
    const profile = saved();
    profile.rank = 1;
    expect(readProfile(writeProfile(profile)).loadout.slots[2]).toEqual(card('When my Ranger drops below 50%, protect her'));
  });
});

describe('saving the profile again', () => {
  it('writes the same text it read, so an unchanged profile is never rewritten', () => {
    const text = writeProfile(saved());
    expect(writeProfile(readProfile(text))).toBe(text);
  });
});
