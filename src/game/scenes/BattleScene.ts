// The battle: runs the battle engine at a fixed 20 ticks per second and draws it every frame.
// This scene only reads the battle state; the engine alone changes it. Key presses reach the
// engine as inputs stamped with the tick they take effect on, so every battle can be replayed.

import Phaser from 'phaser';
import { hasLook } from '../../campaign/mastery';
import { cardCost } from '../../cards/cost';
import { shortCard } from '../../cards/describe';
import { COMMAND_RULES, CONDITION_RULES } from '../../data/command';
import type { CodexEntryId } from '../../data/combos';
import { BOSS_RULES, BOSSES } from '../../data/bosses';
import { GENERALS } from '../../data/generals';
import { LEGENDARY_ACTION_DATA, learnedActions } from '../../data/legendary';
import { MAPS, OPEN_FIELD } from '../../data/maps';
import { rankRules, RANKS } from '../../data/ranks';
import { SYNERGIES } from '../../data/synergies';
import { TUTORIAL_RULES } from '../../data/tutorial';
import { UNIT_CLASSES } from '../../data/units';
import {
  bloodPayer,
  chainTicksLeft,
  createBattle,
  hiddenFromSide,
  LEGENDARY_SLOT,
  momentumFull,
  nextLink,
  otherSide,
  overtimeMultiplier,
  secondsToTicks,
  SLOT_COUNT,
  slotCost,
  slotReadiness,
  stepBattle,
  TICKS_PER_SECOND,
  ultimateReady,
  type BattleEvent,
  type BattleInput,
  type BattleState,
  type Side,
  type Unit,
} from '../../sim';
import {
  createClock,
  frameBlend,
  setSpeed,
  ticksForFrame,
  togglePause,
  toggleSpeed,
  type BattleClock,
} from '../battleClock';
import { keyLabel, SLOT_ACTIONS } from '../bindings';
import { CaptainTips } from '../captain';
import { codexEntry } from '../codex';
import { playMusic, playSound } from '../audio/audio';
import { eventSounds } from '../audio/cues';
import { LUNGE_DISTANCE, LUNGE_MS, lungeShare, poseAt, RECOIL_DISTANCE } from '../art/animate';
import { addGround, portraitKey } from '../art/textures';
import { addFallen, ArrowSprites, Bursts, TroopSprites, type BurstKind } from '../battleFx';
import {
  drawBar,
  drawBarrier,
  drawBeam,
  drawCasting,
  drawChased,
  drawGeneralEffects,
  drawGravityWell,
  drawHeat,
  drawMark,
  drawRarity,
  drawRift,
  drawSilenced,
  drawSlowed,
  drawStun,
  drawTaunted,
  drawVibration,
  drawWall,
} from '../draw';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import type { MatchSetup } from '../match';
import { battleFacts } from '../battleFacts';
import { battleIq } from '../battleIq';
import { metChallenges } from '../mastery';
import { battleXp, withIqXp } from '../progress';
import { currentCampaign, currentSettings, recordCombo } from '../session';
import { threats } from '../threats';
import { battleMoments } from '../tutorial';
import { bossOf, fightOutcome } from '../campaignFlow';
import { enemyArmyOf, yourReserves } from '../troops';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_Y, COLORS, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { addButton, addHint, textStyle, type Button } from '../ui';

export interface BattleData extends MatchSetup {
  seed: number;
}

/** How long a troop flashes white after a hit, in milliseconds. */
const HIT_FLASH_MS = 120;
/** How long the boss banner, with its rule to read, stays before it fades, in milliseconds. */
const BOSS_BANNER_MS = 4000;
/** How long a combo banner stays before the next one may show, in milliseconds. */
const COMBO_BANNER_MS = 2000;
/** Pause between the last blow and the result screen, in milliseconds. */
const RESULT_DELAY_MS = 1400;

const SKILL_LABELS = {
  shove: 'Shove!',
  mark: 'Mark',
  barrier: 'Barrier',
  rift: 'Rift!',
  shadowstep: 'Shadowstep!',
  vampiricLink: 'Blood link',
  vent: 'Vent!',
  assimilation: 'Assimilated',
  phaseShift: 'Phase Shift!',
  shatter: 'Shatter!',
} as const;

/** The burst of particles each skill shows on the troop that used it. */
const SKILL_BURSTS: Readonly<Partial<Record<keyof typeof SKILL_LABELS, BurstKind>>> = {
  shove: 'dust',
  barrier: 'frost',
  rift: 'magic',
  shadowstep: 'puff',
  vampiricLink: 'fire',
  vent: 'fire',
  assimilation: 'heal',
  phaseShift: 'magic',
  shatter: 'heavy',
};

/** How long a melee swing's arc stays, in milliseconds. */
const SLASH_MS = 110;

/** How long a beam or a Gravity Well stays on screen, in milliseconds. */
const STRIKE_MS = 700;

const SLOT_W = 136;
const SLOT_H = 80;
const SLOT_GAP = 8;
const SLOT_Y = BOTTOM_BAR_Y + 10;
const PANEL_X = 16 + SLOT_COUNT * (SLOT_W + SLOT_GAP);

interface Point {
  x: number;
  y: number;
}

type PendingInput = { kind: 'slot'; slot: number } | { kind: 'ultimate' };

interface SlotTexts {
  key: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  card: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private setup!: BattleData;
  private state!: BattleState;
  private clock!: BattleClock;
  /** Key presses waiting for the next tick. */
  private pending: PendingInput[] = [];
  /** Where units and projectiles stood one tick ago, so movement can be drawn smoothly between ticks. */
  private previous = new Map<string, Point>();
  private flashUntil = new Map<number, number>();
  private slotFlashUntil = new Map<number, number>();
  private eventCursor = 0;
  private ended = false;
  /** Your General's look (all three Mastery challenges met): a gold trim on your troops. */
  private goldTrim = false;
  /** When the combo banner showing now is gone, so the next one waits its turn instead of overlapping. */
  private bannerFreeAt = 0;
  /** Troops merged away by Forced Evolution: gone, not fallen, so no mark is left where they stood. */
  private merged = new Set<number>();
  /** Ultimates that strike a place, shown for a moment: Thermal Detonation's beam, Gravity Well. */
  private strikes: { kind: 'beam' | 'well'; at: Point; to: Point | null; until: number }[] = [];

