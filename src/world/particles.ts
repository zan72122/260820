import * as THREE from 'three';
import { softDot } from '../core/textures';
import { Rng } from '../core/util';

interface Particle {
  life: number;
  max: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

/**
 * One tiny pooled point sprite system per effect.
 *
 * Debris from a brush and haze from a polishing pad are deliberately sparse: a
 * cloud of dust would hide the very surface the player is reading.
 */
export class Puffs {
  readonly points: THREE.Points;
  private parts: Particle[] = [];
  private pos: THREE.Float32BufferAttribute;
  private alpha: THREE.Float32BufferAttribute;
  private rng: Rng;
  private cursor = 0;
  private gravity: number;

  constructor(count: number, color: string, size: number, gravity: number, seed = 3) {
    this.rng = new Rng(seed);
    this.gravity = gravity;
    const p = new Float32Array(count * 3);
    const a = new Float32Array(count);
    this.pos = new THREE.Float32BufferAttribute(p, 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.Float32BufferAttribute(a, 1);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aAlpha', this.alpha);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

    const mat = new THREE.PointsMaterial({
      map: softDot(color),
      size,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      opacity: 1,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute float aAlpha;\nvarying float vAlpha;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAlpha = aAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vAlpha;\nvoid main() {')
        .replace(
          '#include <opaque_fragment>',
          'diffuseColor.a *= vAlpha;\n#include <opaque_fragment>',
        );
    };

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'puffs';
    for (let i = 0; i < count; i++) {
      this.parts.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
      a[i] = 0;
      p[i * 3 + 1] = -9999;
    }
  }

  emit(at: THREE.Vector3, dir: THREE.Vector3, spread: number, count: number, life: number): void {
    for (let k = 0; k < count; k++) {
      const i = this.cursor++ % this.parts.length;
      const p = this.parts[i];
      p.life = life * this.rng.range(0.7, 1.15);
      p.max = p.life;
      p.vx = dir.x * this.rng.range(0.4, 1.2) + this.rng.range(-spread, spread);
      p.vy = dir.y * this.rng.range(0.4, 1.2) + this.rng.range(-spread, spread);
      p.vz = dir.z * this.rng.range(0.4, 1.2) + this.rng.range(-spread, spread);
      (this.pos.array as Float32Array)[i * 3] = at.x;
      (this.pos.array as Float32Array)[i * 3 + 1] = at.y;
      (this.pos.array as Float32Array)[i * 3 + 2] = at.z;
    }
  }

  update(dt: number): void {
    const pa = this.pos.array as Float32Array;
    const aa = this.alpha.array as Float32Array;
    let live = false;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.life <= 0) {
        if (aa[i] !== 0) {
          aa[i] = 0;
        }
        continue;
      }
      live = true;
      p.life -= dt;
      p.vy -= this.gravity * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vz *= 1 - 2.2 * dt;
      pa[i * 3] += p.vx * dt;
      pa[i * 3 + 1] += p.vy * dt;
      pa[i * 3 + 2] += p.vz * dt;
      const t = Math.max(0, p.life / p.max);
      aa[i] = t * t * 0.9;
      if (p.life <= 0) aa[i] = 0;
    }
    this.pos.needsUpdate = true;
    this.alpha.needsUpdate = true;
    this.points.visible = live;
  }
}
