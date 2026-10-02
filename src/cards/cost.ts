// What a card costs in Command pips: the sum of its steps.

import { ACTION_COSTS } from '../data/cards';
import type { Card } from './types';

export function cardCost(card: Card): number {
  return card.steps.reduce((sum, step) => sum + ACTION_COSTS[step.action], 0);
}
