import { PerspectiveCamera, Vector3 } from 'three';
import { clamp, damp, deg, lerp } from '../core/math';
import { SLIDE_LENGTH, slidePoint, slideSurface } from '../world/slideCurve';

export type ShotName = 'overview' | 'gate' | 'follow' | 'landing';

export type Orientation = 'portrait' | 'landscape';

interface RigProfile {
  overviewAz: number;
  overviewEl: number;
  overviewFov: number;
  followAz: number;
  followEl: number;
  followDist: number;
  followFov: number;
  followLead: number;
  landingAz: number;
  landingEl: number;
  landingDist: number;
  landingFov: number;
  /** Push the framed content up the screen, away from where fingers rest. */
  screenBias: number;
  padding: number;
}

/**
 * Portrait puts the slide direction on the screen's vertical axis; landscape
 * lays it across the frame on a diagonal so the roll-out after landing has
 * room. These are different camera set-ups, not one layout stretched.
 */
const PROFILES: Record<Orientation, RigProfile> = {
  portrait: {
    overviewAz: deg(14),
    overviewEl: deg(27),
    overviewFov: 46,
    followAz: deg(20),
    followEl: deg(21),
    followDist: 2.5,
    followFov: 46,
    followLead: 1.05,
    landingAz: deg(34),
    landingEl: deg(13),
    landingDist: 2.1,
    landingFov: 46,
    screenBias: 0.11,
    padding: 1.08,
  },
  landscape: {
    overviewAz: deg(74),
    overviewEl: deg(26),
    overviewFov: 40,
    followAz: deg(78),
    followEl: deg(21),
    followDist: 2.8,
    followFov: 40,
    followLead: 0.95,
    landingAz: deg(86),
    landingEl: deg(14),
    landingDist: 2.35,
    landingFov: 40,
    screenBias: 0.07,
    padding: 1.08,
  },
};

export interface ShotContext {
  /** Where the interesting thing currently is. */
  focus: Vector3;
  /** Extra points that must stay inside the frame. */
  frame: Vector3[];
  /** Arc position of the moving object, if it is on the bed. */
  arc: number | null;
  /** Distance rolled past the lip, for extending the follow rail. */
  beyond: number;
  /** Predicted touchdown, so the landing move starts before the impact. */
  landing: Vector3 | null;
  /** True once the object is down; the shot then tracks it rather than the guess. */
  grounded: boolean;
}

const _dir = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _tmp = new Vector3();
const UP = new Vector3(0, 1, 0);

function basis(az: number, el: number): void {
  _dir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
  _r.crossVectors(UP, _dir).normalize();
  _u.crossVectors(_dir, _r).normalize();
}

export class CameraRig {
  readonly camera = new PerspectiveCamera(46, 1, 0.05, 220);
  orientation: Orientation = 'portrait';
  private aspect = 1;
  private pos = new Vector3(9, 4, 3);
  private look = new Vector3(3, 0.8, 0);
  private targetPos = new Vector3();
  private targetLook = new Vector3();
  private fov = 46;
  private shot: ShotName = 'overview';
  private settleDist = 9;
  /** Debug-only: hold the camera still so a fixed view can be inspected. */
  frozen = false;

