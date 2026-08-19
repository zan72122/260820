import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConeMesh } from './ConeMesh';
import { PetalGeometry } from './PetalGeometry';
import { PetalShaper, type TrailSample } from './PetalShaper';
import { LAYERS, MIN_PETALS_FOR_FLOWER } from './flowerParams';
import { Config } from '../engine/config';
import { makeCreamMaterial } from '../scene/materials';
import { Rng, damp } from '../util/math';

/**
 * One buttercream flower: the cone, every petal made for it, and the bookkeeping
 * that decides which layer the next petal belongs to.
 */
export class Flower {
  readonly group = new THREE.Group();
  readonly cone: ConeMesh;
  readonly material: THREE.MeshPhysicalMaterial;
  layerIndex = 0;
  petalsInLayer = 0;
  totalPetals = 0;

  private live: PetalGeometry;
  private liveMesh: THREE.Mesh;
  private shaper: PetalShaper;
  private pending: THREE.BufferGeometry[] = [];
  private pendingMeshes: THREE.Mesh[] = [];
  private merged: THREE.Mesh[] = [];
  private rng: Rng;
  private wobbleVel = new THREE.Vector2();
  private wobbleRot = new THREE.Vector2();

  constructor(color: number, seed: number, streak: THREE.Texture) {
    this.material = makeCreamMaterial(color, { streak });
    this.rng = new Rng(seed);
    this.cone = new ConeMesh(this.material, Config.fast);
    this.group.add(this.cone.mesh);
    const nu = Config.fast ? 20 : 30;
    const nv = Config.fast ? 7 : 12;
    this.live = new PetalGeometry(nu, nv);
    this.shaper = new PetalShaper(nu);
    this.liveMesh = new THREE.Mesh(this.live.geometry, this.material);
    this.liveMesh.castShadow = !Config.fast;
    this.liveMesh.receiveShadow = !Config.fast;
    this.liveMesh.visible = false;
    this.liveMesh.frustumCulled = false;
    this.group.add(this.liveMesh);
  }

  get layer() {
    return LAYERS[Math.min(this.layerIndex, LAYERS.length - 1)];
  }

  get coneHeight() {
    return this.cone.height;
  }

  growCone(dh: number) {
    this.cone.setHeight(this.cone.height + dh);
  }

  beginPetal() {
    this.liveMesh.visible = true;
  }

  /** Rebuild the petal under the finger; called every frame while pressing. */
  updatePetal(samples: TrailSample[], finished: boolean) {
    if (!samples.length) return;
    const seed = 1000 + this.totalPetals * 37 + Math.floor(this.rng.next() * 0);
    const spec = this.shaper.build(
      samples,
      this.layer,
      this.cone.height,
      seed + this.petalSeedOffset,
      finished,
      this.petalsInLayer,
    );
    this.live.update(spec);
  }

  private petalSeedOffset = Math.floor(Math.random() * 1000);

  /** Freeze the petal: bake it into a static mesh and advance the layer. */
  endPetal(): { layerCompleted: boolean } {
    const geo = this.live.bake();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = !Config.fast;
    mesh.receiveShadow = !Config.fast;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.pending.push(geo);
    this.pendingMeshes.push(mesh);
    this.liveMesh.visible = false;
    this.petalsInLayer++;
    this.totalPetals++;

    let layerCompleted = false;
    if (this.petalsInLayer >= this.layer.target && this.layerIndex < LAYERS.length - 1) {
      this.mergeLayer();
      this.layerIndex++;
      this.petalsInLayer = 0;
      layerCompleted = true;
    } else if (this.pending.length >= 7) {
      this.mergeLayer();
    }
    return { layerCompleted };
  }

  /** Collapse the finished petals into a single draw call. */
  mergeLayer() {
    if (this.pending.length < 2) return;
    const merged = mergeGeometries(this.pending, false);
    if (!merged) return;
    for (const m of this.pendingMeshes) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.pending.length = 0;
    this.pendingMeshes.length = 0;
    const mesh = new THREE.Mesh(merged, this.material);
    mesh.castShadow = !Config.fast;
    mesh.receiveShadow = !Config.fast;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.merged.push(mesh);
  }

  get looksFinished() {
    return this.totalPetals >= MIN_PETALS_FOR_FLOWER;
  }

  get drawCalls() {
    return this.merged.length + this.pendingMeshes.length + 1;
  }

  /** Petals settle with a small damped sway once the flower is set down. */
  nudge(strength = 1) {
    this.wobbleVel.set((Math.random() - 0.5) * 6 * strength, (Math.random() - 0.5) * 6 * strength);
  }

  update(dt: number) {
    const k = 90;
    this.wobbleVel.x += -k * this.wobbleRot.x * dt;
    this.wobbleVel.y += -k * this.wobbleRot.y * dt;
    this.wobbleVel.multiplyScalar(Math.exp(-4.5 * dt));
    this.wobbleRot.x += this.wobbleVel.x * dt * 0.02;
    this.wobbleRot.y += this.wobbleVel.y * dt * 0.02;
    this.group.rotation.x = damp(this.group.rotation.x, this.wobbleRot.x, 20, dt);
    this.group.rotation.z = damp(this.group.rotation.z, this.wobbleRot.y, 20, dt);
  }

  /** Approximate outer radius, used to seat the flower on the cake. */
  radius() {
    const l = LAYERS[Math.min(this.layerIndex, LAYERS.length - 1)];
    return l.radiusOffset + l.curl + 0.008;
  }
}
