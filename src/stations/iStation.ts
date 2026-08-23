/**
 * Station 3 — I. The letter stands upright, read from the front. A ball is
 * dropped onto the track on the top bar: while the I stands straight the
 * ball sits in the shallow detent; lean the I and the ball rolls off the
 * downhill end into that side's tray. The ball runs a live 1-DOF
 * simulation along the track, so it answers the handle instantly.
 */
import * as THREE from 'three';
import { StationBase, type StationEvents, type StationId } from './base';
import type { LabMaterials } from '../core/materials';
import type { LabAudio } from '../core/audio';
import type { InputManager } from '../core/input';
import type { StationViews } from '../core/cameraRig';
import { makeIGlyph } from '../glyph/iMesh';
import { I_SPEC, iTrackTilt, iBallDirection, BALLS, type BallKind } from '../glyph/spec';
import { makeTiltLever, makePullLever, makeTray, makeAndon, miniI, type TiltLever, type PullLever, type Andon } from '../lab/parts';
import { clamp, damp } from '../core/math';
import { lathe } from '../geo/dynamic';

const LETTER_X = 0;

type Motion =
  | { kind: 'feeder' }
  | { kind: 'dropToTrack'; vy: number }
  | { kind: 'onTrack'; x: number; v: number }
  | { kind: 'flyOff'; vel: THREE.Vector3; side: 1 | -1 }
  | { kind: 'restTray'; side: 1 | -1 };

export class IStation extends StationBase {
  readonly id: StationId = 'I';
  readonly views: StationViews;
  private glyph = makeIGlyph(this.mats);
  private slant = 0;
  private lever: TiltLever;
  private dropLever: PullLever;
  private motion: Motion = { kind: 'feeder' };
  private dragStart = 0;
  private andon: Andon;
  private feederPos = new THREE.Vector3(LETTER_X, 1.32, 0);
  onSlantInput: (() => void) | null = null;

