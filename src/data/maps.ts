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
}

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Walls block movement and shots until they break. */
  walls: WallData[];
  /** Where each side may place its troops before battle. */
  deployZones: { player: Rect; enemy: Rect };
}

// An open field: two pillars in the middle and a low wall on each flank of each side.
// It is a mirror image left to right, so neither side starts with better cover.
export const OPEN_FIELD: MapData = {
  id: 'open-field',
  name: 'Open Field',
  width: 960,
  height: 540,
  walls: [
    { x: 455, y: 110, w: 50, h: 100 },
    { x: 455, y: 330, w: 50, h: 100 },
    { x: 330, y: 60, w: 24, h: 90 },
    { x: 330, y: 390, w: 24, h: 90 },
    { x: 606, y: 60, w: 24, h: 90 },
    { x: 606, y: 390, w: 24, h: 90 },
  ],
  deployZones: {
    player: { x: 40, y: 40, w: 260, h: 460 },
    enemy: { x: 660, y: 40, w: 260, h: 460 },
  },
};
