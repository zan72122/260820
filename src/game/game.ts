import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createSettings, type Settings } from '../core/settings';
import { clamp } from '../core/math';
import { SwingModel } from '../sim/swing';
import { SwipeInput } from '../sim/input';
import { buildSpectralLut } from '../trail/spectralLut';
import { TrailSystem } from '../trail/trailSystem';
import { Sky } from '../world/sky';
import { Park } from '../world/park';
import { SwingRig } from '../world/swingRig';
import { Rider } from '../world/rider';
import { MistSystem } from '../world/mist';
import { LAYOUT, mistDensityAt, sunDirection } from '../world/layout';
import { CameraDirector } from '../view/cameraDirector';
import { SwipeHint } from '../view/hint';
import { Audio } from '../audio/audio';

type Beat = 'gust' | 'wonder' | 'guiding' | 'free' | 'revealing' | 'open';

const SAMPLE_STEP = 0.055;

export class Game {
  readonly settings: Settings;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private director = new CameraDirector();
  private swing = new SwingModel();
  private rig: SwingRig;
  private rider: Rider;
  private park: Park;
  private sky: Sky;
  private mist: MistSystem;
  private trails: TrailSystem;
  private hint: SwipeHint;
  private audio = new Audio();
  private replayBtn: HTMLButtonElement;

