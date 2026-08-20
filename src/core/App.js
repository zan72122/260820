/**
 * Bootstrapping, the frame loop, and everything that keeps a phone happy:
 * a clamped pixel ratio, an internal render scale that moves with measured
 * frame time, a hard stop when the tab goes away, and a WebGL failure path
 * that says so instead of showing a black rectangle.
 */

import * as THREE from 'three';
import { Game } from '../game/Game.js';
import { Input } from './Input.js';
import { Audio } from './Audio.js';
import { pickTier, TIER_SETTINGS, AdaptiveResolution, isFastMode, detectPlatform } from './Quality.js';

const FIXED_STEP = 1 / 60;

export class App {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.fast = isFastMode();
    this.platform = detectPlatform();
    this.running = false;
    this._acc = 0;
    this._last = 0;
    this._frameMs = 16;

    // Probe on a throwaway canvas: asking the real canvas for a context here
    // would lock in its attributes before the renderer ever sees them.
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = probeCanvas.height = 1;
    const probe =
      probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl') || null;
    if (!probe) {
      this.failed = true;
      return;
    }
    this.tier = pickTier(probe);
    this.settings = { ...TIER_SETTINGS[this.tier] };
    const lose = probe.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
        antialias: this.tier !== 'low' && !this.fast,
      });
    } catch (err) {
      console.error('[kingyo] renderer init failed', err);
      this.failed = true;
      return;
    }

    // A festival at dusk is a high dynamic range subject: bare bulbs and
    // lantern paper against a nearly black ground. ACES keeps the highlights
    // from clipping to flat white while letting the warm mid-tones bloom.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    this.renderer.setClearColor(0x0b0708, 1);
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.renderer.shadowMap.type = this.settings.softShadow
      ? THREE.PCFSoftShadowMap
      : THREE.PCFShadowMap;
    this.renderer.info.autoReset = true;

    this.maxPixelRatio = this.fast ? 1 : this.settings.maxPixelRatio;
    this.adaptive = new AdaptiveResolution(this.tier);
    if (this.fast) {
      this.adaptive.scale = 0.75;
      this.adaptive.min = this.adaptive.max = 0.75;
    }

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x241209, 0.088);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.05, 60);

    this.input = new Input(canvas);
    this.audio = new Audio();
    // Must happen inside the gesture, not on the next frame, or iOS Safari
    // hands back a permanently suspended AudioContext.
    this.input.onFirstTouch = () => this.audio.unlock();
    this.game = new Game({
      scene: this.scene,
      camera: this.camera,
      settings: this.settings,
      input: this.input,
      audio: this.audio,
      seed: this.fast ? 0x1234abcd : (Math.random() * 0xffffffff) >>> 0,
    });

    this._onResize = this._onResize.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
    this._loop = this._loop.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
    this._onResize();

    // Warm the shaders before the first frame so the opening beat is smooth.
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch (err) {
      console.warn('[kingyo] shader precompile skipped', err);
    }
  }

  get size() {
    const vv = window.visualViewport;
    const w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
    const h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
    return { w, h };
  }

  _onResize() {
    if (!this.renderer) return;
    const { w, h } = this.size;
    this.viewW = w;
    this.viewH = h;
    this._applyResolution();
    this.game.resize(w, h);
  }

  _applyResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(dpr * this.adaptive.scale);
    this.renderer.setSize(this.viewW, this.viewH, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  _onVisibility() {
    if (document.hidden) {
      this.audio.suspend();
      this.running = false;
    } else if (!this.running) {
      this.audio.resume();
      this.start();
    }
  }

  start() {
    if (this.failed || this.running) return;
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
  }

  _loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const raw = (now - this._last) / 1000;
    this._last = now;
    // A phone that has been backgrounded, or a slow first frame, must not be
    // allowed to teleport the poi across the tub.
    const dt = Math.min(Math.max(raw, 1 / 240), 1 / 15);

    const t0 = performance.now();
    this.step(dt);
    this.render();
    const t1 = performance.now();
    this._frameMs = this._frameMs * 0.9 + (t1 - t0 + Math.max(0, raw * 1000 - 16.7) * 0.35) * 0.1;

    if (this.adaptive.update(this._frameMs, dt) && this.adaptive.changed) {
      this._applyResolution();
    }
  }

  /** One simulation step. Split out so tests can drive it without a clock. */
  step(dt) {
    this._acc += dt;
    let guard = 0;
    while (this._acc >= FIXED_STEP && guard < 4) {
      this.game.update(FIXED_STEP);
      this._acc -= FIXED_STEP;
      guard++;
    }
    if (guard === 4) this._acc = 0;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Deterministic advance used by the automated smoke test. */
  advance(seconds, render = false) {
    const steps = Math.round(seconds / FIXED_STEP);
    for (let i = 0; i < steps; i++) this.game.update(FIXED_STEP);
    if (render) this.render();
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.input.dispose();
    this.audio.dispose();
    this.game.dispose();
    this.renderer.dispose();
  }
}