  /** Melee blows (a lunge toward the target) and shots (a small recoil), by troop: when, and which way. */
  private lunges = new Map<number, { at: number; dx: number; dy: number; recoil: boolean }>();
  /** Projectiles already seen, so a new one makes its shooter recoil once. */
  private seenShots = new Set<number>();
  /** Melee swings: a white arc in front of the striker for a moment. */
  private slashes: { x: number; y: number; angle: number; until: number }[] = [];

  private world!: Phaser.GameObjects.Container;
  private wallsLayer!: Phaser.GameObjects.Graphics;
  /** Under the troops: Rifts, shadows, slow rings, taunt lines. */
  private groundLayer!: Phaser.GameObjects.Graphics;
  private troopSprites!: TroopSprites;
  private arrowSprites!: ArrowSprites;
  private fallenLayer!: Phaser.GameObjects.Container;
  private bursts!: Bursts;
  /** Over the troops: rings, marks, bars and the other signs of what is happening to them. */
  private unitsLayer!: Phaser.GameObjects.Graphics;
  private topBar!: Phaser.GameObjects.Graphics;
  private bottomBar!: Phaser.GameObjects.Graphics;
  private clockText!: Phaser.GameObjects.Text;
  private overtimeText!: Phaser.GameObjects.Text;
  private pausedText!: Phaser.GameObjects.Text;
  private speedButtons!: { pause: Button; normal: Button; fast: Button };
  private slotTexts: SlotTexts[] = [];
  private pipsText!: Phaser.GameObjects.Text;
  private ultimateText!: Phaser.GameObjects.Text;
  /** The enemy commander's Momentum, and a warning when its ultimate is close. */
  private enemyCommandText!: Phaser.GameObjects.Text;
  private chainText!: Phaser.GameObjects.Text;
  private chainBar!: Phaser.GameObjects.Graphics;
  private threatTexts = new Map<number, Phaser.GameObjects.Text>();
  /** The Captain's tips in your first battles. */
  private tips!: CaptainTips;

  constructor() {
    super('Battle');
  }

  init(data: BattleData): void {
    this.setup = data;
    const enemy = enemyArmyOf(data);
    this.state = createBattle({
      seed: data.seed,
      map: MAPS[data.map],
      player: data.placement,
      enemy: enemy.placement,
      loadout: data.loadout,
      rank: data.rank,
      reserves: { player: yourReserves(data), enemy: enemy.reserves },
      tactical: data.tactical,
      general: data.general,
      enemyGeneral: enemy.general,
      enemyCommander: enemy.commander,
      specs: { player: data.specs, enemy: enemy.specs },
      learned: learnedActions(data.bossesBeaten),
      boons: { player: data.fight?.boons ?? [] },
      tech: { player: data.fight?.tech ?? {} },
      boss: bossOf(data),
    });
    this.clock = createClock();
    this.pending = [];
    this.previous = new Map();
    this.flashUntil = new Map();
    this.slotFlashUntil = new Map();
    this.threatTexts = new Map();
    this.slotTexts = [];
    this.eventCursor = 0;
    this.ended = false;
    this.goldTrim = hasLook(currentCampaign(), data.general);
    this.bannerFreeAt = 0;
    this.merged = new Set();
    this.strikes = [];
    this.lunges = new Map();
    this.seenShots = new Set();
    this.slashes = [];
  }

  create(): void {
    fitCamera(this);
    this.world = this.add.container(0, TOP_BAR_HEIGHT);
    const ground = addGround(this, this.state.map);
    this.fallenLayer = this.add.container(0, 0);
    this.wallsLayer = this.add.graphics();
    this.groundLayer = this.add.graphics();
    this.troopSprites = new TroopSprites(this);
    this.arrowSprites = new ArrowSprites(this);
    this.unitsLayer = this.add.graphics();
    this.bursts = new Bursts(this);
    this.world.add([
      ground,
      this.fallenLayer,
      this.wallsLayer,
      this.groundLayer,
      this.troopSprites.layer,
      this.arrowSprites.layer,
      this.unitsLayer,
      ...this.bursts.emitters,
    ]);

    this.topBar = this.add.graphics();
    this.add.text(16, 8, `YOU · ${GENERALS[this.setup.general].name.toUpperCase()}`, textStyle(12, TEXT.muted, true));
    this.add.text(GAME_WIDTH - 16, 8, `${GENERALS[this.state.generals.enemy].name.toUpperCase()} · ENEMY`, textStyle(12, TEXT.muted, true)).setOrigin(1, 0);
    // Both Generals' portraits, beside their armies' HP bars.
    this.add.image(16 + 300 + 8, 6, portraitKey(this.setup.general)).setOrigin(0).setScale(2).setDepth(1);
    this.add.image(GAME_WIDTH - 16 - 300 - 8, 6, portraitKey(this.state.generals.enemy)).setOrigin(1, 0).setScale(2).setFlipX(true).setDepth(1);
    this.enemyCommandText = this.add.text(GAME_WIDTH - 16, 44, '', textStyle(12, TEXT.muted, true)).setOrigin(1, 0);
    this.clockText = this.add.text(GAME_WIDTH / 2, 6, '0:00', textStyle(22, TEXT.title, true)).setOrigin(0.5, 0);
    this.overtimeText = this.add.text(GAME_WIDTH / 2 + 50, 12, '', textStyle(13, TEXT.overtime, true));
    this.pausedText = this.add.text(GAME_WIDTH / 2 - 50, 12, '', textStyle(13, TEXT.perfect, true)).setOrigin(1, 0);
    addHint(this, 16, 44, '1-5: cards   U: ultimate   Space: pause   F: speed', 'ⓍⓎⒷⒶ RB: cards   RT: ultimate   Menu: pause   LB: speed', textStyle(12, TEXT.muted));

    const y = 48;
    this.speedButtons = {
      pause: addButton(this, GAME_WIDTH / 2 - 62, y, '❚❚', () => togglePause(this.clock), 54, 22),
      normal: addButton(this, GAME_WIDTH / 2, y, '1x', () => setSpeed(this.clock, 1), 54, 22),
      fast: addButton(this, GAME_WIDTH / 2 + 62, y, '2x', () => setSpeed(this.clock, 2), 54, 22),
    };

    this.createBottomBar();
    this.chainBar = this.add.graphics();
    this.chainText = this.add.text(GAME_WIDTH - 16, BOTTOM_BAR_Y - 30, '', textStyle(22, TEXT.combo, true)).setOrigin(1, 0);

    const input = new InputLayer(this)
      .on('pause', () => togglePause(this.clock))
      .on('speed', () => toggleSpeed(this.clock))
      .on('ultimate', () => this.pending.push({ kind: 'ultimate' }));
    SLOT_ACTIONS.forEach((action, slot) => input.on(action, () => this.pending.push({ kind: 'slot', slot })));

    this.tips = new CaptainTips(this, { x: (GAME_WIDTH - 380) / 2, width: 380, top: TOP_BAR_HEIGHT + 30 }, this.setup.general);
    this.tips.say([{ id: 'battleStart' }], TUTORIAL_RULES.battleTipSeconds);

    const boss = this.state.boss;
    playMusic(boss ? 'boss' : 'battle');
    playSound('fight');
    if (boss) this.banner(`BOSS: ${GENERALS[boss].name.toUpperCase()}`, TEXT.threat, BOSSES[boss].rule, BOSS_BANNER_MS);
    else this.banner('FIGHT!', TEXT.title, this.setup.tactical ? 'Tactical mode: the battle pauses every 10 s' : undefined);
  }

