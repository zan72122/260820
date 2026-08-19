/* ==========================================================================
   こおりの みずうみ ― ワカサギ つり
   A one-finger ice-fishing game for four-year-olds, in real WebGL 3D.
   The whole game is one continuous camera move: drill → the hole opens →
   down the line into the water → a fish → back up and out of the hole.
   ========================================================================== */
import * as THREE from 'three';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { Pointer } from './input.js';
import { CameraRig } from './camera.js';
import { ScreenLine } from './line.js';
import { Fx } from './fx.js';
import { SKY, createSky, createMountains, createShoreline } from './sky.js';
import {
  HOLE_R, ICE_T, WATER_Y, LAKE_DEPTH,
  createIceSurface, createBore, createWaterTop, createSkyWindow, createLightShaft,
  createPlug, createApron, createShavings, createSlush, createSnowfall,
  createPlankton, createLakeBed, Breath,
} from './world.js';
import { createAuger, createScoop, createRod, createRig, createBucket } from './gear.js';
import { Fish, createFish } from './fish.js';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SCOOP_STOW = V3(0.66, 0.03, -0.52);   // laid on the snow, out of frame

/* ---------- shot list: every framing in the game, in world metres ------- */
const SHOTS = {
  vista:   { pos: V3(2.60, 1.44, 3.05), look: V3(0.10, 0.30, -1.30), fov: 0 },
  drill:   { pos: V3(0.58, 1.02, 1.55), look: V3(0.00, 0.46, 0.00), fov: 0 },
  reveal:  { pos: V3(0.17, 0.35, 0.31), look: V3(0.00, -0.05, 0.00), fov: 2 },
  scoop:   { pos: V3(0.20, 0.41, 0.37), look: V3(0.00, -0.03, 0.00), fov: 2 },
  mouth:   { pos: V3(0.00, 0.24, 0.15), look: V3(0.00, -0.09, 0.00), fov: 4 },
  throat:  { pos: V3(0.00, -0.04, 0.035), look: V3(0.00, -0.62, 0.01), fov: 10 },
  descend: { pos: V3(0.11, -0.50, 0.24), look: V3(0.00, -0.82, 0.00), fov: 14 },
  fishing: { pos: V3(0.40, -1.30, 0.56), look: V3(0.03, -0.86, 0.02), fov: 16 },
  rising:  { pos: V3(0.08, -0.48, 0.18), look: V3(0.00, -0.70, 0.00), fov: 10 },
  popup:   { pos: V3(0.29, 0.30, 0.73), look: V3(-0.15, 0.36, -0.08), fov: 0 },
  show:    { pos: V3(0.24, 0.50, 0.72), look: V3(-0.19, 0.13, -0.10), fov: 0 },
};

