// The Combo Codex: the combos you have landed, with what they take and what they do. Combos you
// haven't found yet stay hidden. Esc or Enter goes back.

import Phaser from 'phaser';
import { CODEX_ENTRY_IDS } from '../../data/combos';
import { COMMAND_RULES } from '../../data/command';
import { codexEntry } from '../codex';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { foundCombos } from '../session';
import { GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, textStyle } from '../ui';

const ROW_H = 74;

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
    this.add.text(16, 10, 'COMBO CODEX', textStyle(18, TEXT.title, true));
    this.add.text(GAME_WIDTH - 16, 14, `${found.length} of ${CODEX_ENTRY_IDS.length} found`, textStyle(14, TEXT.muted)).setOrigin(1, 0);
    const { windowSeconds } = COMMAND_RULES.chain;
    this.add.text(
      16,
      38,
      `Chains (Rank III): fire cards within ${windowSeconds} s of each other; each link costs 1 pip less and earns double Momentum.`,
      textStyle(12, TEXT.muted),
    );

    CODEX_ENTRY_IDS.forEach((id, i) => {
      const y = TOP_BAR_HEIGHT + 16 + i * ROW_H;
      const known = found.includes(id);
      const entry = codexEntry(id);
      this.add.rectangle(16, y, GAME_WIDTH - 32, ROW_H - 10, known ? 0x1d2939 : 0x141a23).setOrigin(0).setStrokeStyle(1, known ? 0x50627c : 0x2a3444);
      if (known) {
        this.add.text(32, y + 10, entry.name, textStyle(16, TEXT.perfect, true));
        this.add.text(260, y + 12, entry.stepsText, textStyle(13, TEXT.body));
        this.add.text(32, y + 36, entry.bonusText, textStyle(13, TEXT.muted));
      } else {
        this.add.text(32, y + 10, '???', textStyle(16, TEXT.muted, true));
        const hint = id === 'finisher' ? 'Something about your ultimate, at the end of a long chain (Rank IV).' : 'Two steps in a row, in one card or across a chain (Rank III).';
        this.add.text(32, y + 36, `Not found yet. ${hint}`, textStyle(13, TEXT.muted));
      }
    });

    addButton(this, 16 + 70, GAME_HEIGHT - 34, '◀ Back  Esc', () => this.goBack(), 140, 32);
    new InputLayer(this).on('back', () => this.goBack()).on('confirm', () => this.goBack()).on('codex', () => this.goBack());
  }

  private goBack(): void {
    this.scene.start('Prep', this.setup);
  }
}
