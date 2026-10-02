// Writing orders: each slot holds one Command card. Type an order and the rule parser turns it
// into a card, or build one from the menus. The validator checks it against your rank before it
// goes into a slot, and the General answers.

import Phaser from 'phaser';
import { cardCost } from '../../cards/cost';
import { describeCard } from '../../cards/describe';
import { parseOrder } from '../../cards/parser';
import { reply, replyToVerdict } from '../../cards/replies';
import { emptyLoadout, type Card } from '../../cards/types';
import { slotUnlockRank, validateCard } from '../../cards/validator';
import { STARTER_ARMY } from '../../data/armies';
import { DEBUG_DEFAULT_RANK, RANKS, rankRules, type RankNumber } from '../../data/ranks';
import { builderRows, cycleRow, newDraft, type BuilderRow } from '../cardBuilder';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { newSeed } from '../seed';
import { COLORS, FONT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle } from '../ui';

const SLOT_COUNT = 4;
const SLOT_X = 16;
const SLOT_W = 296;
const SLOT_H = 84;
const PANEL_X = 332;
const ROWS_Y = 214;
const ROW_H = 20;
/** Fixed rows above the card's menus: the rank switch and the typed order. */
const RANK_ROW = 0;
const TEXT_ROW = 1;
const FIRST_MENU_ROW = 2;

export class OrdersScene extends Phaser.Scene {
  private setup!: MatchSetup;
  /** One draft per slot, so switching slots keeps unsaved edits. */
  private drafts: Card[] = [];
  private slot = 0;
  private row = FIRST_MENU_ROW;
  private status = { text: '', color: TEXT.muted as string };
  private ui!: Phaser.GameObjects.Container;
  private orderInput!: HTMLInputElement;

  constructor() {
    super('Orders');
  }

  init(data: Partial<MatchSetup>): void {
    const rank = data.rank ?? (this.registry.get('rank') as RankNumber | undefined) ?? DEBUG_DEFAULT_RANK;
    this.setup = {
      placement: data.placement ?? STARTER_ARMY.map((t) => ({ ...t })),
      loadout: data.loadout ?? emptyLoadout(),
      rank,
    };
    this.drafts = this.setup.loadout.slots.map((card) => (card ? structuredClone(card) : newDraft()));
    this.slot = 0;
    this.row = FIRST_MENU_ROW;
    this.status = { text: '', color: TEXT.muted };
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, TOP_BAR_HEIGHT, COLORS.background).setOrigin(0);
    this.add.text(16, 10, 'WRITE YOUR ORDERS', textStyle(18, TEXT.title, true));
    this.add.text(
      16,
      38,
      'Type an order, or build it below: ↑↓ pick a line, ←→ change it. Enter saves to the slot, Tab switches slots.',
      textStyle(12, TEXT.muted),
    );

    this.orderInput = document.createElement('input');
    Object.assign(this.orderInput, {
      type: 'text',
      maxLength: 200,
      placeholder: 'e.g. When their Assassin dives, protect my Ranger, then everyone focus him',
    });
    Object.assign(this.orderInput.style, {
      width: '400px',
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
      if (event.key === 'Enter') this.translate();
      if (event.key === 'Escape') this.orderInput.blur();
      event.stopPropagation();
    });
    this.syncOrderText();
    this.orderInput.addEventListener('focus', () => {
      this.row = TEXT_ROW;
      this.render();
    });
    addButton(this, GAME_WIDTH - 66, 96, 'Translate  ⏎', () => this.translate(), 100, 28);

    addButton(this, SLOT_X + 72, 576, '◀ Troops  Esc', () => this.backToTroops(), 140, 32);
    addButton(this, SLOT_X + 224, 576, 'Start battle  B', () => this.startBattle(), 150, 32);
    addButton(this, GAME_WIDTH - 236, 576, 'Save to slot  ⏎', () => this.save(), 150, 32);
    addButton(this, GAME_WIDTH - 82, 576, 'Clear slot  Del', () => this.clear(), 140, 32);

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
      .on('back', () => this.backToTroops());

