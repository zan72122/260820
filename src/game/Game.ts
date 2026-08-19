import * as THREE from 'three';
import { Engine } from '../core/Engine';
import { CameraDirector } from '../core/CameraDirector';
import { Input } from '../core/Input';
import { Audio } from '../core/Audio';
import { Environment } from '../world/Environment';
import { Field } from '../world/Field';
import { Harvester } from '../machine/Harvester';
import { Bale } from '../machine/Bale';
import { Particles } from '../fx/Particles';
import { fleck, puff } from '../world/textures';
import {
  COLS, DRIVE_SPEED, FIELD_L, FIELD_W, HEADER_HALF_W, HEADER_Z,
  HILLS_PER_BALE, LANES, LANE_W, ROWS, TURN_RATE, laneCenterX,
} from './constants';

/** how far outside the crop each pass starts and ends, so the header
 *  enters and leaves cleanly and no row is ever left standing */
const HEADROOM_Z = FIELD_L / 2 + 3.2;

type State =
  | 'title' | 'drive' | 'full' | 'wrap' | 'gate' | 'eject' | 'admire'
  | 'uturn' | 'cleared';

interface FieldBale {
  holder: THREE.Object3D;
  bale: Bale;
  vel: THREE.Vector3;
  omega: number;
  radius: number;
  settled: boolean;
  age: number;
}

export class Game {
  readonly engine: Engine;
  private dir: CameraDirector;
  private input: Input;
  private audio: Audio;
  private env: Environment;
  private field: Field;
  private machine: Harvester;
  private chaff: Particles;
  private dust: Particles;

  private hud: {
    setFill(f: number): void;
    setCount(n: number, bump?: boolean): void;
    caption(big: string, sub?: string): void;
    hideCaption(): void;
    action(label: string, kind: 'amber' | 'wrap', handler: () => void): void;
    hideAction(): void;
    hint(text: string): void;
    hideHint(): void;
    hideTitle(): void;
    fade(on: boolean): void;
  };

  /* --- machine state ------------------------------------------------ */
  private pos = new THREE.Vector3(0, 0, -FIELD_L / 2 - 3.2);
  private yaw = 0;
  private speed = 0;
  private zDir: 1 | -1 = 1;
  private sweep: 1 | -1 = 1;
  private targetX = laneCenterX(2);
  private forward = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3(1, 0, 0);
  private bob = 0;

  /* --- game state --------------------------------------------------- */
  state: State = 'title';
  private stateT = 0;
  private fill = 0;
  private hillsPerBale = HILLS_PER_BALE;
  private feed = 0;
  private wrapCoverage = 0;
  private gateOpen = 0;
  private cutaway = 0;
  private baleCount = 0;
  private bales: FieldBale[] = [];
  private ejected: FieldBale | null = null;
  private peek = 0;          // 0..1 "look inside" push-in during driving
  private peekTimer = 0;
  private peekMarks = [0.33, 0.66];
  private peekIdx = 0;
  private actionArmed = false;
  private restartT = 0;

