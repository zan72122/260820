import * as THREE from 'three';

export type ShotName =
  | 'establish'
  | 'lever'
  | 'bladeEntry'
  | 'follow'
  | 'conveyor'
  | 'flip'
  | 'reveal'
  | 'survey';

export interface Anchors {
  machine: THREE.Vector3;
  blade: THREE.Vector3;
  conveyor: THREE.Vector3;
  plant: THREE.Vector3;
  rowZ: number;
  flipT: number; // 0..1 drives the half orbit
}

const tmp = new THREE.Vector3();

/**
 * A fixed chain of shots. The player never gets the camera; instead the camera
 * is always where the causal chain is readable, and it only ever glides
 * between shots so a cause and its effect are never split by a cut.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  private pos = new THREE.Vector3(-5, 3, 6);
  private look = new THREE.Vector3(0, 0.6, 0);
  private shot: ShotName = 'establish';
  private blend = 1.1;
  private aspect = 1;

  constructor() {
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  setShot(shot: ShotName, blend = 1.1) {
    if (this.shot === shot) return;
    this.shot = shot;
    this.blend = blend;
  }

  get current() {
    return this.shot;
  }

  /** Snap on the very first frame so we do not fly in from nowhere. */
  prime(a: Anchors) {
    const d = this.desired(a);
    this.pos.copy(d.pos);
    this.look.copy(d.look);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  private desired(a: Anchors): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const m = a.machine;
    const z = a.rowZ;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    switch (this.shot) {
      case 'establish':
        // Looking forward along the row from behind the implement: shares and
        // ridge near, tractor rear and lever in the middle, the uncut field
        // and the windbreak behind. One frame, the whole relationship.
        pos.set(m.x - 5.4, 2.35, z + 0.24);
        look.set(m.x + 1.5, 0.95, z);
        break;
      case 'lever':
        // push in slightly: lever, lift cylinder and shares stay stacked in
        // the same frame, so cause and effect cannot be separated
        pos.set(m.x - 4.2, 2.3, z + 0.3);
        look.set(m.x + 2.3, 1.32, z);
        break;
      case 'bladeEntry':
        // low and side on, ahead of the depth wheel: steel meeting soil, with
        // the crust splitting just in front of it
        pos.copy(a.blade).add(new THREE.Vector3(1.25, 0.45, 1.35));
        look.copy(a.blade).add(new THREE.Vector3(0.3, 0.05, 0.2));
        break;
      case 'follow':
        pos.set(m.x - 4.4, 1.85, z + 0.35);
        look.set(m.x + 0.7, 0.5, z);
        break;
      case 'conveyor':
        // high enough to see over the side channel and down into the chain,
        // where the soil is actually coming off
        pos.copy(a.conveyor).add(new THREE.Vector3(0.8, 1.05, 2.15));
        look.copy(a.conveyor).add(new THREE.Vector3(-0.55, -0.18, 0));
        break;
      case 'flip': {
        // Half orbit around the plant as it turns over, kept entirely behind
        // the machine so nothing crosses in front of the moment.
        const a0 = Math.PI * 1.35;
        const a1 = Math.PI * 0.73;
        const ang = a0 + (a1 - a0) * a.flipT;
        const rad = 2.3 - 1.4 * a.flipT;
        pos.set(
          a.plant.x + Math.cos(ang) * rad,
          Math.max(0.3, a.plant.y + 0.8 - 0.4 * a.flipT),
          a.plant.z + Math.sin(ang) * rad
        );
        look.copy(a.plant).add(new THREE.Vector3(0, 0.02 + 0.05 * a.flipT, 0));
        break;
      }
      case 'reveal':
        // continues exactly where the orbit ended: pods filling the frame,
        // the machine still visible beyond them
        pos.copy(a.plant).add(new THREE.Vector3(-0.6, 0.34, 0.65));
        look.copy(a.plant).add(new THREE.Vector3(0, 0.03, 0));
        break;
      case 'survey':
        // back off over the finished windrow, with the next ridge upstage
        pos.set(m.x - 5.9, 2.1, z + 1.35);
        look.set(m.x - 1.8, 0.28, z + 0.05);
        break;
    }
    return { pos, look };
  }

  /**
   * Portrait phones put the thumb over the bottom third, so the subject is
   * pushed up the frame and the camera pulls back a little.
   */
  private frameForAspect(pos: THREE.Vector3, look: THREE.Vector3) {
    if (this.aspect >= 1) {
      this.camera.fov = 45;
      return;
    }
    const portrait = Math.min(1, (1 - this.aspect) / 0.55);
    this.camera.fov = 45 + portrait * 9;
    const back = tmp.copy(pos).sub(look).multiplyScalar(0.16 * portrait);
    pos.add(back);
    // aim below the subject so it sits in the upper half, clear of the hand
    look.y -= 0.3 * portrait;
    pos.y += 0.18 * portrait;
  }

  update(dt: number, aspect: number, a: Anchors) {
    this.aspect = aspect;
    const d = this.desired(a);
    this.frameForAspect(d.pos, d.look);
    const k = 1 - Math.exp(-this.blend * 2.6 * dt);
    this.pos.lerp(d.pos, k);
    this.look.lerp(d.look, k);
    // never let the camera sink into the field
    this.pos.y = Math.max(this.pos.y, 0.28);
    this.camera.aspect = aspect;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
  }

  /** Screen position (CSS pixels) of a world point, for touch hot spots. */
  project(world: THREE.Vector3, w: number, h: number, out: THREE.Vector2): THREE.Vector2 {
    tmp.copy(world).project(this.camera);
    out.set(((tmp.x + 1) / 2) * w, ((1 - tmp.y) / 2) * h);
    return out;
  }
}
