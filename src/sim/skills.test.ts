import { describe, expect, it } from 'vitest';
import { UNIT_CLASSES } from '../data/units';
import { createBattle, stepBattle } from './battle';
import { dealDamage } from './combat';
import { distance } from './geometry';
import { castBarrier, castMark, castShove } from './skills';
import { battleWith, openMap } from './testing/fixtures';

describe('Shove (Vanguard)', () => {
  it('pushes close enemies straight back by the push distance and damages them', () => {
    const state = battleWith(
      [{ cls: 'vanguard', x: 300, y: 300 }],
      [
        { cls: 'vanguard', x: 330, y: 300 },
        { cls: 'ranger', x: 300, y: 330 },
        { cls: 'ranger', x: 600, y: 300 },
      ],
    );
    const [vanguard, near, side, far] = state.units;
    castShove(state, vanguard!);
    expect(near!.knockback).not.toBeNull();
    expect(side!.knockback).not.toBeNull();
    expect(far!.knockback).toBeNull();
    expect(near!.hp).toBeLessThan(near!.stats.maxHp);
    expect(state.events.at(-1)).toMatchObject({ type: 'skill', skill: 'shove', targetIds: [near!.id, side!.id] });
    expect(vanguard!.skillCooldown).toBeGreaterThan(0);

    const before = { x: near!.x, y: near!.y };
    while (near!.knockback) stepBattle(state);
    // Pushed away along the line from the Vanguard (separation and its own moves aside).
    expect(near!.x - before.x).toBeGreaterThan(UNIT_CLASSES.vanguard.shove.pushDistance * 0.8);
    expect(Math.abs(near!.y - before.y)).toBeLessThan(5);
  });

  it('stops the shoved enemy from acting while it is pushed', () => {
    const state = battleWith([{ cls: 'vanguard', x: 300, y: 300 }], [{ cls: 'vanguard', x: 330, y: 300 }]);
    const [vanguard, enemy] = state.units;
    enemy!.attackCooldown = 0;
    castShove(state, vanguard!);
    const pushTicks = enemy!.knockback!.ticksLeft;
    const hpBefore = vanguard!.hp;
    for (let i = 0; i < pushTicks; i++) stepBattle(state);
    expect(vanguard!.hp).toBe(hpBefore);
  });

  it('is stopped by walls', () => {
    const wall = { x: 360, y: 200, w: 40, h: 200 };
    const state = createBattle({
      seed: 1,
      map: openMap([wall]),
      player: [{ cls: 'vanguard', x: 300, y: 300 }],
      enemy: [{ cls: 'guardian', x: 335, y: 300 }],
    });
    const [vanguard, enemy] = state.units;
    castShove(state, vanguard!);
    while (enemy!.knockback) stepBattle(state);
    expect(enemy!.x + enemy!.stats.radius).toBeLessThanOrEqual(wall.x);
  });
});

describe('Mark (Ranger)', () => {
  it('makes the target take +20% damage until it runs out', () => {
    const state = battleWith([{ cls: 'ranger', x: 100, y: 100 }], [{ cls: 'ranger', x: 900, y: 500 }]);
    const [ranger, target] = state.units;
    castMark(state, ranger!, target!);
    expect(state.events.at(-1)).toMatchObject({ type: 'skill', skill: 'mark', targetIds: [target!.id] });

    dealDamage(state, ranger!.id, target!, 100, 0, 'attack');
    expect(target!.stats.maxHp - target!.hp).toBe(120);

    const duration = target!.mark!.ticksLeft;
    for (let i = 0; i < duration; i++) stepBattle(state);
    expect(target!.mark).toBeNull();
  });
});

describe('Barrier (Guardian)', () => {
  it('shields one ally with the Barrier amount, which runs out after its duration', () => {
    const state = battleWith(
      [
        { cls: 'guardian', x: 100, y: 100 },
        { cls: 'vanguard', x: 140, y: 100 },
      ],
      [{ cls: 'ranger', x: 900, y: 500 }],
    );
    const [guardian, , ally] = state.units;
    castBarrier(state, guardian!, ally!);
    expect(ally!.barrier?.amount).toBe(UNIT_CLASSES.guardian.barrier.amount);
    expect(state.events.at(-1)).toMatchObject({ type: 'skill', skill: 'barrier', targetIds: [ally!.id] });
    const duration = ally!.barrier!.ticksLeft;
    for (let i = 0; i < duration; i++) stepBattle(state);
    expect(ally!.barrier).toBeNull();
    expect(distance(guardian!.x, guardian!.y, ally!.x, ally!.y)).toBeGreaterThan(0);
  });
});
