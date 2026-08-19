import * as THREE from 'three';
import { createStage, type Stage } from './core/renderer';
import { CameraRig } from './core/cameraRig';
import { Input } from './core/input';
import { Audio } from './core/audio';
import { loadSettings, saveSettings, type GameSettings } from './core/settings';
import { DIM, FLAVOURS, SLICE_MID, isFastMode, type FlavourId } from './core/tuning';
import { clamp, damp, easeInOutCubic, easeOutCubic, smoothstep } from './core/rng';
import { Lighting } from './scene/lighting';
import { buildKitchen, type Kitchen } from './scene/kitchen';
import { PaintMask } from './scene/paintMask';
import { createMeringueUniforms, type MeringueUniforms } from './scene/materials';
import { buildCake, type Cake } from './scene/cake';
import { Meringue } from './scene/meringue';
import { ColdAir } from './scene/coldAir';
import { Flame, ContactFx } from './scene/flame';
import {
  buildKnife,
  buildMold,
  buildPipingBag,
  buildTorch,
  createToolMaterials,
  type Knife,
  type PipingBag,
  type ToolMaterials,
  type Torch,
} from './scene/tools';
import { Hud } from './ui/hud';

export type Phase =
  | 'intro'
  | 'mold'
  | 'pipe'
  | 'torchIdle'
  | 'torch'
  | 'cut'
  | 'reveal'
  | 'finish';

const DOME_CENTRE = new THREE.Vector3(0, DIM.cakeY, 0);
/** Centre of mass of the pre-split wedge, in cake-root space. */
const SLICE_PIVOT = new THREE.Vector3(
  0.62 * Math.cos(SLICE_MID),
  0.34,
  0.62 * Math.sin(SLICE_MID),
);
/** Out along the notch bisector, then across to screen right, off the plate. */
const SLICE_TRAVEL = new THREE.Vector3(
  0.62 * Math.cos(SLICE_MID) + 1.25 * 0.956,
  0,
  0.62 * Math.sin(SLICE_MID) - 1.25 * 0.29,
);
/** Presentation turn, so the wedge ends up showing its layers to the player. */
const SLICE_TURN = 2.0;
const PHI0 = DIM.sliceStart;
const UP = new THREE.Vector3(0, 1, 0);

const COACH: Partial<Record<Phase, string>> = {
  mold: 'かたを うえに あげてね',
  pipe: 'なぞって クリームを つけよう',
  torchIdle: 'あかい ボタンを タップ！',
  torch: 'なぞって こんがり やこう',
  cut: 'うえから したへ なぞって きろう',
};

/** mould / piping / torch / cut / done */
const PHASE_PIP: Partial<Record<Phase, number>> = {
  intro: 0,
  mold: 0,
  pipe: 1,
  torchIdle: 2,
  torch: 2,
  cut: 3,
  reveal: 4,
  finish: 4,
};

export class Game {
  readonly stage: Stage;
  private rig: CameraRig;
  private input: Input;
  private audio = new Audio();
  private hud: Hud;
  private settings: GameSettings;

  private lighting: Lighting;
  private kitchen: Kitchen;
  private mask: PaintMask;
  private uniforms: MeringueUniforms;
  private cake: Cake;
  private meringue: Meringue;
  private coldAir = new ColdAir();
  private flame: Flame;
  private contact: ContactFx;

  private toolMats: ToolMaterials;
  private torch: Torch;
  private bag: PipingBag;
  private knife: Knife;
  private mold: { group: THREE.Group; dispose: () => void };
  private moldMat: THREE.MeshStandardMaterial | null = null;

  phase: Phase = 'intro';
  private phaseTime = 0;
  private transitioning = false;
  private running = false;
  private rafId = 0;
  private lastTime = 0;

  private flavour: FlavourId = 'vanilla';

  /* interaction state */
  private moldLift = 0;
  private moldLiftTarget = 0;
  private moldFlying = false;
  private squeeze = 0;
  private cutProgress = 0;
  private revealStage = 0;
  private revealHold = 0;
  private sliceT = 0;
  private sliceTarget = 0;
  private lastBakeDir: THREE.Vector3 | null = null;
  private bakeHeat = 0;
  private contactPoint = new THREE.Vector3();
  private hasContact = false;
  private ringPos: { x: number; y: number } | null = null;
  /** Where the ignition button is on screen, clamped into the viewport so the
   *  tap target and the ring the player sees are always the same place. */
  private igniterScreen = { x: 0, y: 0 };
  private igniterKnown = false;
  private swipeHint: { x: number; y: number; dir: 'up' | 'down' } | null = null;
  private pipeDwell = 0;
  private pipeStrokes = 0;

