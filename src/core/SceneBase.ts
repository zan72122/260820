import * as THREE from 'three';
import type { CameraRig, Viewport } from './Framing';
import type { EnvironmentRig } from '../world/Environment';
import type { AssetLibrary } from '../world/Assets';
import type { QualityProfile } from './Quality';
import type { GameState, StageId } from './GameState';
import type { HintDirector } from './HintDirector';
import type { AudioEngine } from './Audio';
import type { Pointer, Picker } from './Input';

export interface GameContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  rig: CameraRig;
  env: EnvironmentRig;
  assets: AssetLibrary;
  quality: QualityProfile;
  state: GameState;
  hints: HintDirector;
  audio: AudioEngine;
  picker: Picker;
  viewport: Viewport;
  /** Seconds since the app started. */
  time: number;
  /** Ask the shell to move on once the child chooses to. */
  advanceStage(): void;
}

export interface GameScene {
  readonly id: StageId;
  readonly root: THREE.Group;
  /** Ambient bed level for this location, 0..1. */
  readonly ambience: number;
  build(ctx: GameContext): void;
  enter(ctx: GameContext): void;
  exit(ctx: GameContext): void;
  update(dt: number, ctx: GameContext): void;
  onPointerDown(p: Pointer, ctx: GameContext): void;
  onPointerMove(p: Pointer, ctx: GameContext): void;
  onPointerUp(p: Pointer, ctx: GameContext): void;
  onPointerCancel(p: Pointer, ctx: GameContext): void;
  onLongPress(p: Pointer, ctx: GameContext): void;
  /** Called on quality change: scenes rebuild anything tier-dependent. */
  onQualityChange(ctx: GameContext): void;
  dispose(): void;
}

/** Common plumbing so each scene only writes what makes it different. */
export abstract class BaseScene implements GameScene {
  abstract readonly id: StageId;
  readonly root = new THREE.Group();
  ambience = 0.6;
  protected built = false;
  protected disposables: { dispose(): void }[] = [];

  protected track<T extends { dispose(): void }>(v: T): T {
    this.disposables.push(v);
    return v;
  }

  abstract build(ctx: GameContext): void;

  enter(_ctx: GameContext): void {
    this.root.visible = true;
  }

  exit(_ctx: GameContext): void {
    this.root.visible = false;
  }

  abstract update(dt: number, ctx: GameContext): void;

  onPointerDown(_p: Pointer, _ctx: GameContext): void {}
  onPointerMove(_p: Pointer, _ctx: GameContext): void {}
  onPointerUp(_p: Pointer, _ctx: GameContext): void {}
  onPointerCancel(p: Pointer, ctx: GameContext): void {
    // Default: a cancelled pointer behaves exactly like a lift, so nothing
    // is ever left held when the browser takes the pointer away.
    this.onPointerUp(p, ctx);
  }
  onLongPress(_p: Pointer, _ctx: GameContext): void {}
  onQualityChange(_ctx: GameContext): void {}

  dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* already disposed */
      }
    }
    this.disposables = [];
    this.root.clear();
    this.built = false;
  }
}

/** Soft blob shadow that keeps props visibly in contact with the surface. */
export class ContactShadow {
  readonly mesh: THREE.Mesh;
  private baseScale: number;
  private baseOpacity: number;

  constructor(texture: THREE.Texture, size: number, opacity = 0.55) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1d1608,
      alphaMap: texture,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 1;
    this.mesh.scale.setScalar(size);
    this.baseScale = size;
    this.baseOpacity = opacity;
  }

  /** Higher objects cast a larger, fainter shadow. */
  follow(x: number, z: number, height: number, groundY: number): void {
    const h = Math.max(0, height);
    const spread = 1 + h * 1.5;
    this.mesh.position.set(x, groundY + 0.0016, z);
    this.mesh.scale.setScalar(this.baseScale * spread);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity =
      this.baseOpacity / (1 + h * 3.2);
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export type { Viewport };
