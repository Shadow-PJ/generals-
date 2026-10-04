// Shown over the finished battle: who won, how, the Command XP it earned (and a rank up), and a rematch.

import Phaser from 'phaser';
import { rankRules } from '../../data/ranks';
import { formatBattleTime, type BattleResult } from '../../sim';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { rankForXp, rankProgress, rankUnlocks, type XpGain } from '../progress';
import { resultReason, resultTitle } from '../resultText';
import { newSeed } from '../seed';
import { currentXp, gainXp } from '../session';
import { GAME_HEIGHT, GAME_WIDTH, TEXT } from '../theme';
import { addButton, textStyle } from '../ui';

export interface ResultData extends MatchSetup {
  seed: number;
  result: BattleResult;
  /** The Command XP the battle earned; added to your save when this screen opens. */
  xp: XpGain;
}

export class ResultScene extends Phaser.Scene {
  private setup!: ResultData;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.setup = data;
  }

  create(): void {
    fitCamera(this);
    const { result, seed, xp } = this.setup;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x05070b, 0.6);
    this.add.rectangle(cx, cy, 560, 330, 0x1a2230, 0.97).setStrokeStyle(2, 0x3a4a60);

    const color = result.winner === 'player' ? TEXT.victory : result.winner === 'enemy' ? TEXT.defeat : TEXT.title;
    this.add.text(cx, cy - 122, resultTitle(result), textStyle(40, color, true)).setOrigin(0.5);
    this.add.text(cx, cy - 74, resultReason(result), textStyle(15)).setOrigin(0.5);
    this.add
      .text(cx, cy - 46, `Battle time ${formatBattleTime(result.durationTicks).slice(0, -3)}   ·   seed ${seed}`, textStyle(13, TEXT.muted))
      .setOrigin(0.5);

    // Command XP: what earned it, then your rank, or the rank you just reached.
    const before = rankForXp(currentXp());
    const saving = gainXp(xp.total);
    void saving.catch(() => undefined);
    const after = rankForXp(currentXp());
    this.setup.rank = after;
    this.add.text(cx, cy - 16, `+${xp.total} Command XP`, textStyle(16, TEXT.perfect, true)).setOrigin(0.5);
    this.add
      .text(cx, cy + 6, xp.parts.map((p) => `${p.label} +${p.xp}`).join('   ·   '), { ...textStyle(12, TEXT.muted), wordWrap: { width: 520 } })
      .setOrigin(0.5, 0);
    const rules = rankRules(after);
    if (after > before) {
      this.add.text(cx, cy + 30, `RANK UP!  Rank ${rules.numeral} · ${rules.name}`, textStyle(18, TEXT.combo, true)).setOrigin(0.5, 0);
      this.add.text(cx, cy + 54, rankUnlocks(after), { ...textStyle(12, TEXT.body), wordWrap: { width: 520 } }).setOrigin(0.5, 0);
    } else {
      const progress = rankProgress(currentXp());
      const next = progress ? `${progress.into}/${progress.span} XP to Rank ${rankRules((after + 1) as typeof after).numeral}` : 'the highest rank';
      this.add.text(cx, cy + 34, `Rank ${rules.numeral} · ${rules.name}  ·  ${next}`, textStyle(13, TEXT.body)).setOrigin(0.5, 0);
    }

    addButton(this, cx - 105, cy + 108, 'Rematch  ⏎', () => this.rematch(), 180, 38);
    addButton(this, cx + 105, cy + 108, 'Move troops  Esc', () => this.moveTroops(), 180, 38);
    this.add.text(cx, cy + 140, 'Rematch keeps your placement; the battle plays out differently each time.', textStyle(12, TEXT.muted)).setOrigin(0.5);

    new InputLayer(this).on('confirm', () => this.rematch()).on('back', () => this.moveTroops());
  }

  private rematch(): void {
    this.scene.stop('Battle');
    this.scene.start('Battle', { ...this.matchSetup(), seed: newSeed() });
  }

  private moveTroops(): void {
    this.scene.stop('Battle');
    this.scene.start('Prep', this.matchSetup());
  }

  /** Everything you set up for the battle (troops, reserves, cards, General...), without its result. */
  private matchSetup(): MatchSetup {
    const { result: _result, seed: _seed, xp: _xp, ...setup } = this.setup;
    return setup;
  }
}