  constructor(
    worldX: number,
    mats: LabMaterials,
    audio: LabAudio,
    input: InputManager,
    events: StationEvents,
  ) {
    super(worldX, mats, audio, input, events);

    this.glyph.group.position.set(LETTER_X, 0, 0);
    this.group.add(this.glyph.group);

    // --- drop chute above the letter ---------------------------------------
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.52, 0.07), mats.aluminum);
    col.position.set(0.72, 0.76, -0.42);
    col.castShadow = true;
    this.group.add(col);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.15), mats.aluminumDark);
    foot.position.set(0.72, 0.015, -0.42);
    this.group.add(foot);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.06), mats.aluminum);
    arm.position.set(0.35, 1.49, -0.42);
    arm.castShadow = true;
    this.group.add(arm);
    const armFwd = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.44), mats.aluminum);
    armFwd.position.set(0, 1.47, -0.2);
    this.group.add(armFwd);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.24, 22, 1, true), mats.glass);
    tube.position.set(0, 1.3, 0);
    this.group.add(tube);
    const funnel = new THREE.Mesh(
      lathe(
        [
          [0.15, 0.0],
          [0.24, 0.1],
          [0.25, 0.11],
        ],
        24,
      ),
      mats.glass,
    );
    funnel.position.set(0, 1.43, 0);
    this.group.add(funnel);
    const mouthRing = new THREE.Mesh(new THREE.TorusGeometry(0.248, 0.01, 8, 28), mats.brass);
    mouthRing.rotation.x = Math.PI / 2;
    mouthRing.position.set(0, 1.54, 0);
    this.group.add(mouthRing);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 28), mats.aluminumDark);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.4, 0);
    this.group.add(collar);
    const collarStrut = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.26), mats.aluminum);
    collarStrut.position.set(0, 1.42, -0.12);
    this.group.add(collarStrut);
    const collarDrop = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.035), mats.aluminum);
    collarDrop.position.set(0, 1.44, -0.22);
    this.group.add(collarDrop);

    this.andon = makeAndon(this.mats);
    this.andon.group.position.set(0.72, 1.56, -0.42);
    this.group.add(this.andon.group);

    this.dropLever = makePullLever(this.mats);
    this.dropLever.group.position.set(0.76, 1.18, -0.34);
    this.group.add(this.dropLever.group);
    this.attentionLights.lever = this.dropLever.attention;

    // --- slant lever with straight / leaning minis --------------------------
    this.lever = makeTiltLever(
      this.mats,
      miniI(this.mats, -1),
      miniI(this.mats, 0),
      miniI(this.mats, 1),
    );
    this.lever.group.position.set(0.55, 0, 0.56);
    this.group.add(this.lever.group);
    this.attentionLights.handle = this.lever.attention;

    // side trays
    for (const side of [-1, 1] as const) {
      const tray = makeTray(this.mats, 0.34, 0.3);
      tray.position.set(side * 0.8, 0, 0.02);
      this.group.add(tray);
    }

    this.views = {
      front: {
        pos: new THREE.Vector3(worldX, 1.08, 2.6),
        target: new THREE.Vector3(worldX, 0.55, 0),
      },
      threequarter: {
        pos: new THREE.Vector3(worldX + 1.5, 1.3, 1.9),
        target: new THREE.Vector3(worldX, 0.6, 0),
      },
      operate: {
        pos: new THREE.Vector3(worldX + 0.25, 1.1, 2.4),
        target: new THREE.Vector3(worldX + 0.1, 0.55, 0.1),
      },
    };

    input.register({
      hitMesh: this.lever.hitMesh,
      enabled: () => true,
      onDown: () => {
        this.dragStart = this.slant;
      },
      onDrag: (p) => {
        const v = clamp(this.dragStart + p.dxPx / 130, -1, 1);
        if (Math.abs(v - this.slant) > 0.0005) {
          this.setAxis(v);
          this.audio.tick();
          this.events.onAxisInput(this.id);
          this.onSlantInput?.();
        }
      },
    });
    input.register({
      hitMesh: this.dropLever.hitMesh,
      enabled: () => this.ballStatus === 'inFeeder',
      onDrag: (p) => {
        const pull = clamp(p.dyPx / 80, 0, 1);
        this.dropLever.setPull(pull);
        if (pull >= 1 && this.ballStatus === 'inFeeder') this.releaseBall();
      },
      onUp: (_p, wasTap) => {
        if (wasTap && this.ballStatus === 'inFeeder') this.releaseBall();
        this.dropLever.setPull(0);
      },
    });

    this.glyph.setSlant(0);
    this.lever.setValue(0);
    this.loadBall('rubber');
  }

  getAxis() {
    return this.slant;
  }

  setAxis(v: number) {
    this.slant = clamp(v, -1, 1);
    this.glyph.setSlant(this.slant);
    this.lever.setValue(this.slant);
  }

  loadBall(kind: BallKind) {
    // the I track suits the small ball; big steel stays at O/C, so clamp
    this.loadedKind = kind === 'steel' ? 'rubber' : kind;
    const b = this.newBall(this.loadedKind);
    b.setPosition(this.feederPos.x, 1.31 + b.radius, this.feederPos.z);
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
    (kind === 'handle' ? this.lever.hitMesh : this.dropLever.hitMesh).getWorldPosition(v);
    return v;
  }

  feederWorldPos(): THREE.Vector3 {
    return new THREE.Vector3(this.feederPos.x + this.worldX, 1.5, this.feederPos.z);
  }

  measure() {
    return {
      trackTilt: iTrackTilt(this.slant),
      ballDirection: iBallDirection(this.slant),
      ballD: this.ball?.spec.diameter ?? BALLS[this.loadedKind].diameter,
    };
  }

  private releaseBall() {
    if (!this.ball) return;
    this.audio.leverClack();
    this.events.onLeverPulled(this.id);
    this.motion = { kind: 'dropToTrack', vy: 0 };
    this.ballStatus = 'moving';
  }

  /** track point (local x along bar) -> station space */
  private trackPoint(x: number, r: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(x, this.glyph.trackSurfaceY + r, 0);
    this.glyph.topBar.updateMatrix();
    out.applyMatrix4(this.glyph.topBar.matrix);
    out.x += LETTER_X;
    return out;
  }

  update(dt: number) {
    this.updateAttention(dt);
    this.andon.update(dt);
    const b = this.ball;
    if (!b) return;
    const m = this.motion;
    const r = b.radius;
    const tmp = new THREE.Vector3();

    switch (m.kind) {
      case 'dropToTrack': {
        m.vy -= 9.8 * dt;
        b.position.y += m.vy * dt;
        // where is the track under the fixed drop line (x = 0 world)?
        const barX = -this.glyph.topBar.position.x; // bar-local x under the chute
        this.trackPoint(barX, r, tmp);
        if (b.position.y <= tmp.y) {
          b.impact(-m.vy, 'steel');
          const localX = clamp(barX, -this.glyph.trackHalfLength, this.glyph.trackHalfLength);
          this.motion = { kind: 'onTrack', x: localX, v: 0 };
          this.ballStatus = 'restCenter';
          this.events.onResult(this.id, 'center');
        }
        break;
      }
      case 'onTrack': {
        const tilt = iTrackTilt(this.slant);
        let a = -9.8 * Math.sin(tilt) * 0.9; // rolls downhill along +local x when tilt < 0
        const inDetent = Math.abs(m.x) < 0.055 && iBallDirection(this.slant) === 0;
        if (inDetent) {
          a += -m.x * 60 - m.v * 9;
        }
        m.v += a * dt;
        m.v *= 1 - 0.35 * dt;
        m.x += m.v * dt;
        this.trackPoint(m.x, r, b.position);
        this.ballStatus = Math.abs(m.x) < 0.06 ? 'restCenter' : 'moving';
        if (Math.abs(m.x) > this.glyph.trackHalfLength) {
          const side: 1 | -1 = m.x > 0 ? 1 : -1;
          const dir = new THREE.Vector3(Math.cos(tilt) * m.v, -Math.abs(Math.sin(tilt) * m.v), 0);
          this.motion = { kind: 'flyOff', vel: dir, side };
          this.ballStatus = 'moving';
        }
        b.tick(dt, true);
        return;
      }
      case 'flyOff': {
        m.vel.y -= 9.8 * dt;
        b.position.addScaledVector(m.vel, dt);
        // funnel horizontally toward the tray center so it always lands in
        const trayX = m.side * 0.8;
        b.position.x = damp(b.position.x, trayX, 3.2, dt);
        b.position.z = damp(b.position.z, 0.02, 3, dt);
        const floorY = 0.045 + r;
        if (b.position.y <= floorY) {
          b.position.y = floorY;
          b.impact(m.vel.length(), 'felt');
          this.motion = { kind: 'restTray', side: m.side };
          this.ballStatus = m.side > 0 ? 'restRight' : 'restLeft';
          this.settleTimer = 0;
          this.andon.flash();
          this.events.onResult(this.id, m.side > 0 ? 'right' : 'left');
        }
        break;
      }
      case 'restTray': {
        this.settleTimer += dt;
        if (this.settleTimer > 3.0) {
          this.loadBall(this.loadedKind);
          this.events.onBallSettled(this.id);
        }
        break;
      }
      default:
        break;
    }
    b.tick(dt, false);
  }
}
