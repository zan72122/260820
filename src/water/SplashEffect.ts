import * as THREE from 'three';
import { clamp } from '../core/Rng';
import { splashSheet } from '../world/Textures';
import { FoamField } from './FoamField';

interface Ripple {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

/**
 * Landing splash: a flipbook burst at the impact, expanding surface rings,
 * and real droplets thrown clear. It reads as an arrival, not as a screen
 * full of spray.
 */
export class SplashEffect {
  readonly group = new THREE.Group();
  private readonly burst: THREE.Mesh;
  private readonly burstMat: THREE.MeshBasicMaterial;
  private readonly ripples: Ripple[] = [];
  private burstLife = 0;
  private burstDuration = 1.0;
  private readonly frames = 4;

  constructor(private readonly foam: FoamField, rippleCount = 3) {
    const tex = splashSheet().clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / this.frames, 1 / this.frames);
    this.burstMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.burst = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.burstMat);
    this.burst.visible = false;
    this.burst.renderOrder = 8;
    this.group.add(this.burst);

    const ringGeo = new THREE.RingGeometry(0.55, 0.72, 40, 1);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < rippleCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.ripples.push({ mesh, life: 0, maxLife: 1.6 });
    }
  }

  /** @param strength roughly the arrival speed in m/s */
  trigger(at: THREE.Vector3, strength: number, waterLevel: number): void {
    const s = clamp(strength / 9, 0.35, 1.4);
    this.burst.position.copy(at).setY(waterLevel + 0.35 * s);
    this.burst.scale.setScalar(3.4 * s + 1.6);
    this.burst.visible = true;
    this.burstLife = 0;
    this.burstDuration = 0.85 + s * 0.25;
    this.burstMat.opacity = 1;

    this.ripples.forEach((r, i) => {
      r.mesh.position.copy(at).setY(waterLevel + 0.02 + i * 0.004);
      r.mesh.scale.setScalar(0.5);
      r.mesh.visible = true;
      r.life = -i * 0.16;
      r.maxLife = 1.5 + i * 0.35;
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
    });

    this.foam.emitFoam(at.clone().setY(waterLevel + 0.2), 46 * s, 0.6, 1.7);
    this.foam.emitDrops(at.clone().setY(waterLevel + 0.25), 22 * s, 2.6 * s);
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.burst.visible) {
      this.burstLife += dt;
      const t = clamp(this.burstLife / this.burstDuration, 0, 1);
      const frame = Math.min(this.frames * this.frames - 1, Math.floor(t * this.frames * this.frames));
      const map = this.burstMat.map;
      if (map) {
        map.offset.set(
          (frame % this.frames) / this.frames,
          1 - 1 / this.frames - Math.floor(frame / this.frames) / this.frames,
        );
      }
      this.burstMat.opacity = 1 - t * t;
      // Billboard, but only around Y: the splash keeps its footing on the water.
      const dir = camera.position.clone().sub(this.burst.position);
      this.burst.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
      if (t >= 1) this.burst.visible = false;
    }

    for (const r of this.ripples) {
      if (!r.mesh.visible) continue;
      r.life += dt;
      if (r.life < 0) continue;
      const t = clamp(r.life / r.maxLife, 0, 1);
      r.mesh.scale.setScalar(0.5 + t * 3.6);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.4;
      if (t >= 1) r.mesh.visible = false;
    }
  }
}
