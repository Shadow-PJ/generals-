// Oaths of Command (session 5F, after Hades II's Oath of the Unseen and Thronefall's mutators):
// vows for your next run that make it harder, each rank adding Fear. Fear raises the Insight every
// battle earns, and winning a region above its highest Fear yet pays a bounty. A run already
// under way keeps the oaths it began with.
// ↑↓ pick an oath, ←→ (or Enter) change its rank, Esc goes back to the Capital.

import Phaser from 'phaser';
import { withOath } from '../../campaign/oaths';
import { MAX_FEAR, OATH_IDS, OATH_RULES, OATHS, fearOf, maxRank, rankOf } from '../../data/oaths';
import { REGION_IDS, REGIONS } from '../../data/regions';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { currentCampaign, saveCampaign } from '../session';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, addHint, textStyle } from '../ui';

const ROWS_X = 40;
const ROWS_Y = TOP_BAR_HEIGHT + 24;
const ROW_H = 54;
const RANK_X = 330;
const RANK_W = 540;

export class OathsScene extends Phaser.Scene {
  private row = 0;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Oaths');
  }

  init(): void {
    this.row = 0;
  }

  create(): void {
    fitCamera(this);
    this.add.text(16, 10, 'OATHS OF COMMAND', textStyle(18, TEXT.title, true));
    addHint(this, 16, 38, 'Vows for your next run: each makes it harder and adds Fear. ↑↓ pick, ←→ or Enter change, Esc back.', 'Vows for your next run: each makes it harder and adds Fear. ↑↓ pick, ←→ or Ⓐ change, Ⓑ back.', textStyle(12, TEXT.muted));
    addButton(this, GAME_WIDTH - 90, TOP_BAR_HEIGHT / 2, '◀ Capital  Esc', () => this.goBack(), 150, 34);
    this.ui = this.add.container(0, 0);
    new InputLayer(this)
      .on('up', () => this.moveRow(-1))
      .on('down', () => this.moveRow(1))
      .on('prev', () => this.moveRow(-1))
      .on('next', () => this.moveRow(1))
      .on('left', () => this.change(-1))
      .on('right', () => this.change(1))
      .on('confirm', () => this.change(1, true))
      .on('back', () => this.goBack())
      .on('oaths', () => this.goBack());
    this.render();
  }

  private moveRow(step: number): void {
    this.row = (this.row + step + OATH_IDS.length) % OATH_IDS.length;
    this.render();
  }

  /** One rank up or down; Enter goes round from the highest rank back to none. */
  private change(step: number, wrap = false): void {
    const campaign = currentCampaign();
    const id = OATH_IDS[this.row]!;
    let rank = rankOf(campaign.oaths, id) + step;
    if (wrap && rank > maxRank(id)) rank = 0;
    const next = withOath(campaign, id, rank);
    void saveCampaign(next)
      .catch(() => undefined)
      .then(() => this.scene.isActive() && this.render());
  }

  private goBack(): void {
    this.scene.start('Capital');
  }

  private render(): void {
    this.ui.removeAll(true);
    const campaign = currentCampaign();
    OATH_IDS.forEach((id, i) => {
      const y = ROWS_Y + i * ROW_H;
      const oath = OATHS[id];
      const rank = rankOf(campaign.oaths, id);
      const selected = i === this.row;
      if (selected) this.ui.add(this.add.rectangle(ROWS_X - 12, y - 8, GAME_WIDTH - 2 * ROWS_X + 24, ROW_H - 6, 0x2b3a50).setOrigin(0));
      const zone = this.add.zone(ROWS_X - 12, y - 8, GAME_WIDTH - 2 * ROWS_X + 24, ROW_H - 6).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => (this.row === i ? this.change(1, true) : ((this.row = i), this.render())));
      this.ui.add(zone);
      this.ui.add(this.add.text(ROWS_X, y, oath.name, textStyle(15, rank > 0 ? TEXT.threat : selected ? TEXT.title : TEXT.body, true)));
      this.ui.add(this.add.text(ROWS_X, y + 22, `+${oath.fearPerRank} Fear a rank`, textStyle(11, TEXT.muted)));
      // The ranks as pips, then what the rank taken (or the first) does.
      for (let r = 1; r <= maxRank(id); r++) {
        const filled = r <= rank;
        const box = this.add.rectangle(RANK_X - 62 + (r - 1) * 18, y + 9, 12, 12, filled ? COLORS.taunt : COLORS.hpBack).setStrokeStyle(1, COLORS.wallEdge);
        this.ui.add(box);
      }
      const what = rank > 0 ? `Rank ${rank} of ${maxRank(id)}: ${oath.ranks[rank - 1]}` : `Not taken · rank 1: ${oath.ranks[0]}`;
      this.ui.add(this.add.text(RANK_X, y, what, { ...textStyle(13, rank > 0 ? TEXT.body : TEXT.muted), wordWrap: { width: RANK_W } }));
    });

    const fear = fearOf(campaign.oaths);
    const y = ROWS_Y + OATH_IDS.length * ROW_H + 8;
    const insight = Math.round(OATH_RULES.insightPerFear * fear * 100);
    this.ui.add(this.add.text(ROWS_X, y, `FEAR ${fear} of ${MAX_FEAR}`, textStyle(20, fear > 0 ? TEXT.threat : TEXT.title, true)));
    this.ui.add(
      this.add.text(
        ROWS_X + 170,
        y + 2,
        `Every battle earns ${insight}% more Insight. Winning a region above its highest Fear yet pays ${OATH_RULES.bountyPerFear} Insight for each point above it.`,
        { ...textStyle(13, TEXT.body), wordWrap: { width: GAME_WIDTH - ROWS_X * 2 - 170 } },
      ),
    );
    const records = REGION_IDS.map((r) => `${REGIONS[r].name} ${campaign.fearRecords[r] ?? '—'}`).join('   ·   ');
    this.ui.add(this.add.text(ROWS_X, y + 48, `HIGHEST FEAR WON:   ${records}`, { ...textStyle(12, TEXT.muted, true), wordWrap: { width: GAME_WIDTH - 2 * ROWS_X } }));
    if (campaign.run) {
      this.ui.add(
        this.add.text(ROWS_X, GAME_HEIGHT - 40, `Your run through ${REGIONS[campaign.run.region].name} keeps the oaths it began with (Fear ${fearOf(campaign.run.oaths)}); these are for your next run.`, textStyle(12, TEXT.perfect)),
      );
    }
  }
}