  constructor() {
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  get profile(): RigProfile {
    return PROFILES[this.orientation];
  }

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.orientation = this.aspect < 1.0 ? 'portrait' : 'landscape';
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Ordered list of shots used, newest last. Read by the debug/e2e surface. */
  readonly shotLog: ShotName[] = ['overview'];

  setShot(shot: ShotName): void {
    if (this.shot !== shot) {
      this.shotLog.push(shot);
      if (this.shotLog.length > 64) this.shotLog.shift();
    }
    this.shot = shot;
  }

  get currentShot(): ShotName {
    return this.shot;
  }

  /**
   * Distance at which every supplied point is inside the frustum. Used instead
   * of hand-tuned camera distances so the composition survives any phone
   * aspect ratio.
   */
  private fitDistance(target: Vector3, points: Vector3[], fov: number, padding: number): number {
    const tanV = Math.tan((fov * Math.PI) / 360);
    const tanH = tanV * this.aspect;
    let need = 1.4;
    for (const p of points) {
      _tmp.copy(p).sub(target);
      const x = Math.abs(_tmp.dot(_r));
      const y = Math.abs(_tmp.dot(_u));
      // _dir points from the target towards the camera, so a point in front
      // of the target needs MORE distance, not less.
      const z = _tmp.dot(_dir);
      need = Math.max(need, x / tanH + z, y / tanV + z);
    }
    return need * padding;
  }

  update(dt: number, ctx: ShotContext): void {
    if (this.frozen) return;
    const p = this.profile;
    let rate = 0.055;

    switch (this.shot) {
      case 'gate': {
        // The pulling hand and the held object share one frame, so the child
        // sees the cause and the effect in a single continuous image.
        basis(p.overviewAz, p.overviewEl);
        const pts = [ctx.focus, ...ctx.frame];
        this.targetLook.set(0, 0, 0);
        for (const q of pts) this.targetLook.add(q);
        this.targetLook.multiplyScalar(1 / Math.max(1, pts.length));
        const d = this.fitDistance(this.targetLook, pts, p.overviewFov, p.padding * 1.14);
        this.targetPos.copy(this.targetLook).addScaledVector(_dir, d);
        this.fov = p.overviewFov;
        this.applyBias(d, p);
        rate = 0.075;
        break;
      }
      case 'follow': {
        // Camera rides a rail tied to the object's own arc position: identical
        // path and identical field of view for every object, so a difference
        // on screen is a difference in the object.
        basis(p.followAz, p.followEl);
        const arc = ctx.arc ?? SLIDE_LENGTH;
        const railArc = clamp(arc + p.followLead, 0.2, SLIDE_LENGTH);
        const rail = slideSurface(railArc, 0, 0.22, new Vector3());
        if (ctx.beyond > 0) rail.x += ctx.beyond * 0.92;
        this.targetPos.copy(rail).addScaledVector(_dir, p.followDist);
        this.targetLook.copy(ctx.focus);
        this.fov = p.followFov;
        this.applyBias(p.followDist, p);
        rate = 0.16;
        break;
      }
      case 'landing': {
        basis(p.landingAz, p.landingEl);
        const land = ctx.landing ?? ctx.focus;
        // Before touchdown the shot leads to where the object is going; after
        // it, the object itself is the subject.
        this.targetLook.copy(ctx.focus);
        if (!ctx.grounded) this.targetLook.lerp(land, 0.45);
        this.targetLook.y = Math.max(0.12, this.targetLook.y);
        this.targetPos.copy(this.targetLook).addScaledVector(_dir, p.landingDist);
        this.targetPos.y = Math.max(0.42, this.targetPos.y);
        this.fov = p.landingFov;
        // Barely any bias here: the point of the shot is the contact itself.
        this.applyBias(p.landingDist * 0.3, p);
        rate = ctx.grounded ? 0.15 : 0.09;
        break;
      }
      default: {
        basis(p.overviewAz, p.overviewEl);
        const pts = [
          slidePoint(0, new Vector3()).setY(slidePoint(0, _tmp).y + 0.55),
          slidePoint(SLIDE_LENGTH, new Vector3()),
          ...ctx.frame,
        ];
        this.targetLook.set(0, 0, 0);
        for (const q of pts) this.targetLook.add(q);
        this.targetLook.multiplyScalar(1 / Math.max(1, pts.length));
        const d = this.fitDistance(this.targetLook, pts, p.overviewFov, p.padding);
        this.settleDist = damp(this.settleDist, d, 0.03, dt);
        this.targetPos.copy(this.targetLook).addScaledVector(_dir, this.settleDist);
        this.fov = p.overviewFov;
        this.applyBias(this.settleDist, p);
        rate = 0.035;
      }
    }

    this.pos.x = damp(this.pos.x, this.targetPos.x, rate, dt);
    this.pos.y = damp(this.pos.y, this.targetPos.y, rate, dt);
    this.pos.z = damp(this.pos.z, this.targetPos.z, rate, dt);
    this.look.x = damp(this.look.x, this.targetLook.x, rate * 1.35, dt);
    this.look.y = damp(this.look.y, this.targetLook.y, rate * 1.35, dt);
    this.look.z = damp(this.look.z, this.targetLook.z, rate * 1.35, dt);

    this.camera.fov = lerp(this.camera.fov, this.fov, 1 - Math.pow(0.001, dt));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
  }

  /** Shift the framed content up the screen so thumbs never cover the action. */
  private applyBias(distance: number, p: RigProfile): void {
    const tanV = Math.tan((this.fov * Math.PI) / 360);
    const shift = distance * tanV * p.screenBias;
    this.targetLook.addScaledVector(_u, -shift);
    this.targetPos.addScaledVector(_u, -shift);
  }

  /** Immediately place the camera (used once at start-up). */
  snap(ctx: ShotContext): void {
    for (let i = 0; i < 200; i++) this.update(1 / 30, ctx);
  }
}