class Game {
  constructor() {
    this.ui = new UI();
    this.snd = new Sound();
    this.canvas = document.getElementById('gl');
    this._last = performance.now() / 1000;
    this.time = 0;
    this.phase = 'boot';
    this.phaseT = 0;
    this.caught = 0;
    this.under = 0;           // 0 = above the ice, 1 = under the water
    this.jig = 0;
    this.idle = 0;
    this.frameScale = 1;
    this.baseFov = 52;
    this.shotFov = 0;
    this.currentShot = SHOTS.vista;

    this.initRenderer();
    this.initScene();
    this.initWorld();
    this.initGear();
    this.initFish();
    this.initEvents();

    this.rig.snap(this.shotPos(SHOTS.vista), SHOTS.vista.look);
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* ===================================================================== */
  initRenderer() {
    const r = this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: false,
      powerPreference: 'high-performance', stencil: false,
    });
    const qs = new URLSearchParams(location.search);
    // a fixed timestep makes automated playtests deterministic; unused in play
    this.fixedStep = Math.min(0.05, parseFloat(qs.get('step')) || 0);
    this.frames = 0;
    const forced = parseFloat(qs.get('dpr'));
    this.dprCap = Math.min(window.devicePixelRatio || 1, 2);
    this.dprFixed = Number.isFinite(forced) && forced > 0;
    if (this.dprFixed) this.dprCap = forced;
    this.dpr = this.dprCap;
    r.setPixelRatio(this.dpr);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
  }

  initScene() {
    const scene = this.scene = new THREE.Scene();
    this.fogAir = new THREE.Color(0xc7d9e6);
    this.fogWater = new THREE.Color(0x11405c);
    scene.fog = new THREE.FogExp2(this.fogAir.clone(), 0.0016);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.02, 1800);
    this.rig = new CameraRig(this.camera);

    // --- light -------------------------------------------------------
    const sun = this.sun = new THREE.DirectionalLight(0xfff2dc, 2.55);
    sun.position.copy(SKY.sunDir).multiplyScalar(28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -4.2; sc.right = 4.2; sc.top = 4.2; sc.bottom = -4.2;
    sc.near = 18; sc.far = 44;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);

    scene.add(new THREE.HemisphereLight(0xcde3f5, 0xf6fafd, 0.85));
    scene.add(new THREE.AmbientLight(0xa8c6dd, 0.16));

    // light spilling down through the hole, so the water under it glows
    this.holeLight = new THREE.PointLight(0xa8d9f7, 0.0, 6.0, 1.6);
    this.holeLight.position.set(0, WATER_Y - 0.75, 0);
    scene.add(this.holeLight);
    // a soft key that travels with the rig so the fish always catch a glint
    this.lureLight = new THREE.PointLight(0xd6ecff, 0.0, 1.5, 2);
    scene.add(this.lureLight);

    this.fx = new Fx(scene);
    this.breath = new Breath(scene);
    this.bakeEnvironment();
  }

  /* Bake the sky into an environment map so metal, ice and fish scales have
     something real to reflect instead of turning black. */
  bakeEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(createSky());
    const rt = pmrem.fromScene(envScene, 0, 0.1, 1200);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 1.05;
    pmrem.dispose();
  }

  initWorld() {
    const s = this.scene;
    this.sky = createSky();       s.add(this.sky);
    this.mountains = createMountains(); s.add(this.mountains);
    this.shore = createShoreline(); s.add(this.shore);
    this.snow = createIceSurface(); s.add(this.snow);
    this.bore = createBore();     s.add(this.bore);
    this.bore.visible = false;
    this.apron = createApron();   s.add(this.apron);
    this.plug = createPlug();     s.add(this.plug);
    this.waterTop = createWaterTop(); s.add(this.waterTop);
    this.skyWindow = createSkyWindow(); s.add(this.skyWindow);
    this.shaft = createLightShaft(); s.add(this.shaft);
    this.lakeBed = createLakeBed(); s.add(this.lakeBed);
    this.shavings = createShavings(110); s.add(this.shavings);
    this.slush = createSlush(20); s.add(this.slush);
    this.snowfall = createSnowfall(700); s.add(this.snowfall);
    this.plankton = createPlankton(430); s.add(this.plankton);

    // a wall of water that hides the sky once the camera is under the ice
    const wallH = Math.abs(LAKE_DEPTH) + 1.2;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(40, 40, wallH, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: this.fogWater, side: THREE.BackSide, fog: true }));
    wall.position.y = -ICE_T - 0.04 - wallH / 2;
    s.add(wall);
    this.waterWall = wall;

    this.waterTop.visible = false;
    this.skyWindow.visible = false;
    this.shaft.visible = false;
    this.slush.visible = false;
    this.plankton.visible = false;
  }

  initGear() {
    const s = this.scene;
    this.auger = createAuger(); s.add(this.auger);
    this.scoop = createScoop(); s.add(this.scoop);
    this.rod = createRod();     s.add(this.rod);
    this.rig3 = createRig();    s.add(this.rig3);
    this.bucket = createBucket(); s.add(this.bucket);

    this.rod.position.set(0.37, 0, -0.28);
    this.rod.rotation.y = Math.atan2(-0.37, 0.28);
    this.rod.visible = false;

    this.bucket.position.set(-0.34, 0, -0.20);
    this.bucket.rotation.y = 0.4;

    this.scoopRest = V3(0.34, 0.055, 0.26);
    this.scoop.position.copy(this.scoopRest);
    this.scoop.rotation.set(-0.15, 1.1, 0.25);
    this.scoop.visible = false;

    this.augerRest = { pos: V3(-0.92, 0.05, -0.62), rot: new THREE.Euler(Math.PI / 2 * 0.98, 2.3, 0.2) };

    // the rig on the end of the line
    this.lure = V3(0, WATER_Y - 0.08, 0);
    this.lureRest = -0.86;
    this.rig3.position.copy(this.lure);
    this.rig3.visible = false;

    // fishing line: a dark outline under a bright core so it reads on snow
    // and in dark water alike
    this.lineOutline = new ScreenLine(30, { color: 0x102636, width: 6.4, opacity: 0.5 });
    this.lineCore = new ScreenLine(30, { color: 0xf4fbff, width: 3.0, opacity: 0.95 });
    this.lineOutline.renderOrder = 9;
    this.lineCore.renderOrder = 10;
    s.add(this.lineOutline); s.add(this.lineCore);
    this.lineOutline.visible = this.lineCore.visible = false;
    this.linePts = Array.from({ length: 30 }, () => new THREE.Vector3());

    this.bucketFish = [];
  }

  initFish() {
    this.fish = [];
    for (let i = 0; i < 7; i++) this.fish.push(new Fish(this.scene, i));
    this.fish.forEach(f => f.setVisible(false));
    this.hooked = null;
  }

  /* ===================================================================== */
  initEvents() {
    this.pointer = new Pointer(this.canvas);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());

    this.ui.startBtn.addEventListener('click', () => this.start(), { passive: true });
    this.ui.sndBtn.addEventListener('click', () => {
      const on = this.ui.sndBtn.classList.toggle('off');
      this.snd.setEnabled(!on);
      this.ui.sndBtn.textContent = on ? '🔇' : '🔊';
    }, { passive: true });
    this.ui.againBtn.addEventListener('click', () => this.newHole(), { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.snd.drillOff(); this.snd.tensionOff(); }
    });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(this.dpr);
    this.camera.aspect = aspect;
    // portrait phones get a wider lens and a slightly longer lens-to-subject
    // distance so nothing important falls outside the tall, narrow frame
    if (aspect >= 1) {
      this.baseFov = 50 + clamp((1.9 - aspect) * 6, 0, 8);
      this.frameScale = 1.0;
    } else {
      this.baseFov = 50 + (1 - aspect) * 22;
      this.frameScale = 1 + (1 - aspect) * 0.15;
    }
    this.applyFov();
    const buf = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(buf);
    this.lineOutline.setResolution(buf.x, buf.y);
    this.lineCore.setResolution(buf.x, buf.y);
    // keep the line readable at any density
    this.lineCore.width = Math.max(2.6, 3.1 * this.dpr);
    this.lineOutline.width = this.lineCore.width + 2.6 * this.dpr;
    if (!this.rig.busy && this.currentShot) {
      this.rig.snap(this.shotPos(this.currentShot), this.currentShot.look);
    }
  }

  applyFov() {
    const f = this.baseFov + (this.shotFov || 0);
    this.camera.fov = f;
    this.rig.fovFrom = f; this.rig.fovTo = f;
    this.camera.updateProjectionMatrix();
  }

  shotPos(shot) {
    return shot.look.clone().addScaledVector(
      shot.pos.clone().sub(shot.look), this.frameScale);
  }

  /** move to a named shot; every phase change goes through here */
  go(name, dur = 1.6, opts = {}) {
    const s = SHOTS[name];
    this.currentShot = s;
    this.shotFov = s.fov || 0;
    this.rig.to(this.shotPos(s), s.look.clone(), dur,
      { ...opts, fov: this.baseFov + this.shotFov });
  }
  /** a continuous multi-stop move — used for the dive and the haul-up */
  goPath(list) {
    const steps = list.map(([name, dur, extra]) => {
      const s = SHOTS[name];
      return {
        pos: this.shotPos(s), look: s.look.clone(), dur,
        fov: this.baseFov + (s.fov || 0),
        easing: (extra && extra.easing) || 'inOut',
        via: extra && extra.via, onArrive: extra && extra.onArrive,
      };
    });
    this.currentShot = SHOTS[list[list.length - 1][0]];
    this.shotFov = this.currentShot.fov || 0;
    this.rig.path(steps);
  }

  setPhase(p) { this.phase = p; this.phaseT = 0; this.idle = 0; }

  /* =====================================================================
     Flow
     ===================================================================== */
  start() {
    this.snd.init();
    this.snd.blip(880);
    this.ui.hideStart();
    this.ui.setTally(this.caught);
    this.setPhase('approach');
    this.go('drill', 3.2, {
      via: V3(1.7, 1.45, 2.3), easing: 'inOut',
      onArrive: () => { if (this.phase === 'approach') this.beginDrill(); },
    });
  }

  beginDrill() {
    this.setPhase('drill');
    this.drillP = 0;
    this.ui.showRing(true);
    this.ui.setRing(0);
    this.ui.say('ぐるぐる まわそう！', 'circle');
  }

  breakThrough() {
    this.setPhase('breaking');
    this.ui.showRing(false);
    this.ui.hideSay();
    this.snd.drillOff();
    this.snd.breakthrough();
    this.rig.kick(1.0);
    this.ui.doFlash();
    this.plugFall = { t: 0 };
    this.augerLift = { t: 0, from: this.auger.position.y };
    this.fx.iceChips(V3(0, 0.02, 0), 26, { speed: 1.1, up: 2.0, size: 0.0075 });
    this.go('reveal', 2.0, { easing: 'inOut' });
  }

  beginScoop() {
    this.setPhase('scoop');
    this.scoop.visible = true;
    this.ui.showRing(true);
    this.ui.setRing(0);
    this.ui.say('こおりを すくおう', 'scoop');
    this.go('scoop', 1.2);
  }

  dropLine() {
    this.setPhase('dropping');
    this.ui.showRing(false);
    this.ui.hideSay();
    this.scoopStow = { from: this.scoop.position.clone(), t: 0 };
    this.rod.visible = true;
    this.rig3.visible = true;
    this.lineOutline.visible = this.lineCore.visible = true;
    this.lure.set(0, WATER_Y + 0.02, 0);
    this.snd.plop(520);
    this.fish.forEach(f => { f.setVisible(true); f.reset(); });
    this.plankton.visible = true;
    this.goPath([
      ['mouth', 1.5],
      ['throat', 1.2, { easing: 'linear' }],
      ['descend', 1.4, { easing: 'linear' }],
      ['fishing', 1.8, { onArrive: () => this.beginFishing() }],
    ]);
  }

  beginFishing() {
    this.setPhase('fishing');
    this.ui.say('ゆらゆら して おさかなを よぼう', 'updown');
    this.biteTimer = 0;
  }

  hookUp(fish) {
    this.hooked = fish;
    this.lureBase = this.lure.y;
    fish.state = 'hooked';
    fish.flash();
    this.setPhase('bite');
    this.snd.tensionOn();
    this.snd.nibble();
    this.fx.bubbles(this.lure, 10, 0.08);
    this.ui.say('きた！ ひっぱれ！', 'pull', true);
    this.rig.kick(0.35);
  }

  pullUp() {
    if (this.phase !== 'bite') return;
    this.setPhase('pulling');
    this.ui.hideSay();
    this.snd.tensionPitch(1);
    // however deep the rig was left, it surfaces just after the camera lands
    const dist = Math.max(0.25, WATER_Y - this.lure.y);
    this.pullSpeed = dist / 1.5;
    this.goPath([
      ['rising', 0.45, { easing: 'linear' }],
      ['throat', 0.40, { easing: 'linear' }],
      ['popup', 0.52, { easing: 'outSoft' }],
    ]);
  }

  popOut() {
    this.setPhase('popping');
    this.snd.tensionOff();
    this.snd.fishOut();
    this.ui.doFlash();
    this.rig.kick(0.9);
    const at = V3(0, WATER_Y, 0);
    this.fx.ring(V3(0, WATER_Y + 0.004, 0), { color: 0xdff2ff, r0: 0.04, r1: HOLE_R * 1.9, ttl: 0.75, opacity: 1 });
    this.fx.ring(V3(0, WATER_Y + 0.004, 0), { color: 0xbfe4ff, r0: 0.02, r1: HOLE_R * 3.2, ttl: 1.15, opacity: 0.5 });
    this.fx.spray(at, 30, { color: 0xe8f7ff, speed: 1.5, up: 2.6, spread: 1, size0: 0.012, size1: 0.026, ttl: 1.0 });
    this.fx.sparkle(V3(0, 0.14, 0), 14);
    this.waterTop.material.uniforms.uRipple.value = 1.4;

    // launch the fish on an arc that lands it in the bucket
    const f = this.hooked;
    const T = 0.78, g = -9.8;
    const p0 = V3(0, WATER_Y + 0.02, 0);
    const p1 = this.bucket.position.clone().add(V3(0, 0.17, 0));
    const v = p1.clone().sub(p0).divideScalar(T).sub(V3(0, 0.5 * g * T, 0));
    this.flying = { f, p: p0, v, t: 0, T, spin: (Math.random() - 0.5) * 6 + 8 };
    f.obj.position.copy(p0);
    f.flash();
    this.hooked = null;
  }

  celebrate() {
    this.setPhase('celebrate');
    this.caught++;
    this.ui.setTally(this.caught);
    this.ui.say('わあ！ とれた！', 'none', true);
    this.snd.sparkle();
    this.go('show', 1.2);
  }

  reDrop() {
    this.setPhase('dropping');
    this.ui.hideSay();
    this.lure.set(0, WATER_Y + 0.02, 0);
    this.snd.plop(520);
    this.fish.forEach(f => { if (f.state !== 'wander') { f.state = 'wander'; f.interest = 0; } });
    this.goPath([
      ['mouth', 1.0],
      ['throat', 0.85, { easing: 'linear' }],
      ['descend', 1.0, { easing: 'linear' }],
      ['fishing', 1.4, { onArrive: () => this.beginFishing() }],
    ]);
  }

  /** start over with a fresh, unbroken sheet of ice */
  newHole() {
    this.snd.blip(660);
    this.snd.tensionOff(); this.snd.drillOff();
    this.plug.visible = true;
    this.bore.visible = false;
    this.plug.position.set(0, 0, 0);
    this.plug.rotation.set(0, 0, 0);
    this.plug.userData.scar.material.opacity = 0;
    this.plug.userData.cracks.material.opacity = 0;
    this.apron.material.opacity = 0;
    this.waterTop.visible = false;
    this.skyWindow.visible = false;
    this.shaft.visible = false;
    this.slush.visible = false;
    this.slush.children.forEach(m => {
      m.visible = true;
      m.userData.alive = true; m.userData.state = null;
      m.position.copy(m.userData.home);
      m.scale.setScalar(1);
    });
    this.plankton.visible = false;
    this.rod.visible = false;
    this.rig3.visible = false;
    this.scoop.visible = false;
    this.scoopStow = null;
    this.scoop.position.copy(this.scoopRest);
    this.scoop.rotation.set(-0.15, 1.1, 0.25);
    this.lineOutline.visible = this.lineCore.visible = false;
    this.fish.forEach(f => { f.setVisible(false); f.reset(); });
    this.hooked = null; this.flying = null;
    this.shavings.count = 0;
    this.auger.visible = true;
    this.auger.position.set(0, 0, 0);
    this.auger.rotation.set(0, 0, 0);
    this.augerLift = null; this.plugFall = null;
    this.drillP = 0;
    this.holeLight.intensity = 0;
    this.go('drill', 1.6, { onArrive: () => this.beginDrill() });
    this.setPhase('approach');
  }

  /* =====================================================================
     Per-phase update
     ===================================================================== */
  updateDrill(dt) {
    const p = this.pointer;
    // ANY movement drills. Turning drills faster. There is no wrong gesture.
    let gain = 0;
    if (p.down) {
      gain += Math.abs(p.turn) / (Math.PI * 2) / 5.0;          // 5 full turns
      gain += Math.hypot(p.dx, p.dy) * 0.00016;                 // scribbling works too
      gain = Math.min(gain, 0.62 * dt + 0.004);
      this.auger.rotation.y -= p.turn;
      if (Math.abs(p.turn) < 0.0001) this.auger.rotation.y -= dt * 1.2 * Math.min(1, p.speed / 400);
    }
    const was = this.drillP;
    this.drillP = clamp(this.drillP + gain, 0, 1);
    const rate = clamp(gain / Math.max(dt, 1e-4) * 3.4, 0, 1);

    if (p.down && gain > 0.00002) {
      this.snd.drillOn(); this.snd.drillRate(rate);
      this.idle = 0;
      if (Math.random() < rate * 24 * dt) {
        const a = Math.random() * Math.PI * 2;
        this.fx.iceChips(V3(Math.cos(a) * HOLE_R * 0.9, 0.01, Math.sin(a) * HOLE_R * 0.9), 1,
          { speed: 0.7, up: 1.2, size: 0.005 });
      }
    } else {
      this.snd.drillOff();
      this.idle += dt;
    }

    // the auger sinks as it eats down into the ice
    this.auger.position.y = -this.drillP * 0.13;
    const ud = this.plug.userData;
    ud.scar.material.opacity = clamp(this.drillP * 2.2, 0, 0.95);
    ud.scar.scale.setScalar(1 + this.drillP * 0.04);
    ud.cracks.material.opacity = clamp((this.drillP - 0.45) / 0.5, 0, 0.9);
    this.apron.material.opacity = clamp(this.drillP * 1.5, 0, 0.55);
    this.plug.position.y = -this.drillP * 0.012;
    this.updateShavings(this.drillP);

    this.ui.setRing(this.drillP);
    if (this.drillP > 0.62 && was <= 0.62) this.snd.blip(520);
    if (this.idle > 4.5 && this.drillP < 1) this.ui.say('ぐるぐる まわそう！', 'circle', true);
    else if (this.drillP > 0) this.ui.say('ぐるぐる まわそう！', 'circle');

    if (this.drillP >= 1) this.breakThrough();
  }

  updateShavings(p) {
    const inst = this.shavings;
    const { data, dummy } = inst.userData;
    const n = Math.floor(p * data.length);
    if (n === inst.count) return;
    for (let i = 0; i < n; i++) {
      const d = data[i];
      dummy.position.set(d.x, 0.004 + d.s * d.sy * 0.5, d.z);
      dummy.rotation.copy(d.rot);
      dummy.scale.set(d.s, d.s * d.sy, d.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
  }

  updateBreaking(dt) {
    const t = this.phaseT;
    // the auger is pulled up and out, then laid on the snow
    if (this.augerLift) {
      const a = this.augerLift;
      a.t = Math.min(1, a.t + dt / 0.9);
      const e = 1 - Math.pow(1 - a.t, 2.4);
      this.auger.position.y = lerp(a.from, 0.34, e);
      this.auger.position.x = lerp(0, this.augerRest.pos.x * 0.4, e);
      this.auger.rotation.z = lerp(0, -0.5, e);
      this.auger.rotation.y += dt * 2.2 * (1 - e);
      if (a.t >= 1) {
        this.auger.position.copy(this.augerRest.pos);
        this.auger.rotation.copy(this.augerRest.rot);
        this.augerLift = null;
      }
    }
    // the plug of ice lets go and drops into the water it just revealed
    if (this.plugFall && t > 0.22) {
      const f = this.plugFall;
      f.t += dt;
      const y = -0.5 * 5.2 * f.t * f.t;
      this.plug.position.y = y;
      this.plug.rotation.z = f.t * 1.4;
      this.plug.rotation.x = f.t * 0.7;
      if (!f.splashed && y < WATER_Y - 0.02) {
        f.splashed = true;
        this.snd.splash(0.9);
        this.fx.ring(V3(0, WATER_Y + 0.004, 0), { color: 0xcfe8f8, r0: 0.03, r1: HOLE_R * 2.0, ttl: 0.9, opacity: 0.95 });
        this.fx.spray(V3(0, WATER_Y, 0), 22, { color: 0xdff2ff, speed: 1.1, up: 1.9, size0: 0.01, size1: 0.02 });
        this.waterTop.material.uniforms.uRipple.value = 1.6;
        this.rig.kick(0.5);
      }
      if (y < -0.75) this.plug.visible = false;
    }
    // black water appears
    if (t > 0.34 && !this.waterTop.visible) {
      this.bore.visible = true;
      this.waterTop.visible = true;
      this.skyWindow.visible = true;
      this.shaft.visible = true;
    }
    if (this.waterTop.visible) {
      const k = clamp((t - 0.34) / 0.5, 0, 1);
      this.waterTop.material.uniforms.uOpacity.value = k;
      this.holeLight.intensity = k * 2.6;
    }
    if (t > 1.15 && !this.slush.visible) {
      this.slush.visible = true;
      this.slushLeft = this.slush.children.length;
    }
    if (t > 1.0 && t - dt <= 1.0) this.ui.say('あっ！ くろい みず！', 'none', true);
    if (t > 3.3) this.beginScoop();
  }

  updateScoop(dt) {
    const p = this.pointer;
    const target = this.pickWater();
    if (p.down && target) {
      this.scoop.position.lerp(V3(target.x, WATER_Y + 0.052, target.z), 1 - Math.pow(0.0005, dt));
      this.scoop.rotation.set(lerp(this.scoop.rotation.x, -0.1, dt * 6), 0, 0);
      this.idle = 0;
    } else {
      this.scoop.position.lerp(this.scoopRest, 1 - Math.pow(0.02, dt));
      this.scoop.rotation.x = lerp(this.scoop.rotation.x, -0.15, dt * 4);
      this.idle += dt;
    }

    // collect any slush the bowl passes over
    let got = 0;
    for (const m of this.slush.children) {
      const u = m.userData;
      if (!u.alive) continue;
      const d = Math.hypot(m.position.x - this.scoop.position.x, m.position.z - this.scoop.position.z);
      if (p.down && d < 0.082) {
        u.alive = false; u.state = 'bowl'; u.t = 0;
        u.from = m.position.clone();
        got++;
      }
    }
    if (got) {
      this.snd.scoop(Math.min(1, got * 0.6));
      this.fx.spray(this.scoop.position, 5, {
        color: 0xe8f7ff, speed: 0.5, up: 0.9, size0: 0.006, size1: 0.014, ttl: 0.5,
      });
      this.waterTop.material.uniforms.uRipple.value = Math.min(1.2,
        this.waterTop.material.uniforms.uRipple.value + 0.5);
    }
    const total = this.slush.children.length;
    const left = this.slush.children.filter(m => m.userData.alive).length;
    this.ui.setRing(1 - left / total);
    if (this.idle > 5) this.ui.say('こおりを すくおう', 'scoop', true);

    // never let a child get stuck on this step
    if (left === 0 || this.phaseT > 22) {
      this.slush.children.forEach(m => { if (m.userData.alive) { m.userData.alive = false; m.userData.state = 'bowl'; m.userData.t = 0; m.userData.from = m.position.clone(); } });
      this.dropLine();
    }
  }

  updateSlushPieces(dt) {
    for (const m of this.slush.children) {
      const u = m.userData;
      if (u.alive) {
        // bobbing on the black water
        m.position.y = WATER_Y + 0.004 + Math.sin(this.time * 1.6 + u.phase) * 0.006;
        m.rotation.y += u.drift * dt;
        m.position.x = u.home.x + Math.sin(this.time * 0.35 + u.phase) * 0.012;
        m.position.z = u.home.z + Math.cos(this.time * 0.3 + u.phase) * 0.012;
      } else if (u.state === 'bowl') {
        u.t += dt;
        const k = Math.min(1, u.t / 0.35);
        m.position.lerpVectors(u.from, this.scoop.position, k);
        m.position.y += Math.sin(k * Math.PI) * 0.05;
        if (u.t > 0.5) {
          u.state = 'toss'; u.t = 0;
          const a = Math.random() * Math.PI * 2;
          const r = 0.3 + Math.random() * 0.22;
          u.from = m.position.clone();
          u.to = V3(Math.cos(a) * r, 0.012, Math.sin(a) * r);
        }
      } else if (u.state === 'toss') {
        u.t += dt;
        const k = Math.min(1, u.t / 0.55);
        m.position.lerpVectors(u.from, u.to, k);
        m.position.y += Math.sin(k * Math.PI) * 0.14;
        m.rotation.x += dt * 5; m.rotation.z += dt * 4;
        if (k >= 1) { u.state = 'rest'; this.snd.scoop(0.3); }
      }
    }
  }

  updateFishing(dt) {
    const p = this.pointer;
    // vertical drag jigs the rig; up on screen lifts it
    if (p.down) {
      this.lure.y = clamp(this.lure.y - p.dy * 0.0042, -2.35, WATER_Y - 0.30);
      this.idle = 0;
    } else {
      this.lure.y = lerp(this.lure.y, this.lureRest, dt * 0.7);
      this.idle += dt;
    }
    const move = Math.abs(p.dy) / Math.max(dt, 1e-4);
    this.jig = lerp(this.jig, clamp(move / 900, 0, 1), Math.min(1, dt * 6));

    this.biteTimer += dt * (0.55 + this.jig * 2.4);
    let best = null, bestD = 1e9;
    for (const f of this.fish) {
      const d = f.obj.position.distanceTo(this.lure);
      if (f.state === 'curious' && d < bestD) { best = f; bestD = d; }
    }
    if (best && (this.biteTimer > 2.2 || bestD < 0.3) && !this.fish.some(f => f.state === 'bite')) {
      best.state = 'bite';
      this.snd.nibble();
    }
    // the take
    for (const f of this.fish) {
      if (f.state === 'bite' && f.obj.position.distanceTo(this.lure) < 0.10) {
        this.hookUp(f);
        break;
      }
    }
    // fallback: nobody should ever wait more than a few seconds
    if (this.phaseT > 9 && !this.fish.some(f => f.state === 'bite')) {
      let n = null, nd = 1e9;
      for (const f of this.fish) {
        const d = f.obj.position.distanceTo(this.lure);
        if (d < nd) { nd = d; n = f; }
      }
      if (n) { n.state = 'bite'; n.interest = 4; }
    }
    if (this.idle > 4.5) this.ui.say('ゆらゆら して おさかなを よぼう', 'updown', true);
  }

  updateBite(dt) {
    const p = this.pointer;
    // the rig is being worried by a fish
    this.lure.y = this.lureBase + Math.sin(this.time * 22) * 0.012;
    if (this.hooked) {
      const f = this.hooked.obj;
      f.position.lerp(this.lure.clone().add(V3(0, -0.055, 0)), 1 - Math.pow(0.001, dt));
      f.rotation.x = lerp(f.rotation.x, -1.15, dt * 4);
      f.rotation.z = Math.sin(this.time * 15) * 0.35;
    }
    this.snd.tensionPitch(0.35 + Math.sin(this.time * 3) * 0.2);
    if (Math.random() < dt * 2.4) this.fx.bubbles(this.lure, 2, 0.05);

    // any upward drag, a decent flick, or a tap will do it
    if (this.phaseT < 0.5) { p.takeTap(); return; }   // let きた！ land before a flick counts
    const dragUp = p.down && (p.y - p.startY) < -34;
    const flick = p.down && p.dy < -9;
    if (dragUp || flick || p.takeTap()) { this.pullUp(); return; }
    if (this.phaseT > 4.2) this.pullUp();     // and if they just watch, it happens anyway
  }

  updatePulling(dt) {
    this.lure.y = Math.min(WATER_Y + 0.02, this.lure.y + dt * (this.pullSpeed || 0.9));
    this.lure.x = lerp(this.lure.x, 0, dt * 6);
    this.lure.z = lerp(this.lure.z, 0, dt * 6);
    if (this.hooked) {
      const f = this.hooked.obj;
      f.position.lerp(this.lure.clone().add(V3(0, -0.06, 0)), 1 - Math.pow(0.0002, dt));
      f.rotation.set(-1.35, 0, Math.sin(this.time * 20) * 0.42);
      if (Math.random() < dt * 14) this.fx.bubbles(f.position, 2, 0.05);
    }
    this.snd.tensionPitch(clamp(1 - (WATER_Y - this.lure.y), 0, 1));
    if (this.lure.y >= WATER_Y - 0.02) this.popOut();
  }

  updatePopping(dt) {
    const fl = this.flying;
    if (fl) {
      fl.t += dt;
      fl.v.y -= 9.8 * dt;
      fl.p.addScaledVector(fl.v, dt);
      fl.f.obj.position.copy(fl.p);
      fl.f.obj.rotation.x += dt * fl.spin;
      fl.f.obj.rotation.z = Math.sin(this.time * 24) * 0.5;
      const grow = 1 + 0.4 * Math.sin(Math.PI * Math.min(1, fl.t / fl.T));
      fl.f.obj.scale.setScalar(grow);
      fl.f.u.uRate.value = 20; fl.f.u.uAmp.value = 1.8;
      if (Math.random() < dt * 26 && fl.t < 0.4) {
        this.fx.spray(fl.p, 2, { color: 0xdff2ff, speed: 0.4, up: 0.6, size0: 0.007, size1: 0.014, ttl: 0.5 });
      }
      if (Math.random() < dt * 12) this.fx.sparkle(fl.p, 1, 0xfff6d8);
      if (fl.t >= fl.T) {
        fl.f.obj.scale.setScalar(1);
        this.snd.plop(360);
        this.fx.spray(this.bucket.position.clone().add(V3(0, 0.15, 0)), 8,
          { color: 0xcfeaff, speed: 0.5, up: 1.0, size0: 0.008, size1: 0.016, ttl: 0.6 });
        this.stowFish();
        this.flying = null;
        this.celebrate();
      }
    }
    // the rig carries on up to the rod tip
    this.lure.y = Math.min(0.10, this.lure.y + dt * 0.55);
  }

  stowFish() {
    const fish = createFish();
    const n = this.bucketFish.length;
    const a = n * 1.4;
    fish.position.copy(this.bucket.position).add(
      V3(Math.cos(a) * 0.045, 0.132 + Math.min(n, 5) * 0.008, Math.sin(a) * 0.045));
    fish.rotation.set(Math.PI / 2 * (0.62 + Math.random() * 0.28), a + Math.random(), 0.35);
    fish.scale.setScalar(0.95);
    this.scene.add(fish);
    this.bucketFish.push(fish);
    if (this.bucketFish.length > 8) {
      const old = this.bucketFish.shift();
      this.scene.remove(old);
      old.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
    }
    if (this.flying) { this.flying.f.setVisible(false); this.flying.f.reset(); this.flying.f.setVisible(true); }
  }

  /* raycast the finger onto the water plane inside the hole */
  pickWater() {
    const p = this.pointer;
    this._ray = this._ray || new THREE.Raycaster();
    this._plane = this._plane || new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WATER_Y + 0.05));
    this._ray.setFromCamera(new THREE.Vector2(p.nx, p.ny), this.camera);
    const hit = V3();
    if (!this._ray.ray.intersectPlane(this._plane, hit)) return null;
    const r = Math.hypot(hit.x, hit.z);
    const max = HOLE_R * 2.4;
    if (r > max) { hit.x *= max / r; hit.z *= max / r; }
    return hit;
  }

  /* =====================================================================
     Frame
     ===================================================================== */
  updateLine() {
    const tip = this._tip = this._tip || V3();
    this.rod.userData.tipHolder.getWorldPosition(tip);
    const N = this.linePts.length;
    const lure = this.lure;
    const belowIce = lure.y < WATER_Y - 0.02;
    const entry = V3(lure.x * 0.25, WATER_Y + 0.01, lure.z * 0.25);
    const pts = this.linePts;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const p = pts[i];
      if (belowIce) {
        const k = 0.30;
        if (t < k) {
          const u = t / k;
          p.lerpVectors(tip, entry, u);
          p.y += Math.sin(u * Math.PI) * -0.012;          // a touch of slack
        } else {
          const u = (t - k) / (1 - k);
          p.lerpVectors(entry, lure, u);
          const sway = Math.sin(u * 3.1 + this.time * 1.5) * 0.006 * u;
          p.x += sway; p.z += sway * 0.6;
        }
      } else {
        p.lerpVectors(tip, lure, t);
        p.y += Math.sin(t * Math.PI) * -0.02;
      }
    }
    this.lineCore.setPoints(pts);
    this.lineOutline.setPoints(pts);
  }

  update(dt) {
    this.time += dt;
    this.phaseT += dt;
    const p = this.pointer;

    // circular gestures are measured around the auger's own axis
    let pivotX, pivotY;
    if (this.phase === 'drill') {
      const hub = this.auger.localToWorld(this.auger.userData.hubLocal.clone());
      const s = hub.project(this.camera);
      pivotX = (s.x * 0.5 + 0.5) * window.innerWidth;
      pivotY = (-s.y * 0.5 + 0.5) * window.innerHeight;
      this.ui.ringAt(pivotX, pivotY);
      p.setPivot(pivotX, pivotY);
    } else {
      p.setPivot(null);
    }
    p.update(dt);

    switch (this.phase) {
      case 'drill': this.updateDrill(dt); break;
      case 'breaking': this.updateBreaking(dt); break;
      case 'scoop': this.updateScoop(dt); break;
      case 'fishing': this.updateFishing(dt); break;
      case 'bite': this.updateBite(dt); break;
      case 'pulling': this.updatePulling(dt); break;
      case 'popping': this.updatePopping(dt); break;
      case 'celebrate': if (this.phaseT > 2.4) this.reDrop(); break;
      case 'dropping':
        // the rig sinks with the camera as it follows the line down
        this.lure.y = lerp(this.lure.y, this.lureRest, 1 - Math.pow(0.28, dt));
        break;
      default: break;
    }
    if (this.phase === 'boot') this.bootDrift();

    if (this.scoopStow) {
      const k = Math.min(1, (this.scoopStow.t += dt / 0.9));
      const e = 1 - Math.pow(1 - k, 2.2);
      this.scoop.position.lerpVectors(this.scoopStow.from, SCOOP_STOW, e);
      this.scoop.position.y += Math.sin(e * Math.PI) * 0.12;
      this.scoop.rotation.set(lerp(-0.15, -1.42, e), lerp(0, 1.1, e), lerp(0, 0.3, e));
      if (k >= 1) this.scoopStow = null;
    }
    this.updateSlushPieces(dt);
    this.rig3.position.copy(this.lure);
    this.rig3.rotation.z = Math.sin(this.time * 2.2) * 0.12;
    this.updateLine();

    // fish
    const lureActive = ['fishing', 'bite'].includes(this.phase) ||
      (this.phase === 'dropping' && this.lure.y < WATER_Y - 0.3);
    for (const f of this.fish) {
      if (!f.obj.visible) continue;
      if (f === this.hooked || (this.flying && f === this.flying.f)) { f.u.uTime.value = this.time; continue; }
      f.update(dt, this.time, lureActive ? this.lure : null, this.jig);
    }

    // --- above / below the water -------------------------------------
    const camY = this.camera.position.y;
    const target = clamp((WATER_Y + 0.05 - camY) / 0.30, 0, 1);
    const prev = this.under;
    this.under = lerp(this.under, target, 1 - Math.pow(0.0005, dt));
    if (prev < 0.5 && this.under >= 0.5) { this.fx.bubbles(this.camera.position, 12, 0.3); this.snd.bubble(); }
    if (prev > 0.5 && this.under <= 0.5) { this.snd.splash(0.25); }

    const u = this.under;
    this.scene.fog.color.copy(this.fogAir).lerp(this.fogWater, u);
    this.scene.fog.density = lerp(0.0016, 0.235, u);
    this.sky.material.uniforms.uUnder.value = u;
    this.mountains.visible = u < 0.9;
    this.snowfall.visible = u < 0.5;
    this.snd.setUnderwater(u);
    this.renderer.toneMappingExposure = lerp(1.12, 1.32, u);
    this.rig.sway = lerp(1, 0.5, u);

    // the line has to be visible against snow AND against dark water
    this.lineCore.color.setHex(0xf4fbff).lerp(new THREE.Color(0xd8f2ff), u);
    this.lineOutline.material.uniforms.uOpacity.value = lerp(0.5, 0.32, u);

    // --- shaders / lights --------------------------------------------
    this.waterTop.material.uniforms.uTime.value = this.time;
    const rip = this.waterTop.material.uniforms.uRipple;
    rip.value = Math.max(0, rip.value - dt * 0.85);
    this.skyWindow.material.uniforms.uTime.value = this.time;
    this.shaft.material.uniforms.uTime.value = this.time;
    this.lureLight.position.copy(this.lure);
    this.lureLight.intensity = lerp(this.lureLight.intensity, this.rig3.visible ? 0.9 : 0, dt * 3);
    this.rig3.userData.glow.material.opacity = (0.12 + 0.10 * Math.sin(this.time * 3)) * u;

    this.sun.target.position.set(0, 0, 0);
    this.sun.position.copy(SKY.sunDir).multiplyScalar(28);

    // --- particles ---------------------------------------------------
    this.updateSnowfall(dt);
    this.updatePlankton(dt);
    this.fx.update(dt);
    this.breath.update(dt, this.camera, u < 0.2 &&
      ['drill', 'scoop', 'breaking', 'popping', 'celebrate', 'approach'].includes(this.phase));

    this.rig.update(dt, this.time);
    p.endFrame();
  }

  /* the title screen slowly drifts across the lake so it is never a still image */
  bootDrift() {
    const s = SHOTS.vista, a = this.time * 0.033;
    const off = this.shotPos(s).sub(s.look);
    const c = Math.cos(a), sn = Math.sin(a);
    this.rig.pos.set(
      s.look.x + off.x * c - off.z * sn,
      s.look.y + off.y + Math.sin(this.time * 0.21) * 0.05,
      s.look.z + off.x * sn + off.z * c);
    this.rig.look.copy(s.look);
  }

  updateSnowfall(dt) {
    if (!this.snowfall.visible) return;
    const pos = this.snowfall.geometry.attributes.position;
    const vel = this.snowfall.userData.vel;
    const c = this.camera.position;
    for (let i = 0; i < vel.length; i++) {
      const v = vel[i];
      let y = pos.getY(i) - v.y * dt;
      let x = pos.getX(i) + Math.sin(this.time * v.sp + v.ph) * 0.09 * dt + 0.05 * dt;
      let z = pos.getZ(i) + Math.cos(this.time * v.sp * 0.8 + v.ph) * 0.09 * dt;
      if (y < c.y - 2.2) { y = c.y + 7; }
      if (x - c.x > 13) x -= 26; if (x - c.x < -13) x += 26;
      if (z - c.z > 13) z -= 26; if (z - c.z < -13) z += 26;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  updatePlankton(dt) {
    if (!this.plankton.visible) return;
    const pos = this.plankton.geometry.attributes.position;
    const ph = this.plankton.userData.ph;
    for (let i = 0; i < ph.length; i++) {
      const h = ph[i];
      pos.setX(i, pos.getX(i) + Math.sin(this.time * 0.32 * h.s + h.a) * 0.024 * dt);
      pos.setY(i, pos.getY(i) + (0.012 + Math.sin(this.time * 0.2 + h.b) * 0.01) * dt);
      pos.setZ(i, pos.getZ(i) + Math.cos(this.time * 0.28 * h.s + h.b) * 0.024 * dt);
      if (pos.getY(i) > WATER_Y - 0.32) pos.setY(i, WATER_Y - 4.4);
    }
    pos.needsUpdate = true;
  }

  loop() {
    requestAnimationFrame(this.loop);
    const now = performance.now() / 1000;
    const dt = this.fixedStep || Math.min(now - this._last, 0.05);
    this._last = now;
    this.frames++;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  }

  /* keep 60fps on a phone by trading resolution, never detail */
  adapt(dt) {
    if (this.dprFixed) return;
    this._acc = (this._acc || 0) + dt;
    this._n = (this._n || 0) + 1;
    if (this._n < 50) return;
    const avg = this._acc / this._n;
    this._acc = 0; this._n = 0;
    if (avg > 0.023 && this.dpr > 1.0) {
      this.dpr = Math.max(1.0, this.dpr - 0.2); this.resize();
    } else if (avg < 0.0135 && this.dpr < this.dprCap) {
      this.dpr = Math.min(this.dprCap, this.dpr + 0.2); this.resize();
    }
  }
}

function fail(msg) {
  const sub = document.getElementById('startSub');
  const btn = document.getElementById('startBtn');
  if (sub) sub.textContent = msg;
  if (btn) btn.style.display = 'none';
}
window.addEventListener('error', e => fail('うまく うごきませんでした: ' + (e.message || e)));

let game = null;
try {
  game = new Game();
} catch (err) {
  console.error(err);
  fail('この ブラウザでは 3D(WebGL)が つかえないようです。');
}
// exposed for debugging / automated playtests
window.__game = game;
window.__THREE = THREE;
