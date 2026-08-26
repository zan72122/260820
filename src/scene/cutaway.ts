/**
 * 最初の一周期だけ現れる短い断面表示。
 * 竹筒を常時半透明にはせず、ここでだけ内部水位を見せる。
 */
import * as THREE from 'three';
import { bambooHalfGeometry } from './geom';
import type { GardenMaterials } from './materials';
import type { TubeState } from '../sim/state';
import { clamp, damp } from '../util/math';

export class Cutaway {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private tubeGroup = new THREE.Group();
  private water: THREE.Mesh;
  private waterPos: THREE.BufferAttribute;
  private zSeptum: number;
  private zMax: number;
  private rInner: number;
  private shown = 0;
  private span = 0.3;
  private done = false;
  private timer = 0;

  constructor(mats: GardenMaterials, length: number, rOuter: number, wall: number) {
    const s = length / 0.64;
    this.zSeptum = 0.02 * s;
    this.zMax = 0.33 * s - 0.115 * s;
    this.rInner = rOuter - wall;

    this.scene.background = null;
    const hemi = new THREE.HemisphereLight(0xcdd6d1, 0x4a4437, 1.0);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff0e0, 1.25);
    key.position.set(2.2, 3.4, 2.6);
    this.scene.add(key);

    const half = new THREE.Mesh(
      bambooHalfGeometry({
        zTail: -0.31 * s,
        zMouth: 0.33 * s,
        rOuter,
        wall,
        zSeptum: this.zSeptum,
        nodes: [-0.24 * s, -0.06 * s, 0.13 * s, 0.29 * s],
        cutDepth: 0.115 * s,
      }),
      mats.bambooA,
    );
    this.tubeGroup.add(half);

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(4 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.waterPos = geo.getAttribute('position') as THREE.BufferAttribute;
    this.water = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x7fa0a0, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    );
    this.water.position.x = 0.0015;
    this.tubeGroup.add(this.water);
    this.scene.add(this.tubeGroup);

    this.span = 0.46 * s;
    const span = this.span;
    this.camera = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.01, 4);
    this.camera.position.set(1.2, 0, 0.06 * s);
    this.camera.lookAt(0, 0, 0.06 * s);
  }

  /** 断面内の水の形。世界に対して水平な面を保つ。 */
  private shapeWater(t: TubeState): boolean {
    const area = (t.waterMass / 1000) / (2 * this.rInner); // 断面積 m^2
    if (area < 1e-6) return false;
    const k = -Math.tan(t.angle); // 口が上なら正
    const L = this.zMax - this.zSeptum;
    const r = this.rInner;
    let z0 = this.zSeptum;
    let z1 = this.zMax;
    let d0: number;
    let d1: number;
    if (Math.abs(k) < 1e-3) {
      d0 = d1 = clamp(area / L, 0, 2 * r);
    } else if (k > 0) {
      // 節側が低い：くさび形
      let D = Math.sqrt(2 * k * area);
      if (D / k <= L) {
        z1 = this.zSeptum + D / k;
        d0 = D;
        d1 = 0;
      } else {
        D = (area + (k * L * L) / 2) / L;
        d0 = D;
        d1 = D - k * L;
      }
    } else {
      const kk = -k;
      let D = Math.sqrt(2 * kk * area);
      if (D / kk <= L) {
        z0 = this.zMax - D / kk;
        d0 = 0;
        d1 = D;
      } else {
        D = (area + (kk * L * L) / 2) / L;
        d1 = D;
        d0 = D - kk * L;
      }
    }
    d0 = clamp(d0, 0, 2 * r);
    d1 = clamp(d1, 0, 2 * r);
    const y = -r;
    this.waterPos.setXYZ(0, 0, y, z0);
    this.waterPos.setXYZ(1, 0, y, z1);
    this.waterPos.setXYZ(2, 0, y + d1, z1);
    this.waterPos.setXYZ(3, 0, y + d0, z0);
    this.waterPos.needsUpdate = true;
    return true;
  }

  update(t: TubeState, dt: number, allowed: boolean): void {
    const want = allowed && !this.done && t.waterMass > 0.02 && t.angle < 0.22;
    if (want) this.timer += dt;
    if (this.timer > 7.5 || t.cycleCount > 0) this.done = true;
    this.shown = damp(this.shown, want ? 1 : 0, 0.18, dt);
    this.tubeGroup.rotation.x = t.angle;
    this.water.visible = this.shapeWater(t);
  }

  setAspect(a: number): void {
    const h = this.span / 2;
    this.camera.left = -h * a;
    this.camera.right = h * a;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  get opacity(): number {
    return this.shown;
  }

  get active(): boolean {
    return this.shown > 0.02;
  }
}
