/**
 * ひかる金魚ねぶた — the whole play session.
 *
 * The order of the chapters is the order of the craft: frame, paper, sumi, wax resist, dye,
 * drying and the cart, the walk out into the evening yard, the switch, and the parade. The
 * dangerous steps are never handed to the child — the frame, the blade, the hot wax and the
 * wiring are all the teacher's, and the child gets the big sheets, the brushes, the safe
 * switch and the rope.
 */

import {
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  PCFSoftShadowMap,
  Plane,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { detectTier, settingsFor, type QualitySettings } from '../core/Quality';
import { Viewport } from '../core/Viewport';
import { InputController } from '../core/Input';
import { CameraDirector } from '../core/CameraDirector';
import { PostPipeline } from '../core/Post';
import { PaintAtlas, StampKind } from '../nebuta/PaintAtlas';
import { InteriorBake } from '../nebuta/InteriorBake';
import { buildFrame, type FrameBuild } from '../nebuta/Frame';
import { PaperPanels, type PanelRuntime } from '../nebuta/Paper';
import { Lamps } from '../nebuta/Lamps';
import { CHILD_PATCHES, NEBUTA, PATCHES, localToTile } from '../nebuta/shape';
import { DYES, WAX } from '../nebuta/artwork';
import { Environment } from '../world/Environment';
import { Scenery } from '../world/Scenery';
import { Cart, Rope } from '../world/Cart';
import { AudioEngine } from '../audio/Audio';
import { UI } from '../ui/UI';
import {
  buildGuidePaths,
  guideProgress,
  raycastPanels,
  resetGuides,
  snapToGuide,
  type GuidePath,
  type SurfaceHit,
} from './Interaction';
import { clamp, damp, easeInOutCubic, easeOutCubic, lerp, makeRng, smoothstep } from '../util/math';
import { disposeTextureCache, woodTextures } from '../util/textures';

export type StageName =
  | 'intro'
  | 'firstPaper'
  | 'freePaper'
  | 'ink'
  | 'wax'
  | 'dye'
  | 'dry'
  | 'toYard'
  | 'lightUp'
  | 'parade'
  | 'finale';

const STEP_OF: Record<StageName, number> = {
  intro: 0,
  firstPaper: 1,
  freePaper: 1,
  ink: 2,
  wax: 3,
  dye: 4,
  dry: 5,
  toYard: 5,
  lightUp: 6,
  parade: 7,
  finale: 7,
};

const TRESTLE = new Vector3(-0.35, 0, 0.25);
const WORKSHOP_CART = new Vector3(2.35, 0, -1.55);

export class Game {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly quality: QualitySettings;
  readonly viewport: Viewport;
  readonly director: CameraDirector;
  readonly input: InputController;
  readonly audio = new AudioEngine();
  readonly ui: UI;

  private readonly post: PostPipeline;
  private readonly atlas: PaintAtlas;
  private readonly bake: InteriorBake;
  private readonly frame: FrameBuild;
  private readonly paper: PaperPanels;
  private readonly lamps: Lamps;
  private readonly env: Environment;
  private readonly scenery: Scenery;
  private readonly cart: Cart;
  private readonly rope: Rope;

  /** Everything that is "the nebuta": frame, paper, lamps. Moves from trestle to cart. */
  private readonly mount = new Group();
  private readonly carrier = new Group();
  private readonly teacherHand: Group;
  private readonly guides: GuidePath[] = buildGuidePaths();

  private stage: StageName = 'intro';
  private stageTime = 0;
  private time = 0;
  private running = false;
  private ready = false;
  private frameTimeAvg = 16.7;
  private sceneDrawCalls = 0;
  private sceneTriangles = 0;
  private renderScale: number;
  private lastPaintTile: { a: number; b: number; patch: string } | null = null;
  private held: PanelRuntime | null = null;
  private heldDistance = Infinity;
  private firstPaperDone = false;
  private dyeIndex = 0;
  private paradeIdle = 0;
  private shotIndex = 0;
  private shotTimer = 0;
  private handWorld = new Vector3(2.2, 0.55, 0);
  private reversalTimer = 0;
  private lastLateral = 0;
  private finaleT = 0;
  private paperOnly = false;
  private waxIndex = 0;
  private waxT = 0;
  private readonly waxTarget = new Vector3();
  private readonly rng = makeRng(4242);
  private readonly tmp = new Vector3();
  private readonly tmp2 = new Vector3();
  private readonly groundPlane = new Plane(new Vector3(0, 1, 0), -0.55);
  private readonly planeRay = new Raycaster();

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      depth: true,
      stencil: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL 2 is required');

    const tier = detectTier(gl);
    this.quality = settingsFor(tier);
    this.renderScale = this.quality.renderScale;

    this.renderer = new WebGLRenderer({ canvas, context: gl, antialias: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    // tone mapping happens in the composite pass, so materials must not apply it twice
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x0c0910, 1);

    this.viewport = new Viewport(this.quality.maxDpr);
    this.director = new CameraDirector(this.viewport);
    this.input = new InputController(canvas);
    this.ui = new UI(8);

    const samples = tier === 'high' ? 4 : tier === 'standard' ? 2 : 0;
    this.post = new PostPipeline(this.renderer, 32, 32, this.quality.bloomIterations, samples);

    this.atlas = new PaintAtlas(this.renderer, this.quality);
    this.bake = new InteriorBake(this.renderer, this.quality.interiorAtlas);
    this.frame = buildFrame(this.quality);
    this.paper = new PaperPanels(this.quality, {
      paper: this.atlas.paperRT.texture,
      ink: this.atlas.inkRT.texture,
      dye: this.atlas.dyeTexture,
      interior: this.bake.target.texture,
      guide: this.atlas.guideTexture,
    });
    this.lamps = new Lamps(this.quality);
    this.env = new Environment(this.renderer, this.scene, this.quality);
    this.scenery = new Scenery(this.quality);
    this.cart = new Cart();
    this.rope = new Rope();

    this.mount.add(this.frame.group, this.paper.group, this.lamps.group);
    this.carrier.add(this.mount);
    this.carrier.position.copy(TRESTLE);
    this.scene.add(this.carrier);
    this.scene.add(this.scenery.workshop, this.scenery.yard);
    this.scene.add(this.cart.group);
    this.scene.add(this.rope.mesh);
    this.rope.mesh.visible = false;
    this.cart.group.position.copy(WORKSHOP_CART);
    this.cart.group.rotation.y = -0.42;
    this.cart.deckPivot.add(this.lamps.switchGroup);

    this.scenery.workshop.add(this.buildTrestles());
    this.teacherHand = this.buildTeacherHand();
    this.scene.add(this.teacherHand);
    this.teacherHand.visible = false;

    this.computeBounds();
    this.viewport.onChange(() => this.resize());
    this.resize();
    this.bindUI();
    this.bindLifecycle();
  }

  /* ================================================================ setup */

  private buildTrestles(): Group {
    const g = new Group();
    const w = woodTextures(256, { hueA: '#b59468', hueB: '#7f6242', ringFreq: 12, wear: 0.5, seed: 71 });
    const mat = new MeshStandardMaterial({
      map: w.map,
      normalMap: w.normalMap,
      roughnessMap: w.roughnessMap,
      roughness: 1,
    });
    for (const dx of [-0.62, 0.62]) {
      const top = new Mesh(new BoxGeometry(0.15, 0.06, 0.82), mat);
      top.position.set(TRESTLE.x + dx, NEBUTA.deckY - 0.03, TRESTLE.z);
      top.castShadow = true;
      top.receiveShadow = true;
      g.add(top);
      for (const dz of [-0.3, 0.3]) {
        for (const s of [-1, 1]) {
          const leg = new Mesh(new BoxGeometry(0.05, 0.42, 0.05), mat);
          leg.position.set(TRESTLE.x + dx + s * 0.07, (NEBUTA.deckY - 0.06) / 2, TRESTLE.z + dz);
          leg.rotation.z = s * 0.12;
          leg.castShadow = true;
          g.add(leg);
        }
      }
    }
    return g;
  }

  /** The teacher's hand and wax pen, seen only during the short wax-resist sequence. */
  private buildTeacherHand(): Group {
    const g = new Group();
    const skin = new MeshStandardMaterial({ color: new Color('#e2b393'), roughness: 0.7 });
    const palm = new Mesh(new SphereGeometry(0.05, 12, 10), skin);
    palm.scale.set(1, 0.62, 1.35);
    palm.position.set(0, 0.06, 0.06);
    g.add(palm);
    for (let i = 0; i < 3; i++) {
      const f = new Mesh(new CylinderGeometry(0.011, 0.01, 0.07, 6), skin);
      f.position.set(-0.02 + i * 0.02, 0.035, 0.005);
      f.rotation.x = 0.7;
      g.add(f);
    }
    const pen = new Mesh(
      new CylinderGeometry(0.008, 0.013, 0.16, 8),
      new MeshStandardMaterial({ color: new Color('#c08a33'), metalness: 0.45, roughness: 0.34 }),
    );
    pen.position.set(0, 0.075, 0);
    pen.rotation.x = 0.35;
    g.add(pen);
    const tip = new Mesh(
      new SphereGeometry(0.007, 8, 6),
      new MeshStandardMaterial({
        color: new Color('#f6e6c0'),
        emissive: new Color('#ffcf8a'),
        emissiveIntensity: 0.6,
        roughness: 0.3,
      }),
    );
    g.add(tip);
    return g;
  }

  private bindUI(): void {
    this.ui.onDye = (i) => {
      this.dyeIndex = i;
      this.audio.chime();
    };
    this.ui.onMute = (m) => this.audio.setMuted(m);
    this.ui.onBig = () => this.advance();
    this.ui.onReplay = (choice) => {
      if (choice === 'parade') this.replayParade();
      else if (choice === 'remake') this.replayRemake();
      else this.replayPaperOnly();
    };
  }

  private bindLifecycle(): void {
    const onResize = () => this.viewport.measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 220));
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.input.forceRelease();
        this.audio.suspend();
      } else {
        this.audio.resume();
      }
    });
    const unlock = () => {
      void this.audio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: false });
  }

  private resize(): void {
    const w = Math.max(1, this.viewport.width);
    const h = Math.max(1, this.viewport.height);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, true);
    const rw = Math.max(2, Math.round(w * this.viewport.dpr * this.renderScale));
    const rh = Math.max(2, Math.round(h * this.viewport.dpr * this.renderScale));
    this.post.setSize(rw, rh);
    this.director.update(0);
  }

  /** Compiles shaders and bakes the interior lighting before the child touches anything. */
  async prepare(onProgress: (t: number) => void): Promise<void> {
    this.atlas.prewarm();
    for (const p of PATCHES) if (p.preAttached) this.atlas.fillTile(p.tile, 1);
    this.atlas.flush();

    this.bake.begin(this.paper.panels, this.frame.capsules);
    // one panel per frame keeps the longest single draw call small on mobile GPUs
    while (!this.bake.done) {
      this.bake.step();
      onProgress(this.bake.progress * 0.7);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }

    this.scenery.setPlace('workshop');
    this.env.setPhase(0, true);
    this.applyStageCamera(true);
    this.renderer.compile(this.scene, this.director.camera);
    onProgress(0.86);
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    // draw one hidden frame so the bloom pipeline is hot before the light-up
    this.renderer.setRenderTarget(this.post.sceneRT);
    this.renderer.render(this.scene, this.director.camera);
    this.renderer.setRenderTarget(null);
    this.post.prewarm();
    onProgress(1);
    this.ready = true;
    this.running = true;
    this.setStage('intro');
  }

  /* ================================================================ frame loop */

  tick(dtRaw: number): void {
    if (!this.ready) return;
    const dt = clamp(dtRaw, 0, 1 / 20);
    this.time += dt;
    this.stageTime += dt;

    this.input.update(dt);
    if (this.input.justReleased || this.input.justPressed) this.lastPaintTile = null;
    this.audio.update(dt);
    this.ui.update(dt);

    this.updateStage(dt);

    this.paper.setDyeTexture(this.atlas.dyeTexture);
    this.paper.update(dt, this.time);
    this.lamps.update(dt, this.time, this.stage === 'lightUp' && !this.lamps.on ? 1 : 0);
    this.cart.update(dt);
    this.scenery.update(dt, this.time, this.cart.group.position, this.lamps.master, this.paradeEnergy());
    this.scenery.playHayashi(this.audio.beat, this.audio.drumHit, this.paradeEnergy());
    this.paper.setLamps(this.lamps.levels[0], this.lamps.levels[1], this.lamps.levels[2], this.lamps.master);
    this.paper.setDaylight(this.dayThrough(), this.env.backAmbient);
    this.audio.setLampHum(this.lamps.master);

    this.director.update(dt);
    this.atlas.flush();
    this.render(dt);
  }

  private render(dt: number): void {
    this.post.exposure = this.env.exposure * this.finaleExposure() * (1 - this.fadeAmt * 0.94);
    this.post.bloomStrength = this.quality.bloom
      ? lerp(0.07, 0.3, this.lamps.master) * (this.stage === 'intro' ? 0.5 : 1)
      : 0;
    this.post.vignette = lerp(0.14, 0.34, this.lamps.master);
    this.post.warm = this.lamps.master * 0.4;
    this.post.grain = this.quality.tier === 'high' ? 0.006 : 0;

    this.renderer.setRenderTarget(this.post.sceneRT);
    this.renderer.clear();
    this.renderer.render(this.scene, this.director.camera);
    // capture before the post passes overwrite the counters
    this.sceneDrawCalls = this.renderer.info.render.calls;
    this.sceneTriangles = this.renderer.info.render.triangles;
    this.post.present(this.time);

    this.adaptResolution(dt);
  }

  /** Dynamic resolution: nudge the render scale so the frame budget is kept. */
  private adaptResolution(dt: number): void {
    const ms = dt * 1000;
    this.frameTimeAvg += (ms - this.frameTimeAvg) * 0.06;
    const target = 1000 / 60;
    let next = this.renderScale;
    if (this.frameTimeAvg > target * 1.55) next -= 0.02;
    else if (this.frameTimeAvg < target * 1.05) next += 0.008;
    next = clamp(next, this.quality.minRenderScale, this.quality.renderScale);
    if (Math.abs(next - this.renderScale) > 0.012) {
      this.renderScale = next;
      const w = Math.max(2, Math.round(this.viewport.width * this.viewport.dpr * this.renderScale));
      const h = Math.max(2, Math.round(this.viewport.height * this.viewport.dpr * this.renderScale));
      this.post.setSize(w, h);
    }
  }

  private dayThrough(): number {
    // by day the sheet is lit from behind by the room; at night the lamps take over
    return lerp(0.55, 0.1, this.lamps.master) * lerp(1, 0.35, clamp(this.env.currentPhase / 3, 0, 1));
  }

  private finaleExposure(): number {
    if (this.stage !== 'finale') return 1;
    const t = this.finaleT;
    // two short cross-fades between the daylight version and the lit version
    const fade = (x: number) => 1 - 0.85 * Math.exp(-Math.pow((t - x) / 0.34, 2));
    return fade(3.4) * fade(7.2);
  }

  private paradeEnergy(): number {
    return clamp(Math.abs(this.cart.speed) / 1.3 + Math.abs(this.cart.yawRate) * 0.3, 0, 1);
  }

  /* ================================================================ stages */

  private setStage(s: StageName): void {
    this.stage = s;
    this.stageTime = 0;
    this.lastPaintTile = null;
    this.ui.showBig(false);
    this.ui.showPalette(false);
    this.ui.showSteps(s !== 'lightUp' && s !== 'finale', STEP_OF[s]);
    this.ui.restore();

    switch (s) {
      case 'intro':
        this.ui.setHint('🎋', 'なにに なるのかな？');
        break;
      case 'firstPaper':
        this.ui.setHint('📄', 'かみを ほねぐみへ もっていこう');
        break;
      case 'freePaper':
        this.ui.setHint('📄', 'すきな ところから はろう');
        break;
      case 'ink':
        this.inkZoom = 0;
        this.paper.setGuideFade(1);
        this.ui.setHint('🖌️', 'ふとい せんを ゆびで なぞろう');
        break;
      case 'wax':
        this.paper.setGuideFade(0.25);
        this.teacherHand.visible = true;
        this.teacherHand.position.copy(this.nebutaWorldCentre(new Vector3()));
        this.waxTarget.copy(this.teacherHand.position);
        this.waxIndex = 0;
        this.waxT = 0;
        this.ui.setHint('🕯️', 'せんせいが ろうで もようを かくよ');
        break;
      case 'dye':
        this.inkZoom = 0;
        this.paper.setGuideFade(0);
        this.teacherHand.visible = false;
        this.ui.showPalette(true);
        this.ui.setHint('🎨', 'すきな いろを ぬろう');
        break;
      case 'dry':
        this.ui.setHint('🚚', 'かわいたら だいしゃに のせるよ');
        break;
      case 'toYard':
        this.ui.setHint('🌇', 'えんていへ はこぼう');
        break;
      case 'lightUp':
        this.ui.setHint('💡', 'おおきい スイッチを おそう');
        break;
      case 'parade':
        this.ui.setHint('🪢', 'ロープを まえへ ひこう');
        this.ui.showBig(true, 'おしまい');
        break;
      case 'finale':
        this.finaleT = 0;
        this.ui.hideHint();
        break;
    }
  }

  private advance(): void {
    switch (this.stage) {
      case 'firstPaper':
        this.setStage('freePaper');
        break;
      case 'freePaper':
        this.teacherFinishesPaper();
        if (this.paperOnly) {
          this.setStage('lightUp');
          this.moveToYard(true);
        } else this.setStage('ink');
        break;
      case 'ink':
        this.setStage('wax');
        break;
      case 'dye':
        this.setStage('dry');
        break;
      case 'parade':
        this.setStage('finale');
        break;
      default:
        break;
    }
  }

  /** Any sheet the child did not get to is pasted by the teacher, neatly and without fuss. */
  private teacherFinishesPaper(): void {
    for (const p of this.paper.remaining()) {
      p.state = 'attached';
      p.attach = 1;
      p.smoothed = 1;
      p.handOffset.set(0, 0, 0);
      p.mesh.visible = true;
      this.atlas.fillTile(p.spec.tile, 1);
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          this.atlas.add(StampKind.Smooth, {
            tile: p.spec.tile,
            a: (i + 0.5) / 5,
            b: (j + 0.5) / 5,
            radius: 0.16,
            aspect: 1,
            angle: 0,
            strength: 0.96,
            extra: 0,
            seed: this.rng(),
          });
          this.atlas.mark(p.spec.id, (i + 0.5) / 5, (j + 0.5) / 5, 0);
        }
      }
      this.atlas.flush();
    }
    this.held = null;
    this.pendingSmooth = null;
  }

  private updateStage(dt: number): void {
    switch (this.stage) {
      case 'intro':
        this.stageIntro(dt);
        break;
      case 'firstPaper':
      case 'freePaper':
        this.stagePaper(dt);
        break;
      case 'ink':
        this.stageInk(dt);
        break;
      case 'wax':
        this.stageWax(dt);
        break;
      case 'dye':
        this.stageDye(dt);
        break;
      case 'dry':
        this.stageDry(dt);
        break;
      case 'toYard':
        this.stageToYard(dt);
        break;
      case 'lightUp':
        this.stageLightUp(dt);
        break;
      case 'parade':
        this.stageParade(dt);
        break;
      case 'finale':
        this.stageFinale(dt);
        break;
    }
    this.applyStageCamera(false);
  }

  /* ---------------------------------------------------------------- intro */

  private stageIntro(dt: number): void {
    void dt;
    if (this.stageTime > 3.4 || this.input.justPressed) {
      this.setStage('firstPaper');
    }
  }

  /* ---------------------------------------------------------------- paper */

  private pendingSmooth: PanelRuntime | null = null;

  /** Where the paint lands: a little above the fingertip so the hand never hides it. */
  private paintNdc(out = new Vector2()): Vector2 {
    const off = this.director.fingerOffset();
    const w = this.viewport.width || 1;
    const h = this.viewport.height || 1;
    return out.set(
      ((this.input.css.x + off.x) / w) * 2 - 1,
      -((this.input.css.y + off.y) / h) * 2 + 1,
    );
  }

  private screenOf(world: Vector3, out = new Vector2()): Vector2 {
    this.tmp2.copy(world).project(this.director.camera);
    return out.set(
      ((this.tmp2.x + 1) / 2) * this.viewport.width,
      ((1 - this.tmp2.y) / 2) * this.viewport.height,
    );
  }

  private panelWorldCentre(p: PanelRuntime, out = new Vector3()): Vector3 {
    return out.copy(p.centre).applyMatrix4(this.mount.matrixWorld);
  }

  /** True when this panel's outer face is turned toward the lens. */
  private panelFacing(p: PanelRuntime): number {
    this.tmp2.copy(p.normal).transformDirection(this.mount.matrixWorld);
    this.panelWorldCentre(p, this.tmp);
    this.tmp.subVectors(this.director.camera.position, this.tmp).normalize();
    return this.tmp2.dot(this.tmp);
  }

  /**
   * The sheet in hand goes to the nearest spot the child can actually see. Panels turned away
   * from the lens are never candidates, so paper cannot land somewhere invisible.
   */
  private nearestCandidate(): { panel: PanelRuntime; dist: number } | null {
    let best: PanelRuntime | null = null;
    let bestD = Infinity;
    let bestAny: PanelRuntime | null = null;
    let bestAnyD = Infinity;
    const s = new Vector2();
    for (const p of this.paper.remaining()) {
      this.screenOf(this.panelWorldCentre(p, this.tmp), s);
      const d = Math.hypot(s.x - this.input.css.x, s.y - this.input.css.y);
      if (d < bestAnyD) {
        bestAnyD = d;
        bestAny = p;
      }
      if (this.panelFacing(p) < 0.06) continue;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) return { panel: best, dist: bestD };
    return bestAny ? { panel: bestAny, dist: bestAnyD } : null;
  }

  /** Average outward direction of the sheets still to be pasted. */
  private unpapered(out = new Vector3()): Vector3 {
    out.set(0, 0, 0);
    const rest = this.paper.remaining();
    for (const p of rest) {
      this.tmp2.copy(p.normal).transformDirection(this.mount.matrixWorld);
      out.add(this.tmp2);
    }
    if (rest.length) out.divideScalar(rest.length);
    return out;
  }

  /** Projects the finger onto the plane the held sheet floats in. */
  private handPointFor(p: PanelRuntime, out = new Vector3()): Vector3 {
    const ndc = this.paintNdc();
    this.planeRay.setFromCamera(ndc, this.director.camera);
    this.panelWorldCentre(p, this.tmp);
    this.tmp2.copy(p.normal).transformDirection(this.mount.matrixWorld);
    this.tmp.addScaledVector(this.tmp2, 0.3);
    const plane = new Plane().setFromNormalAndCoplanarPoint(
      this.director.camera.getWorldDirection(new Vector3()).negate(),
      this.tmp,
    );
    const hitP = this.planeRay.ray.intersectPlane(plane, out);
    return hitP ?? out.copy(this.tmp);
  }

  private stagePaper(dt: number): void {
    const remaining = this.paper.remaining();

    // --- settle animation for a sheet that has just been let go
    for (const p of this.paper.panels) {
      if (p.state === 'settling') {
        p.attachTime += dt;
        const t = clamp(p.attachTime / 0.55, 0, 1);
        p.attach = easeOutCubic(t);
        p.handOffset.multiplyScalar(1 - clamp(dt * 9, 0, 1));
        // the paste spreads outward from where the sheet first touched
        this.atlas.add(StampKind.Fill, {
          tile: p.spec.tile,
          a: 0.5,
          b: 0.5,
          radius: 0.1 + t * 0.72,
          aspect: 1,
          angle: 0,
          strength: 0.55 + t * 0.35,
          extra: 0,
          seed: 0,
        });
        if (t >= 1) {
          p.state = 'attached';
          p.attach = 1;
          p.handOffset.set(0, 0, 0);
          this.pendingSmooth = p;
          this.ui.setHint('👆', 'ゆびで まんなかから そとへ');
        }
      }
    }

    // --- smoothing the wrinkles out of whatever is already up
    let smoothing = false;
    if (this.input.down && !this.held) {
      smoothing = this.applySmoothing();
    }
    if (this.pendingSmooth) {
      const cov = this.atlas.coverageOf(this.pendingSmooth.spec.id, 0);
      this.pendingSmooth.smoothed = cov;
      if (cov > 0.28 || (this.pendingSmooth.state === 'attached' && this.pendingSmooth.dry > 0.14)) {
        if (this.stage === 'firstPaper' && !this.firstPaperDone) {
          this.firstPaperDone = true;
          this.audio.chime();
          this.ui.setHint('✨', 'ほねぐみに かみを はると かたちが できた！');
          this.ui.showBig(true, 'つぎへ');
        }
        this.pendingSmooth = null;
      }
    }

    // --- picking up and carrying the next sheet
    if (!this.pendingSmooth && remaining.length > 0) {
      if (this.input.justPressed && !this.held && !smoothing) {
        const near = this.nearestCandidate();
        if (near) {
          this.heldDistance = near.dist;
          this.held = near.panel;
          this.held.state = 'held';
          this.held.mesh.visible = true;
          this.held.attach = 0;
          this.held.attachTime = 0;
          this.audio.paperPick();
        }
      }
      if (this.held && this.input.down) {
        const near = this.nearestCandidate();
        // hysteresis: only hand the sheet to a different spot when clearly closer
        if (near && near.panel !== this.held && near.dist < this.heldDistance * 0.72) {
          this.held.mesh.visible = false;
          this.held.state = 'stack';
          this.held.attach = 0;
          this.held = near.panel;
          this.held.state = 'held';
          this.held.mesh.visible = true;
        }
        this.heldDistance = near ? near.dist : Infinity;
        const target = this.handPointFor(this.held, this.tmp);
        this.panelWorldCentre(this.held, this.tmp2);
        this.tmp2.addScaledVector(
          new Vector3().copy(this.held.normal).transformDirection(this.mount.matrixWorld),
          0.3,
        );
        const local = target.sub(this.tmp2);
        local.clampLength(0, 1.4);
        this.held.handOffset.lerp(local, clamp(dt * 16, 0, 1));
        // the edges start catching on the frame as the sheet comes close
        const catching = this.heldDistance < 210 ? 0.3 : 0;
        this.held.attach = damp(this.held.attach, catching, 7, dt);
        this.audio.setBrush(clamp(this.input.speed / 900, 0, 1) * 0.35, 'finger');
      }
      if (this.held && this.input.justReleased) {
        // re-check at the moment of release: a quick flick can put press and release in the
        // same frame, and the sheet should still find the spot the child let go over
        const near = this.nearestCandidate();
        if (near && near.dist < this.heldDistance) {
          if (near.panel !== this.held) {
            this.held.mesh.visible = false;
            this.held.state = 'stack';
            this.held.attach = 0;
            this.held.handOffset.set(0, 0, 0);
            this.held = near.panel;
            this.held.mesh.visible = true;
          }
          this.heldDistance = near.dist;
        }
        if (this.heldDistance < 320) {
          this.held.state = 'settling';
          this.held.attachTime = 0;
          this.audio.paperLay();
          this.atlas.fillTile(this.held.spec.tile, 0.5);
        } else {
          // no failure state: the sheet simply goes back to the pile
          this.held.mesh.visible = false;
          this.held.state = 'stack';
          this.held.attach = 0;
          this.held.handOffset.set(0, 0, 0);
          this.audio.paperPick();
          this.ui.setHint('📄', 'ほねぐみの ちかくで はなしてね');
        }
        this.held = null;
      }
    }

    if (!this.input.down) this.audio.setBrush(0, 'finger');

    // --- chapter completion. There is no quota: once a few sheets are up the child may move
    // on whenever they like, and the teacher pastes anything they left.
    if (this.stage !== 'firstPaper') {
      const left = this.paper.remaining().length;
      const pasted = CHILD_PATCHES.length - left;
      if (left === 0 && !this.pendingSmooth) {
        this.ui.setHint('✨', this.paperOnly ? 'かみを ぜんぶ はれた！' : 'ぜんぶ はれた！');
        this.ui.showBig(true, this.paperOnly ? 'あかりを つける' : 'すみで かこう');
      } else if (pasted >= 3 && !this.pendingSmooth) {
        this.ui.showBig(true, this.paperOnly ? 'あかりを つける' : 'すみで かこう');
      }
    }
  }

  /** Returns true if the finger is on paper and smoothing it. */
  private applySmoothing(): boolean {
    const meshes = this.paper.attachedMeshes();
    const ndc = this.paintNdc();
    const hit = raycastPanels(this.director.camera, ndc.x, ndc.y, meshes);
    if (!hit) {
      this.lastPaintTile = null;
      this.audio.setBrush(0, 'finger');
      return false;
    }
    const panel = this.paper.get(hit.patchId);
    const speed = clamp(this.input.speed / 900, 0, 1);
    const wet = panel ? 1 - panel.dry : 1;
    this.strokeStamp(StampKind.Smooth, hit, {
      radius: 0.075 * (1 + speed * 0.45),
      aspect: 1 + speed * 1.3,
      strength: 0.55 + 0.45 * (1 - speed),
      extra: speed,
      channel: 0,
    });
    this.audio.setBrush(0.35 + speed * 0.65, wet > 0.6 ? 'glue' : 'finger');
    return true;
  }

  /**
   * Lays a run of dabs between the previous point and this one. Everything the child draws
   * goes through here, so no stroke can ever spawn new meshes or new draw calls.
   */
  private strokeStamp(
    kind: number,
    hit: SurfaceHit,
    opts: {
      radius: number;
      aspect: number;
      strength: number;
      extra: number;
      channel: number;
      color?: Color;
      maxSteps?: number;
    },
  ): void {
    const last = this.lastPaintTile && this.lastPaintTile.patch === hit.patchId ? this.lastPaintTile : null;
    const spacing = opts.radius * 0.42;
    let steps = 1;
    let angle = 0;
    if (last) {
      const dx = hit.a - last.a;
      const dy = hit.b - last.b;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.0001) angle = Math.atan2(dy, dx);
      steps = clamp(Math.ceil(dist / spacing), 1, opts.maxSteps ?? 26);
    }
    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 1 : (i + 1) / steps;
      const a = last ? lerp(last.a, hit.a, t) : hit.a;
      const b = last ? lerp(last.b, hit.b, t) : hit.b;
      this.atlas.add(kind, {
        tile: hit.tile,
        a,
        b,
        radius: opts.radius,
        aspect: opts.aspect,
        angle,
        strength: opts.strength,
        extra: opts.extra,
        seed: this.rng(),
        color: opts.color,
      });
      this.atlas.mark(hit.patchId, a, b, opts.channel);
    }
    this.lastPaintTile = { a: hit.a, b: hit.b, patch: hit.patchId };
  }

  /* ---------------------------------------------------------------- sumi */

  private stageInk(dt: number): void {
    let painting = false;
    if (this.input.down) {
      const ndc = this.paintNdc();
      const hit = raycastPanels(this.director.camera, ndc.x, ndc.y, this.paper.attachedMeshes());
      if (hit) {
        const snapped = snapToGuide(this.guides, hit.patchId, hit.a, hit.b, 0.11);
        const speed = clamp(this.input.speed / 850, 0, 1);
        // fast strokes go thin and break up, slow ones fatten and pool
        this.strokeStamp(
          StampKind.Ink,
          { ...hit, a: snapped.a, b: snapped.b },
          {
            radius: 0.03 * (1.3 - 0.62 * speed),
            aspect: 1 + speed * 1.2,
            strength: 0.92,
            extra: speed,
            channel: 1,
          },
        );
        this.audio.setBrush(0.3 + speed * 0.7, 'ink');
        this.lastInkFocus = hit.point;
        this.lastInkPanel = hit.patchId;
        painting = true;
      }
    }
    if (!painting) {
      this.lastPaintTile = null;
      this.audio.setBrush(0, 'ink');
    }

    this.inkZoom = damp(this.inkZoom, painting ? 1 : 0, painting ? 3 : 0.8, dt);
    // no quota: once a line has been drawn the child may move on, or keep going as long as
    // they like. The button also turns up on its own if nothing much is happening.
    const progress = guideProgress(this.guides);
    if (progress > 0.012 || this.stageTime > 26) this.ui.showBig(true, 'ろうがき へ');
    if (progress > 0.01 && this.stageTime > 8) this.ui.setHint('🖌️', 'ゆっくり なぞると ふとく なるよ');
  }

  /* ---------------------------------------------------------------- wax resist */

  private stageWax(dt: number): void {
    const total = 6.4;
    this.waxT += dt;
    const t = clamp(this.waxT / total, 0, 1);
    const target = Math.floor(easeInOutCubic(t) * WAX.length);

    while (this.waxIndex < target && this.waxIndex < WAX.length) {
      const stroke = WAX[this.waxIndex++];
      const spec = PATCHES.find((p) => p.id === stroke.patch);
      if (!spec) continue;
      for (let i = 0; i < stroke.pts.length; i++) {
        const [ga, gb] = stroke.pts[i];
        this.atlas.add(StampKind.Wax, {
          tile: spec.tile,
          a: localToTile(ga),
          b: localToTile(gb),
          radius: 0.0082 * stroke.width + 0.0028,
          aspect: 1,
          angle: 0,
          strength: 0.9,
          extra: 0,
          seed: 0,
        });
      }
      // the teacher's hand rides the stroke being drawn
      const [ha, hb] = stroke.pts[Math.floor(stroke.pts.length / 2)];
      spec.point(clamp(ha, 0, 1), clamp(hb, 0, 1), this.waxTarget);
      this.waxTarget.applyMatrix4(this.mount.matrixWorld);
    }
    this.teacherHand.position.lerp(this.waxTarget, clamp(dt * 4.5, 0, 1));
    this.teacherHand.lookAt(this.director.camera.position);

    if (t >= 1) {
      this.teacherHand.visible = false;
      this.setStage('dye');
    }
  }

  /* ---------------------------------------------------------------- dye */

  private stageDye(dt: number): void {
    let painting = false;
    if (this.input.down) {
      const ndc = this.paintNdc();
      const hit = raycastPanels(this.director.camera, ndc.x, ndc.y, this.paper.attachedMeshes());
      if (hit) {
        const dye = DYES[this.dyeIndex];
        const speed = clamp(this.input.speed / 900, 0, 1);
        const col = new Color(dye.hex);
        this.strokeStamp(StampKind.Dye, hit, {
          radius: 0.085 * (1.1 - speed * 0.22),
          aspect: 1.25 + speed * 0.6,
          strength: 0.2 * dye.density,
          extra: 0,
          channel: 2,
          color: col,
        });
        this.atlas.requestDiffusion(2);
        this.audio.setBrush(0.3 + speed * 0.7, 'dye');
        this.lastInkFocus = hit.point;
        this.lastInkPanel = hit.patchId;
        painting = true;
      }
    }
    if (!painting) {
      this.lastPaintTile = null;
      this.audio.setBrush(0, 'dye');
    }

    this.inkZoom = damp(this.inkZoom, painting ? 1 : 0, painting ? 3 : 0.8, dt);
    const cov = this.atlas.totalCoverage(
      2,
      CHILD_PATCHES.map((p) => p.id),
    );
    if (cov > 0.015 || this.stageTime > 26) this.ui.showBig(true, 'かわかす');
    if (cov > 0.01 && this.stageTime > 10) this.ui.setHint('🎨', 'かさねると こく なるよ');
  }

  /* ---------------------------------------------------------------- drying and the cart */

  private cartDock = new Vector3();

  private stageDry(dt: number): void {
    // paper tightens and the paste sheen dies away
    for (const p of this.paper.panels) p.dry = clamp(p.dry + dt * 0.42, 0, 1);
    this.cartDock.copy(TRESTLE).add(new Vector3(0, 0, -0.98));

    const t = this.stageTime;
    if (t > 1.0) {
      const k = clamp((t - 1.0) / 1.6, 0, 1);
      this.cart.group.position.lerpVectors(WORKSHOP_CART, this.cartDock, easeInOutCubic(k));
      this.cart.group.rotation.y = lerp(-0.42, 0, easeInOutCubic(k));
      this.cart.speed = k > 0 && k < 1 ? 0.5 : 0;
      this.audio.setCart(k > 0 && k < 1 ? 0.4 : 0, 0);
      if (k >= 1) this.ui.setHint('🧑‍🏫', 'せんせいと いっしょに のせよう');
    }
    if (t > 2.9) {
      const k = clamp((t - 2.9) / 1.9, 0, 1);
      const arc = Math.sin(Math.PI * k) * 0.24;
      this.carrier.position.lerpVectors(TRESTLE, this.cartDock, easeInOutCubic(k));
      this.carrier.position.y = arc;
      if (k >= 1 && this.mount.parent !== this.cart.deckPivot) {
        this.cart.deckPivot.add(this.mount);
        this.mount.position.set(0, 0, 0);
        this.mount.rotation.set(0, 0, 0);
        this.carrier.position.copy(TRESTLE);
        this.carrier.position.y = 0;
        this.audio.paperLay();
      }
    }
    if (t > 5.4) this.setStage('toYard');
  }

  /* ---------------------------------------------------------------- out to the yard */

  private fadeAmt = 0;

  private stageToYard(dt: number): void {
    void dt;
    const t = this.stageTime;
    this.fadeAmt = t < 1.1 ? smoothstep(0, 0.9, t) : 1 - smoothstep(1.15, 2.0, t);

    if (t > 1.1 && this.scenery.yard.visible === false) {
      this.scenery.setPlace('yard');
      this.lamps.armShadow();
      this.cart.group.position.set(0, 0, 1.2);
      this.cart.group.rotation.y = -0.35;
      this.carrier.position.set(0, 0, 0);
      this.director.request(this.yardEstablishShot());
      this.director.snap();
    }
    if (t > 1.1) {
      const k = clamp((t - 1.2) / 4.2, 0, 1);
      this.env.setPhase(lerp(1.0, 2.5, easeInOutCubic(k)));
      this.scenery.setEvening(easeInOutCubic(k));
      if (k > 0.35) this.ui.setHint('🌆', 'そとが くらく なってきた');
    }
    if (t > 6.2) {
      this.lamps.switchGroup.visible = true;
      this.setStage('lightUp');
    }
  }

  /* ---------------------------------------------------------------- the switch */

  private lightHold = 0;

  private stageLightUp(dt: number): void {
    // the yard keeps a little of the sunset until the lamps take over
    this.env.setPhase(damp(this.env.currentPhase, this.lamps.on ? 2.95 : 2.5, 1.4, dt));
    this.scenery.setEvening(1);
    this.lamps.switchGroup.visible = true;

    const sw = this.lamps.switchGroup.getWorldPosition(this.tmp);
    const s = this.screenOf(sw);
    if (this.input.tapped && Math.hypot(s.x - this.input.css.x, s.y - this.input.css.y) < this.switchReach()) {
      const on = this.lamps.toggle();
      this.audio.click(on);
      this.lightHold = 0;
      if (on) {
        // the moment itself: no bubbles, no confetti, no buttons
        this.ui.clearAll();
      } else {
        // pressed again: back to the dark, and the child can light it a second time
        this.ui.restore();
        this.ui.setHint('💡', 'もういちど おそう');
      }
    }

    if (this.lamps.on) {
      this.lightHold += dt;
      if (this.lightHold > 3.2) {
        this.ui.restore();
        this.setStage('parade');
      }
    }
  }

  /* ---------------------------------------------------------------- parade */

  /**
   * How much of the nebuta's length may run off the sides. A phone held upright has barely
   * 24 degrees of horizontal view, so a 2 m long fish either gets cropped or ends up tiny;
   * a tablet has room to spare and needs almost no crop at all.
   */
  private crop(min: number): number {
    const a = this.viewport.aspect;
    return clamp(min + ((a - 0.462) * (1 - min)) / 0.35, min, 1);
  }

  /** A generous ring around the switch: small fingers do not land where they aim. */
  private switchReach(): number {
    return Math.max(96, Math.min(this.viewport.width, this.viewport.height) * 0.16);
  }

  private stageParade(dt: number): void {
    this.rope.mesh.visible = true;
    this.lamps.switchGroup.visible = true;
    if (!this.audio.ready) void this.audio.unlock();
    this.audio.startMusic();

    const anchor = this.cart.worldRopeAnchor(this.tmp2);
    // the child's hand: the finger projected onto a waist-height plane in the yard
    if (this.input.down) {
      const ndc = this.paintNdc();
      this.planeRay.setFromCamera(ndc, this.director.camera);
      const p = this.planeRay.ray.intersectPlane(this.groundPlane, this.tmp);
      if (p) {
        this.handWorld.lerp(p, clamp(dt * 18, 0, 1));
        const away = this.handWorld.clone().sub(anchor);
        if (away.length() > 2.6) {
          away.setLength(2.6);
          this.handWorld.copy(anchor).add(away);
        }
      }
      this.paradeIdle = 0;
    } else {
      this.paradeIdle += dt;
      // the rope goes slack in front of the cart when nobody is holding it, so letting go
      // lets the nebuta coast to a stop instead of creeping away on its own
      const rest = anchor.clone().addScaledVector(this.forward(this.tmp), 0.66);
      rest.y = 0.55;
      this.handWorld.lerp(rest, clamp(dt * 2.2, 0, 1));
    }

    // --- rope tension drives the rig
    const pull = this.handWorld.clone().sub(anchor);
    pull.y = 0;
    const dist = pull.length();
    const tension = clamp((dist - 0.75) / 1.4, 0, 1);
    const dir = dist > 0.001 ? pull.clone().divideScalar(dist) : new Vector3(1, 0, 0);
    const fwd = this.forward(this.tmp);
    const along = dir.dot(fwd);
    const lateral = dir.x * fwd.z - dir.z * fwd.x;

    const targetSpeed = tension * clamp(along, -0.35, 1) * 1.5;
    this.cart.speed = damp(this.cart.speed, targetSpeed, 2.6, dt);
    const turn = -lateral * tension * 2.3;
    this.cart.yawRate = damp(this.cart.yawRate, turn, 4.2, dt);
    this.cart.lean = damp(this.cart.lean, clamp(this.cart.yawRate * 0.4, -0.5, 0.5), 4, dt);

    // quick left-right flick: a proper spin on the spot
    this.reversalTimer = Math.max(0, this.reversalTimer - dt);
    if (this.input.down) {
      const rec = this.input.recentDelta(0.16);
      const lat = rec.x;
      if (Math.abs(lat) > 26 && Math.sign(lat) !== Math.sign(this.lastLateral) && Math.abs(this.lastLateral) > 26) {
        if (this.reversalTimer <= 0) {
          this.cart.yawRate += Math.sign(lat) * -2.4;
          this.reversalTimer = 0.45;
          this.audio.kane(0.7);
        }
      }
      if (Math.abs(lat) > 12) this.lastLateral = lat;
      // pulled forward then eased back: the whole nebuta rocks
      const back = rec.y;
      if (back > 30 && this.cart.speed > 0.35) this.cart.nudge(-0.9);
    }

    this.cart.group.rotation.y += this.cart.yawRate * dt;
    this.cart.group.position.addScaledVector(this.forward(this.tmp), this.cart.speed * dt);

    // the teacher keeps the cart inside the yard; it is guided, never blocked
    const r = Math.hypot(this.cart.group.position.x, this.cart.group.position.z);
    if (r > 8.4) {
      const inward = Math.atan2(-this.cart.group.position.x, -this.cart.group.position.z);
      let d = inward - this.cart.group.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const k = clamp((r - 8.4) / 1.6, 0, 1);
      this.cart.group.rotation.y += d * k * dt * 1.6;
      this.cart.speed *= 1 - k * 0.7 * dt * 6;
    }

    this.rope.update(anchor, this.handWorld, tension);
    this.audio.setCart(clamp(Math.abs(this.cart.speed) / 1.5, 0, 1), clamp(this.cart.yawRate / 2.4, -1, 1));
    this.audio.setEnergy(this.paradeEnergy());

    // the switch stays live, so the lamps can be turned off and on again
    const sw = this.lamps.switchGroup.getWorldPosition(this.tmp);
    const s = this.screenOf(sw);
    if (this.input.tapped && Math.hypot(s.x - this.input.css.x, s.y - this.input.css.y) < this.switchReach()) {
      this.audio.click(this.lamps.toggle());
    }

    if (this.stageTime > 8 && this.paradeIdle > 4) {
      this.ui.setHint('🪢', 'ロープを ひいたり もどしたり してみて');
    }
  }

  private forward(out: Vector3): Vector3 {
    const y = this.cart.group.rotation.y;
    return out.set(Math.cos(y), 0, -Math.sin(y));
  }

  /* ---------------------------------------------------------------- finale */

  private stageFinale(dt: number): void {
    this.finaleT += dt;
    const t = this.finaleT;
    this.rope.mesh.visible = false;
    this.cart.speed = damp(this.cart.speed, 0, 3, dt);
    this.cart.yawRate = damp(this.cart.yawRate, 0, 3, dt);
    this.audio.setCart(clamp(Math.abs(this.cart.speed), 0, 1), 0);

    // first the daylight version of what they made, then the lit one, then the menu
    if (t < 3.4) {
      this.audio.setEnergy(0.3);
    } else if (t < 3.9) {
      this.scenery.setPlace('workshop');
      this.env.setPhase(0.15);
      this.lamps.setTarget(0);
      this.cart.group.position.copy(WORKSHOP_CART);
      this.cart.group.rotation.y = -0.42;
      this.ui.setHint('☀️', 'あかるい ところの すがた');
    } else if (t < 7.2) {
      this.env.setPhase(damp(this.env.currentPhase, 0.15, 2, dt));
    } else if (t < 7.7) {
      this.scenery.setPlace('yard');
      this.scenery.setEvening(1);
      this.env.setPhase(2.95);
      this.lamps.setTarget(1);
      this.cart.group.position.set(0.4, 0, 1.4);
      this.cart.group.rotation.y = -0.5;
      this.ui.setHint('🌙', 'くらい ところで ひかる すがた');
    } else if (t < 11.4) {
      this.env.setPhase(2.95);
    } else if (t < 11.6) {
      this.audio.stopMusic();
      this.ui.hideHint();
      this.ui.showMenu(true);
    }
  }

  /* ---------------------------------------------------------------- camera */

  private boundsCentre = new Vector3(0, 0.72, 0);
  private boundsRadius = 1.3;
  private readonly localCorners: Vector3[] = [];
  private readonly worldCorners: Vector3[] = Array.from({ length: 8 }, () => new Vector3());

  private computeBounds(): void {
    const box = new Box3();
    const v = new Vector3();
    for (const spec of PATCHES) {
      for (let i = 0; i <= 4; i++) {
        for (let j = 0; j <= 4; j++) {
          spec.point(i / 4, j / 4, v);
          box.expandByPoint(v);
        }
      }
    }
    box.getCenter(this.boundsCentre);
    this.boundsRadius = box.getSize(v).length() * 0.5;
    this.localCorners.length = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) this.localCorners.push(new Vector3(x, y, z));
  }

  /** The nebuta's eight corners in world space, so shots frame the real silhouette. */
  private nebutaPoints(): Vector3[] {
    for (let i = 0; i < 8; i++) {
      this.worldCorners[i].copy(this.localCorners[i]).applyMatrix4(this.mount.matrixWorld);
    }
    return this.worldCorners;
  }

  private readonly panelCorners: Vector3[] = Array.from({ length: 8 }, () => new Vector3());

  /** Corners of a single panel, for the close paper / ink / dye shots. */
  private panelPoints(p: PanelRuntime): Vector3[] {
    const box = p.mesh.geometry.boundingBox;
    if (!box) return this.nebutaPoints();
    let i = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z])
          this.panelCorners[i++].set(x, y, z).applyMatrix4(this.mount.matrixWorld);
    return this.panelCorners;
  }

  private nebutaWorldCentre(out = new Vector3()): Vector3 {
    return out.copy(this.boundsCentre).applyMatrix4(this.mount.matrixWorld);
  }

  private yardEstablishShot() {
    const look = this.nebutaWorldCentre(new Vector3());
    return {
      look,
      radius: this.boundsRadius * 1.5,
      points: this.nebutaPoints(),
      padding: 1.18,
      horizontalFit: this.crop(0.85),
      yaw: 0.5,
      pitch: 0.18,
      dir: new Vector3(0.82, 0.2, 0.54),
      lambda: 2.2,
    };
  }

  private applyStageCamera(snap: boolean): void {
    const centre = this.nebutaWorldCentre(new Vector3());
    const up = new Vector3(0, 1, 0);
    const focus = this.held ?? this.pendingSmooth ?? null;

    switch (this.stage) {
      case 'intro': {
        // a slow three-quarter drift: enough depth to read it as a solid, not enough to name it
        const a = 0.45 + Math.sin(this.time * 0.16) * 0.16;
        // opens on the whole craft room — paper, paste, brushes, dyes, cart — then eases in
        const push = lerp(1.95, 1.12, easeInOutCubic(clamp(this.stageTime / 3.2, 0, 1)));
        this.director.request({
          look: centre,
          radius: this.boundsRadius,
          points: this.nebutaPoints(),
          padding: push,
          horizontalFit: this.crop(0.9),
          yaw: a,
          pitch: 0.2,
          dir: new Vector3(Math.cos(a), 0.24, Math.sin(a) * 1.1),
          lambda: 1.6,
        });
        break;
      }
      case 'firstPaper':
      case 'freePaper': {
        if (focus) {
          // paper, fingertip, frame curvature and the change all in one frame
          const n = new Vector3().copy(focus.normal).transformDirection(this.mount.matrixWorld);
          const dir = n.clone().addScaledVector(up, 0.42).normalize();
          this.director.request({
            look: this.panelWorldCentre(focus, new Vector3()),
            radius: Math.max(0.42, focus.radius * 1.85),
            points: this.panelPoints(focus),
            padding: 1.5,
            yaw: 0,
            pitch: 0,
            dir,
            lambda: 2.4,
            headroom: 1.2,
          });
        } else {
          // the nebuta turns its unfinished side toward the child, so every sheet is reachable
          const open = this.unpapered(new Vector3());
          const base = new Vector3(0.9, 0.3, 0.5).normalize();
          const dir = open.lengthSq() > 0.09 ? open.normalize().addScaledVector(up, 0.34) : base;
          this.director.request({
            look: centre,
            radius: this.boundsRadius,
            points: this.nebutaPoints(),
            padding: 1.1,
            horizontalFit: this.crop(0.82),
            yaw: 0.42,
            pitch: 0.22,
            dir: dir.normalize(),
            lambda: 1.15,
          });
        }
        break;
      }
      case 'ink':
      case 'dye': {
        const panel = this.paper.get(this.lastInkPanel) ?? this.paper.panels[2];
        const n = new Vector3().copy(panel.normal).transformDirection(this.mount.matrixWorld);
        // above and to the side of the surface, so the brush tip is never under the finger
        const dir = n
          .clone()
          .addScaledVector(up, this.stage === 'ink' ? 0.62 : 0.42)
          .normalize()
          .lerp(new Vector3(0.86, 0.34, 0.42).normalize(), 1 - this.inkZoom)
          .normalize();
        const close = this.inkZoom > 0.5;
        this.director.request({
          look: (this.lastInkFocus ?? centre).clone().lerp(centre, 1 - this.inkZoom),
          radius: Math.max(0.35, panel.radius * 1.6),
          points: close ? this.panelPoints(panel) : this.nebutaPoints(),
          padding: close ? (this.stage === 'dye' ? 1.62 : 1.92) : 1.12,
          horizontalFit: close ? 1 : this.crop(0.86),
          yaw: 0,
          pitch: 0,
          dir,
          lambda: 1.7,
          headroom: close ? 1.1 : 0.8,
        });
        break;
      }
      case 'wax': {
        const target = this.teacherHand.visible ? this.teacherHand.position : centre;
        this.director.request({
          look: target,
          radius: this.boundsRadius * (0.34 + 0.62 * clamp(this.waxT / 6.4, 0, 1)),
          yaw: 0.4,
          pitch: 0.3,
          dir: new Vector3(0.85, 0.36, 0.4),
          lambda: 1.8,
        });
        break;
      }
      case 'dry': {
        this.director.request({
          look: centre.clone().add(new Vector3(0, -0.1, 0)),
          radius: this.boundsRadius * 1.75,
          points: this.nebutaPoints(),
          padding: 1.16,
          horizontalFit: this.crop(0.8),
          yaw: 0.5,
          pitch: 0.24,
          dir: new Vector3(0.8, 0.34, 0.5),
          lambda: 1.5,
        });
        break;
      }
      case 'toYard': {
        this.director.request(this.yardEstablishShot());
        break;
      }
      case 'lightUp': {
        // down at a four year old's eye height, three-quarters from the front-left, which is
        // the side the switch is mounted on, so the nebuta looms and the switch is in reach
        const f = this.forward(new Vector3());
        const l = new Vector3(f.z, 0, -f.x);
        const dir = f.clone().multiplyScalar(0.82).addScaledVector(l, 0.46).addScaledVector(up, 0.13);
        // before the switch is pressed the frame leans toward it, so a child can see what
        // to touch; once the lamps are on the shot is purely the nebuta
        const look = centre.clone();
        if (!this.lamps.on) {
          look.lerp(this.lamps.switchGroup.getWorldPosition(new Vector3()), 0.26);
        }
        this.director.request({
          look,
          radius: this.boundsRadius,
          points: this.nebutaPoints(),
          anchorPoints: this.lamps.on ? undefined : [this.lamps.switchGroup.getWorldPosition(new Vector3())],
          padding: this.lamps.on ? 1.0 : 1.14,
          horizontalFit: this.crop(this.lamps.on ? 0.5 : 0.66),
          yaw: 0,
          pitch: 0,
          dir,
          lambda: this.lamps.on ? 0.55 : 1.8,
          headroom: 0.55,
          rollNoise: 0.35,
        });
        break;
      }
      case 'parade': {
        this.director.request(this.paradeShot(centre));
        break;
      }
      case 'finale': {
        const a = 0.5 + Math.sin(this.finaleT * 0.22) * 0.22;
        this.director.request({
          look: centre,
          radius: this.boundsRadius * 1.34,
          points: this.nebutaPoints(),
          padding: 1.12,
          horizontalFit: this.crop(0.82),
          yaw: a,
          pitch: 0.2,
          dir: new Vector3(Math.cos(a), 0.26, Math.sin(a)),
          lambda: 1.3,
        });
        break;
      }
    }
    if (snap) this.director.snap();
  }

  private lastInkFocus: Vector3 | null = null;
  private lastInkPanel = 'belly-r';
  private inkZoom = 0;

  private paradeShot(centre: Vector3) {
    const y = this.cart.group.rotation.y;
    const f = new Vector3(Math.cos(y), 0, -Math.sin(y));
    const l = new Vector3(f.z, 0, -f.x);
    const spinning = Math.abs(this.cart.yawRate) > 0.75;
    const stopped = Math.abs(this.cart.speed) < 0.18 && this.paradeIdle > 1.6;

    let want = 0;
    if (spinning) want = 2;
    else if (stopped) want = 1;
    this.shotTimer += 1 / 60;
    if (want !== this.shotIndex && this.shotTimer > 3.2) {
      this.shotIndex = want;
      this.shotTimer = 0;
    }

    const portrait = this.viewport.portrait;
    if (this.shotIndex === 1) {
      // swings round to the front while the child stands still and looks
      const dir = f.clone().addScaledVector(new Vector3(0, 1, 0), portrait ? 0.12 : 0.18);
      return {
        look: centre,
        radius: this.boundsRadius,
        points: this.nebutaPoints(),
        padding: portrait ? 1.0 : 1.26,
        horizontalFit: this.crop(0.62),
        yaw: 0,
        pitch: 0,
        dir,
        lambda: 1.5,
        headroom: 0.7,
      };
    }
    if (this.shotIndex === 2) {
      // a little above, so a spin reads as the light sweeping the yard
      const dir = l
        .clone()
        .multiplyScalar(0.72)
        .addScaledVector(f, 0.34)
        .addScaledVector(new Vector3(0, 1, 0), 0.72);
      return {
        look: centre,
        radius: this.boundsRadius,
        points: this.nebutaPoints(),
        padding: portrait ? 1.06 : 1.36,
        horizontalFit: this.crop(0.66),
        yaw: 0,
        pitch: 0,
        dir,
        lambda: 1.4,
      };
    }
    // travelling alongside, at the nebuta's own height — low in portrait so it towers
    const dir = l.clone().addScaledVector(new Vector3(0, 1, 0), portrait ? 0.06 : 0.1);
    dir.addScaledVector(f, -0.22);
    return {
      look: centre,
      radius: this.boundsRadius,
      points: this.nebutaPoints(),
      padding: portrait ? 1.0 : 1.3,
      // portrait crops the tail so the nebuta stands tall in the frame
      horizontalFit: this.crop(0.56),
      yaw: 0,
      pitch: 0,
      dir,
      lambda: 1.9,
      headroom: portrait ? 1.7 : 0.8,
    };
  }

  /* ---------------------------------------------------------------- replay */

  private replayParade(): void {
    this.scenery.setPlace('yard');
    this.scenery.setEvening(1);
    this.env.setPhase(2.95, true);
    this.cart.reset();
    this.cart.group.position.set(0, 0, 1.4);
    this.cart.group.rotation.y = -0.35;
    this.lamps.reset();
    this.lamps.switchGroup.visible = true;
    this.handWorld.set(1.8, 0.55, 1.4);
    this.setStage('lightUp');
    this.applyStageCamera(true);
  }

  private replayRemake(): void {
    this.atlas.clear();
    this.paper.reset();
    resetGuides(this.guides);
    this.paper.setGuideFade(0);
    for (const p of PATCHES) if (p.preAttached) this.atlas.fillTile(p.tile, 1);
    this.held = null;
    this.pendingSmooth = null;
    this.firstPaperDone = false;
    this.paperOnly = false;
    this.dyeIndex = (this.dyeIndex + 2) % DYES.length;
    this.ui.selectDye(this.dyeIndex);
    this.rope.mesh.visible = false;
    this.lamps.reset();
    this.lamps.switchGroup.visible = false;
    this.audio.stopMusic();
    this.returnToWorkshop();
    this.setStage('firstPaper');
    this.applyStageCamera(true);
  }

  private replayPaperOnly(): void {
    this.atlas.clear();
    this.paper.reset();
    resetGuides(this.guides);
    for (const p of PATCHES) if (p.preAttached) this.atlas.fillTile(p.tile, 1);
    this.held = null;
    this.pendingSmooth = null;
    this.firstPaperDone = true;
    this.paperOnly = true;
    this.rope.mesh.visible = false;
    this.lamps.reset();
    this.lamps.switchGroup.visible = false;
    this.audio.stopMusic();
    this.returnToWorkshop();
    this.setStage('freePaper');
    this.applyStageCamera(true);
  }

  private returnToWorkshop(): void {
    this.scenery.setPlace('workshop');
    this.scenery.setEvening(0);
    this.env.setPhase(0, true);
    this.carrier.add(this.mount);
    this.mount.position.set(0, 0, 0);
    this.mount.rotation.set(0, 0, 0);
    this.carrier.position.copy(TRESTLE);
    this.cart.reset();
    this.cart.group.position.copy(WORKSHOP_CART);
    this.cart.group.rotation.y = -0.42;
  }

  /** Skips ahead to the yard, used by the paper-only sandbox. */
  private moveToYard(lampsOff: boolean): void {
    this.scenery.setPlace('yard');
    this.lamps.armShadow();
    this.scenery.setEvening(1);
    this.env.setPhase(2.95, true);
    this.cart.deckPivot.add(this.mount);
    this.mount.position.set(0, 0, 0);
    this.cart.reset();
    this.cart.group.position.set(0, 0, 1.4);
    this.cart.group.rotation.y = -0.35;
    for (const p of this.paper.panels) p.dry = 1;
    if (lampsOff) this.lamps.reset();
    this.lamps.switchGroup.visible = true;
    this.applyStageCamera(true);
  }

  /* ---------------------------------------------------------------- teardown */

  get currentStage(): StageName {
    return this.stage;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Test and debug hook: jump straight to a chapter with the craft already at that point. */
  jumpTo(stage: StageName): void {
    const needsPaper = ['ink', 'wax', 'dye', 'dry', 'toYard', 'lightUp', 'parade', 'finale'];
    if (['intro', 'firstPaper', 'freePaper', 'ink', 'wax', 'dye', 'dry'].includes(stage)) {
      this.returnToWorkshop();
    }
    if (needsPaper.includes(stage)) {
      for (const p of this.paper.panels) {
        p.state = 'attached';
        p.attach = 1;
        p.dry = stage === 'ink' || stage === 'wax' ? 0.6 : 1;
        p.smoothed = 1;
        p.mesh.visible = true;
        p.handOffset.set(0, 0, 0);
      }
      for (const p of PATCHES) this.atlas.fillTile(p.tile, 1);
      this.held = null;
      this.pendingSmooth = null;
      this.firstPaperDone = true;
    }
    if (stage === 'lightUp' || stage === 'parade' || stage === 'finale') {
      this.moveToYard(stage !== 'parade');
      if (stage === 'parade') this.lamps.setTarget(1);
    }
    this.setStage(stage);
    this.applyStageCamera(true);
  }

  /** Test hook: a snapshot of everything the end-to-end tests assert on. */
  debugState(): Record<string, unknown> {
    return {
      stage: this.stage,
      tier: this.quality.tier,
      renderScale: Number(this.renderScale.toFixed(3)),
      layout: this.viewport.layout,
      attached: this.paper.panels.filter((p) => p.state === 'attached').map((p) => p.spec.id),
      remaining: this.paper.remaining().length,
      held: this.held?.spec.id ?? null,
      heldDistance: Number.isFinite(this.heldDistance) ? Number(this.heldDistance.toFixed(1)) : -1,
      nearest: (() => {
        const n = this.nearestCandidate();
        return n ? { id: n.panel.spec.id, dist: Number(n.dist.toFixed(1)) } : null;
      })(),
      states: Object.fromEntries(this.paper.panels.map((p) => [p.spec.id, p.state])),
      attachTimes: Object.fromEntries(
        this.paper.panels.filter((p) => p.state === 'settling').map((p) => [p.spec.id, Number(p.attachTime.toFixed(2))]),
      ),
      pointer: { down: this.input.down, x: this.input.css.x, y: this.input.css.y },
      pendingSmooth: this.pendingSmooth?.spec.id ?? null,
      smoothCoverage: Object.fromEntries(
        this.paper.panels.map((p) => [p.spec.id, Number(this.atlas.coverageOf(p.spec.id, 0).toFixed(3))]),
      ),
      inkProgress: Number(guideProgress(this.guides).toFixed(3)),
      dyeCoverage: Number(
        this.atlas.totalCoverage(
          2,
          CHILD_PATCHES.map((p) => p.id),
        ).toFixed(3),
      ),
      lampsOn: this.lamps.on,
      lampMaster: Number(this.lamps.master.toFixed(3)),
      audioReady: this.audio.ready,
      audioMuted: this.audio.isMuted,
      cart: {
        x: Number(this.cart.group.position.x.toFixed(3)),
        z: Number(this.cart.group.position.z.toFixed(3)),
        yaw: Number(this.cart.group.rotation.y.toFixed(3)),
        speed: Number(this.cart.speed.toFixed(3)),
        yawRate: Number(this.cart.yawRate.toFixed(3)),
      },
      fps: Number((1000 / Math.max(1, this.frameTimeAvg)).toFixed(1)),
      frameMs: Number(this.frameTimeAvg.toFixed(1)),
      drawCalls: this.sceneDrawCalls,
      triangles: this.sceneTriangles,
      programs: this.renderer.info.programs?.length ?? 0,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      objects: (() => {
        let n = 0;
        this.scene.traverse(() => n++);
        return n;
      })(),
      paperMeshes: this.paper.panels.length,
    };
  }

  /** Test hook: where a panel's centre lands on screen, and whether it faces the lens. */
  panelScreen(id: string): { x: number; y: number; facing: number } | null {
    const p = this.paper.get(id);
    if (!p) return null;
    const s = this.screenOf(this.panelWorldCentre(p, new Vector3()), new Vector2());
    return { x: s.x, y: s.y, facing: Number(this.panelFacing(p).toFixed(3)) };
  }

  /** Test hook: where a key object lands on screen, in CSS pixels. */
  onScreen(what: 'switch' | 'nebuta' | 'hand'): { x: number; y: number; inside: boolean } {
    const w =
      what === 'switch'
        ? this.lamps.switchGroup.getWorldPosition(new Vector3())
        : what === 'hand'
          ? this.handWorld.clone()
          : this.nebutaWorldCentre(new Vector3());
    const s = this.screenOf(w, new Vector2());
    const margin = 8;
    return {
      x: s.x,
      y: s.y,
      inside:
        s.x > margin &&
        s.x < this.viewport.width - margin &&
        s.y > margin &&
        s.y < this.viewport.height - margin,
    };
  }

  /** Test hook: read the atlases back, so tests can prove a stroke actually landed. */
  sampleAtlas(patchId: string, a: number, b: number) {
    const spec = PATCHES.find((p) => p.id === patchId);
    return this.atlas.sample(spec ? spec.tile : 0, a, b);
  }

  /** Test hook: lay the wax pattern down without waiting for the teacher's sequence. */
  applyAllWax(): void {
    for (const stroke of WAX) {
      const spec = PATCHES.find((p) => p.id === stroke.patch);
      if (!spec) continue;
      for (const [ga, gb] of stroke.pts) {
        this.atlas.add(StampKind.Wax, {
          tile: spec.tile,
          a: localToTile(ga),
          b: localToTile(gb),
          radius: 0.0082 * stroke.width + 0.0028,
          aspect: 1,
          angle: 0,
          strength: 0.95,
          extra: 0,
          seed: 0,
        });
      }
      this.atlas.flush();
    }
    this.waxIndex = WAX.length;
  }

  /** Test hook: flood the whole fish with one dye, the way a four year old actually would. */
  floodDye(index = 0): void {
    const dye = DYES[index % DYES.length];
    const col = new Color(dye.hex);
    for (const spec of PATCHES) {
      for (let i = 0; i <= 7; i++) {
        for (let j = 0; j <= 7; j++) {
          for (let k = 0; k < 6; k++) {
            this.atlas.add(StampKind.Dye, {
              tile: spec.tile,
              a: i / 7,
              b: j / 7,
              radius: 0.12,
              aspect: 1.2,
              angle: 0,
              strength: 0.16 * dye.density,
              extra: 0,
              seed: this.rng(),
              color: col,
            });
          }
          this.atlas.mark(spec.id, i / 7, j / 7, 2);
        }
      }
      this.atlas.flush();
    }
    this.atlas.requestDiffusion(4);
  }

  /** Test hook: trace every planned sumi line at a steady speed. */
  traceAllInk(): void {
    for (const path of this.guides) {
      const spec = PATCHES.find((p) => p.id === path.patchId);
      if (!spec) continue;
      for (let i = 0; i < path.pts.length - 1; i++) {
        const [a0, b0] = path.pts[i];
        const [a1, b1] = path.pts[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(a1 - a0, b1 - b0) / 0.012));
        const angle = Math.atan2(b1 - b0, a1 - a0);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          this.atlas.add(StampKind.Ink, {
            tile: spec.tile,
            a: a0 + (a1 - a0) * t,
            b: b0 + (b1 - b0) * t,
            radius: 0.026,
            aspect: 1.3,
            angle,
            strength: 0.92,
            extra: 0.35,
            seed: this.rng(),
          });
        }
        path.hits[i] = 1;
      }
      this.atlas.flush();
    }
  }

  dispose(): void {
    this.running = false;
    this.input.dispose();
    this.viewport.dispose();
    this.post.dispose();
    this.atlas.dispose();
    this.bake.dispose();
    this.frame.dispose();
    this.paper.dispose();
    this.lamps.dispose();
    this.env.dispose();
    this.scenery.dispose();
    this.rope.dispose();
    this.audio.dispose();
    disposeTextureCache();
    this.renderer.dispose();
  }
}
