// Signature combos: certain steps in a row trigger a bonus (docs/DESIGN.md, Combos). They work
// inside one card and across a chain of cards. All numbers are starting values to tune.

import type { ActionName } from '../cards/types';
import { SYNERGIES, type SynergyId } from './synergies';
import type { TroopClass } from './units';

export type SignatureComboId = 'feignedRetreat' | 'ambush' | 'overload' | 'hammerAndAnvil' | 'ironShell';

export interface SignatureCombo {
  id: SignatureComboId;
  name: string;
  /** The steps, as the Combo Codex shows them. */
  stepsText: string;
  /** What it does, as the Combo Codex shows it. */
  bonusText: string;
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
  {
    id: 'feignedRetreat',
    name: 'Feigned Retreat',
    stepsText: 'Fall Back, then Focus',
    bonusText: 'Enemies that chase are slowed 50% and take +30% damage for 4 s',
    first: 'fallBack',
    then: 'focus',
  },
  {
    id: 'ambush',
    name: 'Ambush',
    stepsText: 'Call Reserve, then Focus',
    bonusText: 'The reserve arrives behind the focused enemy instead of at your edge',
    first: 'callReserve',
    then: 'focus',
  },
  {
    id: 'overload',
    name: 'Overload',
    stepsText: 'Overcharge, then Overcharge the same troops',
    bonusText: 'Their skill fires at double power; each troop takes 20% damage',
    first: 'overcharge',
    then: 'overcharge',
    sameActors: true,
  },
  {
    id: 'hammerAndAnvil',
    name: 'Hammer and Anvil',
    stepsText: 'Move your Vanguards behind the enemy, then Overcharge them',
    bonusText: 'Shove pushes the enemy into your line and stuns them for 2 s',
    first: 'move',
    then: 'overcharge',
    sameActors: true,
    actorClass: 'vanguard',
    firstPlace: 'behindEnemies',
  },
  {
    id: 'ironShell',
    name: 'Iron Shell',
    stepsText: 'Protect, then Hold',
    bonusText: 'Held troops reflect 30% of the damage they take while their Barrier lasts',
    first: 'protect',
    then: 'hold',
  },
];

/** What each signature combo does when it lands. */
export const COMBO_BONUSES = {
  /** Momentum a combo adds (more when it lands on a chain link). */
  momentumGain: 10,
  feignedRetreat: {
    /** Enemies this close to a retreating troop when it turns to Focus count as chasing it. */
    chaseRadius: 160,
    slow: 0.5,
    damageTakenBonus: 0.3,
    durationSeconds: 4,
  },
  ambush: {
    /** The reserve arrives this far past the focused enemy, on the far side from your army. */
    behindDistance: 50,
  },
  overload: { powerMultiplier: 2, selfDamageShare: 0.2 },
  hammerAndAnvil: { stunSeconds: 2 },
  ironShell: { reflectShare: 0.3 },
} as const;

/** What the Combo Codex lists, in order: the signature combos, the Finisher, then the troop synergies. */
export type CodexEntryId = SignatureComboId | 'finisher' | SynergyId;
export const CODEX_ENTRY_IDS: readonly CodexEntryId[] = [...SIGNATURE_COMBOS.map((c) => c.id), 'finisher', ...SYNERGIES.map((s) => s.id)];

/** The Finisher, for the Combo Codex. */
export const FINISHER_TEXT = {
  name: 'Finisher',
  stepsText: 'Your ultimate as the 3rd link of a chain or later',
  bonusText: 'The ultimate is 50% stronger',
} as const;
