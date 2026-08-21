import {
  ACESFilmicToneMapping,
  Color,
  Vector2,
  Group,
  Mesh,
  Object3D,
  PCFSoftShadowMap,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CameraRig, type Pose } from './Rail';
import { GameAudio } from './Audio';
import { Input } from './Input';
import { PerfGovernor, autoDetectTier, settingsFor, type QualitySettings, type QualityTier } from './Quality';
import { Hud } from '../ui/Hud';
import { OpticsState, PATTERN_KINDS, evalPattern, type Phase } from '../state/OpticsState';
import { createOpticsUniforms } from '../render/optics';
import { buildMaterials, type MaterialLibrary } from '../materials/Materials';
import { causticTexture, foamTexture } from '../materials/Textures';
import { DIM } from '../world/dims';
import { buildFlume, type FlumeBuild } from '../world/Flume';
import { buildPort, type PortBuild } from '../world/Port';
import { buildShelf, makePlate, type PlateObject, type ShelfBuild } from '../world/Panels';
import { buildValve, type ValveBuild } from '../world/Valve';
import { buildRaft, placeRaft, type RaftBuild } from '../world/Raft';
import { buildSky, type SkyBuild } from '../world/Sky';
import { buildGround } from '../world/Ground';
import { buildShell } from '../world/geo';
import { Spray } from '../world/Spray';

type Focus = 'intro' | 'carry' | 'ring' | 'plate' | 'water' | 'launch' | 'ride' | 'runout';

interface Tween {
  obj: Object3D;
  fromP: Vector3;
  fromQ: Quaternion;
  toP: Vector3;
  toQ: Quaternion;
  t: number;
  dur: number;
  ease: (x: number) => number;
  onDone?: () => void;
}

