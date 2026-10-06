// Shown over the finished battle: who won and how, and the Battle IQ report. A campaign battle
// earns Command XP (and maybe a rank up), Insight and Mastery titles, and carries on to the
// spoils, or ends the run; a skirmish is practice, with a rematch.

import Phaser from 'phaser';
import { titleOf, withMastery } from '../../campaign/mastery';
import { finishFight, type FightOutcome } from '../../campaign/run';
import type { GeneralId } from '../../data/generals';
import { MASTERY, type MasteryId } from '../../data/mastery';
import { rankRules } from '../../data/ranks';
import { formatBattleTime, type BattleResult } from '../../sim';
import { playMusic, playSound } from '../audio/audio';
import type { BattleIq, Grade } from '../battleIq';
import { CaptainTips } from '../captain';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { rankForXp, rankProgress, rankUnlocks, type XpGain } from '../progress';
import { resultReason, resultTitle } from '../resultText';
import { newSeed } from '../seed';
import { currentCampaign, currentXp, gainXp, saveCampaign } from '../session';
import { GAME_HEIGHT, GAME_WIDTH, TEXT } from '../theme';
import { sceneTips } from '../tutorial';
import { addButton, addFrame, displayStyle, textStyle, titleCase } from '../ui';

const GRADE_COLORS: Readonly<Record<Grade, string>> = { A: TEXT.victory, B: TEXT.perfect, C: TEXT.body, D: TEXT.defeat };

export interface ResultData extends MatchSetup {
  seed: number;
  result: BattleResult;
  /** The Command XP the battle earned; added to your save when this screen opens, in a campaign battle. */
  xp: XpGain;
  /** A campaign battle: how each fighter came out of it, for the run. Null in a skirmish. */
  outcome: FightOutcome | null;
  /** The Battle IQ report: every battle has one. */
  iq: BattleIq;
  /** Your General's Mastery challenges this campaign battle met (some may be met already). */
  mastery: MasteryId[];
}