  /* scratch */
  private ray = new THREE.Raycaster();
  private v2 = new THREE.Vector2();
  private vA = new THREE.Vector3();
  private vB = new THREE.Vector3();
  private vC = new THREE.Vector3();
  private vD = new THREE.Vector3();
  private vE = new THREE.Vector3();
  private sphere: THREE.Sphere;
  private quat = new THREE.Quaternion();
  private quat2 = new THREE.Quaternion();

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.settings = loadSettings();

    this.stage = createStage({
      canvas,
      onContextLost: () => this.onContextLost(),
      onContextRestored: () => this.onContextRestored(),
    });
    const { scene, renderer, camera, quality } = this.stage;

    this.rig = new CameraRig(camera);
    this.rig.setOrientation(this.stage.portrait);

    this.lighting = new Lighting(scene, renderer, quality);
    this.lighting.softLight = this.settings.softLight;

    this.kitchen = buildKitchen(quality);
    scene.add(this.kitchen.group);

    this.mask = new PaintMask(renderer, quality.maskSize);
    this.mask.clear();
    this.uniforms = createMeringueUniforms(quality.maskSize);

    this.cake = buildCake(this.uniforms, quality);
    this.kitchen.plate.add(this.cake.root);

    this.meringue = new Meringue(this.mask, this.uniforms, quality);
    this.meringue.attach(this.cake);

    this.cake.domeMain.add(this.coldAir.group);

    this.sphere = new THREE.Sphere(DOME_CENTRE, DIM.meringueRadius);

    this.flame = new Flame(quality.flameExtras);
    this.contact = new ContactFx(quality.flameExtras);
    scene.add(this.contact.group);

    this.toolMats = createToolMaterials();
    this.torch = buildTorch(this.toolMats);
    this.torch.group.add(this.flame.group);
    this.flame.group.position.copy(this.torch.nozzleTip);
    this.torch.group.visible = false;
    scene.add(this.torch.group);

    this.bag = buildPipingBag(this.toolMats);
    this.bag.group.visible = false;
    scene.add(this.bag.group);

    this.knife = buildKnife(this.toolMats);
    this.knife.group.visible = false;
    scene.add(this.knife.group);

    this.mold = buildMold(DIM.meringueRadius + 0.055);
    this.mold.group.position.copy(DOME_CENTRE);
    const first = this.mold.group.children[0] as THREE.Mesh;
    this.moldMat = first.material as THREE.MeshStandardMaterial;
    this.moldMat.transparent = true;
    scene.add(this.mold.group);

    this.hud = new Hud(hudRoot, {
      onReplay: () => this.restartRound(),
      onFlavour: (id) => this.setFlavour(id),
      onToggleSound: () => this.toggleSound(),
      onToggleSoftLight: () => this.toggleSoftLight(),
      onRestart: () => window.location.reload(),
    });
    this.hud.setSound(this.settings.sound);
    this.hud.setSoftLight(this.settings.softLight);
    this.hud.setFlavour(this.flavour);
    this.audio.setEnabled(this.settings.sound);
    this.setFlavour(this.flavour);

    this.input = new Input(canvas, {
      onDown: (p) => this.onDown(p.x, p.y),
      onUp: (p) => this.onUp(p.x, p.y, p.travel, p.heldMs),
      onAbort: (reason) => this.onAbort(reason),
      onResize: () => this.onResize(),
    });

