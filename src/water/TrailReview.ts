import * as THREE from 'three';
import { clamp } from '../core/Rng';

/**
 * The single look back at the end of a run: the path the raft took, drawn once
 * as a thin line of water. No numbers, no scoreboard - just the shape of what
 * the child made happen.
 */
export class TrailReview {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicMaterial;
  private life = -1;
  private duration = 3.4;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: 0x9fe2f5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  show(points: THREE.Vector3[], duration = 3.4): void {
    this.clear();
    if (points.length < 4) return;
    const curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()));
    const geo = new THREE.TubeGeometry(curve, Math.min(220, points.length * 2), 0.055, 6, false);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 9;
    this.group.add(this.mesh);
    this.life = 0;
    this.duration = duration;
  }

  get active(): boolean {
    return this.life >= 0;
  }

  clear(): void {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    this.life = -1;
    this.material.opacity = 0;
  }

  update(dt: number): void {
    if (this.life < 0 || !this.mesh) return;
    this.life += dt;
    const t = clamp(this.life / this.duration, 0, 1);
    // Draws on, holds, fades: one pass only.
    const draw = clamp(t / 0.45, 0, 1);
    const fade = 1 - clamp((t - 0.7) / 0.3, 0, 1);
    this.material.opacity = 0.55 * fade;
    const geo = this.mesh.geometry as THREE.TubeGeometry;
    const total = geo.index ? geo.index.count : 0;
    if (total > 0) geo.setDrawRange(0, Math.floor(total * draw));
    if (t >= 1) this.clear();
  }
}
