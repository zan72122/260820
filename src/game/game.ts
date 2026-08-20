import * as THREE from 'three';
import { Engine } from '../core/engine';
import { Audio } from '../core/audio';
import { Input } from '../core/input';
import { Observation } from '../core/debug';
import { clamp, damp } from '../core/util';
import { buildEnvironment } from '../gfx/env';
import { buildTextures, type TextureSet } from '../gfx/textures';
import { Terrain } from '../world/terrain';
import { Water } from '../world/water';
import { WaterMesh } from '../world/waterMesh';
import { Particles } from '../world/particles';
import { Gate, LeafBoat, Surroundings } from '../world/props';
import { buildLayout, NX, NZ, WORLD_D, WORLD_W, gridToWorldX, gridToWorldZ, type Layout } from '../world/layout';
import { CameraRig, type Framing } from './camera';
import type { MenuChoice, Tool, UI } from '../ui/ui';

type Phase = 'boot' | 'mystery' | 'firstflow' | 'play';
type DragMode = 'none' | 'gate' | 'dig' | 'mud';

/** The dug point sits above the fingertip so the groove is never hidden. */
const FINGER_LIFT_PX = 46;
const GATE_DRAG_PX = 150;
/** How long the finger must sit still before a stroke becomes a hole. */
const HOLD_MS = 130;

export class Game {
  private tex!: TextureSet;
  private terrain!: Terrain;
  private water!: Water;
  private waterMesh!: WaterMesh;
  private particles!: Particles;
  private gate!: Gate;
  private boat!: LeafBoat;
  private surroundings!: Surroundings;
  private rig: CameraRig;
  private sun!: THREE.DirectionalLight;

  private layout!: Layout;
  private baseHeight = new Float32Array(NX * NZ);
  private layoutId = 0;

  private phase: Phase = 'boot';
  private phaseTime = 0;
  private sessionTime = 0;
  private idleTime = 0;
  private sinceInteraction = 0;

  private drag: DragMode = 'none';
  private gateOpenAtGrab = 0;
  private gateGrabY = 0;
  private lastGateOpen = 0;
  private tool: Tool = 'dig';
  private mudHeld = 0;
  private lastMoveAt = 0;
  private mudPoint = new THREE.Vector3();
  private mudActive = false;

  private hintStage = 0;
  private hintsEnabled = true;
  private ghostOn = false;

  private dripTimer = 0;
  private creakTimer = 4;
  private jetTimer = 0;
  private breachHold = 0;
  private breachShotCooldown = 0;
  private lowShotHold = 0;
  private arrived = false;
  private arrivedTime = 0;
  private menuOffered = false;
  private toolsShown = false;
  private mudShown = false;

  private frontX = 0;
  private frontZ = 0;
  private frontTimer = 0;

  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private hit = new THREE.Vector3();
  private lastDig = new THREE.Vector3();
  private hasLastDig = false;
  private projV = new THREE.Vector3();
  private mouth = { x: 0, y: 0, z: 0 };
  private debugPixels?: ImageData;

  private currentFraming: Framing | null = null;
  private digSpeed = 0;
  private hapticsOn = true;

  constructor(
    private engine: Engine,
    private ui: UI,
    private audio: Audio,
    private obs: Observation,
  ) {
    this.rig = new CameraRig(engine.camera);
  }

  /* ------------------------------------------------------------------ */
  /* build                                                               */

