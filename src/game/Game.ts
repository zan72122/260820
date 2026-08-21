import * as THREE from 'three';
import { clamp, clamp01, damp, distToSegmentXZ, lerp } from '../util/math';
import { blobTexture, crossTexture, markingTexture } from '../util/textures';
import { DigSite } from '../dig/DigSite';
import { distanceToPipesXZ } from '../dig/Pipes';
import { Environment, buildSky } from '../scene/Environment';
import { PATCH_LIFT } from '../util/ground';
import { Truck } from '../scene/Truck';
import { Worker } from '../scene/Worker';
import { Hose } from '../scene/Hose';
import { Detector, DepthRod, VacuumNozzle, WaterLance, ToolBase } from '../scene/Tools';
import { GroundDecal, MODE_ATTRACT, MODE_BALLISTIC, ParticlePool, WaterJet } from '../fx/Effects';
import { CameraDirector, SHOTS } from './CameraDirector';
import { SITES } from './Sites';
import { Input } from '../core/Input';
import { AudioEngine } from '../core/Audio';
import { Hud, GestureKind } from '../core/Hud';
import { QualitySettings } from '../core/Quality';

type Phase =
  | 'intro'
  | 'detect'
  | 'mark'
  | 'water'
  | 'vacuum'
  | 'reveal'
  | 'depth'
  | 'cutaway'
  | 'handoff'
  | 'finale';

type ToolId = 'detector' | 'lance' | 'nozzle' | 'rod' | 'none';

const HOSE_RADIUS = 0.085;
const WATER_READY = 0.1;
const WET_EXHAUSTED = 0.02;

export class Game {
  readonly scene = new THREE.Scene();
  readonly director = new CameraDirector();

  private env: Environment;
  private truck: Truck;
  private worker: Worker;
  private detector = new Detector();
  private lance = new WaterLance();
  private nozzle: VacuumNozzle;
  private rod = new DepthRod();
  private vacHose: Hose;
  private waterHose: Hose;
  private soilFx: ParticlePool;
  private dropFx: ParticlePool;
  private jet = new WaterJet();
  private sites: DigSite[] = [];
  private crossDecals: GroundDecal[] = [];
  private markDecals: GroundDecal[] = [];
  private sensorShadow: GroundDecal;
  private cutawayGroup = new THREE.Group();

  private input: Input;
  private audio: AudioEngine;
  private hud: Hud;

  phase: Phase = 'intro';
  private tool: ToolId = 'none';
  private siteIndex = 0;
  private phaseTime = 0;
  private swapTime = -1;
  private swapDuration = 1.15;
  private swapNext: Phase = 'detect';
  private swapTool: ToolId = 'none';
  private exposing = false;
  private lockTimer = 0;
  private waterHeld = 0;
  private rodHold = 0;
  private rodTipY = 0;
  private detectorPeaked = false;
  /** Current locator response, 0..1. Also read by the automated play-through. */
  detectSignal = 0;
  private clock = 0;
  private particleScale = 1;

  private detectPos = new THREE.Vector3();
  private detectTarget = new THREE.Vector3();
  private workPoint = new THREE.Vector3();
  private toolPoint = new THREE.Vector3();
  private markPoint = new THREE.Vector3();
  private revealPoint = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmp3 = new THREE.Vector3();
  private handL = new THREE.Vector3();
  private handR = new THREE.Vector3();
  private soilColor = new THREE.Color();
  private waterColor = new THREE.Color(1, 1, 1);
  private projected = new THREE.Vector3();
  private boomTarget = new THREE.Vector3();
  private anchorA = new THREE.Vector3();
  private anchorB = new THREE.Vector3();
  private anchorC = new THREE.Vector3();
  private anchorD = new THREE.Vector3();
  private anchorE = new THREE.Vector3();