  override update(time: number, delta: number): void {
    if (!this.state.result) {
      const ticks = ticksForFrame(this.clock, delta);
      for (let i = 0; i < ticks && !this.state.result && !this.clock.paused; i++) {
        this.rememberPositions();
        stepBattle(this.state, this.takeInputs());
        this.tacticalPause();
      }
      this.showNewEvents(time);
      if (!this.state.result && !this.tips.showing) this.tips.say(battleMoments(this.state), TUTORIAL_RULES.battleTipSeconds);
      if (this.state.result && !this.ended) {
        this.ended = true;
        this.tips.hide();
        this.time.delayedCall(RESULT_DELAY_MS, () => {
          const result = this.state.result!;
          // The Battle IQ report reads the event log; in a campaign battle its grade earns XP.
          const iq = battleIq(this.state);
          const base = battleXp(this.state.events, result);
          const xp = this.setup.fight ? withIqXp(base, iq.grade, iq.xp) : base;
          // A campaign fight also tells the run how each fighter came out of it, and checks your General's Mastery challenges.
          const outcome = this.setup.fight ? fightOutcome(this.state, xp.total) : null;
          const mastery = this.setup.fight ? metChallenges(this.setup.general, battleFacts(this.state)) : [];
          this.scene.launch('Result', { ...this.setup, result, xp, outcome, iq, mastery });
          this.scene.pause();
        });
      }
    }
    this.draw(time, this.state.result ? 1 : frameBlend(this.clock));
  }

  /** Stamps the waiting key presses with the tick about to run. */
  private takeInputs(): BattleInput[] {
    const tick = this.state.tick;
    const inputs = this.pending.map((p): BattleInput => (p.kind === 'slot' ? { tick, kind: 'slot', slot: p.slot } : { tick, kind: 'ultimate' }));
    this.pending = [];
    return inputs;
  }

  /** Tactical mode: stop every 10 s so cards can be chosen without hurry. */
  private tacticalPause(): void {
    const every = secondsToTicks(COMMAND_RULES.tacticalPauseSeconds);
    if (!this.setup.tactical || this.state.result || this.state.tick % every !== 0) return;
    this.clock.paused = true;
    this.banner('TACTICAL PAUSE', TEXT.title, `Pick your cards, then press ${keyLabel('pause')} to go on`);
  }

  private rememberPositions(): void {
    this.previous.clear();
    for (const u of this.state.units) this.previous.set(`u${u.id}`, { x: u.x, y: u.y });
    for (const p of this.state.projectiles) this.previous.set(`p${p.id}`, { x: p.x, y: p.y });
  }

  private smoothed(key: string, x: number, y: number, blend: number): Point {
    const before = this.previous.get(key);
    if (!before) return { x, y };
    return { x: before.x + (x - before.x) * blend, y: before.y + (y - before.y) * blend };
  }

