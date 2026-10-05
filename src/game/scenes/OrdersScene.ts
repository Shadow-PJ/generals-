// Writing orders: each slot holds one Command card. Type or speak an order (hold V to talk) and
// the translators turn it into a card, or build one from the menus. The validator checks it against your rank, then your
// General reads it by their personality rules and answers. Slots keep the card as you wrote it;
// the General's version is what fires. Rephrasing is free. Slot 5, the Legendary slot, opens
// with your first boss win and takes a card with one Legendary action you have learned.

import Phaser from 'phaser';
import { cardCost } from '../../cards/cost';
import { describeCard, describeCondition } from '../../cards/describe';
import { translateOrder } from '../../cards/translator';
import { applyPersonality, type Reading } from '../../cards/personality';
import { generalReply, reply, replyToVerdict } from '../../cards/replies';
import { REGULAR_ACTIONS, type ActionName, type Card, type LegendaryAction } from '../../cards/types';
import { slotUnlockRank, validateCard, type SlotContext } from '../../cards/validator';
import { TRANSLATOR_RULES } from '../../data/cards';
import { recruitedGenerals } from '../../data/bosses';
import { GENERALS } from '../../data/generals';
import { LEGENDARY_ACTION_DATA, learnedActions } from '../../data/legendary';
import { rankRules } from '../../data/ranks';
import { keyLabel } from '../bindings';
import { builderRows, defaultStep, newDraft, type BuilderRow } from '../cardBuilder';
import { CaptainTips } from '../captain';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { orderModelState, orderModelTranslator } from '../orderModel';
import { orderReaderTranslator } from '../orderReader';
import type { MatchSetup } from '../match';
import { newSeed } from '../seed';
import { rankProgress } from '../progress';
import { currentPlatform, currentXp, remember, savedSetup } from '../session';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { sceneTips } from '../tutorial';
import { addButton, textStyle } from '../ui';
import { PushToTalk, VOICE_MESSAGES } from '../voice';

const SLOT_COUNT = 4;
/** Slot 5 (index 4): the Legendary slot. */
const LEGENDARY = 4;
const SLOT_X = 16;
const SLOT_W = 296;
const SLOT_H = 84;
const PANEL_X = 332;
const ROWS_Y = 268;
const ROW_H = 20;
/** Fixed rows above the card's menus: Tactical mode, the General switch and the typed order. */
const TACTICAL_ROW = 0;
const GENERAL_ROW = 1;
const TEXT_ROW = 2;
const FIRST_MENU_ROW = 3;

export class OrdersScene extends Phaser.Scene {
  private setup!: MatchSetup;
  /** One draft per slot, so switching slots keeps unsaved edits. */
  private drafts: Card[] = [];
  private slot = 0;
  private row = FIRST_MENU_ROW;
  private status = { text: '', color: TEXT.muted as string };
  private ui!: Phaser.GameObjects.Container;
  private orderInput!: HTMLInputElement;
  /** True while an order is being translated, so Enter twice doesn't start a second one. */
  private translating = false;
  /** Speaking orders: hold the talk key or the Talk button. */
  private voice!: PushToTalk;

  constructor() {
    super('Orders');
  }

  init(data: Partial<MatchSetup>): void {
    this.setup = { ...savedSetup(), ...data };
    const legendary = this.setup.loadout.legendary;
    this.drafts = [
      ...this.setup.loadout.slots.map((card) => (card ? structuredClone(card) : newDraft())),
      legendary ? structuredClone(legendary) : this.newLegendaryDraft(),
    ];
    this.slot = 0;
    this.row = FIRST_MENU_ROW;
    this.status = { text: '', color: TEXT.muted };
  }

