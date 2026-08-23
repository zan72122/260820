/**
 * Station 2 — C. The letter is a corral wall on the plate. A ball rolls
 * down the launch ramp toward the aperture: too narrow and it stops right
 * at the mouth; wide enough and it swings around the inner bowl and rolls
 * out again. The width handle moves the terminals apart and re-curves the
 * bowl — never a plain x-scale.
 */
import * as THREE from 'three';
import { StationBase, type StationEvents, type StationId } from './base';
import type { LabMaterials } from '../core/materials';
import type { LabAudio } from '../core/audio';
import type { InputManager } from '../core/input';
import type { StationViews } from '../core/cameraRig';
import { makeCGlyph } from '../glyph/cMesh';
import {
  C_SPEC,
  cApertureGap,
  cApertureHalfAngle,
  cBallEnters,
  cCenterline,
  cRx,
  cStrokeAt,
  BALLS,
  type BallKind,
} from '../glyph/spec';
import { makeRailHandle, makePullLever, makeTray, makeAndon, miniC, type RailHandle, type PullLever, type Andon } from '../lab/parts';
import { clamp01, damp } from '../core/math';

const C_POS = new THREE.Vector3(-0.2, 0, 0);
const RAMP_TOP = new THREE.Vector3(0.86, 0.34, 0.04);
const RAMP_END = new THREE.Vector3(0.56, 0.0, 0.04);

type Motion =
  | { kind: 'feeder' }
  | { kind: 'curve'; t: number; dur: number; curve: THREE.CatmullRomCurve3; result: 'pass' | 'blocked'; bumped: boolean }
  | { kind: 'restMouth' }
  | { kind: 'restTrough' };

export class CStation extends StationBase {
  readonly id: StationId = 'C';
  readonly views: StationViews;
  private glyph = makeCGlyph(this.mats);
  private width = 0;
  private handle: RailHandle;
  private lever: PullLever;
  private motion: Motion = { kind: 'feeder' };
  private dragStart = 0;
  private andon: Andon;
  onWidthInput: (() => void) | null = null;

