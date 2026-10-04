import { describe, expect, it } from 'vitest';
import { parseOrder } from '../cards/parser';
import type { Card } from '../cards/types';
import { STARTER_ARMY, STARTER_RESERVES } from '../data/armies';
import { RANK_XP } from '../data/progression';
import { finishFight, enterNode, newRun } from '../campaign/run';
import { newProfile, profileVersion, readProfile, writeProfile, type Profile } from './profile';

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
  profile.xp = 1234;
  profile.bossesBeaten = ['hiveMother', 'warlord'];
  profile.practiceRank = 4;
  profile.tactical = true;
  profile.general = 'warlord';
  profile.codex = ['feignedRetreat', 'finisher', 'ironWall'];
  profile.placement[1] = { cls: 'assassin', x: 260, y: 320 };
  profile.reserves = ['invoker', 'assassin', 'guardian'];
  profile.specs = { vanguard: 'bulwark', invoker: 'pyromancer' };
  profile.enemyArmy = 'mirror';
  profile.map = 'redCanyon';
  profile.enemyGeneral = 'conductor';
  profile.enemyCommander = 4;
  profile.artifacts = ['ironHeart', 'warHorn'];
  // A run with a few steps taken: the spoils of its first fight wait.
  const campaign = finishFight(enterNode(newRun({ run: null, artifacts: [], bossesBeaten: [] }, 'voidRuins', 31), 0), {
    won: true,
    fighters: [{ id: 2, hp: 0.35 }],
    xp: 55,
  });
  profile.run = campaign.run;
  return profile;
}

