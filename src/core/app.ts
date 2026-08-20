import * as THREE from 'three';
import { AudioEngine } from '../audio/engine';
import { CameraDirector, type CameraMode, type FramingRequest } from '../camera/director';
import { buildEnvironment } from '../materials/envmap';
import { MaterialLibrary } from '../materials/library';
import { rubberBall, rubberFloor, sandFloor } from '../materials/recipes';
import { DropSimulation, type ContactPad, type ImpactEvent } from '../physics/engine';
import {
  BALLS,
  BALL_ORDER,
  DEFAULT_HEIGHT_INDEX,
  DROP_HEIGHTS,
  FLOORS,
  FLOOR_ORDER,
  GROUND_SPEC,
  type BallId,
  type FloorId,
} from '../physics/params';
import { GameState } from '../state/game';
import { DebugOverlay } from '../ui/debug';
import { HintDirector, type HintContext } from '../ui/hints';
import { Interaction, type InteractionHost } from '../ui/interaction';
import { clamp, clamp01 } from '../util/math';
import { BallView } from '../world/ball';
import { ChainArea } from '../world/chain';
import {
  CHAIN_DROP_Z,
  CHAIN_PADS,
  SLAB_Y,
  TILE_RACK_POS,
  TRAY_DROP_Z,
  TRAY_POCKET_R,
  TRAY_SURFACE_Y,
} from '../world/layout';
import type { DeformablePanel } from '../world/panel';
import { buildPavilion, type PavilionParts } from '../world/pavilion';
import { DropRig } from '../world/rig';
import { BallShelf } from '../world/shelf';
import { Brush } from '../world/tools';
import { Turntable } from '../world/turntable';
import { ParticleField, type DebrisKind } from '../world/particles';
import { PerformanceGovernor, detectQuality, settingsFor, type QualitySettings } from './quality';

const RELOAD_SECONDS = 1.05;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const _q = new THREE.Quaternion();
const _n = new THREE.Vector3();

const DEBRIS_FOR: Record<string, DebrisKind> = {
  sand: 'sand',
  clay: 'clay',
  water: 'water',
  felt: 'foam',
  rubber: 'dust',
  wood: 'dust',
  metal: 'dust',
  concrete: 'dust',
};

export class App implements InteractionHost {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private director = new CameraDirector();
  private lib!: MaterialLibrary;
  private quality!: QualitySettings;
  private governor = new PerformanceGovernor();

  private pavilion!: PavilionParts;
  private rig!: DropRig;
  private turntable!: Turntable;
  private shelf!: BallShelf;
  private chain!: ChainArea;
  private brush!: Brush;
  private particles!: ParticleField;
  private ball!: BallView;
  private audio = new AudioEngine();
  private sim!: DropSimulation;

  private state = new GameState();
  private hints = new HintDirector();
  private debug = new DebugOverlay();
  private interaction!: Interaction;

  private ballIndex = 0;
  private heightIndex = DEFAULT_HEIGHT_INDEX;
  private lastCommittedHeight = DEFAULT_HEIGHT_INDEX;
  private chainActive = false;

  private trayPad!: ContactPad;
  private groundPad!: ContactPad;
  private chainPads: ContactPad[] = [];

  private settled = false;
  private settleTimer = 0;
  private reloadT = -1;
  private reloadFrom = new THREE.Vector3();
  private trayPresented = false;
  private contactHold = 0;
  private ballPosition = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private tmpLocal = new THREE.Vector3();
  private lastTileWorld = new THREE.Vector3();
  private lastSweep = new THREE.Vector3(999, 999, 999);
  private frameRelease = new THREE.Vector3();
  private frameImpact = new THREE.Vector3();
  private frameExtra = Array.from({ length: 10 }, () => new THREE.Vector3());
  private frameRequest: FramingRequest = {
    mode: 'tray',
    release: new THREE.Vector3(),
    impact: new THREE.Vector3(),
    extra: [],
    extraCount: 0,
    portrait: true,
  };
  private sweepCooldown = 0;
  private userRingPull = 0;
  private paused = false;
  private running = false;
  private lastTime = 0;
  private safeTop = 0;
  private safeBottom = 0;
  private primed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  async init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.quality = detectQuality(this.renderer);
    this.lib = new MaterialLibrary(this.quality.textureScale, this.quality.anisotropy);

    this.scene.fog = new THREE.Fog(0xc6bfb1, 24, 78);
    this.scene.environment = buildEnvironment(this.renderer);
    await nextFrame();

    this.pavilion = buildPavilion(this.lib, this.quality.shadowMapSize);
    this.scene.add(this.pavilion.root);
    await nextFrame();