const PANEL_W = 800;
const PANEL_H = 600;
const LABEL_W = 150;

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
    const top = cy - PANEL_H / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x07050a, 0.62);
    addFrame(this, cx - PANEL_W / 2, top, PANEL_W, PANEL_H, 'panel');
    new CaptainTips(this, { x: cx - PANEL_W / 2 + 20, width: PANEL_W - 40, bottom: top + PANEL_H - 92 }).say(sceneTips('Result'));

    // The battle music stops for a fanfare, or a lament.
    playMusic(null);
    playSound(result.winner === 'player' ? 'victory' : 'defeat');
    const color = result.winner === 'player' ? TEXT.victory : result.winner === 'enemy' ? TEXT.defeat : TEXT.title;
    const title = this.add.text(cx, top + 34, titleCase(resultTitle(result)), displayStyle(48, color)).setOrigin(0.5);
    title.setScale(0.6);
    this.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.Out' });
    this.add.text(cx, top + 70, resultReason(result), textStyle(15)).setOrigin(0.5);
    this.add
      .text(cx, top + 92, `Battle time ${formatBattleTime(result.durationTicks).slice(0, -3)}   ·   seed ${seed}`, textStyle(13, TEXT.muted))
      .setOrigin(0.5);

    // Command XP: what earned it, then your rank, or the rank you just reached. Only campaign
    // battles earn it; a skirmish is practice.
    if (!this.setup.fight || !this.setup.outcome) {
      const practice = this.setup.practiceRank === null ? null : rankRules(this.setup.practiceRank);
      this.add.text(cx, top + 122, 'Skirmish: practice, no Command XP', textStyle(16, TEXT.muted, true)).setOrigin(0.5);
      const note = practice ? `You practised at Rank ${practice.numeral} · ${practice.name}. ` : '';
      this.add.text(cx, top + 146, `${note}Campaign battles earn Command XP and Insight.`, textStyle(12, TEXT.muted)).setOrigin(0.5, 0);
      this.renderIq(cx, top + 220);
      this.addButtons(cx, top + PANEL_H - 66);
      return;
    }
    const before = rankForXp(currentXp());
    void gainXp(xp.total).catch(() => undefined);
    const fresh = this.carryToRun(this.setup.outcome);
    const after = rankForXp(currentXp());
    this.setup.rank = after;
    this.add.text(cx, top + 122, `+${xp.total} Command XP`, textStyle(16, TEXT.perfect, true)).setOrigin(0.5);
    this.add
      .text(cx, top + 142, xp.parts.map((p) => `${p.label} +${p.xp}`).join('   ·   '), { ...textStyle(12, TEXT.muted), wordWrap: { width: PANEL_W - 60 } })
      .setOrigin(0.5, 0);
    const rules = rankRules(after);
    if (after > before) {
      this.add.text(cx, top + 164, `RANK UP!  Rank ${rules.numeral} · ${rules.name}: ${rankUnlocks(after)}`, { ...textStyle(14, TEXT.combo, true), wordWrap: { width: PANEL_W - 60 } }).setOrigin(0.5, 0);
    } else {
      const progress = rankProgress(currentXp());
      const next = progress ? `${progress.into}/${progress.span} XP to Rank ${rankRules((after + 1) as typeof after).numeral}` : 'the highest rank';
      this.add.text(cx, top + 166, `Rank ${rules.numeral} · ${rules.name}  ·  ${next}`, textStyle(13, TEXT.body)).setOrigin(0.5, 0);
    }
    // Insight for the Tech Web, and any Mastery challenge met for the first time.
    const insight = `+${this.setup.outcome.insight ?? 0} Insight for the Tech Web`;
    const titles = fresh.map((id) => {
      const [general, i] = id.split('.') as [GeneralId, string];
      return `${MASTERY[general][Number(i)]!.text}: you are now ${titleOf(id)}`;
    });
    this.add.text(cx, top + 190, insight, textStyle(13, TEXT.gold, true)).setOrigin(0.5, 0);
    if (titles.length > 0) this.add.text(cx, top + 210, `MASTERY! ${titles.join(' · ')}`, { ...textStyle(13, TEXT.combo, true), wordWrap: { width: PANEL_W - 60 }, align: 'center' }).setOrigin(0.5, 0);

    this.renderIq(cx, top + 250);
    this.addRunButton(cx, top + PANEL_H - 66, result.winner === 'player');
  }

  /** The Battle IQ report: the grade, then four lines read from the battle. */
  private renderIq(cx: number, y: number): void {
    const iq = this.setup.iq;
    const left = cx - PANEL_W / 2 + 30;
    this.add.rectangle(cx, y - 10, PANEL_W - 48, 2, 0x8a5a2b).setOrigin(0.5, 0);
    const bonus = this.setup.fight && iq.xp > 0 ? `  ·  +${iq.xp} XP` : '';
    this.add.text(left, y, `BATTLE IQ  ·  Grade ${iq.grade}  (${iq.score}/100)${bonus}`, textStyle(16, GRADE_COLORS[iq.grade], true));
    let row = y + 28;
    const lines: [string, string, string][] = [
      ['BIGGEST MISTAKE', iq.mistake, TEXT.defeat],
      ['BEST DECISION', iq.best, TEXT.victory],
      ['MISSED CHANCE', iq.missed, TEXT.perfect],
      ['ENEMY WEAKNESS', iq.weakness, TEXT.combo],
    ];
    for (const [label, text, tint] of lines) {
      this.add.text(left, row + 1, label, textStyle(11, tint, true));
      const body = this.add.text(left + LABEL_W, row, text, { ...textStyle(13, TEXT.body), wordWrap: { width: PANEL_W - 60 - LABEL_W } });
      row += Math.max(22, body.height + 8);
    }
  }

  /**
   * The battle's outcome goes to the run once: wounds, records, Insight, spoils, or the end of the
   * run, and the Mastery challenges met. Returns the challenges met for the first time.
   */
  private carryToRun(outcome: FightOutcome): MasteryId[] {
    const campaign = currentCampaign();
    const stop = campaign.run?.stop;
    if (stop?.kind !== 'fight' || stop.encounter.seed !== this.setup.fight?.encounter.seed) return [];
    const fresh = this.setup.mastery.filter((id) => !campaign.mastery.includes(id));
    void saveCampaign(withMastery(finishFight(campaign, outcome), fresh)).catch(() => undefined);
    return fresh;
  }

  private addRunButton(cx: number, cy: number, won: boolean): void {
    const go = () => {
      this.scene.stop('Battle');
      this.scene.start('Stop');
    };
    addButton(this, cx, cy, won ? 'Spoils  ⏎' : 'Run over  ⏎', go, 200, 38);
    const ended = currentCampaign().run?.stop?.kind === 'end';
    const note = won
      ? ended
        ? 'You beat the ruler of the region!'
        : 'Your hurt fighters carry their wounds on; those who fell sit the next fight out.'
      : 'Your army fell: the run is over.';
    this.add.text(cx, cy + 32, note, textStyle(12, TEXT.muted)).setOrigin(0.5);
    new InputLayer(this).on('confirm', go);
  }

  private addButtons(cx: number, cy: number): void {
    addButton(this, cx - 105, cy, 'Rematch  ⏎', () => this.rematch(), 180, 38);
    addButton(this, cx + 105, cy, 'Move troops  Esc', () => this.moveTroops(), 180, 38);
    this.add.text(cx, cy + 32, 'Rematch keeps your placement; the battle plays out differently each time.', textStyle(12, TEXT.muted)).setOrigin(0.5);
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
    const { result: _result, seed: _seed, xp: _xp, outcome: _outcome, iq: _iq, mastery: _mastery, ...setup } = this.setup;
    return setup;
  }
}
