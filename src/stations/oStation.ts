/**
 * Station 1 — O. A ring gauge lying on the granite plate, read from above.
 * Drop a ball from the glass chute: it either fits through the counter and
 * rings the bowl below, or it doesn't. The weight handle drives the iris.
 */
import * as THREE from 'three';
import { StationBase, type StationEvents, type StationId } from './base';
import type { LabMaterials } from '../core/materials';
import type { LabAudio } from '../core/audio';
import type { InputManager } from '../core/input';
import type { StationViews } from '../core/cameraRig';
import { makeOGauge } from '../glyph/oMesh';
import { oBallPasses, oCounterR, O_SPEC, BALLS, type BallKind } from '../glyph/spec';
import { makeRailHandle, makePullLever, makeTray, makeAndon, miniO, type RailHandle, type PullLever, type Andon } from '../lab/parts';
import { clamp, clamp01, damp, DEG, lerp } from '../core/math';
import { lathe } from '../geo/dynamic';

const GAUGE_POS = new THREE.Vector3(-0.25, 0.225, -0.1);
const CANT = O_SPEC.cantDeg * DEG;

type Motion =
  | { kind: 'idle' }
  | { kind: 'feeder' }
  | { kind: 'fall'; vy: number; passes: boolean }
  | { kind: 'seatBeat'; t: number; v: number }
  | { kind: 'restOnIris' }
  | { kind: 'bounceOut'; t: number; dur: number; curve: THREE.CatmullRomCurve3; hitDone: boolean }
  | { kind: 'fallThrough'; vy: number }
  | { kind: 'settleBowl'; vy: number; bounces: number }
  | { kind: 'restBowl' }
  | { kind: 'restTray' };

export class OStation extends StationBase {
  readonly id: StationId = 'O';
  readonly views: StationViews;
  private gauge = makeOGauge(this.mats);
  private weight = 1;
  private handle: RailHandle;
  private lever: PullLever;
  private motion: Motion = { kind: 'idle' };
  private gateFlap: THREE.Mesh;
  private gateOpen = 0;
  private leverArmed = true;
  private syncShaft: THREE.Mesh;
  private feederPos = new THREE.Vector3(GAUGE_POS.x, 1.32, GAUGE_POS.z);
  private returnTimer = 0;
  private andon: Andon;
  private dragStart = 0;
  onWeightInput: (() => void) | null = null;