describe('the saved profile', () => {
  it('starts with empty slots, the starter army, no XP and no bosses beaten, Tactical mode off and the Captain', () => {
    const profile = readProfile(null);
    expect(profile.loadout.slots).toEqual([null, null, null, null]);
    expect(profile.loadout.legendary).toBeNull();
    expect(profile.placement).toEqual(STARTER_ARMY);
    expect(profile.xp).toBe(0);
    expect(profile.bossesBeaten).toEqual([]);
    expect(profile.tactical).toBe(false);
    expect(profile.general).toBe('captain');
    expect(profile.codex).toEqual([]);
    expect(profile.reserves).toEqual(STARTER_RESERVES);
    expect(profile.specs).toEqual({});
    expect(profile.enemyArmy).toBe('starter');
    expect(profile).toMatchObject({ map: 'openField', enemyGeneral: 'captain', enemyCommander: null });
  });

  it('keeps the skirmish: map, enemy General and enemy commander, if they are real; older saves have the Open Field and no commander', () => {
    expect(readProfile(writeProfile(saved()))).toMatchObject({ map: 'redCanyon', enemyGeneral: 'conductor', enemyCommander: 4 });
    const data = JSON.parse(writeProfile(saved()));
    data.map = 'moon';
    data.enemyGeneral = 'napoleon';
    data.enemyCommander = 6;
    expect(readProfile(JSON.stringify(data))).toMatchObject({ map: 'openField', enemyGeneral: 'captain', enemyCommander: null });
    const { map: _m, enemyGeneral: _g, enemyCommander: _c, ...older } = saved();
    expect(readProfile(JSON.stringify(older))).toMatchObject({ map: 'openField', enemyGeneral: 'captain', enemyCommander: null });
  });

  it('keeps only reserves of real classes, specializations of the right class and a known enemy army', () => {
    const data = JSON.parse(writeProfile(saved()));
    data.reserves = ['invoker', 'dragon', 'guardian'];
    data.specs = { vanguard: 'sniper', ranger: 'sniper', mage: 'pyromancer', guardian: 7 };
    data.enemyArmy = 'everyone';
    const profile = readProfile(JSON.stringify(data));
    expect(profile.reserves).toEqual(STARTER_RESERVES);
    expect(profile.specs).toEqual({ ranger: 'sniper' });
    expect(profile.enemyArmy).toBe('starter');
    const { reserves: _r, specs: _s, enemyArmy: _e, ...older } = saved();
    expect(readProfile(JSON.stringify(older))).toMatchObject({ reserves: STARTER_RESERVES, specs: {}, enemyArmy: 'starter' });
  });

  it('keeps only real Combo Codex entries, once each, in Codex order; older saves have none', () => {
    const text = JSON.stringify({ ...saved(), codex: ['finisher', 'madeUp', 'ironShell', 'ironShell', 7] });
    expect(readProfile(text).codex).toEqual(['ironShell', 'finisher']);
    const { codex: _codex, ...older } = saved();
    expect(readProfile(JSON.stringify(older)).codex).toEqual([]);
  });

  it('comes back exactly as it was written', () => {
    const profile = saved();
    expect(readProfile(writeProfile(profile))).toEqual(profile);
  });

  it('carries its version number', () => {
    expect(JSON.parse(writeProfile(saved())).version).toBe(4);
    expect(profileVersion(writeProfile(saved()))).toBe(4);
    expect(profileVersion(null)).toBeNull();
    expect(profileVersion('{')).toBeNull();
  });

  it('loads a version 3 save: run fighters, and fighters on offer, join no faction and have no perks', () => {
    const data = JSON.parse(writeProfile(saved()));
    data.version = 3;
    const strip = (f: Record<string, unknown>) => {
      delete f.faction;
      delete f.perks;
    };
    data.run.roster.forEach(strip);
    for (const o of data.run.stop.offers) if (o.kind === 'fighter') strip(o);
    const profile = readProfile(JSON.stringify(data));
    expect(profile.run).not.toBeNull();
    expect(profile.run!.roster.every((f) => f.faction === null && f.perks.length === 0)).toBe(true);
    const offers = profile.run!.stop?.kind === 'spoils' ? profile.run!.stop.offers : [];
    expect(offers).toHaveLength(3);
    for (const o of offers) if (o.kind === 'fighter') expect(o).toMatchObject({ faction: null, perks: [] });
  });

  it('loads a version 2 save: no run yet, and nothing banked', () => {
    const { run: _r, artifacts: _a, ...rest } = saved();
    const v2 = { ...rest, version: 2 };
    expect(readProfile(JSON.stringify(v2))).toEqual({ ...saved(), run: null, artifacts: [] });
  });

  it('loads a version 1 save: the debug rank it had becomes the XP for that rank, and everything else stays', () => {
    const { xp: _xp, bossesBeaten: _b, practiceRank: _p, run: _r, artifacts: _a, ...rest } = saved();
    const v1 = { ...rest, version: 1, rank: 4 };
    const profile = readProfile(JSON.stringify(v1));
    expect(profile).toEqual({ ...saved(), xp: RANK_XP[4], bossesBeaten: [], practiceRank: null, run: null, artifacts: [] });
    // A version 1 save with no rank (or a broken one) had the debug default, Rank III.
    expect(readProfile(JSON.stringify({ ...v1, rank: 'high' })).xp).toBe(RANK_XP[3]);
    // The very first saves wrote no version at all.
    const { version: _v, ...unversioned } = v1;
    expect(readProfile(JSON.stringify(unversioned)).xp).toBe(RANK_XP[4]);
  });

  it('keeps only real bosses, in campaign order, and XP that is a real number', () => {
    const data = JSON.parse(writeProfile(saved()));
    data.bossesBeaten = ['warlord', 'captain', 'napoleon', 'hiveMother', 'warlord'];
    data.xp = -5;
    data.practiceRank = 7;
    expect(readProfile(JSON.stringify(data))).toMatchObject({ bossesBeaten: ['hiveMother', 'warlord'], xp: 0, practiceRank: null });
    data.xp = 'lots';
    expect(readProfile(JSON.stringify(data)).xp).toBe(0);
  });

  it('drops a damaged run, but keeps the rest; keeps only known artifacts', () => {
    const breakages: ((run: Record<string, any>) => void)[] = [
      (run) => (run.region = 'atlantis'),
      (run) => (run.roster = []),
      (run) => (run.roster[0].hp = 0),
      (run) => (run.field = [99]),
      (run) => (run.field = [1, 2, 3, 4, 5, 6]),
      (run) => (run.reserves = [1]),
      (run) => (run.path = [0, 7]),
      (run) => (run.map[0][0].next = [42]),
      (run) => (run.stop = { kind: 'feast' }),
      (run) => (run.stop.offers[0] = { kind: 'boon', boon: 'infinitePower' }),
      (run) => (run.boons = ['whetstones', 'whetstones']),
      (run) => (run.rng = { a: 1, b: 2, c: 'three', d: 4 }),
      (run) => (run.nextFighterId = 1),
    ];
    for (const breakIt of breakages) {
      const data = JSON.parse(writeProfile(saved()));
      breakIt(data.run);
      const profile = readProfile(JSON.stringify(data));
      expect(profile.run, String(breakIt)).toBeNull();
      expect(profile.general).toBe('warlord');
    }
    const data = JSON.parse(writeProfile(saved()));
    data.artifacts = ['warHorn', 'excalibur', 'warHorn', 'lifestealCore'];
    expect(readProfile(JSON.stringify(data)).artifacts).toEqual(['lifestealCore', 'warHorn']);
  });

  it('starts fresh from a damaged file instead of failing', () => {
    for (const text of ['', '{', 'null', '42', '"text"', '[]']) expect(readProfile(text)).toEqual(newProfile());
  });

  it('keeps the parts that read correctly and drops the rest', () => {
    const data = JSON.parse(writeProfile(saved()));
    data.loadout.slots[2].steps = 'oops';
    data.xp = null;
    data.tactical = 'yes';
    data.general = 'napoleon';
    const profile = readProfile(JSON.stringify(data));
    expect(profile.general).toBe('captain');
    expect(profile.loadout.slots[0]).toEqual(card('Everyone focus their Ranger'));
    expect(profile.loadout.slots[2]).toBeNull();
    expect(profile.xp).toBe(0);
    expect(profile.tactical).toBe(false);
    expect(profile.placement[0]).toEqual({ cls: 'vanguard', x: 230, y: 150 });
  });

  it('puts troops back at the start if the saved spots are not allowed', () => {
    const data = JSON.parse(writeProfile(saved()));
    data.placement[1] = { cls: 'vanguard', x: 800, y: 300 }; // the enemy's side
    expect(readProfile(JSON.stringify(data)).placement).toEqual(STARTER_ARMY);
    data.placement = data.placement.slice(0, 3);
    expect(readProfile(JSON.stringify(data)).placement).toEqual(STARTER_ARMY);
    data.placement = STARTER_ARMY.map((t) => ({ ...t, cls: 'dragon' }));
    expect(readProfile(JSON.stringify(data)).placement).toEqual(STARTER_ARMY);
    // Any 5 real classes will do: the debug Troops screen picks them.
    data.placement = STARTER_ARMY.map((t) => ({ ...t, cls: 'invoker' }));
    expect(readProfile(JSON.stringify(data)).placement).toEqual(data.placement);
  });

  it('keeps a card the current rank does not allow; the validator decides when it is used', () => {
    const profile = saved();
    profile.xp = 0;
    expect(readProfile(writeProfile(profile)).loadout.slots[2]).toEqual(card('When my Ranger drops below 50%, protect her'));
  });
});

describe('saving the profile again', () => {
  it('writes the same text it read, so an unchanged profile is never rewritten', () => {
    const text = writeProfile(saved());
    expect(writeProfile(readProfile(text))).toBe(text);
  });
});
