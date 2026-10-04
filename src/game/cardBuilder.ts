// The card builder's menus as plain data: every menu row lists its choices as finished cards,
// so moving left or right on a row simply picks the next card. No Phaser here, so it is tested.

import { describeTarget, ACTION_NAMES } from '../cards/describe';
import type { ActionName, Actors, Card, Place, Step, Target, Trigger, TriggerKind } from '../cards/types';
import { REGULAR_ACTIONS, TRIGGER_KINDS } from '../cards/types';
import { CARD_RULES } from '../data/cards';
import { TROOP_CLASSES, TROOP_NAMES, UNIT_CLASS_LIST, type TroopClass } from '../data/units';

export interface BuilderRow {
  id: string;
  label: string;
  choices: { label: string; card: Card }[];
  /** Which choice the card shows now. */
  index: number;
}

/** The most steps a card can have at any rank. */
export const MAX_STEPS = 3;

export function newDraft(): Card {
  return { condition: null, steps: [defaultStep('focus', { kind: 'all' })], auto: false };
}

/**
 * Every menu row for this card, top to bottom. `actions` are the actions the step menus offer:
 * the regular ones, plus the Legendary actions you know on the Legendary slot.
 */
export function builderRows(card: Card, actions: readonly ActionName[] = REGULAR_ACTIONS): BuilderRow[] {
  const rows: BuilderRow[] = [];
  const triggers = card.condition?.triggers ?? [];
  rows.push(triggerKindRow(card, 0));
  if (triggers[0]) {
    rows.push(...triggerParamRows(card, 0));
    rows.push(triggerKindRow(card, 1));
    if (triggers[1]) rows.push(...triggerParamRows(card, 1));
    rows.push(
      row(card, 'repeat', 'Fires', [
        ['When it happens', withCondition(card, { repeat: false })],
        ['Every time it happens', withCondition(card, { repeat: true })],
      ]),
    );
  }
  for (let i = 0; i < Math.min(card.steps.length + 1, MAX_STEPS); i++) {
    rows.push(stepActionRow(card, i, actions));
    const step = card.steps[i];
    if (step) rows.push(...stepParamRows(card, i, step));
  }
  rows.push(
    row(card, 'auto', 'Mode', [
      ['Manual: you press its key', { ...card, auto: false }],
      ['Auto: fires by itself', { ...card, auto: true }],
    ]),
  );
  return rows;
}

/** The card after moving `delta` choices along a row (wrapping around). */
export function cycleRow(card: Card, rowId: string, delta: number, actions: readonly ActionName[] = REGULAR_ACTIONS): Card {
  const r = builderRows(card, actions).find((x) => x.id === rowId);
  if (!r || r.choices.length === 0) return card;
  const n = r.choices.length;
  return r.choices[(((r.index + delta) % n) + n) % n]!.card;
}

// Rows -------------------------------------------------------------------------------------

/** Builds a row; the card's current value is found among the choices, or added if missing. */
function row(card: Card, id: string, label: string, choices: [string, Card][], current?: string): BuilderRow {
  const list = choices.map(([l, c]) => ({ label: l, card: stripText(c) }));
  let index = list.findIndex((ch) => sameCard(ch.card, card));
  if (index === -1) {
    list.unshift({ label: current ?? 'Custom', card: stripText(card) });
    index = 0;
  }
  return { id, label, choices: list, index };
}

const TRIGGER_LABELS: Record<TriggerKind, string> = {
  enemyReachesBackline: 'An enemy reaches your backline',
  allyBelowHp: 'An ally drops below some HP',
  enemiesGrouped: 'Enemies group up',
  enemyUltimateCharging: 'The enemy ultimate charges',
};

function defaultTrigger(kind: TriggerKind): Trigger {
  switch (kind) {
    case 'enemyReachesBackline':
      return { kind, enemy: 'any' };
    case 'allyBelowHp':
      return { kind, ally: 'any', hpPercent: 50 };
    case 'enemiesGrouped':
      return { kind, count: CARD_RULES.groupedDefaultCount };
    case 'enemyUltimateCharging':
      return { kind };
  }
}

function triggerKindRow(card: Card, i: number): BuilderRow {
  const triggers = card.condition?.triggers ?? [];
  const none: [string, Card] =
    i === 0
      ? ['Any time (no condition)', { ...card, condition: null }]
      : ['Nothing else', withTriggers(card, triggers.slice(0, 1))];
  const kinds: [string, Card][] = TRIGGER_KINDS.map((kind) => {
    const existing = triggers[i]?.kind === kind ? triggers[i]! : defaultTrigger(kind);
    return [TRIGGER_LABELS[kind], withTrigger(card, i, existing)];
  });
  return row(card, `trigger${i}`, i === 0 ? 'When' : 'And when', [none, ...kinds]);
}

