import * as THREE from 'three';
import { Harvester, MACHINE } from '../world/Harvester';

export type ShotName = 'establish' | 'work' | 'heroPull' | 'conveyor' | 'crateDrop' | 'rowEnd';

interface Framing {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** radius of the subject sphere, used to re-frame on tall screens */
  radius: number;
}

const SPECIALS: ShotName[] = ['heroPull', 'conveyor', 'crateDrop'];

/**
 * The player never controls the camera. This picks the shot that explains
 * what the machine is doing right now, in the order a film would cut it:
 * wide -> working view -> the pull, close -> inside the machine -> the crate.
 */
export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;
  shot: ShotName = 'establish';
  shotTime = 0;
  shotDuration = 2.6;
  /** how strongly time is slowed for the current shot */
  timeScale = 1;

  private pos = new THREE.Vector3(4, 3, -4);
  private target = new THREE.Vector3(0, 0.6, 0);
  private fov = 46;
  private focus = new THREE.Vector3();
  private aim = new THREE.Vector3();
  private cooldown = 0;
  private shakeT = 0;
  private shakeAmp = 0;
  private aspect = 1;

  constructor(private harvester: Harvester) {
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.06, 460);
    this.camera.position.copy(this.pos);
  }

  setAspect(aspect: number) {
    this.aspect = aspect;
    this.camera.aspect = aspect;
  }

  /**
   * Distance needed to keep a subject `halfH` tall and `halfW` wide in frame.
   * `halfW` is deliberately modest: on a tall phone the shot is allowed to crop
   * the sides rather than retreat until the machine is a dot.
   */
  private fit(halfH: number, halfW: number, fovDeg: number): number {
    const vHalf = THREE.MathUtils.degToRad(fovDeg) / 2;
    const tv = Math.tan(vHalf);
    const th = Math.max(0.05, tv * this.aspect);
    return Math.max(halfH / tv, halfW / th);
  }

  /** 0 in landscape, 1 on a tall phone. Shots re-stage themselves along this. */
  private get portrait(): number {
    return THREE.MathUtils.clamp((1.25 - this.aspect) / 0.75, 0, 1);
  }

  /** Fixed world anchor a shot is composed around. */
  setFocus(p: THREE.Vector3) {
    this.focus.copy(p);
  }

  /** Moving point the shot keeps in frame. */
  setAim(p: THREE.Vector3) {
    this.aim.copy(p);
  }

  isSpecial(): boolean {
    return SPECIALS.includes(this.shot);
  }

  canInterrupt(): boolean {
    return !this.isSpecial() && this.cooldown <= 0 && this.shot !== 'rowEnd' && this.shot !== 'establish';
  }

  play(shot: ShotName, duration: number, cut = true) {
    this.shot = shot;
    this.shotTime = 0;
    this.shotDuration = duration;
    if (cut) this.snapNextFrame = true;
  }

  private snapNextFrame = false;

  shake(amount: number) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = 0;
  }

  /** dt here is REAL time; shots run on the wall clock even in slow motion. */
  update(dt: number) {
    this.shotTime += dt;
    if (this.cooldown > 0) this.cooldown -= dt;

    const f = this.frame();
    const stiff = this.snapNextFrame ? 1 : 1 - Math.pow(this.shot === 'establish' ? 0.02 : 0.0009, dt);
    this.pos.lerp(f.pos, stiff);
    this.target.lerp(f.target, this.snapNextFrame ? 1 : 1 - Math.pow(0.0006, dt));
    this.fov = THREE.MathUtils.lerp(this.fov, f.fov, this.snapNextFrame ? 1 : 1 - Math.pow(0.02, dt));
    this.snapNextFrame = false;

    // a whisper of handheld so the frame is never dead, well under any nausea threshold
    this.shakeT += dt;
    this.shakeAmp *= Math.pow(0.02, dt);
    const t = performance.now() / 1000;
    const nx = Math.sin(t * 1.7) * 0.0035 + Math.sin(t * 11.3) * this.shakeAmp;
    const ny = Math.cos(t * 1.31) * 0.003 + Math.cos(t * 13.7) * this.shakeAmp;

    this.camera.position.set(this.pos.x + nx, this.pos.y + ny, this.pos.z);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.target);

    // slow motion belongs to the pull close-up only
    const want = this.shot === 'heroPull' ? 0.42 : 1;
    this.timeScale += (want - this.timeScale) * (1 - Math.pow(0.0008, dt));
  }

  finished(): boolean {
    return this.shotTime >= this.shotDuration;
  }

  endSpecial(cooldown = 1.5) {
    this.cooldown = cooldown;
  }

  /* --------------------------------------------------------------- */

  /** Blend two authored camera offsets by screen shape, then push out to fit. */
  private stage(
    dirLandscape: THREE.Vector3,
    dirPortrait: THREE.Vector3,
    target: THREE.Vector3,
    fov: number,
    halfH: number,
    halfW: number,
  ): Framing {
    const p = this.portrait;
    const dir = dirLandscape.clone().lerp(dirPortrait, p);
    const base = dir.length();
    const d = Math.max(base, this.fit(halfH, halfW, fov));
    dir.normalize().multiplyScalar(d);
    return { pos: target.clone().add(dir), target, fov, radius: halfH };
  }

  private frame(): Framing {
    const H = this.harvester;
    const m = H.root.position;
    const k = Math.min(1, this.shotTime / Math.max(0.001, this.shotDuration));
    const local = (x: number, y: number, z: number) => H.root.localToWorld(new THREE.Vector3(x, y, z));

    switch (this.shot) {
      case 'establish': {
        // three-quarter wide: the field, the ridges and the machine on its row
        const push = THREE.MathUtils.lerp(1.3, 1.0, k * k);
        return this.stage(
          new THREE.Vector3(2.95, 2.5, -3.05).multiplyScalar(push),
          new THREE.Vector3(1.85, 2.9, -3.5).multiplyScalar(push),
          new THREE.Vector3(m.x, 0.8, m.z + 1.0),
          47,
          2.1,
          2.0,
        );
      }

      case 'work': {
        // home base: mouth, conveyor and crate all legible at once
        return this.stage(
          new THREE.Vector3(2.28, 1.12, -2.15),
          new THREE.Vector3(1.32, 1.5, -2.95),
          new THREE.Vector3(m.x, 0.62, m.z + 0.5),
          46,
          1.1,
          0.92,
        );
      }

      case 'heroPull': {
        // locked off beside the plant: the mouth comes in and the root rises
        // just under the belt line: the rubber reads as an edge above the plant
        // rather than a slab across it, and the ridge still shows its shape
        const rise = THREE.MathUtils.lerp(0.3, 0.42, k * k);
        const target = new THREE.Vector3(
          this.focus.x,
          THREE.MathUtils.lerp(this.focus.y + 0.1, this.aim.y + 0.04, 0.55),
          this.focus.z + 0.02,
        );
        return this.stage(
          new THREE.Vector3(0.9, rise, 0.56).normalize().multiplyScalar(1.24),
          new THREE.Vector3(0.84, rise + 0.06, 0.66).normalize().multiplyScalar(1.42),
          target,
          36,
          0.32,
          0.22,
        );
      }

      case 'conveyor': {
        // tops pinched in the belt, white roots swinging underneath
        const t = local(0, 0.55, 0.74);
        return this.stage(
          local(1.3, 0.74, 0.66 - k * 0.1).sub(t),
          local(1.12, 0.92, 0.86 - k * 0.1).sub(t),
          t,
          39,
          0.5,
          0.4,
        );
      }

      case 'crateDrop': {
        // level with the crate: roots roll off the belt straight into shot
        const t = local(0, 0.5, -1.05);
        return this.stage(
          local(1.2, 0.78, -0.78 - k * 0.08).sub(t),
          local(1.0, 0.92, -0.5 - k * 0.08).sub(t),
          t,
          41,
          0.45,
          0.42,
        );
      }

      case 'rowEnd': {
        // slow arc around the full crate
        const ang = -0.5 + k * 1.05;
        const t = local(0, MACHINE.crateCentre.y + 0.2, MACHINE.crateCentre.z);
        const fov = 42;
        const d = Math.max(1.95, this.fit(0.6, 0.52, fov));
        const pos = new THREE.Vector3(
          t.x + Math.sin(ang) * d * 0.8 + 0.5,
          t.y + 0.7 + Math.sin(k * Math.PI) * 0.12,
          t.z - Math.cos(ang) * d * 0.8,
        );
        return { pos, target: t, fov, radius: 0.52 };
      }
    }
  }
}
