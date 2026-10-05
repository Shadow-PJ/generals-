// Words for the campaign's screens: fighters, their records, offers, node kinds and scouted fights.

import { BOONS } from '../data/boons';
import { FACTIONS, type FactionId } from '../data/factions';
import { GENERALS } from '../data/generals';
import { rankRules } from '../data/ranks';
import { PERKS, type PerkId } from '../data/perks';
import { RARITY_RULES, type Rarity } from '../data/rarity';
import type { NodeKind } from '../data/runs';
import { TROOP_NAMES, type TroopClass } from '../data/units';
import { veteranRank } from './company';
import type { Encounter, FighterRecord, Offer } from './types';

/** "Rare Hive Ranger"; a Common fighter of no faction is just "Ranger". */
export function fighterLabel(cls: TroopClass, rarity: Rarity, faction: FactionId | null = null): string {
  const parts = [rarity === 'common' ? '' : RARITY_RULES[rarity].name, faction ? FACTIONS[faction].name : '', TROOP_NAMES[cls].one];
  return parts.filter((p) => p !== '').join(' ');
}

/** "Tough (15% more HP), Leech (heals 10% of the damage its attacks deal)", or '' for none. */
export function perksText(perks: readonly PerkId[]): string {
  return perks.map((p) => `${PERKS[p].name} (${PERKS[p].text})`).join(', ');
}

/** "Veteran · 5 battles, 3 kills (1 in boss fights)". */
export function recordText(record: FighterRecord): string {
  const kills = `${record.kills} kill${record.kills === 1 ? '' : 's'}${record.bossKills > 0 ? ` (${record.bossKills} in boss fights)` : ''}`;
  return `${veteranRank(record).name} · ${record.battles} battle${record.battles === 1 ? '' : 's'}, ${kills}`;
}

/** The offer's name: "Epic Bloodbound Vanguard", "Supply Lines", "Blood Forge · Duo". */
export function offerLabel(offer: Offer): string {
  if (offer.kind === 'fighter') return fighterLabel(offer.cls, offer.rarity, offer.faction);
  return BOONS[offer.boon].duo ? `${BOONS[offer.boon].name} · Duo` : BOONS[offer.boon].name;
}

/** What the offer gives, in a line: "Epic fighter, 20% more HP and damage. Fierce (12% more damage)." */
export function offerText(offer: Offer): string {
  if (offer.kind === 'boon') {
    const boon = BOONS[offer.boon];
    if (boon.duo) return `Duo boon for the run, ${FACTIONS[boon.duo[0]].name} and ${FACTIONS[boon.duo[1]].name}: ${boon.text}.`;
    return `${RARITY_RULES[boon.rarity].name} boon for the run: ${boon.text}.`;
  }
  const bonus = RARITY_RULES[offer.rarity].statBonus;
  const parts = [`${RARITY_RULES[offer.rarity].name} fighter${bonus > 0 ? `, ${Math.round(bonus * 100)}% more HP and damage` : ''}`];
  if (offer.perks.length > 0) parts.push(perksText(offer.perks));
  if (!offer.faction) parts.push('No faction');
  return `${parts.join('. ')}.`;
}

export const NODE_NAMES: Readonly<Record<NodeKind, string>> = {
  battle: 'Battle',
  elite: 'Elite fight',
  event: 'Event',
  merchant: 'Merchant',
  camp: 'Rest camp',
  boss: 'Boss',
};

export const NODE_TEXT: Readonly<Record<NodeKind, string>> = {
  battle: 'A fight. Win it for gold and a pick of the spoils.',
  elite: 'A hard fight: a stronger commander and rarer troops. Win it for more gold and an artifact.',
  event: 'Something happens on the road, and you choose what to do about it.',
  merchant: 'Buy fighters and boons, heal your army, or reroll the stock.',
  camp: 'Your army rests and heals, and the artifacts you carry are banked for good.',
  boss: 'The ruler of the region. Beat them to win the run.',
};

/**
 * A fight scouted on the run map (session 5F): "The Hive Mother's army: 5 troops and 2 in
 * reserve, 1 Epic and 2 Rare · commander Rank II".
 */
export function scoutText(encounter: Encounter): string {
  const all = [...encounter.troops.filter((t) => !t.turret), ...encounter.reserves];
  const count = (r: Rarity) => all.filter((t) => t.rarity === r).length;
  const rarer = (['legendary', 'epic', 'rare'] as const).filter((r) => count(r) > 0).map((r) => `${count(r)} ${RARITY_RULES[r].name}`);
  const field = encounter.troops.filter((t) => !t.turret).length;
  const reserves = encounter.reserves.length > 0 ? ` and ${encounter.reserves.length} in reserve` : '';
  const turrets = encounter.troops.length - field;
  const commander = encounter.commander === null ? 'no commander: no cards or ultimate' : `commander Rank ${rankRules(encounter.commander).numeral}`;
  return [
    `${GENERALS[encounter.general].name}'s army: ${field} troops${reserves}${rarer.length > 0 ? `, ${rarer.join(' and ')}` : ''}${turrets > 0 ? `, ${turrets} turrets` : ''}`,
    commander,
  ].join('  ·  ');
}