function triggerParamRows(card: Card, i: number): BuilderRow[] {
  const t = card.condition!.triggers[i]!;
  const id = `trigger${i}`;
  switch (t.kind) {
    case 'enemyReachesBackline':
      return [
        row(
          card,
          `${id}.enemy`,
          'Which enemy',
          (['any', ...TROOP_CLASSES] as const).map((cls) => [
            cls === 'any' ? 'Any enemy' : `An enemy ${TROOP_NAMES[cls].one}`,
            withTrigger(card, i, { ...t, enemy: cls }),
          ]),
        ),
      ];
    case 'allyBelowHp': {
      const hpChoices = uniqueSorted([...CARD_RULES.builderHpChoices, t.hpPercent]);
      return [
        row(
          card,
          `${id}.ally`,
          'Which ally',
          (['any', ...UNIT_CLASS_LIST] as const).map((cls) => [
            cls === 'any' ? 'Any ally' : `Your ${TROOP_NAMES[cls].one}`,
            withTrigger(card, i, { ...t, ally: cls }),
          ]),
          t.ally === 'any' ? 'Any ally' : `Your ${TROOP_NAMES[t.ally].one}`,
        ),
        row(
          card,
          `${id}.hp`,
          'Below HP',
          hpChoices.map((hp) => [`${hp}%`, withTrigger(card, i, { ...t, hpPercent: hp })]),
        ),
      ];
    }
    case 'enemiesGrouped':
      return [
        row(
          card,
          `${id}.count`,
          'How many',
          uniqueSorted([...CARD_RULES.builderGroupedChoices, t.count]).map((n) => [
            `${n} or more`,
            withTrigger(card, i, { ...t, count: n }),
          ]),
        ),
      ];
    case 'enemyUltimateCharging':
      return [];
  }
}

function stepActionRow(card: Card, i: number, actions: readonly ActionName[]): BuilderRow {
  const step = card.steps[i];
  const actors: Actors = step && 'actors' in step ? step.actors : { kind: 'all' };
  const choices: [string, Card][] = [];
  if (i > 0) choices.push(['No more steps', { ...card, steps: card.steps.slice(0, i) }]);
  for (const action of actions) {
    const keep = step?.action === action ? step : defaultStep(action, actors);
    choices.push([ACTION_NAMES[action], withStep(card, i, keep)]);
  }
  return row(card, `step${i}`, `Step ${i + 1}`, choices);
}

function stepParamRows(card: Card, i: number, step: Step): BuilderRow[] {
  const rows: BuilderRow[] = [];
  const id = `step${i}`;
  if ('actors' in step) {
    const options: Actors[] = [{ kind: 'all' }, ...UNIT_CLASS_LIST.map((cls) => ({ kind: 'class', cls }) as const)];
    rows.push(
      row(
        card,
        `${id}.actors`,
        'Who',
        options.map((a) => [actorsLabel(a), withStep(card, i, { ...step, actors: a } as Step)]),
        actorsLabel(step.actors),
      ),
    );
  }
  const triggers = card.condition?.triggers ?? [];
  const enemyTrigger = triggers.some((t) => t.kind === 'enemyReachesBackline' || t.kind === 'enemiesGrouped');
  const allyTrigger = triggers.some((t) => t.kind === 'allyBelowHp');
  const enemyTargets = (): Target[] => [
    { kind: 'nearest' },
    { kind: 'weakest' },
    ...(enemyTrigger ? [{ kind: 'trigger' } as const] : []),
    ...TROOP_CLASSES.map((cls) => ({ kind: 'class', cls }) as const),
  ];
  const allyTargets = (): Target[] => [
    { kind: 'weakest' },
    ...(allyTrigger ? [{ kind: 'trigger' } as const] : []),
    ...UNIT_CLASS_LIST.map((cls) => ({ kind: 'class', cls }) as const),
  ];
  switch (step.action) {
    case 'focus':
    case 'hijack': {
      rows.push(
        row(
          card,
          `${id}.target`,
          step.action === 'focus' ? 'Target' : 'Hijack',
          enemyTargets().map((t) => [cap(describeTarget(t, 'enemy', card)), withStep(card, i, { ...step, target: t })]),
          cap(describeTarget(step.target, 'enemy', card)),
        ),
      );
      break;
    }
    case 'swap':
    case 'bloodPact': {
      rows.push(
        row(
          card,
          `${id}.target`,
          step.action === 'swap' ? 'With' : 'Sacrifice',
          allyTargets().map((t) => [cap(describeTarget(t, 'ally', card)), withStep(card, i, { ...step, target: t })]),
          cap(describeTarget(step.target, 'ally', card)),
        ),
      );
      break;
    }
    case 'fortify': {
      const places: Place[] = [
        { kind: 'forward' },
        { kind: 'back' },
        { kind: 'behindEnemies' },
        ...UNIT_CLASS_LIST.map((cls) => ({ kind: 'ally', ally: { kind: 'class', cls } }) as const),
      ];
      rows.push(
        row(
          card,
          `${id}.at`,
          'Wall',
          places.map((p) => [wallLabel(p, card), withStep(card, i, { ...step, at: p })]),
          wallLabel(step.at, card),
        ),
      );
      break;
    }
    case 'echo':
      break;
    case 'protect': {
      rows.push(
        row(
          card,
          `${id}.target`,
          'Protect',
          allyTargets().map((t) => [cap(describeTarget(t, 'ally', card)), withStep(card, i, { ...step, target: t })]),
          cap(describeTarget(step.target, 'ally', card)),
        ),
      );
      break;
    }
    case 'move': {
      const places: Place[] = [
        { kind: 'forward' },
        { kind: 'back' },
        { kind: 'behindEnemies' },
        ...UNIT_CLASS_LIST.map((cls) => ({ kind: 'ally', ally: { kind: 'class', cls } }) as const),
      ];
      rows.push(
        row(
          card,
          `${id}.to`,
          'Where',
          places.map((p) => [placeLabel(p, card), withStep(card, i, { ...step, to: p })]),
          placeLabel(step.to, card),
        ),
      );
      break;
    }
    case 'fallBack': {
      const to: (Target | null)[] = [null, ...UNIT_CLASS_LIST.map((cls) => ({ kind: 'class', cls }) as const)];
      if (allyTrigger) to.push({ kind: 'trigger' });
      rows.push(
        row(
          card,
          `${id}.to`,
          'Toward',
          to.map((t) => [t ? `To ${describeTarget(t, 'ally', card)}` : 'Just away from the enemy', withStep(card, i, { ...step, to: t })]),
        ),
      );
      break;
    }
    case 'callReserve': {
      const reserves: (TroopClass | null)[] = [null, ...UNIT_CLASS_LIST];
      rows.push(
        row(
          card,
          `${id}.reserve`,
          'Reserve',
          reserves.map((r) => [r ? `A ${TROOP_NAMES[r].one}` : 'The next in line', withStep(card, i, { ...step, reserve: r })]),
        ),
      );
      break;
    }
    case 'overcharge':
    case 'hold':
      break;
  }
  return rows;
}

