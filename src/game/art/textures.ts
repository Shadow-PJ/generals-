// Turns the pixel art into Phaser textures once, when the game starts (the Boot screen), and
// each map's ground the first time it is shown. Every texture is drawn at art size and shown
// scaled up with nearest-pixel filtering, so pixels stay crisp at any window size.

import Phaser from 'phaser';
import { GENERAL_IDS, type GeneralId } from '../../data/generals';
import type { MapData } from '../../data/maps';
import { REGION_IDS, type RegionId } from '../../data/regions';
import { UNIT_CLASSES, type UnitClass } from '../../data/units';
import type { Side } from '../../sim';
import { backdropPixels, FRAME_STYLES, framePixels, UI_PIXEL, type FrameStyleId, type PixelImage } from './frames';
import { groundImage } from './ground';
import { stopScenePixels, type StopScene } from './stops';
import { titlePixels } from './title';
import { wallPixels, type WallKind } from './walls';
import { CASTLE_ART, CASTLE_PALETTE, CLEARED_ICON, cloudPixels, LOCK_ICON, MARKER_ARROW, medallionPixels, RUN_BANNER, regionLandPixels, worldMapPixels, type WorldMapPlan } from './worldMap';
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
/** The world map's pieces: the castle, the arrow over the region in focus, your run's banner, a lock and a tick. */
export const MAP_ART = {
  castle: 'map-castle',
  arrow: 'map-arrow',
  banner: 'map-banner',
  enemyBanner: 'map-banner-enemy',
  lock: 'map-lock',
  cleared: 'map-cleared',
} as const;
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
  addSprite(textures, MAP_ART.castle, CASTLE_ART, CASTLE_PALETTE);
  addSprite(textures, MAP_ART.arrow, MARKER_ARROW, BASE);
  addSprite(textures, MAP_ART.banner, RUN_BANNER, sidePalette('player'));
  addSprite(textures, MAP_ART.enemyBanner, RUN_BANNER, sidePalette('enemy'));
  addSprite(textures, MAP_ART.lock, LOCK_ICON, BASE);
  addSprite(textures, MAP_ART.cleared, CLEARED_ICON, { ...BASE, x: 0x86efac });
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

/** A picture worked out in code (0xAARRGGBB pixels) as a crisp texture, made once. */
function pixelTexture(textures: Phaser.Textures.TextureManager, key: string, image: PixelImage): string {
  if (textures.exists(key)) return key;
  const texture = textures.createCanvas(key, image.w, image.h);
  if (!texture) return key;
  const ctx = texture.getContext();
  const data = ctx.createImageData(image.w, image.h);
  image.pixels.forEach((color, i) => {
    data.data[i * 4] = (color >>> 16) & 0xff;
    data.data[i * 4 + 1] = (color >>> 8) & 0xff;
    data.data[i * 4 + 2] = color & 0xff;
    data.data[i * 4 + 3] = (color >>> 24) & 0xff;
  });
  ctx.putImageData(data, 0, 0);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** Art pixels for a length in world units. */
export const artPixels = (length: number): number => Math.max(4, Math.round(length / UI_PIXEL));

/** A frame's texture for a box `w × h` world units big, made the first time that size is asked for. */
export function frameTexture(scene: Phaser.Scene, style: FrameStyleId, w: number, h: number): string {
  const aw = artPixels(w);
  const ah = artPixels(h);
  return pixelTexture(scene.textures, `frame-${style}-${aw}x${ah}`, framePixels(FRAME_STYLES[style], aw, ah));
}

/** The menus' backdrop for a screen `w × h` world units big. */
export function backdropTexture(scene: Phaser.Scene, w: number, h: number): string {
  const aw = artPixels(w);
  const ah = artPixels(h);
  return pixelTexture(scene.textures, `backdrop-${aw}x${ah}`, backdropPixels(aw, ah));
}

/** The world map for this layout, made once. */
export function worldMapTexture(scene: Phaser.Scene, plan: WorldMapPlan): string {
  const sites = plan.regions.map((r) => `${r.x},${r.y}`).join(';');
  return pixelTexture(scene.textures, `world-map-${plan.w}x${plan.h}-${plan.capital.x},${plan.capital.y}-${sites}`, worldMapPixels(plan));
}

/** A cloud of fog, one of a few shapes. */
export function cloudTexture(scene: Phaser.Scene, shape: number): string {
  return pixelTexture(scene.textures, `cloud-${shape}`, cloudPixels(40, 22, shape));
}

/** A region marker's medallion, `size` art pixels across. */
export function medallionTexture(scene: Phaser.Scene, size: number, ring: { light: number; dark: number }, fill: number): string {
  return pixelTexture(scene.textures, `medallion-${size}-${ring.light}-${ring.dark}-${fill}`, medallionPixels(size, ring, fill));
}

/** A region's land under the road of a run, `w × h` world units. */
export function regionLandTexture(scene: Phaser.Scene, w: number, h: number, region: RegionId): string {
  const aw = artPixels(w);
  const ah = artPixels(h);
  return pixelTexture(scene.textures, `region-land-${region}-${aw}x${ah}`, regionLandPixels(aw, ah, region));
}

/** A wall as a pixel-art block covering its footprint, `w × h` world units. */
export function wallTexture(scene: Phaser.Scene, kind: WallKind, w: number, h: number): string {
  const aw = artPixels(w);
  const ah = artPixels(h);
  return pixelTexture(scene.textures, `wall-${kind}-${aw}x${ah}`, wallPixels(aw, ah, kind));
}

/** A wall's block at its place, its top-left corner on the wall's. */
export function addWallImage(scene: Phaser.Scene, wall: { x: number; y: number; w: number; h: number }, kind: WallKind): Phaser.GameObjects.Image {
  return scene.add
    .image(wall.x, wall.y, wallTexture(scene, kind, wall.w, wall.h))
    .setOrigin(0)
    .setDisplaySize(wall.w, wall.h);
}

/** The title screen's picture, `w × h` world units. */
export function titleTexture(scene: Phaser.Scene, w: number, h: number): string {
  const aw = artPixels(w);
  const ah = artPixels(h);
  return pixelTexture(scene.textures, `title-${aw}x${ah}`, titlePixels(aw, ah));
}

/** A run stop's picture (session 7E), `w × h` world units, in the region's colors. */
export function stopSceneTexture(scene: Phaser.Scene, stop: StopScene, region: RegionId, w: number, h: number): string {
  const aw = artPixels(w);
  const ah = artPixels(h);
  return pixelTexture(scene.textures, `stop-${stop}-${region}-${aw}x${ah}`, stopScenePixels(stop, region, aw, ah));
}