  /** Turns new battle events into effects: hit flashes, skill names, cards, the ultimate, Overtime. */
  private showNewEvents(time: number): void {
    const events = this.state.events;
    for (; this.eventCursor < events.length; this.eventCursor++) {
      const e = events[this.eventCursor]!;
      for (const sound of eventSounds(e)) playSound(sound);
      if (e.type === 'damage' && e.amount + e.absorbed > 0) {
        // Blows flash the troop; burns and Rift pulses only spark, or a troop in a Rift would glow all the time.
        if (e.cause !== 'burn' && e.cause !== 'rift') this.flashUntil.set(e.targetId, time + HIT_FLASH_MS);
        this.showHit(e, time);
        const unit = e.cause === 'execute' ? this.unit(e.targetId) : undefined;
        if (unit) this.popup(unit.x, unit.y - 34, 'Executed!', TEXT.threat);
      } else if (e.type === 'interrupted') {
        const unit = this.unit(e.unitId);
        if (unit) this.popup(unit.x, unit.y - 26, 'Interrupted!', TEXT.overtime);
      } else if (e.type === 'phased') {
        const unit = this.unit(e.unitId);
        if (unit) {
          this.popup(unit.x, unit.y - 26, 'Phased!', TEXT.combo);
          this.bursts.burst('magic', unit.x, unit.y);
        }
      } else if (e.type === 'stolen') {
        const victim = this.unit(e.victimId);
        const trait = BOSS_RULES.hiveMother.steals[e.trait];
        if (victim) this.popup(victim.x, victim.y - 34, `Stolen: ${trait.name}`, TEXT.threat);
      } else if (e.type === 'enraged') {
        if (e.stacks > 1) this.banner(`RAGE ×${e.stacks}`, TEXT.threat, 'His army hits harder for every troop it loses');
      } else if (e.type === 'synergy') {
        const synergy = SYNERGIES.find((s) => s.id === e.synergy)!;
        if (e.side === 'player') this.comboBanner(`${synergy.name.toUpperCase()}!`, synergy.bonusText, this.found(e.synergy));
      } else if (e.type === 'skill') {
        const unit = this.unit(e.unitId);
        if (unit) {
          this.popup(unit.x, unit.y - 26, SKILL_LABELS[e.skill], unit.side === 'player' ? '#bfe0ff' : '#ffc9c0');
          const burst = SKILL_BURSTS[e.skill];
          if (burst) this.bursts.burst(burst, unit.x, unit.y);
        }
      } else if (e.type === 'death') {
        const unit = this.unit(e.unitId);
        if (unit) {
          this.popup(unit.x, unit.y - 20, '✖', unit.side === 'player' ? '#7fb8ff' : '#ff8f80');
          addFallen(this, this.fallenLayer, unit.rooted ? 'turret' : unit.cls, unit.side, unit.x, unit.y);
          this.bursts.burst('puff', unit.x, unit.y + 6);
        }
      } else if (e.type === 'wallBreak') {
        const wall = this.state.walls.find((w) => w.id === e.wallId);
        if (wall) {
          this.popup(wall.x + wall.w / 2, wall.y + wall.h / 2, 'Wall broken!', TEXT.title);
          this.bursts.burstOver('stone', wall.x, wall.y, wall.w, wall.h, 6);
          this.bursts.burstOver('dust', wall.x, wall.y, wall.w, wall.h, 4);
          this.shake(180, 0.004);
        }
      } else if (e.type === 'overtime') {
        this.banner('OVERTIME', TEXT.overtime, 'Damage grows every second');
      } else if (e.type === 'cardFired' && e.side === 'player') {
        this.slotFlashUntil.set(e.slot, time + 450);
        const x = 16 + e.slot * (SLOT_W + SLOT_GAP) + SLOT_W / 2;
        const label = (e.perfect ? 'PERFECT!' : e.auto ? 'Auto' : 'Go!') + (e.link > 1 ? `  x${e.link}` : '');
        this.screenPopup(x, SLOT_Y - 6, label, e.perfect ? TEXT.perfect : e.link > 1 ? TEXT.combo : TEXT.body, e.perfect || e.link > 1 ? 18 : 13);
      } else if (e.type === 'cardFired') {
        // The enemy commander's cards: what it ordered, under its HP bar.
        const card = this.state.enemyCommand?.slots[e.slot]?.card;
        if (card) this.screenPopup(GAME_WIDTH - 166, TOP_BAR_HEIGHT + 30, `Enemy: ${shortCard(card)}`, TEXT.threat, 13);
      } else if (e.type === 'combo') {
        const entry = codexEntry(e.combo);
        if (e.side === 'player') this.comboBanner(`${entry.name.toUpperCase()}!`, entry.bonusText, this.found(e.combo));
        else this.screenPopup(GAME_WIDTH - 166, TOP_BAR_HEIGHT + 52, `Enemy combo: ${entry.name}!`, TEXT.threat, 15);
      } else if (e.type === 'ultimate') {
        const ultimate = GENERALS[this.state.generals[e.side]].ultimate;
        const name = ultimate.name.toUpperCase();
        if (e.side === 'enemy') this.banner(`ENEMY ${name}!`, TEXT.threat, ultimate.text);
        else if (e.finisher) this.comboBanner(`FINISHER: ${name}!`, `${ultimate.text}. 50% stronger.`, this.found('finisher'));
        else this.banner(`${name}!`, TEXT.perfect, ultimate.text);
        if (e.name === 'thermalDetonation' && e.at && e.to) this.strikes.push({ kind: 'beam', at: e.at, to: e.to, until: time + STRIKE_MS });
        if (e.name === 'gravityWell' && e.at) this.strikes.push({ kind: 'well', at: e.at, to: null, until: time + STRIKE_MS });
        // The whole field flashes in the side's color, and shakes.
        const color = COLORS.side[e.side];
        this.cameras.main.flash(260, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
        this.shake(320, 0.007);
      } else if (e.type === 'evolved') {
        this.merged.add(e.mergedId);
        const unit = this.unit(e.unitId);
        if (unit) {
          this.popup(unit.x, unit.y - 30, 'Evolved!', '#fde68a');
          this.bursts.burst('gold', unit.x, unit.y);
        }
      } else if (e.type === 'revived') {
        const unit = this.unit(e.unitId);
        if (unit) this.bursts.burst('gold', unit.x, unit.y);
      } else if (e.type === 'legendary') {
        this.showLegendary(e);
      } else if (e.type === 'reserveCalled') {
        const unit = this.unit(e.unitId);
        if (unit) {
          this.popup(unit.x, unit.y - 26, 'Reserve arrives!', '#bfe0ff');
          this.bursts.burst('dust', unit.x, unit.y + 8);
        }
      }
    }
  }

  /** A blow landing: sparks (or fire, or magic) on the target, and a melee striker leaning into it. */
  private showHit(e: Extract<BattleEvent, { type: 'damage' }>, time: number): void {
    const target = this.unit(e.targetId);
    if (!target) return;
    const kind: BurstKind =
      e.cause === 'burn' ? 'fire' : e.cause === 'rift' ? 'magic' : e.cause === 'shove' ? 'heavy' : e.amount === 0 ? 'frost' : 'hit';
    this.bursts.burst(kind, target.x, target.y - 4, e.amount >= 40 ? 1.5 : 1);
    const source = e.cause === 'attack' ? this.unit(e.sourceId) : undefined;
    if (!source || source.cls === 'ranger' || source.rooted) return;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const len = Math.hypot(dx, dy) || 1;
    this.lunges.set(source.id, { at: time, dx: dx / len, dy: dy / len, recoil: false });
    this.slashes.push({ x: source.x + (dx / len) * 14, y: source.y + (dy / len) * 14, angle: Math.atan2(dy, dx), until: time + SLASH_MS });
  }

  /** Shakes the battlefield, unless the player turned shaking off in Settings. */
  private shake(ms: number, intensity: number): void {
    if (currentSettings().screenShake) this.cameras.main.shake(ms, intensity);
  }

  /** A Legendary action: its name across the field, and a word over each troop it acted on. */
  private showLegendary(e: Extract<BattleEvent, { type: 'legendary' }>): void {
    const action = LEGENDARY_ACTION_DATA[e.action];
    const yours = e.side === 'player';
    this.banner(`${yours ? '' : 'ENEMY '}${action.name.toUpperCase()}!`, yours ? TEXT.perfect : TEXT.threat, action.text);
    if (e.at) this.bursts.burst('dust', e.at.x, e.at.y, 2);
    const words = { hijack: 'Hijacked!', swap: 'Swapped!', bloodPact: 'Sacrificed', fortify: '', echo: '' } as const;
    for (const id of e.unitIds) {
      const unit = this.unit(id);
      if (unit && words[e.action]) this.popup(unit.x, unit.y - 30, words[e.action], TEXT.perfect);
    }
  }

  private unit(id: number | null): Unit | undefined {
    return id === null ? undefined : this.state.units[id - 1];
  }

  private draw(time: number, blend: number): void {
    const walls = this.wallsLayer.clear();
    for (const wall of this.state.walls) drawWall(walls, wall, this.state.map.id);

    const under = this.groundLayer.clear();
    const g = this.unitsLayer.clear();
    // Rifts lie on the ground, under everyone.
    const riftTicks = secondsToTicks(UNIT_CLASSES.invoker.rift.durationSeconds);
    const pulseTicks = secondsToTicks(UNIT_CLASSES.invoker.rift.pulseSeconds);
    for (const zone of this.state.zones) drawRift(under, zone, zone.ticksLeft / riftTicks, Math.max(0, zone.pulseIn / pulseTicks - 0.5) * 2, time);
    const focused = new Set<number>();
    this.troopSprites.begin();
    for (const u of this.state.units) {
      if (!u.alive) continue;
      const at = this.smoothed(`u${u.id}`, u.x, u.y, blend);
      const r = u.stats.radius;
      const face = this.facing(u, at);
      const flash = Math.max(0, ((this.flashUntil.get(u.id) ?? 0) - time) / HIT_FLASH_MS);
      // Troops the other side can't see (Shadow Escort, or deep in the woods) show faintly: yours a little clearer.
      const hidden = u.invisibleTicks > 0 || (!this.state.result && hiddenFromSide(this.state, u, otherSide(u.side)));
      const alpha = hidden ? (u.side === 'player' ? 0.35 : 0.15) : 1;
      // Walking, standing, and leaning into a blow.
      const before = this.previous.get(`u${u.id}`);
      const moving = !this.state.result && !this.clock.paused && before !== undefined && Math.abs(before.x - u.x) + Math.abs(before.y - u.y) > 0.05;
      const pose = poseAt(moving && !u.rooted, time, u.id);
      const lunge = this.lunges.get(u.id);
      const lean = lunge ? lungeShare(time - lunge.at) * (lunge.recoil ? -RECOIL_DISTANCE : LUNGE_DISTANCE) : 0;
      if (lunge && time - lunge.at >= LUNGE_MS) this.lunges.delete(u.id);
      const x = at.x + (lunge?.dx ?? 0) * lean;
      const y = at.y + (lunge?.dy ?? 0) * lean + pose.bob;
      this.troopSprites.show(u.id, {
        cls: u.rooted ? 'turret' : u.cls,
        side: u.side,
        frame: pose.frame,
        x,
        y,
        flipX: face.x < at.x,
        alpha: u.wraithTicks > 0 ? Math.min(alpha, 0.75) : alpha,
        flash: hidden ? 0 : flash,
        tint: u.wraithTicks > 0 ? COLORS.wraith : null,
        size: u.elite ? 1.25 : 1,
      });
      if (hidden && u.side === 'enemy') continue; // Only a faint shape: no shadow, HP bar or effects to give it away.
      under.fillStyle(0x000000, 0.28 * alpha).fillEllipse(at.x, at.y + r * 0.9, r * 1.7, r * 0.55);
      if (u.slow) drawSlowed(under, at.x, at.y, r);
      const taunter = u.taunt ? this.unit(u.taunt.unitId) : undefined;
      if (taunter?.alive) drawTaunted(under, at.x, at.y, this.smoothed(`u${taunter.id}`, taunter.x, taunter.y, blend));
      drawGeneralEffects(g, at.x, at.y, r, u);
      if (u.barrier) drawBarrier(g, at.x, at.y, r, u.barrier.amount / UNIT_CLASSES.guardian.barrier.amount);
      if (u.rallyTicks > 0) g.lineStyle(2, COLORS.glow, 0.7).strokeCircle(at.x, at.y, r + 9);
      // Hijacked: a ring in the color of the side that controls it.
      if (u.hijackTicks > 0) g.lineStyle(3, COLORS.side[otherSide(u.side)], 0.95).strokeCircle(at.x, at.y, r + 6);
      drawRarity(g, at.x, at.y, r, u.rarity, alpha);
      // General Mastery: with all three of your General's challenges met, your troops wear a gold trim.
      if (this.goldTrim && u.side === 'player') g.lineStyle(2, COLORS.capital, alpha).strokeCircle(at.x, at.y, r + 2);
      // Boss fights: the Warlord's rage, the Strategist's phases left (a turret wears its own tower).
      if (u.rage) g.lineStyle(1 + u.rage.stacks, COLORS.haste, 0.85).strokeCircle(at.x, at.y, r + 8);
      for (let i = 0; i < u.bossPhases; i++) g.fillStyle(COLORS.chased, 1).fillCircle(at.x - 5 * (u.bossPhases - 1) + i * 10, at.y - r - 21, 3);
      if (u.casting) {
        const total = secondsToTicks(UNIT_CLASSES.invoker.rift.castSeconds);
        drawCasting(g, at.x, at.y, r, u.casting, 1 - u.casting.ticksLeft / total);
      }
      if (u.mark) drawMark(g, at.x, at.y, r);
      if (u.chased) drawChased(g, at.x, at.y, r);
      if (u.silencedTicks > 0) drawSilenced(g, at.x, at.y, r);
      if (u.vibration || u.shatterTicks > 0) drawVibration(g, at.x, at.y, r, u.vibration?.stacks ?? 0, u.shatterTicks > 0);
      if (u.heat > 0) drawHeat(g, at.x, at.y, r, u.heat);
      if (u.stunTicks > 0 && !u.knockback) drawStun(g, at.x, at.y, r, time);
      drawBar(g, at.x, at.y - r - 13, 26, u.hp / u.stats.maxHp);
      // A small white dot: this troop is carrying out a card order.
      const order = u.orders[0];
      if (order?.started) {
        g.fillStyle(0xffffff, 0.9).fillCircle(at.x, at.y + r + 8, 2.5);
        if (order.kind === 'focus' && order.unitId !== null) focused.add(order.unitId);
      }
    }
    this.troopSprites.end();
    for (const id of focused) {
      const t = this.unit(id);
      if (!t?.alive || t.invisibleTicks > 0 || hiddenFromSide(this.state, t, otherSide(t.side))) continue;
      const at = this.smoothed(`u${t.id}`, t.x, t.y, blend);
      g.lineStyle(2, COLORS.invalid, 0.9).strokeCircle(at.x, at.y, t.stats.radius + 12);
    }
    // Melee swings: a white arc in front of the striker.
    this.slashes = this.slashes.filter((s) => s.until > time);
    for (const s of this.slashes) {
      const share = (s.until - time) / SLASH_MS;
      g.lineStyle(3, 0xffffff, 0.8 * share);
      g.beginPath().arc(s.x, s.y, 10, s.angle - 1, s.angle + 1).strokePath();
    }
    this.strikes = this.strikes.filter((s) => s.until > time);
    for (const s of this.strikes) {
      const share = (s.until - time) / STRIKE_MS;
      if (s.kind === 'beam' && s.to) drawBeam(g, s.at, s.to, share);
      else drawGravityWell(g, s.at, share, time);
    }
    // Arrows and bolts, turned along their flight; a new one makes its shooter rock back.
    this.arrowSprites.begin();
    for (const p of this.state.projectiles) {
      const at = this.smoothed(`p${p.id}`, p.x, p.y, blend);
      const target = this.unit(p.targetId);
      const tail = this.previous.get(`p${p.id}`);
      const dx = tail && (tail.x !== p.x || tail.y !== p.y) ? p.x - tail.x : (target?.x ?? p.x + 1) - p.x;
      const dy = tail && (tail.x !== p.x || tail.y !== p.y) ? p.y - tail.y : (target?.y ?? p.y) - p.y;
      const owner = this.unit(p.ownerId);
      const tint = p.element === 'burn' ? 0xffb24a : p.element === 'frost' ? 0xc8efff : null;
      this.arrowSprites.show(p.id, p.side, at.x, at.y, Math.atan2(dy, dx), owner?.rooted ?? false, tint);
      if (!this.seenShots.has(p.id)) {
        this.seenShots.add(p.id);
        playSound('arrow');
        if (owner) {
          const len = Math.hypot(dx, dy) || 1;
          this.lunges.set(owner.id, { at: time, dx: dx / len, dy: dy / len, recoil: true });
        }
      }
    }
    this.arrowSprites.end();

    this.drawThreats(blend);
    this.drawTopBar();
    this.drawBottomBar(time);
    this.drawChain();
  }

  /** The chain counter, x2, x3 ..., over the right end of the slot bar, with the time left to add a link. */
  private drawChain(): void {
    const g = this.chainBar.clear();
    const left = this.state.result ? 0 : chainTicksLeft(this.state);
    const links = this.state.command.chain.links;
    if (left <= 0 || links < 1) {
      this.chainText.setText('');
      return;
    }
    const seconds = COMMAND_RULES.chain.windowSeconds;
    this.chainText.setText(links >= 2 ? `CHAIN x${links}` : `Chain open: next card within ${seconds} s`).setFontSize(links >= 2 ? 22 : 13);
    const width = 150;
    const share = left / secondsToTicks(COMMAND_RULES.chain.windowSeconds);
    g.fillStyle(COLORS.hpBack, 0.9).fillRect(GAME_WIDTH - 16 - width, BOTTOM_BAR_Y - 6, width, 4);
    g.fillStyle(COLORS.chased, 1).fillRect(GAME_WIDTH - 16 - width, BOTTOM_BAR_Y - 6, width * share, 4);
  }

  /** Threat Readout: "Ranger falls in ~3 s" over troops about to fall. */
  private drawThreats(blend: number): void {
    const warnings = this.state.result ? [] : threats(this.state);
    const shown = new Set(warnings.map((w) => w.unitId));
    for (const [id, text] of this.threatTexts) if (!shown.has(id)) text.setVisible(false);
    for (const w of warnings) {
      const u = this.unit(w.unitId)!;
      const at = this.smoothed(`u${u.id}`, u.x, u.y, blend);
      let text = this.threatTexts.get(w.unitId);
      if (!text) {
        text = this.add.text(0, 0, '', textStyle(11, TEXT.threat, true)).setOrigin(0.5, 1);
        this.world.add(text);
        this.threatTexts.set(w.unitId, text);
      }
      text.setText(w.text).setPosition(at.x, at.y - u.stats.radius - 13).setVisible(true);
    }
  }

  /** Rangers and Assassins point at what they are after; otherwise troops face the enemy's side. */
  private facing(u: Unit, at: Point): Point {
    const target = this.unit(u.targetId);
    if (target && target.side !== u.side) return { x: target.x, y: target.y };
    return { x: at.x + (u.side === 'player' ? 100 : -100), y: at.y };
  }

  private drawTopBar(): void {
    const g = this.topBar.clear();
    g.fillStyle(COLORS.background, 1).fillRect(0, 0, GAME_WIDTH, TOP_BAR_HEIGHT);
    const share = (side: Side) =>
      this.state.units.filter((u) => u.side === side && u.alive).reduce((sum, u) => sum + u.hp, 0) /
      this.state.startHp[side];
    this.armyBar(g, 16, share('player'), 'player');
    this.armyBar(g, GAME_WIDTH - 16 - 300, share('enemy'), 'enemy');

    const seconds = Math.floor(this.state.tick / TICKS_PER_SECOND);
    this.clockText.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    const boost = overtimeMultiplier(this.state.tick) - 1;
    this.overtimeText.setText(boost > 0 ? `OVERTIME +${Math.round(boost * 100)}%` : '');

    const enemy = this.state.enemyCommand;
    if (enemy) {
      const share = enemy.momentum / COMMAND_RULES.momentum.max;
      const ultimate = GENERALS[this.state.generals.enemy].ultimate.name;
      const charging = share >= CONDITION_RULES.ultimateChargingShare;
      this.enemyCommandText
        .setText(`Commander: ${enemy.pips} pips · ${ultimate} ${Math.floor(Math.min(1, share) * 100)}%${charging ? '  CHARGING!' : ''}`)
        .setColor(charging ? TEXT.threat : TEXT.muted);
    }

    this.pausedText.setText(`PAUSED · ${keyLabel('pause')} to go on`).setVisible(this.clock.paused && !this.state.result);
    this.speedButtons.pause.setHighlighted(this.clock.paused);
    this.speedButtons.normal.setHighlighted(!this.clock.paused && this.clock.speed === 1);
    this.speedButtons.fast.setHighlighted(!this.clock.paused && this.clock.speed === 2);
  }

  /** An army's HP left, as a long bar in its color; the enemy's drains from the right. */
  private armyBar(g: Phaser.GameObjects.Graphics, x: number, share: number, side: Side): void {
    const width = 300;
    const filled = width * Math.max(0, Math.min(1, share));
    g.fillStyle(COLORS.hpBack, 1).fillRect(x, 24, width, 12);
    g.fillStyle(COLORS.side[side], 1).fillRect(side === 'player' ? x : x + width - filled, 24, filled, 12);
    g.lineStyle(1, COLORS.sideDark[side], 1).strokeRect(x, 24, width, 12);
  }

  // The slot bar ------------------------------------------------------------------------------

  private createBottomBar(): void {
    this.bottomBar = this.add.graphics();
    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = 16 + i * (SLOT_W + SLOT_GAP);
      const hit = this.add.rectangle(x, SLOT_Y, SLOT_W, SLOT_H, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.pending.push({ kind: 'slot', slot: i }));
      const card = this.state.command.slots[i]?.card;
      this.slotTexts.push({
        key: this.add.text(x + 8, SLOT_Y + 5, String(i + 1), textStyle(15, TEXT.title, true)),
        cost: this.add.text(x + SLOT_W - 8, SLOT_Y + 7, card ? '●'.repeat(cardCost(card)) : '', textStyle(12, '#7dd3fc')).setOrigin(1, 0),
        card: this.add.text(x + 8, SLOT_Y + 24, card ? shortCard(card) : '', {
          ...textStyle(11),
          wordWrap: { width: SLOT_W - 16 },
          maxLines: 3,
        }),
        status: this.add.text(x + 8, SLOT_Y + SLOT_H - 17, '', textStyle(10, TEXT.muted)),
      });
    }
    this.add.text(PANEL_X, SLOT_Y + 2, 'PIPS', textStyle(11, TEXT.muted, true));
    this.pipsText = this.add.text(GAME_WIDTH - 16, SLOT_Y + 2, '', textStyle(11, TEXT.muted)).setOrigin(1, 0);
    this.add.text(PANEL_X, SLOT_Y + 40, 'MOMENTUM', textStyle(11, TEXT.muted, true));
    this.ultimateText = this.add.text(PANEL_X, SLOT_Y + 64, '', textStyle(12, TEXT.muted, true));
    this.add
      .rectangle(PANEL_X, SLOT_Y + 38, GAME_WIDTH - 16 - PANEL_X, 44, 0, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.pending.push({ kind: 'ultimate' }));
  }

