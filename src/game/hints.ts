import * as THREE from 'three';
import { clamp01, smoothstep } from '../core/math';
import { radialAlpha } from '../core/textures';
import type { Worker } from '../world/environment';

/**
 * Wordless prompting, escalating only if the player has genuinely stalled.
 *
 *   3 s — the thing that wants moving stirs slightly under its own weight
 *   6 s — the worker looks from that thing to where it belongs, and back
 *   9 s — a short trail of motes traces the move, once, then waits
 *
 * Nothing is ever written on screen, no arrow is drawn, and nothing outlines
 * or highlights an object. Any touch at all resets the whole ladder.
 */
export class HintDirector {
  readonly group = new THREE.Group();
  private motes: THREE.Mesh[] = [];
  private idle = 0;
  private traceTime = -1;
  private lookPhase = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private armed = false;
  private alphaTex: THREE.Texture;
  private material: THREE.MeshBasicMaterial;
  private geometry: THREE.PlaneGeometry;

  /** 0..1 nudge applied to whatever the player should be moving. */
  stir = 0;

  /** The move currently being prompted, in world space. */
  get fromPoint(): THREE.Vector3 {
    return this.from;
  }

  get toPoint(): THREE.Vector3 {
    return this.to;
  }

  constructor() {
    this.alphaTex = radialAlpha(32, 1.5);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xf2e4cf,
      transparent: true,
      opacity: 0,
      alphaMap: this.alphaTex,
      depthTest: false,
      depthWrite: false,
    });
    this.geometry = new THREE.PlaneGeometry(0.024, 0.024);
    for (let i = 0; i < 7; i++) {
      const mote = new THREE.Mesh(this.geometry, this.material.clone());
      mote.renderOrder = 20;
      mote.visible = false;
      this.motes.push(mote);
      this.group.add(mote);
    }
  }

  /** Point the ladder at a move: from one world point to another. */
  arm(from: THREE.Vector3, to: THREE.Vector3): void {
    this.from.copy(from);
    this.to.copy(to);
    this.armed = true;
  }

  disarm(): void {
    this.armed = false;
    this.idle = 0;
    this.traceTime = -1;
    this.stir = 0;
    for (const m of this.motes) m.visible = false;
  }

  /** Any deliberate touch clears the ladder and starts it over. */
  notifyActivity(): void {
    this.idle = 0;
    this.traceTime = -1;
    this.stir = 0;
    for (const m of this.motes) m.visible = false;
  }

  get idleTime(): number {
    return this.idle;
  }

  update(dt: number, camera: THREE.Camera, worker: Worker | null): void {
    if (!this.armed) return;
    this.idle += dt;

    // 3 s: a small stir, as if the piece were hanging and shifting.
    this.stir = this.idle >= 3 ? Math.sin(this.idle * 2.6) * smoothstep((this.idle - 3) / 1.2) : 0;

    // 6 s: the worker's attention moves between the two points.
    if (worker) {
      if (this.idle >= 6) {
        this.lookPhase += dt;
        const swap = Math.floor(this.lookPhase / 1.6) % 2 === 0;
        worker.lookAt(swap ? this.from : this.to);
      } else {
        this.lookPhase = 0;
      }
    }

    // 9 s: a single trace of the move, repeated on a slow cycle.
    if (this.idle >= 9) {
      if (this.traceTime < 0) this.traceTime = 0;
      this.traceTime += dt;
      const cycle = 3.4;
      const phase = (this.traceTime % cycle) / cycle;
      const lift = this.from.distanceTo(this.to) * 0.34 + 0.05;
      for (let i = 0; i < this.motes.length; i++) {
        const mote = this.motes[i]!;
        const t = phase * 1.5 - i * 0.055;
        if (t < 0 || t > 1) {
          mote.visible = false;
          continue;
        }
        mote.visible = true;
        mote.position.lerpVectors(this.from, this.to, t);
        // A carried object swings along an arc, not a straight line.
        mote.position.y += Math.sin(t * Math.PI) * lift;
        mote.quaternion.copy(camera.quaternion);
        const fade = Math.sin(t * Math.PI);
        (mote.material as THREE.MeshBasicMaterial).opacity = clamp01(fade * 0.55);
        mote.scale.setScalar(0.7 + fade * 0.6);
      }
    } else {
      for (const m of this.motes) m.visible = false;
    }
  }

  dispose(): void {
    for (const m of this.motes) (m.material as THREE.Material).dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.alphaTex.dispose();
    this.group.removeFromParent();
  }
}
