import * as THREE from 'three';
import { clamp, easeInOut } from '../util/rng';

// Fixed chain of shots — no free camera. Portrait frames the horn on a
// diagonal from upper-left toward lower-center; landscape shows neck,
// forelegs and the pond middle together. During interaction the camera is
// nearly still, with a slight follow so cause and effect share one view.

export type ShotName = 'wide' | 'medium' | 'close' | 'play' | 'reveal' | 'free';

interface ShotDef {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

function shot(aspect: number, name: ShotName): ShotDef {
  const portrait = aspect < 1;
  switch (name) {
    case 'wide':
      return portrait
        ? { pos: new THREE.Vector3(-2.35, 1.9, 3.3), look: new THREE.Vector3(0.1, 0.3, -0.5), fov: 58 }
        : { pos: new THREE.Vector3(-2.7, 1.6, 2.9), look: new THREE.Vector3(0, 0.35, -0.55), fov: 50 };
    case 'medium':
      return portrait
        ? { pos: new THREE.Vector3(-1.25, 1.0, 1.55), look: new THREE.Vector3(0.05, 0.62, -1.55), fov: 52 }
        : { pos: new THREE.Vector3(-1.55, 0.92, 1.5), look: new THREE.Vector3(0.05, 0.6, -1.5), fov: 47 };
    case 'close':
      return portrait
        ? { pos: new THREE.Vector3(-0.62, 0.76, 0.66), look: new THREE.Vector3(0.16, 0.08, -0.7), fov: 54 }
        : { pos: new THREE.Vector3(-0.95, 0.72, 0.95), look: new THREE.Vector3(0.1, 0.22, -0.72), fov: 50 };
    case 'play':
      // after understanding lands, the camera breathes out just enough to
      // show every remaining filament while staying near the water
      return portrait
        ? { pos: new THREE.Vector3(-0.85, 1.05, 1.15), look: new THREE.Vector3(0.22, 0.02, -0.5), fov: 55 }
        : { pos: new THREE.Vector3(-1.15, 0.9, 1.25), look: new THREE.Vector3(0.15, 0.15, -0.55), fov: 50 };
    case 'reveal':
      return portrait
        ? { pos: new THREE.Vector3(-2.1, 1.55, 2.6), look: new THREE.Vector3(0, 0.1, 0.1), fov: 56 }
        : { pos: new THREE.Vector3(-2.35, 1.35, 2.35), look: new THREE.Vector3(0, 0.12, 0), fov: 50 };
    case 'free':
      return portrait
        ? { pos: new THREE.Vector3(-1.15, 1.15, 1.75), look: new THREE.Vector3(0.1, 0.1, -0.35), fov: 54 }
        : { pos: new THREE.Vector3(-1.45, 1.0, 1.65), look: new THREE.Vector3(0.05, 0.12, -0.4), fov: 48 };
  }
}

export class CameraDirector {
  current: ShotName = 'wide';
  private fromDef: ShotDef;
  private toDef: ShotDef;
  private t = 1;
  private dur = 1;
  private look = new THREE.Vector3();
  private followWeight = 0;
  private time = 0;

  constructor(private camera: THREE.PerspectiveCamera) {
    this.fromDef = shot(camera.aspect, 'wide');
    this.toDef = this.fromDef;
    camera.position.copy(this.fromDef.pos);
    this.look.copy(this.fromDef.look);
    camera.lookAt(this.look);
    camera.fov = this.fromDef.fov;
    camera.updateProjectionMatrix();
  }

  transitionTo(name: ShotName, duration: number, follow = 0) {
    this.fromDef = {
      pos: this.camera.position.clone(),
      look: this.look.clone(),
      fov: this.camera.fov,
    };
    this.toDef = shot(this.camera.aspect, name);
    this.current = name;
    this.t = 0;
    this.dur = Math.max(0.01, duration);
    this.followWeight = follow;
  }

  // re-frame after rotation/resize without a jarring jump
  refresh() {
    this.transitionTo(this.current, 0.5, this.followWeight);
  }

  update(dt: number, hornTip: THREE.Vector3 | null, interacting: boolean) {
    this.time += dt;
    if (this.t < 1) this.t = Math.min(1, this.t + dt / this.dur);
    const k = easeInOut(this.t);
    const pos = this.fromDef.pos.clone().lerp(this.toDef.pos, k);
    const look = this.fromDef.look.clone().lerp(this.toDef.look, k);
    const fov = this.fromDef.fov + (this.toDef.fov - this.fromDef.fov) * k;

    // slight follow of the horn tip while interacting — never a cut
    if (hornTip && this.followWeight > 0) {
      const w = this.followWeight * (interacting ? 1 : 0.4);
      look.x += (hornTip.x - this.toDef.look.x) * w * 0.35;
      look.z += (hornTip.z - this.toDef.look.z) * w * 0.25;
      look.y += clamp(hornTip.y - this.toDef.look.y, -0.3, 0.3) * w * 0.2;
      pos.x += (hornTip.x - this.toDef.look.x) * w * 0.12;
    }

    // barely-there breathing so the world feels alive, small enough not to stir motion sickness
    pos.y += Math.sin(this.time * 0.5) * 0.008;
    pos.x += Math.sin(this.time * 0.33) * 0.006;

    this.camera.position.lerp(pos, 1 - Math.exp(-10 * dt));
    this.look.lerp(look, 1 - Math.exp(-10 * dt));
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
    }
  }
}