  async init(onProgress: (p: number) => void) {
    this.tex = await buildTextures(onProgress);

    const sunDir = new THREE.Vector3(-3.1, 5.4, 3.4);
    const { envMap, dome } = buildEnvironment(this.engine.renderer, sunDir);
    const scene = this.engine.scene;
    scene.environment = envMap;
    scene.add(dome);
    scene.fog = new THREE.Fog(0xb9b6ad, 22, 52);

    this.sun = new THREE.DirectionalLight(0xfff1d6, 3.6);
    this.sun.position.copy(sunDir);
    this.sun.castShadow = true;
    const sc = this.sun.shadow;
    sc.mapSize.set(2048, 2048);
    sc.camera.left = -5.2;
    sc.camera.right = 5.2;
    sc.camera.top = 6.2;
    sc.camera.bottom = -6.2;
    sc.camera.near = 0.5;
    sc.camera.far = 26;
    sc.bias = -0.0006;
    sc.normalBias = 0.018;
    sc.camera.updateProjectionMatrix();
    scene.add(this.sun);
    scene.add(this.sun.target);

    // a cool bounce from the damp ground keeps the shadows from going dead
    const fill = new THREE.HemisphereLight(0xcfdde6, 0x40372c, 0.22);
    scene.add(fill);

    this.terrain = new Terrain(this.tex);
    this.water = new Water(this.terrain);
    this.waterMesh = new WaterMesh(this.tex, this.terrain, this.water);
    this.particles = new Particles(this.tex);
    this.gate = new Gate(this.tex);
    this.boat = new LeafBoat(this.tex);
    this.surroundings = new Surroundings(this.tex);

    scene.add(this.surroundings.group);
    scene.add(this.terrain.mesh);
    scene.add(this.waterMesh.mesh);
    scene.add(this.gate.group);
    scene.add(this.boat.group);
    scene.add(this.particles.points);

    this.loadLayout(0, true);

    if (this.obs.enabled) {
      this.ui.enableDebug(NX, NZ, 1.1);
      this.debugPixels = this.ui.debugCtx?.createImageData(NX, NZ);
    }
  }

  private loadLayout(id: number, firstRun: boolean) {
    this.layoutId = id;
    this.layout = buildLayout(id);
    this.terrain.load(this.layout);
    this.baseHeight.set(this.terrain.height);
    this.water.load(this.layout);
    this.waterMesh.reset();
    this.particles.clear();
    this.gate.place(this.layout);
    this.boat.place(this.layout, this.terrain);
    this.surroundings.placeStones(this.layout, this.terrain);
    this.surroundings.placeTools(this.terrain);

    this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();

    this.phase = firstRun ? 'mystery' : 'play';
    this.hintsEnabled = firstRun;
    this.phaseTime = 0;
    this.sessionTime = 0;
    this.hintStage = 0;
    this.arrived = false;
    this.arrivedTime = 0;
    this.menuOffered = false;
    this.breachHold = 0;
    this.lowShotHold = 0;
    this.setGhost(false);
    this.obs.begin(id, performance.now() / 1000);

    if (firstRun) {
      this.toolsShown = false;
      this.mudShown = false;
      this.ui.showDock(false);
    } else {
      this.toolsShown = true;
      this.mudShown = true;
      this.ui.showDock(true);
      this.ui.setTool(this.tool);
    }

    this.frontX = gridToWorldX(this.layout.gateU * (NX - 1));
    this.frontZ = gridToWorldZ(this.layout.gateV * (NZ - 1));

    this.applyFraming(firstRun ? this.fOverview() : this.fGateMid());
    this.rig.snap();
  }

  /* ------------------------------------------------------------------ */
  /* framings                                                            */

  private gateWorld() {
    return {
      x: gridToWorldX(this.layout.gateU * (NX - 1)),
      z: gridToWorldZ(this.layout.gateV * (NZ - 1)),
    };
  }

  private fOverview(): Framing {
    return { tx: 0, ty: 0, tz: 0.05, w: WORLD_W + 0.45, d: WORLD_D + 0.5, pitch: 50, margin: 1.03, fov: 44, ease: 0.75 };
  }

  private fGateMid(): Framing {
    const g = this.gateWorld();
    return { tx: g.x * 0.55, ty: 0.05, tz: g.z + 0.95, w: 1.95, d: 3.1, pitch: 32, margin: 1.04, fov: 44, ease: 0.6 };
  }

  private fFlowLow(): Framing {
    return {
      tx: this.frontX * 0.85,
      ty: 0.02,
      tz: this.frontZ + 0.45,
      w: 1.8,
      d: 2.9,
      pitch: 15,
      margin: 1.04,
      fov: 47,
      ease: 0.8,
    };
  }