  /* --- uturn -------------------------------------------------------- */
  private turnT = 0;
  private turnDur = 2.7;
  private turnFrom = new THREE.Vector3();
  private turnCtrl = new THREE.Vector3();
  private turnTo = new THREE.Vector3();
  private turnYaw0 = 0;
  private turnYaw1 = 0;

  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, hud: Game['hud'], audio: Audio) {
    this.hud = hud;
    this.audio = audio;
    this.engine = new Engine(canvas);
    this.engine.camera.userData.baseFov = this.engine.portrait ? 62 : 50;
    this.dir = new CameraDirector(this.engine.camera);
    this.input = new Input(canvas);

    const q = this.engine.quality;
    this.env = new Environment(this.engine.scene, this.engine.renderer, { shadows: q.shadows, shadowMapSize: q.shadowMapSize });
    this.field = new Field(this.engine.scene, q.riceDensity);
    this.machine = new Harvester(this.engine.scene, q.shadows);

    this.hillsPerBale = Math.max(24, Math.round(HILLS_PER_BALE * (this.field.total / (COLS * ROWS))));

    this.chaff = new Particles(this.engine.scene, fleck(), q.particles ? 380 : 40, -7.4, 1.7);
    this.dust = new Particles(this.engine.scene, puff(), q.particles ? 220 : 30, -1.6, 2.1);
    this.chaff.setPixelScale(window.innerHeight);
    this.dust.setPixelScale(window.innerHeight);
    window.addEventListener('resize', () => {
      this.chaff.setPixelScale(window.innerHeight);
      this.dust.setPixelScale(window.innerHeight);
      this.engine.camera.userData.baseFov = this.engine.portrait ? 62 : 50;
    });

    this.resetMachine();
    this.engine.onUpdate((dt, t) => this.update(dt, t));
  }

  start() {
    this.engine.start();
  }

  /** Leave the title card and start working. */
  begin() {
    this.hud.hideTitle();
    this.input.setBlocked(false);
    this.setState('drive');
    this.hud.caption('いねを あつめよう', 'ゆびで さわると すすむよ');
    this.dir.cut();
  }

  blockInput(v: boolean) {
    this.input.setBlocked(v);
  }

  /* ------------------------------------------------------------------ */

  private resetMachine() {
    this.pos.set(laneCenterX(2), 0, -HEADROOM_Z);
    this.targetX = laneCenterX(2);
    this.yaw = 0;
    this.zDir = 1;
    this.sweep = 1;
    this.speed = 0;
    this.updateBasis();
    this.applyTransform();
  }

  private updateBasis() {
    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  private applyTransform() {
    const g = this.machine.group;
    g.rotation.order = 'YXZ';
    g.position.set(this.pos.x, this.pos.y, this.pos.z);
    g.rotation.y = this.yaw;
  }

  private setState(s: State) {
    this.state = s;
    this.stateT = 0;
    this.actionArmed = false;
  }

  /* ------------------------------------------------------------------ */

  private update(dt: number, time: number) {
    this.stateT += dt;

    switch (this.state) {
      case 'title': this.updateTitle(dt); break;
      case 'drive': this.updateDrive(dt); break;
      case 'full': this.updateFull(dt); break;
      case 'wrap': this.updateWrap(dt); break;
      case 'gate': this.updateGate(dt); break;
      case 'eject': this.updateEject(dt); break;
      case 'admire': this.updateAdmire(dt); break;
      case 'uturn': this.updateTurn(dt); break;
      case 'cleared': this.updateCleared(dt); break;
    }

    // ---- world sim -------------------------------------------------
    this.updateBasis();
    this.applyTransform();

    this.machine.headerWorld(this.tmp);
    this.field.setHeader(this.tmp, 2.9);
    this.field.ingestTarget.copy(this.machine.throatMouth);
    this.field.update(dt, time);

    // roll room: it turns as long as crop is going in, and hard while wrapping
    const chamberSpin = this.state === 'wrap' ? 1.35 : 0.22 + this.feed * 1.05;
    this.machine.chamber.update(dt, chamberSpin);
    this.machine.chamber.setFill(this.fill);
    this.machine.chamber.setWrapCoverage(this.wrapCoverage);
    this.machine.update(dt, this.speed, this.feed, this.gateOpen, this.cutaway, time);

    this.updateFieldBales(dt);

    this.chaff.update(dt);
    this.dust.update(dt);
    this.env.followShadow(this.pos.x, this.pos.z);

    // ---- audio -----------------------------------------------------
    const throttle = this.state === 'title' ? 0.1 : Math.min(1, this.speed / DRIVE_SPEED) * 0.8 + this.feed * 0.3;
    this.audio.engine(throttle, this.feed);
    if (this.state !== 'eject' && this.state !== 'admire') this.audio.feed(this.feed);

    this.dir.update(dt);
    this.input.endFrame(dt);
    this.feed *= Math.exp(-4.2 * dt);
  }

  /* ---- title -------------------------------------------------------- */

  private updateTitle(dt: number) {
    this.speed = 0;
    const a = this.stateT * 0.16 + 0.9;
    const r = 13.5 * this.camK;
    this.camPos.set(this.pos.x + Math.sin(a) * r, 5.4 + Math.sin(a * 0.7) * 0.7, this.pos.z + Math.cos(a) * r);
    this.camLook.set(this.pos.x, 1.6, this.pos.z + 0.4);
    this.dir.aim(this.camPos, this.camLook, 52, 1.6);
    this.cutaway = 0;
    void dt;
  }

  /* ---- driving & harvesting ------------------------------------------ */

  private updateDrive(dt: number) {
    const held = this.input.held;

    // throttle: touch = go, release = coast to a stop
    const want = held ? DRIVE_SPEED : 0;
    const rate = held ? 1.6 : 2.6;
    this.speed += (want - this.speed) * Math.min(1, rate * dt);
    if (this.speed < 0.02) this.speed = 0;

    // steering: sliding the finger nudges the machine onto the next row,
    // then it snaps itself onto the row centre so nobody has to aim.
    if (held) {
      this.targetX += this.input.dragX * dt * 9.5;
    }
    this.targetX = THREE.MathUtils.clamp(this.targetX, -FIELD_W / 2 + LANE_W * 0.4, FIELD_W / 2 - LANE_W * 0.4);
    const lane = Math.round((this.targetX + FIELD_W / 2 - LANE_W / 2) / LANE_W);
    const snapX = laneCenterX(THREE.MathUtils.clamp(lane, 0, LANES - 1));
    this.targetX += (snapX - this.targetX) * Math.min(1, 2.2 * dt);

    const err = this.targetX - this.pos.x;
    const baseYaw = this.zDir === 1 ? 0 : Math.PI;
    const corr = THREE.MathUtils.clamp(err * 0.62, -0.46, 0.46) * this.zDir;
    const targetYaw = baseYaw + corr;
    this.yaw = this.approachAngle(this.yaw, targetYaw, TURN_RATE * dt);

    this.updateBasis();
    this.pos.addScaledVector(this.forward, this.speed * dt);

    // a machine this size never rides flat
    this.bob += dt * (2.4 + this.speed * 2.2);
    this.machine.group.rotation.x = Math.sin(this.bob * 1.7) * 0.012 * (0.3 + this.speed);
    this.machine.group.rotation.z = Math.sin(this.bob * 1.1 + 1.2) * 0.016 * (0.3 + this.speed);
    this.pos.y = Math.sin(this.bob * 2.3) * 0.012 * (0.2 + this.speed);

    this.harvestUnderHeader(dt);
    this.wheelDust(dt);

    if (this.speed > 0.4) this.dir.shake(0.006 + this.feed * 0.02);

    // ---- coaching --------------------------------------------------
    if (this.stateT > 2.6 && this.input.idleFor > 2.2 && !held) {
      this.hud.hint('ゆびで さわって すすもう');
    } else if (held) {
      this.hud.hideHint();
      if (this.stateT > 3.2) this.hud.hideCaption();
    }

    // ---- roll full? -------------------------------------------------
    if (this.fill >= 1) {
      this.fill = 1;
      this.setState('full');
      this.hud.hideHint();
      this.audio.chime();
      this.hud.caption('まるが できた！', 'しろく つつむよ');
      return;
    }

    // peek inside when the roll passes a milestone
    if (this.peekIdx < this.peekMarks.length && this.fill >= this.peekMarks[this.peekIdx]) {
      this.peekIdx++;
      this.peekTimer = 1.7;
    }
    this.peekTimer = Math.max(0, this.peekTimer - dt);
    const peekWant = this.peekTimer > 0 ? 1 : 0;
    this.peek += (peekWant - this.peek) * Math.min(1, 3.0 * dt);
    this.cutaway = this.peek * 0.55;

    // ---- end of the run? --------------------------------------------
    const limit = HEADROOM_Z;
    if (this.zDir === 1 ? this.pos.z > limit : this.pos.z < -limit) {
      this.beginTurn();
      return;
    }

    // ---- whole paddy cut? -------------------------------------------
    if (this.field.standingFraction < 0.012) {
      if (this.fill > 0.18) {
        this.fill = 1;
        this.setState('full');
        this.audio.chime();
        this.hud.caption('まるが できた！', 'しろく つつむよ');
      } else {
        this.setState('cleared');
        this.audio.chime();
        this.hud.caption('ぜんぶ かりとった！', 'また あたらしい たんぼへ');
      }
      return;
    }

    this.driveCamera();
  }

  /**
   * A phone held upright sees a very narrow slice of the world, so every
   * shot is pushed back (and slightly flattened) in portrait; otherwise
   * the machine alone fills the frame and the crop disappears.
   */
  private get camK() {
    return this.engine.portrait ? 1.46 : 1.0;
  }

  /** Aim the camera using machine-local offsets. */
  private aimLocal(
    ox: number, oy: number, oz: number,
    lx: number, ly: number, lz: number,
    fov: number, stiff: number, minY = 0.9
  ) {
    const k = this.camK;
    this.tmp.set(ox * (1 + (k - 1) * 0.32), 0.55 + (oy - 0.55) * (1 + (k - 1) * 0.5), oz * k);
    this.machine.group.localToWorld(this.tmp);
    this.tmp.y = Math.max(minY, this.tmp.y);
    this.tmp2.set(lx, ly, lz);
    this.machine.group.localToWorld(this.tmp2);
    this.dir.aim(this.tmp, this.tmp2, fov, stiff);
  }

  private approachAngle(cur: number, target: number, maxStep: number) {
    let d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return cur + THREE.MathUtils.clamp(d, -maxStep, maxStep);
  }

  private cutAccum = 0;

  private harvestUnderHeader(dt: number) {
    if (this.speed < 0.05) return;
    const cut = this.field.harvest(
      this.pos, this.forward, this.right,
      HEADER_HALF_W, HEADER_Z - 0.55, HEADER_Z + 0.75,
      (x, z) => this.spawnChaff(x, z)
    );
    if (cut > 0) {
      this.fill = Math.min(1, this.fill + cut / this.hillsPerBale);
      this.hud.setFill(this.fill);
      this.feed = Math.min(1, this.feed + cut * 0.34);
      this.cutAccum += cut;
      while (this.cutAccum >= 3) {
        this.cutAccum -= 3;
        this.audio.chomp(0.85 + Math.random() * 0.5);
      }
    }
    void dt;
  }

  private spawnChaff(x: number, z: number) {
    if (!this.engine.quality.particles) return;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const up = 1.6 + Math.random() * 2.4;
      this.chaff.emit(
        x + (Math.random() - 0.5) * 0.4,
        0.45 + Math.random() * 0.7,
        z + (Math.random() - 0.5) * 0.4,
        -this.forward.x * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 1.8,
        up,
        -this.forward.z * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 1.8,
        0.055 + Math.random() * 0.05,
        0.5 + Math.random() * 0.5,
        0.86 + Math.random() * 0.14, 0.78 + Math.random() * 0.16, 0.42 + Math.random() * 0.2,
        (Math.random() - 0.5) * 12
      );
    }
    if (Math.random() < 0.22) {
      this.dust.emit(
        x, 0.25, z,
        (Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6,
        0.5 + Math.random() * 0.5, 0.8 + Math.random() * 0.6,
        0.68, 0.6, 0.46
      );
    }
  }

  private dustT = 0;

  private wheelDust(dt: number) {
    if (!this.engine.quality.particles || this.speed < 0.5) return;
    this.dustT += dt * this.speed;
    while (this.dustT > 0.14) {
      this.dustT -= 0.14;
      for (const sx of [-1, 1]) {
        this.tmp.set(sx * 1.16, 0.12, -1.95);
        this.machine.group.localToWorld(this.tmp);
        this.dust.emit(
          this.tmp.x, this.tmp.y, this.tmp.z,
          -this.forward.x * 0.8 + (Math.random() - 0.5) * 0.5,
          0.5 + Math.random() * 0.4,
          -this.forward.z * 0.8 + (Math.random() - 0.5) * 0.5,
          0.55 + Math.random() * 0.5, 1.0 + Math.random() * 0.7,
          0.62, 0.55, 0.42
        );
      }
    }
  }

  /** The working shot: over the left shoulder, header and window both in view. */
  private driveCamera() {
    const p = this.peek;
    const L = THREE.MathUtils.lerp;
    this.aimLocal(
      L(-4.35, -4.6, p), L(3.45, 2.5, p), L(-7.6, -3.7, p),
      L(0.1, -0.5, p), L(1.7, 1.62, p), L(2.3, -1.95, p),
      L(52, 40, p), 3.0, 1.5
    );
  }

  /* ---- u-turn --------------------------------------------------------- */

  private beginTurn() {
    // pick the nearest lane that still has crop, preferring the sweep way
    const cur = THREE.MathUtils.clamp(
      Math.round((this.pos.x + FIELD_W / 2 - LANE_W / 2) / LANE_W), 0, LANES - 1
    );
    let next = -1;
    for (let step = 1; step <= LANES; step++) {
      const a = cur + step * this.sweep;
      if (a >= 0 && a < LANES && this.field.laneHasCrop(laneCenterX(a), LANE_W * 0.5)) { next = a; break; }
      const b = cur - step * this.sweep;
      if (b >= 0 && b < LANES && this.field.laneHasCrop(laneCenterX(b), LANE_W * 0.5)) {
        next = b;
        this.sweep = (this.sweep === 1 ? -1 : 1);
        break;
      }
    }
    if (next < 0) {
      // nothing left anywhere — finish the roll or celebrate
      if (this.fill > 0.18) {
        this.fill = 1;
        this.setState('full');
        this.audio.chime();
        this.hud.caption('まるが できた！', 'しろく つつむよ');
      } else {
        this.setState('cleared');
        this.audio.chime();
        this.hud.caption('ぜんぶ かりとった！', 'また あたらしい たんぼへ');
      }
      return;
    }

    const endZ = this.zDir * HEADROOM_Z;
    this.turnFrom.copy(this.pos);
    this.turnTo.set(laneCenterX(next), 0, endZ);
    this.turnCtrl.set(
      (this.turnFrom.x + this.turnTo.x) * 0.5,
      0,
      this.zDir * (HEADROOM_Z + 2.8)
    );
    this.turnYaw0 = this.yaw;
    const side = Math.sign(this.turnTo.x - this.turnFrom.x) || 1;
    this.turnYaw1 = this.turnYaw0 + Math.PI * (this.zDir === 1 ? side : -side);
    this.turnT = 0;
    this.turnDur = 2.6;
    this.setState('uturn');
    this.hud.hideHint();
    this.hud.caption('つぎの れつへ', 'ぐるっと まわるよ');
  }

  private updateTurn(dt: number) {
    this.turnT = Math.min(1, this.turnT + dt / this.turnDur);
    const t = this.turnT;
    const e = t * t * (3 - 2 * t);
    const mt = 1 - e;
    this.pos.set(
      mt * mt * this.turnFrom.x + 2 * mt * e * this.turnCtrl.x + e * e * this.turnTo.x,
      0,
      mt * mt * this.turnFrom.z + 2 * mt * e * this.turnCtrl.z + e * e * this.turnTo.z
    );
    this.yaw = this.turnYaw0 + (this.turnYaw1 - this.turnYaw0) * e;
    this.speed = DRIVE_SPEED * 0.62 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    this.cutaway *= Math.exp(-3 * dt);
    this.wheelDust(dt);

    // pull out wide so the shape of the paddy and the cut rows read
    this.aimLocal(-7.2, 6.3, -9.0, 0, 1.2, 3.0, 58, 2.1, 4.0);

    if (t >= 1) {
      this.zDir = (this.zDir === 1 ? -1 : 1);
      this.targetX = this.turnTo.x;
      this.yaw = this.zDir === 1 ? 0 : Math.PI;
      this.setState('drive');
      this.hud.caption('つづけて かりとろう', '');
    }
  }

  /* ---- full -> wrap --------------------------------------------------- */

  private updateFull(dt: number) {
    this.speed *= Math.exp(-3.4 * dt);
    this.pos.addScaledVector(this.forward, this.speed * dt);
    this.cutaway += (0.3 - this.cutaway) * Math.min(1, 2.6 * dt);

    this.aimLocal(-5.6, 2.4, -2.5, -0.5, 1.62, -1.95, 42, 2.4, 1.0);

    if (!this.actionArmed && this.stateT > 0.7) {
      this.actionArmed = true;
      this.hud.action('まく', 'wrap', () => this.beginWrap());
    }
    // never a dead end: it starts itself if nobody presses
    if (this.stateT > 5.0) this.beginWrap();
    if (this.input.tapped && this.stateT > 0.7) this.beginWrap();
  }

  private beginWrap() {
    if (this.state !== 'full') return;
    this.hud.hideAction();
    this.hud.caption('ぐるぐる まいて…', 'しろい フィルムで つつむ');
    this.setState('wrap');
    this.audio.wrapping(true);
    this.audio.click();
    this.speed = 0;
  }

  private updateWrap(dt: number) {
    this.speed = 0;
    this.wrapCoverage = Math.min(1, this.wrapCoverage + dt / 3.4);
    this.cutaway = 1;
    this.audio.wrapPitch(this.wrapCoverage);

    // Dissolve the flank and watch the film actually go round the barrel,
    // pushing in as the white creeps out to the shoulders.
    const k = THREE.MathUtils.smoothstep(this.stateT, 0.1, 2.6);
    this.aimLocal(
      THREE.MathUtils.lerp(-4.7, -4.0, k),
      THREE.MathUtils.lerp(5.7, 5.0, k),
      THREE.MathUtils.lerp(-7.2, -6.2, k),
      0, 1.8, -1.95,
      THREE.MathUtils.lerp(38, 33, k), 2.0, 1.6
    );

    if (this.wrapCoverage >= 1 && this.stateT > 1.2) {
      this.audio.wrapping(false);
      this.setState('gate');
      this.hud.caption('うしろの とびらを あけよう', 'うえに スワイプ！');
    }
  }

  /* ---- open the gate, roll it out ------------------------------------- */

  private updateGate(dt: number) {
    this.speed = 0;
    this.cutaway += (0.35 - this.cutaway) * Math.min(1, 2.4 * dt);

    // rear three-quarter, low, so the gate and the ground behind are visible
    this.aimLocal(-2.2, 2.35, -6.2, 0, 1.6, -3.2, 52, 2.4, 1.45);

    if (!this.actionArmed && this.stateT > 0.5) {
      this.actionArmed = true;
      this.hud.action('あける', 'amber', () => this.beginEject());
      this.hud.hint('うえに スワイプ');
    }
    if (this.input.swipedUp || this.input.tapped) this.beginEject();
    if (this.stateT > 5.5) this.beginEject();
  }

  private beginEject() {
    if (this.state !== 'gate') return;
    this.hud.hideAction();
    this.hud.hideHint();
    this.hud.caption('ゴロン！', '');
    this.setState('eject');
    this.audio.gate();
    this.audio.click();
  }

  private updateEject(dt: number) {
    this.speed = 0;
    const t = this.stateT;
    // gate swings up over 1.1s, the roll is let go at 0.8s
    this.gateOpen = THREE.MathUtils.clamp(t / 1.1, 0, 1);
    this.cutaway *= Math.exp(-2.5 * dt);

    if (t > 0.8 && !this.ejected) this.releaseBale();

    // rear shot, dropping to ground level as the bale comes out
    const k = THREE.MathUtils.clamp((t - 0.6) / 1.2, 0, 1);
    const camK = this.camK;
    this.tmp.set(
      -2.1 * (1 + (camK - 1) * 0.32),
      THREE.MathUtils.lerp(2.35, 1.55, k),
      THREE.MathUtils.lerp(-6.2, -7.0, k) * camK
    );
    this.machine.group.localToWorld(this.tmp);
    this.tmp.y = Math.max(1.45, this.tmp.y);
    if (this.ejected) {
      this.tmp2.copy(this.ejected.holder.position);
      this.tmp2.y += 0.45;
    } else {
      this.tmp2.set(0, 1.4, -3.2);
      this.machine.group.localToWorld(this.tmp2);
    }
    this.dir.aim(this.tmp, this.tmp2, THREE.MathUtils.lerp(52, 46, k), 2.6);

    if (this.ejected && this.ejected.age > 1.4 && this.ejected.vel.lengthSq() < 0.35) {
      this.setState('admire');
      this.hud.caption('できあがり！', 'つぎの いねを あつめよう');
    }
    if (t > 8) {
      this.setState('admire');
    }
  }

  private releaseBale() {
    const chamber = this.machine.chamber;
    const released = chamber.releaseBale();
    this.wrapCoverage = 0;
    this.fill = 0;
    this.hud.setFill(0);

    // world transform of the roll at the moment it is let go
    this.tmp.set(0, 0, 0);
    this.machine.chamber.group.localToWorld(this.tmp);

    const holder = new THREE.Object3D();
    holder.position.copy(this.tmp);
    holder.rotation.y = this.yaw;
    holder.add(released.group);
    released.group.position.set(0, 0, 0);
    this.engine.scene.add(holder);

    const r = released.radius;
    const fb: FieldBale = {
      holder,
      bale: released,
      vel: new THREE.Vector3(
        -this.forward.x * 2.35 + (Math.random() - 0.5) * 0.2,
        -0.6,
        -this.forward.z * 2.35 + (Math.random() - 0.5) * 0.2
      ),
      omega: 0,
      radius: r,
      settled: false,
      age: 0,
    };
    this.ejected = fb;
    this.bales.push(fb);
    while (this.bales.length > 7) {
      const old = this.bales.shift()!;
      this.engine.scene.remove(old.holder);
      old.bale.dispose();
    }

    this.baleCount++;
    this.hud.setCount(this.baleCount, true);
    this.audio.chime();
    this.dir.shake(0.09);
  }

  private updateFieldBales(dt: number) {
    for (const b of this.bales) {
      b.age += dt;
      if (b.settled) continue;
      b.vel.y -= 11.5 * dt;
      b.holder.position.addScaledVector(b.vel, dt);
      const floor = b.radius;
      if (b.holder.position.y <= floor) {
        const impact = -b.vel.y;
        b.holder.position.y = floor;
        if (impact > 1.2) {
          b.vel.y = impact * 0.24;
          this.audio.thud(Math.min(1, impact / 6));
          this.dir.shake(Math.min(0.14, impact * 0.02));
          this.baleDust(b);
        } else {
          b.vel.y = 0;
        }
        // rolling friction on soft ground
        const damp = Math.exp(-1.35 * dt);
        b.vel.x *= damp;
        b.vel.z *= damp;
      }
      const horiz = Math.hypot(b.vel.x, b.vel.z);
      b.omega = horiz / b.radius;
      // it rolls about its own axis, which is the machine's lateral axis
      const along = new THREE.Vector3(b.vel.x, 0, b.vel.z);
      const fwd = new THREE.Vector3(Math.sin(b.holder.rotation.y), 0, Math.cos(b.holder.rotation.y));
      const sign = along.dot(fwd) >= 0 ? 1 : -1;
      b.bale.group.rotation.x += b.omega * dt * sign;
      if (horiz < 0.12 && b.holder.position.y <= floor + 0.001) {
        b.settled = true;
        b.vel.set(0, 0, 0);
      }
      if (horiz > 0.35 && this.engine.quality.particles && Math.random() < 0.5) {
        this.dust.emit(
          b.holder.position.x + (Math.random() - 0.5) * 0.8,
          0.12,
          b.holder.position.z + (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.7, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.7,
          0.6 + Math.random() * 0.5, 0.9 + Math.random() * 0.6,
          0.66, 0.58, 0.44
        );
      }
      if (horiz > 0.25) this.audio.rollRumble(Math.min(1, horiz / 2.4));
    }
  }

  private baleDust(b: FieldBale) {
    if (!this.engine.quality.particles) return;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.4 + Math.random() * 2.4;
      this.dust.emit(
        b.holder.position.x + Math.cos(a) * b.radius * 0.8,
        0.1,
        b.holder.position.z + Math.sin(a) * b.radius * 0.8,
        Math.cos(a) * s, 0.7 + Math.random() * 1.1, Math.sin(a) * s,
        0.8 + Math.random() * 0.9, 1.1 + Math.random() * 0.8,
        0.7, 0.62, 0.48
      );
    }
  }

  /* ---- admire and go again -------------------------------------------- */

  private updateAdmire(dt: number) {
    this.speed = 0;
    this.gateOpen = Math.max(0, this.gateOpen - dt * 0.75);
    this.cutaway *= Math.exp(-2.5 * dt);

    const b = this.ejected;
    if (b) {
      const a = this.stateT * 0.42;
      const orbit = 4.0 * this.camK;
      this.camPos.set(
        b.holder.position.x + Math.sin(a + this.yaw + Math.PI) * orbit,
        1.8 + Math.sin(a * 0.6) * 0.25,
        b.holder.position.z + Math.cos(a + this.yaw + Math.PI) * orbit
      );
      this.camLook.copy(b.holder.position);
      this.camLook.y += 0.2;
      this.dir.aim(this.camPos, this.camLook, 44, 2.8);
    }

    if (this.stateT > 1.2 && !this.actionArmed) {
      this.actionArmed = true;
      this.hud.action('つぎへ', 'amber', () => this.resume());
    }
    // A finger left resting on the screen must not skip the pay-off shot.
    if (this.stateT > 4.2 || (this.stateT > 1.4 && this.input.tapped)) this.resume();
  }

  private resume() {
    if (this.state !== 'admire') return;
    this.hud.hideAction();
    this.ejected = null;
    this.gateOpen = 0;
    this.peekIdx = 0;
    this.peekTimer = 0;
    if (this.field.standingFraction < 0.012) {
      this.setState('cleared');
      this.hud.caption('ぜんぶ かりとった！', 'また あたらしい たんぼへ');
      this.audio.chime();
      return;
    }
    this.setState('drive');
    this.hud.caption('つぎの いねを あつめよう', 'ゆびで さわって すすもう');
  }

  /* ---- paddy finished --------------------------------------------------- */

  private updateCleared(dt: number) {
    this.speed *= Math.exp(-2.5 * dt);
    this.pos.addScaledVector(this.forward, this.speed * dt);
    this.gateOpen = Math.max(0, this.gateOpen - dt * 0.8);
    this.cutaway *= Math.exp(-2 * dt);

    const a = this.stateT * 0.28;
    const r = 19 * this.camK;
    this.camPos.set(Math.sin(a) * r, 10.5, Math.cos(a) * r - 2);
    this.camLook.set(0, 1.0, 0);
    this.dir.aim(this.camPos, this.camLook, 60, 1.4);

    this.restartT += dt;
    if (this.restartT > 2.6) this.hud.fade(true);
    if (this.restartT > 3.3) {
      this.restartT = 0;
      this.field.plant();
      for (const b of this.bales) {
        this.engine.scene.remove(b.holder);
        b.bale.dispose();
      }
      this.bales.length = 0;
      this.ejected = null;
      this.baleCount = 0;
      this.hud.setCount(0);
      this.fill = 0;
      this.hud.setFill(0);
      this.wrapCoverage = 0;
      this.peekIdx = 0;
      this.resetMachine();
      this.dir.cut();
      this.hud.fade(false);
      this.setState('drive');
      this.hud.caption('あたらしい たんぼ！', 'また あつめよう');
    }
  }

  /* ---- test / debug surface --------------------------------------------- */

  debugState() {
    return {
      state: this.state,
      fill: this.fill,
      bales: this.baleCount,
      standing: this.field.standingFraction,
      pos: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
      speed: this.speed,
      gate: this.gateOpen,
      wrap: this.wrapCoverage,
      chamberRadius: this.machine.chamber.radius,
      fieldBales: this.bales.length,
    };
  }

  /** Drive the machine from a test without touching the DOM. */
  testHold(v: boolean) {
    this.input.forceHold(v);
  }

  testSwipeUp() {
    this.input.forceSwipeUp();
  }

  advance(seconds: number) {
    this.engine.advance(seconds);
  }

  /** Simulation only, no drawing — lets a test play a whole paddy quickly. */
  testFastForward(seconds: number) {
    this.engine.stop();
    this.engine.advance(seconds, 1 / 30, false);
  }

  testResumeLoop() {
    this.engine.start();
  }
}
