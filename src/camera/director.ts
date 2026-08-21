import * as THREE from 'three';

export type Vec3Src = THREE.Vector3 | (() => THREE.Vector3);

export interface Shot {
  name: string;
  pos: Vec3Src;
  look: Vec3Src;
  /** extra dolly-back applied in portrait, where the frame is tall and narrow */
  portraitBack?: number;
  portraitLift?: number;
  /** 0 = locked off, 1 = full handheld drift */
  life?: number;
  fov?: number;
}

const resolve = (v: Vec3Src, out: THREE.Vector3) => (typeof v === 'function' ? out.copy(v()) : out.copy(v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * The camera is authored, not free: a chain of shots that always keeps the thing
 * being touched and the thing that reacts inside the same frame.
 */
export class Director {
  private fromPos = new THREE.Vector3();
  private fromLook = new THREE.Vector3();
  private curPos = new THREE.Vector3();
  private curLook = new THREE.Vector3();
  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();
  private t = 1;
  private dur = 1;
  private shot: Shot | null = null;
  private time = 0;
  private portrait = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  setPortrait(p: boolean) {
    this.portrait = p;
  }

  get current(): Shot | null {
    return this.shot;
  }

  cut(shot: Shot, duration = 1.6) {
    if (this.shot?.name === shot.name) {
      this.shot = shot;
      return;
    }
    this.fromPos.copy(this.curPos);
    this.fromLook.copy(this.curLook);
    this.shot = shot;
    this.dur = Math.max(0.001, duration);
    this.t = 0;
  }

  /** Jump with no travel — used only for the very first frame. */
  snap(shot: Shot) {
    this.shot = shot;
    resolve(shot.pos, this.curPos);
    resolve(shot.look, this.curLook);
    this.fromPos.copy(this.curPos);
    this.fromLook.copy(this.curLook);
    this.t = 1;
  }

  get travelling() {
    return this.t < 1;
  }

  update(dt: number) {
    this.time += dt;
    if (!this.shot) return;
    resolve(this.shot.pos, this.tmpPos);
    resolve(this.shot.look, this.tmpLook);

    if (this.portrait) {
      const back = this.shot.portraitBack ?? 0;
      const lift = this.shot.portraitLift ?? 0;
      if (back !== 0 || lift !== 0) {
        const dir = this.tmpPos.clone().sub(this.tmpLook).normalize();
        this.tmpPos.addScaledVector(dir, back);
        this.tmpPos.y += lift;
      }
    }

    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.dur);
      const e = easeInOut(this.t);
      this.curPos.lerpVectors(this.fromPos, this.tmpPos, e);
      this.curLook.lerpVectors(this.fromLook, this.tmpLook, e);
    } else {
      // stay glued to live targets, but softly so a moving subject never judders
      this.curPos.lerp(this.tmpPos, 1 - Math.pow(0.001, dt));
      this.curLook.lerp(this.tmpLook, 1 - Math.pow(0.0006, dt));
    }

    const life = this.shot.life ?? 1;
    const bx = Math.sin(this.time * 0.37) * 0.035 + Math.sin(this.time * 0.91) * 0.014;
    const by = Math.cos(this.time * 0.29) * 0.03 + Math.sin(this.time * 1.13) * 0.011;
    this.camera.position.set(this.curPos.x + bx * life, this.curPos.y + by * life, this.curPos.z);
    this.camera.lookAt(this.curLook);
  }
}