// Helpers ----------------------------------------------------------------------------------

export function defaultStep(action: ActionName, actors: Actors): Step {
  switch (action) {
    case 'focus':
      return { action, actors, target: { kind: 'nearest' } };
    case 'move':
      return { action, actors, to: { kind: 'forward' } };
    case 'fallBack':
      return { action, actors, to: null };
    case 'overcharge':
      return { action, actors };
    case 'protect':
      return { action, actors, target: { kind: 'weakest' } };
    case 'hold':
      return { action, actors };
    case 'callReserve':
      return { action, reserve: null };
    case 'hijack':
      return { action, target: { kind: 'nearest' } };
    case 'swap':
      return { action, actors, target: { kind: 'weakest' } };
    case 'bloodPact':
      return { action, target: { kind: 'weakest' } };
    case 'fortify':
      return { action, at: { kind: 'forward' } };
    case 'echo':
      return { action };
  }
}

function withStep(card: Card, i: number, step: Step): Card {
  const steps = [...card.steps];
  steps[i] = step;
  return { ...card, steps };
}

function withTriggers(card: Card, triggers: Trigger[]): Card {
  if (triggers.length === 0) return { ...card, condition: null };
  return { ...card, condition: { triggers, repeat: card.condition?.repeat ?? false } };
}

function withTrigger(card: Card, i: number, trigger: Trigger): Card {
  const triggers = [...(card.condition?.triggers ?? [])];
  triggers[i] = trigger;
  return withTriggers(card, triggers);
}

function withCondition(card: Card, patch: { repeat: boolean }): Card {
  return card.condition ? { ...card, condition: { ...card.condition, ...patch } } : card;
}

function actorsLabel(a: Actors): string {
  if (a.kind === 'all') return 'Everyone';
  return a.kind === 'class' ? `Your ${TROOP_NAMES[a.cls].many}` : a.name;
}

function placeLabel(p: Place, card: Card): string {
  switch (p.kind) {
    case 'forward':
      return 'Forward';
    case 'back':
      return 'Back';
    case 'behindEnemies':
      return 'Behind the enemy';
    case 'ally':
      return `To ${describeTarget(p.ally, 'ally', card)}`;
  }
}

function wallLabel(p: Place, card: Card): string {
  switch (p.kind) {
    case 'forward':
      return 'In front of your army';
    case 'back':
      return 'Behind your army';
    case 'behindEnemies':
      return 'Behind the enemy';
    case 'ally':
      return `In front of ${describeTarget(p.ally, 'ally', card)}`;
  }
}

function stripText(card: Card): Card {
  const { text: _text, ...rest } = card;
  return rest;
}

function sameCard(a: Card, b: Card): boolean {
  return JSON.stringify(stripText(a)) === JSON.stringify(stripText(b));
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((x, y) => x - y);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
