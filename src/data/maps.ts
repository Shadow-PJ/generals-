// Battle maps. Coordinates are world units with (0, 0) at the top left.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WallData extends Rect {
  /** Damage the wall stops before it breaks. Leave out to use BATTLE_RULES.walls.hp. */
  hp?: number;
  /** Canyon rock and fortress iron: it stops shots but never breaks. */
  unbreakable?: boolean;
}

export type MapId = 'openField' | 'deepForest' | 'voidRuins' | 'redCanyon' | 'ironFortress' | 'glassPlains';

export interface MapData {
  /** A MapId for the game's maps; tests build their own. */
  id: string;
  name: string;
  /** How the map plays, in a sentence, for the map choice. */
  terrainText: string;
  width: number;
  height: number;
  /** Walls block movement and shots until they break. */
  walls: WallData[];
  /** Where each side may place its troops before battle. */
  deployZones: { player: Rect; enemy: Rect };
  /** Forest: a troop inside can't be seen by enemies farther away than `forestSight`. */
  forests?: Rect[];
  forestSight?: number;
  /** Open ground: ranged troops reach this much further (0.15 = 15%). */
  rangedReachBonus?: number;
}

const WIDTH = 960;
const HEIGHT = 540;
/** Every map uses the same deploy zones, so your troops stand where they may on any of them. */
const DEPLOY_ZONES = {
  player: { x: 40, y: 40, w: 260, h: 460 },
  enemy: { x: 660, y: 40, w: 260, h: 460 },
};

/** The rectangles plus their mirror images across the middle of the map, so neither side starts better off. */
function mirrored<T extends Rect>(rects: T[]): T[] {
  return [...rects, ...rects.map((r) => ({ ...r, x: WIDTH - r.x - r.w }))];
}

// An open field: two pillars in the middle and a low wall on each flank of each side.
// It is a mirror image left to right, so neither side starts with better cover.
export const OPEN_FIELD: MapData = {
  id: 'openField',
  name: 'Open Field',
  terrainText: 'A few walls in the middle and on the flanks. No special rule.',
  width: WIDTH,
  height: HEIGHT,
  walls: [
    { x: 455, y: 110, w: 50, h: 100 },
    { x: 455, y: 330, w: 50, h: 100 },
    { x: 330, y: 60, w: 24, h: 90 },
    { x: 330, y: 390, w: 24, h: 90 },
    { x: 606, y: 60, w: 24, h: 90 },
    { x: 606, y: 390, w: 24, h: 90 },
  ],
  deployZones: DEPLOY_ZONES,
};

// The five regions of the campaign (docs/DESIGN.md, Campaign), each with its terrain rule.

/** Deep Forest: hidden movement. Troops in the woods are seen only from close by, so Assassins are deadly here. */
export const DEEP_FOREST: MapData = {
  id: 'deepForest',
  name: 'Deep Forest',
  terrainText: 'Woods hide troops: an enemy in the trees is seen only from within 100. Assassins are deadly.',
  width: WIDTH,
  height: HEIGHT,
  walls: mirrored([{ x: 352, y: 250, w: 40, h: 40 }]),
  forests: [
    ...mirrored([
      { x: 320, y: 50, w: 130, h: 150 },
      { x: 320, y: 340, w: 130, h: 150 },
    ]),
    { x: 420, y: 215, w: 120, h: 110 },
  ],
  forestSight: 100,
  deployZones: DEPLOY_ZONES,
};

/** Void Ruins: broken walls everywhere. They cut sightlines and break fast. */
export const VOID_RUINS: MapData = {
  id: 'voidRuins',
  name: 'Void Ruins',
  terrainText: 'Many broken walls cut sightlines; they are weak and break fast. Ranged control wins.',
  width: WIDTH,
  height: HEIGHT,
  walls: [
    ...mirrored([
      { x: 340, y: 70, w: 20, h: 70, hp: 200 },
      { x: 340, y: 235, w: 20, h: 70, hp: 200 },
      { x: 340, y: 400, w: 20, h: 70, hp: 200 },
      { x: 400, y: 150, w: 50, h: 18, hp: 200 },
      { x: 400, y: 372, w: 50, h: 18, hp: 200 },
    ]),
    { x: 465, y: 40, w: 30, h: 60, hp: 200 },
    { x: 465, y: 240, w: 30, h: 60, hp: 200 },
    { x: 465, y: 440, w: 30, h: 60, hp: 200 },
  ],
  deployZones: DEPLOY_ZONES,
};

/** Red Canyon: rock walls that never break leave three narrow paths. Tanks shine. */
export const RED_CANYON: MapData = {
  id: 'redCanyon',
  name: 'Red Canyon',
  terrainText: 'Rock that never breaks leaves three narrow paths. Vanguards hold them; tanks shine.',
  width: WIDTH,
  height: HEIGHT,
  walls: [
    { x: 330, y: 95, w: 300, h: 125, unbreakable: true },
    { x: 330, y: 320, w: 300, h: 125, unbreakable: true },
  ],
  deployZones: DEPLOY_ZONES,
};

/** Iron Fortress: each side behind an iron wall with two gates. Positioning is everything. */
export const IRON_FORTRESS: MapData = {
  id: 'ironFortress',
  name: 'Iron Fortress',
  terrainText: 'Each army stands behind an iron wall that never breaks; the only ways out are two gates.',
  width: WIDTH,
  height: HEIGHT,
  walls: [
    ...mirrored([
      { x: 315, y: 0, w: 22, h: 150, unbreakable: true },
      { x: 315, y: 215, w: 22, h: 110, unbreakable: true },
      { x: 315, y: 390, w: 22, h: 150, unbreakable: true },
    ]),
    { x: 455, y: 230, w: 50, h: 80 },
  ],
  deployZones: DEPLOY_ZONES,
};

/** Glass Plains: open ground, nothing to hide behind. Long range dominates. */
export const GLASS_PLAINS: MapData = {
  id: 'glassPlains',
  name: 'Glass Plains',
  terrainText: 'Open ground with no walls; ranged troops reach 15% further. Long range dominates.',
  width: WIDTH,
  height: HEIGHT,
  walls: [],
  rangedReachBonus: 0.15,
  deployZones: DEPLOY_ZONES,
};

export const MAPS: Readonly<Record<MapId, MapData>> = {
  openField: OPEN_FIELD,
  deepForest: DEEP_FOREST,
  voidRuins: VOID_RUINS,
  redCanyon: RED_CANYON,
  ironFortress: IRON_FORTRESS,
  glassPlains: GLASS_PLAINS,
};
export const MAP_IDS: readonly MapId[] = ['openField', 'deepForest', 'voidRuins', 'redCanyon', 'ironFortress', 'glassPlains'];
