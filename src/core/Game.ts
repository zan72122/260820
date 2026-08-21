import * as THREE from 'three';
import { Simulation } from './Simulation';
import { GameState, StateMachine, isBlasting } from './StateMachine';
import { AdaptiveQuality, QualitySettings } from './AdaptiveQuality';
import { CAMERA, PHYSICS } from './Config';
import { clamp } from './Rng';
import { Environment } from '../world/Environment';
import { TestSection } from '../world/Structure';
import { Scenery } from '../world/Scenery';
import { flumeShellGeometry, endCapGeometry } from '../course/CourseGeometry';
import { frpMaps, concreteMaps, withRepeat } from '../world/Textures';
import { NozzleBank } from '../course/NozzleBank';
import { WaterSurfaceRenderer } from '../water/WaterSurfaceRenderer';
import { JetRenderer } from '../water/JetRenderer';
import { FoamField } from '../water/FoamField';
import { SplashEffect } from '../water/SplashEffect';
import { TrailReview } from '../water/TrailReview';
import { RaftView } from '../raft/RaftView';
import { BallastRig } from '../raft/BallastPreset';
import { CameraRail, RailContext } from '../camera/CameraRail';
import { PumpAudioController } from '../audio/PumpAudioController';
import { BlastLever } from '../ui/BlastLever';
import { InputController } from '../ui/InputController';
import { ChildGuidanceState } from '../ui/ChildGuidanceState';
import { ReplayController } from '../ui/ReplayController';

export interface GameOptions {
  fast: boolean;
}

/**
 * Wiring. The rule the game teaches lives in Simulation; this class makes it
 * visible, audible and touchable, and walks the state machine that decides
 * which framing and which hint belongs to the current moment.
 */
export class Game {
  readonly sim = new Simulation();
  readonly machine = new StateMachine();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly quality: AdaptiveQuality;
  private readonly environment: Environment;
  private readonly structure: TestSection;
  private readonly scenery = new Scenery();
  private readonly nozzles: NozzleBank;
  private readonly water: WaterSurfaceRenderer;
  private readonly jets: JetRenderer;
  private readonly foam: FoamField;
  private readonly splash: SplashEffect;
  private readonly trail = new TrailReview();
  private readonly raftView = new RaftView();
  private readonly ballast: BallastRig;
  private readonly rail: CameraRail;
  private readonly audio = new PumpAudioController();
  private readonly lever: BlastLever;
  private readonly input: InputController;
  private readonly guidance: ChildGuidanceState;
  private readonly replay = new ReplayController();

  private leverPressed = false;
  private portrait = false;
  private lastTime = 0;
  private running = false;
  private reviewShown = false;
  /** Monotonic counters so a test can tell runs apart without timing luck. */
  private crestCount = 0;
  private finishCount = 0;
  private sceneryLoaded = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly dragPlane = new THREE.Plane();
  private readonly tmpVec = new THREE.Vector3();
  private readonly tmpVec2 = new THREE.Vector3();
  private settings: QualitySettings;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    ui: HTMLElement,
    private readonly options: GameOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !options.fast,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.72;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.quality = new AdaptiveQuality(this.renderer, options.fast);
    this.settings = this.quality.current;
    this.renderer.shadowMap.enabled = this.settings.shadows;

    this.camera = new THREE.PerspectiveCamera(
      CAMERA.FOV_LANDSCAPE,
      window.innerWidth / Math.max(1, window.innerHeight),
      CAMERA.NEAR,
      CAMERA.FAR,
    );
    this.scene.add(this.camera);

    this.environment = new Environment(this.scene, this.renderer, {
      shadows: this.settings.shadows,
      shadowSize: this.settings.shadowSize,
    });

    this.structure = new TestSection(this.sim.spline);
    this.scene.add(this.structure.group);

    this.buildFlume();

    this.nozzles = new NozzleBank(this.sim.spline, this.sim.blast);
    this.scene.add(this.nozzles.group);

