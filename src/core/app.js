import * as THREE from 'three';
import { Quality, detectTier } from './quality.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { PostChain } from '../gfx/post.js';
import { createLightRig } from '../scene/lighting.js';
import { Environment } from '../scene/environment.js';
import { buildHand } from '../scene/hand.js';
import { Sparkler } from '../scene/sparkler.js';
import { Fireball } from '../scene/fireball.js';
import { Sparks } from '../scene/sparks.js';
import { Smoke } from '../scene/smoke.js';
import { CameraRig } from '../scene/cameraRig.js';
import { Session, STATE, mulberry32 } from '../sim/session.js';

const FIXED = 1 / 120;

export class App {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !!options.preserveDrawingBuffer,
    });
    this.renderer.debug.checkShaderErrors = !!options.debugShaders;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);

    const gl = this.renderer.getContext();
    this.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

    this.quality = new Quality(options.tier || detectTier(gl));
    this.quality.locked = !!options.tier;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(31, 1, 0.012, 120);
    this.rig = new CameraRig(this.camera);

    this.post = new PostChain(this.renderer);
    this.lightRig = createLightRig();

    this.environment = new Environment(this.quality);
    this.scene.add(this.environment.group);

    const detail = this.quality.settings.emberDetail;
    this.hand = buildHand(this.lightRig, detail);
    this.scene.add(this.hand.group);

    this.sparkler = new Sparkler(this.lightRig);
    this.scene.add(this.sparkler.mesh);

    this.fireball = new Fireball(this.lightRig, detail);
    this.scene.add(this.fireball.group);

    this.sparks = new Sparks();
    this.scene.add(this.sparks.mesh);

    this.smoke = new Smoke(this.lightRig, 24);
    this.scene.add(this.smoke.mesh);

    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    if (options.muted) this.audio.enabled = false;

    this.session = new Session(options.seed ?? ((Math.random() * 1e9) | 0));
    this.rand = mulberry32((options.seed ?? 12345) ^ 0x9e3779b9);

    this.handAnchor = new THREE.Vector3();
    this.cordAnchor = new THREE.Vector3();
    this.beadAnchor = new THREE.Vector3();
    this.cordMid = new THREE.Vector3();
    this.wind = new THREE.Vector3();
    this.carry = new THREE.Vector3();
    this.live = {};
    this.time = 0;
    this.frame = 0;
    this._accum = 0;
    this._running = false;
    this._raf = 0;
    this._lastNow = 0;
    this._veilLifted = false;

    this.session.newSparkler = (character) => this._dressSparkler(character);
    this.session.onFirstSpark = () => this.audio.firstSpark();
    this.session.onDetach = () => this._detach();
    this.sparks.onBirth = (n) => this.session.noteSpark(n);
    this.input.onFirstTouch = () => this.audio.unlock();

    this.quality.onChange = (s) => this._applyQuality(s);
    this._applyQuality(this.quality.settings);

    this._dressSparkler(this.session.character);
    this._resetSparkler(true);

    this._onResize = () => this.resize();
    globalThis.addEventListener('resize', this._onResize);
    globalThis.addEventListener('orientationchange', this._onResize);
    this._onVisibility = () => {
      if (document.hidden) this.audio.suspend();
      else this.audio.resume();
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    this.resize();
  }

  _applyQuality(s) {
    this.sparks.applyQuality(s);
    this.smoke.applyQuality(s);
    this.post.applyQuality(s);
    this.hand.setDetail(s.emberDetail);
    this.sparkler.material.uniforms.uDetail.value = s.emberDetail >= 2 ? 1 : 0;
    // Multisampling on the scene target: the cord is under two pixels wide, so
    // this is the one place where real AA is worth paying for.
    this.post.sceneRT.samples = this.webgl2 ? (s.name === 'high' ? 4 : s.name === 'medium' ? 2 : 0) : 0;
    this.resize();
  }

  _dressSparkler(character) {
    this.sparkler.setDye(character.dyeA, character.dyeB);
    this.sparkler.material.uniforms.uTwist.value = character.twist;
    // The hand is above the top of frame at this moment, which is exactly why
    // the swap happens here: a fresh cord and a fresh bead appear unseen.
    this._resetSparkler(false);
  }

  _resetSparkler(resetCamera = true) {
    this._updateAnchors(0, true);
    this.sparkler.reset(this.cordAnchor, this.session.character.seed);
    for (let i = 0; i < 24; i++) this.sparkler.step(FIXED, this.cordAnchor, 3.0);
    this.sparkler.updateGeometry();
    this.beadAnchor.copy(this.sparkler.tip);
    this.beadAnchor.y -= 0.0012;
    this.fireball.reset(this.beadAnchor);
    this.sparks.reset();
    this.smoke.reset();
    if (resetCamera) this.rig.reset(this.cordAnchor, this.cordAnchor.y - this.fireball.position.y);
  }

  _detach() {
    const extra = new THREE.Vector3(this.input.handVelocity.x * 0.12, -0.01, 0);
    this.fireball.detach(extra);
    this.audio.beadFell();
    // A couple of embers come away with it. Nothing more: this is not an event,
    // it is the end of one.
    this.sparks.burst(this.fireball.position, this.fireball.radius, this.live, this.carry, this.rand, 6, 0.7);
  }

  resize() {
    const w = Math.max(1, globalThis.innerWidth || this.canvas.clientWidth || 1);
    const h = Math.max(1, globalThis.innerHeight || this.canvas.clientHeight || 1);
    const s = this.quality.settings;
    const cap = Math.min(s.pixelRatioCap, this.options.maxPixelRatio ?? Infinity);
    const dpr = Math.min(globalThis.devicePixelRatio || 1, cap) * s.renderScale;

    // The drawing buffer is sized independently of the CSS box, so internal
    // resolution is one of the knobs the quality governor can turn.
    const pw = Math.max(2, Math.round(w * dpr));
    const ph = Math.max(2, Math.round(h * dpr));
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(pw, ph, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.post.setSize(pw, ph);
    this.rig.setViewport(w, h);
    this.input.setViewport(w, h);
    this.environment.layout(this.camera);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastNow = performance.now();
    const loop = (now) => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - this._lastNow) / 1000));
      this._lastNow = now;
      if (document.hidden) return;
      this.step(dt);
    };
    this._raf = requestAnimationFrame(loop);
    // Audio may already be permitted (desktop); if not, the first touch does it.
    this.audio.unlock();
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  /** Advance and draw one frame. Exposed so tests can drive time deterministically. */
  step(dt) {
    this.time += dt;
    this.frame++;
    this.quality.sample(dt);

    this.input.update(dt);
    const base = this.session.update(dt, this.input);
    const live = this._liveParams(base);

    this._updateAnchors(dt, false);

    // Cord physics at a fixed step so the chain is stable at any frame rate.
    this._accum += dt;
    let steps = 0;
    const airDrag = 2.4 + this.input.shake * 2.0;
    while (this._accum >= FIXED && steps < 5) {
      this.sparkler.step(FIXED, this.cordAnchor, airDrag);
      this._accum -= FIXED;
      steps++;
    }
    if (steps === 5) this._accum = 0;
    this.sparkler.updateGeometry();

    this.beadAnchor.copy(this.sparkler.tip);
    this.beadAnchor.y -= live.emberRadius * 0.55;

    this.fireball.setTime(this.time);
    this.fireball.update(dt, this.beadAnchor, live, this.input.shake);

    this.sparkler.material.uniforms.uTime.value = this.time;
    const alive = this.session.state === STATE.WAITING || this.session.state === STATE.BURNING;
    const cordGlow = alive
      ? live.emberTemp * this.session.gripDim
      : Math.max(0, 1 - this.session.stateTime / 4.5) * 0.34;
    this.sparkler.setBurn(this.session.progress, cordGlow);

    this._updateWind(dt);
    this.carry.copy(this.fireball._smoothVel).multiplyScalar(0.6);

    // Grip is already folded into live.rate by _liveParams; applying it here as
    // well quietly cost about two thirds of the sparks at the busiest stage.
    const rateScale =
      this.quality.settings.sparkRate *
      (alive ? 1 : this.session.state === STATE.FALLING ? 0.06 : 0);
    this.sparks.material.uniforms.uTime.value = this.time;
    this.sparks.update(
      dt,
      live,
      this.fireball.position,
      Math.max(0.0004, live.emberRadius),
      this.carry,
      this.wind,
      rateScale,
      this.rand
    );

    const smokeRate = alive ? 0.5 + Math.min(2.6, live.rate * 0.018) : 0.35;
    this.smoke.update(dt, this.fireball.position, smokeRate, this.wind, this.rand);

    // Once the bead has gone, the charred tip is what the frame belongs to.
    const beadRef = this.fireball.detached ? this.sparkler.tip : this.fireball.position;
    this.rig.update(dt, this.session.progress, this.cordAnchor, beadRef, this.session.fallAmount());

    this.environment.update(dt, this.time, this.camera, this.session.groundGlow);

    this.audio.setPhase(live, alive);
    this.audio.update(dt);

    this.post.render(this.scene, this.camera, this.time, 1.0);

    if (!this._veilLifted && this.frame > 2) {
      this._veilLifted = true;
      this.options.onFirstFrame?.();
    }
  }

  _liveParams(base) {
    const live = this.live;
    const c = this.session.character;
    const dim = this.session.gripDim;
    for (const k in base) live[k] = base[k];
    live.speed *= c.speedMul;
    live.life *= c.lifeMul;
    live.branchCount = Math.round(base.branchCount * c.branchMul);
    live.emberPower *= dim;
    live.emberTemp *= 0.72 + 0.28 * dim;
    live.rate *= dim;
    // Waving the sparkler makes the bead shudder; it does not make it brighter.
    live.emberWobble *= 1 + this.session.stress * 0.6;
    if (this.session.state === STATE.FALLING || this.session.state === STATE.QUIET) {
      live.rate *= 0.15;
      live.speed *= 0.5;
    }
    return live;
  }

  _updateAnchors(dt, immediate) {
    const t = this.time;
    // A held hand is never still. These are millimetres, and they are the reason
    // the bead drifts even when nobody is touching the screen.
    const swayX = Math.sin(t * 0.41) * 0.0011 + Math.sin(t * 0.97 + 1.7) * 0.0006;
    const swayY = Math.sin(t * 0.33 + 2.2) * 0.0009 + Math.sin(t * 1.21) * 0.0004;
    const swayZ = Math.sin(t * 0.27 + 0.8) * 0.0008;
    const tremor = Math.sin(t * 7.3) * 0.00014 + Math.sin(t * 11.9 + 2.0) * 0.00009;

    // Handing over a new one: the hand lifts away and comes back with another.
    let liftY = 0;
    let liftZ = 0;
    let liftX = 0;
    if (this.session.state === STATE.OFFERING) {
      const p = this.session.offerT;
      const lift = p < 0.46 ? smoothstep(0, 0.46, p) : 1 - smoothstep(0.5, 1.0, p);
      liftY = lift * 0.20;
      liftZ = lift * -0.035;
      liftX = lift * 0.035;
    }

    const o = this.input.smoothOffset;
    this.handAnchor.set(
      o.x + swayX + tremor + liftX,
      o.y + swayY + liftY,
      o.z + swayZ + liftZ
    );

    this.hand.group.position.copy(this.handAnchor);
    // A wrist, not a gantry: lateral movement tilts the hand a little.
    this.hand.group.rotation.z = -o.x * 2.6 - swayX * 4.0;
    this.hand.group.rotation.x = o.y * 1.5;
    this.hand.group.rotation.y = o.x * 1.1;

    // The cord leaves the pinch just in front of and below the fingertips.
    this.cordAnchor.set(
      this.handAnchor.x + 0.0004,
      this.handAnchor.y - 0.0026,
      this.handAnchor.z + 0.0062
    );
    if (immediate) this.cordMid.copy(this.cordAnchor);
  }

  _updateWind(dt) {
    // Relative airflow past the sparks: the faster the hand moves, the harder
    // the air pushes the sparks the other way. This is what bends the trails.
    const hv = this.input.handVelocity;
    const t = this.time;
    const breeze = 0.0055 + Math.sin(t * 0.17) * 0.0035;
    this.wind.set(
      -hv.x * 2.6 + breeze,
      -hv.y * 1.4,
      -hv.z * 1.6 + Math.sin(t * 0.11) * 0.002
    );
  }

  /** Debug/test hook: jump straight to a point in the burn. */
  seek(progress) {
    this.session.state = STATE.BURNING;
    this.session.burn = Math.min(1, Math.max(0, progress));
    this.session.firstSparkFired = true;
  }

  dispose() {
    this.stop();
    globalThis.removeEventListener('resize', this._onResize);
    globalThis.removeEventListener('orientationchange', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.input.dispose();
    this.sparks.dispose();
    this.smoke.dispose();
    this.fireball.dispose();
    this.sparkler.dispose();
    this.hand.dispose();
    this.environment.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