  constructor(input: Input, audio: AudioEngine, hud: Hud, quality: number) {
    this.input = input;
    this.audio = audio;
    this.hud = hud;

    this.scene.fog = new THREE.Fog(0xc4d2df, 17, 44);
    this.scene.add(buildSky());

    this.env = new Environment(
      quality,
      SITES.map((c) => ({ x: c.origin.x, z: c.origin.z, size: c.size }))
    );
    this.scene.add(this.env.group);

    this.truck = new Truck(quality);
    this.scene.add(this.truck.group);

    this.worker = new Worker();
    this.scene.add(this.worker.group);

    this.nozzle = new VacuumNozzle(HOSE_RADIUS);
    for (const t of [this.detector, this.lance, this.nozzle, this.rod]) this.scene.add(t.group);

    this.vacHose = new Hose({
      points: 34,
      radius: HOSE_RADIUS,
      tubular: 46,
      radial: quality >= 1 ? 10 : 7,
      ribs: quality >= 1 ? 24 : 14,
      slackA: 1.04,
      slackB: 1.08,
      gravity: 9.0,
    });
    this.waterHose = new Hose({
      points: 26,
      radius: 0.022,
      tubular: 34,
      radial: 6,
      ribs: 0,
      slackA: 1.04,
      slackB: 1.13,
      color: 0x8d3a2c,
      gravity: 7.0,
    });
    this.scene.add(this.vacHose.group, this.waterHose.group);
    const groundFn = (x: number, z: number) => this.groundHeight(x, z);
    this.vacHose.setGroundFn(groundFn);
    this.waterHose.setGroundFn(groundFn);

    this.scene.add(this.jet.group);
    this.jet.setVisible(false);

    // ---- excavation sites -------------------------------------------------
    SITES.forEach((cfg) => {
      const dig = new DigSite({
        origin: cfg.origin,
        size: cfg.size,
        resolution: quality >= 1 ? 61 : 45,
        soil: cfg.soil,
        pipes: cfg.pipes,
        quality,
      });
      this.sites.push(dig);
      this.scene.add(dig.group);

      const cross = new GroundDecal(crossTexture(128), 0.5, 0.5, 0.92);
      this.crossDecals.push(cross);
      this.scene.add(cross.mesh);

      for (const m of cfg.markings) {
        const d = new GroundDecal(markingTexture(m.color, m.dashed, 256), m.length, 0.17, 0.44);
        d.place(cfg.origin.x + m.x, 0.014, cfg.origin.z + m.z, m.rot);
        d.show(true);
        this.markDecals.push(d);
        this.scene.add(d.mesh);
      }
    });

    this.sensorShadow = new GroundDecal(blobTexture(64, 0.35), 0.46, 0.28, 0.4);
    (this.sensorShadow.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x241d12);
    this.scene.add(this.sensorShadow.mesh);

    // ---- particles --------------------------------------------------------
    const grain = new THREE.IcosahedronGeometry(0.5, 0);
    this.soilFx = new ParticlePool(
      grain,
      new THREE.MeshStandardMaterial({ color: 0x6d5941, roughness: 1, metalness: 0, flatShading: true }),
      260
    );
    this.dropFx = new ParticlePool(
      grain,
      new THREE.MeshStandardMaterial({ color: 0x9cc2d6, roughness: 0.22, metalness: 0, flatShading: true }),
      110
    );
    this.scene.add(this.soilFx.mesh, this.dropFx.mesh);

    this.buildCutaway();
    this.scene.add(this.cutawayGroup);
    this.cutawayGroup.visible = false;

    this.workPoint.copy(SITES[0].origin);
    this.detectPos.set(
      SITES[0].origin.x + SITES[0].scanStart.x,
      0,
      SITES[0].origin.z + SITES[0].scanStart.y
    );
    this.detectTarget.copy(this.detectPos);
    this.worker.place(
      new THREE.Vector3(this.detectPos.x + 0.6, 0, this.detectPos.z - 0.45),
      this.detectPos,
      0.1
    );
    this.worker.snap();
    this.parkAll();
    this.vacHose.reset(
      this.truck.reelWorld(this.tmp).clone(),
      this.truck.boomTipWorld(this.tmp2).clone(),
      this.nozzle.inletWorld(this.tmp3).clone()
    );
    this.director.setShot(SHOTS.establish(), new THREE.Vector3(1.3, 0, 0.2), true);
  }

  // ------------------------------------------------------------------ setup

  private cutawayDir = new THREE.Vector3(-0.9, 0.45, -0.3).normalize();
  private cutawayAside = new THREE.Vector3();