  private drawBottomBar(time: number): void {
    const g = this.bottomBar.clear();
    g.fillStyle(COLORS.background, 1).fillRect(0, BOTTOM_BAR_Y, GAME_WIDTH, BOTTOM_BAR_HEIGHT);
    const command = this.state.command;
    const pulse = 0.55 + 0.45 * Math.sin(time / 120);

    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = 16 + i * (SLOT_W + SLOT_GAP);
      const slot = command.slots[i]!;
      const readiness = slotReadiness(this.state, i);
      const texts = this.slotTexts[i]!;
      const dim = readiness === 'locked' || readiness === 'empty';
      g.fillStyle(dim ? 0x141a23 : 0x1d2939, 1).fillRect(x, SLOT_Y, SLOT_W, SLOT_H);
      let border: [number, number, number] = [1, 0x34465e, 1];
      if (slot.glowing && readiness !== 'locked') border = [3, COLORS.glow, pulse];
      if ((this.slotFlashUntil.get(i) ?? 0) > time) border = [3, 0xffffff, 1];
      g.lineStyle(border[0], border[1], border[2]).strokeRect(x, SLOT_Y, SLOT_W, SLOT_H);
      if (readiness === 'resting') {
        const total = secondsToTicks(COMMAND_RULES.slotRestSeconds);
        g.fillStyle(0x000000, 0.45).fillRect(x, SLOT_Y, SLOT_W, SLOT_H);
        g.fillStyle(COLORS.pip, 0.8).fillRect(x, SLOT_Y + SLOT_H - 3, SLOT_W * (1 - slot.restTicks / total), 3);
      }
      const cost = slotCost(this.state, i);
      const discounted = cost !== null && slot.card !== null && cost < cardCost(slot.card);
      texts.cost.setText(cost === null ? '' : '●'.repeat(cost)).setColor(discounted ? TEXT.victory : '#7dd3fc');
      // The slot's key, or its controller button: X, Y, B, A and RB.
      texts.key.setText(keyLabel(SLOT_ACTIONS[i]!)).setAlpha(dim ? 0.4 : 1);
      texts.card.setAlpha(readiness === 'ready' ? 1 : 0.6);
      texts.status.setText(this.slotStatus(i, readiness)).setColor(readiness === 'ready' ? TEXT.victory : TEXT.muted);
    }