const easeHeavy = (x: number): number => 1 - Math.pow(1 - x, 3.2);
const easeSoft = (x: number): number => x * x * (3 - 2 * x);
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export class App {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig = new CameraRig();
  readonly state = new OpticsState();
  readonly uniforms = createOpticsUniforms();
  readonly audio = new GameAudio();
  readonly hud = new Hud();

  private q: QualitySettings;
  private tier: QualityTier;
  private mats!: MaterialLibrary;
  private input!: Input;
  private governor: PerfGovernor;

  private flume!: FlumeBuild;
  private port!: PortBuild;
  private shelf!: ShelfBuild;
  private valve!: ValveBuild;
  private raft!: RaftBuild;
  private sky!: SkyBuild;
  private spray!: Spray;
  private world = new Group();
  private factory: Group | null = null;

  private plates: PlateObject[] = [];
  private installed: PlateObject | null = null;
  private carrying: PlateObject | null = null;
  private carryHome: Group | null = null;
  private tweens: Tween[] = [];

  phase: Phase = 'dark';
  private focus: Focus = 'intro';
  private phaseTime = 0;
  private labRound = 0;
  private labChanges = 0;
  private hintOn = 0;
  private focusHold = 0;
  private ringTurned = 0;
  private lidAngle = 0;
  private clampWave = -1;
  private raftS = 0;
  private raftV = 0;
  private rideT = 0;
  private lastRingDetent = 0;

  // cached world anchors
  private readonly portWorld = new Vector3();
  private readonly collarWorld = new Vector3();
  private readonly patch = new Vector3();
  private readonly opDir = new Vector3();
  private readonly axisDir = new Vector3();
  private readonly upDir = new Vector3(0, 1, 0);
  private readonly mouthIn = new Vector3();
  private readonly mouthOut = new Vector3();
  private readonly shelfWorld = new Vector3();
  private readonly valveWorld = new Vector3();
  private readonly railCam = new Vector3();
  private railS = 0;
  private patchS = 0;
  private readonly tmp = new Vector3();
  private readonly tmp2 = new Vector3();
  private readonly sample = { intensity: 0, color: [0, 0, 0] as [number, number, number] };

  constructor(private readonly container: HTMLElement) {
    const forced = new URLSearchParams(location.search).get('q');
    this.tier =
      forced === 'low' || forced === 'medium' || forced === 'high' ? forced : autoDetectTier();
    this.q = settingsFor(this.tier);
    this.renderer = new WebGLRenderer({
      antialias: this.tier !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(new Color('#8fa8bd'));
    container.appendChild(this.renderer.domElement);
    this.scene.add(this.world);

    this.governor = new PerfGovernor((t) => this.setQuality(t, true));

    this.hud.onQuality = (t) => this.setQuality(t, false);
    this.hud.onRestart = () => this.restart();
  }

  /* ---------------------------------------------------------------- */

  async init(): Promise<void> {
    this.mats = buildMaterials(this.uniforms, this.q);
    this.uniforms.uLTCaustic.value = causticTexture(this.q.causticRes);
    this.uniforms.uLTFoam.value = foamTexture();
    this.uniforms.uLTCausticGain.value = this.tier === 'low' ? 0.5 : 1;

    this.sky = buildSky(this.scene, this.renderer, this.q, this.state.sunDir);
    this.scene.add(this.sky.group);

    this.flume = buildFlume(this.mats, this.q);
    this.world.add(this.flume.group);

    // inlet trough upstream of the barrel
    const troughArgs = {
      path: this.flume.path,
      innerR: DIM.innerR,
      thickness: DIM.wall,
      thetaStart: Math.PI - 1.15,
      thetaLength: 2.3,
      sMin: 0.5,
      sMax: this.flume.sStart - 0.02,
      segsAlong: Math.max(20, this.q.tubeSegmentsAlong >> 3),
      segsAround: Math.max(12, this.q.tubeSegmentsAround >> 2),
    } as const;
    this.world.add(new Mesh(buildShell({ ...troughArgs, side: 'outer' }), this.mats.frpOuter));
    this.world.add(new Mesh(buildShell({ ...troughArgs, side: 'inner' }), this.mats.frpInner));
    this.world.add(new Mesh(buildShell({ ...troughArgs, side: 'edges' }), this.mats.frpCut));

    this.port = buildPort(this.mats);
    this.flume.portRoot.add(this.port.root);

    this.world.add(buildGround(this.mats, this.flume.path));

    this.computeAnchors();

    // plate rack, on the operator side, angled at the flume
    this.shelf = buildShelf(this.mats, 3);
    const sf = this.flume.path.frameAt(DIM.portS + 1.75);
    this.shelfWorld.set(sf.p.x, 0, sf.p.z).addScaledVector(this.opDir, 2.85);
    this.shelf.group.position.copy(this.shelfWorld);
    this.shelf.group.rotation.y = Math.atan2(-this.opDir.x, -this.opDir.z) + Math.PI;
    this.world.add(this.shelf.group);

    for (let i = 0; i < PATTERN_KINDS.length; i++) {
      const p = makePlate(PATTERN_KINDS[i], this.mats);
      this.shelf.slots[i].add(p.group);
      p.group.userData.slot = this.shelf.slots[i];
      this.plates.push(p);
    }

    // supply header over the inlet trough
    this.valve = buildValve(this.mats);
    const vf = this.flume.path.frameAt(2.75);
    this.valveWorld.set(vf.p.x, 0, vf.p.z).addScaledVector(this.opDir, 1.5);
    this.valve.group.position.copy(this.valveWorld);
    this.valve.group.rotation.y = Math.atan2(-this.opDir.x, -this.opDir.z);
    this.world.add(this.valve.group);

    this.raft = buildRaft(this.mats);
    this.world.add(this.raft.group);
    this.raftS = RAFT_HOME;
    placeRaft(this.raft, this.flume.path, this.raftS, 0, 0);

    this.spray = new Spray(this.flume.path, this.mats, this.q.dropletCount, 1.4, this.flume.sEnd);
    this.spray.setBudget(this.q.dropletCount);
    this.world.add(this.spray.mesh);

    this.input = new Input(this.renderer.domElement, this.rig.camera);
    this.wireInteractions();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));

    this.devHook();
    this.setFocus('intro', 0.01);
    this.hud.setQuality(this.tier, this.qualityNote());

    // first frame with the flume only; the backdrop follows
    this.renderer.compile(this.scene, this.rig.camera);
    this.renderer.render(this.scene, this.rig.camera);
    Hud.bootDone();
    window.setTimeout(() => void this.loadBackdrop(), 260);
  }

  private async loadBackdrop(): Promise<void> {
    const mod = await import('../world/Factory');
    this.factory = mod.buildFactory(this.mats, this.q);
    this.world.add(this.factory);
  }

  private computeAnchors(): void {
    const path = this.flume.path;
    const Ro = DIM.innerR + DIM.wall;
    path.surfacePoint(DIM.portS, DIM.portTheta, Ro, this.portWorld);
    const f = path.frameAt(DIM.portS);
    this.axisDir.copy(f.t);
    this.opDir.copy(f.r).multiplyScalar(-1).setY(0).normalize();
    this.collarWorld
      .copy(this.portWorld)
      .addScaledVector(path.radialDir(DIM.portS, DIM.portTheta), DIM.neckTop + DIM.flangeThick + DIM.collarThick);

    // where the beam actually lands: march the sun ray into the barrel
    const dir = this.state.sunDir.clone().multiplyScalar(-1);
    this.patch.copy(this.portWorld);
    for (let t = 0.1; t < 6; t += 0.04) {
      this.tmp.copy(this.portWorld).addScaledVector(dir, t);
      const s = this.nearestS(this.tmp);
      const fr = path.frameAt(s);
      if (this.tmp.distanceTo(fr.p) >= DIM.innerR - 0.03) {
        this.patch.copy(this.tmp);
        break;
      }
    }

    const fIn = path.frameAt(this.flume.sStart);
    this.mouthIn.copy(fIn.p);
    const fOut = path.frameAt(this.flume.sEnd);
    this.mouthOut.copy(fOut.p);

    this.patchS = this.nearestS(this.patch);
    this.railS = Math.min(this.flume.sEnd - 1.6, this.patchS + 3.2);
    path.surfacePoint(this.railS, -0.3, DIM.innerR - 0.66, this.railCam);

    // which way the cut-away faces, so interior surfaces know how much sky
    // they can see; the barrel's own bend is small enough to take one value
    const openTheta = DIM.thetaStart + DIM.thetaLength + (Math.PI * 2 - DIM.thetaLength) * 0.5;
    this.uniforms.uLTOpenDir.value.copy(path.radialDir(DIM.portS, openTheta));
    this.uniforms.uLTMouthA.value.copy(path.surfacePoint(this.flume.sStart, Math.PI, DIM.innerR * 0.4));
    this.uniforms.uLTMouthB.value.copy(path.surfacePoint(this.flume.sEnd, Math.PI, DIM.innerR * 0.4));

    // the faint streak that exists before anything is fitted
    this.uniforms.uLTMouthO.value.copy(fIn.p);
    this.uniforms.uLTMouthDir.value.copy(fIn.t);
    this.uniforms.uLTMouthRight.value.copy(fIn.r);
  }

  private nearestS(p: Vector3): number {
    const path = this.flume.path;
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s <= path.length; s += 0.25) {
      const d = path.frameAt(s).p.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    for (let s = Math.max(0, best - 0.25); s <= Math.min(path.length, best + 0.25); s += 0.03) {
      const d = path.frameAt(s).p.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /* ------------------------------ input ---------------------------- */

  private wireInteractions(): void {
    const grabOffset = new Vector3();
    const carryPos = new Vector3();

    // 1. carry a plate across to the port
    this.input.register({
      id: 'plate',
      objects: () => this.plates.filter((p) => p !== this.installed).map((p) => p.group),
      enabled: () => this.carrying === null && this.phase !== 'ride' && this.phase !== 'runout',
      onDown: (ctx) => {
        this.audio.start();
        const plate = this.plates.find((p) => p !== this.installed && this.isUnder(p.group, ctx)) ?? null;
        if (!plate) return;
        this.carrying = plate;
        this.carryHome = plate.group.parent as Group;
        this.world.attach(plate.group);
        grabOffset.set(0, 0, 0);
        this.openLid();
        this.grabFocus('carry', 1.1, 2.0);
      },
      onMove: (ctx) => {
        const plate = this.carrying;
        if (!plate) return;
        this.input.screenPlanePoint(this.portWorld, carryPos);
        // keep the plate clear of the finger so it is never hidden by a hand
        carryPos.addScaledVector(this.rig.camera.up, 0.42).add(grabOffset);
        plate.group.position.lerp(carryPos, 0.45);
        const near = clamp01(1 - plate.group.position.distanceTo(this.collarWorld) / 3.2);
        const q = this.port.slot.getWorldQuaternion(_q1);
        plate.group.quaternion.slerp(q, 0.1 + near * 0.25);
        ctx.dragTime;
      },
      onUp: () => {
        const plate = this.carrying;
        if (!plate) return;
        this.carrying = null;
        const d = plate.group.position.distanceTo(this.collarWorld);
        if (d < 3.4) this.seatPlate(plate);
        else this.returnPlate(plate, this.carryHome);
      },
    });

    // 2. flip the clamps (tested first: they sit on the collar)
    this.input.register({
      id: 'clamp',
      // anywhere on the port: a four-year-old should not have to find a lever
      objects: () => [this.port.collar],
      enabled: () => this.installed !== null && !this.state.clamped,
      onDown: () => {
        this.audio.start();
        this.clampWave = 0;
      },
    });

    // 3. turn the collar
    let ringStart = 0;
    let ringFrom = 0;
    const ringCentre = new Vector2();
    this.input.register({
      id: 'ring',
      // the collar only turns once the plate is actually clamped in it
      objects: () => [this.port.collar],
      enabled: () => this.installed !== null && this.state.clamped && this.phase !== 'ride',
      onDown: () => {
        this.audio.start();
        this.input.toNdc(this.collarWorld, ringCentre);
        ringStart = this.input.angleAround(ringCentre);
        ringFrom = this.state.ringAngle;
        this.grabFocus('ring', 1.0, 3.0);
        this.bumpLab('ring');
      },
      onMove: () => {
        const a = this.input.angleAround(ringCentre);
        let d = a - ringStart;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const next = ringFrom + d;
        this.ringTurned += Math.abs(next - this.state.ringAngle);
        this.state.ringAngle = next;
        const detent = Math.round(next / (Math.PI / 12));
        if (detent !== this.lastRingDetent) {
          this.lastRingDetent = detent;
          this.audio.click();
        }
      },
    });

    // 4. pull the water lever
    let valveStart = 0;
    let valveFrom = 0;
    this.input.register({
      id: 'valve',
      objects: () => [this.valve.lever],
      enabled: () => this.state.clamped,
      onDown: (ctx) => {
        this.audio.start();
        valveStart = ctx.screen.y;
        valveFrom = this.state.waterFlow;
        this.grabFocus('water', 1.0, 3.6);
        this.bumpLab('water');
      },
      onMove: (ctx) => {
        const dy = ctx.screen.y - valveStart;
        const next = clamp01(valveFrom + dy / (this.renderer.domElement.clientHeight * 0.36));
        if (Math.abs(next - this.state.waterFlow) > 0.004) this.audio.valve();
        this.state.waterFlow = next;
      },
    });

    // 5. send the raft
    let swipeStart = 0;
    this.input.register({
      id: 'raft',
      objects: () => [this.raft.group],
      enabled: () => this.phase === 'lab' || this.phase === 'watered',
      onDown: (ctx) => {
        this.audio.start();
        swipeStart = ctx.screen.x + ctx.screen.y;
      },
      onUp: (ctx) => {
        if (ctx.screen.x + ctx.screen.y - swipeStart > 24 || ctx.dragTime < 0.18) this.launchRaft();
      },
    });

    this.input.onIdleBreak = () => {
      this.hintOn = 0;
    };
  }

  private isUnder(obj: Object3D, ctx: { ray: { intersectObject: (o: Object3D, r: boolean) => unknown[] } }): boolean {
    return ctx.ray.intersectObject(obj, true).length > 0;
  }

  /* --------------------------- sequences --------------------------- */

  private openLid(): void {
    if (this.state.lidOpen) return;
    this.state.lidOpen = true;
    this.audio.latch();
  }

  private seatPlate(plate: PlateObject): void {
    const previous = this.installed;
    if (previous && previous !== plate) {
      const home = (previous.group.userData.slot as Group) ?? this.shelf.slots[0];
      this.returnPlate(previous, home);
    }
    this.installed = plate;
    this.state.panelKind = plate.kind;
    this.state.seat = 0;
    this.state.clamped = false;
    this.clampWave = -1;
    for (const c of this.port.clamps) (c.userData.pivot as Object3D).rotation.z = -1.15;

    const toP = this.port.slot.getWorldPosition(new Vector3());
    const toQ = this.port.slot.getWorldQuaternion(new Quaternion());
    this.tween(plate.group, toP, toQ, 0.85, easeHeavy, () => {
      this.port.slot.attach(plate.group);
      plate.group.position.set(0, 0, 0);
      plate.group.quaternion.identity();
      this.audio.thunk();
      this.rig.nudge(0.35);
      if (this.phase === 'dark') {
        this.phase = 'seated';
        this.phaseTime = 0;
        this.ringTurned = 0;
      }
      this.grabFocus('ring', 1.5, 2.5);
      this.bumpLab('plate');
    });
  }

  /**
   * The workshop changes one variable per round: plate, then angle, then
   * water, then send a raft. Only the round's own variable counts, so the
   * child is always predicting one thing at a time.
   */
  private bumpLab(kind: 'plate' | 'ring' | 'water'): void {
    if (this.phase !== 'lab') return;
    const want = this.labRound === 0 ? 'plate' : this.labRound === 1 ? 'ring' : 'water';
    if (kind === want) this.labChanges++;
  }

  private returnPlate(plate: PlateObject, home: Group | null): void {
    const slot = home ?? (plate.group.userData.slot as Group);
    const toP = slot.getWorldPosition(new Vector3());
    const toQ = slot.getWorldQuaternion(new Quaternion());
    if (this.installed === plate) this.installed = null;
    this.tween(plate.group, toP, toQ, 0.75, easeSoft, () => {
      slot.attach(plate.group);
      plate.group.position.set(0, 0, 0);
      plate.group.quaternion.identity();
      this.audio.click(0.6);
    });
  }

  private tween(
    obj: Object3D,
    toP: Vector3,
    toQ: Quaternion,
    dur: number,
    ease: (x: number) => number,
    onDone?: () => void,
  ): void {
    this.tweens = this.tweens.filter((t) => t.obj !== obj);
    this.tweens.push({
      obj,
      fromP: obj.position.clone(),
      fromQ: obj.quaternion.clone(),
      toP,
      toQ,
      t: 0,
      dur,
      ease,
      onDone,
    });
  }

  private launchRaft(): void {
    if (this.phase === 'ride') return;
    this.phase = 'ride';
    this.phaseTime = 0;
    this.rideT = 0;
    this.raftS = RAFT_HOME;
    this.raftV = 0.6;
    this.grabFocus('ride', 1.3, 999);
  }

  private restart(): void {
    this.state.reset();
    this.state.updateSun();
    this.phase = 'dark';
    this.phaseTime = 0;
    this.labRound = 0;
    this.labChanges = 0;
    this.ringTurned = 0;
    this.focusHold = 0;
    this.lidAngle = 0;
    this.clampWave = -1;
    this.hud.resetCaptions();
    if (this.installed) {
      const home = (this.installed.group.userData.slot as Group) ?? this.shelf.slots[0];
      this.returnPlate(this.installed, home);
    }
    this.installed = null;
    this.carrying = null;
    this.raftS = RAFT_HOME;
    this.raftV = 0;
    this.setFocus('intro', 1.6);
  }

  /* ---------------------------- camera ----------------------------- */

  /** an interaction owns the camera for a moment, then the phase takes it back */
  private grabFocus(f: Focus, dur: number, hold = 3.2): void {
    this.focusHold = hold;
    this.setFocus(f, dur);
  }

  private setFocus(f: Focus, dur: number): void {
    if (this.focus === f && this.rig.name === f) return;
    this.focus = f;
    this.rig.setShot(f, this.shotFor(f), dur, this.fovFor(f));
  }

  private fovFor(f: Focus): number {
    switch (f) {
      case 'intro':
        return 52;
      case 'carry':
        return 50;
      case 'ring':
        return 44;
      case 'plate':
        return 50;
      case 'water':
        return 50;
      case 'launch':
        return 48;
      case 'ride':
        return 58;
      default:
        return 50;
    }
  }

  private shotFor(f: Focus): (out: Pose, t: number) => void {
    const op = this.opDir;
    const ax = this.axisDir;
    const up = this.upDir;
    const mid = (a: Vector3, b: Vector3, k: number, out: Vector3): Vector3 =>
      out.copy(a).lerp(b, k);

    switch (f) {
      case 'intro':
        return (out, t) => {
          out.pos
            .copy(this.patch)
            .addScaledVector(op, 6.8 + Math.sin(t * 0.12) * 0.26)
            .addScaledVector(up, 2.35)
            .addScaledVector(ax, -3.2);
          mid(this.shelfWorld, this.patch, 0.52, out.target).addScaledVector(up, 1.15).addScaledVector(ax, 0.9);
        };
      case 'carry':
        return (out) => {
          out.pos
            .copy(this.patch)
            .addScaledVector(op, 5.8)
            .addScaledVector(up, 2.7)
            .addScaledVector(ax, 0.8);
          mid(this.shelfWorld, this.collarWorld, 0.5, out.target).addScaledVector(up, 0.55);
        };
      case 'ring':
        return (out, t) => {
          out.pos
            .copy(this.collarWorld)
            .addScaledVector(op, 3.9)
            .addScaledVector(up, 1.15)
            .addScaledVector(ax, -0.45 + Math.sin(t * 0.16) * 0.22);
          mid(this.collarWorld, this.patch, 0.5, out.target);
        };
      case 'plate':
        return (out) => {
          out.pos
            .copy(this.collarWorld)
            .addScaledVector(op, 5.0)
            .addScaledVector(up, 2.15)
            .addScaledVector(ax, 1.55);
          mid(this.shelfWorld, this.patch, 0.58, out.target).addScaledVector(up, 0.5);
        };
      case 'water':
        return (out) => {
          out.pos
            .copy(this.patch)
            .addScaledVector(op, 4.5)
            .addScaledVector(up, 2.35)
            .addScaledVector(ax, -3.3);
          mid(this.valveWorld, this.patch, 0.6, out.target).addScaledVector(up, 0.95);
        };
      case 'launch':
        return (out) => {
          const home = this.raft.group.position;
          out.pos.copy(home).addScaledVector(op, 3.4).addScaledVector(up, 1.7).addScaledVector(ax, -2.9);
          out.target.copy(home).addScaledVector(ax, 2.6).addScaledVector(up, 0.1);
        };
      case 'ride':
        return (out) => this.rideShot(out);
      case 'runout':
        return (out, t) => {
          out.pos
            .copy(this.mouthOut)
            .addScaledVector(op, 4.4 - Math.min(3.0, t * 0.6))
            .addScaledVector(up, 1.9)
            .addScaledVector(ax, 5.2);
          out.target.copy(this.mouthOut).addScaledVector(ax, -1.5 - Math.min(4, t * 0.8));
        };
    }
  }

  /** three linked views, no cuts, minimal roll */
  private rideShot(out: Pose): void {
    const path = this.flume.path;
    const op = this.opDir;
    const up = this.upDir;
    const raftP = this.raft.group.position;
    const f = path.frameAt(this.raftS);
    void up;
    if (this.raftS < this.patchS - 4.0) {
      // outside, watching it enter
      out.pos
        .copy(this.mouthIn)
        .addScaledVector(op, 4.2)
        .addScaledVector(up, 1.7)
        .addScaledVector(this.axisDir, -3.4);
      out.target.copy(raftP).addScaledVector(up, 0.25);
    } else if (this.raftS < this.patchS - 0.9) {
      // fixed rail camera in the crown, the raft and the light coming on
      out.pos.copy(this.railCam);
      out.target.copy(raftP).addScaledVector(up, 0.1);
    } else {
      // gentle chase: low, on the flume's own axis, so the barrel frames it
      const localUp = path.radialDir(this.raftS, Math.PI).multiplyScalar(-1);
      out.pos
        .copy(raftP)
        .addScaledVector(localUp, 0.5)
        .addScaledVector(f.t, -2.85)
        .addScaledVector(op, 0.44);
      out.target
        .copy(raftP)
        .addScaledVector(f.t, 4.4)
        .addScaledVector(localUp, 0.12)
        .addScaledVector(op, -0.3);
    }
  }

  /* ---------------------------- main loop -------------------------- */

  private lastT = performance.now();
  fps = 60;

  frame = (): void => {
    const now = performance.now();
    const raw = (now - this.lastT) / 1000;
    // clamped so a stall slows the simulation instead of teleporting it
    const dt = Math.min(0.05, raw);
    this.lastT = now;
    this.fps = this.fps * 0.9 + (1 / Math.max(raw, 0.0005)) * 0.1;
    this.update(dt);
    this.renderer.render(this.scene, this.rig.camera);
    requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    const st = this.state;
    this.phaseTime += dt;
    st.advance(dt);
    st.wetness += (st.waterFlow - st.wetness) * Math.min(1, dt * 1.9);
    this.governor.update(dt, this.tier);

    // tweens
    for (const tw of this.tweens) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = tw.ease(tw.t);
      tw.obj.position.lerpVectors(tw.fromP, tw.toP, k);
      tw.obj.quaternion.slerpQuaternions(tw.fromQ, tw.toQ, k);
    }
    const done = this.tweens.filter((t) => t.t >= 1);
    this.tweens = this.tweens.filter((t) => t.t < 1);
    for (const t of done) t.onDone?.();

    this.updateMechanics(dt);
    this.updatePhase(dt);
    this.updateOptics();
    this.updateWater(dt);
    this.updateRaft(dt);
    this.updateHints(dt);

    this.sky.update(st, dt);
    this.rig.update(dt);
    this.hud.update();
  }

  private updateMechanics(dt: number): void {
    const st = this.state;
    // lid swings back and stays there
    const lidTarget = st.lidOpen ? 2.35 : 0;
    this.lidAngle += (lidTarget - this.lidAngle) * Math.min(1, dt * (st.lidOpen ? 1.6 : 6));
    this.port.lid.rotation.z = this.lidAngle;

    // the still pattern arrives as the plate settles, not a beat later
    if (this.installed) {
      const settling = this.tweens.find((t) => t.obj === this.installed?.group);
      st.seat = settling ? Math.max(st.seat, settling.t * 0.85) : Math.min(1, st.seat + dt * 2.6);
    }

    // clamp ripple
    if (this.clampWave >= 0) {
      this.clampWave += dt;
      for (let i = 0; i < this.port.clamps.length; i++) {
        const pivot = this.port.clamps[i].userData.pivot as Object3D;
        const local = clamp01((this.clampWave - i * 0.13) / 0.26);
        const before = pivot.rotation.z;
        pivot.rotation.z = -1.15 + easeHeavy(local) * 1.15;
        if (before < -0.02 && pivot.rotation.z >= -0.02) this.audio.latch();
      }
      if (this.clampWave > 0.13 * 3 + 0.3) {
        this.clampWave = -1;
        st.clamped = true;
      }
    }

    this.port.collar.rotation.y = st.ringAngle;

    // valve lever and gauge follow the flow, both ways
    this.valve.lever.rotation.z = 0.95 - st.waterFlow * 1.4;
    this.valve.needle.rotation.y = -2.25 + st.wetness * 2.6;
    this.audio.setWater(st.wetness);
  }

  private updateOptics(): void {
    const st = this.state;
    const u = this.uniforms;
    const path = this.flume.path;
    const Ro = DIM.innerR + DIM.wall;

    // plate frame, in world space, straight off the collar
    const origin = path.surfacePoint(DIM.portS, DIM.portTheta, Ro + DIM.neckTop + DIM.flangeThick, this.tmp);
    u.uLTOrigin.value.copy(origin);
    const n = path.radialDir(DIM.portS, DIM.portTheta, this.tmp2);
    u.uLTNormal.value.copy(n);
    const f = path.frameAt(DIM.portS);
    const u0 = f.t.clone().normalize();
    const v0 = new Vector3().crossVectors(n, u0).normalize();
    u.uLTAxisU0.value.copy(u0);
    u.uLTAxisV0.value.copy(v0);
    const c = Math.cos(st.ringAngle);
    const s = Math.sin(st.ringAngle);
    u.uLTAxisU.value.copy(u0).multiplyScalar(c).addScaledVector(v0, s);
    u.uLTAxisV.value.copy(v0).multiplyScalar(c).addScaledVector(u0, -s);

    u.uLTSun.value.copy(st.sunDir);
    u.uLTKind.value = st.patternIndex;
    u.uLTTrans.value = st.transmission;
    u.uLTFlow.value = st.wetness;
    u.uLTPhase.value = st.flowPhase;
    u.uLTRipple.value = st.ripplePhase;
    u.uLTAper.value = DIM.windowHalf;
    u.uLTCloud.value = st.cloudCover;
    u.uLTTime.value = st.time;
    u.uLTGain.value = st.panelKind === null ? 1.45 : 2.45;
    u.uLTMouthGain.value = 0.8 * (1 - 0.5 * st.cloudCover);

    // light that has landed spills on to everything around it
    u.uLTBounceAt.value.copy(this.patch);
    const bounce = st.transmission * (st.panelKind === null ? 0.4 : 0.27);
    u.uLTBounce.value.setRGB(bounce * 1.0, bounce * 0.94, bounce * 0.86);
  }

  private updateWater(dt: number): void {
    const st = this.state;
    const show = st.wetness > 0.012;
    this.flume.bed.visible = show;
    this.mats.water.opacity = 0.05 + st.wetness * 0.17;
    this.spray.update(dt, st.wetness);
    this.spray.mesh.visible = show;
  }

  private updateRaft(dt: number): void {
    const st = this.state;
    const path = this.flume.path;
    if (this.phase === 'ride') {
      this.rideT += dt;
      const vMax = 2.4 + st.wetness * 3.4;
      const brake = this.raftS > this.flume.sEnd - 2.2 ? -2.6 : 2.3;
      this.raftV = Math.max(0, Math.min(vMax, this.raftV + brake * dt));
      this.raftS += this.raftV * dt;
      if (this.raftS >= this.flume.sEnd - 0.35 || (this.raftV < 0.05 && this.rideT > 3)) {
        this.raftS = Math.min(this.raftS, this.flume.sEnd - 0.3);
        this.phase = 'runout';
        this.phaseTime = 0;
        this.setFocus('runout', 2.0);
      }
    }
    const bank = Math.sin(this.raftS * 0.22) * 0.16 * (this.raftV / 4);
    const bob = Math.sin(this.rideT * 5.2) * 0.012 * this.raftV * 0.3;
    placeRaft(this.raft, path, this.raftS, bank, st.wetness * 0.05 + bob);

    // colour the raft picks up out of the beam
    const light = this.raft.light;
    const wp = this.raft.group.getWorldPosition(this.tmp);
    const toPlate = this.tmp2.copy(this.uniforms.uLTOrigin.value).sub(wp);
    const nrm = this.uniforms.uLTNormal.value;
    const sn = st.sunDir.dot(nrm);
    let inten = 0;
    if (st.transmission > 0.01 && sn > 0.06) {
      const t = toPlate.dot(nrm) / sn;
      const hit = this.tmp2.copy(wp).addScaledVector(st.sunDir, t);
      hit.sub(this.uniforms.uLTOrigin.value);
      const au = hit.dot(this.uniforms.uLTAxisU0.value);
      const av = hit.dot(this.uniforms.uLTAxisV0.value);
      if (Math.abs(au) < DIM.windowHalf && Math.abs(av) < DIM.windowHalf) {
        const pu = hit.dot(this.uniforms.uLTAxisU.value) - st.flowPhase;
        const pv = hit.dot(this.uniforms.uLTAxisV.value);
        if (st.panelKind) {
          evalPattern(st.panelKind, pu, pv, 0.02 + t * 0.02, this.sample);
          inten = this.sample.intensity;
        } else {
          inten = 1;
          this.sample.color[0] = 1;
          this.sample.color[1] = 0.97;
          this.sample.color[2] = 0.9;
        }
      }
    }
    const target = inten * st.transmission * 2.0;
    light.intensity += (target - light.intensity) * Math.min(1, dt * 8);
    light.color.setRGB(this.sample.color[0], this.sample.color[1], this.sample.color[2]);
  }

  private updatePhase(dt: number): void {
    const st = this.state;
    this.focusHold = Math.max(0, this.focusHold - dt);

    switch (this.phase) {
      case 'seated':
        if (st.clamped) {
          this.phase = 'clamped';
          this.phaseTime = 0;
        }
        break;
      case 'clamped':
        if (this.ringTurned > 0.2) {
          this.phase = 'turning';
          this.phaseTime = 0;
        }
        break;
      case 'turning':
        if (st.wetness > 0.06) {
          this.phase = 'watered';
          this.phaseTime = 0;
          this.audio.chime();
          this.rig.nudge(0.22);
          this.hud.say('reveal', '光の窓をつけて、水を流すと、にじが走る', 5.2);
        }
        break;
      case 'watered':
        if (this.phaseTime > 8) {
          this.phase = 'lab';
          this.phaseTime = 0;
          this.labRound = 0;
          this.labChanges = 0;
        }
        break;
      case 'lab':
        // one variable at a time: plate, then angle, then water, then send a raft
        if (this.labRound < 3 && this.labChanges >= (this.labRound === 0 ? 1 : 2)) {
          this.labChanges = 0;
          this.labRound += 1;
          this.phaseTime = 0;
        }
        break;
      case 'runout':
        if (this.phaseTime > 6.5) {
          this.phase = 'lab';
          this.phaseTime = 0;
          this.raftS = RAFT_HOME;
          this.raftV = 0;
          this.labRound = 0;
          this.labChanges = 0;
          this.hud.say('again', 'べつのいたも、ためしてみよう', 4.2);
        }
        break;
      default:
        break;
    }

    if (this.focusHold <= 0 && !this.input.dragging) {
      const want = this.desiredFocus();
      if (want) this.setFocus(want, 2.2);
    }
  }

  /**
   * The camera always frames the control that is live right now together
   * with the light it changes; that pairing is the whole lesson.
   */
  private desiredFocus(): Focus | null {
    switch (this.phase) {
      case 'dark':
        return 'intro';
      case 'seated':
      case 'clamped':
        return 'ring';
      case 'turning':
        // once the angle has been played with, widen out so the valve is
        // in reach without ever telling the child to look for it
        return this.phaseTime > 3.0 ? 'water' : 'ring';
      case 'watered':
        return this.phaseTime > 4.0 ? 'ring' : 'water';
      case 'lab':
        return this.labRound === 0
          ? 'plate'
          : this.labRound === 1
            ? 'ring'
            : this.labRound === 2
              ? 'water'
              : 'launch';
      case 'runout':
        return 'runout';
      default:
        return null;
    }
  }

  /** Physical nudges only: a glint, a slow half-turn, a tremble. Never an arrow. */
  private updateHints(dt: number): void {
    const idle = this.input.idleFor;
    this.hintOn = idle > 3.4 ? Math.min(1, this.hintOn + dt * 0.8) : Math.max(0, this.hintOn - dt * 2.4);
    const k = this.hintOn;
    const t = this.state.time;

    const sway = (obj: Object3D, base: number, amt: number) => {
      obj.rotation.z = base + Math.sin(t * 1.9) * amt * k;
    };

    // the rack breathes in the wind whatever happens; the hint only widens it
    for (let i = 0; i < this.plates.length; i++) {
      const p = this.plates[i];
      if (p === this.installed || p === this.carrying) continue;
      const live = this.phase === 'dark' ? i === 0 : this.phase === 'lab' && this.labRound === 0;
      const amp = (live ? 0.02 : 0.004) * (0.25 + k * 0.75);
      p.group.rotation.z = Math.sin(t * 1.6 + i * 1.3) * amp;
    }

    if (this.installed && !this.state.clamped && this.state.seat > 0.8) {
      for (let i = 0; i < this.port.clamps.length; i++) {
        const pivot = this.port.clamps[i].userData.pivot as Object3D;
        if (this.clampWave < 0) pivot.rotation.z = -1.15 + Math.sin(t * 2.6 + i) * 0.05 * k;
      }
    }

    // an empty collar rocks a little when nobody has touched it
    if (this.phase === 'turning' && this.state.wetness < 0.05) {
      this.port.collar.rotation.y = this.state.ringAngle + Math.sin(t * 1.15) * 0.045 * k;
    }
    if ((this.phase === 'lab' && this.labRound === 2) || this.phase === 'turning') {
      sway(this.valve.lever, 0.95 - this.state.waterFlow * 1.4, 0.03);
    }
    if (this.state.wetness > 0.06 && this.phase !== 'ride') {
      const live = this.phase === 'lab' && this.labRound === 3;
      this.raft.hull.rotation.z = Math.sin(t * 1.7) * (live ? 0.055 : 0.02) * (0.4 + k);
      this.raft.hull.position.y = Math.sin(t * 2.3) * (live ? 0.02 : 0.008);
    }
  }

  /* ---------------------------- plumbing --------------------------- */

  private qualityNote(): string {
    return `${this.renderer.domElement.width}x${this.renderer.domElement.height} / dpr ${this.renderer
      .getPixelRatio()
      .toFixed(2)}`;
  }

  setQuality(tier: QualityTier, auto: boolean): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.q = settingsFor(tier);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.q.pixelRatioCap));
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.sky.sun.castShadow = this.q.shadows;
    this.sky.sun.shadow.mapSize.set(this.q.shadowMapSize, this.q.shadowMapSize);
    this.sky.sun.shadow.map?.dispose();
    this.sky.sun.shadow.map = null;
    const caustic = causticTexture(this.q.causticRes);
    this.uniforms.uLTCaustic.value = caustic;
    this.uniforms.uLTCausticGain.value = tier === 'low' ? 0.5 : 1;
    this.scene.environmentIntensity = 0.65 + this.q.reflectionQuality * 0.35;
    this.spray.setBudget(this.q.dropletCount);
    if (this.factory) this.factory.visible = true;
    this.resize();
    this.hud.setQuality(tier, `${auto ? 'auto ' : ''}${this.qualityNote()}`);
  }

  /** Development inspection hook only; stripped from production builds. */
  devHook(): void {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__dev = {
      cam: (px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov = 46) => {
        this.focusHold = 1e6;
        this.rig.setShot(`dev${Math.random()}`, (out) => {
          out.pos.set(px, py, pz);
          out.target.set(tx, ty, tz);
        }, 0.01, fov);
      },
      anchors: () => ({
        port: this.portWorld.toArray(),
        collar: this.collarWorld.toArray(),
        patch: this.patch.toArray(),
        op: this.opDir.toArray(),
        axis: this.axisDir.toArray(),
        mouthIn: this.mouthIn.toArray(),
        mouthOut: this.mouthOut.toArray(),
        shelf: this.shelfWorld.toArray(),
        valve: this.valveWorld.toArray(),
        len: this.flume.path.length,
        sStart: this.flume.sStart,
        sEnd: this.flume.sEnd,
        sun: this.state.sunDir.toArray(),
      }),
      fit: (kind: number, flow: number) => {
        this.state.lidOpen = true;
        const plate = this.plates[kind];
        this.installed = plate;
        this.port.slot.attach(plate.group);
        plate.group.position.set(0, 0, 0);
        plate.group.quaternion.identity();
        this.state.panelKind = plate.kind;
        this.state.seat = 1;
        this.state.clamped = true;
        this.state.waterFlow = flow;
        this.state.wetness = flow;
        this.phase = 'lab';
      },
      launch: () => this.launchRaft(),
      pickAt: (x: number, y: number) => {
        const el = this.renderer.domElement;
        const r = el.getBoundingClientRect();
        const inp = this.input as unknown as {
          ray: { setFromCamera: (v: unknown, c: unknown) => void; intersectObjects: (o: unknown[], r: boolean) => unknown[] };
          grabs: Array<{ id: string; enabled: () => boolean; objects: () => unknown[] }>;
          ndc: { set: (a: number, b: number) => void };
          pointerId: number;
        };
        inp.ndc.set(((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1));
        inp.ray.setFromCamera(inp.ndc, this.rig.camera);
        return {
          rect: [r.left, r.top, r.width, r.height],
          pointerId: inp.pointerId,
          rows: inp.grabs.map((g) => ({
            id: g.id,
            on: g.enabled(),
            n: g.enabled() ? inp.ray.intersectObjects(g.objects() as never[], true).length : -1,
          })),
        };
      },
      focus: (f: string, d = 0.01) => {
        this.focusHold = 1e6;
        this.setFocus(f as Focus, d);
      },
      app: this,
    };
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.q.pixelRatioCap));
    this.renderer.setSize(w, h, false);
    this.rig.setViewport(w, h);
  }
}

const _q1 = new Quaternion();
/** the raft waits in the inlet trough, upstream of the barrel mouth */
const RAFT_HOME = 1.6;