  constructor(
    worldX: number,
    mats: LabMaterials,
    audio: LabAudio,
    input: InputManager,
    events: StationEvents,
  ) {
    super(worldX, mats, audio, input, events);

    // --- gauge on its stand -------------------------------------------------
    const gaugeRoot = new THREE.Group();
    gaugeRoot.position.copy(GAUGE_POS);
    gaugeRoot.rotation.x = CANT;
    gaugeRoot.add(this.gauge.group);
    this.group.add(gaugeRoot);

    const postGeo = (h: number) => new THREE.CylinderGeometry(0.05, 0.055, h, 12);
    for (const [px, pz] of [
      [-0.38, -0.36],
      [0.38, -0.36],
      [-0.38, 0.26],
      [0.38, 0.26],
    ] as const) {
      const topY = GAUGE_POS.y - (pz - GAUGE_POS.z + 0.0) * Math.sin(CANT);
      const post = new THREE.Mesh(postGeo(topY), this.mats.aluminum);
      post.position.set(GAUGE_POS.x + px, topY / 2, pz);
      post.castShadow = true;
      this.group.add(post);
    }

    // receiving bowl under the funnel
    const bowl = new THREE.Mesh(
      lathe(
        [
          [0.02, 0.0],
          [0.29, 0.02],
          [0.31, 0.1],
          [0.3, 0.1],
          [0.2, 0.03],
          [0.02, 0.012],
        ],
        40,
      ),
      this.mats.aluminum,
    );
    bowl.position.set(GAUGE_POS.x, 0.002, -0.06);
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    this.group.add(bowl);

    // --- gantry + glass chute ----------------------------------------------
    const gantry = new THREE.Group();
    const colGeo = new THREE.BoxGeometry(0.07, 1.52, 0.07);
    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(colGeo, this.mats.aluminum);
      col.position.set(GAUGE_POS.x + sx * 0.62, 0.76, -0.56);
      col.castShadow = true;
      gantry.add(col);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), this.mats.aluminumDark);
      foot.position.set(GAUGE_POS.x + sx * 0.62, 0.015, -0.56);
      gantry.add(foot);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.07, 0.07), this.mats.aluminum);
    beam.position.set(GAUGE_POS.x, 1.485, -0.56);
    beam.castShadow = true;
    gantry.add(beam);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.46), this.mats.aluminum);
    arm.position.set(GAUGE_POS.x, 1.46, -0.33);
    arm.castShadow = true;
    gantry.add(arm);
    // collar + strut actually holding the glass chute
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), this.mats.aluminum);
    strut.position.set(GAUGE_POS.x, 1.35, -0.12);
    gantry.add(strut);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.014, 8, 32), this.mats.aluminumDark);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(GAUGE_POS.x, 1.25, GAUGE_POS.z);
    gantry.add(collar);
    const collar2 = collar.clone();
    collar2.position.y = 0.93;
    gantry.add(collar2);
    const strut2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 0.035), this.mats.aluminum);
    strut2.position.set(GAUGE_POS.x, 1.09, -0.35);
    gantry.add(strut2);
    const strutArm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.24), this.mats.aluminum);
    strutArm.position.set(GAUGE_POS.x, 0.93, -0.24);
    gantry.add(strutArm);
    this.group.add(gantry);

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.235, 0.235, 0.34, 28, 1, true),
      this.mats.glass,
    );
    tube.position.set(GAUGE_POS.x, 1.08, GAUGE_POS.z);
    this.group.add(tube);
    for (const ty of [0.92, 1.24]) {
      const ringBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.245, 0.245, 0.03, 28, 1, true),
        this.mats.brass,
      );
      ringBand.position.set(GAUGE_POS.x, ty, GAUGE_POS.z);
      this.group.add(ringBand);
    }
    // feeder funnel (the wide mouth balls are carried to) — glass, so the
    // letter below stays readable through it
    const funnel = new THREE.Mesh(
      lathe(
        [
          [0.235, 0.0],
          [0.34, 0.14],
          [0.35, 0.15],
        ],
        28,
      ),
      this.mats.glass,
    );
    funnel.position.set(GAUGE_POS.x, 1.26, GAUGE_POS.z);
    this.group.add(funnel);
    const mouthRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.348, 0.012, 8, 32),
      this.mats.brass,
    );
    mouthRing.rotation.x = Math.PI / 2;
    mouthRing.position.set(GAUGE_POS.x, 1.41, GAUGE_POS.z);
    this.group.add(mouthRing);

    // feed gate flap under the waiting ball
    this.gateFlap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.012, 24),
      this.mats.blackSteelSlide,
    );
    this.gateFlap.position.set(GAUGE_POS.x, 1.255, GAUGE_POS.z);
    this.group.add(this.gateFlap);

    // --- release lever on the right column ---------------------------------
    this.lever = makePullLever(this.mats);
    this.lever.group.position.set(GAUGE_POS.x + 0.66, 1.06, -0.5);
    this.group.add(this.lever.group);
    this.attentionLights.lever = this.lever.attention;

    // --- weight handle ------------------------------------------------------
    this.handle = makeRailHandle(this.mats, 0.7, miniO(this.mats, 1), miniO(this.mats, 0.02));
    this.handle.group.position.set(0.42, 0, 0.58);
    this.group.add(this.handle.group);
    this.attentionLights.handle = this.handle.attention;

    // sync shaft from the handle to the drum (the mechanism's drive line)
    this.syncShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.42, 10),
      this.mats.blackSteelSlide,
    );
    this.syncShaft.rotation.z = Math.PI / 2;
    this.syncShaft.position.set(-0.06, 0.06, 0.58);
    this.group.add(this.syncShaft);
    const gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), this.mats.castIron);
    gearbox.position.set(-0.28, 0.065, 0.58);
    gearbox.castShadow = true;
    this.group.add(gearbox);
    const shaftToDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.24, 10),
      this.mats.blackSteelSlide,
    );
    shaftToDrum.rotation.x = Math.PI / 2;
    shaftToDrum.position.set(-0.28, 0.06, 0.44);
    this.group.add(shaftToDrum);

    // pass lamp on the gantry beam
    this.andon = makeAndon(this.mats);
    this.andon.group.position.set(GAUGE_POS.x - 0.62, 1.18, -0.52);
    this.group.add(this.andon.group);

    // front catch tray for rejected balls
    const tray = makeTray(this.mats, 0.5, 0.28);
    tray.position.set(-0.5, 0, 0.54);
    this.group.add(tray);

    this.views = {
      front: {
        pos: new THREE.Vector3(worldX - 0.1, 2.3, 2.05),
        target: new THREE.Vector3(worldX - 0.2, 0.38, -0.1),
      },
      threequarter: {
        pos: new THREE.Vector3(worldX + 1.45, 1.55, 1.45),
        target: new THREE.Vector3(worldX - 0.2, 0.4, -0.1),
      },
      operate: {
        pos: new THREE.Vector3(worldX + 0.35, 2.0, 2.0),
        target: new THREE.Vector3(worldX - 0.05, 0.32, 0.1),
      },
    };

    // --- input wiring -------------------------------------------------------
    input.register({
      hitMesh: this.handle.hitMesh,
      enabled: () => true,
      onDown: () => {
        this.dragStart = 1 - this.weight;
      },
      onDrag: (p) => {
        const v = 1 - clamp01(this.dragStart + p.dxPx / 280);
        if (Math.abs(v - this.weight) > 0.0005) {
          this.setAxis(v);
          this.audio.tick();
          this.events.onAxisInput(this.id);
          this.onWeightInput?.();
        }
      },
    });
    input.register({
      hitMesh: this.lever.hitMesh,
      enabled: () => this.ballStatus === 'inFeeder',
      onDrag: (p) => {
        const pull = clamp01(p.dyPx / 80);
        this.lever.setPull(pull);
        if (pull >= 1 && this.leverArmed) {
          this.leverArmed = false;
          this.releaseBall();
        }
      },
      onUp: (_p, wasTap) => {
        if (wasTap && this.leverArmed && this.ballStatus === 'inFeeder') {
          // a simple tap also fires — tiny hands welcome
          this.leverArmed = false;
          this.releaseBall();
        }
        this.lever.setPull(0);
      },
    });

    this.gauge.setWeight(this.weight);
    this.handle.setValue(1 - this.weight);
    this.loadBall('rubber');
  }

  getAxis() {
    return this.weight;
  }

  setAxis(v: number) {
    this.weight = clamp01(v);
    this.gauge.setWeight(this.weight);
    this.handle.setValue(1 - this.weight);
    this.syncShaft.rotation.x = this.weight * 14;
    // a ball resting on the iris falls through the moment the counter opens
    if (this.motion.kind === 'restOnIris' && this.ball && oBallPasses(this.weight, this.ball.spec.diameter)) {
      this.motion = { kind: 'fallThrough', vy: 0 };
      this.audio.gate();
      this.ballStatus = 'moving';
    }
  }

  loadBall(kind: BallKind) {
    this.loadedKind = kind;
    const b = this.newBall(kind);
    b.setPosition(this.feederPos.x, 1.268 + b.radius, this.feederPos.z);
    this.motion = { kind: 'feeder' };
    this.ballStatus = 'inFeeder';
    this.leverArmed = true;
  }

  pullLever(): boolean {
    if (this.ballStatus !== 'inFeeder') return false;
    this.releaseBall();
    return true;
  }

  private releaseBall() {
    if (!this.ball) return;
    this.audio.leverClack();
    this.gateOpen = 1;
    const passes = oBallPasses(this.weight, this.ball.spec.diameter);
    this.motion = { kind: 'fall', vy: 0, passes };
    this.ballStatus = 'moving';
    this.events.onLeverPulled(this.id);
  }

  controlWorldPos(kind: 'handle' | 'lever'): THREE.Vector3 {
    const v = new THREE.Vector3();
    (kind === 'handle' ? this.handle.hitMesh : this.lever.hitMesh).getWorldPosition(v);
    return v;
  }

  feederWorldPos(): THREE.Vector3 {
    return new THREE.Vector3(this.feederPos.x + this.worldX, 1.4, this.feederPos.z);
  }

  measure() {
    return {
      counterD: 2 * oCounterR(this.weight),
      ballD: this.ball?.spec.diameter ?? BALLS[this.loadedKind].diameter,
    };
  }

  /** world Y of the iris top surface at ring center */
  private irisTopY() {
    return GAUGE_POS.y + this.gauge.leafTopY * Math.cos(CANT);
  }

  update(dt: number) {
    this.updateAttention(dt);
    this.andon.update(dt);
    // gate flap animation
    this.gateOpen = damp(this.gateOpen, this.motion.kind === 'fall' ? 1 : 0, 10, dt);
    this.gateFlap.rotation.x = this.gateOpen * 1.5;
    this.gateFlap.position.z = GAUGE_POS.z - this.gateOpen * 0.17;

    const b = this.ball;
    if (!b) return;
    const m = this.motion;
    const r = b.radius;
    const g = 9.8;
    let rolling = false;

    switch (m.kind) {
      case 'fall': {
        m.vy -= g * dt;
        b.position.y += m.vy * dt;
        const hitY = this.irisTopY() + r;
        if (b.position.y <= hitY) {
          b.position.y = hitY;
          const speed = -m.vy;
          if (m.passes) {
            b.impact(speed * 0.15, 'steel');
            this.motion = { kind: 'fallThrough', vy: m.vy * 0.55 };
          } else {
            b.impact(speed, 'steel');
            const h = oCounterR(this.weight);
            const seat = Math.sqrt(Math.max(r * r - h * h, 0));
            b.position.set(GAUGE_POS.x, this.irisTopY() + seat, GAUGE_POS.z);
            if (b.spec.bounce >= 0.2) {
              // sit visibly on the too-small hole first — the comparison IS
              // the lesson — then roll away to the catch tray
              this.motion = { kind: 'seatBeat', t: 0, v: speed * b.spec.bounce * 0.45 };
              this.ballStatus = 'blocked';
              this.events.onResult(this.id, 'blocked');
            } else {
              // heavy ball simply seats in the counter mouth and stays
              this.motion = { kind: 'restOnIris' };
              this.ballStatus = 'blocked';
              this.events.onResult(this.id, 'blocked');
            }
            void h;
          }
        }
        break;
      }
      case 'bounceOut': {
        m.t += dt;
        const k = Math.min(1, m.t / m.dur);
        const s = k * k * 0.55 + k * 0.45; // eases in, speeds up on the way down
        m.curve.getPointAt(Math.min(s, 1), b.position);
        if (!m.hitDone && s > 0.42) {
          m.hitDone = true;
          b.impact(1.2, 'steel'); // touches the rim on the way over
        }
        if (k >= 1) {
          b.impact(1.6, 'felt');
          this.motion = { kind: 'restTray' };
          this.ballStatus = 'blocked';
          this.settleTimer = 0;
        }
        break;
      }
      case 'seatBeat': {
        m.t += dt;
        // two small decaying hops in place on the counter mouth
        const h2 = oCounterR(this.weight);
        const seatY = this.irisTopY() + Math.sqrt(Math.max(r * r - h2 * h2, 0));
        const hop = Math.abs(Math.sin(m.t * 11)) * m.v * 0.13 * Math.exp(-m.t * 2.2);
        b.position.y = seatY + hop;
        if (oBallPasses(this.weight, b.spec.diameter)) {
          this.motion = { kind: 'fallThrough', vy: 0 };
          this.audio.gate();
          this.ballStatus = 'moving';
          break;
        }
        if (m.t > 1.5) {
          const iy = this.irisTopY();
          const x = GAUGE_POS.x;
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(x, iy + r, GAUGE_POS.z),
            new THREE.Vector3(x - 0.05, iy + r + 0.13, GAUGE_POS.z + 0.14),
            new THREE.Vector3(x - 0.1, GAUGE_POS.y + 0.35 + r, GAUGE_POS.z + 0.4),
            new THREE.Vector3(x - 0.16, GAUGE_POS.y + 0.26 + r, GAUGE_POS.z + 0.54),
            new THREE.Vector3(x - 0.22, 0.3, GAUGE_POS.z + 0.6),
            new THREE.Vector3(x - 0.25, 0.045 + r, GAUGE_POS.z + 0.64),
          ]);
          this.motion = { kind: 'bounceOut', t: 0, dur: 1.0, curve, hitDone: false };
          this.ballStatus = 'moving';
        }
        break;
      }
      case 'restOnIris':
        break;
      case 'fallThrough': {
        m.vy -= g * dt;
        b.position.y += m.vy * dt;
        // drift toward the bowl center while falling through the funnel
        b.position.x = damp(b.position.x, GAUGE_POS.x, 4, dt);
        b.position.z = damp(b.position.z, -0.06, 4, dt);
        const bowlY = 0.045 + r;
        if (b.position.y <= bowlY) {
          b.position.y = bowlY;
          b.impact(-m.vy, 'steel');
          this.motion = { kind: 'settleBowl', vy: -m.vy * b.spec.bounce, bounces: 2 };
        }
        break;
      }
      case 'settleBowl': {
        m.vy -= g * dt;
        b.position.y += m.vy * dt;
        const bowlY = 0.045 + r;
        if (b.position.y <= bowlY) {
          b.position.y = bowlY;
          if (m.bounces > 0 && m.vy < -0.3) {
            b.impact(-m.vy * 0.7, 'steel');
            this.motion = { kind: 'settleBowl', vy: -m.vy * b.spec.bounce, bounces: m.bounces - 1 };
          } else {
            this.motion = { kind: 'restBowl' };
            this.ballStatus = 'passed';
            this.settleTimer = 0;
            this.andon.flash();
            this.events.onResult(this.id, 'pass');
          }
        }
        break;
      }
      case 'restBowl':
      case 'restTray': {
        this.settleTimer += dt;
        if (this.settleTimer > 3.2) {
          this.loadBall(this.loadedKind);
          this.events.onBallSettled(this.id);
        }
        break;
      }
      case 'feeder': {
        // waiting in the feeder — breathe very slightly so it reads as loose
        break;
      }
      default:
        break;
    }
    b.tick(dt, rolling);
    void clamp;
  }
}
