// Signature combos: certain steps in a row trigger a bonus (docs/DESIGN.md, Combos). This
// session only needs to recognise them, for the Conductor; their bonuses arrive in phase 4.

import type { ActionName } from '../cards/types';
import type { TroopClass } from './units';

export type SignatureComboId = 'feignedRetreat' | 'ambush' | 'overload' | 'hammerAndAnvil' | 'ironShell';

export interface SignatureCombo {
  id: SignatureComboId;
  name: string;
  /** The first step's action, then the next step's action. */
  first: ActionName;
  then: ActionName;
  /** Both steps must be carried out by the same troops. */
  sameActors?: boolean;
  /** The first step must be carried out by this class... */
  actorClass?: TroopClass;
  /** ...and, for a Move, go here. */
  firstPlace?: 'behindEnemies';
}

export const SIGNATURE_COMBOS: readonly SignatureCombo[] = [
  { id: 'feignedRetreat', name: 'Feigned Retreat', first: 'fallBack', then: 'focus' },
  { id: 'ambush', name: 'Ambush', first: 'callReserve', then: 'focus' },
  { id: 'overload', name: 'Overload', first: 'overcharge', then: 'overcharge', sameActors: true },
  {
    id: 'hammerAndAnvil',
    name: 'Hammer and Anvil',
    first: 'move',
    then: 'overcharge',
    sameActors: true,
    actorClass: 'vanguard',
    firstPlace: 'behindEnemies',
  },
  { id: 'ironShell', name: 'Iron Shell', first: 'protect', then: 'hold' },
];