    this.rig = new DropRig(this.lib);
    this.scene.add(this.rig.group);
    await nextFrame();

    // Only the two surfaces the discovery sequence needs are baked before the
    // first frame; the rest fill in over the following frames.
    this.lib.prime(rubberFloor);
    this.lib.prime(sandFloor);
    this.lib.prime(rubberBall);

    this.turntable = new Turntable(this.lib, {
      fieldRes: this.quality.panelFieldRes,
      meshRes: this.quality.panelMeshRes,
      wearRes: this.quality.panelWearRes,
    });
    this.turntable.bakeSlot(0);
    this.turntable.bakeSlot(1);
    this.turntable.rotateTo(0, true);
    this.scene.add(this.turntable.group);
    await nextFrame();

    this.shelf = new BallShelf(this.lib, this.quality.ballSegments);
    this.shelf.bake(0);
    this.shelf.setActive(0);
    this.scene.add(this.shelf.group);

    this.chain = new ChainArea(this.lib, {
      fieldRes: this.quality.panelFieldRes,
      meshRes: this.quality.panelMeshRes,
      wearRes: this.quality.panelWearRes,
    });
    this.scene.add(this.chain.group);

    this.brush = new Brush(this.lib);
    this.scene.add(this.brush.group);

    this.particles = new ParticleField(this.quality.particleCount);
    this.scene.add(this.particles.points);
    await nextFrame();

    const ballSpec = BALLS[BALL_ORDER[0]];
    this.ball = new BallView(ballSpec, this.shelf.material(0), this.quality.ballSegments);
    this.scene.add(this.ball.group);
    this.scene.add(this.ball.shadow);

    this.sim = new DropSimulation(ballSpec);
    this.buildPads();
    this.sim.events = {
      onImpact: (e) => this.onImpact(e),
      onApex: () => this.onApex(),
      onSettle: () => this.onSettle(),
    };

    this.turntable.onSettled = (index) => this.onTraySettled(index);

    // Restore a session that a reload (or an orientation-triggered reload)
    // interrupted, so the child does not start over.
    const restored = GameState.restore();
    if (restored) this.state.applyRestored(restored as Record<string, unknown>);
    if (this.state.phase === 'boot') this.state.phase = 'trial1.ready';
    if (this.state.phase === 'free') this.restoreFreeMode();

    this.interaction = new Interaction(this.canvas, this.director.camera, this);
    this.resize();
    this.rig.setDropZ(this.chainActive ? CHAIN_DROP_Z : TRAY_DROP_Z, true);
    this.rig.setDropHeight(this.surfaceY(), DROP_HEIGHTS[this.heightIndex], ballSpec.radius, true);
    this.rig.update(0.016);
    this.sim.hold(this.rig.ballAnchor(this.tmp, ballSpec.radius));
    this.ballPosition.copy(this.sim.position);
    this.frameCamera(true);

    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', () => this.state.save());

    if (this.debug.enabled) this.exposeInspector();

