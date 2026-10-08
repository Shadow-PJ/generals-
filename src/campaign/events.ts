// Hard-choice events: what each choice does to your run, and whether you can make it.

import { ARTIFACT_IDS, ARTIFACTS, type ArtifactId } from '../data/artifacts';
import { BOONS } from '../data/boons';
import { RUN_EVENT_RULES, type EventChoice, type EventEffect } from '../data/events';
import type { GeneralId } from '../data/generals';
import { PERKS } from '../data/perks';
import { RARITY_RULES, rarityAbove } from '../data/rarity';
import type { RngState } from '../sim';
import { addFighter, removeFighter } from './army';
import { aOrAn, capitalized, fighterLabel, offerLabel } from './describe';
import { boonOfferOrNull, rollFighter, rollPerks } from './offers';
import { pick } from './random';
import type { RunState } from './types';

/** Why you can't make this choice now (not enough gold, no boon to give up...), or null if you can. */
export function choiceProblem(run: RunState, choice: EventChoice): string | null {
  const cost = choice.effects.reduce((sum, e) => sum + (e.kind === 'gold' && e.amount < 0 ? -e.amount : 0), 0);
  if (cost > run.gold) return `Needs ${cost} gold`;
  for (const e of choice.effects) {
    if (e.kind === 'loseFighter' && run.roster.length < 2) return 'Needs a second fighter';
    if (e.kind === 'loseBoon' && run.boons.length === 0) return 'Needs a boon to give up';
    if (e.kind === 'upgrade' && !run.roster.some((f) => rarityAbove(f.rarity) !== null)) return 'Every fighter is Legendary already';
  }
  return null;
}

/** An artifact you have neither banked nor found this run, or null when you have them all. */
export function newArtifact(rng: RngState, run: RunState, banked: readonly ArtifactId[]): ArtifactId | null {
  const left = ARTIFACT_IDS.filter((id) => !banked.includes(id) && !run.artifacts.includes(id));
  return left.length > 0 ? pick(rng, left) : null;
}

/** The run after the choice's effects, in order, and what happened, in lines for the screen. */
export function applyChoice(
  rng: RngState,
  run: RunState,
  choice: EventChoice,
  banked: readonly ArtifactId[],
  bossesBeaten: readonly GeneralId[],
): { run: RunState; outcome: string[] } {
  let next = run;
  const outcome: string[] = [];
  for (const effect of choice.effects) {
    const step = applyEffect(rng, next, effect, banked, bossesBeaten);
    next = step.run;
    outcome.push(...step.lines);
  }
  if (outcome.length === 0) outcome.push('Nothing happens. You march on.');
  return { run: next, outcome };
}

function applyEffect(
  rng: RngState,
  run: RunState,
  effect: EventEffect,
  banked: readonly ArtifactId[],
  bossesBeaten: readonly GeneralId[],
): { run: RunState; lines: string[] } {
  switch (effect.kind) {
    case 'gold':
      return {
        run: { ...run, gold: Math.max(0, run.gold + effect.amount) },
        lines: [effect.amount >= 0 ? `+${effect.amount} gold.` : `You pay ${-effect.amount} gold.`],
      };
    case 'heal':
      return {
        run: { ...run, roster: run.roster.map((f) => ({ ...f, hp: Math.min(1, f.hp + effect.share) })) },
        lines: [effect.share >= 1 ? 'Every fighter is healed fully.' : `Every fighter heals ${percent(effect.share)}.`],
      };
    case 'hurt':
      return {
        run: { ...run, roster: run.roster.map((f) => ({ ...f, hp: Math.max(Math.min(f.hp, RUN_EVENT_RULES.minHp), f.hp - effect.share) })) },
        lines: [`Every fighter loses ${percent(effect.share)} HP.`],
      };
    case 'fighter': {
      let next = run;
      const lines: string[] = [];
      for (let i = 0; i < (effect.count ?? 1); i++) {
        const fighter = rollFighter(rng, next, effect.rarity, bossesBeaten, effect.cls);
        next = addFighter(next, fighter, effect.hp ?? 1);
        lines.push(`${capitalized(aOrAn(fighterLabel(fighter.cls, fighter.rarity, fighter.faction)))} joins your army${effect.hp !== undefined && effect.hp < 1 ? `, at ${percent(effect.hp)} HP` : ''}.`);
      }
      return { run: next, lines };
    }
    case 'loseFighter': {
      if (run.roster.length < 2) return { run, lines: [] };
      const gone = effect.which === 'random' ? pick(rng, run.roster) : [...run.roster].sort((a, b) => a.hp - b.hp || a.id - b.id)[0]!;
      return { run: removeFighter(run, gone.id), lines: [`Your ${fighterLabel(gone.cls, gone.rarity, gone.faction)} leaves the army.`] };
    }
    case 'upgrade': {
      const able = run.roster.filter((f) => rarityAbove(f.rarity) !== null);
      if (able.length === 0) return { run, lines: [] };
      const lucky = pick(rng, able);
      const rarity = rarityAbove(lucky.rarity)!;
      // A rarer fighter has more perks: it gains one if its new rarity has room for it.
      const perks = rollPerks(rng, rarity, lucky.perks);
      const gained = perks.filter((p) => !lucky.perks.includes(p)).map((p) => PERKS[p].name);
      return {
        run: { ...run, roster: run.roster.map((f) => (f.id === lucky.id ? { ...f, rarity, perks } : f)) },
        lines: [
          `Your ${fighterLabel(lucky.cls, lucky.rarity, lucky.faction)} rises to ${RARITY_RULES[rarity].name}${gained.length > 0 ? ` and becomes ${gained.join(' and ')}` : ''}.`,
        ],
      };
    }
    case 'boon': {
      const offer = boonOfferOrNull(rng, run, effect.rarity);
      if (!offer) return { run: { ...run, gold: run.gold + 30 }, lines: ['You have every boon it could give: +30 gold instead.'] };
      return { run: { ...run, boons: [...run.boons, offer] }, lines: [`New boon: ${offerLabel({ kind: 'boon', boon: offer })} (${BOONS[offer].text}).`] };
    }
    case 'loseBoon': {
      if (run.boons.length === 0) return { run, lines: [] };
      const gone = pick(rng, run.boons);
      return { run: { ...run, boons: run.boons.filter((b) => b !== gone) }, lines: [`You give up ${BOONS[gone].name}.`] };
    }
    case 'artifact': {
      const found = newArtifact(rng, run, banked);
      if (!found) return { run: { ...run, gold: run.gold + 40 }, lines: ['You already have every artifact: +40 gold instead.'] };
      return { run: { ...run, artifacts: [...run.artifacts, found] }, lines: [`You find an artifact: ${ARTIFACTS[found].name}. Bank it at a camp to keep it.`] };
    }
  }
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