  create(): void {
    fitCamera(this);
    const platform = currentPlatform();
    this.voice = new PushToTalk(
      platform.speech,
      {
        onWords: (text) => {
          this.orderInput.value = text;
        },
        onOrder: (text) => {
          this.orderInput.value = text;
          void this.translate();
        },
        onStatus: (text, problem) => {
          this.status = { text, color: problem ? TEXT.defeat : TEXT.muted };
          this.render();
        },
      },
      platform.kind === 'desktop' ? VOICE_MESSAGES.noSpeechInApp : VOICE_MESSAGES.noSpeechInBrowser,
    );
    this.events.once('shutdown', () => this.voice.cancel());

    this.add.rectangle(0, 0, GAME_WIDTH, TOP_BAR_HEIGHT, COLORS.background).setOrigin(0);
    this.add.text(16, 10, 'WRITE YOUR ORDERS', textStyle(18, TEXT.title, true));
    const talkHint = this.voice.available ? ` Hold ${keyLabel('talk')} to speak an order.` : '';
    this.add.text(
      16,
      38,
      `↑↓ pick a line, ←→ change it, Enter saves to the slot, Tab switches slots.${talkHint}`,
      textStyle(12, TEXT.muted),
    );

    this.orderInput = document.createElement('input');
    Object.assign(this.orderInput, {
      type: 'text',
      maxLength: 200,
      placeholder: 'e.g. When their Assassin dives, protect my Ranger, then everyone focus him',
    });
    Object.assign(this.orderInput.style, {
      width: '320px',
      height: '28px',
      padding: '0 8px',
      font: `13px ${FONT}`,
      color: '#e5e7eb',
      background: '#0f141c',
      border: '1px solid #50627c',
      borderRadius: '3px',
      outline: 'none',
    });
    this.add.dom(PANEL_X + 54, 96, this.orderInput).setOrigin(0, 0.5);
    this.orderInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void this.translate();
      if (event.key === 'Escape') this.orderInput.blur();
      event.stopPropagation();
    });
    this.syncOrderText();
    this.orderInput.addEventListener('focus', () => {
      this.row = TEXT_ROW;
      this.render();
    });
    // Hold to talk: the press starts listening, letting go anywhere stops it.
    addButton(this, PANEL_X + 436, 96, `Talk  ${keyLabel('talk')}`, () => this.voice.press(), 72, 28);
    this.input.on('pointerup', () => this.voice.release());
    this.input.on('pointerupoutside', () => this.voice.release());
    addButton(this, GAME_WIDTH - 66, 96, 'Translate  ⏎', () => void this.translate(), 100, 28);

    addButton(this, SLOT_X + 72, GAME_HEIGHT - 34, '◀ Troops  Esc', () => this.backToTroops(), 140, 32);
    addButton(this, SLOT_X + 224, GAME_HEIGHT - 34, 'Start battle  B', () => this.startBattle(), 150, 32);
    addButton(this, GAME_WIDTH - 236, GAME_HEIGHT - 34, 'Save to slot  ⏎', () => this.save(), 150, 32);
    addButton(this, GAME_WIDTH - 82, GAME_HEIGHT - 34, 'Clear slot  Del', () => this.clear(), 140, 32);

    this.ui = this.add.container(0, 0);

    new InputLayer(this)
      .on('up', () => this.moveRow(-1))
      .on('down', () => this.moveRow(1))
      .on('left', () => this.change(-1))
      .on('right', () => this.change(1))
      .on('next', () => this.selectSlot(this.slot + 1))
      .on('prev', () => this.selectSlot(this.slot - 1))
      .on('confirm', () => (this.row === TEXT_ROW ? this.orderInput.focus() : this.save()))
      .on('clear', () => this.clear())
      .on('start', () => this.startBattle())
      .on('back', () => this.backToTroops())
      .on('talk', () => this.voice.press())
      .onRelease('talk', () => this.voice.release());

    this.render();
    new CaptainTips(this, { x: GAME_WIDTH - 476, width: 460, bottom: GAME_HEIGHT - 60 }).say(sceneTips('Orders'));
  }

  private get draft(): Card {
    return this.drafts[this.slot]!;
  }

  /** The Legendary actions you know; with one or more, the Legendary slot is open. */
  private get learned(): LegendaryAction[] {
    return learnedActions(this.setup.bossesBeaten);
  }

  private get legendaryOpen(): boolean {
    return this.learned.length > 0;
  }

  /** The slot the validator checks a card for. */
  private slotContext(slot = this.slot): SlotContext {
    return { legendarySlot: slot === LEGENDARY, learned: this.learned };
  }

  /** The actions the step menus offer: on the Legendary slot, also the Legendary actions you know. */
  private actions(): readonly ActionName[] {
    return this.slot === LEGENDARY ? [...this.learned, ...REGULAR_ACTIONS] : REGULAR_ACTIONS;
  }

  /** A fresh Legendary card: the first Legendary action you know, or Echo before you know any. */
  private newLegendaryDraft(): Card {
    const action = learnedActions(this.setup.bossesBeaten)[0] ?? 'echo';
    return { condition: null, steps: [defaultStep(action, { kind: 'all' })], auto: false };
  }

  private savedCard(slot: number): Card | null {
    return slot === LEGENDARY ? this.setup.loadout.legendary : (this.setup.loadout.slots[slot] ?? null);
  }

  private set draft(card: Card) {
    this.drafts[this.slot] = card;
  }

  /** How your General reads a card in a slot; null until the card passes the validator. */
  private reading(card: Card, slot = this.slot): Reading | null {
    const { rank, general } = this.setup;
    const context = this.slotContext(slot);
    return validateCard(card, rank, context).ok ? applyPersonality(general, card, rank, context) : null;
  }

  /** "Warlord", for replies. */
  private get speaker(): string {
    return GENERALS[this.setup.general].name.replace(/^The /, '');
  }

  /** The card's menus, with the Strategist's suggested condition first when there is one. */
  private menuRows(): BuilderRow[] {
    const rows = builderRows(this.draft, this.actions());
    const suggestion = this.reading(this.draft)?.suggestion;
    if (!suggestion) return rows;
    // Accepting changes the card, so the words it was written from no longer match it.
    const { text: _words, ...card } = this.draft;
    const accept = { label: 'Accept the condition', card: { ...card, condition: suggestion } };
    return [{ id: 'suggestion', label: 'Strategist', choices: [{ label: 'Ignore', card: this.draft }, accept], index: 0 }, ...rows];
  }

  private moveRow(step: number): void {
    const last = FIRST_MENU_ROW + this.menuRows().length - 1;
    this.row = Math.max(TACTICAL_ROW, Math.min(last, this.row + step));
    this.render();
  }

  private change(step: number): void {
    if (this.row === TACTICAL_ROW) {
      this.setup.tactical = !this.setup.tactical;
      this.keep();
    } else if (this.row === GENERAL_ROW) {
      const generals = recruitedGenerals(this.setup.bossesBeaten);
      const i = generals.indexOf(this.setup.general);
      this.setup.general = generals[(i + step + generals.length) % generals.length]!;
      this.keep();
    } else if (this.row >= FIRST_MENU_ROW) {
      const r = this.menuRows()[this.row - FIRST_MENU_ROW];
      if (r) this.draft = r.choices[(((r.index + step) % r.choices.length) + r.choices.length) % r.choices.length]!.card;
      this.syncOrderText();
      // Rows can appear or vanish (a new step, a removed condition); stay on the same line number.
      this.row = Math.min(this.row, FIRST_MENU_ROW + this.menuRows().length - 1);
    }
    this.render();
  }

  private selectSlot(index: number): void {
    // Tab reaches the Legendary slot once it is open.
    const count = this.legendaryOpen ? SLOT_COUNT + 1 : SLOT_COUNT;
    this.slot = (index + count) % count;
    this.syncOrderText();
    this.status = { text: '', color: TEXT.muted };
    this.row = Math.min(this.row, FIRST_MENU_ROW + this.menuRows().length - 1);
    this.render();
  }

  /** The text box shows the words the card was written from; menu edits clear them, since they no longer match. */
  private syncOrderText(): void {
    this.orderInput.value = this.draft.text ?? '';
  }

  /** Reads the typed order: the rule parser first, then the order reader, then the small model (when on). */
  private async translate(): Promise<void> {
    if (this.translating) return;
    const text = this.orderInput.value;
    const slot = this.slot;
    const model = orderModelTranslator();
    this.translating = true;
    if (model) {
      this.status = { text: 'Reading your order…', color: TEXT.muted };
      this.render();
    }
    const result = await translateOrder(text, [orderReaderTranslator, model], TRANSLATOR_RULES.modelTimeoutSeconds * 1000);
    this.translating = false;
    // The player may have left the screen or switched slots while the model was thinking.
    if (!this.scene.isActive() || slot !== this.slot) return;
    if (result.ok) {
      this.draft = result.card;
      // The reader and the model read free-form words, so ask the player to check the card.
      const how =
        result.by === 'parser'
          ? 'Read as a card.'
          : `Read as a card by the ${result.by === 'model' ? 'small model' : 'order reader'}: check it says what you meant.`;
      this.status = { text: `${how} Enter saves it to slot ${this.slot + 1}.`, color: TEXT.muted };
      this.orderInput.blur();
      this.row = FIRST_MENU_ROW;
    } else {
      const loading = orderModelState();
      const why =
        result.note ??
        (loading.status === 'loading'
          ? `The small model is still loading (${Math.round(loading.progress * 100)}%).`
          : loading.status === 'warming'
            ? 'The small model is still getting ready.'
            : '');
      this.status = { text: `${reply('notUnderstood')}  (${result.error}) ${why}`.trim(), color: TEXT.defeat };
    }
    this.render();
  }

  private save(): void {
    const locked = this.slot === LEGENDARY ? null : slotUnlockRank(this.slot, this.setup.rank);
    if (locked) {
      this.status = { text: `${this.speaker}: ${reply('slotLocked', locked)}`, color: TEXT.defeat };
    } else if (this.slot === LEGENDARY && !this.legendaryOpen) {
      this.status = { text: `${this.speaker}: ${reply('legendaryLocked')}`, color: TEXT.defeat };
    } else {
      const verdict = validateCard(this.draft, this.setup.rank, this.slotContext());
      const reading = this.reading(this.draft);
      if (verdict.ok && reading) {
        if (this.slot === LEGENDARY) this.setup.loadout.legendary = structuredClone(this.draft);
        else this.setup.loadout.slots[this.slot] = structuredClone(this.draft);
        this.status = { text: `Saved to slot ${this.slot + 1}.  ${this.speaker}: “${generalReply(reading)}”`, color: TEXT.victory };
        this.keep();
      } else {
        this.status = { text: `Not saved.  ${this.speaker}: ${replyToVerdict(verdict)}`, color: TEXT.defeat };
      }
    }
    this.render();
  }

  private clear(): void {
    if (this.slot === LEGENDARY) this.setup.loadout.legendary = null;
    else this.setup.loadout.slots[this.slot] = null;
    this.draft = this.slot === LEGENDARY ? this.newLegendaryDraft() : newDraft();
    this.orderInput.value = '';
    this.status = { text: `Slot ${this.slot + 1} cleared.`, color: TEXT.muted };
    this.keep();
    this.render();
  }

  /** Writes your cards, rank and Tactical mode to the save file, and says so if that fails. */
  private keep(): void {
    remember(this.setup).catch(() => {
      if (!this.scene.isActive()) return;
      this.status = { text: 'Could not write the save file; your cards will last until you close the game.', color: TEXT.defeat };
      this.render();
    });
  }

  private backToTroops(): void {
    this.scene.start('Prep', this.setup);
  }

  private startBattle(): void {
    // A campaign fight's seed was fixed when you reached its node.
    this.scene.start('Battle', { ...this.setup, seed: this.setup.fight?.encounter.seed ?? newSeed() });
  }

  // Drawing ----------------------------------------------------------------------------------

  private render(): void {
    this.ui.removeAll(true);
    this.renderSwitches();
    this.renderSlots();
    this.renderPreview();
    this.renderMenus();
  }

  private renderSwitches(): void {
    const rules = rankRules(this.setup.rank);
    const x = GAME_WIDTH - 300;
    // Your rank is earned in battle: shown here, not switched (practice ranks are set on the Skirmish screen).
    const progress = rankProgress(currentXp());
    const practice = this.setup.practiceRank !== null;
    const xp = practice ? 'practice: no XP' : progress ? `${progress.into}/${progress.span} XP to the next` : 'the highest rank';
    this.ui.add(this.add.text(x, 5, `${practice ? 'Practice ' : ''}Rank ${rules.numeral} · ${rules.name}`, textStyle(12, TEXT.title, true)));
    this.ui.add(this.add.text(x + 284, 5, xp, textStyle(11, TEXT.muted)).setOrigin(1, 0));
    const lines: [number, string, string][] = [
      [TACTICAL_ROW, 'Tactical mode', this.setup.tactical ? 'On: pause every 10 s' : 'Off'],
      [GENERAL_ROW, 'General (debug)', GENERALS[this.setup.general].name],
    ];
    lines.forEach(([row, label, value], i) => {
      const y = 22 + i * 20;
      if (this.row === row) this.ui.add(this.add.rectangle(x - 6, y, 292, 20, 0x2b3a50).setOrigin(0));
      this.ui.add(this.add.text(x, y + 3, label, textStyle(12, TEXT.muted)));
      this.arrows(x + 112, y + 10, 172, value, (d) => {
        this.row = row;
        this.change(d);
      });
    });
  }

  private renderSlots(): void {
    const rank = this.setup.rank;
    const count = this.legendaryOpen ? SLOT_COUNT + 1 : SLOT_COUNT;
    for (let i = 0; i < count; i++) {
      const y = TOP_BAR_HEIGHT + 16 + i * (SLOT_H + 8);
      const card = this.savedCard(i);
      const unlock = i === LEGENDARY ? null : slotUnlockRank(i, rank);
      const box = this.add
        .rectangle(SLOT_X, y, SLOT_W, SLOT_H, i === this.slot ? 0x24344a : 0x19212d)
        .setOrigin(0)
        .setStrokeStyle(i === this.slot ? 2 : 1, i === this.slot ? 0x6ea8ff : 0x34465e)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectSlot(i));
      this.ui.add(box);
      this.ui.add(this.add.text(SLOT_X + 10, y + 8, String(i + 1), textStyle(16, i === LEGENDARY ? TEXT.perfect : TEXT.title, true)));
      if (unlock) {
        this.ui.add(this.add.text(SLOT_X + 34, y + 10, `Locked: opens at Rank ${rankRules(unlock).numeral}`, textStyle(12, TEXT.muted)));
        continue;
      }
      if (!card) {
        const empty = i === LEGENDARY ? `Legendary slot: ${this.learned.map((a) => LEGENDARY_ACTION_DATA[a].name).join(', ')}` : 'Empty slot';
        this.ui.add(this.add.text(SLOT_X + 34, y + 10, empty, { ...textStyle(12, TEXT.muted), wordWrap: { width: SLOT_W - 44 } }));
        continue;
      }
      // The slot shows what will fire: your General's version of the card.
      const verdict = validateCard(card, rank, this.slotContext(i));
      const reading = this.reading(card, i);
      const shown = reading?.card ?? card;
      this.ui.add(
        this.add.text(SLOT_X + 34, y + 8, describeCard(shown), { ...textStyle(12), wordWrap: { width: SLOT_W - 44 }, maxLines: 3 }),
      );
      const cost = cardCost(shown);
      const tooDear = cost > rankRules(rank).maxPips;
      const footer = !reading
        ? `⚠ ${replyToVerdict(verdict)}`
        : `${'●'.repeat(cost)} ${pips(cost)} · ${card.auto ? 'Auto' : 'Manual'}` +
          (tooDear ? ' · ⚠ over your max pips' : reading.rules.length > 0 && changed(card, shown) ? ` · ${this.speaker}'s version` : '');
      this.ui.add(this.add.text(SLOT_X + 34, y + SLOT_H - 20, footer, textStyle(11, reading && !tooDear ? TEXT.muted : TEXT.defeat)));
    }
    if (this.legendaryOpen) return;
    const ly = TOP_BAR_HEIGHT + 16 + SLOT_COUNT * (SLOT_H + 8);
    this.ui.add(this.add.rectangle(SLOT_X, ly, SLOT_W, 44, 0x151b25).setOrigin(0).setStrokeStyle(1, 0x2a3646));
    this.ui.add(this.add.text(SLOT_X + 10, ly + 6, '5', textStyle(16, TEXT.muted, true)));
    this.ui.add(this.add.text(SLOT_X + 34, ly + 6, 'Legendary slot: opens when you beat your\nfirst boss General', textStyle(11, TEXT.muted)));
  }

  private renderPreview(): void {
    const textSelected = this.row === TEXT_ROW;
    this.ui.add(
      this.add.text(PANEL_X, 88, 'Order', textStyle(12, textSelected ? TEXT.title : TEXT.muted, textSelected)),
    );
    const card = this.draft;
    const verdict = validateCard(card, this.setup.rank, this.slotContext());
    this.ui.add(
      this.add.text(PANEL_X, 120, `Slot ${this.slot + 1}:  ${describeCard(card)}`, {
        ...textStyle(14, TEXT.title, true),
        wordWrap: { width: GAME_WIDTH - PANEL_X - 16 },
        // Long cards are spelled out in full in the menus below.
        maxLines: 2,
      }),
    );
    const cost = cardCost(card);
    const width = GAME_WIDTH - PANEL_X - 16;
    this.ui.add(this.add.text(PANEL_X, 166, `Cost ${pips(cost)} · ${card.auto ? 'Auto' : 'Manual'}`, textStyle(12, TEXT.muted)));
    const reading = this.reading(card);
    if (!reading) {
      this.ui.add(this.add.text(PANEL_X + 150, 166, `${this.speaker}: ${replyToVerdict(verdict)}`, textStyle(12, TEXT.defeat)));
    } else {
      // The General's reading, then their answer. Rephrasing is free: edit the card and read again.
      const name = GENERALS[this.setup.general].name;
      const finalCost = cardCost(reading.card);
      const version = changed(card, reading.card)
        ? `${name}'s version: ${describeCard(reading.card)}  (${pips(finalCost)})`
        : reading.suggestion
          ? `${name} suggests: ${describeCondition(reading.suggestion)}. Press → on the Strategist line to accept.`
          : `${name} keeps it as written.`;
      this.ui.add(this.add.text(PANEL_X, 188, version, { ...textStyle(12, TEXT.body), wordWrap: { width }, maxLines: 2 }));
      const warning = finalCost > rankRules(this.setup.rank).maxPips ? '  ⚠ More than your max pips: it can never fire. Rephrase it.' : '';
      this.ui.add(
        this.add.text(PANEL_X, 222, `“${generalReply(reading)}”${warning}`, { ...textStyle(12, warning ? TEXT.defeat : TEXT.perfect), wordWrap: { width } }),
      );
    }
    this.ui.add(this.add.text(PANEL_X, 244, this.status.text, { ...textStyle(12, this.status.color), wordWrap: { width }, maxLines: 1 }));
  }

  private renderMenus(): void {
    this.menuRows().forEach((r, i) => {
      const y = ROWS_Y + i * ROW_H;
      const selected = this.row === FIRST_MENU_ROW + i;
      if (selected) this.ui.add(this.add.rectangle(PANEL_X - 6, y - 2, GAME_WIDTH - PANEL_X - 4, ROW_H, 0x2b3a50).setOrigin(0));
      this.ui.add(this.add.text(PANEL_X, y, r.label, textStyle(12, selected ? TEXT.title : TEXT.muted, selected)));
      this.arrows(PANEL_X + 120, y + 8, 420, r.choices[r.index]!.label, (d) => {
        this.row = FIRST_MENU_ROW + i;
        this.change(d);
      });
    });
  }

  /** "◀ value ▶", with both arrows clickable. */
  private arrows(x: number, y: number, width: number, value: string, onStep: (d: number) => void): void {
    const left = this.add.text(x, y, '◀', textStyle(12, TEXT.body)).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    const right = this.add.text(x + width, y, '▶', textStyle(12, TEXT.body)).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    left.on('pointerdown', () => onStep(-1));
    right.on('pointerdown', () => onStep(1));
    this.ui.add([left, right, this.add.text(x + width / 2, y, value, textStyle(12)).setOrigin(0.5)]);
  }
}

function pips(n: number): string {
  return `${n} pip${n === 1 ? '' : 's'}`;
}

/** True if the General's version differs from what you wrote (not counting the words). */
function changed(written: Card, read: Card): boolean {
  return JSON.stringify(read.steps) !== JSON.stringify(written.steps) || JSON.stringify(read.condition) !== JSON.stringify(written.condition);
}
