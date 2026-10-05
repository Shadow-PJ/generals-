// What the battle looks like beyond shapes (session 6B): troops as animated pixel-art sprites,
// arrows in flight, fallen troops left lying, and bursts of particles for hits, deaths, magic and
// broken walls. It only draws; the battle engine alone decides what happens.

import Phaser from 'phaser';
import type { UnitClass } from '../data/units';
import type { Side, Wall } from '../sim';
import type { TroopFrame } from './art/troops';
import { TROOP_ART_SCALE } from './art/troops';
import { addWallImage, arrowKey, FX, propKey, troopKey } from './art/textures';
import { wallKind, wallStands } from './draw';

/** Kinds of particle bursts, each with its look. */
export type BurstKind = 'hit' | 'heavy' | 'fire' | 'frost' | 'magic' | 'gold' | 'puff' | 'dust' | 'stone' | 'heal';

interface BurstLook {
  texture: string;
  tint: number;
  count: number;
  speed: [number, number];
  lifespan: number;
  scale: number;
  /** Pulls the particles down (positive) or up (negative), world units per second². */
  gravityY?: number;
}

const BURSTS: Readonly<Record<BurstKind, BurstLook>> = {
  hit: { texture: FX.spark, tint: 0xfff1a0, count: 4, speed: [50, 130], lifespan: 220, scale: 1.4 },
  heavy: { texture: FX.spark, tint: 0xffffff, count: 9, speed: [80, 200], lifespan: 300, scale: 1.8 },
  fire: { texture: FX.dot, tint: 0xffa040, count: 6, speed: [20, 70], lifespan: 420, scale: 1.6, gravityY: -120 },
  frost: { texture: FX.dot, tint: 0xc8efff, count: 6, speed: [20, 70], lifespan: 420, scale: 1.6, gravityY: 40 },
  magic: { texture: FX.dot, tint: 0xd2b4ff, count: 8, speed: [30, 90], lifespan: 500, scale: 1.4, gravityY: -60 },
  gold: { texture: FX.spark, tint: 0xf6c945, count: 12, speed: [40, 150], lifespan: 600, scale: 1.6, gravityY: -40 },
  puff: { texture: FX.puff, tint: 0xb9bfc9, count: 6, speed: [15, 50], lifespan: 520, scale: 1.4, gravityY: -30 },
  dust: { texture: FX.puff, tint: 0x9c8a6e, count: 5, speed: [20, 60], lifespan: 420, scale: 1.1 },
  stone: { texture: FX.chunk, tint: 0x9aa1ad, count: 14, speed: [60, 180], lifespan: 650, scale: 2, gravityY: 360 },
  heal: { texture: FX.dot, tint: 0x86efac, count: 6, speed: [10, 40], lifespan: 600, scale: 1.4, gravityY: -80 },
};

/** Bursts of particles in the battlefield's coordinates. */
export class Bursts {
  readonly emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private readonly byKind = new Map<BurstKind, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(scene: Phaser.Scene) {
    for (const [kind, look] of Object.entries(BURSTS) as [BurstKind, BurstLook][]) {
      const emitter = scene.add.particles(0, 0, look.texture, {
        speed: { min: look.speed[0], max: look.speed[1] },
        angle: { min: 0, max: 360 },
        lifespan: look.lifespan,
        scale: { start: look.scale, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: look.gravityY ?? 0,
        tint: look.tint,
        emitting: false,
      });
      this.emitters.push(emitter);
      this.byKind.set(kind, emitter);
    }
  }

  /** A burst at (x, y); `scale` makes it bigger or smaller (more or fewer particles). */
  burst(kind: BurstKind, x: number, y: number, scale = 1): void {
    const count = Math.max(1, Math.round(BURSTS[kind].count * scale));
    this.byKind.get(kind)?.explode(count, x, y);
  }

  /** Bursts spread over a rectangle: a wall falling down. */
  burstOver(kind: BurstKind, x: number, y: number, w: number, h: number, pieces: number): void {
    for (let i = 0; i < pieces; i++) this.burst(kind, x + ((i * 37) % 100) / 100 * w, y + ((i * 61 + 13) % 100) / 100 * h, 0.5);
  }
}

/** How a troop's sprite looks this frame. */
export interface TroopLook {
  cls: UnitClass | 'turret';
  side: Side;
  frame: TroopFrame;
  x: number;
  y: number;
  flipX: boolean;
  alpha: number;
  /** 0 to 1: how much it brightens after a hit, fading out. */
  flash: number;
  /** A color laid over it (a wraith's violet), or null. */
  tint: number | null;
  /** 1 for a plain troop; elites are bigger. */
  size: number;
}

/** One sprite per troop, made the first time the troop shows, drawn back to front. */
export class TroopSprites {
  readonly layer: Phaser.GameObjects.Container;
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private shown = new Set<number>();

  constructor(private readonly scene: Phaser.Scene) {
    this.layer = scene.add.container(0, 0);
  }

  /** Starts a frame: every sprite not shown again before `end` is hidden. */
  begin(): void {
    this.shown = new Set();
  }

  show(id: number, look: TroopLook): void {
    let sprite = this.sprites.get(id);
    const key = troopKey(look.cls, look.side);
    if (!sprite) {
      sprite = this.scene.add.image(0, 0, key, look.frame);
      this.layer.add(sprite);
      this.sprites.set(id, sprite);
    }
    sprite
      .setTexture(key, look.frame)
      .setPosition(Math.round(look.x), Math.round(look.y))
      .setFlipX(look.flipX)
      .setAlpha(look.alpha)
      .setScale(TROOP_ART_SCALE * look.size)
      .setVisible(true);
    if (look.flash > 0) {
      // Brightened toward white, less as the flash fades, so a troop hit again and again still shows.
      const level = Math.round(0x70 * look.flash);
      sprite.setTint(level * 0x010101).setTintMode(Phaser.TintModes.ADD);
    } else if (look.tint !== null) sprite.setTint(look.tint).setTintMode(Phaser.TintModes.MULTIPLY);
    else sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.shown.add(id);
  }

