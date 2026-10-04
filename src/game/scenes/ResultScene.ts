// Shown over the finished battle: who won and how. A campaign battle earns Command XP (and maybe
// a rank up) and carries on to the spoils, or ends the run; a skirmish is practice, with a rematch.

import Phaser from 'phaser';
import { finishFight, type FightOutcome } from '../../campaign/run';
import { rankRules } from '../../data/ranks';
import { formatBattleTime, type BattleResult } from '../../sim';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { rankForXp, rankProgress, rankUnlocks, type XpGain } from '../progress';
import { resultReason, resultTitle } from '../resultText';
import { newSeed } from '../seed';
import { currentCampaign, currentXp, gainXp, saveCampaign } from '../session';
import { GAME_HEIGHT, GAME_WIDTH, TEXT } from '../theme';
import { addButton, textStyle } from '../ui';

export interface ResultData extends MatchSetup {
  seed: number;
  result: BattleResult;
  /** The Command XP the battle earned; added to your save when this screen opens, in a campaign battle. */
  xp: XpGain;
  /** A campaign battle: how each fighter came out of it, for the run. Null in a skirmish. */
  outcome: FightOutcome | null;
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

    // Command XP: what earned it, then your rank, or the rank you just reached. Only campaign
    // battles earn it; a skirmish is practice.
    if (!this.setup.fight || !this.setup.outcome) {
      const practice = this.setup.practiceRank === null ? null : rankRules(this.setup.practiceRank);
      this.add.text(cx, cy - 16, 'Skirmish: practice, no Command XP', textStyle(16, TEXT.muted, true)).setOrigin(0.5);
      const note = practice ? `You practised at Rank ${practice.numeral} · ${practice.name}. ` : '';
      this.add.text(cx, cy + 10, `${note}Campaign battles earn Command XP.`, textStyle(12, TEXT.muted)).setOrigin(0.5, 0);
      this.addButtons(cx, cy);
      return;
    }
    const before = rankForXp(currentXp());
    void gainXp(xp.total).catch(() => undefined);
    this.carryToRun(this.setup.outcome);
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

    this.addRunButton(cx, cy, result.winner === 'player');
  }

  /** The battle's outcome goes to the run once: wounds, spoils, or the end of the run. */
  private carryToRun(outcome: FightOutcome): void {
    const campaign = currentCampaign();
    const stop = campaign.run?.stop;
    if (stop?.kind !== 'fight' || stop.encounter.seed !== this.setup.fight?.encounter.seed) return;
    void saveCampaign(finishFight(campaign, outcome)).catch(() => undefined);
  }

  private addRunButton(cx: number, cy: number, won: boolean): void {
    const go = () => {
      this.scene.stop('Battle');
      this.scene.start('Stop');
    };
    addButton(this, cx, cy + 108, won ? 'Spoils  ⏎' : 'Run over  ⏎', go, 200, 38);
    const ended = currentCampaign().run?.stop?.kind === 'end';
    const note = won ? (ended ? 'You beat the ruler of the region!' : 'Your wounded fighters carry their wounds to the next fight.') : 'Your army fell: the run is over.';
    this.add.text(cx, cy + 140, note, textStyle(12, TEXT.muted)).setOrigin(0.5);
    new InputLayer(this).on('confirm', go);
  }

  private addButtons(cx: number, cy: number): void {
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
    const { result: _result, seed: _seed, xp: _xp, outcome: _outcome, ...setup } = this.setup;
    return setup;
  }
}