    this.applyPhase('intro');
    this.rig.snapTo('cold');
  }

  /* ------------------------------------------------------------------ *
   * lifecycle
   * ------------------------------------------------------------------ */

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.hud.hideBoot();
    const loop = (t: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0.0005, (t - this.lastTime) / 1000));
      this.lastTime = t;
      this.frame(dt);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.stopFlame('stop');
  }

  private onResize(): void {
    this.stage.resize();
    this.rig.setOrientation(this.stage.portrait);
    // A rotation must never cost the player their browning: the mask is a
    // render target in UV space and is deliberately never re-created here.
    this.stopFlame('resize');
  }

  private onContextLost(): void {
    this.running = false;
    this.stopFlame('context-lost');
    this.hud.showFatal(true);
  }

  private onContextRestored(): void {
    // Textures and the paint mask are gone with the context; the honest move
    // is a clean restart rather than a half-restored cake.
    this.hud.showFatal(true);
  }

  /* ------------------------------------------------------------------ *
   * phases
   * ------------------------------------------------------------------ */

  private applyPhase(p: Phase): void {
    this.phase = p;
    this.phaseTime = 0;
    this.hud.setCoach(COACH[p] ?? null);
    this.hud.setPhaseIndex(PHASE_PIP[p] ?? -1);
    this.hud.showFinish(p === 'finish');
    this.meringue.showGuides(p === 'pipe');
    this.coldAir.setActive(p === 'intro' || p === 'mold' || p === 'pipe');
    this.bag.group.visible = p === 'pipe';
    this.torch.group.visible = p === 'torchIdle' || p === 'torch';
    this.knife.group.visible = p === 'cut';
    this.ringPos = null;
    this.swipeHint = null;
    if (p !== 'torchIdle' && p !== 'torch') this.igniterKnown = false;

    switch (p) {
      case 'intro':
      case 'mold':
        this.lighting.setMood('cold');
        break;
      case 'pipe':
        this.lighting.setMood('work');
        break;
      case 'torchIdle':
      case 'torch':
        this.lighting.setMood('torch');
        break;
      case 'cut':
        this.lighting.setMood('work');
        break;
      case 'reveal':
      case 'finish':
        this.lighting.setMood('finish');
        break;
    }
  }

  private goPhase(p: Phase, shot?: Parameters<CameraRig['goTo']>[0], dur = 1.1): void {
    if (shot) {
      this.transitioning = true;
      this.input.locked = true;
      this.rig.goTo(shot, dur, () => {
        this.transitioning = false;
        this.input.locked = false;
      });
    }
    this.applyPhase(p);
  }

  private setFlavour(id: FlavourId): void {
    this.flavour = id;
    const f = FLAVOURS.find((x) => x.id === id) ?? FLAVOURS[0];
    this.cake.setFlavour(f);
  }

  private toggleSound(): void {
    this.settings.sound = !this.settings.sound;
    saveSettings(this.settings);
    this.audio.setEnabled(this.settings.sound);
    this.hud.setSound(this.settings.sound);
    if (this.settings.sound && this.flame.lit) this.audio.startHiss();
  }

  private toggleSoftLight(): void {
    this.settings.softLight = !this.settings.softLight;
    saveSettings(this.settings);
    this.lighting.softLight = this.settings.softLight;
    this.flame.softLight = this.settings.softLight;
    this.contact.softLight = this.settings.softLight;
    this.hud.setSoftLight(this.settings.softLight);
  }

  restartRound(): void {
    this.meringue.reset();
    this.cake.setCutFacesVisible(false);
    this.cake.slice.position.set(0, 0, 0);
    this.cake.slice.rotation.set(0, 0, 0);
    this.sliceT = 0;
    this.sliceTarget = 0;
    this.cutProgress = 0;
    this.revealStage = 0;
    this.revealHold = 0;
    this.pipeStrokes = 0;
    this.moldLift = 0;
    this.moldLiftTarget = 0;
    this.moldFlying = false;
    this.mold.group.visible = true;
    this.mold.group.position.copy(DOME_CENTRE);
    if (this.moldMat) this.moldMat.opacity = 1;
    this.stopFlame('restart');
    this.rig.orbit = 0;
    this.hud.showFinish(false);
    this.rig.goTo('cold', 0.9, () => {
      this.transitioning = false;
      this.input.locked = false;
    });
    this.transitioning = true;
    this.input.locked = true;
    this.applyPhase('mold');
  }

  /* ------------------------------------------------------------------ *
   * picking
   * ------------------------------------------------------------------ */

  private toNdc(x: number, y: number): THREE.Vector2 {
    return this.v2.set(
      (x / Math.max(1, this.stage.width)) * 2 - 1,
      -(y / Math.max(1, this.stage.height)) * 2 + 1,
    );
  }

  /** Vertical finger offset so the working point is never under the thumb. */
  private touchOffset(kind: 'pipe' | 'torch'): number {
    const h = this.stage.height;
    const base = kind === 'torch' ? 0.115 : 0.085;
    return clamp(h * base, 46, 112);
  }

  /**
   * Pick a direction on the dome. If the ray misses, we slide to the nearest
   * point on the silhouette instead of dropping the input — the working area
   * is deliberately a little more forgiving than it looks.
   */
  private pickDome(x: number, y: number, out: THREE.Vector3): THREE.Vector3 {
    this.ray.setFromCamera(this.toNdc(x, y), this.stage.camera);
    const hit = this.ray.ray.intersectSphere(this.sphere, this.vA);
    if (hit) out.copy(hit);
    else {
      this.ray.ray.closestPointToPoint(DOME_CENTRE, this.vA);
      out.copy(this.vA);
    }
    out.sub(DOME_CENTRE);
    if (out.lengthSq() < 1e-8) out.set(0, 1, 0);
    out.normalize();
    // never paint under the cake
    if (out.y < 0.0) {
      out.y = 0.0;
      out.normalize();
    }
    return out;
  }

  private domeDirToWorld(dir: THREE.Vector3, radius: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(dir).multiplyScalar(radius).add(DOME_CENTRE);
  }

  private projectToScreen(p: THREE.Vector3, out: { x: number; y: number }): void {
    this.vC.copy(p).project(this.stage.camera);
    out.x = ((this.vC.x + 1) / 2) * this.stage.width;
    out.y = ((1 - this.vC.y) / 2) * this.stage.height;
  }

  /* ------------------------------------------------------------------ *
   * input
   * ------------------------------------------------------------------ */

  private onDown(x: number, y: number): void {
    this.audio.unlock();
    if (this.transitioning) return;

    switch (this.phase) {
      case 'intro':
        this.applyPhase('mold');
        break;
      case 'pipe':
        this.meringue.beginStroke();
        this.pipeStrokes++;
        this.pipeAt(x, y, 0.016);
        break;
      case 'torchIdle':
        // Forgiving on purpose: the ring shows where the button is, but a
        // four-year-old's near-miss still lights the torch.
        void this.hitIgniter(x, y);
        this.igniteFlame();
        break;
      case 'torch':
        if (!this.flame.lit) {
          // The flame was cut short by a cancel, a rotation or a deliberate
          // tap — relighting must never be fiddly.
          this.igniteFlame();
        } else if (this.hitIgniter(x, y)) {
          this.stopFlame('tap');
          // A stray second tap should not skip the whole torch beat.
          if (this.meringue.bakedFraction > 0.2) this.finishTorch();
        }
        break;
      case 'cut':
        this.cutProgress = Math.max(this.cutProgress, 0);
        break;
      default:
        break;
    }
  }

  private onUp(x: number, y: number, travel: number, heldMs: number): void {
    void x;
    void y;
    if (this.transitioning) return;
    if (this.phase === 'mold') {
      const tapped = travel < 16 && heldMs < 420;
      if (tapped || this.moldLift > 0.3) this.releaseMold();
      else this.moldLiftTarget = 0;
    }
    if (this.phase === 'pipe') this.squeeze = 0;
  }

  private onAbort(reason: string): void {
    // Losing the finger, the tab, or the orientation must never leave a lit
    // torch running in the background.
    this.stopFlame(reason);
    if (this.phase === 'mold' && !this.moldFlying) this.moldLiftTarget = 0;
    if (this.phase === 'pipe') this.squeeze = 0;
    if (reason === 'hidden') this.audio.suspend();
    else this.audio.resume();
  }

  /* ------------------------------------------------------------------ *
   * phase behaviours
   * ------------------------------------------------------------------ */

  private releaseMold(): void {
    if (this.moldFlying) return;
    this.moldFlying = true;
    this.moldLiftTarget = 1;
    this.audio.moldRelease();
  }

  private pipeAt(x: number, y: number, dtScale: number): void {
    const dir = this.pickDome(x, y - this.touchOffset('pipe'), this.vB);
    const res = this.meringue.pipeAt(dir, dtScale * 62);
    this.squeeze = 1;
    if (res.fresh) this.audio.pipeSqueeze(0.6);
  }

  /** Recompute (and clamp) the on-screen position of the ignition button. */
  private trackIgniter(): void {
    this.torch.group.updateWorldMatrix(true, false);
    this.torch.igniter.getWorldPosition(this.vA);
    this.projectToScreen(this.vA, this.igniterScreen);
    const m = 52;
    this.igniterScreen.x = clamp(this.igniterScreen.x, m, this.stage.width - m);
    this.igniterScreen.y = clamp(this.igniterScreen.y, m, this.stage.height - m);
    this.igniterKnown = true;
  }

  private hitIgniter(x: number, y: number): boolean {
    if (!this.igniterKnown) this.trackIgniter();
    const r = Math.max(76, Math.min(this.stage.width, this.stage.height) * 0.18);
    return Math.hypot(this.igniterScreen.x - x, this.igniterScreen.y - y) < r;
  }

  /** A world point anchored to a screen position, so a near-field tool sits
   *  where the layout wants it in portrait and in landscape alike. */
  private screenPose(
    ndcX: number,
    ndcY: number,
    distFactor: number,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const cam = this.stage.camera;
    const dist = cam.position.distanceTo(DOME_CENTRE) * distFactor;
    out.set(ndcX, ndcY, 0.5).unproject(cam);
    return out.sub(cam.position).normalize().multiplyScalar(dist).add(cam.position);
  }

  private igniteFlame(): void {
    this.audio.unlock();
    this.audio.torchClick();
    this.flame.setLit(true);
    this.torch.setLit(true);
    if (this.settings.sound) this.audio.startHiss();
    if (this.phase === 'torchIdle') this.applyPhase('torch');
  }

  private stopFlame(_reason: string): void {
    if (!this.flame.lit && this.bakeHeat === 0) return;
    this.flame.setLit(false);
    this.torch.setLit(false);
    this.audio.stopHiss();
    this.bakeHeat = 0;
    this.lastBakeDir = null;
    this.lighting.setContact(null, 0);
  }

  private finishTorch(): void {
    this.meringue.setDryness(1);
    this.goPhase('cut', 'cut', 1.2);
  }

  private completeCut(): void {
    this.cake.setCutFacesVisible(true);
    this.sliceTarget = 1;
    this.audio.knifeSlice();
    this.applyPhase('reveal');
    this.transitioning = true;
    this.input.locked = true;
    this.revealStage = 1;
    this.revealHold = 0;
    this.rig.goTo('cutFace', 1.35);
  }

  /** In on the cut face, hold, then pull back to the finished cake. Driven by
   *  simulation time rather than timers, so a paused tab cannot desync it. */
  private updateReveal(dt: number): void {
    switch (this.revealStage) {
      case 1:
        if (!this.rig.moving) {
          this.revealStage = 2;
          this.revealHold = 0;
        }
        break;
      case 2:
        this.revealHold += dt;
        if (this.revealHold > 1.3) {
          this.revealStage = 3;
          this.rig.goTo('hero', 1.5);
        }
        break;
      case 3:
        if (!this.rig.moving) {
          this.revealStage = 0;
          this.rig.orbit = 1;
          this.transitioning = false;
          this.input.locked = false;
          this.applyPhase('finish');
          this.audio.finish();
        }
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ *
   * per-frame
   * ------------------------------------------------------------------ */

  private frame(dt: number): void {
    this.simulate(dt);
    this.stage.renderer.render(this.stage.scene, this.stage.camera);
  }

  private simulate(dt: number): void {
    // Mobile Safari fires resize before it has finished laying the canvas out,
    // so trust the element, not the event.
    const canvas = this.stage.renderer.domElement;
    if (
      canvas.clientWidth > 0 &&
      (canvas.clientWidth !== this.stage.width || canvas.clientHeight !== this.stage.height)
    ) {
      this.onResize();
    }
    this.phaseTime += dt;
    this.input.tick(dt * 1000);
    const p = this.input.pointer;

    switch (this.phase) {
      case 'intro':
        if (this.phaseTime > 1.1) this.applyPhase('mold');
        break;
      case 'mold':
        this.updateMold(dt, p.down, p.downY - p.y);
        break;
      case 'pipe':
        this.updatePipe(dt, p.down, p.x, p.y);
        break;
      case 'torchIdle':
      case 'torch':
        this.updateTorch(dt, p.down, p.x, p.y);
        break;
      case 'cut':
        this.updateCut(dt, p.down, p.downY, p.y);
        break;
      case 'reveal':
        this.updateReveal(dt);
        break;
      default:
        break;
    }

    this.updateSlice(dt);

    this.meringue.update(dt, this.phase === 'pipe' ? 'pipe' : 'other');
    this.coldAir.update(dt);
    this.flame.update(dt);
    this.contact.set(
      this.hasContact ? this.contactPoint : null,
      this.bakeHeat,
      this.stage.camera,
      dt,
    );
    this.lighting.update(dt);
    this.rig.update(dt);

    // HUD overlays that track world objects
    if (this.ringPos) this.hud.showRing(this.ringPos.x, this.ringPos.y);
    else this.hud.hideRing();
    if (this.swipeHint) this.hud.showSwipe(this.swipeHint.x, this.swipeHint.y, this.swipeHint.dir);
    else this.hud.hideSwipe();

    this.mask.flush();
  }

  private updateMold(dt: number, down: boolean, dragUp: number): void {
    if (!this.moldFlying) {
      if (down) this.moldLiftTarget = clamp(dragUp / 150, 0, 1);
      const hintDir = this.vA.set(0, DIM.meringueRadius + 0.5, 0).add(DOME_CENTRE);
      const s = { x: 0, y: 0 };
      this.projectToScreen(hintDir, s);
      this.swipeHint = { x: s.x, y: s.y + 40, dir: 'up' };
      if (this.moldLiftTarget >= 0.995) this.releaseMold();
    } else {
      this.swipeHint = null;
    }

    this.moldLift = damp(this.moldLift, this.moldLiftTarget, this.moldFlying ? 4.2 : 12, dt);
    const lift = this.moldFlying
      ? easeOutCubic(clamp(this.moldLift, 0, 1)) * 2.4
      : this.moldLift * 0.42;
    this.mold.group.position.set(DOME_CENTRE.x, DOME_CENTRE.y + lift, DOME_CENTRE.z);
    this.mold.group.rotation.z = this.moldFlying ? this.moldLift * 0.22 : 0;
    if (this.moldMat) this.moldMat.opacity = 1 - smoothstep(0.55, 1, this.moldLift);

    if (this.moldFlying && this.moldLift > 0.97) {
      this.mold.group.visible = false;
      this.audio.plateSet();
      this.goPhase('pipe', 'pipe', 1.15);
    }
  }

  private updatePipe(dt: number, down: boolean, x: number, y: number): void {
    this.squeeze = damp(this.squeeze, down ? 1 : 0, 10, dt);
    this.bag.setSqueeze(this.squeeze);

    if (down) {
      this.pipeDwell += dt;
      // Keep laying meringue even if the finger is held still.
      this.pipeAt(x, y, dt);
    } else {
      this.pipeDwell = 0;
    }

    // Park the bag where the finger is, tip against the dome, body up out of frame.
    const dir = down
      ? this.pickDome(x, y - this.touchOffset('pipe'), this.vB)
      : this.vB.set(0.45, 0.86, 0.25).normalize();
    const surface = this.domeDirToWorld(dir, DIM.meringueRadius + 0.05, this.vA);
    const away = this.toolAway(dir, 0.95, 0.4, -0.28);
    this.placeTool(this.bag.group, this.bag.tip, surface, away);

    // Four to seven fat strokes are enough; the rest is filled in for them.
    const enough =
      this.meringue.frontCoverage > 0.62 ||
      (this.pipeStrokes >= 5 && this.meringue.frontCoverage > 0.35) ||
      this.phaseTime > 75;
    if (enough) this.meringue.requestFullFill();

    if (!this.meringue.filling && this.meringue.coverage > 0.96) {
      this.goPhase('torchIdle', 'torch', 1.25);
    }
  }

  private updateTorch(dt: number, down: boolean, x: number, y: number): void {
    const lit = this.flame.lit;

    // Ready pose: held clear of the cake, angled towards it.
    // Portrait parks the torch low and centred; landscape moves it to one side.
    const readyPos = this.stage.portrait
      ? this.screenPose(0.0, -0.58, 0.62, this.vD)
      : this.screenPose(0.6, -0.4, 0.82, this.vD);

    let heat = 0;
    if (lit && down) {
      const dir = this.pickDome(x, y - this.touchOffset('torch'), this.vB);
      const surface = this.domeDirToWorld(dir, DIM.meringueRadius + 0.02, this.contactPoint);
      this.hasContact = true;
      heat = 1;

      // The torch body sits above the contact point on screen, so neither the
      // flame nor the browning is ever hidden behind the finger.
      const away = this.toolAway(dir, 0.82, 0.42, 0.46);
      const flameLen = this.torch.nozzleTip.y + this.flame.tipLocal.y;
      this.vE.copy(surface).addScaledVector(away, flameLen);
      this.torch.group.position.lerp(this.vE, Math.min(1, dt * 22));
      this.aimTool(this.torch.group, away.multiplyScalar(-1));

      // Paint a continuous trail even if the finger outruns the frame rate.
      this.bakeTrail(dir, heat, dt);
      this.lighting.setContact(surface, this.flame.level);
    } else {
      this.hasContact = false;
      this.torch.group.position.lerp(readyPos, Math.min(1, dt * 6));
      this.vE.set(0, DIM.cakeY + 0.25, 0).sub(this.torch.group.position).normalize();
      this.aimTool(this.torch.group, this.vE);
      this.lastBakeDir = null;
      this.lighting.setContact(null, 0);
    }
    this.bakeHeat = damp(this.bakeHeat, lit && down ? 1 : 0, 8, dt);
    this.audio.setSizzle(this.settings.sound ? this.bakeHeat * this.flame.level : 0);

    // The target is tracked every frame; it is only *shown* when tapping it is
    // the thing to do next.
    this.trackIgniter();
    const showRing = !lit || this.meringue.bakedFraction > 0.5;
    this.ringPos = showRing ? { x: this.igniterScreen.x, y: this.igniterScreen.y } : null;

    if (!lit && this.phase === 'torch' && this.meringue.bakedFraction > 0.12) {
      this.hud.setCoach('あかい ボタンで また つけられるよ');
    } else {
      this.hud.setCoach(COACH[this.phase] ?? null);
    }

    const baked = this.meringue.bakedFraction;
    if (lit && (baked >= 0.82 || (this.phaseTime > 100 && baked > 0.25))) {
      this.stopFlame('baked');
      this.finishTorch();
    }
  }

  private bakeTrail(dir: THREE.Vector3, heat: number, dt: number): void {
    const prev = this.lastBakeDir;
    if (prev) {
      const ang = prev.angleTo(dir);
      const steps = Math.min(10, Math.max(1, Math.ceil(ang / 0.05)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        this.vA.copy(prev).lerp(dir, t).normalize();
        this.meringue.bakeAt(this.vA, heat, dt / steps);
      }
    } else {
      this.meringue.bakeAt(dir, heat, dt);
    }
    this.lastBakeDir = (prev ?? new THREE.Vector3()).copy(dir);
  }

  private updateCut(dt: number, down: boolean, downY: number, y: number): void {
    const span = this.stage.height * 0.3;
    if (down) {
      this.cutProgress = Math.max(this.cutProgress, clamp((y - downY) / span, 0, 1));
    }

    const t = easeInOutCubic(this.cutProgress);
    const radial = 0.18 + t * 1.18;
    const blade = this.knife.bladeLength;
    const topY = DIM.cakeY + DIM.meringueRadius + 0.3 + blade;
    const botY = DIM.plateHeight - 0.04 + blade;
    this.knife.group.position.set(
      Math.cos(PHI0) * radial,
      topY + (botY - topY) * t,
      Math.sin(PHI0) * radial,
    );
    // The blade lies in the cut plane, cheated ~25 degrees towards the lens so
    // a 4 mm blade still reads on a phone screen.
    this.knife.group.rotation.set(0, Math.PI / 2 - PHI0 + 0.44, 0);

    const s = { x: 0, y: 0 };
    this.projectToScreen(this.vA.set(0, DIM.cakeY + 0.55, 0.45), s);
    this.swipeHint = this.cutProgress < 0.9 ? { x: s.x, y: s.y, dir: 'down' } : null;

    if (this.cutProgress >= 0.985) this.completeCut();
    void dt;
  }

  /**
   * Lift the wedge out, carry it clear of the notch and set it down turned so
   * its cut face reads. The pivot is the wedge's own centre of mass, not the
   * cake's axis, so it turns in place instead of swinging round the cake.
   */
  private updateSlice(dt: number): void {
    if (this.sliceT === this.sliceTarget) return;
    this.sliceT = damp(this.sliceT, this.sliceTarget, 2.2, dt);
    if (Math.abs(this.sliceT - this.sliceTarget) < 0.002) this.sliceT = this.sliceTarget;
    const e = easeOutCubic(clamp(this.sliceT, 0, 1));

    this.quat.setFromAxisAngle(UP, SLICE_TURN * e);
    this.vA.copy(SLICE_PIVOT);
    this.vB.copy(SLICE_PIVOT).applyQuaternion(this.quat);
    this.cake.slice.quaternion.copy(this.quat);
    this.cake.slice.position
      .copy(this.vA)
      .sub(this.vB)
      .addScaledVector(SLICE_TRAVEL, e);
    this.cake.slice.position.y += Math.sin(e * Math.PI) * 0.2 - DIM.plateHeight * e;
  }

  /* ------------------------------------------------------------------ *
   * tool placement helpers
   * ------------------------------------------------------------------ */

  /**
   * Direction the tool body leans away from the working point. Biases are in
   * *screen* space, so the tool always enters from the top edge of the frame
   * rather than from the lens — that is what keeps the contact point visible.
   */
  private toolAway(
    surfaceDir: THREE.Vector3,
    upBias: number,
    normalBias: number,
    rightBias: number,
  ): THREE.Vector3 {
    const cam = this.stage.camera;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    return up
      .multiplyScalar(upBias)
      .addScaledVector(right, rightBias)
      .addScaledVector(surfaceDir, normalBias)
      .normalize();
  }

  /**
   * Point a tool's local +Y along `dir`, then roll it about that axis so its
   * local +Z (the face carrying the ignition button) turns towards the player.
   */
  private aimTool(group: THREE.Object3D, dir: THREE.Vector3, faceCamera = true): void {
    this.quat.setFromUnitVectors(UP, dir);
    if (faceCamera) {
      const cur = this.vA.set(0, 0, 1).applyQuaternion(this.quat);
      cur.addScaledVector(dir, -cur.dot(dir));
      const want = this.vC.subVectors(this.stage.camera.position, group.position);
      want.addScaledVector(dir, -want.dot(dir));
      if (cur.lengthSq() > 1e-6 && want.lengthSq() > 1e-6) {
        cur.normalize();
        want.normalize();
        const angle = Math.atan2(
          this.vC.copy(cur).cross(want).dot(dir),
          Math.min(1, Math.max(-1, cur.dot(want))),
        );
        this.quat2.setFromAxisAngle(dir, angle);
        this.quat.premultiply(this.quat2);
      }
    }
    group.quaternion.copy(this.quat);
  }

  /** Place a tool so its working tip lands on `target`, body leaning `away`. */
  private placeTool(
    group: THREE.Object3D,
    tipLocal: THREE.Vector3,
    target: THREE.Vector3,
    away: THREE.Vector3,
  ): void {
    this.aimTool(group, away, false);
    const offset = tipLocal.clone().applyQuaternion(group.quaternion);
    group.position.copy(target).sub(offset);
  }

  /* ------------------------------------------------------------------ *
   * test / automation surface
   * ------------------------------------------------------------------ */

  snapshot() {
    return {
      phase: this.phase,
      coverage: Number(this.meringue.coverage.toFixed(4)),
      frontCoverage: Number(this.meringue.frontCoverage.toFixed(4)),
      bakedFraction: Number(this.meringue.bakedFraction.toFixed(4)),
      flameLit: this.flame.lit,
      flameLevel: Number(this.flame.level.toFixed(3)),
      cutProgress: Number(this.cutProgress.toFixed(3)),
      sliceOut: Number(this.sliceT.toFixed(3)),
      portrait: this.stage.portrait,
      transitioning: this.transitioning,
      drawCalls: this.stage.renderer.info.render.calls,
      triangles: this.stage.renderer.info.render.triangles,
      fast: isFastMode(),
    };
  }

  /**
   * Run the simulation forward without waiting on rAF. Rendering is skipped by
   * default so an automated pass is not held hostage by a software renderer.
   */
  advance(ms: number, step = 16, render = false): void {
    const frames = Math.min(2000, Math.max(1, Math.round(ms / step)));
    for (let i = 0; i < frames; i++) {
      if (render) this.frame(step / 1000);
      else this.simulate(step / 1000);
    }
  }

  /** Cover the dome the way a finished piping pass would. */
  autoPipe(): void {
    this.meringue.requestFullFill();
  }

  /** Brown everything the player can see, as a long torch pass would. */
  autoBake(amount = 1): void {
    const v = new THREE.Vector3();
    for (let i = 0; i < 240; i++) {
      const t = i / 240;
      const elev = (t * 1.35) % 1.35;
      const phi = SLICE_MID + Math.sin(i * 0.7) * 1.6;
      v.set(Math.cos(elev) * Math.cos(phi), Math.sin(elev), Math.cos(elev) * Math.sin(phi));
      this.meringue.bakeAt(v.normalize(), amount, 0.05);
    }
  }

  forcePhase(p: Phase): void {
    this.applyPhase(p);
  }

  /** Drive the knife all the way through, as a completed downward swipe would. */
  autoCut(): void {
    if (this.phase !== 'cut') this.applyPhase('cut');
    this.cutProgress = 1;
    this.completeCut();
  }

  dispose(): void {
    this.stop();
    this.input.dispose();
    this.hud.dispose();
    this.meringue.dispose();
    this.cake.dispose();
    this.kitchen.dispose();
    this.mask.dispose();
    this.flame.dispose();
    this.contact.dispose();
    this.coldAir.dispose();
    this.torch.dispose();
    this.bag.dispose();
    this.knife.dispose();
    this.mold.dispose();
    this.toolMats.dispose();
    this.lighting.dispose();
    this.stage.dispose();
  }
}