  private fDig(): Framing {
    return { tx: 0, ty: 0, tz: 0.25, w: WORLD_W - 0.35, d: WORLD_D - 0.9, pitch: 55, margin: 1.07, fov: 44, ease: 0.65 };
  }

  private fBreach(x: number, z: number): Framing {
    return { tx: x, ty: 0.0, tz: z + 0.34, w: 0.95, d: 1.55, pitch: 19, margin: 1.03, fov: 45, ease: 0.5 };
  }

  private fComplete(): Framing {
    return { tx: 0, ty: 0, tz: 0.55, w: WORLD_W + 1.1, d: WORLD_D + 1.4, pitch: 42, margin: 1.06, fov: 42, ease: 0.85 };
  }

  private applyFraming(f: Framing) {
    this.currentFraming = f;
    this.rig.apply(f);
  }

  onResize(portrait: boolean) {
    this.rig.setOrientation(portrait);
    if (this.currentFraming) this.rig.apply(this.currentFraming);
  }

  /* ------------------------------------------------------------------ */
  /* input                                                               */

  bindInput(input: Input) {
    input.onDown = (p) => {
      this.sinceInteraction = 0;
      this.idleTime = 0;
      this.clearHints();
      this.obs.touch(performance.now() / 1000);
      if (this.ui.menuOpen) return;

      if (this.hitHandle(p.x, p.y)) {
        this.drag = 'gate';
        this.gateOpenAtGrab = this.gate.open;
        this.gateGrabY = p.y;
        this.lastGateOpen = this.gate.open;
        this.obs.gateGrab();
        this.haptic(8);
        if (this.phase === 'mystery') this.applyFraming(this.fGateMid());
        return;
      }

      const hit = this.pickTerrain(p.x, p.y - FINGER_LIFT_PX);
      if (!hit) {
        this.drag = 'none';
        return;
      }
      if (this.toolsShown) {
        this.drag = this.tool === 'mud' ? 'mud' : 'dig';
        this.lastMoveAt = performance.now();
        this.mudHeld = 0;
        this.hasLastDig = false;
        this.mudPoint.copy(hit);
        this.mudActive = this.drag === 'mud';
      }
    };

    input.onMove = (p) => {
      this.sinceInteraction = 0;
      if (this.drag === 'gate') {
        const delta = (this.gateGrabY - p.y) / GATE_DRAG_PX;
        const next = clamp(this.gateOpenAtGrab + delta, 0, 1);
        this.gate.open = next;
        return;
      }
      if (this.drag === 'dig' || this.drag === 'mud') {
        this.lastMoveAt = performance.now();
        const hit = this.pickTerrain(p.x, p.y - FINGER_LIFT_PX);
        if (!hit) return;
        if (this.drag === 'mud') {
          this.mudPoint.copy(hit);
          this.mudActive = true;
        } else this.digAt(hit, p.speed);
      }
    };

    input.onUp = () => {
      if (this.drag === 'gate') {
        if (this.gate.open <= 0.001 || this.gate.open >= 0.999) this.audio.knock();
      }
      this.drag = 'none';
      this.mudActive = false;
      this.hasLastDig = false;
      this.digSpeed = 0;
      this.audio.setDigging(0, 0);
    };
  }

  private toNdc(x: number, y: number) {
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    return this.ndc;
  }

  /**
   * Grabbing the gate must be forgiving: anywhere on the woodwork counts, and
   * so does anywhere near the handle on screen, whatever the camera distance.
   */
  private hitHandle(x: number, y: number) {
    this.gate.handleAnchor.getWorldPosition(this.projV);
    this.projV.project(this.engine.camera);
    if (this.projV.z < 1) {
      const hx = (this.projV.x * 0.5 + 0.5) * window.innerWidth;
      const hy = (-this.projV.y * 0.5 + 0.5) * window.innerHeight;
      // Wide while the gate is still the whole puzzle, tighter afterwards so
      // it stops stealing strokes meant for the sand beside it.
      const near =
        this.phase === 'mystery' ? Math.max(60, Math.min(window.innerWidth, window.innerHeight) * 0.17) : 46;
      if (Math.hypot(x - hx, y - hy) < near) return true;
    }
    this.ray.setFromCamera(this.toNdc(x, y), this.engine.camera);
    return this.ray.intersectObject(this.gate.group, true).length > 0;
  }

