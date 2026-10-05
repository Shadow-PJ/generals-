// What waits at a run's node, other than a fight: the spoils after a won fight, an event's hard
// choice, the merchant, a rest camp, and the end of the run. Each shows a little text and a list
// of options. ↑↓ (or Tab) pick an option, Enter takes it, Esc leaves when you may.

import Phaser from 'phaser';
import { fighterLabel, offerLabel, offerText } from '../../campaign/describe';
import { oathGold } from '../../campaign/oaths';
import { offerRarity } from '../../campaign/offers';
import {
  buy,
  buyProblem,
  chooseEvent,
  closeRun,
  eventChoiceProblem,
  healAtMerchant,
  healProblem,
  leaveStop,
  merchantPrices,
  pickSpoils,
  reroll,
  rerollProblem,
  toggleKeep,
} from '../../campaign/run';
import { veteranRank } from '../../campaign/company';
import type { Campaign, Offer, RunState, Stop } from '../../campaign/types';
import { ARTIFACTS } from '../../data/artifacts';
import { EVENTS } from '../../data/events';
import { FACTIONS } from '../../data/factions';
import { GENERALS } from '../../data/generals';
import { LEGENDARY_ACTION_DATA } from '../../data/legendary';
import { REGIONS } from '../../data/regions';
import { RUN_RULES } from '../../data/runs';
import { TROOP_NAMES } from '../../data/units';
import { COMPANY_RULES } from '../../data/veterans';
import { keyLabel } from '../bindings';
import { drawBoon, drawFighter, runFloor, runNumbers } from '../campaignUi';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { currentCampaign, saveCampaign } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT } from '../theme';
import { textStyle } from '../ui';

const ROW_X = 110;
const ROW_W = GAME_WIDTH - 2 * ROW_X;
const ROW_H = 48;
const ROW_GAP = 6;
const COMPACT_H = 26;

interface Option {
  label: string;
  detail: string;
  labelColor?: string;
  /** On the right: a price, or why it can't be taken. */
  note?: string;
  /** Why it can't be taken now; null when it can. */
  problem: string | null;
  icon?: Offer | null;
  /** A small row, two to a line, for long lists (who stays in your company), with its detail on the right in this color. */
  compact?: boolean;
  detailColor?: string;
  act: () => void;
}

interface View {
  title: string;
  titleColor: string;
  lines: { text: string; color?: string; bold?: boolean }[];
  options: Option[];
  /** What Esc does, if anything. */
  leave?: () => void;
}

/** What an offer gives, and for a fighter of a faction how many of it your run has already. */
function offerDetail(run: RunState, offer: Offer): string {
  const text = offerText(offer);
  if (offer.kind !== 'fighter' || !offer.faction) return text;
  const have = run.roster.filter((f) => f.faction === offer.faction).length;
  return `${text} ${FACTIONS[offer.faction].name} in your run: ${have}.`;
}

