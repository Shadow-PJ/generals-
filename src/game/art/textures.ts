// Turns the pixel art into Phaser textures once, when the game starts (the Boot screen), and
// each map's ground the first time it is shown. Every texture is drawn at art size and shown
// scaled up with nearest-pixel filtering, so pixels stay crisp at any window size.

import Phaser from 'phaser';
import { GENERAL_IDS, type GeneralId } from '../../data/generals';
import type { MapData } from '../../data/maps';
import { REGION_IDS, type RegionId } from '../../data/regions';
import { UNIT_CLASSES, type UnitClass } from '../../data/units';
import type { Side } from '../../sim';
import { groundImage } from './ground';
import { CAPITAL_ICON, REGION_ICONS } from './icons';
import { BASE, sidePalette } from './palette';
import { runs, type Palette, type Sprite } from './pixels';
import { PORTRAITS, portraitPalette } from './portraits';
import { PROP_ART, type PropId } from './props';
import { TROOP_ART, TROOP_ART_SCALE, TURRET_ART } from './troops';

const SIDES: readonly Side[] = ['player', 'enemy'];

export const troopKey = (cls: UnitClass | 'turret', side: Side) => `troop-${cls}-${side}`;
export const arrowKey = (side: Side) => `arrow-${side}`;
export const propKey = (prop: PropId) => `prop-${prop}`;
export const portraitKey = (general: GeneralId) => `portrait-${general}`;
export const regionKey = (region: RegionId) => `region-${region}`;
export const CAPITAL_KEY = 'capital';
const groundKey = (map: MapData) => `ground-${map.id}`;
/** White particles, tinted when they burst. */
export const FX = { spark: 'fx-spark', dot: 'fx-dot', puff: 'fx-puff', chunk: 'fx-chunk' } as const;

/** One texture holding the sprite's frames side by side, each a named frame. */
function addSprite(textures: Phaser.Textures.TextureManager, key: string, sprite: Sprite, palette: Palette): void {
  if (textures.exists(key)) return;
  const names = Object.keys(sprite.frames);
  const texture = textures.createCanvas(key, sprite.w * names.length, sprite.h);
  if (!texture) return;
  const ctx = texture.getContext();
  names.forEach((name, i) => {
    for (const run of runs(sprite.frames[name]!, palette)) {
      ctx.fillStyle = `#${run.color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(i * sprite.w + run.x, run.y, run.w, 1);
    }
    texture.add(name, 0, i * sprite.w, 0, sprite.w, sprite.h);
  });
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Makes every sprite's texture; textures belong to the whole game, so once is enough. */
export function makeArtTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;
  for (const side of SIDES) {
    for (const cls of Object.keys(UNIT_CLASSES) as UnitClass[]) addSprite(textures, troopKey(cls, side), TROOP_ART[cls], sidePalette(side));
    addSprite(textures, troopKey('turret', side), TURRET_ART, sidePalette(side));
    addSprite(textures, arrowKey(side), PROP_ART.arrow, sidePalette(side));
  }
  for (const prop of Object.keys(PROP_ART) as PropId[]) addSprite(textures, propKey(prop), PROP_ART[prop], BASE);
  addSprite(textures, FX.spark, PROP_ART.spark, BASE);
  addSprite(textures, FX.dot, PROP_ART.dot, BASE);
  addSprite(textures, FX.puff, PROP_ART.puff, BASE);
  addSprite(textures, FX.chunk, PROP_ART.chunk, BASE);
  for (const general of GENERAL_IDS) addSprite(textures, portraitKey(general), PORTRAITS[general], portraitPalette(general));
  for (const region of REGION_IDS) addSprite(textures, regionKey(region), REGION_ICONS[region], BASE);
  addSprite(textures, CAPITAL_KEY, CAPITAL_ICON, BASE);
}

/** The map's ground, scenery and all, as an image covering the field from its top-left corner. */
export function addGround(scene: Phaser.Scene, map: MapData): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, groundTexture(scene, map)).setOrigin(0).setScale(TROOP_ART_SCALE);
}

/** The map's ground as a texture, made the first time it is asked for. */
export function groundTexture(scene: Phaser.Scene, map: MapData): string {
  const key = groundKey(map);
  if (scene.textures.exists(key)) return key;
  const image = groundImage(map);
  const texture = scene.textures.createCanvas(key, image.w, image.h);
  if (!texture) return key;
  const ctx = texture.getContext();
  const data = ctx.createImageData(image.w, image.h);
  image.pixels.forEach((color, i) => {
    data.data[i * 4] = (color >> 16) & 0xff;
    data.data[i * 4 + 1] = (color >> 8) & 0xff;
    data.data[i * 4 + 2] = color & 0xff;
    data.data[i * 4 + 3] = 0xff;
  });
  ctx.putImageData(data, 0, 0);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}
