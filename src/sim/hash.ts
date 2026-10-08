// A fingerprint of the battle (session 6D): in a two-player battle both computers run the same
// battle from the same seed and the same key presses, and every few seconds they compare this
// number. Any difference means they no longer agree (a desync). It covers what decides the
// battle: the tick, the random generator, every troop, shot, wall and Rift, and both Command bars.

import { commandsOf } from './command';
import type { BattleState } from './types';

/** FNV-1a over a string, in 32-bit integer steps only (the prime multiply done as shifts). */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h >>> 0;
}

/** The battle's fingerprint now. Numbers are written in full, so any drift shows. */
export function stateHash(state: BattleState): number {
  const parts: (string | number)[] = [state.tick, state.rng.a, state.rng.b, state.rng.c, state.rng.d];
  for (const u of state.units) {
    parts.push(u.id, u.x, u.y, u.hp, u.alive ? 1 : 0, u.targetId ?? -1, u.attackCooldown, u.skillCooldown, u.orders.length);
  }
  for (const p of state.projectiles) parts.push('p', p.id, p.x, p.y, p.targetId);
  for (const w of state.walls) parts.push('w', w.id, w.hp, w.ticksLeft ?? -1);
  for (const z of state.zones) parts.push('z', z.id, z.x, z.y, z.ticksLeft);
  for (const c of commandsOf(state)) {
    parts.push('c', c.side, c.pips, c.pipProgress, c.momentum, c.chain.links);
    for (const s of c.slots) parts.push(s.restTicks, s.glowing ? 1 : 0, s.autoFires);
  }
  parts.push('r', state.result?.winner ?? '-', state.reserves.player.length, state.reserves.enemy.length);
  return fnv1a(parts.join(','));
}
