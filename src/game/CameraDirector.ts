import * as THREE from 'three';

export interface Shot {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** overrides applied in portrait orientation */
  portrait?: Partial<{ pos: THREE.Vector3; target: THREE.Vector3; fov: number }>;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Named shots covering the camera chain:
 * room → cabinet → half-inserted key → oblique keyway → orbit onto the
 * sectioned side → pin macro → cam & bolt → cabinet wide → reveal.
 * The exterior-to-section transition is a real orbit around the model —
 * the section is machined into the piece, nothing fades.
 */
export const SHOTS: Record<string, Shot> = {
  roomWide: {
    pos: V(1.9, 1.6, 3.0),
    target: V(-0.1, 1.0, -0.4),
    fov: 46,
    portrait: { fov: 58 },
  },
  cabinet: {
    pos: V(0.7, 1.3, 1.75),
    target: V(0, 0.92, -0.1),
    fov: 40,
    portrait: { fov: 52 },
  },
  keyClose: {
    pos: V(-0.28, 1.1, 0.85),
    target: V(0.3, 1.0, 0.22),
    fov: 34,
    portrait: { fov: 44 },
  },
  oblique: {
    pos: V(0.02, 1.14, 0.6),
    target: V(0.3, 1.0, 0.15),
    fov: 32,
    portrait: { fov: 42 },
  },
  orbitMid: {
    pos: V(0.45, 1.2, 0.62),
    target: V(0.3, 1.02, 0.1),
    fov: 30,
    portrait: { fov: 40 },
  },
  macro: {
    pos: V(0.85, 1.07, 0.42),
    target: V(0.3, 1.025, 0.1),
    fov: 30,
    portrait: {
      pos: V(0.74, 1.06, 0.38),
      target: V(0.3, 1.03, 0.095),
      fov: 46,
    },
  },
  macroFollow: {
    pos: V(0.72, 1.03, 0.44),
    target: V(0.3, 1.02, 0.1),
    fov: 28,
    portrait: {
      pos: V(0.62, 1.03, 0.36),
      fov: 40,
    },
  },
  caseShot: {
    pos: V(0.9, 1.06, 0.3),
    target: V(0.33, 0.97, 0.025),
    fov: 30,
    portrait: { fov: 42 },
  },
  boltShot: {
    pos: V(0.88, 1.04, 0.4),
    target: V(0.42, 0.975, 0.026),
    fov: 26,
    portrait: { fov: 36 },
  },
  doorWide: {
    pos: V(1.25, 1.4, 2.1),
    target: V(0.05, 0.9, 0.05),
    fov: 42,
    portrait: { fov: 56 },
  },
  reveal: {
    pos: V(0.34, 1.03, 0.42),
    target: V(0.16, 0.93, -0.27),
    fov: 30,
    portrait: { fov: 40 },
  },
  tray: {
    pos: V(0.95, 1.25, 1.05),
    target: V(0.93, 0.74, 0.42),
    fov: 38,
    portrait: { fov: 50 },
  },
  inspect: {
    pos: V(0.72, 1.1, 0.66),
    target: V(0.34, 1.0, 0.24),
    fov: 32,
    portrait: { fov: 44 },
  },
};

interface Segment {
  shot: Shot;
  duration: number;
  hold: number;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export class CameraDirector {
  private cam: THREE.PerspectiveCamera;
  private curPos = new THREE.Vector3();
  private curTarget = new THREE.Vector3();
  private curFov = 40;
  private fromPos = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private fromFov = 40;
  private toShot: Shot | null = null;
  private t = 0;
  private duration = 0;
  private holdLeft = 0;
  private queue: Segment[] = [];
  private onSequenceDone: (() => void) | null = null;
  /** true while a cinematic sequence owns the camera */
  playing = false;

  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
    this.curPos.copy(cam.position);
    this.curFov = cam.fov;
  }

  private isPortrait(): boolean {
    return this.cam.aspect < 1;
  }

  private resolve(shot: Shot): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
    if (this.isPortrait() && shot.portrait) {
      return {
        pos: shot.portrait.pos ?? shot.pos,
        target: shot.portrait.target ?? shot.target,
        fov: shot.portrait.fov ?? shot.fov,
      };
    }
    return { pos: shot.pos, target: shot.target, fov: shot.fov };
  }

  /** cut or glide to a single shot */
  goTo(name: keyof typeof SHOTS, duration = 1.2): void {
    const shot = SHOTS[name];
    if (!shot) return;
    this.queue = [];
    this.onSequenceDone = null;
    this.playing = false;
    this.beginSegment(shot, duration, 0);
  }

  /** play a chain of shots, then call done */
  playSequence(
    segs: Array<{ name: keyof typeof SHOTS; duration: number; hold?: number }>,
    done?: () => void
  ): void {
    this.queue = segs
      .map((s) => {
        const shot = SHOTS[s.name];
        return shot ? { shot, duration: s.duration, hold: s.hold ?? 0 } : null;
      })
      .filter((s): s is Segment => s !== null);
    this.onSequenceDone = done ?? null;
    this.playing = true;
    const first = this.queue.shift();
    if (first) this.beginSegment(first.shot, first.duration, first.hold);
  }

  skip(): void {
    // jump to the final queued shot and finish
    const last = this.queue.pop() ?? (this.toShot ? { shot: this.toShot, duration: 0, hold: 0 } : null);
    this.queue = [];
    if (last) {
      const r = this.resolve(last.shot);
      this.curPos.copy(r.pos);
      this.curTarget.copy(r.target);
      this.curFov = r.fov;
    }
    this.toShot = null;
    this.playing = false;
    const cb = this.onSequenceDone;
    this.onSequenceDone = null;
    cb?.();
  }

  private beginSegment(shot: Shot, duration: number, hold: number): void {
    this.fromPos.copy(this.curPos);
    this.fromTarget.copy(this.curTarget);
    this.fromFov = this.curFov;
    this.toShot = shot;
    this.duration = Math.max(0.001, duration);
    this.holdLeft = hold;
    this.t = 0;
  }

  update(dt: number): void {
    if (this.toShot) {
      this.t += dt;
      const k = easeInOut(Math.min(1, this.t / this.duration));
      const r = this.resolve(this.toShot);
      this.curPos.lerpVectors(this.fromPos, r.pos, k);
      this.curTarget.lerpVectors(this.fromTarget, r.target, k);
      this.curFov = this.fromFov + (r.fov - this.fromFov) * k;
      if (this.t >= this.duration) {
        if (this.holdLeft > 0) {
          this.holdLeft -= dt;
        } else {
          this.toShot = null;
          const next = this.queue.shift();
          if (next) {
            this.beginSegment(next.shot, next.duration, next.hold);
          } else if (this.playing) {
            this.playing = false;
            const cb = this.onSequenceDone;
            this.onSequenceDone = null;
            cb?.();
          }
        }
      }
    }
    this.cam.position.copy(this.curPos);
    this.cam.lookAt(this.curTarget);
    if (Math.abs(this.cam.fov - this.curFov) > 0.01) {
      this.cam.fov = this.curFov;
      this.cam.updateProjectionMatrix();
    }
  }

  /** re-resolve the current shot on orientation change */
  refresh(currentName: keyof typeof SHOTS): void {
    const shot = SHOTS[currentName];
    if (!shot || this.toShot) return;
    const r = this.resolve(shot);
    this.curPos.copy(r.pos);
    this.curTarget.copy(r.target);
    this.curFov = r.fov;
  }
}
