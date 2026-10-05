// The Combo Codex: the combos you have landed, with what they take and what they do, the
// signature combos and the Finisher on the left, the troop synergies on the right. Entries you
// haven't found yet stay hidden. Esc or Enter goes back.

import Phaser from 'phaser';
import { CODEX_ENTRY_IDS, type CodexEntryId } from '../../data/combos';
import { COMMAND_RULES } from '../../data/command';
import { codexEntry, isSynergy } from '../codex';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { foundCombos } from '../session';
import { GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, addFrame, addTitle, textStyle } from '../ui';

const ROW_H = 84;
const COLUMN_W = (GAME_WIDTH - 48) / 2;

export class CodexScene extends Phaser.Scene {
  private setup!: MatchSetup;

  constructor() {
    super('Codex');
  }

  init(data: MatchSetup): void {
    this.setup = data;
  }

  create(): void {
    fitCamera(this);
    const found = foundCombos();
    addTitle(this, 'COMBO CODEX');
    this.add.text(GAME_WIDTH - 16, 14, `${found.length} of ${CODEX_ENTRY_IDS.length} found`, textStyle(14, TEXT.muted)).setOrigin(1, 0);
    const { windowSeconds } = COMMAND_RULES.chain;
    this.add.text(
      16,
      38,
      `Chains (Rank III): fire cards within ${windowSeconds} s of each other; each link costs 1 pip less and earns double Momentum.`,
      textStyle(12, TEXT.muted),
    );

    const columns = [CODEX_ENTRY_IDS.filter((id) => !isSynergy(id)), CODEX_ENTRY_IDS.filter(isSynergy)];
    this.add.text(16, TOP_BAR_HEIGHT + 4, 'SIGNATURE COMBOS AND THE FINISHER', textStyle(12, TEXT.muted, true));
    this.add.text(32 + COLUMN_W, TOP_BAR_HEIGHT + 4, 'TROOP SYNERGIES (always on)', textStyle(12, TEXT.muted, true));
    columns.forEach((ids, column) => {
      const x = 16 + column * (COLUMN_W + 16);
      ids.forEach((id, i) => {
        const y = TOP_BAR_HEIGHT + 24 + i * ROW_H;
        const known = found.includes(id);
        const entry = codexEntry(id);
        addFrame(this, x, y, COLUMN_W, ROW_H - 8, known ? 'plain' : 'rowDim');
        const wrap = { wordWrap: { width: COLUMN_W - 24 } };
        if (known) {
          this.add.text(x + 12, y + 8, entry.name, textStyle(15, TEXT.perfect, true));
          this.add.text(x + 12, y + 30, entry.stepsText, { ...textStyle(12, TEXT.body), ...wrap });
          this.add.text(x + 12, y + 48, entry.bonusText, { ...textStyle(12, TEXT.muted), ...wrap });
        } else {
          this.add.text(x + 12, y + 8, '???', textStyle(15, TEXT.muted, true));
          this.add.text(x + 12, y + 30, `Not found yet. ${hintFor(id)}`, { ...textStyle(12, TEXT.muted), ...wrap });
        }
      });
    });

    addButton(this, 16 + 70, GAME_HEIGHT - 34, '◀ Back  Esc', () => this.goBack(), 140, 32);
    new InputLayer(this).on('back', () => this.goBack()).on('confirm', () => this.goBack()).on('codex', () => this.goBack());
  }

  private goBack(): void {
    this.scene.start(this.setup.returnTo ?? 'Prep', this.setup);
  }
}

function hintFor(id: CodexEntryId): string {
  if (id === 'finisher') return 'Something about your ultimate, at the end of a long chain (Rank IV).';
  if (isSynergy(id)) return 'Two troop classes in your army, working together by themselves.';
  return 'Two steps in a row, in one card or across a chain (Rank III).';
}
