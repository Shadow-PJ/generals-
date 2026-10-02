// Shown over the finished battle: who won, how, and a rematch.

import Phaser from 'phaser';
import { formatBattleTime, type BattleResult } from '../../sim';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { resultReason, resultTitle } from '../resultText';
import { newSeed } from '../seed';
import { GAME_HEIGHT, GAME_WIDTH, TEXT } from '../theme';
import { addButton, textStyle } from '../ui';

export interface ResultData extends MatchSetup {
  seed: number;
  result: BattleResult;
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
    const { result, seed } = this.setup;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x05070b, 0.6);
    this.add.rectangle(cx, cy, 460, 250, 0x1a2230, 0.97).setStrokeStyle(2, 0x3a4a60);

    const color = result.winner === 'player' ? TEXT.victory : result.winner === 'enemy' ? TEXT.defeat : TEXT.title;
    this.add.text(cx, cy - 82, resultTitle(result), textStyle(40, color, true)).setOrigin(0.5);
    this.add.text(cx, cy - 34, resultReason(result), textStyle(15)).setOrigin(0.5);
    this.add
      .text(cx, cy - 6, `Battle time ${formatBattleTime(result.durationTicks).slice(0, -3)}   ·   seed ${seed}`, textStyle(13, TEXT.muted))
      .setOrigin(0.5);

    addButton(this, cx - 105, cy + 60, 'Rematch  ⏎', () => this.rematch(), 180, 38);
    addButton(this, cx + 105, cy + 60, 'Move troops  Esc', () => this.moveTroops(), 180, 38);
    this.add.text(cx, cy + 100, 'Rematch keeps your placement; the battle plays out differently each time.', textStyle(12, TEXT.muted)).setOrigin(0.5);

    new InputLayer(this).on('confirm', () => this.rematch()).on('back', () => this.moveTroops());
  }

  private rematch(): void {
    this.scene.stop('Battle');
    const { placement, loadout, rank, tactical } = this.setup;
    this.scene.start('Battle', { placement, loadout, rank, tactical, seed: newSeed() });
  }

  private moveTroops(): void {
    this.scene.stop('Battle');
    const { placement, loadout, rank, tactical } = this.setup;
    this.scene.start('Prep', { placement, loadout, rank, tactical });
  }
}