  constructor(
    worldX: number,
    mats: LabMaterials,
    audio: LabAudio,
    input: InputManager,
    events: StationEvents,
  ) {
    super(worldX, mats, audio, input, events);

    this.glyph.group.position.copy(C_POS);
    this.group.add(this.glyph.group);

    // --- launch ramp --------------------------------------------------------
    const ramp = new THREE.Group();
    const chanLen = RAMP_TOP.distanceTo(RAMP_END) + 0.1;
    const angle = Math.atan2(RAMP_TOP.y - RAMP_END.y, RAMP_TOP.x - RAMP_END.x);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(chanLen, 0.02, 0.24), mats.aluminum);
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(chanLen, 0.05, 0.02), mats.aluminum);
    const rail2 = rail1.clone();
    rail1.position.set(0, 0.03, 0.11);
    rail2.position.set(0, 0.03, -0.11);
    const chan = new THREE.Group();
    chan.add(bed, rail1, rail2);
    chan.position.set((RAMP_TOP.x + RAMP_END.x) / 2, (RAMP_TOP.y + RAMP_END.y) / 2 + 0.01, RAMP_TOP.z);
    chan.rotation.z = angle;
    chan.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    ramp.add(chan);
    // support column + feeder cup
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.07, RAMP_TOP.y + 0.42, 0.07), mats.aluminum);
    col.position.set(RAMP_TOP.x + 0.16, (RAMP_TOP.y + 0.42) / 2, RAMP_TOP.z + 0.14);
    col.castShadow = true;
    ramp.add(col);
    const cupMat = mats.aluminum.clone();
    cupMat.side = THREE.DoubleSide;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.14, 22, 1, true), cupMat);
    cup.position.set(RAMP_TOP.x + 0.02, RAMP_TOP.y + 0.09, RAMP_TOP.z);
    cup.castShadow = true;
    ramp.add(cup);
    this.group.add(ramp);

    // gate at the ramp lip
    this.lever = makePullLever(this.mats);
    this.lever.group.position.set(RAMP_TOP.x + 0.16, RAMP_TOP.y + 0.38, RAMP_TOP.z + 0.3);
    this.group.add(this.lever.group);
    this.attentionLights.lever = this.lever.attention;

    // --- width handle -------------------------------------------------------
    this.handle = makeRailHandle(this.mats, 0.92, miniC(this.mats, 0.02), miniC(this.mats, 1));
    this.handle.group.position.set(-0.05, 0, 0.58);
    this.group.add(this.handle.group);
    this.attentionLights.handle = this.handle.attention;

    this.andon = makeAndon(this.mats);
    this.andon.group.position.set(RAMP_TOP.x + 0.2, RAMP_TOP.y + 0.62, RAMP_TOP.z + 0.16);
    this.group.add(this.andon.group);

    // exit trough
    const trough = makeTray(this.mats, 0.4, 0.32);
    trough.position.set(0.62, 0, -0.42);
    this.group.add(trough);

    this.views = {
      front: {
        pos: new THREE.Vector3(worldX + 0.1, 2.6, 1.2),
        target: new THREE.Vector3(worldX - 0.12, 0.25, -0.08),
      },
      threequarter: {
        pos: new THREE.Vector3(worldX + 1.5, 1.5, 1.4),
        target: new THREE.Vector3(worldX - 0.1, 0.3, 0),
      },
      operate: {
        pos: new THREE.Vector3(worldX + 0.4, 2.3, 1.65),
        target: new THREE.Vector3(worldX, 0.3, 0.1),
      },
    };

    input.register({
      hitMesh: this.handle.hitMesh,
      enabled: () => true,
      onDown: () => {
        this.dragStart = this.width;
      },
      onDrag: (p) => {
        const v = clamp01(this.dragStart + p.dxPx / 280);
        if (Math.abs(v - this.width) > 0.0005) {
          this.setAxis(v);
          this.audio.tick();
          this.events.onAxisInput(this.id);
          this.onWidthInput?.();
        }
      },
    });
    input.register({
      hitMesh: this.lever.hitMesh,
      enabled: () => this.ballStatus === 'inFeeder',
      onDrag: (p) => {
        const pull = clamp01(p.dyPx / 80);
        this.lever.setPull(pull);
        if (pull >= 1 && this.ballStatus === 'inFeeder') this.releaseBall();
      },
      onUp: (_p, wasTap) => {
        if (wasTap && this.ballStatus === 'inFeeder') this.releaseBall();
        this.lever.setPull(0);
      },
    });

    this.glyph.setWidth(this.width);
    this.handle.setValue(this.width);
    this.loadBall('rubber');
  }

  getAxis() {
    return this.width;
  }

  setAxis(v: number) {
    this.width = clamp01(v);
    this.glyph.setWidth(this.width);
    this.handle.setValue(this.width);
  }

  loadBall(kind: BallKind) {
    this.loadedKind = kind;
    const b = this.newBall(kind);
    b.setPosition(RAMP_TOP.x + 0.02, RAMP_TOP.y + 0.05 + b.radius, RAMP_TOP.z);
    this.motion = { kind: 'feeder' };
    this.ballStatus = 'inFeeder';
  }

  pullLever(): boolean {
    if (this.ballStatus !== 'inFeeder') return false;
    this.releaseBall();
    return true;
  }

  controlWorldPos(kind: 'handle' | 'lever'): THREE.Vector3 {
    const v = new THREE.Vector3();
    (kind === 'handle' ? this.handle.hitMesh : this.lever.hitMesh).getWorldPosition(v);
    return v;
  }

  feederWorldPos(): THREE.Vector3 {
    return new THREE.Vector3(RAMP_TOP.x + 0.02 + this.worldX, RAMP_TOP.y + 0.24, RAMP_TOP.z);
  }

  measure() {
    return {
      apertureGap: cApertureGap(this.width),
      ballD: this.ball?.spec.diameter ?? BALLS[this.loadedKind].diameter,
    };
  }

  private releaseBall() {
    if (!this.ball) return;
    const b = this.ball;
    this.audio.leverClack();
    this.events.onLeverPulled(this.id);
    const r = b.radius;
    const enters = cBallEnters(this.width, b.spec.diameter);
    const th = cApertureHalfAngle(this.width);
    const rx = cRx(this.width);
    const cx = C_POS.x;
    const termX = cx + rx * Math.cos(th);
    const pts: THREE.Vector3[] = [
      new THREE.Vector3(RAMP_TOP.x + 0.02, RAMP_TOP.y + 0.02 + r, RAMP_TOP.z),
      new THREE.Vector3((RAMP_TOP.x + RAMP_END.x) / 2, (RAMP_TOP.y + RAMP_END.y) / 2 + 0.02 + r, RAMP_TOP.z),
      new THREE.Vector3(RAMP_END.x, r, RAMP_TOP.z),
    ];
    let dur: number;
    if (!enters) {
      const stopX = termX + r + 0.015;
      pts.push(new THREE.Vector3(stopX + 0.12, r, 0.03));
      pts.push(new THREE.Vector3(stopX, r, 0.015));
      // tiny recoil
      pts.push(new THREE.Vector3(stopX + 0.045, r, 0.02));
      pts.push(new THREE.Vector3(stopX + 0.03, r, 0.02));
      dur = 1.5;
    } else {
      // sweep the inner bowl: entry near the lower terminal, out at the upper
      const aIn = th + 0.42;
      const aOut = 2 * Math.PI - th - 0.42;
      const inner = (a: number) => {
        const p = cCenterline(this.width, a);
        let nx = p.x / (rx * rx);
        let nz = p.z / (C_SPEC.ry * C_SPEC.ry);
        const l = Math.hypot(nx, nz) || 1;
        nx /= l;
        nz /= l;
        const off = cStrokeAt(this.width, a) / 2 + r * 0.92;
        return new THREE.Vector3(cx + p.x - nx * off, r, p.z - nz * off);
      };
      pts.push(new THREE.Vector3(termX + r + 0.06, r, 0.1));
      const steps = 9;
      for (let i = 0; i <= steps; i++) pts.push(inner(aIn + ((aOut - aIn) * i) / steps));
      pts.push(new THREE.Vector3(termX + r + 0.1, r, -0.18));
      pts.push(new THREE.Vector3(0.62, r, -0.34));
      pts.push(new THREE.Vector3(0.63, 0.03 + r, -0.42));
      dur = 3.4;
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    this.motion = { kind: 'curve', t: 0, dur, curve, result: enters ? 'pass' : 'blocked', bumped: false };
    this.ballStatus = 'moving';
  }

  update(dt: number) {
    this.updateAttention(dt);
    this.andon.update(dt);
    const b = this.ball;
    if (!b) return;
    const m = this.motion;
    switch (m.kind) {
      case 'curve': {
        m.t += dt;
        const k = Math.min(1, m.t / m.dur);
        // accelerate down the ramp, then steady roll, gentle decel at the end
        const s = k < 0.25 ? k * k * 2.2 : 0.1375 + (k - 0.25) * 1.15;
        const sc = Math.min(1, s);
        m.curve.getPointAt(sc, b.position);
        if (!m.bumped && m.result === 'blocked' && k > 0.62) {
          m.bumped = true;
          b.impact(1.6, 'steel');
        }
        if (!m.bumped && m.result === 'pass' && k > 0.34) {
          m.bumped = true;
          b.impact(0.7, 'steel');
        }
        if (k >= 1) {
          if (m.result === 'blocked') {
            this.motion = { kind: 'restMouth' };
            this.ballStatus = 'blocked';
            this.settleTimer = 0;
            this.events.onResult(this.id, 'blocked');
          } else {
            b.impact(1.2, 'felt');
            this.motion = { kind: 'restTrough' };
            this.ballStatus = 'passed';
            this.settleTimer = 0;
            this.andon.flash();
            this.events.onResult(this.id, 'pass');
          }
        }
        b.tick(dt, true);
        return;
      }
      case 'restMouth':
      case 'restTrough': {
        this.settleTimer += dt;
        if (this.settleTimer > 3.2) {
          this.loadBall(this.loadedKind);
          this.events.onBallSettled(this.id);
        }
        break;
      }
      default:
        break;
    }
    b.tick(dt, false);
    void damp;
  }
}