export class StopScene extends Phaser.Scene {
  private selected = 0;
  private message = '';
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Stop');
  }

  init(): void {
    this.selected = 0;
    this.message = '';
  }

  create(): void {
    fitCamera(this);
    this.ui = this.add.container(0, 0);
    new InputLayer(this)
      .on('up', () => this.move(-1))
      .on('prev', () => this.move(-1))
      .on('down', () => this.move(1))
      .on('next', () => this.move(1))
      .on('confirm', () => this.take(this.selected))
      .on('back', () => this.view()?.leave?.());
    if (this.route()) this.render();
  }

  /** Sends you where you belong when there is nothing for this screen to show. Returns true to stay. */
  private route(): boolean {
    const run = currentCampaign().run;
    if (!run) this.scene.start('Capital');
    else if (!run.stop) this.scene.start('Run');
    else if (run.stop.kind === 'fight') this.scene.start('Army');
    else return true;
    return false;
  }

  private move(step: number): void {
    const options = this.view()?.options ?? [];
    if (options.length === 0) return;
    this.selected = (this.selected + step + options.length) % options.length;
    this.render();
  }

  private take(i: number): void {
    const option = this.view()?.options[i];
    if (!option || option.problem) return;
    option.act();
  }

  /** Saves the campaign after a choice, then shows what comes next. */
  private step(next: Campaign, then: 'stay' | 'Run' | 'Capital'): void {
    void saveCampaign(next).catch(() => undefined);
    if (then === 'stay') {
      this.render();
      return;
    }
    this.scene.start(then);
  }

  private view(): View | null {
    const campaign = currentCampaign();
    const run = campaign.run;
    if (!run?.stop) return null;
    const stop = run.stop;
    switch (stop.kind) {
      case 'spoils':
        return this.spoils(campaign, run, stop);
      case 'event':
        return this.event(campaign, run, stop);
      case 'merchant':
        return this.merchant(campaign, run, stop);
      case 'camp':
        return this.camp(campaign, stop);
      case 'end':
        return this.end(campaign, run, stop);
      case 'fight':
        return null;
    }
  }

  private spoils(campaign: Campaign, run: RunState, stop: Extract<Stop, { kind: 'spoils' }>): View {
    const lines: View['lines'] = [{ text: `+${stop.gold} gold. You have ${run.gold}.`, color: TEXT.gold, bold: true }];
    if (stop.artifact) {
      lines.push({ text: `You found an artifact: ${ARTIFACTS[stop.artifact].name}. Bank it at a rest camp, or win the run, to keep it.`, color: TEXT.gold });
    }
    lines.push({ text: 'Pick one. Fighters join your army and boons last the rest of the run.', color: TEXT.muted });
    return {
      title: 'VICTORY · SPOILS',
      titleColor: TEXT.victory,
      lines,
      options: [
        ...stop.offers.map((offer, i) => ({
          label: offerLabel(offer),
          labelColor: TEXT.rarity[offerRarity(offer)],
          detail: offerDetail(run, offer),
          icon: offer,
          problem: null,
          act: () => this.step(pickSpoils(campaign, i), 'Run'),
        })),
        { label: 'Skip the pick', detail: `Take ${oathGold(RUN_RULES.skipGold, run.oaths)} more gold instead.`, problem: null, act: () => this.step(pickSpoils(campaign, null), 'Run') },
      ],
    };
  }

  private event(campaign: Campaign, run: RunState, stop: Extract<Stop, { kind: 'event' }>): View {
    const event = EVENTS[stop.event];
    if (stop.chosen === null) {
      return {
        title: event.title.toUpperCase(),
        titleColor: TEXT.title,
        lines: [{ text: event.story }, { text: `You have ${run.gold} gold.`, color: TEXT.muted }],
        options: event.choices.map((choice, i) => {
          const problem = eventChoiceProblem(run, i);
          return { label: choice.label, detail: choice.text, note: problem ?? undefined, problem, act: () => this.step(chooseEvent(campaign, i), 'stay') };
        }),
      };
    }
    const leave = () => this.step(leaveStop(campaign), 'Run');
    return {
      title: event.title.toUpperCase(),
      titleColor: TEXT.title,
      lines: [
        { text: event.story, color: TEXT.muted },
        { text: `You chose: ${event.choices[stop.chosen]!.label}.`, bold: true },
        ...stop.outcome.map((text) => ({ text, color: TEXT.perfect })),
      ],
      options: [{ label: 'Carry on', detail: 'Back to the map.', problem: null, act: leave }],
      leave,
    };
  }

  private merchant(campaign: Campaign, run: RunState, stop: Extract<Stop, { kind: 'merchant' }>): View {
    const prices = merchantPrices(run);
    const leave = () => this.step(leaveStop(campaign), 'Run');
    const heal = healProblem(run);
    const again = rerollProblem(run);
    return {
      title: 'MERCHANT',
      titleColor: TEXT.gold,
      lines: [
        { text: `You have ${run.gold} gold.`, color: TEXT.gold, bold: true },
        { text: this.message || 'Fighters and boons for gold, priced by rarity. Buy as many as you can pay for.', color: this.message ? TEXT.perfect : TEXT.muted },
      ],
      options: [
        ...stop.stock.map((item, i) => {
          const problem = buyProblem(run, i);
          return {
            label: offerLabel(item.offer),
            labelColor: TEXT.rarity[offerRarity(item.offer)],
            detail: offerDetail(run, item.offer),
            note: item.sold ? 'Sold' : `${item.price} gold`,
            icon: item.offer,
            problem,
            act: () => {
              this.message = `Bought: ${offerLabel(item.offer)}.`;
              this.step(buy(campaign, i), 'stay');
            },
          };
        }),
        {
          label: 'Heal your army',
          detail: 'Every fighter back to full HP.',
          note: heal === 'Nobody is hurt' ? heal : `${prices.heal} gold`,
          problem: heal,
          act: () => {
            this.message = 'Your army is healed.';
            this.step(healAtMerchant(campaign), 'stay');
          },
        },
        {
          label: 'New stock',
          detail: 'Everything above is replaced. Each new stock costs more.',
          note: `${prices.reroll} gold`,
          problem: again,
          act: () => {
            this.message = 'A new stock.';
            this.step(reroll(campaign), 'stay');
          },
        },
        { label: 'Leave', detail: 'Back to the map.', problem: null, act: leave },
      ],
      leave,
    };
  }

  private camp(campaign: Campaign, stop: Extract<Stop, { kind: 'camp' }>): View {
    const leave = () => this.step(leaveStop(campaign), 'Run');
    const banked = stop.banked.map((a) => ARTIFACTS[a].name);
    return {
      title: 'REST CAMP',
      titleColor: TEXT.victory,
      lines: [
        { text: `Your army rests: every fighter heals ${Math.round(stop.healed * 100)}% of their HP.`, bold: true },
        banked.length > 0
          ? { text: `Banked for good: ${banked.join(', ')}. They are yours whatever happens to this run.`, color: TEXT.gold }
          : { text: 'You carry no artifacts to bank.', color: TEXT.muted },
      ],
      options: [{ label: 'Carry on', detail: 'Back to the map.', problem: null, act: leave }],
      leave,
    };
  }

  private end(campaign: Campaign, run: RunState, stop: Extract<Stop, { kind: 'end' }>): View {
    const leave = () => this.step(closeRun(campaign), 'Capital');
    const region = REGIONS[run.region];
    const lines: View['lines'] = [];
    const names = (ids: readonly number[]) => ids.flatMap((id) => run.roster.filter((f) => f.id === id).map((f) => f.name)).join(', ');
    if (stop.won) {
      lines.push({ text: `You beat ${GENERALS[region.ruler].name} and won the run through ${region.name}.`, bold: true });
      if (stop.learned) {
        // A first win over a ruler recruits them and teaches their Legendary action, together.
        const action = LEGENDARY_ACTION_DATA[stop.learned];
        lines.push({ text: `${GENERALS[action.teacher].name} joins you: lead with them from the General screen (G) in the Capital.`, color: TEXT.victory });
        lines.push({ text: `Learned ${action.name}: ${action.text}. Put it on a card in your Legendary slot (5).`, color: TEXT.combo });
      }
      if (stop.unlocked) lines.push({ text: `Runs can now offer ${TROOP_NAMES[stop.unlocked].many}.`, color: TEXT.combo });
      for (const id of stop.opened) lines.push({ text: `A new region is open: ${REGIONS[id].name}.`, color: TEXT.perfect });
      if (stop.banked.length > 0) lines.push({ text: `Banked for good: ${stop.banked.map((a) => ARTIFACTS[a].name).join(', ')}.`, color: TEXT.gold });
    } else {
      lines.push({ text: `Your run through ${region.name} ended on ${runFloor(run).toLowerCase()}.`, bold: true });
      if (stop.lost.length > 0) lines.push({ text: `Lost with the run: ${stop.lost.map((a) => ARTIFACTS[a].name).join(', ')}.`, color: TEXT.defeat });
      if (stop.died.length > 0) lines.push({ text: `Ironman: ${names(stop.died)} fell for good.`, color: TEXT.defeat });
      lines.push({ text: 'Your company comes home with what it learned; the run’s newcomers, boons and gold were for this run only.', color: TEXT.muted });
    }
    lines.push({ text: `Fights won: ${run.fightsWon}  ·  Command XP: ${run.xp}  ·  Insight: ${run.insight} (you keep both)`, color: TEXT.body });
    // Oaths of Command (session 5F): the run's Fear, and the bounty for a new highest Fear won here.
    if (stop.fear > 0 || stop.bounty > 0) {
      const bounty = stop.bounty > 0 ? `: a new highest for ${region.name}, worth ${stop.bounty} more Insight` : '';
      lines.push({ text: `Fear ${stop.fear}${bounty}.`, color: TEXT.threat, bold: stop.bounty > 0 });
    }
    const back: Option = { label: 'Back to the Capital', detail: stop.won ? 'Your company is the fighters marked to stay.' : 'Set out again when you are ready.', problem: null, act: leave };
    if (!stop.won) return { title: 'RUN OVER', titleColor: TEXT.defeat, lines, options: [back], leave };

    // A won run: choose who stays in your company. Enter (or a click) on a fighter switches it.
    lines.push({ text: `WHO STAYS IN YOUR COMPANY: ${stop.keep.length} of ${COMPANY_RULES.size}. The rest leave after the run.`, color: TEXT.title, bold: true });
    const fighters: Option[] = run.roster.map((f) => {
      const stays = stop.keep.includes(f.id);
      return {
        label: `${f.name} · ${fighterLabel(f.cls, f.rarity, f.faction)} · ${veteranRank(f.record).name}`,
        labelColor: TEXT.rarity[f.rarity],
        detail: stays ? 'Stays' : 'Leaves',
        detailColor: stays ? TEXT.victory : TEXT.muted,
        problem: null,
        compact: true,
        act: () => this.step(toggleKeep(campaign, f.id), 'stay'),
      };
    });
    return { title: 'REGION CLEARED!', titleColor: TEXT.victory, lines, options: [...fighters, back], leave };
  }

  private render(): void {
    this.ui.removeAll(true);
    const view = this.view();
    const run = currentCampaign().run;
    if (!view || !run) return;
    if (this.selected >= view.options.length) this.selected = 0;
    const g = this.add.graphics();
    this.ui.add(g);
    const cx = GAME_WIDTH / 2;
    let y = 22;
    this.ui.add(this.add.text(cx, y, view.title, textStyle(28, view.titleColor, true)).setOrigin(0.5, 0));
    y += 40;
    this.ui.add(this.add.text(cx, y, `${REGIONS[run.region].name} · ${runFloor(run)}`, textStyle(12, TEXT.muted, true)).setOrigin(0.5, 0));
    y += 26;
    for (const line of view.lines) {
      const t = this.add.text(cx, y, line.text, { ...textStyle(14, line.color ?? TEXT.body, line.bold ?? false), wordWrap: { width: ROW_W }, align: 'center' });
      this.ui.add(t.setOrigin(0.5, 0));
      y += t.height + 6;
    }
    y += 10;
    let column = 0;
    view.options.forEach((option, i) => {
      const on = i === this.selected;
      const dim = option.problem ? 0.45 : 1;
      if (option.compact) {
        // Two to a line: the label on the left, the detail on the right.
        const w = (ROW_W - ROW_GAP) / 2;
        const x = ROW_X + column * (w + ROW_GAP);
        const box = this.add.rectangle(x, y, w, COMPACT_H, on ? COLORS.rowSelected : COLORS.row).setOrigin(0);
        box.setStrokeStyle(on ? 2 : 1, on ? COLORS.selected : COLORS.rowEdge).setInteractive({ useHandCursor: true });
        box.on('pointerdown', () => (this.selected === i ? this.take(i) : ((this.selected = i), this.render())));
        const label = this.add.text(x + 10, y + COMPACT_H / 2, option.label, textStyle(12, option.labelColor ?? TEXT.title, true)).setOrigin(0, 0.5);
        const detail = this.add.text(x + w - 10, y + COMPACT_H / 2, option.detail, textStyle(12, option.detailColor ?? TEXT.body, true)).setOrigin(1, 0.5);
        this.ui.add([box, label, detail]);
        column = (column + 1) % 2;
        if (column === 0 || !view.options[i + 1]?.compact) y += COMPACT_H + 4;
        if (!view.options[i + 1]?.compact) {
          column = 0;
          y += 6;
        }
        return;
      }
      const textX = ROW_X + (option.icon ? 52 : 16);
      // The detail wraps, leaving room for the price; a long one makes its row taller.
      const label = this.add.text(textX, y + 6, option.label, textStyle(15, option.labelColor ?? TEXT.title, true)).setAlpha(dim);
      const detail = this.add.text(textX, y + 27, option.detail, { ...textStyle(12, TEXT.body), wordWrap: { width: ROW_X + ROW_W - 110 - textX } }).setAlpha(dim);
      const h = Math.max(ROW_H, detail.height + 34);
      const box = this.add.rectangle(ROW_X, y, ROW_W, h, on ? COLORS.rowSelected : COLORS.row).setOrigin(0);
      box.setStrokeStyle(on ? 2 : 1, on ? COLORS.selected : COLORS.rowEdge).setInteractive({ useHandCursor: !option.problem });
      box.on('pointerdown', () => (this.selected === i ? this.take(i) : ((this.selected = i), this.render())));
      this.ui.add([box, label, detail]);
      if (option.icon?.kind === 'fighter') drawFighter(g, option.icon.cls, option.icon.rarity, ROW_X + 26, y + h / 2, 1, dim, 'player', option.icon.faction);
      else if (option.icon?.kind === 'boon') drawBoon(g, option.icon.boon, ROW_X + 26, y + h / 2);
      if (option.note) {
        const color = option.problem ? TEXT.defeat : TEXT.gold;
        this.ui.add(this.add.text(ROW_X + ROW_W - 14, y + h / 2, option.note, textStyle(13, color, true)).setOrigin(1, 0.5));
      }
      y += h + ROW_GAP;
    });
    // The icons go over the option rows.
    this.ui.bringToTop(g);
    const help = `↑↓ pick, ${keyLabel('confirm')}: take it${view.leave ? `, ${keyLabel('back')}: leave` : ''}`;
    this.ui.add(this.add.text(cx, Math.max(y + 4, GAME_HEIGHT - 58), help, textStyle(12, TEXT.muted)).setOrigin(0.5, 0));
    if (run.stop?.kind !== 'end') {
      this.ui.add(this.add.text(cx, GAME_HEIGHT - 32, runNumbers(run), textStyle(13, TEXT.body, true)).setOrigin(0.5, 0));
    }
  }
}
