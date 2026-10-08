import { describe, expect, it } from 'vitest';
import { useDevice } from './inputDevice';
import { STARTER_ARMY, STARTER_ARMY_MIRRORED } from '../data/armies';
import { OPEN_FIELD } from '../data/maps';
import { TIP_IDS, TIPS } from '../data/tutorial';
import { parseOrder } from '../cards/parser';
import { validateCard } from '../cards/validator';
import { emptyLoadout } from '../cards/types';
import { newTutorial } from '../save/profile';
import { createBattle, stepBattle, type BattleState } from '../sim';
import { battleMoments, nextTip, replayTips, sceneTips, seeTip, tipText } from './tutorial';

function battle(): BattleState {
  const loadout = emptyLoadout();
  const card = parseOrder('everyone focus the nearest enemy');
  if (!card.ok) throw new Error(card.error);
  loadout.slots[0] = card.card;
  return createBattle({ seed: 3, map: OPEN_FIELD, player: STARTER_ARMY, enemy: STARTER_ARMY_MIRRORED, loadout, rank: 3 });
}

describe("the Captain's tutorial", () => {
  it('says each tip once, the first unseen of those whose moment has come', () => {
    let tutorial = newTutorial();
    const calls = [{ id: 'ultimateReady' as const }, { id: 'cardReady' as const, slot: 2 }];
    expect(nextTip(tutorial, calls)).toEqual({ id: 'ultimateReady' });
    tutorial = seeTip(tutorial, 'ultimateReady');
    expect(nextTip(tutorial, calls)).toEqual({ id: 'cardReady', slot: 2 });
    tutorial = seeTip(tutorial, 'cardReady');
    expect(nextTip(tutorial, calls)).toBeNull();
    // Seen tips stay seen, in tip order, once each.
    expect(seeTip(tutorial, 'cardReady').seen).toEqual(['cardReady', 'ultimateReady']);
  });

  it('quotes only orders a Rank I player can give, in the tips of the first battles (session 7E)', () => {
    for (const id of ['orders'] as const) {
      const quoted = [...TIPS[id].text.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
      expect(quoted.length).toBeGreaterThan(0);
      for (const order of quoted) {
        const read = parseOrder(order);
        if (!read.ok) throw new Error(`${id}: "${order}" does not read: ${read.error}`);
        expect(validateCard(read.card, 1).ok, order).toBe(true);
      }
    }
  });

  it('says nothing while tips are off; playing them again starts over', () => {
    expect(nextTip({ on: false, seen: [] }, sceneTips('Capital'))).toBeNull();
    expect(replayTips()).toEqual({ on: true, seen: [] });
    expect(nextTip(replayTips(), sceneTips('Capital'))).toEqual({ id: 'capital' });
  });

  it('has a tip for every screen of a run, and fills in keys, the slot and your ultimate', () => {
    for (const scene of ['Capital', 'Run', 'Army', 'Prep', 'Orders', 'Battle', 'Result'] as const) expect(sceneTips(scene).length).toBeGreaterThan(0);
    for (const id of TIP_IDS) expect(TIPS[id].text.length).toBeLessThan(260);
    expect(tipText({ id: 'cardReady', slot: 3 }, 'captain')).toMatch(/^Card 3 is ready: press 3!/);
    // With a controller, the tip names its button: slot 3 is B.
    useDevice('gamepad');
    expect(tipText({ id: 'cardReady', slot: 3 }, 'captain')).toMatch(/^Card 3 is ready: press Ⓑ!/);
    useDevice('keyboard');
    expect(tipText({ id: 'ultimateReady' }, 'warlord')).toMatch(/press U for Reaper's Toll/);
    expect(tipText({ id: 'capital' }, 'captain')).toMatch(/with ← → and press Enter/);
    for (const id of TIP_IDS) expect(tipText({ id, slot: 1 }, 'captain')).not.toMatch(/[{}]/);
  });

  it('reads the battle moments from the battle: a ready card, full pips, a fallen troop', () => {
    const state = battle();
    const seen = new Set<string>();
    while (!state.result && state.tick < 20 * 120) {
      stepBattle(state, []);
      for (const call of battleMoments(state)) seen.add(call.id === 'cardReady' ? `cardReady ${call.slot}` : call.id);
    }
    expect(seen).toContain('cardReady 1');
    expect(seen).toContain('pipsFull');
    expect(seen).toContain('troopLost');
  });
});
