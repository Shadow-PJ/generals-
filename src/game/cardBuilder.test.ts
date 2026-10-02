import { describe, expect, it } from 'vitest';
import { parseOrder } from '../cards/parser';
import { describeCard } from '../cards/describe';
import type { Card } from '../cards/types';
import { builderRows, cycleRow, newDraft } from './cardBuilder';

const label = (card: Card, id: string) => {
  const r = builderRows(card).find((x) => x.id === id)!;
  return r.choices[r.index]!.label;
};

describe('the card builder menus', () => {
  it('start from a one-step card with no condition', () => {
    const draft = newDraft();
    expect(describeCard(draft)).toBe('Focus the nearest enemy');
    expect(builderRows(draft).map((r) => r.id)).toEqual(['trigger0', 'step0', 'step0.actors', 'step0.target', 'step1', 'auto']);
  });

  it('build the design example from menus alone', () => {
    let card = newDraft();
    card = cycleRow(card, 'trigger0', 1); // An enemy reaches your backline
    for (let i = 0; i < 5; i++) card = cycleRow(card, 'trigger0.enemy', 1); // ... an Assassin
    card = cycleRow(card, 'step0', 4); // Protect
    card = cycleRow(card, 'step0.target', 2); // your Rangers
    card = cycleRow(card, 'step1', 1); // Focus
    card = cycleRow(card, 'step1.target', 2); // the one that set it off
    expect(describeCard(card)).toBe(
      'When an enemy Assassin reaches your backline: Protect your Rangers, then Focus the Assassin',
    );
    expect(label(card, 'step1.target')).toBe('The Assassin');
  });

  it('offer each action its own targets', () => {
    let card = newDraft();
    card = cycleRow(card, 'step0', 1); // Move
    expect(label(card, 'step0.to')).toBe('Forward');
    card = cycleRow(card, 'step0', 5); // Call Reserve
    expect(builderRows(card).some((r) => r.id === 'step0.actors')).toBe(false);
    expect(label(card, 'step0.reserve')).toBe('The next in line');
  });

  it('wrap around both ways', () => {
    const card = newDraft();
    expect(cycleRow(cycleRow(card, 'auto', 1), 'auto', 1)).toEqual(card);
    expect(cycleRow(card, 'trigger0', -1).condition?.triggers[0]?.kind).toBe('enemyUltimateCharging');
  });

  it('add and remove steps and conditions', () => {
    let card = newDraft();
    card = cycleRow(card, 'step1', 2); // second step: Move
    expect(card.steps.length).toBe(2);
    card = cycleRow(card, 'step1', -2); // back to "No more steps"
    expect(card.steps.length).toBe(1);
    card = cycleRow(card, 'trigger0', 3); // Enemies group up
    card = cycleRow(card, 'trigger1', 4); // and the enemy ultimate charges
    card = cycleRow(card, 'repeat', 1);
    expect(describeCard(card)).toBe(
      'Every time 3 or more enemies are close together and the enemy ultimate is charging: Focus the nearest enemy',
    );
    card = cycleRow(card, 'trigger0', -3); // no condition at all
    expect(card.condition).toBeNull();
  });

  it('show typed orders, including values the menus do not offer', () => {
    const typed = parseOrder('When my ranger drops below 40%, protect her');
    if (!typed.ok) throw new Error(typed.error);
    expect(label(typed.card, 'trigger0.hp')).toBe('40%');
    expect(label(typed.card, 'step0.target')).toBe('Your Ranger');
    // Editing in the menus forgets the typed words, since they no longer match.
    expect(cycleRow(typed.card, 'trigger0.hp', 1).text).toBeUndefined();
  });
});
