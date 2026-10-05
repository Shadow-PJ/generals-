// What the battle looks like beyond shapes (session 6B): troops as animated pixel-art sprites,
// arrows in flight, fallen troops left lying, and bursts of particles for hits, deaths, magic and
// broken walls. It only draws; the battle engine alone decides what happens.

import Phaser from 'phaser';
import type { UnitClass } from '../data/units';
import type { Side } from '../sim';
import type { TroopFrame } from './art/troops';
import { TROOP_ART_SCALE } from './art/troops';
import { arrowKey, FX, propKey, troopKey } from './art/textures';

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
