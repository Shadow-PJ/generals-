// Versus (session 6D): a battle against a friend over the internet. One player hosts and gets a
// four-letter code; the other joins with it. The host picks the map and the rank both armies
// fight at, then starts, and both set up their armies on the Prep and Orders screens as usual.
// The server both games meet at can be changed here; it is saved with the settings.
// ↑↓ pick a line, Enter chooses it. The code: type it, or ↑↓ change a letter and ←→ move.

import Phaser from 'phaser';
import { CODE_ALPHABET, CODE_LENGTH } from '../../../server/protocol';
import { MAP_IDS, MAPS } from '../../data/maps';
import { RANKS, rankRules } from '../../data/ranks';
import { isRelayAddress } from '../../platform';
import type { MatchRules } from '../../versus/messages';
import { groundTexture } from '../art/textures';
import { TROOP_ART_SCALE } from '../art/troops';
import { playSound } from '../audio/audio';
import { keyLabel } from '../bindings';
import { drawWall, drawZone } from '../draw';
import { fitCamera } from '../display';
import { InputLayer } from '../InputLayer';
import { inputDevice } from '../inputDevice';
import { changeSettings, currentPlatform, currentSettings, earnedRank, savedSetup } from '../session';
import { FONT, GAME_HEIGHT, GAME_WIDTH, TEXT, TOP_BAR_HEIGHT } from '../theme';
import { cycle } from '../troops';
import { currentMatch, GONE_TEXT, startMatch, type VersusEvent, type VersusMatch } from '../versus';
import { versusSetup } from '../versusSetup';
import { addButton, addFrame, addHint, addTitle, textStyle } from '../ui';

type MenuRow = 'host' | 'join' | 'server';
const MENU: readonly MenuRow[] = ['host', 'join', 'server'];
type RulesRow = 'map' | 'rank';
const RULES_ROWS: readonly RulesRow[] = ['map', 'rank'];

const LEFT_X = 24;
const LEFT_W = 520;
const RIGHT_X = 580;
const RIGHT_W = GAME_WIDTH - RIGHT_X - 24;
const ROW_H = 92;
/** A letter of the code, in its box. */
const BOX = 48;
const BOX_GAP = 10;
/** The map preview's size, as a share of the battlefield. */
const PREVIEW_SCALE = 0.36;

export interface VersusSceneData {
  /** Why you are back here: the other player left, the connection was lost, or you left. */
  notice?: string;
  /** The notice is no bad news (you left yourself). */
  calm?: boolean;
}

export class VersusScene extends Phaser.Scene {
  private row = 0;
  private rulesRow = 0;
  private code: string[] = [];
  private box = 0;
  /** Typing the code into its boxes. */
  private editingCode = false;
  /** When the boxes opened: the key press that opened them must not also type into them. */
  private editingSince = 0;
  private notice = { text: '', color: TEXT.muted as string };
  private ui!: Phaser.GameObjects.Container;
  private serverInput!: HTMLInputElement;
  private serverBox!: Phaser.GameObjects.DOMElement;
  private stopListening: (() => void) | null = null;

  constructor() {
    super('Versus');
  }

  init(data: VersusSceneData = {}): void {
    this.row = 0;
    this.rulesRow = 0;
    this.code = Array.from({ length: CODE_LENGTH }, () => '');
    this.box = 0;
    this.editingCode = false;
    this.notice = { text: data.notice ?? '', color: data.calm ? TEXT.muted : TEXT.defeat };
    this.stopListening = null;
  }