    this.water = new WaterSurfaceRenderer(this.sim.spline, {
      caustics: this.settings.caustics,
      secondFilmLayer: this.settings.secondFilmLayer,
    });
    this.scene.add(this.water.group);

    this.jets = new JetRenderer(this.nozzles.instances, this.sim.blast, {
      rings: this.settings.jetRings,
      segments: this.settings.jetSegments,
      sleeve: this.settings.jetSleeve,
    });
    this.scene.add(this.jets.group);

    this.foam = new FoamField(this.settings.foamParticles, this.settings.droplets);
    this.scene.add(this.foam.group);
    this.splash = new SplashEffect(this.foam, this.settings.caustics ? 3 : 2);
    this.scene.add(this.splash.group);
    this.scene.add(this.trail.group);

    this.scene.add(this.raftView.group);
    this.ballast = new BallastRig(this.raftView, this.structure.benchOrigin, 3);
    this.scene.add(this.ballast.group);
    this.scene.add(this.scenery.group);

    this.rail = new CameraRail(this.camera, this.sim.spline, this.sim.marks);
    this.lever = new BlastLever(this.camera);

    this.guidance = new ChildGuidanceState({
      nozzlePulse: (s) => this.nozzles.pulse(s),
      drip: () => {
        this.audio.drip();
        const live = this.sim.blast.nozzles.find((n) => n.supplied);
        if (live) {
          this.foam.emitDrops(live.position.clone().addScaledVector(live.direction, 0.16), 1, 0.4);
        }
      },
      rockRaft: () => {
        this.sim.raft.bobVel += 0.5;
        this.sim.raft.swayVel += 0.35;
      },
      leverShiver: (s) => this.lever.nudge(s),
      launchNudge: () => {
        this.audio.clunk(1.3);
        this.sim.raft.bobVel += 0.35;
      },
    });

    this.input = new InputController(canvas, ui, {
      onFirstGesture: () => this.audio.start(),
      onSwipeForward: () => this.handleSwipe(),
      onLeverChange: (pressed) => this.handleLever(pressed),
      onDragStart: (ndc) => this.handleDragStart(ndc),
      onDragMove: (ndc) => this.handleDragMove(ndc),
      onDragEnd: () => this.handleDragEnd(),
      onReplay: () => this.handleReplayButton(),
    });

    this.quality.onChange = (s) => this.applyQuality(s);