  /** Hides troops not shown this frame and puts the rest in order, the nearest (lowest) last. */
  end(): void {
    for (const [id, sprite] of this.sprites) if (!this.shown.has(id)) sprite.setVisible(false);
    this.layer.sort('y');
  }
}

/** Arrows and bolts in flight, one sprite per projectile, turned along their way. */
export class ArrowSprites {
  readonly layer: Phaser.GameObjects.Container;
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private shown = new Set<number>();

  constructor(private readonly scene: Phaser.Scene) {
    this.layer = scene.add.container(0, 0);
  }

  begin(): void {
    this.shown = new Set();
  }

  /** `bolt`: a turret's bolt rather than an arrow; `tint`: an arrow burning or frozen by a Rift. */
  show(id: number, side: Side, x: number, y: number, angle: number, bolt: boolean, tint: number | null): void {
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = this.scene.add.image(0, 0, bolt ? propKey('bolt') : arrowKey(side)).setScale(TROOP_ART_SCALE);
      this.layer.add(sprite);
      this.sprites.set(id, sprite);
    }
    sprite.setPosition(x, y).setRotation(angle).setVisible(true);
    if (tint !== null) sprite.setTint(tint);
    this.shown.add(id);
  }

  end(): void {
    for (const [id, sprite] of this.sprites) {
      if (this.shown.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }
}

/** A fallen troop left lying where it fell, greyed and faint. */
export function addFallen(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, cls: UnitClass | 'turret', side: Side, x: number, y: number): void {
  const body = scene.add
    .image(Math.round(x), Math.round(y) + 4, troopKey(cls, side), 'stand')
    .setScale(TROOP_ART_SCALE)
    .setAngle(side === 'player' ? -90 : 90)
    .setTint(0x8a8f99)
    .setAlpha(0.55);
  layer.add(body);
}

/** The walls as pixel-art blocks, one image each, made as walls appear (Fortify raises new ones) and hidden once they fall. */
export class WallSprites {
  readonly layer: Phaser.GameObjects.Container;
  private readonly images = new Map<number, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {
    this.layer = scene.add.container(0, 0);
  }

  sync(walls: readonly Wall[], mapId: string): void {
    for (const wall of walls) {
      let image = this.images.get(wall.id);
      if (!image) {
        image = addWallImage(this.scene, wall, wallKind(wall, mapId));
        this.layer.add(image);
        this.images.set(wall.id, image);
      }
      image.setVisible(wallStands(wall));
    }
  }
}

/** Each map's air: what drifts over the field. */
const AMBIENCE: Readonly<Record<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig>> = {
  // Pollen on the breeze.
  openField: { speedX: { min: 6, max: 16 }, speedY: { min: -4, max: 4 }, tint: [0xfff6c0, 0xffffff], alpha: { start: 0.55, end: 0 }, scale: { min: 0.5, max: 0.9 }, frequency: 260, lifespan: 7000 },
  // Leaves falling.
  deepForest: { texture: FX.chunk, speedX: { min: 8, max: 18 }, speedY: { min: 10, max: 22 }, rotate: { min: 0, max: 360 }, tint: [0x58b05a, 0x2f7a3f, 0xc8a040], alpha: { start: 0.8, end: 0 }, scale: { min: 0.8, max: 1.2 }, frequency: 220, lifespan: 7000 },
  // Violet motes rising.
  voidRuins: { speedX: { min: -4, max: 4 }, speedY: { min: -16, max: -6 }, tint: [0xd2b4ff, 0x8b5cf6], alpha: { start: 0.7, end: 0 }, scale: { min: 0.5, max: 1 }, frequency: 180, lifespan: 6000, blendMode: 'ADD' },
  // Dust blown across the canyon.
  redCanyon: { speedX: { min: 40, max: 80 }, speedY: { min: -3, max: 3 }, tint: [0xe0b080, 0xc89060], alpha: { start: 0.45, end: 0 }, scale: { min: 0.5, max: 1 }, frequency: 120, lifespan: 4000 },
  // Embers from the forges.
  ironFortress: { speedX: { min: -6, max: 6 }, speedY: { min: -24, max: -10 }, tint: [0xffb24a, 0xf2541b], alpha: { start: 0.85, end: 0 }, scale: { min: 0.4, max: 0.8 }, frequency: 160, lifespan: 4500, blendMode: 'ADD' },
  // Glints on the glass.
  glassPlains: { texture: FX.spark, speedX: 0, speedY: 0, tint: [0xffffff, 0x9ee7e3], alpha: { values: [0, 0.9, 0], interpolation: 'linear' }, scale: { min: 0.4, max: 0.7 }, frequency: 140, lifespan: 900, blendMode: 'ADD' },
};

/** The map's air over a field `w × h` big: drifting pollen, leaves, motes, dust, embers or glints. */
export function addAmbience(scene: Phaser.Scene, mapId: string, w: number, h: number): Phaser.GameObjects.Particles.ParticleEmitter {
  const { texture, ...look } = { texture: FX.dot, ...(AMBIENCE[mapId] ?? AMBIENCE.openField!) };
  return scene.add.particles(0, 0, texture as string, { x: { min: -20, max: w }, y: { min: -10, max: h }, advance: 6000, ...look });
}
