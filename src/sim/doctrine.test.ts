import { describe, expect, it } from 'vitest';
import type { TroopPlacement } from '../data/armies';
import { DOCTRINES, type GeneralId } from '../data/generals';
import { stepBattle } from './battle';
import { think } from './behaviors';
import { updatePacks } from './doctrine';
import { battleWith, freeze, sideUnits } from './testing/fixtures';
import { secondsToTicks } from './time';
import type { BattleState } from './types';

function battle(player: TroopPlacement[], enemy: TroopPlacement[], general: GeneralId): BattleState {
  const state = battleWith(player, enemy, { general });
  freeze(...sideUnits(state, 'enemy'));
  return state;
}

const mine = (state: BattleState, i = 0) => sideUnits(state, 'player')[i]!;
const theirs = (state: BattleState, i = 0) => sideUnits(state, 'enemy')[i]!;

describe("the Generals' doctrines", () => {
  it('Warlord: Vanguards go for the strongest enemy in reach; with none in reach, they fight as usual', () => {
    // Session 6A: they no longer cross the field for the toughest troop while Rangers shoot them.
    const far: TroopPlacement[] = [
      { cls: 'ranger', x: 420, y: 300 },
      { cls: 'vanguard', x: 800, y: 300 },
    ];
    const warlord = battle([{ cls: 'vanguard', x: 300, y: 300 }], far, 'warlord');
    const captain = battle([{ cls: 'vanguard', x: 300, y: 300 }], far, 'captain');
    expect(think(warlord, mine(warlord)).action).toEqual(think(captain, mine(captain)).action);
  });

  it('Warlord: Vanguards go for the strongest enemy', () => {
    const enemies: TroopPlacement[] = [
      { cls: 'ranger', x: 322, y: 290 },
      { cls: 'vanguard', x: 326, y: 312 },
    ];
    const warlord = battle([{ cls: 'vanguard', x: 300, y: 300 }], enemies, 'warlord');
    expect(think(warlord, mine(warlord)).action).toEqual({ kind: 'attack', targetId: theirs(warlord, 1).id });
    const captain = battle([{ cls: 'vanguard', x: 300, y: 300 }], enemies, 'captain');
    expect(think(captain, mine(captain)).action).toEqual({ kind: 'attack', targetId: theirs(captain, 0).id });
  });

  it('Warlord: Assassins dive at once, from any distance', () => {
    const shadowsteps = (general: GeneralId) => {
      const state = battle([{ cls: 'assassin', x: 60, y: 300 }], [{ cls: 'guardian', x: 900, y: 300 }], general);
      stepBattle(state);
      return state.events.filter((e) => e.type === 'skill' && e.skill === 'shadowstep').length;
    };
    expect(shadowsteps('warlord')).toBe(1);
    expect(shadowsteps('captain')).toBe(0);
  });

  it('Engineer: Vanguards hold their spot, leaving it only for enemies close to it', () => {
    const state = battle([{ cls: 'vanguard', x: 200, y: 300 }], [{ cls: 'vanguard', x: 800, y: 300 }], 'engineer');
    const vanguard = mine(state);
    expect(think(state, vanguard).action).toEqual({ kind: 'hold' });
    vanguard.x = 260;
    expect(think(state, vanguard).action).toEqual({ kind: 'walk', to: { x: 200, y: 300 }, targetId: null });
    vanguard.x = 200;
    theirs(state).x = 280;
    expect(think(state, vanguard).action).toMatchObject({ kind: 'walk', targetId: theirs(state).id });
    const captain = battle([{ cls: 'vanguard', x: 200, y: 300 }], [{ cls: 'vanguard', x: 800, y: 300 }], 'captain');
    expect(think(captain, mine(captain)).action).toMatchObject({ kind: 'walk', targetId: theirs(captain).id });
    // After the opening, they fight as usual, so two Engineers can't wait each other out.
    theirs(state).x = 800;
    state.tick = secondsToTicks(DOCTRINES.engineer.holdSeconds);
    expect(think(state, vanguard).action).toMatchObject({ kind: 'walk', targetId: theirs(state).id });
  });

  it('Engineer: Rangers stand behind the nearest Vanguard until an enemy is in range', () => {
    const army: TroopPlacement[] = [
      { cls: 'ranger', x: 100, y: 300 },
      { cls: 'vanguard', x: 200, y: 300 },
    ];
    const state = battle(army, [{ cls: 'vanguard', x: 800, y: 300 }], 'engineer');
    const action = think(state, mine(state)).action;
    expect(action.kind).toBe('walk');
    expect(action.kind === 'walk' && action.to.x).toBeCloseTo(200 - 45 - 14 - 10);
    expect(action.kind === 'walk' && action.to.y).toBeCloseTo(300);
  });

  it('Hive Mother: the pack goes for one enemy at a time', () => {
    const state = battle(
      [
        { cls: 'vanguard', x: 300, y: 200 },
        { cls: 'vanguard', x: 300, y: 400 },
      ],
      [
        { cls: 'ranger', x: 330, y: 200 },
        { cls: 'ranger', x: 330, y: 400 },
      ],
      'hiveMother',
    );
    updatePacks(state);
    const prey = state.packPrey.player;
    expect(prey).toBe(theirs(state, 0).id);
    for (const unit of sideUnits(state, 'player')) expect(think(state, unit).action).toMatchObject({ targetId: prey });
    // It keeps its prey until the prey falls.
    theirs(state, 0).alive = false;
    updatePacks(state);
    expect(state.packPrey.player).toBe(theirs(state, 1).id);
  });

  it('Strategist: Vanguards guard the nearest ally; Rangers back away between shots', () => {
    const state = battle(
      [
        { cls: 'ranger', x: 100, y: 300 },
        { cls: 'vanguard', x: 300, y: 300 },
      ],
      [{ cls: 'vanguard', x: 800, y: 300 }],
      'strategist',
    );
    const action = think(state, mine(state, 1)).action;
    expect(action).toMatchObject({ kind: 'walk', targetId: mine(state, 0).id });
    expect(action.kind === 'walk' && action.to.x).toBeCloseTo(100 + 10 + 14 + 8);
    // An enemy well inside the Ranger's range, while it reloads: it backs away instead of waiting.
    const ranger = mine(state, 0);
    theirs(state).x = 250;
    ranger.attackCooldown = 5;
    expect(think(state, ranger).action.kind).toBe('backAway');
    ranger.attackCooldown = 0;
    expect(think(state, ranger).action.kind).toBe('attack');
  });

  it('Conductor: troops move off an enemy with a full Vibration stack to one without', () => {
    const state = battle(
      [{ cls: 'vanguard', x: 300, y: 300 }],
      [
        { cls: 'ranger', x: 322, y: 290 },
        { cls: 'vanguard', x: 326, y: 312 },
      ],
      'conductor',
    );
    expect(think(state, mine(state)).action).toEqual({ kind: 'attack', targetId: theirs(state, 0).id });
    theirs(state, 0).vibration = { stacks: 2, ticksLeft: 50 };
    expect(think(state, mine(state)).action).toEqual({ kind: 'attack', targetId: theirs(state, 0).id });
    theirs(state, 0).vibration = { stacks: 3, ticksLeft: 50 };
    expect(think(state, mine(state)).action).toEqual({ kind: 'attack', targetId: theirs(state, 1).id });
    // With every enemy in reach full, it keeps hitting its own target.
    theirs(state, 1).vibration = { stacks: 3, ticksLeft: 50 };
    expect(think(state, mine(state)).action).toEqual({ kind: 'attack', targetId: theirs(state, 0).id });
  });
});
