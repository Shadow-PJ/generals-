// Takes the store page's screenshots from the built game (session 7H), at 1920 × 1080 with the
// Captain's tips off, following docs/store/screenshots.md. Each shot starts from a save made
// here from the campaign's own rules: a run under way, a ruler's fight, a crossroads, the road
// on past the last ruler. Battle moments come as a few candidates to choose from.
//
//   npm run build
//   npm run store:shots -- [--out store-shots]

import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { parseOrder } from '../../src/cards/parser';
import type { Card } from '../../src/cards/types';
import { newCampaign } from '../../src/campaign/company';
import { chooseEvent, enterNode, finishFight, leaveStop, newRun, pickSpoils, takeDeal, takeDecree } from '../../src/campaign/run';
import type { Campaign } from '../../src/campaign/types';
import { BOSS_ORDER } from '../../src/data/legendary';
import { RANK_XP } from '../../src/data/progression';
import { openRegions, REGION_IDS, REGIONS, type RegionId } from '../../src/data/regions';
import { newProfile, writeProfile, type Profile } from '../../src/save/profile';
import { argValue, launchGame, press, topScene, waitForScene } from './launch';

const out = argValue('out') ?? 'store-shots';
const WIDTH = 1920;
const HEIGHT = 1080;
const WON = { won: true, fighters: [], xp: 50 };
/** How long a still screen gets to settle before its shot. */
const SETTLE_MS = 2000;

/** Orders for the slots after the starter two, in plain words, as a player would write them. */
const ORDERS = ['Vanguards charge their Rangers', 'When an ally is below 40% HP, call the reserves'];

function card(text: string): Card {
  const result = parseOrder(text);
  if (!result.ok) throw new Error(`The parser can't read "${text}"`);
  return result.card;
}

/** A Legend's save with every ruler beaten and full card slots: the shots show the whole game. */
function baseProfile(): Profile {
  const profile = newProfile();
  profile.xp = RANK_XP[5];
  profile.bossesBeaten = [...BOSS_ORDER];
  profile.general = 'warlord';
  profile.map = 'deepForest';
  profile.tutorial = { on: false, seen: [] };
  ORDERS.forEach((text, i) => (profile.loadout.slots[2 + i] = card(text)));
  return profile;
}

function save(campaign: Campaign, bossesBeaten = campaign.bossesBeaten): string {
  const profile = baseProfile();
  return writeProfile({ ...profile, ...campaign, bossesBeaten } as Profile);
}

/** Clears whatever stop waits after a node, the quickest way: wins its fight, takes the first of everything. */
function clearStop(c: Campaign): Campaign {
  for (let i = 0; i < 6 && c.run?.stop; i++) {
    const stop = c.run.stop;
    if (stop.kind === 'fight') c = finishFight(c, WON);
    else if (stop.kind === 'spoils') c = pickSpoils(c, 0);
    else if (stop.kind === 'decree') c = takeDecree(c, null, 5);
    else if (stop.kind === 'crossroads') c = stop.chosen === null ? takeDeal(c, 0) : leaveStop(c);
    else if (stop.kind === 'event') c = stop.chosen === null ? chooseEvent(c, 0) : leaveStop(c);
    else if (stop.kind === 'endless' || stop.kind === 'end') break;
    else c = leaveStop(c);
  }
  return c;
}

/** Walks a run's map for this many floors on the first path, clearing each stop. */
function walk(c: Campaign, floors: number): Campaign {
  for (let f = 0; f < floors; f++) {
    const run = c.run!;
    const index = run.path.length === 0 ? 0 : run.map[run.path.length - 1]![run.path.at(-1)!]!.next[0]!;
    c = clearStop(enterNode(c, index));
  }
  return c;
}

/** A run under way in the region the next ruler holds, with a few fights won. */
function midRun(): { profile: string; region: RegionId } {
  const beaten = BOSS_ORDER.slice(0, 2);
  const region = openRegions(beaten).find((id) => !beaten.includes(REGIONS[id].ruler)) ?? REGION_IDS[0];
  const c = walk(newRun(newCampaign([...beaten]), region, 11), 3);
  return { profile: save(c), region };
}

/** A run one step from its ruler. */
function atRuler(): string {
  const c = newRun(newCampaign([...BOSS_ORDER]), 'ironFortress', 23);
  return save(walk(c, c.run!.map.length - 1));
}

/** A run whose next battle is a crossroads, won: the two deals wait. */
function atCrossroads(): string {
  for (let seed = 1; seed < 400; seed++) {
    let c = newRun(newCampaign([...BOSS_ORDER]), 'voidRuins', seed);
    const map = c.run!.map;
    const first = map[0]!.findIndex((n) => n.next.some((j) => map[1]![j]!.crossroads));
    if (first < 0) continue;
    c = clearStop(enterNode(c, first));
    c = finishFight(enterNode(c, map[0]![first]!.next.find((j) => map[1]![j]!.crossroads)!), WON);
    if (c.run?.stop?.kind === 'crossroads') return save(c);
  }
  throw new Error('No crossroads found');
}