  /**
   * A short section view unlocked only after the first pipe has been found:
   * a translucent slice through the ground with the run continuing past the
   * hole in both directions.
   */
  private buildCutaway() {
    const cfg = SITES[0];
    const pipe = cfg.pipes[0];
    const axis = new THREE.Vector3().subVectors(pipe.b, pipe.a).setY(0).normalize();
    // look square-on to the run, from the lot side
    const perp = new THREE.Vector3(-axis.z, 0, axis.x);
    if (perp.z > 0) perp.negate();
    this.cutawayDir.copy(perp).setY(0.5).normalize();
    this.cutawayAside.copy(perp).multiplyScalar(-1.9);

    const centre = new THREE.Vector3(cfg.origin.x, pipe.a.y, cfg.origin.z);

    const slice = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.95),
      new THREE.MeshBasicMaterial({
        color: 0x4c3c28,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      })
    );
    slice.renderOrder = 20;
    slice.position.copy(centre).setY(-0.5);
    slice.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), perp);
    this.cutawayGroup.add(slice);

    const ghost = new THREE.Mesh(
      new THREE.CylinderGeometry(pipe.radius, pipe.radius, 2.6, 18),
      new THREE.MeshStandardMaterial({
        color: 0x4c8cb4,
        roughness: 0.5,
        metalness: 0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      })
    );
    ghost.renderOrder = 21;
    ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    ghost.position.copy(centre);
    this.cutawayGroup.add(ghost);

    // the grade line, so the buried depth is legible at a glance
    const grade = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.01),
      new THREE.MeshBasicMaterial({
        color: 0xe8e2d4,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      })
    );
    grade.renderOrder = 22;
    grade.position.copy(centre).setY(0.01);
    grade.quaternion.copy(slice.quaternion);
    this.cutawayGroup.add(grade);
  }

  private parkAll() {
    this.detector.setVisible(false);
    this.lance.setVisible(false);
    this.nozzle.setVisible(true);
    this.rod.setVisible(false);
    this.waterHose.setVisible(false);
    const p = this.parkSpot('nozzle');
    this.nozzle.aim(p, this.tmp2.set(p.x + 0.6, 0, p.z + 0.6), 0.9, 0, true);
  }

  private parkSpot(tool: ToolId): THREE.Vector3 {
    const o = SITES[this.siteIndex].origin;
    // parked clear of the patch, so nothing lies across the work
    const offsets: Record<ToolId, [number, number]> = {
      detector: [1.62, 1.5],
      lance: [1.15, 1.72],
      nozzle: [-1.62, 1.44],
      rod: [1.78, 1.0],
      none: [0, 0],
    };
    const [dx, dz] = offsets[tool];
    return this.tmp.set(o.x + dx, this.groundHeight(o.x + dx, o.z + dz) + 0.06, o.z + dz);
  }

  private groundHeight(x: number, z: number): number {
    for (const s of this.sites) {
      if (s.contains(x, z, 0.02)) return s.surfaceY(x, z);
    }
    return PATCH_LIFT;
  }

  get activeSite(): DigSite {
    return this.sites[this.siteIndex];
  }

  applyQuality(q: QualitySettings) {
    this.particleScale = q.particleScale;
    this.soilFx.setCapacity(Math.round(260 * q.particleScale));
    this.dropFx.setCapacity(Math.round(110 * q.particleScale));
    this.env.applyQuality(q.shadowSize >= 2048 ? 2 : q.shadowSize >= 1024 ? 1 : 0, q.farProps);
  }

  // ------------------------------------------------------------------ input

  /** Ground point under the finger, clamped into the current patch. */
  private fingerOnSite(pad: number, out: THREE.Vector3): boolean {
    const site = SITES[this.siteIndex];
    const half = site.size / 2 - pad;
    // Converge onto the excavated surface rather than a flat plane: a fixed
    // plane makes the tool drift outward as the hole deepens.
    let planeY = this.groundHeight(this.workPoint.x, this.workPoint.z);
    for (let i = 0; i < 3; i++) {
      if (!this.input.worldOnPlane(this.director.camera, planeY, out)) return false;
      out.x = clamp(out.x, site.origin.x - half, site.origin.x + half);
      out.z = clamp(out.z, site.origin.z - half, site.origin.z + half);
      const next = this.groundHeight(out.x, out.z);
      if (Math.abs(next - planeY) < 0.004) break;
      planeY = next;
    }
    return true;
  }

  private beginSwap(next: Phase, tool: ToolId, duration = 1.15) {
    if (this.swapTime >= 0) return;
    this.swapTime = 0;
    this.swapDuration = duration;
    this.swapNext = next;
    this.swapTool = tool;
    this.input.cancel();
    this.audio.setWater(false, this.workPoint);
    this.audio.setVacuum(0, this.workPoint);
    this.audio.setDetector(false, 0, this.workPoint);
    this.jet.setVisible(false);
  }

  private get busy() {
    return this.swapTime >= 0;
  }

  private toolOf(id: ToolId): ToolBase | null {
    switch (id) {
      case 'detector':
        return this.detector;
      case 'lance':
        return this.lance;
      case 'nozzle':
        return this.nozzle;
      case 'rod':
        return this.rod;
      default:
        return null;
    }
  }

  // ------------------------------------------------------------------ loop

  update(dt: number) {
    this.clock += dt;
    this.input.beginFrame(dt);

    if (this.busy) this.updateSwap(dt);
    else {
      this.phaseTime += dt;
      switch (this.phase) {
        case 'intro':
          this.updateIntro();
          break;
        case 'detect':
          this.updateDetect(dt);
          break;
        case 'mark':
          this.updateMark(dt);
          break;
        case 'water':
          this.updateWater(dt);
          break;
        case 'vacuum':
          this.updateVacuum(dt);
          break;
        case 'reveal':
          this.updateReveal(dt);
          break;
        case 'depth':
          this.updateDepth(dt);
          break;
        case 'cutaway':
          this.updateCutaway(dt);
          break;
        case 'handoff':
          this.updateHandoff(dt);
          break;
        case 'finale':
          this.updateFinale();
          break;
      }
    }

    this.updateRig(dt);
    for (const s of this.sites) s.update(dt);
    this.soilFx.update(dt, this.nozzle.inletWorld(this.tmp3), (x, z) => this.groundHeight(x, z));
    this.dropFx.update(dt, null, (x, z) => this.groundHeight(x, z));
    for (const d of this.crossDecals) d.update(dt);
    for (const d of this.markDecals) d.update(dt);
    this.sensorShadow.update(dt);
    this.env.focusShadows(this.workPoint);
    this.director.update(dt);
    this.audio.setListener(this.director.camera);
    this.audio.setEnginePosition(this.truck.group.position);
    this.audio.setHydraulic(clamp01(this.truck.motion * 0.35), this.truck.boomTipWorld(this.tmp));
    this.audio.update(dt);
    this.updateHint(dt);
    this.input.endFrame();
  }

  private updateSwap(dt: number) {
    this.swapTime += dt;
    const t = this.swapTime / this.swapDuration;
    const outgoing = this.toolOf(this.tool);
    const incoming = this.toolOf(this.swapTool);
    if (outgoing && outgoing !== incoming) {
      const p = this.parkSpot(this.tool).clone();
      outgoing.aim(p, this.tmp2.set(p.x + 0.5, 0, p.z + 0.5), 0.85, dt);
      if (t > 0.5 && this.tool !== 'nozzle') {
        outgoing.setVisible(false);
        if (this.tool === 'lance') this.waterHose.setVisible(false);
      }
    }
    if (incoming && t > 0.42) {
      if (!incoming.group.visible) {
        const p = this.parkSpot(this.swapTool).clone();
        incoming.aim(p, this.tmp2.set(p.x + 0.5, 0, p.z + 0.5), 0.85, dt, true);
        incoming.setVisible(true);
      }
      const target = this.tmp.copy(this.workPoint);
      target.y = this.groundHeight(target.x, target.z) + 0.4;
      incoming.aim(target, this.workerStand(), 0.2, dt);
    }
    this.worker.place(this.workerStand(), this.workPoint, 0.28);
    if (this.swapTime >= this.swapDuration) {
      this.swapTime = -1;
      this.tool = this.swapTool;
      this.phase = this.swapNext;
      this.phaseTime = 0;
      this.onPhaseEnter();
    }
  }

  private workerStand(): THREE.Vector3 {
    const off = SITES[this.siteIndex].workerOffset;
    // standing tools put the hands further out, so the operator steps back
    const reach = this.tool === 'detector' ? 0.78 : this.tool === 'rod' ? 0.7 : 1.0;
    return this.tmp2.set(this.workPoint.x + off.x * reach, 0, this.workPoint.z + off.y * reach);
  }

  private onPhaseEnter() {
    const dig = this.activeSite;
    switch (this.phase) {
      case 'detect':
        this.lockTimer = 0;
        this.detectorPeaked = false;
        this.director.setShot(SHOTS.detect(), this.detectPos);
        this.sensorShadow.show();
        break;
      case 'mark':
        this.crossDecals[this.siteIndex].place(
          this.markPoint.x,
          this.groundHeight(this.markPoint.x, this.markPoint.z) + 0.016,
          this.markPoint.z,
          Math.random() * 0.4 - 0.2
        );
        this.crossDecals[this.siteIndex].show();
        this.sensorShadow.hide();
        break;
      case 'water':
        this.waterHeld = 0;
        this.waterHose.setVisible(true);
        this.director.setShot(this.exposing ? SHOTS.expose() : SHOTS.water(), this.workPoint);
        break;
      case 'vacuum':
        this.director.setShot(this.exposing ? SHOTS.expose() : SHOTS.vacuum(), this.workPoint);
        this.waterHose.setVisible(false);
        break;
      case 'reveal':
        dig.firstCutPoint(this.revealPoint);
        this.director.setShot(SHOTS.macro(), this.revealPoint);
        this.audio.drain(this.revealPoint);
        vibrate([14, 40, 22]);
        break;
      case 'depth': {
        // drop the rod into the middle of the bared run, so the reading is honest
        dig.cutCentroid(this.tmp);
        this.workPoint.set(this.tmp.x, 0, this.tmp.z);
        this.rodTipY = 0.3;
        this.rodHold = 0;
        this.director.setShot(SHOTS.depth(), this.workPoint);
        break;
      }
      case 'cutaway': {
        this.cutawayGroup.visible = true;
        const shot = SHOTS.cutaway();
        shot.dir = this.cutawayDir;
        // a hard cut: the section is a diagram beat, not a camera move
        this.director.setShot(shot, this.tmp.copy(SITES[0].origin).setY(-0.22), true);
        break;
      }
      case 'handoff': {
        const next = SITES[Math.min(this.siteIndex + 1, SITES.length - 1)];
        this.tmp.copy(SITES[this.siteIndex].origin).lerp(next.origin, 0.72);
        this.director.setShot(SHOTS.handoff(), this.tmp);
        break;
      }
      case 'finale':
        this.director.setShot(SHOTS.finale(), this.tmp.set(0.5, 0, -0.6));
        break;
    }
  }

  // --------------------------------------------------------------- phases

  private updateIntro() {
    this.workPoint.copy(SITES[0].origin);
    // frame the lot and the truck together, not just the first patch
    this.director.setSubject(this.tmp.set(1.3, 0, 0.2));
    if (this.phaseTime > 0.8) {
      this.beginSwap('detect', 'detector', 1.3);
    }
  }

  private updateDetect(dt: number) {
    const cfg = SITES[this.siteIndex];
    if (this.input.active && this.fingerOnSite(0.1, this.tmp)) {
      this.detectTarget.set(
        clamp(this.tmp.x, cfg.origin.x - cfg.scanHalf.x, cfg.origin.x + cfg.scanHalf.x),
        0,
        clamp(this.tmp.z, cfg.origin.z - cfg.scanHalf.y, cfg.origin.z + cfg.scanHalf.y)
      );
    }
    this.detectPos.x = damp(this.detectPos.x, this.detectTarget.x, 11, dt);
    this.detectPos.z = damp(this.detectPos.z, this.detectTarget.z, 11, dt);
    this.detectPos.y = this.groundHeight(this.detectPos.x, this.detectPos.z);

    const d = distanceToPipesXZ(
      cfg.pipes,
      this.detectPos.x - cfg.origin.x,
      this.detectPos.z - cfg.origin.z
    );
    const signal = Math.exp(-Math.pow(d / 0.42, 2));
    this.detectSignal = signal;
    this.detector.setSignal(signal);
    this.audio.setDetector(true, signal, this.detectPos);
    this.sensorShadow.place(this.detectPos.x, this.detectPos.y + 0.012, this.detectPos.z);
    (this.sensorShadow.mesh.material as THREE.MeshBasicMaterial).opacity = 0.16 + signal * 0.2;

    if (!this.detectorPeaked && signal > 0.93) {
      this.detectorPeaked = true;
      vibrate(16);
    }
    if (signal > 0.87) this.lockTimer += dt;
    else this.lockTimer = Math.max(0, this.lockTimer - dt * 1.8);

    this.workPoint.copy(this.detectPos);
    this.director.setSubject(this.detectPos);
    this.toolPoint.copy(this.detectPos);
    this.toolPoint.y += 0.055;

    // the operator's eyes drift toward what the instrument is telling them
    const near = this.nearestRouteWorld(cfg, this.tmp3);
    this.worker.setLook(this.tmp2.copy(this.detectPos).lerp(near, 0.35));

    if (this.lockTimer > 0.62) {
      this.markPoint.copy(this.detectPos);
      this.audio.setDetector(false, 0, this.detectPos);
      this.phase = 'mark';
      this.phaseTime = 0;
      this.onPhaseEnter();
    }
  }

  private nearestRouteWorld(cfg: (typeof SITES)[number], out: THREE.Vector3): THREE.Vector3 {
    let best = Infinity;
    out.copy(cfg.origin);
    for (const p of cfg.pipes) {
      const [dist, t] = distToSegmentXZ(
        this.detectPos.x - cfg.origin.x,
        this.detectPos.z - cfg.origin.z,
        p.a.x,
        p.a.z,
        p.b.x,
        p.b.z
      );
      if (dist < best) {
        best = dist;
        out.set(
          cfg.origin.x + lerp(p.a.x, p.b.x, t),
          0,
          cfg.origin.z + lerp(p.a.z, p.b.z, t)
        );
      }
    }
    return out;
  }

  private updateMark(dt: number) {
    // the operator kneels and sprays a small cross where the signal peaked
    this.workPoint.copy(this.markPoint);
    this.director.setSubject(this.markPoint);
    this.toolPoint.copy(this.markPoint);
    this.toolPoint.y += 0.09;
    this.worker.setLook(this.markPoint);
    void dt;
    if (this.phaseTime > 1.5) {
      this.beginSwap('water', 'lance', 1.0);
    }
  }

  private updateWater(dt: number) {
    const dig = this.activeSite;
    if (this.input.active && this.fingerOnSite(0.12, this.tmp)) {
      this.workPoint.x = damp(this.workPoint.x, this.tmp.x, 14, dt);
      this.workPoint.z = damp(this.workPoint.z, this.tmp.z, 14, dt);
    }
    this.workPoint.y = 0;
    const gy = this.groundHeight(this.workPoint.x, this.workPoint.z);
    const impact = this.tmp2.set(this.workPoint.x, gy, this.workPoint.z);
    this.toolPoint.set(impact.x + 0.14, gy + 0.4, impact.z + 0.3);
    this.director.setSubject(impact);
    this.worker.setLook(impact);

    const on = this.input.active;
    this.lance.setFlow(on, dt);
    this.jet.setVisible(true);
    this.jet.update(dt, this.lance.group.position, impact, on, this.director.camera);
    this.audio.setWater(on, impact);

    if (on) {
      dig.applyWater(impact.x, impact.z, 0.235, dt);
      this.waterHeld += dt;
      this.spawnDroplets(impact, dt);
    }

    const pool = dig.wetAround(impact.x, impact.z, 0.45);
    if (pool > WATER_READY && this.waterHeld > 1.2 && this.phaseTime > 2.0) {
      this.jet.setVisible(false);
      this.beginSwap('vacuum', 'nozzle', 0.95);
    }
  }

  private updateVacuum(dt: number) {
    const dig = this.activeSite;
    if (this.input.active && this.fingerOnSite(0.12, this.tmp)) {
      this.workPoint.x = damp(this.workPoint.x, this.tmp.x, 13, dt);
      this.workPoint.z = damp(this.workPoint.z, this.tmp.z, 13, dt);
    }
    const safeY = dig.safeToolY(this.workPoint.x, this.workPoint.z, 0.045);
    this.workPoint.y = 0;
    this.toolPoint.set(this.workPoint.x, safeY, this.workPoint.z);
    const focus = this.tmp2.set(
      this.workPoint.x,
      this.groundHeight(this.workPoint.x, this.workPoint.z),
      this.workPoint.z
    );
    this.director.setSubject(focus);
    this.worker.setLook(focus);

    let power = 0;
    if (this.input.active) {
      const report = dig.applyVacuum(this.workPoint.x, this.workPoint.z, 0.17, dt);
      power = 0.42 + clamp01(report.volume * 55) * 0.58;
      this.spawnSoil(report.volume, report.wetness, dt);
      if (report.gritty && report.volume > 0.0004 && Math.random() < 0.35) {
        this.audio.pebble(this.nozzle.inletWorld(this.tmp3));
      }
    }
    this.nozzle.setSuction(power);
    this.audio.setVacuum(power, this.nozzle.inletWorld(this.tmp3));

    if (!this.exposing && dig.firstSighting) {
      this.phase = 'reveal';
      this.phaseTime = 0;
      this.exposing = true;
      this.audio.setVacuum(0, this.workPoint);
      this.onPhaseEnter();
      return;
    }
    if (dig.exposure >= SITES[this.siteIndex].requiredExposure) {
      this.beginSwap('depth', 'rod', 1.1);
      return;
    }
    const near = dig.wetAround(this.workPoint.x, this.workPoint.z, 0.35);
    if (near < WET_EXHAUSTED && this.phaseTime > 3.5) {
      // the ground has dried out under the nozzle: back to the water lance
      this.beginSwap('water', 'lance', 0.95);
    }
  }

  private updateReveal(dt: number) {
    this.director.setSubject(this.revealPoint);
    // lift the nozzle clear so nothing covers the first sight of the pipe
    this.toolPoint.set(this.revealPoint.x + 0.62, this.revealPoint.y + 0.62, this.revealPoint.z + 0.34);
    this.worker.setLook(this.revealPoint);
    void dt;
    if (this.phaseTime > 2.3) {
      this.phase = 'vacuum';
      this.phaseTime = 0;
      this.onPhaseEnter();
    }
  }

  private updateDepth(dt: number) {
    const dig = this.activeSite;
    const px = this.workPoint.x;
    const pz = this.workPoint.z;
    const stop = dig.safeToolY(px, pz, 0.02);
    if (this.input.active) {
      this.rodTipY -= this.input.dy * 0.0022;
    }
    this.rodTipY = clamp(this.rodTipY, stop, 0.42);
    this.toolPoint.set(px, this.rodTipY, pz);
    const grade = SITES[this.siteIndex].origin.y + PATCH_LIFT;
    this.rod.setGroundLine(grade - this.rodTipY);
    this.rod.highlightSubmerged(grade - this.rodTipY);
    this.director.setSubject(this.tmp2.set(px, (grade + this.rodTipY) * 0.5, pz));
    this.worker.setLook(this.tmp2.set(px, this.rodTipY, pz));

    if (this.rodTipY <= stop + 0.02) this.rodHold += dt;
    else this.rodHold = Math.max(0, this.rodHold - dt);
    if (this.rodHold > 0.75) {
      if (this.siteIndex === 0) {
        this.beginSwap('cutaway', 'none', 1.0);
      } else if (this.siteIndex >= SITES.length - 1) {
        this.beginSwap('finale', 'none', 1.2);
      } else {
        this.beginSwap('handoff', 'none', 1.0);
      }
    }
  }

  private updateCutaway(dt: number) {
    const t = clamp01(this.phaseTime / 0.6) * clamp01((2.9 - this.phaseTime) / 0.6);
    const peak = [0.42, 0.9, 0.6];
    this.cutawayGroup.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.Material;
      m.opacity = t * peak[i];
    });
    // step the operator aside so nothing stands in front of the section
    this.toolPoint.copy(SITES[0].origin).add(this.cutawayAside);
    this.toolPoint.y = 0.35;
    this.workPoint.copy(this.toolPoint);
    this.worker.setLook(this.tmp.copy(SITES[0].origin));
    void dt;
    if (this.phaseTime > 2.9) {
      this.cutawayGroup.visible = false;
      this.phase = 'handoff';
      this.phaseTime = 0;
      this.onPhaseEnter();
    }
  }

  private updateHandoff(dt: number) {
    const next = SITES[Math.min(this.siteIndex + 1, SITES.length - 1)];
    // the locator picks up something at the neighbouring patch of ground
    const pingPos = this.tmp2.set(next.origin.x, 0.05, next.origin.z);
    const wobble = 0.42 + Math.sin(this.phaseTime * 2.2) * 0.12;
    this.audio.setDetector(this.phaseTime > 0.5, wobble, pingPos);
    this.toolPoint.copy(next.origin);
    this.toolPoint.y = 0.3;
    this.worker.setLook(pingPos);
    void dt;
    if (this.phaseTime > 2.4) {
      this.audio.setDetector(false, 0, pingPos);
      this.siteIndex = Math.min(this.siteIndex + 1, SITES.length - 1);
      this.exposing = false;
      const cfg = SITES[this.siteIndex];
      this.detectPos.set(cfg.origin.x + cfg.scanStart.x, 0, cfg.origin.z + cfg.scanStart.y);
      this.detectTarget.copy(this.detectPos);
      this.workPoint.copy(this.detectPos);
      this.beginSwap('detect', 'detector', 1.25);
    }
  }

  private updateFinale() {
    this.toolPoint.copy(SITES[0].origin);
    this.toolPoint.y = 0.3;
    this.director.setSubject(this.tmp.set(0.5, 0, -0.6));
    if (this.phaseTime > 2.5 && this.input.justPressed) this.restart();
  }

  private restart() {
    for (const s of this.sites) s.reset();
    for (const d of this.crossDecals) d.hide(true);
    this.siteIndex = 0;
    this.exposing = false;
    const cfg = SITES[0];
    this.detectPos.set(cfg.origin.x + cfg.scanStart.x, 0, cfg.origin.z + cfg.scanStart.y);
    this.detectTarget.copy(this.detectPos);
    this.workPoint.copy(this.detectPos);
    this.beginSwap('detect', 'detector', 1.2);
  }

  // ----------------------------------------------------------------- rig

  private updateRig(dt: number) {
    const tilt =
      this.tool === 'rod' ? 0 : this.tool === 'detector' ? 0.04 : this.tool === 'lance' ? 0.12 : 0.18;
    const active = this.toolOf(this.tool);
    if (!this.busy && active) {
      active.setVisible(true);
      active.aim(this.toolPoint, this.workerStand(), tilt, dt);
    }
    if (this.tool !== 'nozzle' && this.phase !== 'vacuum' && this.phase !== 'reveal') {
      const p = this.parkSpot('nozzle');
      if (!this.busy) this.nozzle.aim(p, this.tmp2.set(p.x + 0.5, 0, p.z + 0.5), 0.85, dt);
      this.nozzle.setVisible(true);
    }

    const crouch =
      this.phase === 'detect' || this.phase === 'handoff' || this.phase === 'finale'
        ? 0.12
        : this.phase === 'mark'
          ? 0.72
          : this.phase === 'depth'
            ? 0.12
            : 0.6;
    this.worker.place(this.workerStand(), this.toolPoint, crouch);

    if (active && !this.busy) {
      active.gripWorld(this.handL, this.handR);
      if (this.phase === 'mark') {
        // one hand keeps the locator, the other reaches down with the paint
        this.handR.set(this.markPoint.x, this.groundHeight(this.markPoint.x, this.markPoint.z) + 0.1, this.markPoint.z);
      }
      this.worker.setHandTargets(this.handL, this.handR);
    } else if (!active) {
      const stand = this.workerStand();
      const toX = (this.workPoint.x - stand.x) * 0.25;
      const toZ = (this.workPoint.z - stand.z) * 0.25;
      this.handL.set(stand.x - 0.19 + toX, 0.84, stand.z + toZ);
      this.handR.set(stand.x + 0.19 + toX, 0.84, stand.z + toZ);
      this.worker.setHandTargets(this.handL, this.handR);
    }
    this.worker.update(dt, this.clock);

    // the boom follows the work so the hose route always makes sense
    // The head is held behind and above the work so the arm never crosses the
    // shot; the hose then drops into frame from the truck side.
    const working =
      this.phase === 'vacuum' || this.phase === 'reveal' || this.phase === 'water' || this.phase === 'depth';
    this.boomTarget.copy(working ? this.workPoint : SITES[this.siteIndex].origin);
    this.boomTarget.x += working ? 1.05 : 1.6;
    this.boomTarget.z += working ? 0.85 : 1.9;
    this.truck.aimAt(this.boomTarget, working ? 2.55 : 2.85);
    this.truck.update(dt);

    const reel = this.truck.reelWorld(this.anchorA);
    const tip = this.truck.boomTipWorld(this.anchorB);
    this.vacHose.update(dt, reel, tip, this.nozzle.inletWorld(this.anchorC));
    if (this.waterHose.group.visible) {
      this.waterHose.update(
        dt,
        this.truck.waterOutletWorld(this.anchorD),
        tip,
        this.lance.inletWorld(this.anchorE)
      );
    }
    this.detector.animate(dt, this.clock);
  }

  // ------------------------------------------------------------ particles

  private spawnSoil(volume: number, wetness: number, dt: number) {
    if (volume <= 0) return;
    const n = Math.min(9, Math.round(volume * 2600 * this.particleScale));
    if (n <= 0) return;
    const gy = this.groundHeight(this.workPoint.x, this.workPoint.z);
    const mud = clamp01(wetness);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.15;
      const x = this.workPoint.x + Math.cos(a) * r;
      const z = this.workPoint.z + Math.sin(a) * r;
      const y = this.groundHeight(x, z) + 0.01;
      // multiplier over the pool's soil colour: wet spoil comes out darker
      const v = lerp(1.05, 0.45, mud) + (Math.random() - 0.5) * 0.22;
      this.soilColor.setRGB(v, v * 0.98, v * 0.92);
      this.soilFx.spawn(
        x,
        y,
        z,
        (Math.random() - 0.5) * 0.35,
        0.35 + Math.random() * 0.5,
        (Math.random() - 0.5) * 0.35,
        0.42 + Math.random() * 0.2,
        lerp(0.016, 0.042, Math.random()) * (1 + mud * 0.5),
        MODE_ATTRACT,
        this.soilColor
      );
    }
    // a little spatter is thrown clear of the mouth rather than vanishing
    if (Math.random() < dt * 12 * this.particleScale) {
      this.soilFx.spawn(
        this.workPoint.x,
        gy + 0.04,
        this.workPoint.z,
        (Math.random() - 0.5) * 1.1,
        0.9 + Math.random() * 0.6,
        (Math.random() - 0.5) * 1.1,
        0.7,
        0.018,
        MODE_BALLISTIC,
        this.soilColor
      );
    }
  }

  private spawnDroplets(impact: THREE.Vector3, dt: number) {
    const n = Math.round(dt * 46 * this.particleScale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.7 + Math.random() * 1.1;
      this.dropFx.spawn(
        impact.x,
        impact.y + 0.02,
        impact.z,
        Math.cos(a) * sp,
        0.7 + Math.random() * 0.8,
        Math.sin(a) * sp,
        0.42 + Math.random() * 0.2,
        0.009 + Math.random() * 0.008,
        MODE_BALLISTIC,
        this.waterColor
      );
    }
  }

  /**
   * Screen position a finger must be at to drive the current tool onto the
   * live work point, taking the deliberate finger-to-tip offset into account.
   */
  fingerTargetScreen(width: number, height: number, lift: number): { x: number; y: number } {
    if (this.phase === 'detect') this.projected.copy(this.detectPos);
    else if (this.phase === 'water' || this.phase === 'vacuum') {
      this.projected.set(
        this.workPoint.x,
        this.groundHeight(this.workPoint.x, this.workPoint.z),
        this.workPoint.z
      );
    } else this.projected.copy(this.toolPoint);
    return this.toScreen(this.projected, width, height, lift);
  }

  private toScreen(p: THREE.Vector3, width: number, height: number, lift: number) {
    this.projected.copy(p).project(this.director.camera);
    return {
      x: ((this.projected.x + 1) / 2) * width,
      y: ((1 - this.projected.y) / 2) * height + height * lift,
    };
  }

  /** Two points on the nearest buried run, for the automated play-through. */
  routeScreen(width: number, height: number, lift: number) {
    const cfg = SITES[this.siteIndex];
    let best = Infinity;
    let ax = 0;
    let az = 0;
    let bx = 0;
    let bz = 0;
    for (const p of cfg.pipes) {
      const [dist, t] = distToSegmentXZ(
        this.workPoint.x - cfg.origin.x,
        this.workPoint.z - cfg.origin.z,
        p.a.x,
        p.a.z,
        p.b.x,
        p.b.z
      );
      if (dist < best) {
        best = dist;
        const len = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z) || 1;
        const clamped = clamp(t, 0.5 - 0.4 / len, 0.5 + 0.4 / len);
        const d = 0.26 / len;
        ax = cfg.origin.x + lerp(p.a.x, p.b.x, clamp(clamped - d, 0, 1));
        az = cfg.origin.z + lerp(p.a.z, p.b.z, clamp(clamped - d, 0, 1));
        bx = cfg.origin.x + lerp(p.a.x, p.b.x, clamp(clamped + d, 0, 1));
        bz = cfg.origin.z + lerp(p.a.z, p.b.z, clamp(clamped + d, 0, 1));
      }
    }
    return [
      this.toScreen(this.tmp.set(ax, this.groundHeight(ax, az), az), width, height, lift),
      this.toScreen(this.tmp.set(bx, this.groundHeight(bx, bz), bz), width, height, lift),
    ];
  }

  // ----------------------------------------------------------------- hint

  private updateHint(dt: number) {
    let kind: GestureKind = 'none';
    if (!this.busy) {
      if (this.phase === 'detect') kind = 'swipe';
      else if (this.phase === 'water') kind = 'hold';
      else if (this.phase === 'vacuum') kind = 'trace';
      else if (this.phase === 'depth') kind = 'down';
    }
    this.projected.copy(kind === 'swipe' ? this.detectPos : this.toolPoint);
    this.projected.project(this.director.camera);
    const nx = (this.projected.x + 1) / 2;
    const ny = (1 - this.projected.y) / 2;
    const idle = this.input.idleTime > (this.input.active ? 2.6 : 2.2);
    this.hud.set(kind, nx, ny, idle && kind !== 'none');
    this.hud.update(dt);
  }
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* haptics are a nicety */
    }
  }
}