  private beat: Beat = 'gust';
  private elapsed = 0;
  private beatClock = 0;
  private emitting = false;
  private sinceSample = 0;
  private lastSeat = new Vector3();
  private seat = new Vector3();
  private tangent = new Vector3();
  private radial = new Vector3();
  private sunDir = new Vector3();
  private wind = new Vector3();
  private weave = { center: new Vector3(), radius: 1 };
  private lastArcness = 0;
  private bigArcSeen = false;
  private pumpLanded = false;
  private minAmp = Infinity;
  private maxAmp = 0;
  private arcsAtStart = 0;
  private revealDone = 0;
  private frameAvg = 16;
  private perfFrames = 0;
  private perfCooldown = 0;
  private pixelRatio: number;
  private width = 1;
  private height = 1;
  private hidden = false;
  private screenDir = { x: 1, y: 0 };
  private screenPt = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, replayBtn: HTMLButtonElement) {
    this.settings = createSettings();
    this.replayBtn = replayBtn;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.settings.tier === 'high',
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
    });
    this.pixelRatio = this.settings.maxPixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.34;
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x2b241f, 1);

    this.sky = new Sky(this.scene, this.settings);
    this.park = new Park(this.scene, this.settings);
    this.rig = new SwingRig(this.scene, this.settings);
    this.rider = new Rider(this.rig, this.settings);
    this.mist = new MistSystem(this.scene, this.settings);
    this.trails = new TrailSystem(this.scene, this.settings, buildSpectralLut());

    this.wind.copy(LAYOUT.wind).multiplyScalar(LAYOUT.windSpeed);
    this.mist.setWind(this.wind);
    this.trails.setWind(this.wind.clone().multiplyScalar(0.045));

    this.hint = new SwipeHint(overlay);
    void new SwipeInput(
      canvas.parentElement as HTMLElement,
      (s) => this.onSwipe(s),
      () => void this.audio.start(),
    );

    this.swing.events({
      pump: (strength) => {
        this.pumpLanded = true;
        this.audio.seatCreak(0.35 + strength * 0.5);
      },
      bottom: (speed) => {
        this.audio.chainClink(clamp(speed * 0.10, 0.05, 0.5));
      },
      apex: (amp) => {
        this.audio.chainClink(clamp(0.16 + amp * 0.5, 0, 1));
        this.audio.seatCreak(clamp(amp * 0.8, 0, 1));
      },
    });

    this.replayBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.restart();
    });

    this.reset();
    this.installTestHooks();
  }

  private reset(): void {
    this.swing.reset(0.02);
    this.beat = 'gust';
    this.beatClock = 0;
    this.emitting = false;
    this.bigArcSeen = false;
    this.pumpLanded = false;
    this.minAmp = Infinity;
    this.maxAmp = 0;
    this.arcsAtStart = 0;
    this.revealDone = 0;
    this.lastArcness = 0;
    this.replayBtn.classList.remove('on');
  }

  restart(): void {
    this.trails.clear();
    this.hint.reset();
    this.hint.clear();
    this.director.resetIntro();
    this.reset();
    void this.audio.start();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.director.resize(width, height);
    this.hint.resize(width, height, Math.min(2, window.devicePixelRatio || 1));
    this.mist.setPixelScale(height * this.pixelRatio);
  }

  setHidden(v: boolean): void {
    this.hidden = v;
    this.mist.setActive(!v);
    if (v) this.audio.suspend();
    else this.audio.resume();
  }

  private onSwipe(s: { strength: number; dx: number; dy: number; arcness: number }): void {
    void this.audio.start();
    this.lastArcness = s.arcness;

    const moving = Math.sign(this.swing.omega) || 1;
    const align = s.dx * this.screenDir.x + s.dy * this.screenDir.y;
    // A four-year-old's stroke is never precise: anything close to along the arc
    // drives the half cycle that is already running.
    const dir = Math.abs(align) < 0.28 ? moving : align > 0 ? moving : -moving;
    this.swing.book(s.strength, dir);
  }

  /** The whole beat sequence lives here; nothing else changes state. */
  private updateBeats(dt: number): void {
    this.beatClock += dt;
    const settled = this.trails.openCount === 0;

    switch (this.beat) {
      case 'gust':
        // One small gust, once. Nobody is pushing; the wind moved it.
        if (this.beatClock > 1.1 && Math.abs(this.swing.omega) < 0.02) {
          this.swing.nudge(0.36);
          this.audio.chainClink(0.28);
        }
        if (this.trails.arcCount >= 1) {
          this.beat = 'wonder';
          this.beatClock = 0;
        }
        break;

      case 'wonder':
        // A pause with the question hanging, then one gesture is offered.
        if (this.beatClock > 2.4 && settled) {
          this.hint.show();
          this.beat = 'guiding';
          this.beatClock = 0;
        }
        break;

      case 'guiding':
        this.hint.show();
        if (this.bigArcSeen && this.pumpLanded) {
          this.hint.retire();
          this.beat = 'free';
          this.beatClock = 0;
          this.arcsAtStart = this.trails.arcCount;
        }
        break;

      case 'free': {
        if (!settled) break;
        const spread = this.maxAmp - this.minAmp;
        const passes = (this.trails.arcCount - this.arcsAtStart) / 2;
        if (passes >= 2 && this.director.mode === 'watch') this.director.mode = 'raised';
        if (passes >= 6 && spread > 0.16 && this.beatClock > 26) {
          this.director.beginReveal();
          this.beat = 'revealing';
          this.beatClock = 0;
        }
        break;
      }

      case 'revealing':
        if (this.director.revealProgress >= 1) {
          this.revealDone += dt;
          if (this.revealDone > 2.6) {
            this.director.mode = 'free';
            this.replayBtn.classList.add('on');
            this.beat = 'open';
            this.beatClock = 0;
          }
        }
        break;

      case 'open':
        break;
    }
  }

  /** Sample the seat into ribbon geometry while it is inside the lit veil. */
  private updateTrails(dt: number): void {
    const L = LAYOUT;
    const theta = this.swing.theta;
    const omega = this.swing.omega;
    const dist = L.chainLength + 0.02;
    this.seat.set(Math.sin(theta) * dist, L.pivot.y - Math.cos(theta) * dist, 0);
    const dirSign = Math.sign(omega) || 1;
    this.tangent.set(Math.cos(theta) * dirSign, Math.sin(theta) * dirSign, 0).normalize();
    this.radial.set(Math.sin(theta), -Math.cos(theta), 0).normalize();

    const speed = Math.abs(omega) * dist;
    const speedNorm = clamp(speed / 4.6, 0, 1);
    const density = mistDensityAt(this.seat.x, this.seat.y, this.seat.z, this.elapsed);

    if (density > 0.05 && speed > 0.25) {
      this.mist.disturb(this.seat, this.tangent, speed);
    }

    const wants = density > 0.085 && speed > 0.42;

    if (wants && !this.emitting) {
      const boost = clamp(this.swing.playerEnergy * 0.5 + this.lastArcness * 0.35, 0, 1.1);
      this.trails.beginPass(this.swing.amplitude, dirSign, boost);
      this.emitting = true;
      this.sinceSample = SAMPLE_STEP;
      this.lastSeat.copy(this.seat);
      this.minAmp = Math.min(this.minAmp, this.swing.amplitude);
      this.maxAmp = Math.max(this.maxAmp, this.swing.amplitude);
      if (this.swing.amplitude > 0.30) this.bigArcSeen = true;
    }

    if (this.emitting) {
      this.sinceSample += this.lastSeat.distanceTo(this.seat);
      this.lastSeat.copy(this.seat);
      if (this.sinceSample >= SAMPLE_STEP) {
        this.sinceSample = 0;
        this.trails.appendSeat(
          this.seat,
          this.tangent,
          this.radial,
          speedNorm,
          density,
          clamp(this.swing.playerEnergy, 0, 1),
        );
      }
      if (!wants || this.trails.openCount === 0) {
        const size = clamp(this.swing.amplitude / this.swing.maxAmplitude, 0, 1);
        this.trails.endPass();
        this.emitting = false;
        this.audio.trailFormed(size, this.trails.arcCount);
      }
    }
    void dt;
  }

  step(dt: number): void {
    const clamped = Math.min(dt, 1 / 20);
    this.elapsed += clamped;

    this.swing.update(clamped);
    this.updateTrails(clamped);
    this.updateBeats(clamped);

    sunDirection(this.sunDir, this.elapsed);
    const sunStrength = clamp(0.35 + this.sunDir.y * 5.4, 0.3, 1.25);
    this.sky.update(this.sunDir, this.elapsed);
    this.trails.setSun(this.sunDir, sunStrength);
    this.trails.advanceTime(this.elapsed);
    this.trails.cull();
    this.mist.setSun(this.sunDir);

    this.rig.update(this.swing.theta, this.swing.omega, clamped, this.elapsed);
    this.rider.update(
      this.swing.theta,
      this.swing.omega,
      this.swing.amplitude,
      this.swing.phase,
      this.swing.playerEnergy,
      clamped,
    );
    this.park.update(this.elapsed);

    const hasWeave = this.trails.bounds(this.weave);
    this.director.update(
      clamped,
      this.seat.x,
      this.swing.amplitude,
      hasWeave ? this.weave.center : null,
      this.weave.radius,
    );

    if (!this.hidden) {
      this.mist.update(clamped, this.elapsed, this.director.camera.position);
    }
    this.sky.syncToCamera(
      this.director.camera.position.x,
      this.director.camera.position.y,
      this.director.camera.position.z,
    );

    this.director.seatScreenDirection(this.seat, this.tangent, this.screenDir);
    this.director.projectToScreen(this.seat, this.width, this.height, this.screenPt);
    this.hint.setAnchor(
      this.screenPt.x,
      this.screenPt.y,
      this.screenDir.x,
      this.screenDir.y,
      this.height >= this.width,
    );
    this.hint.update(clamped);

    this.audio.setMotion(
      Math.abs(this.swing.omega) * LAYOUT.chainLength,
      mistDensityAt(this.seat.x, this.seat.y, this.seat.z, this.elapsed),
    );
    this.audio.update(clamped);
  }

  render(): void {
    this.renderer.render(this.scene, this.director.camera);
    if (this.hint.visible) this.hint.draw();
    else this.hint.clear();
  }

  /** Keep the frame budget: internal resolution gives way before the arcs do. */
  watchPerformance(frameMs: number): void {
    // Ignore the first frames and any stall from a tab switch or an orientation
    // change: neither says anything about the steady-state budget.
    if (frameMs > 900 || frameMs <= 0) return;
    this.frameAvg = this.frameAvg * 0.88 + frameMs * 0.12;
    this.perfFrames++;
    if (this.perfCooldown > 0) {
      this.perfCooldown--;
      return;
    }
    if (this.perfFrames < 20) return;
    this.perfFrames = 0;

    if (this.frameAvg > 23 && this.pixelRatio > 0.7) {
      this.pixelRatio = Math.max(0.7, this.pixelRatio * 0.84);
      this.resize(this.width, this.height);
      this.perfCooldown = 45;
    } else if (this.frameAvg < 12.5 && this.pixelRatio < this.settings.maxPixelRatio) {
      this.pixelRatio = Math.min(this.settings.maxPixelRatio, this.pixelRatio * 1.08);
      this.resize(this.width, this.height);
      this.perfCooldown = 120;
    }
  }

  private installTestHooks(): void {
    const api = {
      settings: this.settings,
      state: () => ({
        beat: this.beat,
        cameraMode: this.director.mode,
        revealProgress: this.director.revealProgress,
        arcs: this.trails.arcCount,
        openArcs: this.trails.openCount,
        amplitude: this.swing.amplitude,
        amplitudeDeg: (this.swing.amplitude * 180) / Math.PI,
        omega: this.swing.omega,
        theta: this.swing.theta,
        phase: this.swing.phase,
        playerEnergy: this.swing.playerEnergy,
        hintVisible: this.hint.visible,
        elapsed: this.elapsed,
        pixelRatio: this.pixelRatio,
        frameAvgMs: this.frameAvg,
        perfFrames: this.perfFrames,
        seatScreen: { ...this.screenPt },
        minAmp: this.minAmp === Infinity ? 0 : this.minAmp,
        maxAmp: this.maxAmp,
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      }),
      pump: (strength = 0.8, dir?: number) =>
        this.swing.book(strength, dir ?? (Math.sign(this.swing.omega) || 1)),
      /** Advance the whole simulation deterministically, without waiting on rAF. */
      advance: (seconds: number, stepSize = 1 / 60) => {
        let left = seconds;
        while (left > 0) {
          const d = Math.min(stepSize, left);
          this.step(d);
          left -= d;
        }
      },
      trailStats: () => this.trails.stats(),
      study: (halfHeight: number | null, targetY = 1.0) => {
        this.director.study = halfHeight === null ? null : { halfHeight, targetY };
      },
      camera: () => ({
        position: this.director.camera.position.toArray(),
        fov: this.director.camera.fov,
        aspect: this.director.camera.aspect,
      }),
      render: () => this.render(),
      restart: () => this.restart(),
    };
    (window as unknown as { __rainbow: typeof api }).__rainbow = api;
  }
}