    this.render();
  }

  private get draft(): Card {
    return this.drafts[this.slot]!;
  }

  private set draft(card: Card) {
    this.drafts[this.slot] = card;
  }

  private menuRows(): BuilderRow[] {
    return builderRows(this.draft);
  }

  private moveRow(step: number): void {
    const last = FIRST_MENU_ROW + this.menuRows().length - 1;
    this.row = Math.max(RANK_ROW, Math.min(last, this.row + step));
    this.render();
  }

  private change(step: number): void {
    if (this.row === RANK_ROW) {
      const rank = Math.max(1, Math.min(RANKS.length, this.setup.rank + step)) as RankNumber;
      this.setup.rank = rank;
      this.registry.set('rank', rank);
    } else if (this.row >= FIRST_MENU_ROW) {
      const r = this.menuRows()[this.row - FIRST_MENU_ROW];
      if (r) this.draft = cycleRow(this.draft, r.id, step);
      this.syncOrderText();
      // Rows can appear or vanish (a new step, a removed condition); stay on the same line number.
      this.row = Math.min(this.row, FIRST_MENU_ROW + this.menuRows().length - 1);
    }
    this.render();
  }

  private selectSlot(index: number): void {
    this.slot = (index + SLOT_COUNT) % SLOT_COUNT;
    this.syncOrderText();
    this.status = { text: '', color: TEXT.muted };
    this.row = Math.min(this.row, FIRST_MENU_ROW + this.menuRows().length - 1);
    this.render();
  }

  /** The text box shows the words the card was written from; menu edits clear them, since they no longer match. */
  private syncOrderText(): void {
    this.orderInput.value = this.draft.text ?? '';
  }

  private translate(): void {
    const text = this.orderInput.value;
    const result = parseOrder(text);
    if (result.ok) {
      this.draft = result.card;
      this.status = { text: `Read as a card. Enter saves it to slot ${this.slot + 1}.`, color: TEXT.muted };
      this.orderInput.blur();
      this.row = FIRST_MENU_ROW;
    } else {
      this.status = { text: `${reply('notUnderstood')}  (${result.error})`, color: TEXT.defeat };
    }
    this.render();
  }

  private save(): void {
    const locked = slotUnlockRank(this.slot, this.setup.rank);
    if (locked) {
      this.status = { text: `Captain: ${reply('slotLocked', locked)}`, color: TEXT.defeat };
    } else {
      const verdict = validateCard(this.draft, this.setup.rank);
      if (verdict.ok) {
        this.setup.loadout.slots[this.slot] = structuredClone(this.draft);
        this.status = { text: `Saved to slot ${this.slot + 1}.  Captain: ${replyToVerdict(verdict)}`, color: TEXT.victory };
      } else {
        this.status = { text: `Not saved.  Captain: ${replyToVerdict(verdict)}`, color: TEXT.defeat };
      }
    }
    this.render();
  }

  private clear(): void {
    this.setup.loadout.slots[this.slot] = null;
    this.draft = newDraft();
    this.orderInput.value = '';
    this.status = { text: `Slot ${this.slot + 1} cleared.`, color: TEXT.muted };
    this.render();
  }

  private backToTroops(): void {
    this.scene.start('Prep', this.setup);
  }

  private startBattle(): void {
    this.scene.start('Battle', { ...this.setup, seed: newSeed() });
  }

  // Drawing ----------------------------------------------------------------------------------

  private render(): void {
    this.ui.removeAll(true);
    this.renderRank();
    this.renderSlots();
    this.renderPreview();
    this.renderMenus();
  }

  private renderRank(): void {
    const rules = rankRules(this.setup.rank);
    const selected = this.row === RANK_ROW;
    const x = GAME_WIDTH - 300;
    if (selected) this.ui.add(this.add.rectangle(x - 6, 12, 292, 26, 0x2b3a50).setOrigin(0));
    this.ui.add(this.add.text(x, 16, 'Rank (debug)', textStyle(12, TEXT.muted)));
    this.arrows(x + 96, 25, 180, `${rules.numeral} · ${rules.name}`, (d) => {
      this.row = RANK_ROW;
      this.change(d);
    });
  }

  private renderSlots(): void {
    const rank = this.setup.rank;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const y = TOP_BAR_HEIGHT + 16 + i * (SLOT_H + 8);
      const card = this.setup.loadout.slots[i] ?? null;
      const unlock = slotUnlockRank(i, rank);
      const box = this.add
        .rectangle(SLOT_X, y, SLOT_W, SLOT_H, i === this.slot ? 0x24344a : 0x19212d)
        .setOrigin(0)
        .setStrokeStyle(i === this.slot ? 2 : 1, i === this.slot ? 0x6ea8ff : 0x34465e)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectSlot(i));
      this.ui.add(box);
      this.ui.add(this.add.text(SLOT_X + 10, y + 8, String(i + 1), textStyle(16, TEXT.title, true)));
      if (unlock) {
        this.ui.add(this.add.text(SLOT_X + 34, y + 10, `Locked: opens at Rank ${rankRules(unlock).numeral}`, textStyle(12, TEXT.muted)));
        continue;
      }
      if (!card) {
        this.ui.add(this.add.text(SLOT_X + 34, y + 10, 'Empty slot', textStyle(12, TEXT.muted)));
        continue;
      }
      this.ui.add(
        this.add.text(SLOT_X + 34, y + 8, describeCard(card), { ...textStyle(12), wordWrap: { width: SLOT_W - 44 } }),
      );
      const verdict = validateCard(card, rank);
      const footer = verdict.ok
        ? `${'●'.repeat(verdict.cost)} ${verdict.cost} pip${verdict.cost === 1 ? '' : 's'} · ${card.auto ? 'Auto' : 'Manual'}`
        : `⚠ ${replyToVerdict(verdict)}`;
      this.ui.add(this.add.text(SLOT_X + 34, y + SLOT_H - 20, footer, textStyle(11, verdict.ok ? TEXT.muted : TEXT.defeat)));
    }
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
    const verdict = validateCard(card, this.setup.rank);
    this.ui.add(
      this.add.text(PANEL_X, 120, `Slot ${this.slot + 1}:  ${describeCard(card)}`, {
        ...textStyle(14, TEXT.title, true),
        wordWrap: { width: GAME_WIDTH - PANEL_X - 16 },
      }),
    );
    const cost = cardCost(card);
    this.ui.add(
      this.add.text(PANEL_X, 166, `Cost ${cost} pip${cost === 1 ? '' : 's'} · ${card.auto ? 'Auto' : 'Manual'}`, textStyle(12, TEXT.muted)),
    );
    this.ui.add(
      this.add.text(PANEL_X + 150, 166, `Captain: ${replyToVerdict(verdict)}`, textStyle(12, verdict.ok ? TEXT.victory : TEXT.defeat)),
    );
    this.ui.add(this.add.text(PANEL_X, 188, this.status.text, { ...textStyle(12, this.status.color), wordWrap: { width: GAME_WIDTH - PANEL_X - 16 } }));
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