  create(): void {
    fitCamera(this);
    addTitle(this, 'VERSUS');
    addHint(
      this,
      16,
      38,
      'Battle a friend: one hosts and gets a code, the other joins with it.  ↑↓ pick, Enter chooses.',
      'Battle a friend: one hosts and gets a code, the other joins with it.  ↑↓ pick, Ⓐ chooses.',
      textStyle(12, TEXT.muted),
    );
    addButton(this, GAME_WIDTH - 100, TOP_BAR_HEIGHT / 2, '◀ Capital  Esc', () => this.back(), 160, 34);

    // The server's address: a text box, typed into with the keyboard (on a Steam Deck, Steam + X).
    this.serverInput = document.createElement('input');
    Object.assign(this.serverInput, { type: 'text', maxLength: 200, spellcheck: false, placeholder: currentPlatform().network.defaultRelay });
    Object.assign(this.serverInput.style, {
      width: '300px',
      height: '28px',
      padding: '0 8px',
      font: `13px ${FONT}`,
      color: TEXT.title,
      background: '#0f0c13',
      border: '2px solid #0e0b12',
      boxShadow: 'inset 0 2px 0 #0a080d, 0 0 0 2px #4d3d57',
      borderRadius: '0',
      outline: 'none',
    });
    this.serverInput.value = this.relay();
    this.serverInput.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') this.serverInput.blur();
      if (event.key === 'Escape') {
        this.serverInput.value = this.relay();
        this.serverInput.blur();
      }
    });
    this.serverInput.addEventListener('focus', () => {
      this.row = MENU.indexOf('server');
      this.editingCode = false;
      this.render();
    });
    this.serverInput.addEventListener('blur', () => this.saveServer());
    this.serverBox = this.add.dom(LEFT_X + 150, this.rowY(2) + 44, this.serverInput).setOrigin(0, 0.5);

    this.ui = this.add.container(0, 0);

    const input = new InputLayer(this);
    for (const action of ['up', 'down', 'left', 'right', 'confirm', 'back', 'clear', 'next', 'prev'] as const) {
      input.on(action, () => this.act(action));
    }
    // The code's letters, typed: the keyboard goes straight into the boxes while they are open.
    // This listens after the input layer, which leaves keys alone while the boxes are open.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.typeCode(event));

    // A match from before carries on here; one already past the lobby is left behind.
    const match = currentMatch();
    if (match && !this.inLobby(match)) match.leave();
    this.follow(currentMatch());
    this.events.once('shutdown', () => this.stopListening?.());
    this.render();
  }

  private inLobby(match: VersusMatch): boolean {
    return match.phase === 'connecting' || match.phase === 'waiting' || match.phase === 'lobby';
  }

  /** The server this game meets the other at: the one you set, or the build's own. */
  private relay(): string {
    return currentSettings().relayUrl ?? currentPlatform().network.defaultRelay;
  }

  private follow(match: VersusMatch | null): void {
    this.stopListening?.();
    this.stopListening = match ? match.listen((event) => this.onEvent(event)) : null;
  }

  private onEvent(event: VersusEvent): void {
    switch (event.kind) {
      case 'room':
        playSound('uiConfirm');
        break;
      case 'paired':
        playSound('uiConfirm');
        this.notice = { text: currentMatch()?.role === 'host' ? 'Your friend joined!' : 'You joined the match.', color: TEXT.victory };
        break;
      case 'begin':
        this.scene.start('Prep', versusSetup(savedSetup(), event.rules));
        return;
      case 'error':
        this.notice = { text: event.text, color: TEXT.defeat };
        break;
      case 'gone':
        this.notice = { text: GONE_TEXT[event.why], color: TEXT.defeat };
        break;
      default:
        break;
    }
    if (this.scene.isActive()) this.render();
  }

  // Input ------------------------------------------------------------------------------------

  private act(action: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'clear' | 'next' | 'prev'): void {
    // The keyboard types the code itself (typeCode); a controller changes it letter by letter.
    if (this.editingCode) {
      if (inputDevice() === 'gamepad') this.codeAction(action);
      return;
    }
    if (action === 'back') return this.back();
    const match = currentMatch();
    if (match) return this.matchAction(match, action);
    if (action === 'up' || action === 'prev') this.row = (this.row + MENU.length - 1) % MENU.length;
    else if (action === 'down' || action === 'next') this.row = (this.row + 1) % MENU.length;
    else if (action === 'confirm') return this.choose(MENU[this.row]!);
    else if (action === 'clear' && MENU[this.row] === 'server') this.resetServer();
    else if (action === 'clear' && MENU[this.row] === 'join') this.code = this.code.map(() => '');
    this.render();
  }

  private choose(row: MenuRow): void {
    if (row === 'host') this.host();
    else if (row === 'join') this.editCode(this.code.findIndex((c) => c === '') === -1 ? 0 : this.code.findIndex((c) => c === ''));
    else this.serverInput.focus();
  }

  /** In a match: the host changes the map and rank, and starts; anyone can leave. */
  private matchAction(match: VersusMatch, action: string): void {
    if (match.role !== 'host' || match.phase === 'connecting') return;
    if (action === 'up' || action === 'prev') this.rulesRow = (this.rulesRow + RULES_ROWS.length - 1) % RULES_ROWS.length;
    else if (action === 'down' || action === 'next') this.rulesRow = (this.rulesRow + 1) % RULES_ROWS.length;
    else if (action === 'left' || action === 'right') this.changeRule(RULES_ROWS[this.rulesRow]!, action === 'left' ? -1 : 1);
    else if (action === 'confirm') return this.start(match);
    this.render();
  }

  private changeRule(row: RulesRow, step: number): void {
    const match = currentMatch();
    if (!match) return;
    const rules = match.rules;
    if (row === 'map') match.setRules({ ...rules, map: cycle(MAP_IDS, rules.map, step) });
    else match.setRules({ ...rules, rank: cycle(RANKS.map((r) => r.rank), rules.rank, step) });
  }

  private start(match: VersusMatch): void {
    if (match.phase !== 'lobby') {
      this.notice = { text: 'Your friend hasn’t joined yet.', color: TEXT.defeat };
      this.render();
      return;
    }
    match.begin();
  }

  /** The code with a controller: ↑↓ change the letter, ←→ move, Ⓐ joins, Ⓑ stops, Ⓧ clears. */
  private codeAction(action: string): void {
    if (action === 'up' || action === 'down') {
      const current = this.code[this.box] ?? '';
      const at = current === '' ? (action === 'up' ? 0 : CODE_ALPHABET.length - 1) : CODE_ALPHABET.indexOf(current) + (action === 'up' ? 1 : -1);
      this.code[this.box] = CODE_ALPHABET[(at + CODE_ALPHABET.length) % CODE_ALPHABET.length]!;
    } else if (action === 'left' || action === 'prev') this.box = Math.max(0, this.box - 1);
    else if (action === 'right' || action === 'next') this.box = Math.min(CODE_LENGTH - 1, this.box + 1);
    else if (action === 'clear') this.code[this.box] = '';
    else if (action === 'confirm') return this.join();
    else if (action === 'back') this.editingCode = false;
    this.render();
  }

  /** The code with the keyboard: letters fill the boxes, Backspace takes one back, Enter joins, Esc stops. */
  private typeCode(event: KeyboardEvent): void {
    if (!this.editingCode || event.repeat || event.timeStamp <= this.editingSince) return;
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    if (key.length === 1 && CODE_ALPHABET.includes(key)) {
      this.code[this.box] = key;
      this.box = Math.min(CODE_LENGTH - 1, this.box + 1);
      playSound('uiMove');
    } else if (key === 'Backspace') {
      if (this.code[this.box] === '' && this.box > 0) this.box -= 1;
      this.code[this.box] = '';
    } else if (key === 'ArrowLeft') this.box = Math.max(0, this.box - 1);
    else if (key === 'ArrowRight' || key === 'Tab') this.box = Math.min(CODE_LENGTH - 1, this.box + 1);
    else if (key === 'ArrowUp' || key === 'ArrowDown') return this.codeAction(key === 'ArrowUp' ? 'up' : 'down');
    else if (key === 'Enter') return this.join();
    else if (key === 'Escape') this.editingCode = false;
    else return;
    this.render();
  }

  private editCode(box: number): void {
    this.row = MENU.indexOf('join');
    this.editingCode = true;
    this.editingSince = performance.now();
    this.box = box;
    this.render();
  }

  private back(): void {
    if (this.editingCode) {
      this.editingCode = false;
      this.render();
      return;
    }
    const match = currentMatch();
    if (match) {
      match.leave();
      this.follow(null);
      this.notice = { text: 'You left the match.', color: TEXT.muted };
      this.render();
      return;
    }
    this.scene.start('Capital');
  }

  private host(): void {
    const rules: MatchRules = { map: savedSetup().map, rank: earnedRank() };
    this.notice = { text: '', color: TEXT.muted };
    this.follow(startMatch(currentPlatform().network, this.relay(), 'host', rules));
    this.render();
  }

  private join(): void {
    const code = this.code.join('');
    if (code.length < CODE_LENGTH) {
      this.notice = { text: `The code has ${CODE_LENGTH} letters.`, color: TEXT.defeat };
      this.render();
      return;
    }
    this.editingCode = false;
    this.notice = { text: '', color: TEXT.muted };
    this.follow(startMatch(currentPlatform().network, this.relay(), 'guest', { map: savedSetup().map, rank: earnedRank() }, code));
    this.render();
  }

  private saveServer(): void {
    const text = this.serverInput.value.trim();
    const own = currentPlatform().network.defaultRelay;
    if (text === '' || text === own) {
      this.resetServer();
      return;
    }
    if (!isRelayAddress(text)) {
      this.notice = { text: 'A server address starts with ws:// or wss://, like wss://example.com.', color: TEXT.defeat };
      this.serverInput.value = this.relay();
    } else if (text !== this.relay()) {
      void changeSettings({ relayUrl: text }).catch(() => undefined);
      this.notice = { text: `Server set: ${text}`, color: TEXT.victory };
    }
    if (this.scene.isActive()) this.render();
  }

  /** Back to the server this build was made for. */
  private resetServer(): void {
    if (currentSettings().relayUrl !== null) void changeSettings({ relayUrl: null }).catch(() => undefined);
    this.serverInput.value = this.relay();
    if (this.scene.isActive()) this.render();
  }

  // Drawing ----------------------------------------------------------------------------------

  private rowY(i: number): number {
    return TOP_BAR_HEIGHT + 20 + i * (ROW_H + 12);
  }

  private render(): void {
    this.ui.removeAll(true);
    const match = currentMatch();
    this.serverBox.setVisible(!match);
    if (match) this.renderMatch(match);
    else this.renderMenu();
    this.renderAbout(match);
    if (this.notice.text) {
      this.ui.add(this.add.text(LEFT_X, GAME_HEIGHT - 60, this.notice.text, { ...textStyle(14, this.notice.color, true), wordWrap: { width: LEFT_W } }));
    }
  }

  private renderMenu(): void {
    const lines: Record<MenuRow, [string, string]> = {
      host: ['Host a match', 'You get a code to give your friend, and pick the map and the rank.'],
      join: ['Join a match', this.editingCode ? 'Type the code, or ↑↓ change a letter and ←→ move. Enter joins.' : 'Enter the code your friend gives you.'],
      server: ['Server', `Both of you meet here. ${keyLabel('clear') ? `${keyLabel('clear')}: ` : ''}back to the game’s own.`],
    };
    MENU.forEach((row, i) => {
      const y = this.rowY(i);
      const on = this.row === i;
      const box = addFrame(this, LEFT_X, y, LEFT_W, ROW_H, on ? 'rowOn' : 'row').setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        this.row = i;
        this.choose(row);
      });
      this.ui.add(box);
      this.ui.add(this.add.text(LEFT_X + 16, y + 12, lines[row][0], textStyle(16, on ? TEXT.title : TEXT.body, true)));
      this.ui.add(this.add.text(LEFT_X + 16, y + ROW_H - 26, lines[row][1], { ...textStyle(12, TEXT.muted), wordWrap: { width: LEFT_W - 32 } }));
    });
    this.ui.add(addButton(this, LEFT_X + LEFT_W - 80, this.rowY(0) + 26, 'Host  ⏎', () => this.host(), 120, 30).container);
    this.renderCode(LEFT_X + 150, this.rowY(1) + 18, this.code, this.editingCode ? this.box : null, (i) => this.editCode(i));
    this.ui.add(addButton(this, LEFT_X + LEFT_W - 80, this.rowY(1) + 26, 'Join  ⏎', () => this.join(), 120, 30).container);
  }

  /** The code in its boxes; the box being typed in, lit. */
  private renderCode(x: number, y: number, code: readonly string[], editing: number | null, onClick?: (i: number) => void): void {
    code.forEach((letter, i) => {
      const bx = x + i * (BOX + BOX_GAP);
      const frame = addFrame(this, bx, y, BOX, BOX, editing === i ? 'rowOn' : 'well');
      if (onClick) frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => onClick(i));
      this.ui.add(frame);
      // The reading font: a code must be read right, and the title font's letters are fancy.
      this.ui.add(this.add.text(bx + BOX / 2, y + BOX / 2, letter || (editing === i ? '_' : '·'), textStyle(26, letter ? TEXT.title : TEXT.muted, true)).setOrigin(0.5));
    });
  }

  private renderMatch(match: VersusMatch): void {
    const y = this.rowY(0);
    const add = (text: string, at: number, size: number, color: string = TEXT.body, bold = false) =>
      this.ui.add(this.add.text(LEFT_X, at, text, { ...textStyle(size, color, bold), wordWrap: { width: LEFT_W } }));
    this.ui.add(addButton(this, LEFT_X + LEFT_W - 80, GAME_HEIGHT - 120, '◀ Leave  Esc', () => this.back(), 140, 32).container);
    if (match.phase === 'connecting') {
      add(`Connecting to ${this.relay()}…`, y, 16, TEXT.body, true);
      return;
    }
    if (match.role === 'host') {
      add(match.phase === 'waiting' ? 'YOUR CODE' : 'YOUR MATCH', y, 12, TEXT.muted, true);
      this.renderCode(LEFT_X, y + 20, match.code.split(''), null);
      add(
        match.phase === 'waiting' ? 'Give your friend this code. Waiting for them to join…' : 'Your friend is here. Set the battle, then start.',
        y + 80,
        14,
        match.phase === 'waiting' ? TEXT.body : TEXT.victory,
        true,
      );
      this.renderRules(match, y + 120, true);
      if (match.phase === 'lobby') this.ui.add(addButton(this, LEFT_X + 90, GAME_HEIGHT - 120, 'Start  ⏎', () => this.start(match), 160, 32).container);
      return;
    }
    add('YOU JOINED', y, 12, TEXT.muted, true);
    this.renderCode(LEFT_X, y + 20, match.code.split(''), null);
    add(match.phase === 'lobby' ? 'Your friend is setting the battle. It starts when they are ready…' : 'Joining…', y + 80, 14, TEXT.body, true);
    this.renderRules(match, y + 120, false);
  }

  /** The map and rank: the host changes them with ←→; the guest sees them. */
  private renderRules(match: VersusMatch, top: number, canChange: boolean): void {
    const { map, rank } = match.rules;
    const ruleRank = rankRules(rank);
    const lines: [RulesRow, string, string][] = [
      ['map', 'Map', MAPS[map].name],
      ['rank', 'Rank', `${ruleRank.numeral} · ${ruleRank.name}`],
    ];
    lines.forEach(([row, label, value], i) => {
      const y = top + i * 34;
      const on = canChange && this.rulesRow === i;
      this.ui.add(addFrame(this, LEFT_X, y, LEFT_W, 30, on ? 'rowOn' : 'row'));
      this.ui.add(this.add.text(LEFT_X + 14, y + 8, label, textStyle(13, on ? TEXT.title : TEXT.muted, true)));
      this.ui.add(this.add.text(LEFT_X + LEFT_W / 2 + 40, y + 15, value, textStyle(13, TEXT.body, true)).setOrigin(0.5));
      if (!canChange) return;
      for (const [dx, step, sign] of [[150, -1, '◀'], [LEFT_W - 40, 1, '▶']] as const) {
        const arrow = this.add.text(LEFT_X + dx, y + 15, sign, textStyle(13, TEXT.body)).setOrigin(0.5).setInteractive({ useHandCursor: true });
        arrow.on('pointerdown', () => {
          this.rulesRow = i;
          this.changeRule(row, step);
          this.render();
        });
        this.ui.add(arrow);
      }
    });
    this.ui.add(
      this.add.text(LEFT_X, top + 74, `Both armies fight at this rank: its card slots, pips, actions and conditions, whatever rank you have reached.${canChange ? '  ←→ change.' : ''}`, {
        ...textStyle(12, TEXT.muted),
        wordWrap: { width: LEFT_W },
      }),
    );
  }

  /** On the right: the map, and how Versus works. */
  private renderAbout(match: VersusMatch | null): void {
    let y = TOP_BAR_HEIGHT + 20;
    this.ui.add(addFrame(this, RIGHT_X - 12, y - 8, RIGHT_W + 24, GAME_HEIGHT - y - 24, 'panel'));
    if (match && match.phase !== 'connecting') {
      const map = MAPS[match.rules.map];
      const ground = this.add.image(RIGHT_X, y, groundTexture(this, map)).setOrigin(0).setScale(TROOP_ART_SCALE * PREVIEW_SCALE);
      const shapes = this.add.graphics().setPosition(RIGHT_X, y).setScale(PREVIEW_SCALE);
      drawZone(shapes, map.deployZones.player, 'player', 1);
      drawZone(shapes, map.deployZones.enemy, 'enemy', 1);
      for (const wall of map.walls) drawWall(shapes, wall, map.id);
      this.ui.add([ground, shapes]);
      y += map.height * PREVIEW_SCALE + 10;
      const host = match.role === 'host';
      this.ui.add(this.add.text(RIGHT_X, y, `${map.name.toUpperCase()}\n${map.terrainText}`, { ...textStyle(12, TEXT.body), wordWrap: { width: RIGHT_W } }));
      y += 54;
      this.ui.add(
        this.add.text(RIGHT_X, y, `You fight from the ${host ? 'left (blue)' : 'left too: your view is turned so your side is always on the left'}.`, {
          ...textStyle(12, TEXT.muted),
          wordWrap: { width: RIGHT_W },
        }),
      );
      return;
    }
    this.ui.add(this.add.text(RIGHT_X, y, 'HOW VERSUS WORKS', textStyle(12, TEXT.muted, true)));
    const points = [
      'The host picks the map and the rank. Both armies fight at that rank, so a new player and a veteran have the same cards to work with.',
      'Each of you brings your skirmish army and General and writes orders in secret. Each game checks the other’s army against the rules before the battle.',
      'In battle only your key presses travel. Both games run the same battle, and check every few seconds that they still agree.',
      'No Command XP and no pause: it’s a straight fight.',
    ];
    y += 24;
    for (const point of points) {
      const text = this.add.text(RIGHT_X + 14, y, point, { ...textStyle(13, TEXT.body), wordWrap: { width: RIGHT_W - 14 } });
      this.ui.add([this.add.text(RIGHT_X, y, '•', textStyle(13, TEXT.gold, true)), text]);
      y += text.height + 12;
    }
  }
}
