// The battle: runs the battle engine at a fixed 20 ticks per second and draws it every frame.
// This scene only reads the battle state; the engine alone changes it. Key presses reach the
// engine as inputs stamped with the tick they take effect on, so every battle can be replayed.
// In versus (session 6D) both games run the same battle in lockstep: a tick runs once both
// players' presses for it are in, and the guest, who commands the right side, sees the field
// turned around so their army stands on the left in blue, as it always does.

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
  commandOf,
  createBattle,
  DECREE_SLOT,
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
  stateHash,
  stepBattle,
  TICKS_PER_SECOND,
  ultimateReady,
  type BattleEvent,
  type BattleInput,
  type BattleSetup,
  type BattleState,
  type CommandState,
  type Side,
  type Unit,
} from '../../sim';
import {
  createClock,
  frameBlend,
  setSpeed,
  ticksForFrame,
  TICK_MS,
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
import { addAmbience, addFallen, ArrowSprites, Bursts, TroopSprites, WallSprites, type BurstKind } from '../battleFx';
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
import { addButton, addFrame, addHint, displayStyle, recolor, restyleFrame, textStyle, titleCase, type Button } from '../ui';
import type { FrameStyleId } from '../art/frames';
import { GEM_PALETTES, PIP_GEM, PIP_SOCKET } from '../art/hud';
import { paintCentered } from '../art/paint';
import { currentMatch, GONE_TEXT } from '../versus';
import { DamageTally } from '../damageTally';
import { layoutFree } from '../layoutWatch';
import { followMatch, leaveMatch } from '../versusScreens';

export interface BattleData extends MatchSetup {
  seed: number;
  /** A versus battle (session 6D): the battle both games run, and which side is yours. */
  versusBattle?: { setup: BattleSetup; own: Side };
}

/** How long a troop flashes white after a hit, in milliseconds. */
const HIT_FLASH_MS = 120;
/** How long the boss banner, with its rule to read, stays before it fades, in milliseconds. */
const BOSS_BANNER_MS = 4000;
/** How long a combo banner stays before the next one may show, in milliseconds. */
const COMBO_BANNER_MS = 2000;
/** Pause between the last blow and the result screen, in milliseconds. */
const RESULT_DELAY_MS = 1400;
/** Versus: how long the battle may stand still waiting for the other game before it says so. */
const WAIT_NOTICE_MS = 500;
/** Versus: ticks of waiting kept to catch up on once the other game's presses come in. */
const CATCH_UP_TICKS = 4;

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
/** The decree's line (session 7D), at the bottom left of the field, just above the slot bar. */
const DECREE_W = 420;
const DECREE_H = 24;
const DECREE_Y = BOTTOM_BAR_Y - DECREE_H - 8;
const PANEL_X = 16 + SLOT_COUNT * (SLOT_W + SLOT_GAP);

interface Point {
  x: number;
  y: number;
}

type PendingInput = { kind: 'slot'; slot: number } | { kind: 'ultimate' };

interface SlotTexts {
  key: Phaser.GameObjects.Text;
  card: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

/** How fast the pale part of an army's HP bar drains away, in shares of the bar per second. */
const HP_GHOST_PER_SECOND = 0.35;
/** At most this many damage numbers on the field at once. */
const MAX_DAMAGE_NUMBERS = 32;

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
  /** The walls themselves, as pixel-art blocks over their shadows and rubble. */
  private wallSprites!: WallSprites;
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
  private speedButtons: { pause: Button; normal: Button; fast: Button } | null = null;
  private slotTexts: SlotTexts[] = [];
  /** A run's decree (session 7D), shown above the slot bar: its card and what it is doing. */
  private decreeText: Phaser.GameObjects.Text | null = null;
  private pipsText!: Phaser.GameObjects.Text;
  private ultimateText!: Phaser.GameObjects.Text;
  /** Whether each long ultimate label fits its panel, measured once (session 7H). */
  private readonly labelFits = new Map<string, boolean>();
  /** The enemy commander's Momentum, and a warning when its ultimate is close. */
  private enemyCommandText!: Phaser.GameObjects.Text;
  private chainText!: Phaser.GameObjects.Text;
  private chainBar!: Phaser.GameObjects.Graphics;
  private threatTexts = new Map<number, Phaser.GameObjects.Text>();
  /** Each army's HP bar as last drawn, draining toward its true share: the pale part of the bar. */
  private hpGhost: Partial<Record<Side, number>> = {};
  /** Damage numbers, kept for reuse, and how many have shown (to spread them out). */
  private numbers: Phaser.GameObjects.Text[] = [];
  private numbersShown = 0;
  /** Hits on one troop close together add up into one number (session 7E): each troop's number now. */
  private tally = new DamageTally();
  private liveNumbers = new Map<number, Phaser.GameObjects.Text>();
  /** The slot cards' frames, restyled as they become ready, rest or lock. */
  private slotFrames: Phaser.GameObjects.Image[] = [];
  private slotStyles: FrameStyleId[] = [];
  /** The Captain's tips in your first battles; none in versus. */
  private tips: CaptainTips | null = null;
  /** Your side: the player's, or in versus as the guest, the enemy's (shown on the left all the same). */
  private own: Side = 'player';
  private foe: Side = 'enemy';
  /** Words over the field, never turned around with it: popups, damage numbers, banners. */
  private labels!: Phaser.GameObjects.Container;
  /** Versus: when the last tick ran, to say when the battle waits for the other game. */
  private lastTickAt = 0;
  /** Versus: the match ended mid-battle (the other left, or the games fell out of step). */
  private halted = false;
  /** Versus: Esc was pressed once; the next press leaves the match. */
  private confirmLeave = false;

  constructor() {
    super('Battle');
  }

  init(data: BattleData): void {
    this.setup = data;
    this.own = data.versusBattle?.own ?? 'player';
    this.foe = otherSide(this.own);
    this.state = data.versusBattle ? createBattle(data.versusBattle.setup) : this.ownBattle(data);
    this.clock = createClock();
    this.pending = [];
    this.previous = new Map();
    this.flashUntil = new Map();
    this.slotFlashUntil = new Map();
    this.threatTexts = new Map();
    this.slotTexts = [];
    this.decreeText = null;
    this.hpGhost = {};
    this.numbers = [];
    this.numbersShown = 0;
    this.tally.clear();
    this.liveNumbers = new Map();
    this.slotFrames = [];
    this.slotStyles = [];
    this.eventCursor = 0;
    this.ended = false;
    this.goldTrim = hasLook(currentCampaign(), data.general);
    this.bannerFreeAt = 0;
    this.merged = new Set();
    this.strikes = [];
    this.lunges = new Map();
    this.seenShots = new Set();
    this.slashes = [];
    this.tips = null;
    this.lastTickAt = 0;
    this.halted = false;
    this.confirmLeave = false;
  }

  /** A skirmish or campaign battle, set up from your troops, cards and the enemy you face. */
  private ownBattle(data: BattleData): BattleState {
    const enemy = enemyArmyOf(data);
    return createBattle({
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
      decree: data.fight?.decree ?? null,
    });
  }

  private get versus(): boolean {
    return this.setup.versusBattle !== undefined;
  }

  /** Your cards, pips and Momentum. */
  private get command(): CommandState {
    return commandOf(this.state, this.own)!;
  }

  /** The side whose colors a side wears on your screen: yours is always blue. */
  private look(side: Side): Side {
    return side === this.own ? 'player' : 'enemy';
  }

  /** Where a spot on the field shows across: the guest's view is turned around. */
  private vx(x: number): number {
    return this.own === 'player' ? x : this.state.map.width - x;
  }

  create(): void {
    fitCamera(this);
    this.world = this.add.container(0, TOP_BAR_HEIGHT);
    const ground = addGround(this, this.state.map);
    this.fallenLayer = this.add.container(0, 0);
    this.wallsLayer = this.add.graphics();
    this.wallSprites = new WallSprites(this);
    this.groundLayer = this.add.graphics();
    this.troopSprites = new TroopSprites(this);
    this.arrowSprites = new ArrowSprites(this);
    this.unitsLayer = this.add.graphics();
    this.bursts = new Bursts(this);
    const map = this.state.map;
    this.world.add([
      ground,
      this.fallenLayer,
      this.wallsLayer,
      this.wallSprites.layer,
      this.groundLayer,
      this.troopSprites.layer,
      this.arrowSprites.layer,
      this.unitsLayer,
      ...this.bursts.emitters,
      addAmbience(this, map.id, map.width, map.height),
    ]);
    // The guest commands the right side: the field is turned around, so their army is on the left.
    if (this.own === 'enemy') this.world.setPosition(map.width, TOP_BAR_HEIGHT).setScale(-1, 1);
    // Words that float over the battle may cross anything: the layout check leaves them be.
    this.labels = layoutFree(this.add.container(0, TOP_BAR_HEIGHT));

    addFrame(this, 0, 0, GAME_WIDTH, TOP_BAR_HEIGHT, 'bar');
    // Wells for both armies' HP bars and both Generals' portraits.
    addFrame(this, 12, 20, 304, 20, 'well');
    addFrame(this, GAME_WIDTH - 16 - 300 - 4, 20, 304, 20, 'well');
    addFrame(this, 16 + 300 + 4, 2, 40, 40, 'well');
    addFrame(this, GAME_WIDTH - 16 - 300 - 44, 2, 40, 40, 'well');
    this.topBar = this.add.graphics();
    const yours = this.state.generals[this.own];
    const theirs = this.state.generals[this.foe];
    this.add.text(16, 4, `YOU · ${GENERALS[yours].name.toUpperCase()}`, textStyle(12, TEXT.muted, true));
    this.add.text(GAME_WIDTH - 16, 4, `${GENERALS[theirs].name.toUpperCase()} · ${this.versus ? 'OPPONENT' : 'ENEMY'}`, textStyle(12, TEXT.muted, true)).setOrigin(1, 0);
    // Both Generals' portraits, beside their armies' HP bars.
    this.add.image(16 + 300 + 8, 6, portraitKey(yours)).setOrigin(0).setScale(2).setDepth(1);
    this.add.image(GAME_WIDTH - 16 - 300 - 8, 6, portraitKey(theirs)).setOrigin(1, 0).setScale(2).setFlipX(true).setDepth(1);
    this.enemyCommandText = this.add.text(GAME_WIDTH - 16, 44, '', textStyle(12, TEXT.muted, true)).setOrigin(1, 0);
    this.clockText = this.add.text(GAME_WIDTH / 2, 3, '0:00', textStyle(24, TEXT.title, true)).setOrigin(0.5, 0);
    this.overtimeText = this.add.text(GAME_WIDTH / 2 + 50, 12, '', textStyle(13, TEXT.overtime, true));
    this.pausedText = this.add.text(GAME_WIDTH / 2 - 50, 12, '', textStyle(13, TEXT.perfect, true)).setOrigin(1, 0);
    if (this.versus) {
      // A versus battle never pauses or speeds up: both games keep the same time.
      addHint(this, 16, 44, '1-5: cards   U: ultimate   Esc: leave', 'ⓍⓎⒷⒶ RB: cards   RT: ultimate', textStyle(12, TEXT.muted));
      this.pausedText.setOrigin(0.5, 0).setPosition(GAME_WIDTH / 2, 44);
    } else {
      addHint(this, 16, 44, '1-5: cards   U: ultimate   Space: pause   F: speed', 'ⓍⓎⒷⒶ RB: cards   RT: ultimate   Menu: pause   LB: speed', textStyle(12, TEXT.muted));
      const y = 48;
      this.speedButtons = {
        pause: addButton(this, GAME_WIDTH / 2 - 62, y, '❚❚', () => togglePause(this.clock), 54, 22),
        normal: addButton(this, GAME_WIDTH / 2, y, '1x', () => setSpeed(this.clock, 1), 54, 22),
        fast: addButton(this, GAME_WIDTH / 2 + 62, y, '2x', () => setSpeed(this.clock, 2), 54, 22),
      };
    }

    this.createBottomBar();
    this.createDecree();
    this.chainBar = this.add.graphics();
    this.chainText = this.add.text(GAME_WIDTH - 16, BOTTOM_BAR_Y - 30, '', textStyle(22, TEXT.combo, true)).setOrigin(1, 0);

    const input = new InputLayer(this).on('ultimate', () => this.press({ kind: 'ultimate' }));
    SLOT_ACTIONS.forEach((action, slot) => input.on(action, () => this.press({ kind: 'slot', slot })));
    if (this.versus) {
      input.on('back', () => this.leave()).on('confirm', () => this.halted && this.leave());
      followMatch(this, (event) => event.kind === 'desync' && this.halt('OUT OF STEP', 'Your two games no longer agree on this battle, so it can’t go on.'), {
        onGone: (why) => this.halt(why === 'left' ? 'OPPONENT LEFT' : 'CONNECTION LOST', GONE_TEXT[why]),
      });
      this.lastTickAt = this.time.now;
    } else {
      input.on('pause', () => togglePause(this.clock)).on('speed', () => toggleSpeed(this.clock));
      this.tips = new CaptainTips(this, { x: (GAME_WIDTH - 380) / 2, width: 380, top: TOP_BAR_HEIGHT + 30 }, this.setup.general);
      this.tips.say([{ id: 'battleStart' }], TUTORIAL_RULES.battleTipSeconds);
    }

    const boss = this.state.boss;
    playMusic(boss ? 'boss' : 'battle');
    playSound('fight');
    if (boss) this.banner(`BOSS: ${GENERALS[boss].name.toUpperCase()}`, TEXT.threat, BOSSES[boss].rule, BOSS_BANNER_MS);
    else if (this.versus) this.banner('FIGHT!', TEXT.title, `Versus · Rank ${rankRules(this.command.rank).numeral} · ${this.state.map.name}`);
    else this.banner('FIGHT!', TEXT.title, this.setup.tactical ? 'Tactical mode: the battle pauses every 10 s' : undefined);
  }

  /** A card or the ultimate pressed: for the next tick, or in versus, for the lockstep to send. */
  private press(input: PendingInput): void {
    if (this.state.result || this.halted) return;
    if (this.versus) currentMatch()?.press(input);
    else this.pending.push(input);
  }

  /** Versus: Esc twice leaves the match (the battle is lost); once it has stopped, Esc or Enter. */
  private leave(): void {
    if (this.halted || this.state.result || this.confirmLeave) {
      leaveMatch(this);
      return;
    }
    this.confirmLeave = true;
    this.screenPopup(GAME_WIDTH / 2, TOP_BAR_HEIGHT + 60, `Press ${keyLabel('back')} again to leave the match`, TEXT.defeat, 16);
    this.time.delayedCall(2500, () => {
      this.confirmLeave = false;
    });
  }

  /** Versus: the match ended mid-battle. The field stays as it was, with why, until you leave. */
  private halt(title: string, why: string): void {
    if (this.halted || this.state.result) return;
    this.halted = true;
    this.tips?.hide();
    const cx = OPEN_FIELD.width / 2;
    const cy = OPEN_FIELD.height / 2;
    const words = this.add.text(cx, cy - 10, titleCase(title), displayStyle(48, TEXT.threat)).setOrigin(0.5);
    const more = this.add
      .text(cx, cy + 26, `${why}\nPress ${keyLabel('confirm')} to go back to Versus.`, { ...textStyle(16, TEXT.body), align: 'center' })
      .setOrigin(0.5, 0);
    this.labels.add([this.ribbon(cy + 14, 130), words, more]);
    this.popIn(words);
  }

  override update(time: number, delta: number): void {
    if (!this.state.result && !this.halted) {
      if (this.versus) this.stepLockstep(time, delta);
      else {
        const ticks = ticksForFrame(this.clock, delta);
        for (let i = 0; i < ticks && !this.state.result && !this.clock.paused; i++) {
          this.rememberPositions();
          stepBattle(this.state, this.takeInputs());
          this.tacticalPause();
        }
      }
      this.showNewEvents(time);
      if (this.tips && !this.state.result && !this.tips.showing) this.tips.say(battleMoments(this.state), TUTORIAL_RULES.battleTipSeconds);
      if (this.state.result && !this.ended) {
        this.ended = true;
        this.tips?.hide();
        // Both games end the battle on the same tick; the match is ready for a rematch.
        if (this.versus) currentMatch()?.battleOver();
        this.time.delayedCall(RESULT_DELAY_MS, () => {
          const result = this.state.result!;
          if (this.versus) {
            // No Command XP, Battle IQ or Mastery in versus: just who won.
            this.scene.launch('Result', { ...this.setup, result, xp: { total: 0, parts: [] }, outcome: null, iq: battleIq(this.state), mastery: [] });
            this.scene.pause();
            return;
          }
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

  /**
   * Versus: runs the ticks this frame is owed, each once both games' presses for it are in.
   * Before each tick, this game's presses for a tick a little ahead go out (even none, so the
   * other game knows); every few seconds the games compare fingerprints of the battle.
   */
  private stepLockstep(time: number, delta: number): void {
    const match = currentMatch();
    const lockstep = match?.lockstep;
    if (!match || !lockstep) return;
    const ticks = ticksForFrame(this.clock, delta);
    let ran = 0;
    for (; ran < ticks && !this.state.result; ran++) {
      const tick = this.state.tick;
      const batch = lockstep.batchFor(tick);
      if (batch) match.sendBatch(batch);
      if (!lockstep.canRun(tick)) break;
      this.rememberPositions();
      stepBattle(this.state, lockstep.inputsFor(tick));
      match.afterTick(this.state.tick, () => stateHash(this.state));
      this.lastTickAt = time;
    }
    // Waiting on the other game: keep a little of the time owed, to catch up once its presses come.
    if (ran < ticks) this.clock.carryMs = Math.min(this.clock.carryMs + (ticks - ran) * TICK_MS, CATCH_UP_TICKS * TICK_MS);
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
        if (e.side === this.own) this.comboBanner(`${synergy.name.toUpperCase()}!`, synergy.bonusText, this.found(e.synergy));
      } else if (e.type === 'skill') {
        const unit = this.unit(e.unitId);
        if (unit) {
          this.popup(unit.x, unit.y - 26, SKILL_LABELS[e.skill], unit.side === this.own ? '#bfe0ff' : '#ffc9c0');
          const burst = SKILL_BURSTS[e.skill];
          if (burst) this.bursts.burst(burst, unit.x, unit.y);
        }
      } else if (e.type === 'death') {
        const unit = this.unit(e.unitId);
        if (unit) {
          this.popup(unit.x, unit.y - 20, '✖', unit.side === this.own ? '#7fb8ff' : '#ff8f80');
          addFallen(this, this.fallenLayer, unit.rooted ? 'turret' : unit.cls, this.look(unit.side), unit.x, unit.y);
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
      } else if (e.type === 'cardFired' && e.side === this.own && e.slot === DECREE_SLOT) {
        this.slotFlashUntil.set(e.slot, time + 450);
        this.screenPopup(16 + DECREE_W / 2, DECREE_Y - 6, e.link > 1 ? `Decree!  x${e.link}` : 'Decree!', e.link > 1 ? TEXT.combo : TEXT.body, 13);
      } else if (e.type === 'cardFired' && e.side === this.own) {
        this.slotFlashUntil.set(e.slot, time + 450);
        const x = 16 + e.slot * (SLOT_W + SLOT_GAP) + SLOT_W / 2;
        const label = (e.perfect ? 'PERFECT!' : e.auto ? 'Auto' : 'Go!') + (e.link > 1 ? `  x${e.link}` : '');
        this.screenPopup(x, SLOT_Y - 6, label, e.perfect ? TEXT.perfect : e.link > 1 ? TEXT.combo : TEXT.body, e.perfect || e.link > 1 ? 18 : 13);
      } else if (e.type === 'cardFired') {
        // The enemy commander's cards (or your opponent's): what it ordered, under its HP bar.
        const card = commandOf(this.state, this.foe)?.slots[e.slot]?.card;
        if (card) this.screenPopup(GAME_WIDTH - 166, TOP_BAR_HEIGHT + 30, `${this.versus ? 'Opponent' : 'Enemy'}: ${shortCard(card)}`, TEXT.threat, 13);
      } else if (e.type === 'combo') {
        const entry = codexEntry(e.combo);
        if (e.side === this.own) this.comboBanner(`${entry.name.toUpperCase()}!`, entry.bonusText, this.found(e.combo));
        else this.screenPopup(GAME_WIDTH - 166, TOP_BAR_HEIGHT + 52, `${this.versus ? 'Opponent' : 'Enemy'} combo: ${entry.name}!`, TEXT.threat, 15);
      } else if (e.type === 'ultimate') {
        const ultimate = GENERALS[this.state.generals[e.side]].ultimate;
        const name = ultimate.name.toUpperCase();
        if (e.side === this.foe) this.banner(`${this.versus ? 'OPPONENT’S' : 'ENEMY'} ${name}!`, TEXT.threat, ultimate.text);
        else if (e.finisher) this.comboBanner(`FINISHER: ${name}!`, `${ultimate.text}. 50% stronger.`, this.found('finisher'));
        else this.banner(`${name}!`, TEXT.perfect, ultimate.text);
        if (e.name === 'thermalDetonation' && e.at && e.to) this.strikes.push({ kind: 'beam', at: e.at, to: e.to, until: time + STRIKE_MS });
        if (e.name === 'gravityWell' && e.at) this.strikes.push({ kind: 'well', at: e.at, to: null, until: time + STRIKE_MS });
        // The whole field flashes in the side's color, and shakes.
        const color = COLORS.side[this.look(e.side)];
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
    if (e.amount > 0 && e.cause !== 'burn' && e.cause !== 'rift') this.damageNumber(target.id, target.x, target.y - target.stats.radius - 6, e.amount, target.side !== this.own);
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
    const yours = e.side === this.own;
    this.banner(`${yours ? '' : this.versus ? 'OPPONENT’S ' : 'ENEMY '}${action.name.toUpperCase()}!`, yours ? TEXT.perfect : TEXT.threat, action.text);
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
    for (const wall of this.state.walls) drawWall(walls, wall, this.state.map.id, false);
    this.wallSprites.sync(this.state.walls, this.state.map.id);

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
      const alpha = hidden ? (u.side === this.own ? 0.35 : 0.15) : 1;
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
        side: this.look(u.side),
        frame: pose.frame,
        x,
        y,
        flipX: face.x < at.x,
        alpha: u.wraithTicks > 0 ? Math.min(alpha, 0.75) : alpha,
        flash: hidden ? 0 : flash,
        tint: u.wraithTicks > 0 ? COLORS.wraith : null,
        size: u.elite ? 1.25 : 1,
      });
      if (hidden && u.side !== this.own) continue; // Only a faint shape: no shadow, HP bar or effects to give it away.
      under.fillStyle(0x0a0610, 0.4 * alpha).fillEllipse(at.x, at.y + r * 0.95, r * 1.9, r * 0.6);
      if (u.slow) drawSlowed(under, at.x, at.y, r);
      const taunter = u.taunt ? this.unit(u.taunt.unitId) : undefined;
      if (taunter?.alive) drawTaunted(under, at.x, at.y, this.smoothed(`u${taunter.id}`, taunter.x, taunter.y, blend));
      drawGeneralEffects(g, at.x, at.y, r, u);
      if (u.barrier) drawBarrier(g, at.x, at.y, r, u.barrier.amount / UNIT_CLASSES.guardian.barrier.amount);
      if (u.rallyTicks > 0) g.lineStyle(2, COLORS.glow, 0.7).strokeCircle(at.x, at.y, r + 9);
      // Hijacked: a ring in the color of the side that controls it.
      if (u.hijackTicks > 0) g.lineStyle(3, COLORS.side[this.look(otherSide(u.side))], 0.95).strokeCircle(at.x, at.y, r + 6);
      drawRarity(g, at.x, at.y, r, u.rarity, alpha);
      // General Mastery: with all three of your General's challenges met, your troops wear a gold trim.
      if (this.goldTrim && u.side === this.own) g.lineStyle(2, COLORS.capital, alpha).strokeCircle(at.x, at.y, r + 2);
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
      // HP only once hurt, so a fresh army isn't a field of bars.
      if (u.hp < u.stats.maxHp) drawBar(g, at.x, at.y - r - 13, 24, u.hp / u.stats.maxHp);
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
      this.arrowSprites.show(p.id, this.look(p.side), at.x, at.y, Math.atan2(dy, dx), owner?.rooted ?? false, tint);
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
    this.drawTopBar(this.game.loop.delta);
    this.drawBottomBar(time);
    this.drawChain();
  }

  /** The chain counter, x2, x3 ..., over the right end of the slot bar, with the time left to add a link. */
  private drawChain(): void {
    const g = this.chainBar.clear();
    const left = this.state.result ? 0 : chainTicksLeft(this.state, this.command);
    const links = this.command.chain.links;
    if (left <= 0 || links < 1) {
      this.chainText.setText('');
      return;
    }
    const seconds = COMMAND_RULES.chain.windowSeconds;
    const size = `${links >= 2 ? 22 : 13}px`;
    this.chainText.setText(links >= 2 ? `CHAIN x${links}` : `Chain open: next card within ${seconds} s`);
    if (this.chainText.style.fontSize !== size) this.chainText.setFontSize(size);
    const width = 150;
    const share = left / secondsToTicks(COMMAND_RULES.chain.windowSeconds);
    g.fillStyle(COLORS.hpBack, 0.9).fillRect(GAME_WIDTH - 16 - width, BOTTOM_BAR_Y - 6, width, 4);
    g.fillStyle(COLORS.chased, 1).fillRect(GAME_WIDTH - 16 - width, BOTTOM_BAR_Y - 6, width * share, 4);
  }

  /** Threat Readout: "Ranger falls in ~3 s" over troops about to fall. */
  private drawThreats(blend: number): void {
    const warnings = this.state.result ? [] : threats(this.state, this.own);
    const shown = new Set(warnings.map((w) => w.unitId));
    for (const [id, text] of this.threatTexts) if (!shown.has(id)) text.setVisible(false);
    for (const w of warnings) {
      const u = this.unit(w.unitId)!;
      const at = this.smoothed(`u${u.id}`, u.x, u.y, blend);
      let text = this.threatTexts.get(w.unitId);
      if (!text) {
        text = this.add.text(0, 0, '', textStyle(11, TEXT.threat, true)).setOrigin(0.5, 1);
        this.labels.add(text);
        this.threatTexts.set(w.unitId, text);
      }
      text.setText(w.text).setPosition(this.vx(at.x), at.y - u.stats.radius - 13).setVisible(true);
    }
  }

  /** Rangers and Assassins point at what they are after; otherwise troops face the enemy's side. */
  private facing(u: Unit, at: Point): Point {
    const target = this.unit(u.targetId);
    if (target && target.side !== u.side) return { x: target.x, y: target.y };
    return { x: at.x + (u.side === 'player' ? 100 : -100), y: at.y };
  }

  private drawTopBar(delta: number): void {
    const g = this.topBar.clear();
    const share = (side: Side) =>
      this.state.units.filter((u) => u.side === side && u.alive).reduce((sum, u) => sum + u.hp, 0) /
      this.state.startHp[side];
    this.armyBar(g, 14, share(this.own), 'player', delta);
    this.armyBar(g, GAME_WIDTH - 16 - 300 - 2, share(this.foe), 'enemy', delta);

    const seconds = Math.floor(this.state.tick / TICKS_PER_SECOND);
    this.clockText.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    const boost = overtimeMultiplier(this.state.tick) - 1;
    this.overtimeText.setText(boost > 0 ? `OVERTIME +${Math.round(boost * 100)}%` : '');

    const enemy = commandOf(this.state, this.foe);
    if (enemy) {
      const share = enemy.momentum / COMMAND_RULES.momentum.max;
      const ultimate = GENERALS[this.state.generals[this.foe]].ultimate.name;
      const charging = share >= CONDITION_RULES.ultimateChargingShare;
      const who = this.versus ? 'Opponent' : 'Commander';
      recolor(
        this.enemyCommandText.setText(`${who}: ${enemy.pips} pips · ${ultimate} ${Math.floor(Math.min(1, share) * 100)}%${charging ? '  CHARGING!' : ''}`),
        charging ? TEXT.threat : TEXT.muted,
      );
    }

    if (this.versus) {
      // The battle stands still while the other game's presses are on their way.
      const waiting = !this.state.result && !this.halted && this.time.now - this.lastTickAt > WAIT_NOTICE_MS;
      this.pausedText.setText('Waiting for your opponent…').setVisible(waiting);
      return;
    }
    this.pausedText.setText(`PAUSED · ${keyLabel('pause')} to go on`).setVisible(this.clock.paused && !this.state.result);
    this.speedButtons?.pause.setHighlighted(this.clock.paused);
    this.speedButtons?.normal.setHighlighted(!this.clock.paused && this.clock.speed === 1);
    this.speedButtons?.fast.setHighlighted(!this.clock.paused && this.clock.speed === 2);
  }

  /**
   * An army's HP left, as a long bar in its color with a lit top; the enemy's drains from the
   * right. What was just lost lingers in pale for a moment before draining away.
   */
  private armyBar(g: Phaser.GameObjects.Graphics, x: number, share: number, side: Side, delta: number): void {
    const width = 300;
    const now = Math.max(0, Math.min(1, share));
    const ghost = Math.max(now, (this.hpGhost[side] ?? now) - (delta / 1000) * HP_GHOST_PER_SECOND);
    this.hpGhost[side] = ghost;
    const top = 24;
    const bar = (fill: number) => {
      const w = Math.round(width * fill);
      return { left: side === 'player' ? x : x + width - w, w };
    };
    const lost = bar(ghost);
    g.fillStyle(0xfff0d0, 0.85).fillRect(lost.left, top, lost.w, 12);
    const left = bar(now);
    g.fillStyle(COLORS.sideDark[side], 1).fillRect(left.left, top, left.w, 12);
    g.fillStyle(COLORS.side[side], 1).fillRect(left.left, top, left.w, 9);
    g.fillStyle(0xffffff, 0.35).fillRect(left.left, top + 2, left.w, 2);
  }

  // The slot bar ------------------------------------------------------------------------------

  private createBottomBar(): void {
    addFrame(this, 0, BOTTOM_BAR_Y, GAME_WIDTH, BOTTOM_BAR_HEIGHT, 'bar');
    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = 16 + i * (SLOT_W + SLOT_GAP);
      this.slotFrames.push(addFrame(this, x, SLOT_Y, SLOT_W, SLOT_H, 'card'));
      this.slotStyles.push('card');
      addFrame(this, x + 5, SLOT_Y + 5, 26, 20, 'well');
    }
    // Pips and Momentum on the right, in a plain panel; Momentum's bar in a well.
    addFrame(this, PANEL_X - 6, SLOT_Y, GAME_WIDTH - 10 - PANEL_X, SLOT_H, 'plain');
    addFrame(this, PANEL_X, SLOT_Y + 52, GAME_WIDTH - 22 - PANEL_X, 12, 'well');
    this.bottomBar = this.add.graphics();
    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = 16 + i * (SLOT_W + SLOT_GAP);
      const hit = this.add.rectangle(x, SLOT_Y, SLOT_W, SLOT_H, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.press({ kind: 'slot', slot: i }));
      const card = this.command.slots[i]?.card;
      this.slotTexts.push({
        key: this.add.text(x + 18, SLOT_Y + 15, String(i + 1), textStyle(13, TEXT.title, true)).setOrigin(0.5),
        card: this.add.text(x + 9, SLOT_Y + 28, card ? shortCard(card) : '', {
          ...textStyle(11),
          wordWrap: { width: SLOT_W - 18 },
          maxLines: 3,
        }),
        status: this.add.text(x + 9, SLOT_Y + SLOT_H - 19, '', textStyle(10, TEXT.muted, true)),
      });
    }
    this.add.text(PANEL_X + 2, SLOT_Y + 4, 'PIPS', textStyle(11, TEXT.muted, true));
    this.pipsText = this.add.text(GAME_WIDTH - 22, SLOT_Y + 4, '', textStyle(11, TEXT.muted, true)).setOrigin(1, 0);
    this.add.text(PANEL_X + 2, SLOT_Y + 38, 'MOMENTUM', textStyle(11, TEXT.muted, true));
    this.ultimateText = this.add.text(PANEL_X + 2, SLOT_Y + 64, '', textStyle(12, TEXT.muted, true));
    this.add
      .rectangle(PANEL_X, SLOT_Y + 38, GAME_WIDTH - 16 - PANEL_X, 44, 0, 0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.press({ kind: 'ultimate' }));
  }

  /** The decree's line above the slot bar, when the run has one your rank can follow. */
  private createDecree(): void {
    const card = this.command.slots[DECREE_SLOT]?.card;
    if (!card) return;
    addFrame(this, 12, DECREE_Y, DECREE_W, DECREE_H, 'plain');
    this.decreeText = this.add.text(20, DECREE_Y + 6, '', { ...textStyle(11, TEXT.body), wordWrap: { width: DECREE_W - 16 }, maxLines: 1 });
  }

  /** The decree's state: when it glows it is about to fire by itself; a flash when it has. */
  private drawDecree(g: Phaser.GameObjects.Graphics, time: number, pulse: number): void {
    const slot = this.command.slots[DECREE_SLOT];
    if (!this.decreeText || !slot?.card) return;
    const readiness = slotReadiness(this.state, DECREE_SLOT, this.command);
    if (slot.glowing && readiness !== 'resting') g.lineStyle(3, COLORS.glow, pulse).strokeRect(10, DECREE_Y - 2, DECREE_W + 4, DECREE_H + 4);
    if ((this.slotFlashUntil.get(DECREE_SLOT) ?? 0) > time) g.lineStyle(3, 0xffffff, 1).strokeRect(10, DECREE_Y - 2, DECREE_W + 4, DECREE_H + 4);
    const status =
      readiness === 'resting'
        ? `resting ${Math.ceil(slot.restTicks / TICKS_PER_SECOND)} s`
        : readiness === 'noPips'
          ? `needs ${slotCost(this.state, DECREE_SLOT, this.command) ?? 0} pips`
          : slot.glowing
            ? 'firing'
            : 'waits for its moment';
    this.decreeText.setText(`DECREE (${status}): ${shortCard(slot.card)}`).setAlpha(readiness === 'resting' ? 0.6 : 1);
  }

  private drawBottomBar(time: number): void {
    const g = this.bottomBar.clear();
    const command = this.command;
    const pulse = 0.55 + 0.45 * Math.sin(time / 120);
    this.drawDecree(g, time, pulse);

    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = 16 + i * (SLOT_W + SLOT_GAP);
      const slot = command.slots[i]!;
      const readiness = slotReadiness(this.state, i, command);
      const texts = this.slotTexts[i]!;
      const dim = readiness === 'locked' || readiness === 'empty';
      // The card's frame: gold when it can be fired, plain while it waits, dark when there is nothing to fire.
      const style: FrameStyleId = dim ? 'cardDim' : readiness === 'ready' ? 'cardReady' : 'card';
      if (this.slotStyles[i] !== style) {
        this.slotStyles[i] = style;
        restyleFrame(this.slotFrames[i]!, style);
      }
      // Its perfect moment: a gold glow pulsing around it. Just fired: a white flash.
      if (slot.glowing && readiness !== 'locked') g.lineStyle(4, COLORS.glow, pulse).strokeRect(x - 3, SLOT_Y - 3, SLOT_W + 6, SLOT_H + 6);
      if ((this.slotFlashUntil.get(i) ?? 0) > time) g.lineStyle(4, 0xffffff, 1).strokeRect(x - 3, SLOT_Y - 3, SLOT_W + 6, SLOT_H + 6);
      if (readiness === 'resting') {
        // Resting: a dark curtain over the card, sinking as it comes back.
        const total = secondsToTicks(COMMAND_RULES.slotRestSeconds);
        const left = Math.min(1, slot.restTicks / total);
        const h = Math.round((SLOT_H - 6) * left);
        g.fillStyle(0x07050a, 0.55).fillRect(x + 3, SLOT_Y + SLOT_H - 3 - h, SLOT_W - 6, h);
        g.fillStyle(COLORS.pip, 0.9).fillRect(x + 3, SLOT_Y + SLOT_H - 4 - h, SLOT_W - 6, 2);
      }
      // Its cost in pip gems, green when something makes it cheaper.
      const cost = slotCost(this.state, i, command);
      const discounted = cost !== null && slot.card !== null && cost < cardCost(slot.card);
      for (let p = 0; p < (cost ?? 0); p++) {
        paintCentered(g, PIP_GEM.frames.still!, GEM_PALETTES[discounted ? 'cheap' : 'pip'], x + SLOT_W - 13 - p * 15, SLOT_Y + 15, { scale: 2, alpha: dim ? 0.4 : 1 });
      }
      // The slot's key, or its controller button: X, Y, B, A and RB.
      texts.key.setText(keyLabel(SLOT_ACTIONS[i]!)).setAlpha(dim ? 0.4 : 1);
      texts.card.setAlpha(readiness === 'ready' ? 1 : 0.6);
      recolor(texts.status.setText(this.slotStatus(i, readiness)), readiness === 'ready' ? TEXT.victory : TEXT.muted);
    }

    // Pips: a gem for each pip you hold, a socket for each you could, and a thin bar filling toward the next one.
    const interval = secondsToTicks(COMMAND_RULES.pipRefillSeconds);
    for (let p = 0; p < command.maxPips; p++) {
      const sprite = p < command.pips ? PIP_GEM : PIP_SOCKET;
      paintCentered(g, sprite.frames.still!, GEM_PALETTES.pip, PANEL_X + 12 + p * 24, SLOT_Y + 24, { scale: 3 });
    }
    const width = GAME_WIDTH - 26 - PANEL_X;
    g.fillStyle(COLORS.pip, 0.6).fillRect(PANEL_X + 2, SLOT_Y + 36, width * Math.min(1, command.pipProgress / interval), 2);
    this.pipsText.setText(`${command.pips}/${command.maxPips}`);

    // Momentum and the ultimate: an ember bar in its well, with a glint running along it when full.
    const share = command.momentum / COMMAND_RULES.momentum.max;
    const filled = Math.round(width * Math.min(1, share));
    g.fillStyle(0x9a4a10, 1).fillRect(PANEL_X + 2, SLOT_Y + 54, filled, 8);
    g.fillStyle(COLORS.momentum, share >= 1 ? pulse : 1).fillRect(PANEL_X + 2, SLOT_Y + 54, filled, 6);
    g.fillStyle(0xfff0b8, 0.5).fillRect(PANEL_X + 2, SLOT_Y + 55, filled, 1);
    if (share >= 1) {
      const glint = ((time / 6) % (width + 40)) - 20;
      const from = Math.max(0, glint);
      const to = Math.min(width, glint + 10);
      if (to > from) g.fillStyle(0xffffff, 0.55).fillRect(PANEL_X + 2 + from, SLOT_Y + 54, to - from, 8);
    }
    const ready = ultimateReady(this.state, command);
    const finisher = ready && rankRules(command.rank).finishers && nextLink(this.state, command) >= COMMAND_RULES.finisher.minLinks;
    const ultimate = GENERALS[this.state.generals[this.own]].ultimate;
    const u = keyLabel('ultimate');
    let label = `${u}: ${ultimate.name}  ${Math.floor(share * 100)}%`;
    if (finisher) label = `${u}: FINISHER now!`;
    else if (ready) label = `${u}: ${ultimate.name.toUpperCase()} ready!`;
    else if (momentumFull(this.state, command)) {
      // A long need doesn't fit beside the ultimate's name in the panel: the need alone (session 7H).
      const need = ultimate.needs ?? 'a moment';
      const full = `${u}: ${ultimate.name} needs ${need}`;
      if (!this.labelFits.has(full)) this.labelFits.set(full, this.ultimateText.setText(full).width <= width);
      label = this.labelFits.get(full) ? full : `${u}: needs ${need}`;
    }
    recolor(this.ultimateText.setText(label), finisher ? TEXT.combo : ready ? TEXT.perfect : TEXT.muted);
  }

  private slotStatus(index: number, readiness: ReturnType<typeof slotReadiness>): string {
    const command = this.command;
    const slot = command.slots[index]!;
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
        const cost = slotCost(this.state, index, command) ?? 0;
        return `${auto}Needs ${cost} pip${cost === 1 ? '' : 's'}`;
      }
      case 'ready': {
        // Blood Price (Warlord): short on pips, a troop pays the rest with HP.
        const cost = slotCost(this.state, index, command) ?? 0;
        const blood = command.pips < cost && bloodPayer(this.state, cost - command.pips, command) ? ' (blood)' : '';
        return slot.glowing ? `${auto}NOW! Perfect${blood}` : `${auto}Ready${blood}`;
      }
    }
  }

  // Effects -----------------------------------------------------------------------------------

  /** Floating text over the battlefield: it pops in, rises and fades. */
  private popup(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(this.vx(x), y, text, textStyle(13, color, true)).setOrigin(0.5).setScale(0.4);
    this.labels.add(label);
    this.tweens.add({ targets: label, scale: 1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: label, y: y - 20, alpha: 0, delay: 250, duration: 750, onComplete: () => label.destroy() });
  }

  /**
   * A hit's damage as a number jumping off the troop: pale on the enemy, red on yours, bigger
   * and orange for a heavy blow. Hits on one troop close together add up into its number, which
   * pops again as it grows (session 7E). The numbers are kept and reused, as there are many.
   */
  private damageNumber(unitId: number, x: number, y: number, amount: number, onEnemy: boolean): void {
    const tally = this.tally.add(unitId, amount, this.time.now);
    let label = tally.fresh ? undefined : this.liveNumbers.get(unitId);
    if (!label?.visible) label = undefined;
    if (!label) {
      label = this.numbers.find((n) => !n.visible);
      if (!label) {
        if (this.numbers.length >= MAX_DAMAGE_NUMBERS) return;
        label = this.add.text(0, 0, '', textStyle(12, TEXT.body, true)).setOrigin(0.5);
        this.labels.add(label);
        this.numbers.push(label);
      }
      const jitter = ((this.numbersShown++ % 5) - 2) * 5;
      label.setPosition(this.vx(x) + jitter, y);
      this.liveNumbers.set(unitId, label);
    }
    const heavy = tally.total >= 40;
    const shown = label;
    shown
      .setText(String(Math.round(tally.total)))
      .setStyle(textStyle(heavy ? 16 : 12, heavy ? '#ffb347' : onEnemy ? '#fff3c4' : '#ff9a8a', true))
      .setY(y)
      .setAlpha(1)
      .setScale(tally.fresh ? (heavy ? 0.5 : 0.7) : 1.3)
      .setVisible(true);
    this.labels.bringToTop(shown);
    this.tweens.killTweensOf(shown);
    this.tweens.add({ targets: shown, scale: 1, duration: 140, ease: 'Back.Out' });
    this.tweens.add({ targets: shown, y: y - 18, alpha: 0, delay: 320, duration: 480, onComplete: () => shown.setVisible(false) });
  }

  /** Floating text in screen space, for the slot bar. */
  private screenPopup(x: number, y: number, text: string, color: string, size: number): void {
    const label = this.add.text(x, y, text, textStyle(size, color, true)).setOrigin(0.5, 1).setScale(0.5);
    this.tweens.add({ targets: label, scale: 1, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: label, y: y - 22, alpha: 0, delay: 200, duration: 800, onComplete: () => label.destroy() });
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
    const items: Phaser.GameObjects.GameObject[] = [this.ribbon(y + 16, isNew ? 100 : 84)];
    const name = this.add.text(cx, y, titleCase(title), displayStyle(36, TEXT.combo)).setOrigin(0.5);
    items.push(name, this.add.text(cx, y + 30, subtitle, textStyle(13, TEXT.body)).setOrigin(0.5));
    if (isNew) items.push(this.add.text(cx, y + 50, 'New in your Combo Codex!', textStyle(13, TEXT.perfect, true)).setOrigin(0.5));
    this.labels.add(items);
    this.popIn(name);
    this.tweens.add({ targets: items, alpha: 0, delay: 1400, duration: 700, onComplete: () => items.forEach((t) => t.destroy()) });
  }

  /** Big words across the middle of the battlefield on a dark ribbon, gone after `holdMs`. */
  private banner(title: string, color: string, subtitle?: string, holdMs = 1200): void {
    const cx = OPEN_FIELD.width / 2;
    const cy = OPEN_FIELD.height / 2;
    const items: Phaser.GameObjects.GameObject[] = [this.ribbon(cy + (subtitle ? 6 : -8), subtitle ? 112 : 84)];
    const words = this.add.text(cx, cy - 10, titleCase(title), displayStyle(60, color)).setOrigin(0.5);
    items.push(words);
    const wrap = { width: OPEN_FIELD.width - 160 };
    if (subtitle) items.push(this.add.text(cx, cy + 26, subtitle, { ...textStyle(16, TEXT.body), wordWrap: wrap, align: 'center' }).setOrigin(0.5, 0));
    this.labels.add(items);
    this.popIn(words);
    this.tweens.add({ targets: items, alpha: 0, delay: holdMs, duration: 800, onComplete: () => items.forEach((t) => t.destroy()) });
  }

  /** A dark band across the field with gold edges, opening from its middle line. */
  private ribbon(y: number, height: number): Phaser.GameObjects.Graphics {
    const w = OPEN_FIELD.width;
    const g = this.add.graphics({ x: 0, y });
    g.fillStyle(0x07050a, 0.62).fillRect(0, -height / 2, w, height);
    g.fillStyle(0xd9a74a, 0.9).fillRect(0, -height / 2, w, 2).fillRect(0, height / 2 - 2, w, 2);
    g.fillStyle(0x07050a, 0.8).fillRect(0, -height / 2 + 2, w, 2).fillRect(0, height / 2 - 4, w, 2);
    g.setScale(1, 0);
    this.tweens.add({ targets: g, scaleY: 1, duration: 160, ease: 'Quad.Out' });
    return g;
  }

  /** Words landing: from big and faint to their size. */
  private popIn(text: Phaser.GameObjects.Text): void {
    text.setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: text, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
  }
}
