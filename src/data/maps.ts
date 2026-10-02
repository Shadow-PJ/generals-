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

// A plain field with two pillars in the middle, for testing the engine.
// The real open-field map arrives with the renderer in session 1B.
export const TRAINING_FIELD: MapData = {
  id: 'training-field',
  name: 'Training Field',
  width: 960,
  height: 540,
  walls: [
    { x: 450, y: 110, w: 60, h: 100 },
    { x: 450, y: 330, w: 60, h: 100 },
  ],
  deployZones: {
    player: { x: 40, y: 40, w: 260, h: 460 },
    enemy: { x: 660, y: 40, w: 260, h: 460 },
  },
};