/** A run that has just beaten its ruler with every ruler fallen: the road goes on. */
function atRoadOn(): string {
  const c = newRun(newCampaign(BOSS_ORDER.filter((g) => g !== REGIONS.redCanyon.ruler)), 'redCanyon', 31);
  return save(walk(c, c.run!.map.length));
}

type BattleHook = { __smoke: { battle(): { ultimates: number; combos: number; result: unknown } | null } };

async function battleState(page: Page) {
  return page.evaluate(() => (globalThis as unknown as BattleHook).__smoke.battle());
}

async function main(): Promise<void> {
  mkdirSync(out, { recursive: true });
  let n = 0;
  /** A still screen gets a moment to finish fading in; a battle moment is taken at once. */
  const shoot = async (page: Page, name: string, settleMs = 0) => {
    await page.waitForTimeout(settleMs);
    const file = `${out}/${String(++n).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: file });
    console.log('  ', file);
  };
  /** Opens the game from this save and gets past the title. */
  const open = async (profile: string) => {
    const game = await launchGame({ width: WIDTH, height: HEIGHT, profile });
    await press(game.page, 'Enter', 1500);
    await waitForScene(game.page, 'Capital');
    return game;
  };
  const errors: string[] = [];

  // A skirmish: the skirmish screen, the orders, the battle's big moments and the result.
  console.log('Skirmish');
  let game = await open(save(newCampaign([...BOSS_ORDER])));
  let page = game.page;
  await press(page, 't', 1500);
  await shoot(page, 'prep', SETTLE_MS);
  await press(page, 'Enter', 1500);
  await shoot(page, 'orders', SETTLE_MS);
  await press(page, 'b', 2500);
  await waitForScene(page, 'Battle');
  await press(page, 'f', 300);
  let ultimates = 0;
  let combos = 0;
  let clash = 0;
  for (let i = 0; i < 400 && (await topScene(page)) === 'Battle'; i++) {
    await press(page, String((i % 4) + 1), 250);
    await press(page, 'u', 50);
    const state = await battleState(page);
    if (!state) continue;
    if (state.ultimates > ultimates && ultimates < 2) await shoot(page, `battle-ultimate-${ultimates + 1}`);
    if (state.combos > combos && combos < 3) await shoot(page, `battle-combo-${combos + 1}`);
    ultimates = state.ultimates;
    combos = state.combos;
    if (i % 20 === 10 && clash < 3) await shoot(page, `battle-clash-${++clash}`);
  }
  await page.waitForTimeout(1500);
  if ((await topScene(page)) === 'Result') await shoot(page, 'result', SETTLE_MS);
  errors.push(...game.errors);
  await game.close();

  console.log('Capital and run map');
  const mid = midRun();
  game = await open(mid.profile);
  page = game.page;
  await shoot(page, 'capital', SETTLE_MS);
  await press(page, 'Enter', 1500);
  await shoot(page, 'run-map', SETTLE_MS);
  await press(page, 'Escape', 1200);
  await press(page, 'm', 1500);
  await shoot(page, 'versus', SETTLE_MS);
  errors.push(...game.errors);
  await game.close();

  console.log('A ruler’s fight');
  game = await open(atRuler());
  page = game.page;
  await press(page, 'Enter', 1500);
  await press(page, 'Enter', 1500);
  await press(page, 'Enter', 1500);
  await press(page, 'Enter', 1500);
  await press(page, 'b', 1200);
  await waitForScene(page, 'Battle');
  await page.waitForTimeout(600);
  await shoot(page, 'ruler-banner');
  await press(page, 'f', 300);
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 8; k++) await press(page, String((k % 4) + 1), 500);
    await press(page, 'u', 300);
    if ((await topScene(page)) !== 'Battle') break;
    await shoot(page, `ruler-${i + 1}`);
  }
  errors.push(...game.errors);
  await game.close();

  for (const [name, profile] of [
    ['crossroads', atCrossroads()],
    ['road-on', atRoadOn()],
  ] as const) {
    console.log(name);
    game = await open(profile);
    await press(game.page, 'Enter', 1500);
    await press(game.page, 'Enter', 1500);
    await shoot(game.page, name, SETTLE_MS);
    errors.push(...game.errors);
    await game.close();
  }

  console.log(`\n${n} shots in ${out}/. Pick the best of each kind; see docs/store/screenshots.md.`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    for (const error of errors.slice(0, 10)) console.log('  ', error);
    process.exitCode = 1;
  }
}

await main();