  /** Analytic march against the height field: far cheaper than mesh picking. */
  private pickTerrain(x: number, y: number): THREE.Vector3 | null {
    this.ray.setFromCamera(this.toNdc(x, y), this.engine.camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    if (d.y > -1e-4) return null;
    let t = (0.75 - o.y) / d.y;
    const tEnd = (-0.45 - o.y) / d.y;
    if (t < 0) t = 0;
    if (tEnd <= t) return null;
    const steps = 72;
    const dt = (tEnd - t) / steps;
    let prevT = t;
    let prevDiff = 1;
    for (let i = 0; i <= steps; i++) {
      const tt = t + dt * i;
      const px = o.x + d.x * tt;
      const pz = o.z + d.z * tt;
      const py = o.y + d.y * tt;
      const diff = py - this.terrain.heightAt(px, pz);
      if (diff <= 0) {
        const f = prevDiff / (prevDiff - diff || 1);
        const ft = prevT + (tt - prevT) * f;
        this.hit.set(o.x + d.x * ft, o.y + d.y * ft, o.z + d.z * ft);
        const m = 0.06;
        if (
          this.hit.x < -WORLD_W / 2 + m ||
          this.hit.x > WORLD_W / 2 - m ||
          this.hit.z < -WORLD_D / 2 + m ||
          this.hit.z > WORLD_D / 2 - m
        )
          return null;
        return this.hit;
      }
      prevT = tt;
      prevDiff = diff;
    }
    return null;
  }

  private digAt(p: THREE.Vector3, speedPx: number) {
    const strength = 0.032;
    const radius = 0.2;
    let moved = 0;
    if (this.hasLastDig) {
      // stamp along the stroke so a fast finger still leaves a continuous groove
      const dist = Math.hypot(p.x - this.lastDig.x, p.z - this.lastDig.z);
      const n = Math.min(10, Math.max(1, Math.ceil(dist / 0.05)));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        moved += this.terrain.dig(
          this.lastDig.x + (p.x - this.lastDig.x) * t,
          this.lastDig.z + (p.z - this.lastDig.z) * t,
          radius,
          strength,
        );
      }
    } else {
      moved = this.terrain.dig(p.x, p.z, radius, strength);
    }
    this.lastDig.copy(p);
    this.hasLastDig = true;
    this.digSpeed = clamp(speedPx / 900, 0, 1);
    if (moved > 0.0015) {
      const gx = Math.round(((p.x / WORLD_W + 0.5) * (NX - 1)));
      const gz = Math.round(((p.z / WORLD_D + 0.5) * (NZ - 1)));
      const wet = this.terrain.wet[clamp(gz, 0, NZ - 1) * NX + clamp(gx, 0, NX - 1)];
      this.particles.sand(p.x, this.terrain.heightAt(p.x, p.z), p.z, clamp(moved * 22, 0.2, 1) * (1 - wet * 0.6));
      this.audio.setDigging(clamp(0.35 + this.digSpeed, 0, 1), wet);
    }
  }

  /** Pressing longer piles more mud, and it spreads as it is worked. */
  private holdDig(dt: number) {
    const p = this.lastDig;
    const moved = this.terrain.dig(p.x, p.z, 0.155, 0.085 * dt);
    if (moved <= 0) return;
    this.digSpeed = 0.35;
    const gx = clamp(Math.round((p.x / WORLD_W + 0.5) * (NX - 1)), 0, NX - 1);
    const gz = clamp(Math.round((p.z / WORLD_D + 0.5) * (NZ - 1)), 0, NZ - 1);
    const wet = this.terrain.wet[gz * NX + gx];
    this.audio.setDigging(0.32, wet);
    this.holdBeat -= dt;
    if (this.holdBeat <= 0) {
      this.holdBeat = 0.2;
      this.particles.sand(p.x, this.terrain.heightAt(p.x, p.z), p.z, 0.35 * (1 - wet * 0.6));
    }
  }