    this.sim.applyRun(this.replay.runIndex);
    this.sim.stage();
    this.ballast.applyPreset(this.replay.preset.bags);
    this.sim.raft.bags = this.ballast.deckCount;

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.audio.suspend();
      else this.audio.resume();
    });
    this.onResize();
  }

  /** Moulded FRP shell plus the plate that closes it off at the runout. */
  private buildFlume(): void {
    const maps = frpMaps();
    const mat = new THREE.MeshStandardMaterial({
      // Coloured gel coat, the way a real flume is moulded: it also gives the
      // white raft and the white water something to read against.
      color: 0x86b6c4,
      roughness: 0.22,
      metalness: 0.0,
      map: maps.map,
      roughnessMap: maps.roughnessMap,
      normalMap: maps.normalMap,
      envMapIntensity: 1.15,
      side: THREE.DoubleSide,
    });
    mat.normalScale.set(0.55, 0.55);
    const shell = new THREE.Mesh(flumeShellGeometry(this.sim.spline), mat);
    shell.castShadow = true;
    shell.receiveShadow = true;
    this.scene.add(shell);

    const capMaps = withRepeat(concreteMaps(), 2, 2);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xc6c4bc,
      roughness: 0.9,
      map: capMaps.map,
      normalMap: capMaps.normalMap,
    });
    const cap = new THREE.Mesh(endCapGeometry(this.sim.spline, this.sim.spline.length - 0.05), capMat);
    cap.receiveShadow = true;
    this.scene.add(cap);
  }

  private applyQuality(s: QualitySettings): void {
    this.settings = s;
    this.renderer.shadowMap.enabled = s.shadows;
    this.environment.setShadows(s.shadows, s.shadowSize);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.machine.go(GameState.OBSERVE_VALLEY);
    this.rail.setShot('overview', true);
    this.renderer.setAnimationLoop(this.tick);
  }

  private lastW = 0;
  private lastH = 0;

  /** Some mobile browsers fire resize before the viewport has settled after a
   *  rotation, so the size is polled as well as listened for. */
  private syncViewport(): void {
    if (window.innerWidth !== this.lastW || window.innerHeight !== this.lastH) {
      this.onResize();
    }
  }

  private tick = (): void => {
    this.syncViewport();
    const now = performance.now();
    const dt = clamp((now - this.lastTime) / 1000, 0, PHYSICS.MAX_FRAME_DT);
    this.lastTime = now;
    this.advance(dt);
    this.renderer.render(this.scene, this.camera);
    this.quality.update(dt);

    if (!this.sceneryLoaded && this.machine.state !== GameState.BOOT) {
      this.sceneryLoaded = true;
      // The park beyond the fence only loads once the test section is playable.
      const build = () => this.scenery.build();
      const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
        .requestIdleCallback;
      if (idle) idle(build);
      else window.setTimeout(build, 350);
    }
  };

  /** One simulation + presentation step. Split out so tests can drive it. */
  advance(dt: number): void {
    this.syncViewport();
    const events = this.sim.update(dt, this.leverPressed);
    this.machine.update(dt);
    this.updateFlow(dt, events);

    this.sim.raft.bags = this.ballast.deckCount;
    this.raftView.update(this.sim.spline, this.sim.raft);
    this.raftView.group.updateMatrixWorld(true);
    this.ballast.update(dt);
    this.nozzles.update(dt);
    this.jets.update(dt);
    this.water.setBlastFlow(this.sim.blast.charge);
    this.water.update(dt);
    this.trail.update(dt);

    this.emitContactFoam(dt);
    this.foam.update(dt);
    this.splash.update(dt, this.camera);

    this.structure.setHoldBack(!this.sim.armed, dt);

    const raftPos = this.sim.spline.positionAt(this.sim.raft.s, this.tmpVec);
    this.environment.focusShadow(raftPos.x, raftPos.y);

    const ctx: RailContext = {
      raftPosition: raftPos,
      raftS: this.sim.raft.s,
      speed: Math.abs(this.sim.raft.v),
      portrait: this.portrait,
      aspect: this.camera.aspect,
      pumpLevel: this.sim.blast.charge,
      reduceMotion: this.settings.reduceMotion,
    };
    this.rail.update(dt, ctx);

    this.lever.update(dt, this.leverPressed ? 1 : 0, this.sim.blast.charge);
    this.lever.setLocked(!this.sim.armed);

    let flow = 0;
    for (const n of this.sim.blast.nozzles) flow = Math.max(flow, n.flow);
    this.audio.update(
      this.sim.blast.charge,
      flow,
      Math.abs(this.sim.raft.v),
      this.sim.pushOnRaft,
    );

    this.guidance.update(dt, this.machine.state, this.sim.blast.charge);
  }

  private emitContactFoam(dt: number): void {
    const contact = this.sim.pushOnRaft;
    if (contact > 0.02) {
      for (const point of this.jets.contacts) {
        this.foam.emitFoam(point, contact * 95 * dt, 0.2, 1.35);
        if (Math.abs(this.sim.raft.v) > 0.4) this.foam.emitDrops(point, contact * 12 * dt, 1.6);
      }
    }
    const speed = Math.abs(this.sim.raft.v);
    if (speed > 1.6) {
      const nose = this.sim.raft.v > 0
        ? this.raftView.nosePoint(this.tmpVec2)
        : this.raftView.tailPoint(this.tmpVec2);
      this.foam.emitFoam(nose, speed * 3.2 * dt, 0.3, 0.5);
    }
  }

  /**
   * The state machine proper. Every branch here is a thing the child did or
   * the raft did - there are no timers standing in for gameplay, and no
   * branch that ends the game.
   */
  private updateFlow(dt: number, events: ReturnType<Simulation['update']>): void {
    void dt;
    const m = this.machine;
    const raft = this.sim.raft;
    const armed = this.sim.armed;
    const anyFlow = this.sim.blast.nozzles.some((n) => n.supplied && n.flow > 0.05);

    if (events.crested && m.state !== GameState.CREST) {
      if (m.go(GameState.CREST)) {
        this.crestCount++;
        this.audio.chime();
        this.rail.setShot('crestBack');
      }
    }
    if (events.splashed) {
      const at = this.sim.spline.positionAt(raft.s).clone();
      this.splash.trigger(at, Math.abs(events.splashSpeed), this.water.runoutLevel);
      this.audio.splash(Math.abs(events.splashSpeed));
      if (m.state === GameState.CREST) {
        m.go(GameState.SPLASH_FINISH);
        this.finishCount++;
        this.rail.setShot('finishWide');
      }
    }

    switch (m.state) {
      case GameState.OBSERVE_VALLEY:
        this.rail.setShot('overview');
        this.input.showReplay(false);
        if (m.elapsed > 3.4) {
          m.go(GameState.RELEASE_TEST_RAFT);
          this.rail.setShot('staging');
        }
        break;

      case GameState.RELEASE_TEST_RAFT:
        this.rail.setShot('staging');
        this.input.showReplay(false);
        if (armed) {
          m.go(GameState.RAFT_COASTS);
          this.rail.setShot('sideMid');
        }
        break;

      case GameState.RAFT_COASTS: {
        const x = this.sim.spline.xAt(raft.s);
        this.rail.setShot(x > 9 ? 'valleyLow' : 'sideMid');
        if (this.leverPressed && armed) {
          m.go(GameState.PRESS_BLAST_CONTROL);
        } else if (this.sim.parkedInPool) {
          m.go(GameState.RAFT_RESTS_BEFORE_HILL);
          this.rail.setShot('nozzleClose');
        }
        break;
      }

      case GameState.RAFT_RESTS_BEFORE_HILL:
        this.rail.setShot('nozzleClose');
        if (m.elapsed > 0.9) m.go(GameState.DISCOVER_NOZZLES);
        break;

      case GameState.DISCOVER_NOZZLES:
        this.rail.setShot('nozzleClose');
        if (this.leverPressed && armed) {
          m.go(GameState.PRESS_BLAST_CONTROL);
        } else if (Math.abs(raft.v) > 1.2) {
          // Drifted out of the dimple on its own: back to plain coasting.
          m.go(GameState.RAFT_COASTS);
        }
        break;

      case GameState.PRESS_BLAST_CONTROL:
        this.rail.setShot(this.sim.spline.xAt(raft.s) > 20 ? 'tracking' : 'nozzleClose');
        if (anyFlow) {
          m.go(GameState.JETS_FILL);
        } else if (!this.leverPressed && this.sim.blast.charge < 0.02) {
          m.go(GameState.RAFT_COASTS);
        }
        break;

      case GameState.JETS_FILL:
        // Stay on the bores and the raft's tail while the water arrives: this
        // is the moment the rule becomes visible.
        this.rail.setShot('nozzleClose');
        if (this.sim.pushOnRaft > 0.12 && raft.v > 0.4) {
          m.go(GameState.RAFT_ACCELERATES);
        } else if (!anyFlow) {
          m.go(this.sim.parkedInPool ? GameState.RAFT_RESTS_BEFORE_HILL : GameState.RAFT_COASTS);
        }
        break;

      case GameState.RAFT_ACCELERATES:
        this.rail.setShot(m.elapsed < 1.4 ? 'nozzleClose' : 'tracking');
        if (raft.v < -0.6 || (this.sim.pushOnRaft < 0.05 && raft.v < 0.3)) {
          // Let go, or ran out of water: it slows, it never fails.
          m.go(this.sim.parkedInPool ? GameState.RAFT_RESTS_BEFORE_HILL : GameState.RAFT_COASTS);
        }
        break;

      case GameState.CREST:
        this.rail.setShot(this.sim.spline.xAt(raft.s) > 47 ? 'finishWide' : 'crestBack');
        if (raft.v < -0.8) m.go(GameState.RAFT_ACCELERATES);
        break;

      case GameState.SPLASH_FINISH:
        this.input.showReplay(true);
        if (!this.reviewShown && m.elapsed > 1.9) {
          this.reviewShown = true;
          this.rail.setShot('review');
          this.trail.show(this.sim.trail, 3.6);
        }
        if (this.reviewShown && !this.trail.active && m.elapsed > 4.6) {
          this.beginNextRun();
        }
        break;

      case GameState.CHANGE_ONE_VARIABLE:
        this.rail.setShot('staging');
        this.input.showReplay(true);
        if (m.elapsed > 1.5) m.go(GameState.REPLAY);
        break;

      case GameState.REPLAY:
        this.sim.applyRun(this.replay.runIndex);
        this.sim.stage();
        this.sim.raft.bags = this.ballast.deckCount;
        this.reviewShown = false;
        this.trail.clear();
        m.go(GameState.RELEASE_TEST_RAFT);
        this.input.showReplay(false);
        break;

      case GameState.BOOT:
      default:
        break;
    }
  }

  /** Move to the next run and let the rig change exactly one thing. */
  private beginNextRun(): void {
    if (!this.machine.go(GameState.CHANGE_ONE_VARIABLE)) return;
    const index = this.replay.advance();
    this.sim.applyRun(index);
    this.ballast.applyPreset(this.replay.bagsFor(index));
    this.audio.clunk(0.8);
    this.rail.setShot('staging');
    this.trail.clear();
  }

  private handleSwipe(): void {
    this.guidance.notifyActivity();
    if (this.machine.state === GameState.OBSERVE_VALLEY) {
      this.machine.go(GameState.RELEASE_TEST_RAFT);
      this.rail.setShot('staging');
      return;
    }
    if (this.machine.state !== GameState.RELEASE_TEST_RAFT) return;
    if (this.ballast.isDragging) return;
    this.sim.release();
    this.audio.clunk(1);
  }

  private handleLever(pressed: boolean): void {
    this.leverPressed = pressed;
    this.audio.start();
    this.guidance.notifyActivity();
    if (pressed && !this.sim.armed) {
      // Interlocked until a raft is actually on the course.
      this.audio.clunk(1.6);
      this.lever.nudge(0.5);
    }
  }

  private canDragBallast(): boolean {
    return (
      this.machine.state === GameState.RELEASE_TEST_RAFT ||
      this.machine.state === GameState.CHANGE_ONE_VARIABLE ||
      this.machine.state === GameState.OBSERVE_VALLEY
    );
  }

  private handleDragStart(ndc: THREE.Vector2): boolean {
    if (!this.canDragBallast()) return false;
    this.raycaster.setFromCamera(ndc, this.camera);
    // Exact hit first, then anything close by: a four-year-old's finger does
    // not need to land on the bag, only near it.
    let bag = this.ballast.pick(this.raycaster);
    if (!bag) bag = this.nearestBagOnScreen(ndc, 0.16);
    if (!bag) return false;
    this.guidance.notifyActivity();
    bag.mesh.getWorldPosition(this.tmpVec);
    this.camera.getWorldDirection(this.tmpVec2);
    this.dragPlane.setFromNormalAndCoplanarPoint(this.tmpVec2, this.tmpVec);
    this.ballast.beginDrag(bag);
    return true;
  }

  /** Closest ballast bag to a screen point, in aspect-corrected NDC. */
  private nearestBagOnScreen(ndc: THREE.Vector2, radius: number) {
    let best: ReturnType<BallastRig['pick']> = null;
    let bestD = radius;
    for (const bag of this.ballast.bags) {
      if (bag.state !== 'bench') continue;
      bag.mesh.getWorldPosition(this.tmpVec).project(this.camera);
      const dx = (this.tmpVec.x - ndc.x) * this.camera.aspect * 0.5;
      const dy = this.tmpVec.y - ndc.y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = bag;
      }
    }
    return best;
  }

  private handleDragMove(ndc: THREE.Vector2): void {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this.tmpVec);
    if (hit) this.ballast.moveDrag(hit);
  }

  private handleDragEnd(): void {
    this.ballast.endDrag();
    this.sim.raft.bags = this.ballast.deckCount;
  }

  private handleReplayButton(): void {
    this.guidance.notifyActivity();
    if (this.machine.state === GameState.SPLASH_FINISH) {
      this.trail.clear();
      this.beginNextRun();
      return;
    }
    if (this.machine.state === GameState.CHANGE_ONE_VARIABLE) {
      this.machine.go(GameState.REPLAY);
    }
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.lastW = w;
    this.lastH = h;
    this.portrait = h >= w;
    document.body.classList.toggle('portrait', this.portrait);
    document.body.classList.toggle('landscape', !this.portrait);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.fov = this.portrait ? CAMERA.FOV_PORTRAIT : CAMERA.FOV_LANDSCAPE;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.quality.handleResize();
    this.lever.layout(this.portrait);
    // Orientation changes keep the raft, the pressure and the shot exactly
    // where they were; only the framing is recomputed.
    this.rail.reframe({
      raftPosition: this.sim.spline.positionAt(this.sim.raft.s, this.tmpVec),
      raftS: this.sim.raft.s,
      speed: Math.abs(this.sim.raft.v),
      portrait: this.portrait,
      aspect: this.camera.aspect,
      pumpLevel: this.sim.blast.charge,
      reduceMotion: this.settings.reduceMotion,
    });
  };

  /** Test surface: deterministic control of everything a finger can do. */
  debugApi() {
    return {
      state: () => this.machine.state,
      shot: () => this.rail.shot,
      history: () => this.machine.history.slice(),
      run: () => this.replay.runIndex,
      bags: () => this.ballast.deckCount,
      raft: () => ({
        s: this.sim.raft.s,
        x: this.sim.spline.xAt(this.sim.raft.s),
        y: this.sim.spline.heightAt(this.sim.raft.s),
        v: this.sim.raft.v,
        mass: this.sim.raft.mass,
      }),
      charge: () => this.sim.blast.charge,
      contact: () => this.sim.pushOnRaft,
      crested: () => this.sim.crested,
      splashed: () => this.sim.splashed,
      crests: () => this.crestCount,
      finishes: () => this.finishCount,
      blasting: () => isBlasting(this.machine.state),
      press: (v: boolean) => this.handleLever(v),
      swipe: () => this.handleSwipe(),
      replay: () => this.handleReplayButton(),
      /** Advance the simulation without waiting for real time. */
      step: (seconds: number) => {
        const h = 1 / 60;
        let left = seconds;
        while (left > 0) {
          this.advance(Math.min(h, left));
          left -= h;
        }
      },
      quality: () => this.settings,
      hints: () => this.guidance.hintsGiven,
      dragging: () => this.ballast.isDragging,
      raftScreen: () => {
        const p = this.raftView.group
          .getWorldPosition(new THREE.Vector3())
          .add(new THREE.Vector3(0, 0.3, 0))
          .project(this.camera);
        return { x: p.x, y: p.y };
      },
      deckPoint: () => {
        const p = this.raftView.deckPoint(new THREE.Vector3()).project(this.camera);
        return { x: p.x, y: p.y };
      },
      setBags: (n: number) => {
        this.ballast.applyPreset(n);
        this.sim.raft.bags = this.ballast.deckCount;
      },
      audio: () => this.audio.running,
      bagWorldPoints: () =>
        this.ballast.bags.map((b) => {
          const p = b.mesh.getWorldPosition(new THREE.Vector3()).project(this.camera);
          return { id: b.id, state: b.state, x: p.x, y: p.y };
        }),
      fast: this.options.fast,
      canvasSize: () => ({ w: this.canvas.clientWidth, h: this.canvas.clientHeight }),
      windowSize: () => ({ w: window.innerWidth, h: window.innerHeight }),
      portrait: () => this.portrait,
    };
  }
}
