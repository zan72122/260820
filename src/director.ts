// Camera chain. No free camera: each phase owns one composed shot,
// with portrait and landscape variants. Cause → effect (cloud → horn →
// rain → ground) must stay readable in a single frame.

import * as THREE from 'three';
import { damp, clamp } from './util';

export type Shot =
  | 'wide' | 'knot' | 'approach' | 'closeup' | 'play' | 'finale';

interface ShotDef {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

const LAND: Record<Shot, ShotDef> = {
  wide: { pos: new THREE.Vector3(7, 6.5, 14), look: new THREE.Vector3(-2, 10.5, -24), fov: 55 },
  knot: { pos: new THREE.Vector3(9, 14.6, 3), look: new THREE.Vector3(0, 15.8, -23.2), fov: 40 },
  approach: { pos: new THREE.Vector3(17, 10, -10), look: new THREE.Vector3(5, 12.5, -22), fov: 48 },
  closeup: { pos: new THREE.Vector3(9.5, 13.6, -3), look: new THREE.Vector3(-0.5, 15.2, -23.2), fov: 44 },
  play: { pos: new THREE.Vector3(10.5, 13.2, 0), look: new THREE.Vector3(-0.5, 14.4, -23.2), fov: 48 },
  finale: { pos: new THREE.Vector3(2, 10, 20), look: new THREE.Vector3(-2, 7.5, -20), fov: 54 },
};

const PORT: Record<Shot, ShotDef> = {
  wide: { pos: new THREE.Vector3(4, 6, 20), look: new THREE.Vector3(0, 11, -24), fov: 68 },
  knot: { pos: new THREE.Vector3(6, 13.8, 5), look: new THREE.Vector3(0, 15.6, -23.2), fov: 52 },
  approach: { pos: new THREE.Vector3(14, 10, -8), look: new THREE.Vector3(5, 12.5, -22), fov: 58 },
  closeup: { pos: new THREE.Vector3(5.5, 13.0, -1), look: new THREE.Vector3(1.2, 15.0, -23.2), fov: 56 },
  play: { pos: new THREE.Vector3(6, 12.6, 1), look: new THREE.Vector3(1.2, 14.0, -23.2), fov: 60 },
  finale: { pos: new THREE.Vector3(1, 10, 24), look: new THREE.Vector3(-2, 8.5, -20), fov: 66 },
};

const SCRATCH_LOOK = new THREE.Vector3();
const SCRATCH_PROJ = new THREE.Vector3();

export class Director {
  camera: THREE.PerspectiveCamera;
  shot: Shot = 'wide';
  /** 0..1 how much the view dips to follow the first falling drops */
  dropFollow = 0;
  dropFocus = new THREE.Vector3();
  private curPos = new THREE.Vector3().copy(LAND.wide.pos);
  private curLook = new THREE.Vector3().copy(LAND.wide.look);
  private curFov = 50;
  private t = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 600);
    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);
  }

  setShot(s: Shot) {
    this.shot = s;
  }

  update(dt: number, aspect: number) {
    this.t += dt;
    const portrait = aspect < 1;
    const def = (portrait ? PORT : LAND)[this.shot];
    const lam = 1.6; // slow cinematic ease
    this.curPos.x = damp(this.curPos.x, def.pos.x, lam, dt);
    this.curPos.y = damp(this.curPos.y, def.pos.y, lam, dt);
    this.curPos.z = damp(this.curPos.z, def.pos.z, lam, dt);

    // gentle look-down that rides the first drops (no cut)
    const look = SCRATCH_LOOK.copy(def.look);
    if (this.dropFollow > 0.01) {
      look.lerp(this.dropFocus, this.dropFollow * 0.55);
    }
    this.curLook.x = damp(this.curLook.x, look.x, lam * 1.4, dt);
    this.curLook.y = damp(this.curLook.y, look.y, lam * 1.4, dt);
    this.curLook.z = damp(this.curLook.z, look.z, lam * 1.4, dt);
    this.curFov = damp(this.curFov, def.fov, lam, dt);

    // subtle breathing in establishing shots only
    const breathe = this.shot === 'wide' || this.shot === 'knot' || this.shot === 'finale' ? 1 : 0.25;
    const bx = Math.sin(this.t * 0.31) * 0.06 * breathe;
    const by = Math.sin(this.t * 0.23 + 1.7) * 0.05 * breathe;

    this.camera.fov = this.curFov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(this.curPos.x + bx, this.curPos.y + by, this.curPos.z);
    this.camera.lookAt(this.curLook);
  }

  /** project a world point to css pixels */
  toScreen(world: THREE.Vector3, w: number, h: number, out: { x: number; y: number }) {
    const v = SCRATCH_PROJ.copy(world).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * w;
    out.y = (-v.y * 0.5 + 0.5) * h;
    return out;
  }
}