    // Pips: one circle per pip you can hold, and a thin bar filling toward the next one.
    const interval = secondsToTicks(COMMAND_RULES.pipRefillSeconds);
    for (let p = 0; p < command.maxPips; p++) {
      const cx = PANEL_X + 10 + p * 22;
      const cy = SLOT_Y + 26;
      if (p < command.pips) g.fillStyle(COLORS.pip, 1).fillCircle(cx, cy, 8);
      g.lineStyle(2, COLORS.pip, 0.8).strokeCircle(cx, cy, 8);
    }
    const width = GAME_WIDTH - 16 - PANEL_X;
    g.fillStyle(COLORS.pip, 0.5).fillRect(PANEL_X, SLOT_Y + 36, width * Math.min(1, command.pipProgress / interval), 2);
    this.pipsText.setText(`${command.pips}/${command.maxPips}`);

    // Momentum and the ultimate.
    const share = command.momentum / COMMAND_RULES.momentum.max;
    g.fillStyle(COLORS.hpBack, 1).fillRect(PANEL_X, SLOT_Y + 55, width, 6);
    g.fillStyle(COLORS.momentum, share >= 1 ? pulse : 1).fillRect(PANEL_X, SLOT_Y + 55, width * Math.min(1, share), 6);
    const ready = ultimateReady(this.state);
    const finisher = ready && rankRules(command.rank).finishers && nextLink(this.state) >= COMMAND_RULES.finisher.minLinks;
    const ultimate = GENERALS[this.setup.general].ultimate;
    const u = keyLabel('ultimate');
    let label = `${u}: ${ultimate.name}  ${Math.floor(share * 100)}%`;
    if (finisher) label = `${u}: FINISHER now!`;
    else if (ready) label = `${u}: ${ultimate.name.toUpperCase()} ready!`;
    else if (momentumFull(this.state)) label = `${u}: ${ultimate.name} needs ${ultimate.needs ?? 'a moment'}`;
    this.ultimateText.setText(label).setColor(finisher ? TEXT.combo : ready ? TEXT.perfect : TEXT.muted);
  }

  private slotStatus(index: number, readiness: ReturnType<typeof slotReadiness>): string {
    const slot = this.state.command.slots[index]!;
    const auto = slot.card?.auto ? 'Auto · ' : '';
    switch (readiness) {
      case 'locked': {
        if (index === LEGENDARY_SLOT) return 'Legendary: beat a boss';
        const opens = RANKS.find((r) => r.slots > index);
        return opens ? `Opens at Rank ${opens.numeral}` : 'Locked';
      }
      case 'empty':
        return 'Empty';
      case 'resting':
        return `${auto}Resting ${Math.ceil(slot.restTicks / TICKS_PER_SECOND)} s`;
      case 'waiting':
        return `${auto}Waits for its moment`;
      case 'noPips': {
        const cost = slotCost(this.state, index) ?? 0;
        return `${auto}Needs ${cost} pip${cost === 1 ? '' : 's'}`;
      }
      case 'ready': {
        // Blood Price (Warlord): short on pips, a troop pays the rest with HP.
        const cost = slotCost(this.state, index) ?? 0;
        const blood = this.state.command.pips < cost && bloodPayer(this.state, cost - this.state.command.pips) ? ' (blood)' : '';
        return slot.glowing ? `${auto}NOW! Perfect${blood}` : `${auto}Ready${blood}`;
      }
    }
  }

  // Effects -----------------------------------------------------------------------------------

  /** Floating text over the battlefield that rises and fades. */
  private popup(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, textStyle(13, color, true)).setOrigin(0.5);
    this.world.add(label);
    this.tweens.add({ targets: label, y: y - 18, alpha: 0, duration: 900, onComplete: () => label.destroy() });
  }

  /** Floating text in screen space, for the slot bar. */
  private screenPopup(x: number, y: number, text: string, color: string, size: number): void {
    const label = this.add.text(x, y, text, textStyle(size, color, true)).setOrigin(0.5, 1);
    this.tweens.add({ targets: label, y: y - 22, alpha: 0, duration: 1000, onComplete: () => label.destroy() });
  }

  /** Adds a combo to your Codex; true if it is new there. A failed save just leaves it for next time. */
  private found(id: CodexEntryId): boolean {
    const saving = recordCombo(id);
    void saving?.catch(() => undefined);
    return saving !== null;
  }

  /** A combo's name over the battlefield, with what it does, and a note when it is new to your Codex. Banners take turns. */
  private comboBanner(title: string, subtitle: string, isNew: boolean): void {
    const now = this.time.now;
    const wait = Math.max(0, this.bannerFreeAt - now);
    this.bannerFreeAt = now + wait + COMBO_BANNER_MS;
    if (wait > 0) this.time.delayedCall(wait, () => this.showComboBanner(title, subtitle, isNew));
    else this.showComboBanner(title, subtitle, isNew);
  }

  private showComboBanner(title: string, subtitle: string, isNew: boolean): void {
    const cx = OPEN_FIELD.width / 2;
    const y = OPEN_FIELD.height - 120;
    const items = [
      this.add.text(cx, y, title, textStyle(30, TEXT.combo, true)).setOrigin(0.5),
      this.add.text(cx, y + 28, subtitle, textStyle(13, TEXT.body)).setOrigin(0.5),
    ];
    if (isNew) items.push(this.add.text(cx, y + 48, 'New in your Combo Codex!', textStyle(13, TEXT.perfect, true)).setOrigin(0.5));
    this.world.add(items);
    this.tweens.add({ targets: items, alpha: 0, delay: 1400, duration: 700, onComplete: () => items.forEach((t) => t.destroy()) });
  }

  /** Big text across the middle of the battlefield, gone after `holdMs`. */
  private banner(title: string, color: string, subtitle?: string, holdMs = 1200): void {
    const cx = OPEN_FIELD.width / 2;
    const cy = OPEN_FIELD.height / 2;
    const items = [this.add.text(cx, cy - 12, title, textStyle(44, color, true)).setOrigin(0.5)];
    const wrap = { width: OPEN_FIELD.width - 160 };
    if (subtitle) items.push(this.add.text(cx, cy + 16, subtitle, { ...textStyle(16, TEXT.body), wordWrap: wrap, align: 'center' }).setOrigin(0.5, 0));
    this.world.add(items);
    this.tweens.add({ targets: items, alpha: 0, delay: holdMs, duration: 800, onComplete: () => items.forEach((t) => t.destroy()) });
  }
}