    this.renderer.compile(this.scene, this.director.camera);
    this.start();
  }

  /**
   * Screen positions of the physical controls, published only under
   * `?debug=1`. It exists so an automated pass can drive the same controls a
   * child would; a normal session never defines it.
   */
  private exposeInspector() {
    const project = (obj: THREE.Object3D) => {
      const v = obj.getWorldPosition(new THREE.Vector3()).project(this.director.camera);
      return {
        x: ((v.x + 1) / 2) * window.innerWidth,
        y: ((1 - v.y) / 2) * window.innerHeight,
      };
    };
    (window as unknown as Record<string, unknown>).__lab = {
      screenOf: (name: string) => {
        if (name === 'ring') return project(this.rig.ringHandle);
        if (name === 'clamp') return project(this.rig.head);
        if (name === 'handle') return project(this.rig.carriageHandle);
        if (name === 'tray') return project(this.turntable.deck);
        if (name === 'brush') return project(this.brush.head);
        if (name.startsWith('ball')) return project(this.shelf.displays[Number(name.slice(4))]);
        if (name.startsWith('tile')) return project(this.chain.tiles[Number(name.slice(4))]);
        if (name.startsWith('pad')) {
          const i = Number(name.slice(3));
          const p = CHAIN_PADS[i];
          const v = new THREE.Vector3(p.x, p.y, p.z).project(this.director.camera);
          return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
        }
        return null;
      },
      impact: () => {
        const p = this.chainActive
          ? new THREE.Vector3(CHAIN_PADS[0].x, CHAIN_PADS[0].y, CHAIN_PADS[0].z)
          : new THREE.Vector3(0, TRAY_SURFACE_Y, TRAY_DROP_Z);
        const v = p.project(this.director.camera);
        return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
      },
      camera: () => ({
        eye: this.director.camera.position.toArray().map((v) => +v.toFixed(2)),
        target: this.director.lookTarget.toArray().map((v) => +v.toFixed(2)),
        fov: this.director.camera.fov,
        armHead: this.rig.head.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)),
        ring: this.rig.ring.position.toArray().map((v) => +v.toFixed(2)),
      }),
      /** What a press at this screen point would grab. */
      pickAt: (x: number, y: number) => {
        const rc = new THREE.Raycaster();
        rc.setFromCamera(
          new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1),
          this.director.camera
        );
        const hits = rc.intersectObjects(this.pickTargets(), false);
        return hits.length
          ? { pick: hits[0].object.userData.pick, index: hits[0].object.userData.ballIndex ?? hits[0].object.userData.floorIndex ?? null, name: hits[0].object.name }
          : null;
      },
      snapshot: () => ({
        phase: this.state.phase,
        unlocks: { ...this.state.unlocks },
        simPhase: this.sim.phase,
        floor: this.currentFloorId(),
        ball: this.currentBallId(),
        heightIndex: this.heightIndex,
        chainActive: this.chainActive,
        chainSlots: this.chain.slots.map((s) => s.floorId),
        drops: this.state.metrics.dropsTotal,
        apexY: this.peakY,
        ballY: this.ballPosition.y,
        marked: this.chainActive ? this.chain.slots[0].panel.marked : this.turntable.activePanel.marked,
      }),
      /** Jump the tray straight to a sample, for automated material checks. */
      setFloor: (id: string) => {
        const i = FLOOR_ORDER.indexOf(id as FloorId);
        if (i < 0) return false;
        this.turntable.rotateTo(i, true);
        this.updatePads();
        return true;
      },
      /** Force a stage open, so later stages can be exercised without waiting. */
      unlock: (what: 'balls' | 'height' | 'chain') => {
        this.state.unlocks.floors = true;
        if (what === 'balls' || what === 'height' || what === 'chain') this.state.unlocks.balls = true;
        if (what === 'height' || what === 'chain') this.state.unlocks.height = true;
        if (what === 'chain') this.state.unlocks.chain = true;
      },
    };
  }

  private restoreFreeMode() {
    this.state.unlocks.floors = true;
    if (this.state.unlocks.chain) this.activateChain();
  }

  // -------------------------------------------------------------------------
  // Contact pads
  // -------------------------------------------------------------------------

  private buildPads() {
    this.trayPad = {
      id: 'tray',
      spec: FLOORS[this.turntable.activeFloorId],
      center: new THREE.Vector3(0, TRAY_SURFACE_Y, TRAY_DROP_Z),
      quaternion: new THREE.Quaternion(),
      shape: 'circle',
      halfX: TRAY_POCKET_R,
      halfZ: TRAY_POCKET_R,
      depthAt: (lx, lz) => this.turntable.activePanel.depthAt(lx, lz),
      enabled: true,
    };

    this.groundPad = {
      id: 'ground',
      spec: GROUND_SPEC,
      center: new THREE.Vector3(0, SLAB_Y, 0.1),
      quaternion: new THREE.Quaternion(),
      shape: 'rect',
      halfX: 3.3,
      halfZ: 3.1,
      enabled: true,
    };

    this.chainPads = CHAIN_PADS.map((cfg, i) => ({
      id: `chain${i}`,
      spec: FLOORS.rubber,
      center: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
      quaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, (cfg.tilt * Math.PI) / 180)
      ),
      shape: 'rect' as const,
      halfX: cfg.halfX,
      halfZ: cfg.halfZ,
      depthAt: (lx: number, lz: number) => this.chain.slots[i].panel.depthAt(lx, lz),
      enabled: false,
    }));

    this.updatePads();
  }

  private updatePads() {
    if (this.chainActive) {
      for (let i = 0; i < this.chainPads.length; i++) {
        const slot = this.chain.slots[i];
        this.chainPads[i].enabled = slot.floorId !== null;
        if (slot.floorId) this.chainPads[i].spec = FLOORS[slot.floorId];
      }
      this.sim.pads = [...this.chainPads.filter((p) => p.enabled), this.groundPad];
    } else {
      this.trayPad.spec = FLOORS[this.turntable.activeFloorId];
      this.sim.pads = [this.trayPad, this.groundPad];
    }
  }

  private panelForPad(pad: ContactPad): DeformablePanel | null {
    if (pad.id === 'tray') return this.turntable.activePanel;
    const m = /^chain(\d)$/.exec(pad.id);
    if (m) return this.chain.slots[Number(m[1])].panel;
    return null;
  }

  private surfaceY() {
    if (this.chainActive) return CHAIN_PADS[0].y;
    return TRAY_SURFACE_Y;
  }

  private currentFloorId(): FloorId {
    if (this.chainActive) return this.chain.slots[0].floorId ?? this.turntable.activeFloorId;
    return this.turntable.activeFloorId;
  }

  private currentBallId(): BallId {
    return BALL_ORDER[this.ballIndex];
  }

  /** Height of whatever surface is directly beneath a world point. */
  private surfaceUnder(point: THREE.Vector3) {
    let best = SLAB_Y;
    for (const pad of this.sim.pads) {
      if (!pad.enabled) continue;
      _q.copy(pad.quaternion).invert();
      this.tmpLocal.copy(point).sub(pad.center).applyQuaternion(_q);
      const inside =
        pad.shape === 'circle'
          ? Math.hypot(this.tmpLocal.x, this.tmpLocal.z) <= pad.halfX
          : Math.abs(this.tmpLocal.x) <= pad.halfX && Math.abs(this.tmpLocal.z) <= pad.halfZ;
      if (!inside) continue;
      _n.set(0, 1, 0).applyQuaternion(pad.quaternion);
      const y =
        pad.center.y - (_n.x * (point.x - pad.center.x) + _n.z * (point.z - pad.center.z)) / Math.max(_n.y, 0.2);
      const carved = pad.depthAt ? pad.depthAt(this.tmpLocal.x, this.tmpLocal.z) : 0;
      best = Math.max(best, y - carved);
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Trial sequencing
  // -------------------------------------------------------------------------

  private canRelease() {
    return (
      this.sim.phase === 'held' &&
      this.reloadT < 0 &&
      (this.state.phase === 'trial1.ready' || this.state.phase === 'trial2.ready' || this.state.phase === 'free')
    );
  }

  private doRelease() {
    if (!this.canRelease()) return;
    this.audio.release();
    this.rig.openClamp();
    this.sim.release();
    this.settled = false;
    this.settleTimer = 0;
    this.hints.interrupt();
    this.state.noteDrop(this.currentFloorId(), this.currentBallId(), this.heightIndex);
    if (this.chainActive) this.state.noteChainRun(this.chain.filledCount);
    if (this.state.phase === 'trial1.ready') this.state.phase = 'trial1.falling';
    else if (this.state.phase === 'trial2.ready') this.state.phase = 'trial2.falling';
  }

  /** Highest point of the most recent rebound, for verification only. */
  private peakY = 0;

  private onApex() {
    this.peakY = this.ballPosition.y;
    // The frame has been holding the whole fall since before the release, so
    // there is nothing to widen here. Once the ball has peaked we are free to
    // let the camera ease back out of its contact push-in.
    this.contactHold = Math.min(this.contactHold, 0.25);
  }

  private onSettle() {
    this.settled = true;
    this.settleTimer = 0;
    if (this.state.phase === 'trial1.falling') this.state.phase = 'trial1.result';
    if (this.state.phase === 'trial2.falling') this.state.phase = 'trial2.result';
  }

  private startReload() {
    this.reloadT = 0;
    this.reloadFrom.copy(this.ballPosition);
  }

  private finishReload() {
    this.reloadT = -1;
    this.settled = false;
    this.rig.closeClamp();
    this.sim.hold(this.rig.ballAnchor(this.tmp, this.sim.ball.radius));
    this.ballPosition.copy(this.sim.position);
    this.audio.pick();
    if (this.state.phase === 'trial2.result') {
      this.state.enterFree();
      this.state.idle = 0;
    }
  }

  private beginPresenting() {
    // The machine presents the second sample itself: same ball, same height,
    // one thing changed. The child is not asked to set anything up.
    this.state.phase = 'presenting';
    this.trayPresented = false;
    this.audio.motor(true);
    this.turntable.rotateTo(1);
    this.state.noteFloorChange(false);
  }

  private onTraySettled(index: number) {
    this.audio.motor(false);
    this.updatePads();
    if (this.state.phase === 'presenting') {
      this.trayPresented = true;
    }
    if (this.chainActive) this.chain.setSlot(0, FLOOR_ORDER[index]);
    this.updatePads();
  }

  private activateChain() {
    if (this.chainActive) return;
    this.chainActive = true;
    this.chain.group.visible = true;
    this.chain.primeTiles();
    this.chain.setSlot(0, this.turntable.activeFloorId);
    this.rig.setDropZ(CHAIN_DROP_Z);
    // The brush moves out to the yard with the test.
    this.brush.setHome(0.55, 0.24, CHAIN_DROP_Z + 0.34);
    this.updatePads();
    if (this.sim.phase === 'held') {
      this.rig.setDropHeight(this.surfaceY(), DROP_HEIGHTS[this.heightIndex], this.sim.ball.radius);
    }
  }

  private setBall(index: number) {
    if (index === this.ballIndex) return;
    this.ballIndex = index;
    const spec = BALLS[BALL_ORDER[index]];
    this.shelf.setActive(index);
    this.ball.setSpec(spec, this.shelf.material(index));
    this.sim.ball = spec;
    this.rig.setDropHeight(this.surfaceY(), DROP_HEIGHTS[this.heightIndex], spec.radius);
    this.rig.update(0.001);
    this.sim.hold(this.rig.ballAnchor(this.tmp, spec.radius));
    this.ballPosition.copy(this.sim.position);
    this.state.noteBallChange();
    this.audio.pick();
  }

  // -------------------------------------------------------------------------
  // Impacts
  // -------------------------------------------------------------------------

  private onImpact(e: ImpactEvent) {
    const panel = this.panelForPad(e.pad);
    const spec = e.floor;

    if (panel && spec.mark !== 'none') {
      panel.carve(e.localX, e.localZ, e.surfaceSink, e.ball.radius, spec.mark, e.energy);
    }

    if (spec.id === 'water') {
      this.turntable.water.splash(e.localX, e.localZ, e.energy);
      this.ball.wet(0.45 + 0.55 * e.energy);
    }

    const debris = Math.round(spec.debris * (0.3 + e.energy * 1.0));
    if (debris > 0) {
      this.particles.burst(
        DEBRIS_FOR[spec.id] ?? 'dust',
        e.point,
        debris,
        e.energy,
        e.point.y,
        spec.id === 'water' ? 1.15 : 1
      );
    }
    // A hard landing on a dry surface lifts a little dust even when the
    // surface itself does not shed anything.
    if (spec.debris === 0 && e.energy > 0.4 && e.index === 1) {
      this.particles.burst('dust', e.point, 5, e.energy * 0.5, e.point.y, 0.8);
    }

    this.audio.impact({
      voice: spec.voice,
      energy: e.energy,
      mass: e.ball.mass,
      brightness: e.ball.brightness,
      ring: e.ball.ring,
      pan: this.director.panOf(e.point) * 0.6,
    });

    if (e.index === 1) {
      // The one camera move of the whole sequence: a small, slow push towards
      // the contact, started as the ball arrives and released after the apex.
      this.director.emphasiseContact(0.65 + 0.35 * e.energy);
      this.contactHold = e.duration + 0.7;
    }
    this.director.impulse(e.energy * (spec.id === 'metal' ? 0.45 : 0.28));
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private frameCamera(immediate = false) {
    const mode: CameraMode = this.chainActive ? 'chain' : 'tray';
    this.rig.ballAnchor(this.frameRelease, this.sim.ball.radius);
    if (this.chainActive) this.frameImpact.set(CHAIN_PADS[0].x, CHAIN_PADS[0].y, CHAIN_PADS[0].z);
    else this.frameImpact.set(0, TRAY_SURFACE_Y, TRAY_DROP_Z);

    // Runs every frame, so the point list is preallocated and refilled rather
    // than rebuilt.
    const extra = this.frameExtra;
    let n = 0;
    extra[n++].copy(this.rig.ring.position);
    // The specimen rail is a control the child has to be able to reach, so
    // both ends of it stay inside the frame in every mode.
    if (this.state.unlocks.balls) {
      this.shelf.extentsInto(extra[n++], extra[n++]);
    }
    if (this.chainActive) {
      for (const cfg of CHAIN_PADS) extra[n++].set(cfg.x, cfg.y, cfg.z);
      // The spare-tile rack is a control, so it has to stay on screen.
      extra[n++].set(TILE_RACK_POS.x, 0.24, TILE_RACK_POS.z);
    }
    // Once the ball has passed its first peak we may follow it, so a ball that
    // rolls off the sample is never lost off the edge of the screen.
    if (!this.sim.airborne && this.sim.phase !== 'contact' && this.sim.phase !== 'held') {
      extra[n++].copy(this.ballPosition);
    }

    this.frameRequest.mode = mode;
    this.frameRequest.release = this.frameRelease;
    this.frameRequest.impact = this.frameImpact;
    this.frameRequest.extra = extra;
    this.frameRequest.extraCount = n;
    this.frameRequest.portrait = window.innerHeight >= window.innerWidth;
    this.director.frame(this.frameRequest, immediate);
  }

  private hintContext(): HintContext {
    if (this.sim.phase !== 'held' || this.reloadT >= 0) return 'none';
    const s = this.state;
    if (!s.unlocks.floors) return 'ring';
    if (s.unlocks.chain && this.chain.filledCount < 2 && s.dropsOnCurrentFloor >= 1) return 'tile';
    if (s.unlocks.height && s.childHeightChanges === 0 && s.dropsOnCurrentFloor >= 2) return 'height';
    if (s.unlocks.balls && s.childBallChanges === 0 && s.dropsOnCurrentFloor >= 2) return 'shelf';
    if (s.childFloorChanges === 0 && s.dropsOnCurrentFloor >= 2) return 'tray';
    return 'ring';
  }

  private applyHints(dt: number) {
    const ctx = this.hintContext();
    this.hints.setContext(ctx);
    this.hints.update(dt, this.state.idle);
    if (this.hints.consumeSound()) this.audio.hintTap();

    this.turntable.nudge = ctx === 'tray' ? this.hints.objectNudge : 0;
    this.shelf.nudge = ctx === 'shelf' ? this.hints.objectNudge : 0;
    this.chain.nudge = ctx === 'tile' ? this.hints.objectNudge : 0;
    this.rig.handleNudge = ctx === 'height' ? this.hints.objectNudge : 0;

    const dragging = this.interaction.dragKind === 'ring';
    this.rig.ringPull = dragging
      ? this.userRingPull
      : Math.max(this.hints.ringDip, this.hints.ghostPull);
  }

  private update(dt: number) {
    this.state.tick(dt);
    this.applyHints(dt);

    if (this.state.unlocks.chain && !this.chainActive) this.activateChain();
    this.shelf.setOpen(this.state.unlocks.balls);

    // --- simulation -------------------------------------------------------
    if (this.sim.phase === 'held') {
      this.rig.ballAnchor(this.tmp, this.sim.ball.radius);
      // The specimen stirs very slightly in the clamp — the first rung of the
      // hint ladder, and the only thing that ever moves before the release.
      const j = this.hints.ballJiggle;
      const t = performance.now() * 0.001;
      this.tmp.x += Math.sin(t * 7.1) * 0.0022 * j;
      this.tmp.z += Math.sin(t * 5.3 + 1.7) * 0.0018 * j;
      this.tmp.y += Math.sin(t * 9.4) * 0.0016 * j;
      this.sim.position.copy(this.tmp);
      this.sim.spin.multiplyScalar(Math.exp(-2 * dt));
    } else if (this.reloadT < 0) {
      this.sim.update(dt);
    }

    // --- the surface giving way under the ball ----------------------------
    const contactPad = this.sim.phase === 'contact' ? this.sim.activePad : null;
    for (const p of this.turntable.panels) if (p !== this.turntable.activePanel) p.clearTransient();
    if (contactPad) {
      const panel = this.panelForPad(contactPad);
      if (panel) {
        panel.setTransient(
          this.sim.contactLocalX,
          this.sim.contactLocalZ,
          this.sim.surfaceSinkNow,
          this.sim.ball.radius * 1.7
        );
      }
    } else {
      this.turntable.activePanel.clearTransient();
      for (const s of this.chain.slots) s.panel.clearTransient();
    }

    // --- reload -----------------------------------------------------------
    if (this.settled) {
      this.settleTimer += dt;
      const busy = this.interaction.isDragging || this.brush.isCarried;
      if (this.state.phase === 'trial1.result' && this.settleTimer > 1.15 && !this.trayPresented) {
        this.beginPresenting();
      }
      if (this.reloadT < 0 && this.settleTimer > 1.55 && !busy) this.startReload();
    }

    if (this.reloadT >= 0) {
      this.reloadT += dt / RELOAD_SECONDS;
      const t = clamp01(this.reloadT);
      const ease = t * t * (3 - 2 * t);
      this.rig.ballAnchor(this.tmp, this.sim.ball.radius);
      this.ballPosition.lerpVectors(this.reloadFrom, this.tmp, ease);
      // Lift it clear of the surface before carrying it across.
      this.ballPosition.y += Math.sin(ease * Math.PI) * 0.12;
      this.sim.position.copy(this.ballPosition);
      if (this.reloadT >= 1) this.finishReload();
    } else {
      this.ballPosition.copy(this.sim.position);
    }

    if (this.state.phase === 'presenting' && this.trayPresented && this.sim.phase === 'held' && this.reloadT < 0) {
      this.state.phase = 'trial2.ready';
      this.state.idle = 0;
      this.hints.interrupt();
    }

    // --- camera -----------------------------------------------------------
    if (this.contactHold > 0) {
      this.contactHold -= dt;
      if (this.contactHold <= 0) this.director.releaseContact();
    } else if (this.settled && this.settleTimer > 0.85 && this.settleTimer < 2.6) {
      // Only after the first peak do we lean in on the mark that was left.
      this.director.emphasiseContact(0.4);
    } else if (!this.settled) {
      this.director.releaseContact();
    } else if (this.settleTimer >= 2.6) {
      this.director.releaseContact();
    }
    this.frameCamera();
    this.director.update(dt);

    // --- world ------------------------------------------------------------
    this.rig.update(dt);
    this.turntable.update(dt);
    this.chain.update(dt);
    this.shelf.update(dt);
    this.brush.update(dt);
    this.particles.update(dt);

    const groundY = this.surfaceUnder(this.ballPosition);
    this.ball.update(dt, this.ballPosition, this.sim.spin, this.sim.squashAmount, this.sim.squashAxis, groundY);

    // --- rolling audio ----------------------------------------------------
    if (this.sim.phase === 'rolling' && this.sim.activePad) {
      this.audio.roll(this.sim.velocity.length(), this.sim.activePad.spec.voice, this.sim.ball.radius);
    } else {
      this.audio.roll(0, 'concrete', this.sim.ball.radius);
    }

    this.sweepCooldown = Math.max(0, this.sweepCooldown - dt);

    // --- progressive baking, one specimen per frame -----------------------
    if (!this.primed && this.state.elapsed > 0.4) {
      if (!this.turntable.primeNext() && !this.shelf.primeNext()) this.primed = true;
    }

    // --- adaptive quality --------------------------------------------------
    if (this.governor.update(dt) === 'down') this.stepQualityDown();
  }

  private stepQualityDown() {
    const order: Array<QualitySettings['tier']> = ['high', 'medium', 'low'];
    const i = order.indexOf(this.quality.tier);
    if (i >= order.length - 1) return;
    const next = settingsFor(order[i + 1]);
    // Textures and meshes stay as they are — rebuilding them mid-play would
    // stutter far worse than the frame we are trying to save. Pixels and the
    // shadow map are what actually cost, so those are what give.
    this.quality = { ...this.quality, tier: next.tier, pixelRatioCap: next.pixelRatioCap, shadowMapSize: next.shadowMapSize };
    this.applyPixelRatio();
    const sun = this.pavilion.sun;
    sun.shadow.mapSize.set(next.shadowMapSize, next.shadowMapSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    if (next.tier === 'low') {
      // The contact shadow under the ball survives even here: it is the cue
      // that keeps the ball attached to the floor.
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  private applyPixelRatio() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap);
    this.renderer.setPixelRatio(dpr);
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  private start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    document.getElementById('boot')?.classList.add('gone');
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.tick);
    if (this.paused) return;
    // Cap the step at a tenth of a second: long enough that a hitching device
    // still advances in real time, short enough that a tab left in the
    // background does not resume with one enormous jump.
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.update(dt);
    this.renderer.render(this.scene, this.director.camera);
    this.debug.update(dt, this.renderer, this.state, FLOORS[this.currentFloorId()], this.sim.ball, this.heightIndex, {
      tier: this.quality.tier,
      chainSlots: this.chain.filledCount,
      particles: this.particles.activeCount,
    });
  };

  private onVisibility = () => {
    this.paused = document.hidden;
    this.audio.setSuspended(document.hidden);
    if (document.hidden) this.state.save();
    else this.lastTime = performance.now();
  };

  private readSafeAreas() {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    this.safeTop = parseFloat(cs.paddingTop) || 0;
    this.safeBottom = parseFloat(cs.paddingBottom) || 0;
    probe.remove();
  }

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.readSafeAreas();
    this.applyPixelRatio();
    this.renderer.setSize(w, h, false);
    this.director.setViewport(w, h, this.safeTop, this.safeBottom);
    this.particles?.setProjection(h, this.director.camera.fov);
    this.interaction?.setViewport(w, h);
    // Nothing else is touched: the ball, the sample, every mark on it and the
    // stage of the sequence all survive a rotation untouched.
    this.frameCamera(false);
  };

  // -------------------------------------------------------------------------
  // InteractionHost
  // -------------------------------------------------------------------------

  pickTargets(): THREE.Object3D[] {
    const t: THREE.Object3D[] = [this.rig.ringHandle, this.brush.proxy];
    if (this.state.unlocks.floors) t.push(...this.turntable.pickables);
    if (this.state.unlocks.balls) t.push(...this.shelf.proxies);
    if (this.state.unlocks.height) t.push(this.rig.carriageHandle);
    if (this.state.unlocks.chain) t.push(...this.chain.tileProxies);
    return t;
  }

  clampPosition(target: THREE.Vector3) {
    return this.rig.ballAnchor(target, this.sim.ball.radius);
  }

  brushPlaneY() {
    return this.chainActive ? CHAIN_PADS[0].y : TRAY_SURFACE_Y;
  }

  tilePlaneY() {
    return 0.12;
  }

  canPull() {
    return this.canRelease();
  }

  canChangeFloor() {
    // Out in the yard the sample tray is behind the camera; materials are
    // chosen there by carrying a tile to a cradle instead.
    return (
      this.state.unlocks.floors && !this.chainActive && this.sim.phase === 'held' && this.reloadT < 0
    );
  }

  canChangeBall() {
    return this.state.unlocks.balls && this.sim.phase === 'held' && this.reloadT < 0;
  }

  canChangeHeight() {
    return this.state.unlocks.height && this.sim.phase === 'held' && this.reloadT < 0;
  }

  canArrange() {
    return this.state.unlocks.chain && this.chainActive;
  }

  onTouch() {
    this.audio.unlock();
    this.state.touched();
    this.hints.interrupt();
  }

  onRingPull(t: number) {
    this.userRingPull = t;
    this.rig.ringPull = t;
  }

  onRingCommit() {
    this.userRingPull = 1;
    this.doRelease();
    // Let the ring spring back on its own once the clamp has let go.
    this.userRingPull = 0;
  }

  onRingCancel() {
    this.userRingPull = 0;
  }

  onFloorStep(dir: number) {
    if (!this.canChangeFloor()) return;
    this.turntable.step(dir);
    this.audio.motor(true);
    this.state.noteFloorChange(true);
  }

  onBallCarry(index: number, world: THREE.Vector3 | null) {
    this.shelf.carry(index, world);
  }

  onBallDropped(index: number, accepted: boolean) {
    this.shelf.restore(index);
    if (accepted) this.setBall(index);
  }

  onHeightPreview(index: number) {
    this.heightIndex = clamp(index, 0, DROP_HEIGHTS.length - 1);
    this.rig.setDropHeight(this.surfaceY(), DROP_HEIGHTS[this.heightIndex], this.sim.ball.radius);
  }

  onHeightCommit(index: number) {
    this.onHeightPreview(index);
    if (this.heightIndex !== this.lastCommittedHeight) {
      this.lastCommittedHeight = this.heightIndex;
      this.state.noteHeightChange();
      this.audio.place();
    }
  }

  onTileCarry(tileIndex: number, world: THREE.Vector3) {
    this.lastTileWorld.copy(world);
    this.chain.carryTile(tileIndex, world);
    this.chain.setHighlight(this.chain.nearestSlot(world));
  }

  onTileDropped(tileIndex: number) {
    const slot = this.chain.nearestSlot(this.lastTileWorld);
    this.chain.restoreTile(tileIndex);
    this.chain.setHighlight(-1);
    if (slot < 0) return;
    this.chain.setSlot(slot, this.chain.floorIdForTile(tileIndex));
    this.updatePads();
    this.audio.place();
    this.state.idle = 0;
  }

  onBrushStroke(world: THREE.Vector3) {
    this.brush.pickUp();
    this.brush.moveTo(world, this.brushPlaneY());
    const panel = this.panelUnder(world);
    if (!panel) return;
    const moved = this.lastSweep.distanceTo(world);
    if (moved < 0.012) return;
    this.lastSweep.copy(world);
    panel.group.worldToLocal(this.tmpLocal.copy(world));
    const touched = panel.sweep(this.tmpLocal.x, this.tmpLocal.z, 0.1, 0.3);
    if (touched > 0 && this.sweepCooldown <= 0) {
      this.audio.sweep(clamp01(touched / 40));
      this.sweepCooldown = 0.16;
      this.state.noteSweep();
    }
  }

  onBrushEnd() {
    this.brush.drop();
    this.lastSweep.set(999, 999, 999);
  }

  currentHeightIndex() {
    return this.heightIndex;
  }

  private panelUnder(world: THREE.Vector3): DeformablePanel | null {
    if (this.chainActive) {
      const slot = this.chain.nearestSlot(world, 0.45);
      if (slot >= 0 && this.chain.slots[slot].floorId) return this.chain.slots[slot].panel;
      return null;
    }
    const d = Math.hypot(world.x, world.z - TRAY_DROP_Z);
    return d <= TRAY_POCKET_R ? this.turntable.activePanel : null;
  }
}
