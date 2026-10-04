// Screen layout, colors and fonts. Simple shapes and colors until real art arrives in 6B.

import { OPEN_FIELD } from '../data/maps';

/** Height of the bar above the battlefield that holds titles, the clock and buttons. */
export const TOP_BAR_HEIGHT = 64;
/** Height of the bar below the battlefield that holds the card slots, pips and Momentum. */
export const BOTTOM_BAR_HEIGHT = 100;
export const GAME_WIDTH = OPEN_FIELD.width;
export const GAME_HEIGHT = OPEN_FIELD.height + TOP_BAR_HEIGHT + BOTTOM_BAR_HEIGHT;
/** Where the bottom bar starts. */
export const BOTTOM_BAR_Y = TOP_BAR_HEIGHT + OPEN_FIELD.height;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const COLORS = {
  background: 0x141a24,
  field: 0x1f2a38,
  fieldLine: 0x26344a,
  side: { player: 0x4da3ff, enemy: 0xff6b5b },
  sideDark: { player: 0x1b4a78, enemy: 0x80281f },
  projectile: { player: 0xcfe7ff, enemy: 0xffd0c8 },
  wall: 0x8c96a8,
  wallEdge: 0x5a6476,
  crack: 0x2a313d,
  hpBack: 0x0b0f16,
  hpGood: 0x4ade80,
  hpMid: 0xfacc15,
  hpLow: 0xf87171,
  barrier: 0x67e8f9,
  mark: 0xfde047,
  selected: 0xffffff,
  invalid: 0xf87171,
  glow: 0xfacc15,
  pip: 0x7dd3fc,
  momentum: 0xf59e0b,
  chased: 0xc4b5fd,
  stun: 0xfde047,
  /** Rifts by element: plain, fire (Pyromancer), frost (Frostcaller). */
  rift: { arcane: 0xa78bfa, fire: 0xfb923c, frost: 0x7dd3fc },
  silenced: 0xf0abfc,
  taunt: 0xf87171,
  /** The Generals' skills and ultimates. */
  wraith: 0xa855f7,
  elite: 0xfbbf24,
  haste: 0xef4444,
  vibration: 0x22d3ee,
  shell: 0x9ca3af,
  claws: 0xf97316,
  heat: 0xfb923c,
  beam: 0xfde68a,
  gravityWell: 0x6366f1,
  /** Terrain: forests (Deep Forest), rock and iron (Red Canyon, Iron Fortress), open glass (Glass Plains). */
  forest: 0x14532d,
  tree: 0x166534,
  /** A wall raised by Fortify (Legendary action). */
  fortify: 0xc2a46a,
  fortifyEdge: 0x7d6236,
  rock: 0x4b3a33,
  rockEdge: 0x2b211d,
  plains: 0x24303f,
  /** Rarity rings on run fighters (Common has none). */
  rarity: { common: 0x9ca3af, rare: 0x60a5fa, epic: 0xc084fc, legendary: 0xfbbf24 },
  /** The factions of run fighters (session 5C). */
  faction: { bloodbound: 0xdc2626, forgeborn: 0xea580c, hive: 0x84cc16, voidweavers: 0x8b5cf6, resonance: 0x22d3ee },
  /** The regions on the world map. */
  region: { deepForest: 0x15803d, voidRuins: 0x7c3aed, redCanyon: 0xc2410c, ironFortress: 0x64748b, glassPlains: 0x0891b2 },
  capital: 0xd4a94e,
  /** Nodes on a run's map, by kind. */
  node: { battle: 0xf87171, elite: 0xfb923c, event: 0x60a5fa, merchant: 0xfacc15, camp: 0x4ade80, boss: 0xc084fc },
  panel: 0x1a2230,
  panelEdge: 0x3a4a60,
  row: 0x1d2939,
  rowEdge: 0x34465e,
  rowSelected: 0x2b3a50,
} as const;

export const TEXT = {
  title: '#f2e6c9',
  body: '#d6dde8',
  muted: '#8b97a8',
  victory: '#86efac',
  defeat: '#fca5a5',
  overtime: '#fb923c',
  perfect: '#fde047',
  threat: '#fca5a5',
  combo: '#c4b5fd',
  gold: '#fcd34d',
  rarity: { common: '#d6dde8', rare: '#93c5fd', epic: '#d8b4fe', legendary: '#fcd34d' },
  faction: { bloodbound: '#f87171', forgeborn: '#fb923c', hive: '#a3e635', voidweavers: '#a78bfa', resonance: '#67e8f9' },
} as const;