  private holdBeat = 0;

  private pressMud(dt: number) {
    const t = clamp(this.mudHeld, 0, 1.4);
    const rate = 0.055 * (1 - t / 2.2);
    this.terrain.pressMud(this.mudPoint.x, this.mudPoint.z, 0.16 + t * 0.05, rate * dt);
    this.mudHeld += dt;
    this.mudBeat -= dt;
    if (this.mudBeat <= 0) {
      this.mudBeat = 0.28;
      this.audio.mudPress(0.35 + Math.min(0.65, t));
      this.particles.sand(
        this.mudPoint.x,
        this.terrain.heightAt(this.mudPoint.x, this.mudPoint.z),
        this.mudPoint.z,
        0.25,
      );
      this.haptic(8);
    }
  }

  private mudBeat = 0;

  private haptic(ms: number) {
    if (!this.hapticsOn) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported: silently fine */
    }
  }

  setHaptics(on: boolean) {
    this.hapticsOn = on;
  }

  setTool(t: Tool) {
    this.tool = t;
    this.ui.setTool(t);
  }

  /* ------------------------------------------------------------------ */
  /* hints                                                               */

  private clearHints() {
    if (this.ghostOn) this.setGhost(false);
    this.idleTime = 0;
  }

  private setGhost(on: boolean) {
    this.ghostOn = on;
    if (!on) {
      this.ui.setGhost(false);
      return;
    }
    this.gate.handleAnchor.getWorldPosition(this.projV);
    this.projV.project(this.engine.camera);
    const x = (this.projV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.projV.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.setGhost(true, x, y + 34);
  }

  private updateHints(dt: number) {
    if (this.phase !== 'mystery') {
      // On a repeat run the child already knows: no voice, no hand, just the
      // handle moving on its own if the gate has been left shut a long time.
      if (this.phase === 'play' && this.gate.open < 0.04 && !this.arrived) {
        this.idleTime += dt;
        if (this.idleTime > 15) {
          this.idleTime = 0;
          this.gate.nudgeHandle();
          this.audio.creak(0.3);
        }
      }
      return;
    }
    if (!this.hintsEnabled) return;
    this.idleTime += dt;
    // 1) the handle simply moves once, on its own
    if (this.hintStage === 0 && this.idleTime > 6.5) {
      this.hintStage = 1;
      this.gate.nudgeHandle();
      this.audio.creak(0.35);
      this.obs.hint();
    }
    // 2) a two-syllable sound and another small movement
    if (this.hintStage === 1 && this.idleTime > 13) {
      this.hintStage = 2;
      this.gate.nudgeHandle();
      this.audio.creak(0.5);
      this.audio.say('すーっ');
      this.obs.hint();
    }
    // 3) last resort only: a hand showing the direction, never the result
    if (this.hintStage === 2 && this.idleTime > 21) {
      this.hintStage = 3;
      this.setGhost(true);
      this.audio.say('じゃー');
      this.obs.hint();
    }
    if (this.ghostOn) this.setGhost(true);
  }

  /* ------------------------------------------------------------------ */
  /* frame                                                               */

  fixed(dt: number) {
    if (this.phase === 'boot') return;
    this.water.gateOpen = this.gate.open;
    this.water.step(dt);
  }

  frame(dt: number, elapsed: number) {
    if (this.phase === 'boot') return;
    this.sessionTime += dt;
    this.phaseTime += dt;
    this.sinceInteraction += dt;

    if (this.drag === 'gate') {
      const speed = Math.abs(this.gate.open - this.lastGateOpen) / Math.max(dt, 0.001);
      if (speed > 0.05) this.audio.creak(clamp(speed * 0.9, 0.1, 1));
      this.lastGateOpen = this.gate.open;
    }
    if (this.drag === 'mud' && this.mudActive) this.pressMud(dt);
    if (this.drag === 'dig') {
      // A finger held still keeps scooping in one spot and sinks a hole.
      if (this.hasLastDig && performance.now() - this.lastMoveAt > HOLD_MS) {
        this.holdDig(dt);
      } else {
        this.digSpeed = damp(this.digSpeed, 0, 0.12, dt);
        this.audio.setDigging(this.digSpeed, 0.2);
      }
    } else if (this.drag !== 'mud') {
      this.audio.setDigging(0, 0);
    }

    const pressure = clamp((this.water.resFloorSurface - this.layout.sillY) * 3, 0, 1);
    this.gate.update(dt, elapsed, pressure);

    // A shut gate under a full pool never sits quiet: it works against itself.
    if (this.gate.open < 0.05 && this.drag !== 'gate') {
      this.creakTimer -= dt;
      if (this.creakTimer <= 0) {
        this.creakTimer = 2.6 + Math.random() * 2.4;
        this.audio.creak(0.1 * pressure);
      }
    }
    this.terrain.update(dt);
    this.waterMesh.update(dt, elapsed);
    this.boat.update(dt, elapsed, this.terrain, this.water);
    this.particles.update(dt, this.terrain);

    this.updateFlowFront(dt);
    this.updateEvents();
    this.updatePhase(dt);
    this.updateHints(dt);
    this.updateAudio();
    this.emitWaterParticles(dt);

    this.rig.update(dt);
    if (this.ghostOn) this.setGhost(true);
    if (this.obs.enabled) this.updateDebug();
  }

  private updateFlowFront(dt: number) {
    this.frontTimer -= dt;
    if (this.frontTimer > 0) return;
    this.frontTimer = 0.25;
    let bestZ = -1;
    let bx = this.frontX;
    let bz = this.frontZ;
    for (let z = 0; z < NZ; z++) {
      for (let x = 2; x < NX - 2; x += 2) {
        const i = z * NX + x;
        if (this.water.depth[i] > 0.004 && z > bestZ) {
          bestZ = z;
          bx = gridToWorldX(x);
          bz = gridToWorldZ(z);
        }
      }
    }
    if (bestZ >= 0) {
      this.frontX = damp(this.frontX, bx, 0.4, 0.25);
      this.frontZ = damp(this.frontZ, bz, 0.4, 0.25);
    }
  }

  private updateEvents() {
    const evs = this.water.events;
    while (evs.length) {
      const e = evs.shift()!;
      if (e.type === 'breach') {
        this.audio.breach(e.power);
        this.particles.sand(e.x, e.y, e.z, 0.8 * e.power, 0, 0.4);
        this.particles.splash(e.x, e.y, e.z, 0.5 * e.power);
        this.haptic(16);
        this.revealMud();
        // Cut to the failure only occasionally: the child is playing, not
        // watching a camera jump back and forth.
        if (
          this.phase === 'play' &&
          this.breachHold <= 0 &&
          this.breachShotCooldown <= 0 &&
          this.sinceInteraction > 0.4
        ) {
          this.applyFraming(this.fBreach(e.x, e.z));
          this.breachHold = 3.4;
          this.breachShotCooldown = 26;
        }
      } else if (e.type === 'arrive') {
        this.audio.arrive();
        this.particles.splash(e.x, e.y, e.z, 0.8);
        this.haptic(20);
        this.arrived = true;
        this.arrivedTime = 0;
        this.obs.pond(performance.now() / 1000);
        this.applyFraming(this.fComplete());
        this.breachHold = 0;
        this.lowShotHold = 0;
      }
    }
  }

  private revealMud() {
    if (this.mudShown || !this.toolsShown) return;
    this.mudShown = true;
    const btn = document.getElementById('tool-mud');
    btn?.classList.remove('hide');
    btn?.classList.add('pop');
  }

  private showTools() {
    if (this.toolsShown) return;
    this.toolsShown = true;
    this.ui.showDock(true);
    this.ui.setTool('dig');
    document.getElementById('tool-mud')?.classList.add('hide');
  }

  private updatePhase(dt: number) {
    this.breachShotCooldown -= dt;
    if (this.breachHold > 0) {
      this.breachHold -= dt;
      if (this.breachHold <= 0 && !this.arrived) this.applyFraming(this.fDig());
      else if (this.breachHold <= 0) this.applyFraming(this.fComplete());
    }
    if (this.lowShotHold > 0) {
      this.lowShotHold -= dt;
      if (this.lowShotHold <= 0) {
        this.applyFraming(this.fDig());
        this.showTools();
        this.phase = 'play';
        this.phaseTime = 0;
      }
    }

    if (this.phase === 'mystery') {
      // the establishing shot holds, then eases in without a cut
      if (this.phaseTime > 4.5 && this.currentFraming && this.currentFraming.pitch === 50) {
        this.applyFraming(this.fGateMid());
      }
      if (this.water.gateFlow > 0.0006 || this.gate.open > 0.06) {
        this.phase = 'firstflow';
        this.phaseTime = 0;
        this.obs.flow(performance.now() / 1000);
        this.clearHints();
      }
      return;
    }

    if (this.phase === 'firstflow') {
      // hold the same continuous shot until the water has actually arrived
      const reachedHollow = this.hollowDepth() > 0.012;
      if ((reachedHollow && this.phaseTime > 1.6) || this.phaseTime > 12) {
        this.applyFraming(this.fFlowLow());
        this.lowShotHold = 6.5;
        this.phase = 'play';
        this.phaseTime = 0;
      }
      return;
    }

    if (this.phase === 'play' && !this.mudShown && this.phaseTime > 24) this.revealMud();

    if (this.arrived) {
      this.arrivedTime += dt;
      if (!this.menuOffered && this.arrivedTime > 32 && this.sinceInteraction > 9 && !this.ui.menuOpen) {
        this.menuOffered = true;
        this.ui.showMenu(true);
      }
    }

    if (this.breachHold <= 0 && this.lowShotHold <= 0) {
      const want = this.arrived ? this.fComplete() : this.fDig();
      if (this.currentFraming?.pitch !== want.pitch) this.applyFraming(want);
    }
  }

  private hollowDepth() {
    const gx = Math.round(this.layout.hollowU * (NX - 1));
    const gz = Math.round(this.layout.hollowV * (NZ - 1));
    let s = 0;
    let n = 0;
    for (let z = gz - 2; z <= gz + 2; z++) {
      for (let x = gx - 3; x <= gx + 3; x++) {
        if (x < 0 || x >= NX || z < 0 || z >= NZ) continue;
        s += this.water.depth[z * NX + x];
        n++;
      }
    }
    return n ? s / n : 0;
  }

  private updateAudio() {
    const jet = clamp(this.water.gateFlow * 24, 0, 1);
    const flow = clamp(this.water.totalFlow * 5.5, 0, 1);
    this.audio.setWater(flow, jet);
    this.audio.setPond(clamp(this.water.pondFill * 1.4, 0, 1));
  }

  private emitWaterParticles(dt: number) {
    this.water.gateMouth(this.mouth);
    if (this.gate.open < 0.04) {
      // the single drip that stains the dry sand, before anything else happens
      this.dripTimer -= dt;
      if (this.dripTimer <= 0) {
        this.dripTimer = 0.85 + Math.random() * 0.5;
        this.particles.drip(this.mouth.x, this.mouth.y + 0.16, this.mouth.z);
      }
    } else {
      this.jetTimer -= dt;
      const rate = 0.035 / Math.max(0.15, this.gate.open);
      if (this.jetTimer <= 0) {
        this.jetTimer = rate;
        this.particles.jet(this.mouth.x, this.mouth.y + 0.02, this.mouth.z, 0.4 + this.gate.open * 0.9, 2);
      }
    }
  }

  private updateDebug() {
    const m = this.engine.metrics;
    const r = this.obs.run;
    const lines = [
      `fps ${m.fps.toFixed(0)}  ${m.frameMs.toFixed(1)}ms  res x${m.pixelRatio.toFixed(2)}`,
      `draw ${m.calls}  tri ${(m.tris / 1000).toFixed(1)}k  ${m.width}x${m.height}`,
      `phase ${this.phase}  layout ${this.layoutId}`,
      `first touch    ${r.firstTouchSec ?? '-'}s`,
      `hints->flow    ${r.hintsBeforeFirstFlow}`,
      `first flow     ${r.firstFlowSec ?? '-'}s`,
      `pond reached   ${r.pondSec ?? '-'}s`,
      `gate grabs     ${r.gateGrabs}`,
      `new channel 2nd run ${this.obs.changedChannelOnSecondRun === null ? '-' : this.obs.changedChannelOnSecondRun ? 'yes' : 'no'}`,
      `gate ${this.gate.open.toFixed(2)}  Q ${(this.water.gateFlow * 1000).toFixed(1)} L/s`,
      `pond fill ${(this.water.pondFill * 100).toFixed(0)}%  wet cells ${this.water.wetArea}`,
    ];
    this.ui.setDebugText(lines.join('\n'));
    const ctx = this.ui.debugCtx;
    if (ctx && this.debugPixels) {
      this.water.debugInto(this.debugPixels.data);
      ctx.putImageData(this.debugPixels, 0, 0);
    }
  }

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                           */

  begin() {
    this.phase = 'mystery';
    this.phaseTime = 0;
    this.obs.begin(this.layoutId, performance.now() / 1000);
    this.applyFraming(this.fOverview());
    this.rig.snap();
    this.ui.showCorners(true);
  }

  /** Developer probe, exposed only under ?debug=1. Never sends anything. */
  probe() {
    let dug = 0;
    let mud = 0;
    for (let i = 0; i < this.baseHeight.length; i++) {
      if (this.baseHeight[i] - this.terrain.height[i] > 0.02) dug++;
      if (this.terrain.mud[i] > 0.3) mud++;
    }
    return {
      phase: this.phase,
      layout: this.layoutId,
      gateOpen: +this.gate.open.toFixed(3),
      gateFlow: +this.water.gateFlow.toFixed(5),
      pondFill: +this.water.pondFill.toFixed(3),
      pondDepth: +this.water.pondDepth.toFixed(4),
      wetCells: this.water.wetArea,
      dugCells: dug,
      mudCells: mud,
      tool: this.tool,
      arrived: this.arrived,
      boatAfloat: this.boat.afloat,
      fps: +this.engine.metrics.fps.toFixed(1),
      calls: this.engine.metrics.calls,
      tris: this.engine.metrics.tris,
      pixelRatio: +this.engine.metrics.pixelRatio.toFixed(2),
    };
  }

  /** Grid coordinates -> screen pixels, for developer scripts. */
  project(u: number, v: number) {
    this.projV.set(gridToWorldX(u * (NX - 1)), 0, gridToWorldZ(v * (NZ - 1)));
    this.projV.y = this.terrain.heightAt(this.projV.x, this.projV.z);
    this.projV.project(this.engine.camera);
    return {
      x: (this.projV.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.projV.y * 0.5 + 0.5) * window.innerHeight + FINGER_LIFT_PX,
    };
  }

  get layoutInfo() {
    return {
      hollowU: this.layout.hollowU,
      hollowV: this.layout.hollowV,
      pondU: this.layout.pondU,
      pondV: this.layout.pondV,
      toolsShown: this.toolsShown,
    };
  }

  handleScreen() {
    this.gate.handleAnchor.getWorldPosition(this.projV);
    this.projV.project(this.engine.camera);
    return {
      x: (this.projV.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.projV.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  choose(choice: MenuChoice) {
    this.obs.finish(this.baseHeight, this.terrain.height, this.terrain.mud);
    if (choice === 'same') this.loadLayout(this.layoutId, false);
    else if (choice === 'new') this.loadLayout((this.layoutId + 1) % 3, false);
    else {
      this.loadLayout(2, false);
      this.gate.open = 0.55;
      this.water.gateOpen = 0.55;
      this.applyFraming(this.fDig());
      this.rig.snap();
    }
    this.setTool('dig');
  }
}
