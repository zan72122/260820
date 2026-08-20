/**
 * スイカわり — game logic.
 *
 * The chain the whole design serves:
 *   see the melon → lose sight → listen → guess a direction → walk →
 *   one strike → the green shell opens and the red inside appears.
 *
 * Two moments are the stars, and everything else is staging for them:
 *   1. "you can't see, so you look with your ears"  (search phase)
 *   2. "the last hit reveals the inside"            (reveal phase)
 */
import * as THREE from 'three';
import { buildEnvironment, buildSheet, contactShadow, sandHeight } from './world/environment.js';
import { buildWhole, buildBroken, MELON } from './world/watermelon.js';
import { buildCharacter, buildStick, buildBlindfoldBand, updateCharacter } from './world/characters.js';
import { Blindfold } from './blindfold.js';
import { CameraDirector } from './camera.js';
import { makeRng } from './textures.js';
import { WORD_TEXT } from './audio.js';

const UP = new THREE.Vector3(0, 1, 0);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c = 1.35; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

const STRIKE_RADIUS = 1.22;
const STEP_LENGTH = 1.20;
const SWING_IMPACT = 0.50;      // seconds into the swing that the stick lands
const SWING_TOTAL = 1.05;

/** Per-round difficulty. The first round is heavily assisted, on purpose. */
const ROUNDS = [
  { assist: 0.55, offset: [0.28, 0.90], dist: [5.0, 5.8] },
  { assist: 0.42, offset: [0.55, 1.40], dist: [5.2, 6.2] },
  { assist: 0.32, offset: [0.80, 1.85], dist: [5.4, 6.6] },
];

export class Game {
  constructor({ canvas, audio, ui, quality }) {
    this.canvas = canvas;
    this.audio = audio;
    this.ui = ui;
    this.q = quality;

    this.phase = 'intro';
    this.phaseT = 0;
    this.round = 0;
    this.time = 0;
    this.paused = true;

    this.avatar = { pos: new THREE.Vector3(), yaw: 0, bob: 0 };
    this.walk = null;
    this.turnVel = 0;
    this.melonPos = new THREE.Vector3();
    this.stats = { steps: 0, turns: 0 };
  }

  /* ================================================================ *
   * setup
   * ================================================================ */

  async init() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.q.e2e,
      powerPreference: 'high-performance',
      alpha: false,
      // automated runs sample the canvas after compositing
      preserveDrawingBuffer: !!this.q.e2e,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.78;
    renderer.shadowMap.enabled = this.q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 900);
    this.director = new CameraDirector(this.camera);

    this.env = buildEnvironment(this.scene, renderer, this.q);

    /* --- picnic sheet + melon --- */
    this.sheet = buildSheet(this.q);
    this.scene.add(this.sheet);

    this.melonWhole = buildWhole(this.q);
    this.melonWhole.castShadow = true;
    this.scene.add(this.melonWhole);

    this.melonBroken = buildBroken(this.q, 20260820, 3);
    this.melonBroken.visible = false;
    this.scene.add(this.melonBroken);

    this.melonShadow = contactShadow(0.21, 0.38);
    this.scene.add(this.melonShadow);

    this.juice = this._buildJuice();
    if (this.juice) this.scene.add(this.juice.mesh);
    this.puddle = contactShadow(0.42, 0.0);
    this.puddle.material.color = new THREE.Color(0x2a0308);   // juice darkening the sheet
    this.scene.add(this.puddle);

    /* --- people --- */
    this.player = buildCharacter({ height: 1.42, skin: 0xf0c9a4, outfit: 0x2f6fb5, outfit2: 0xf5f2e8, hair: 0x241a12, seed: 3 });
    this.player.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.scene.add(this.player.root);

    this.band = buildBlindfoldBand(this.player.scale);
    this.band.visible = false;
    this.player.head.add(this.band);

    this.stick = buildStick(this.player.scale);
    this.stickPivot = new THREE.Group();
    this.stickPivot.position.set(
      0.155 * this.player.scale, 0.26 * this.player.scale, 0.09 * this.player.scale);
    this.stickPivot.add(this.stick);
    this.player.torso.add(this.stickPivot);

    const friendSpecs = [
      { height: 1.28, outfit: 0xe4574c, outfit2: 0xffe9c9, hair: 0x2b1c14, skin: 0xf3cfab, voice: { f0: 330, formantScale: 1.24, rate: 1.05 }, seed: 11 },
      { height: 1.16, outfit: 0xf4d03f, outfit2: 0x2e7d5b, hair: 0x1d1410, skin: 0xe8b98d, hat: true, voice: { f0: 300, formantScale: 1.20, rate: 1.0 }, seed: 22 },
      { height: 1.63, outfit: 0x36a3a8, outfit2: 0xffffff, hair: 0x30201a, skin: 0xefc9a6, voice: { f0: 208, formantScale: 1.04, rate: 0.92 }, seed: 33 },
    ];
    this.friends = friendSpecs.map((spec, i) => {
      const ch = buildCharacter(spec);
      ch.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(ch.root);
      return {
        ch, voice: spec.voice, id: `friend${i}`,
        home: new THREE.Vector3(), target: new THREE.Vector3(),
        source: null, lastClap: 0,
      };
    });

    this.blindfold = new Blindfold(renderer, this.q);

    this.cue = { next: 1.2, clapNext: 0.8, lead: 0, wrongFor: 0, relocated: false, lastWord: '' };
    this.break_ = null;
    this.exposure = 1.0;

    this._setupRound(0);
    this.resize();
    // warm the shader cache so the first frame after the tap is not a stutter
    this.renderer.compile(this.scene, this.camera);
    return this;
  }

  _buildJuice() {
    if (!this.q.particles || this.q.dropletCount === 0) return null;
    const n = this.q.dropletCount;
    const geo = new THREE.SphereGeometry(1, 6, 4);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xd8283e, roughness: 0.08, metalness: 0.0,
      clearcoat: 1.0, transparent: true, opacity: 0.9,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false;
    mesh.visible = false;
    const rng = makeRng(4242);
    const state = [];
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const sp = 0.8 + rng() * 2.4;
      state.push({
        p: new THREE.Vector3(), v: new THREE.Vector3(),
        a, sp, up: 1.4 + rng() * 2.6,
        r: 0.005 + rng() * 0.011,
        life: 0,
      });
    }
    return { mesh, state, dummy: new THREE.Object3D(), rng };
  }

  /* ================================================================ *
   * rounds
   * ================================================================ */

  _setupRound(index) {
    this.round = index;
    const cfg = ROUNDS[Math.min(index, ROUNDS.length - 1)];
    this.assist = cfg.assist;
    const rng = makeRng(this.q.e2e ? 12345 : (Date.now() & 0xffff) + index * 7919);
    this.rng = rng;

    // melon sits on the dry sand a little inland of the water line
    const mx = (rng() - 0.5) * 3.0;
    const mz = -2.4 + rng() * 2.6;
    const groundY = sandHeight(mx, mz);
    this.melonPos.set(mx, groundY + MELON.ry + 0.014, mz);

    this.sheet.position.set(mx, groundY + 0.008, mz + 0.06);
    this.sheet.rotation.y = (rng() - 0.5) * 0.7;

    // the player starts inland, so the sea always sits behind the target
    const approach = (rng() - 0.5) * 0.9;                 // radians off +Z
    const dist = cfg.dist[0] + rng() * (cfg.dist[1] - cfg.dist[0]);
    const ax = mx + Math.sin(approach) * dist;
    const az = mz + Math.cos(approach) * dist;
    this.avatar.pos.set(ax, sandHeight(ax, az), az);

    // face roughly at the melon, then twist away so a real correction is needed
    const toMelon = Math.atan2(mx - ax, mz - az);
    const side = rng() < 0.5 ? -1 : 1;
    const off = cfg.offset[0] + rng() * (cfg.offset[1] - cfg.offset[0]);
    this.avatar.yaw = toMelon + side * off;
    this.startYaw = this.avatar.yaw;
    this.walk = null;

    // friends gather on the far side of the melon, so their voices and the
    // melon share a bearing from wherever the player is standing
    const base = Math.atan2(ax - mx, az - mz);            // melon -> player
    const spots = [base + 2.30, base - 2.45, base + 3.00];
    const order = [0, 1, 2].sort(() => (rng() - 0.5));
    this.friends.forEach((f, i) => {
      const a = spots[i] + (rng() - 0.5) * 0.25;
      const r = 1.45 + rng() * 0.85;
      const fx = mx + Math.sin(a) * r;
      const fz = mz + Math.cos(a) * r;
      f.home.set(fx, sandHeight(fx, fz), fz);
      f.target.copy(f.home);
      f.ch.root.position.copy(f.home);
      f.ch.state = 'idle';
      f.ch.intensity = 0;
      f.relocated = false;
    });
    // a different voice leads each round
    this.cue.lead = order[0] % this.friends.length;
    this.cue.next = 1.0;
    this.cue.clapNext = 0.6;
    this.cue.wrongFor = 0;
    this.cue.relocated = false;

    // reset the fruit
    this.melonWhole.visible = true;
    this.melonWhole.position.copy(this.melonPos);
    this.melonWhole.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.12);
    this.melonBroken.visible = false;
    this.melonBroken.position.copy(this.melonPos);
    this.melonBroken.rotation.set(0, 0, 0);
    this.melonShadow.position.set(mx, groundY + 0.006, mz);
    this.melonShadow.material.opacity = 0.38;
    this.puddle.material.opacity = 0;
    this.puddle.position.set(mx, groundY + 0.008, mz);
    if (this.juice) this.juice.mesh.visible = false;
    this.break_ = null;
    this._resetChunks();

    this.band.visible = false;
    this.blindfold.amount = 0;
    this.player.state = 'idle';
    this.player.swing = 0;
    this.stickPivot.rotation.set(-0.70, 0, -0.22);
    this.stickPivot.visible = true;

    this._setPhase('show');
    this.director.setShot('look');
    this.director.reset(this._camCtx());
  }

  _resetChunks() {
    for (const c of this.melonBroken.userData.chunks) {
      c.position.set(0, 0, 0);
      c.quaternion.identity();
      c.visible = true;
    }
    const seeds = this.melonBroken.userData.seeds;
    seeds.mesh.visible = false;
  }

  _setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
    this.ui.onPhase?.(p, this.round);
  }

  start() {
    this.paused = false;
    this.friends.forEach((f) => { f.source = this.audio.createSource(f.id); });
    if (this.phase === 'intro') this._setupRound(0);
  }

  /* ================================================================ *
   * player actions (called by TouchControls)
   * ================================================================ */

  turn(delta) {
    if (this.phase !== 'search' && this.phase !== 'aim') return;
    this.avatar.yaw += delta;
    this.stats.turns++;
  }

  step(power = 1) {
    if ((this.phase !== 'search' && this.phase !== 'aim') || this.walk) return;
    const a = this.avatar;
    const dx = this.melonPos.x - a.pos.x;
    const dz = this.melonPos.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    const err = wrapPi(desired - a.yaw);

    // path assistance: nudge the *walk* towards the fruit, never the facing.
    // The voices must stay the only thing that tells you where to turn.
    let dir = a.yaw;
    if (Math.abs(err) < 1.30) dir = a.yaw + err * this.assist;

    let len = STEP_LENGTH * power;
    // stop just short instead of walking over the melon
    if (Math.abs(wrapPi(desired - dir)) < 0.9) len = Math.min(len, Math.max(0.28, dist - 0.78));

    const nx = a.pos.x + Math.sin(dir) * len;
    const nz = a.pos.z + Math.cos(dir) * len;
    // keep everybody on the dry sand
    const clamped = new THREE.Vector3(
      THREE.MathUtils.clamp(nx, -11, 11), 0,
      THREE.MathUtils.clamp(nz, -11, 11),
    );
    clamped.y = sandHeight(clamped.x, clamped.z);

    this.walk = {
      from: a.pos.clone(), to: clamped, t: 0,
      dur: Math.max(0.55, len / 1.35), stepped: 0,
    };
    this.stats.steps++;
  }

  strike(power = 1) {
    if (this.phase !== 'aim' || this.walk) return;
    this._setPhase('swing');
    // the one automatic camera adjustment in the game, and only for the strike
    this.director.setShot('ready');
    this.swingT = 0;
    this.swingPower = power;
    this.player.state = 'swing';
    this.player.swing = 0;
    this.audio.whoosh(0.3);
  }

  strikeTooEarly() {
    if (this.phase !== 'search' || this.walk) return;
    // an honest miss: the stick hits sand, and a friend cheers you on
    this._setPhase('miss');
    this.swingT = 0;
    this.player.state = 'swing';
    this.player.swing = 0;
    this.audio.whoosh(0.34);
  }

  /* ================================================================ *
   * per-frame
   * ================================================================ */

  update(dt) {
    if (this.paused) return;
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    this.phaseT += dt;
    this.env.update(this.time);

    this._updateWalk(dt);
    this._updatePhase(dt);
    this._updateAvatar(dt);
    this._updateFriends(dt);
    this._updateAudioSpace();
    this._updateBreak(dt);

    this.blindfold.sway = this.avatar.bob * 6 + this.turnVel;
    this.director.update(dt, this._camCtx());

    // eyes adjusting to the sun the instant the cloth comes off
    this.renderer.toneMappingExposure = THREE.MathUtils.damp(
      this.renderer.toneMappingExposure, 0.78, 3.2, dt);
  }

  _camCtx() {
    return {
      avatarPos: this.avatar.pos,
      avatarYaw: this.avatar.yaw,
      headY: this.avatar.pos.y + this.player.headY,
      melonPos: this.melonPos,
      bob: this.avatar.bob,
      aspect: this.camera.aspect,
      breakPoint: this.melonPos,
    };
  }

  _updateWalk(dt) {
    const a = this.avatar;
    if (!this.walk) { a.bob = THREE.MathUtils.damp(a.bob, 0, 8, dt); return; }
    const w = this.walk;
    w.t += dt;
    const t = Math.min(1, w.t / w.dur);
    const e = easeOutCubic(t);
    a.pos.lerpVectors(w.from, w.to, e);
    a.pos.y = sandHeight(a.pos.x, a.pos.z);
    // deliberately tiny: a four-year-old must not get motion sick
    a.bob = Math.sin(t * Math.PI * 2.4) * 0.016 * (1 - t * 0.4);
    const stepsTaken = Math.floor(t * 2.4);
    if (stepsTaken > w.stepped) { w.stepped = stepsTaken; this.audio.footstep(); }
    if (t >= 1) { this.walk = null; a.bob = 0; }
  }

  _updateAvatar(dt) {
    const p = this.player;
    p.root.position.copy(this.avatar.pos);
    p.root.position.y += this.avatar.bob;
    p.root.rotation.y = this.avatar.yaw;

    if (this.phase === 'swing' || this.phase === 'miss') {
      p.state = 'swing';
    } else if (this.walk) {
      p.state = 'walk';
    } else if (this.phase === 'aim') {
      p.state = 'ready';
    } else if (this.phase === 'reveal' || this.phase === 'wide' || this.phase === 'again') {
      p.state = 'cheer';
    } else {
      p.state = 'idle';
    }
    updateCharacter(p, this.time, dt);

    // At rest the stick hangs low and to the side: held up in front it becomes
    // a black bar across the middle of the blindfolded view.
    const swinging = this.phase === 'swing' || this.phase === 'miss';
    const s = p.swing;
    this.stickPivot.rotation.x = swinging
      ? THREE.MathUtils.lerp(-2.45, 1.10, s)
      : THREE.MathUtils.damp(this.stickPivot.rotation.x, -0.70, 7, dt);
    if (this.phase === 'swing') {
      const dx = this.melonPos.x - this.avatar.pos.x;
      const dz = this.melonPos.z - this.avatar.pos.z;
      const err = wrapPi(Math.atan2(dx, dz) - this.avatar.yaw);
      // last-moment aim assist so the first strike always connects
      this.stickPivot.rotation.z = THREE.MathUtils.damp(
        this.stickPivot.rotation.z, -err * 0.85, 9, dt);
      this.stickPivot.rotation.y = THREE.MathUtils.damp(
        this.stickPivot.rotation.y, err * 0.5, 9, dt);
    } else {
      const restZ = swinging ? 0 : -0.22;
      this.stickPivot.rotation.z = THREE.MathUtils.damp(this.stickPivot.rotation.z, restZ, 6, dt);
      this.stickPivot.rotation.y = THREE.MathUtils.damp(this.stickPivot.rotation.y, 0, 6, dt);
    }
  }

  _updateFriends(dt) {
    for (const f of this.friends) {
      const ch = f.ch;
      // always turned towards the player they are guiding
      const dx = this.avatar.pos.x - ch.root.position.x;
      const dz = this.avatar.pos.z - ch.root.position.z;
      ch.root.rotation.y = THREE.MathUtils.damp(
        ch.root.rotation.y, Math.atan2(dx, dz), 4, dt);

      if (ch.root.position.distanceToSquared(f.target) > 0.0025) {
        ch.root.position.lerp(f.target, Math.min(1, dt * 1.6));
        ch.root.position.y = sandHeight(ch.root.position.x, ch.root.position.z);
        ch.state = 'walk';
      } else if (ch.state === 'walk') {
        ch.state = 'idle';
      }
      updateCharacter(ch, this.time, dt);
    }
  }

  /** Feed every voice its live bearing so turning changes what you hear. */
  _updateAudioSpace() {
    const a = this.avatar;
    for (const f of this.friends) {
      if (!f.source) continue;
      const dx = f.ch.root.position.x - a.pos.x;
      const dz = f.ch.root.position.z - a.pos.z;
      const dist = Math.max(0.4, Math.hypot(dx, dz));
      const relLeft = wrapPi(Math.atan2(dx, dz) - a.yaw);
      // audio wants "+ = right"
      f.source.setSpatial(-relLeft, dist, f.boost || 1);
      f.rel = relLeft;
      f.dist = dist;
    }
  }

  /* ---------------- phase machine ---------------- */

  _updatePhase(dt) {
    switch (this.phase) {
      case 'show':
        // 3 seconds to burn the melon's position into memory
        if (this.phaseT > 0.55 && !this._greeted) {
          this._greeted = true;
          this._say(this.friends[this.cue.lead], 'hai', { excitement: 0.15 });
        }
        if (this.phaseT > 3.0) {
          this._greeted = false;
          this._setPhase('tie');
          this.band.visible = true;
        }
        break;

      case 'tie': {
        // the cloth comes down over the camera; sight goes, hearing takes over
        const t = THREE.MathUtils.clamp((this.phaseT - 0.15) / 0.85, 0, 1);
        this.blindfold.amount = easeOutCubic(t);
        if (this.phaseT > 0.25) this.director.setShot('blind');
        if (this.phaseT > 1.25) {
          this._setPhase('search');
          this.cue.next = 0.35;      // call almost immediately: teach the rule
        }
        break;
      }

      case 'search':
      case 'aim':
        this._updateSearch(dt);
        break;

      case 'swing': {
        this.swingT += dt;
        const s = this.swingT;
        // wind up, then a fast fall
        this.player.swing = s < 0.30
          ? 0
          : THREE.MathUtils.clamp((s - 0.30) / 0.26, 0, 1);
        if (!this.break_ && s >= SWING_IMPACT) this._doBreak();
        if (s > SWING_TOTAL) this._setPhase('reveal');
        break;
      }

      case 'miss': {
        this.swingT += dt;
        this.player.swing = this.swingT < 0.30 ? 0
          : THREE.MathUtils.clamp((this.swingT - 0.30) / 0.26, 0, 1);
        if (this.swingT > SWING_IMPACT && !this._missSfx) {
          this._missSfx = true;
          this.audio.footstep(2.2);
          this.director.shake(0.25);
          const f = this.friends[this.cue.lead];
          this._say(f, 'ganbare', { excitement: 0.35 });
        }
        if (this.swingT > SWING_TOTAL) {
          this._missSfx = false;
          this.player.state = 'idle';
          this._setPhase('search');
          this.cue.next = 0.5;
        }
        break;
      }

      case 'reveal':
        if (this.phaseT > 2.7) {
          this._setPhase('wide');
          this.director.setShot('wide');
        }
        break;

      case 'wide':
        if (this.phaseT > 1.4 && !this._cheered2) {
          this._cheered2 = true;
          this._say(this.friends[(this.cue.lead + 2) % 3], 'sugoi', { excitement: 0.8 });
        }
        if (this.phaseT > 3.4) {
          this._cheered2 = false;
          this._setPhase('again');
        }
        break;

      default:
        break;
    }
  }

  /* ---------------- the listening game ---------------- */

  _updateSearch(dt) {
    const a = this.avatar;
    const dx = this.melonPos.x - a.pos.x;
    const dz = this.melonPos.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    const relLeft = wrapPi(Math.atan2(dx, dz) - a.yaw);
    const off = Math.abs(relLeft);
    this.searchInfo = { dist, relLeft };

    const inZone = dist < STRIKE_RADIUS && !this.walk;

    if (inZone && this.phase !== 'aim') {
      // "the voices go quiet for a moment" — the cue that it is time to swing
      this._setPhase('aim');
      this.audio.hush(0.16, 0.3);
      this.controls && (this.controls.allowStrike = true);
      this._aimCalled = false;
      return;
    }
    if (!inZone && this.phase === 'aim') {
      this._setPhase('search');
      this.audio.unhush();
      this.controls && (this.controls.allowStrike = false);
      return;
    }

    if (this.phase === 'aim') {
      if (!this._aimCalled && this.phaseT > 0.85) {
        this._aimCalled = true;
        this._say(this.friends[this.cue.lead], 'imada', { excitement: 1.0, gain: 0.9 });
      }
      return;
    }

    /* ---- band: how close, how well aimed ---- */
    const band = dist > 4.2 ? 'far' : dist > 2.2 ? 'mid' : 'near';
    const excitement = THREE.MathUtils.clamp(1 - (dist - 0.9) / 4.2, 0, 1);

    /* ---- persistent clap beacon: a heartbeat you can steer by ---- */
    this.cue.clapNext -= dt;
    if (this.cue.clapNext <= 0) {
      const lead = this.friends[this.cue.lead];
      this.audio.clap(lead.id, 0.32 + excitement * 0.4);
      this.cue.clapNext = THREE.MathUtils.lerp(1.05, 0.34, excitement);
    }

    /* ---- badly wrong for too long: bring a voice closer, never teleport ---- */
    if (off > 1.9) this.cue.wrongFor += dt; else this.cue.wrongFor = Math.max(0, this.cue.wrongFor - dt * 0.6);
    if (this.cue.wrongFor > 3.0 && !this.cue.relocated) {
      this.cue.relocated = true;
      const lead = this.friends[this.cue.lead];
      // step out from behind the melon towards the player: same bearing,
      // shorter distance, much easier to localise
      const toPlayer = new THREE.Vector3(a.pos.x - this.melonPos.x, 0, a.pos.z - this.melonPos.z).normalize();
      const spot = this.melonPos.clone().addScaledVector(toPlayer, 1.05);
      spot.y = sandHeight(spot.x, spot.z);
      lead.target.copy(spot);
      lead.boost = 1.5;
      this.cue.next = Math.min(this.cue.next, 0.5);
    }
    if (this.cue.relocated && off < 0.7) {
      this.cue.relocated = false;
      this.cue.wrongFor = 0;
      const lead = this.friends[this.cue.lead];
      lead.target.copy(lead.home);
      lead.boost = 1;
    }

    /* ---- the calls themselves ---- */
    this.cue.next -= dt;
    if (this.cue.next > 0) return;

    // pick who speaks: whoever sits closest to the direction the player
    // must turn towards, so "the voice moved to the middle" reads as progress
    const ranked = this.friends
      .map((f, i) => ({ f, i, score: Math.abs(wrapPi(f.rel ?? 0) - relLeft) }))
      .sort((p, q) => p.score - q.score);
    const lead = off > 0.6 ? ranked[0].f : this.friends[this.cue.lead];

    let word;
    if (off > 1.9) word = 'ooi';
    else if (off > 0.85) word = this.rng() < 0.5 ? 'koc_chi' : 'kocchi_dayo';
    else if (band === 'far') word = this.rng() < 0.5 ? 'kocchi_dayo' : 'ganbare';
    else if (band === 'mid') word = this.rng() < 0.5 ? 'mou_chotto' : 'sou';
    else word = this.rng() < 0.45 ? 'chikai' : (this.rng() < 0.6 ? 'soko' : 'sokoda');

    this._say(lead, word, { excitement, gain: 0.8 + excitement * 0.35 });

    // close in, more people join in and get louder
    const extras = band === 'near' ? 2 : band === 'mid' ? 1 : 0;
    for (let k = 0; k < extras; k++) {
      const other = this.friends[(this.friends.indexOf(lead) + 1 + k) % this.friends.length];
      const delay = 0.22 + k * 0.19 + this.rng() * 0.12;
      setTimeout(() => {
        if (this.phase !== 'search' && this.phase !== 'aim') return;
        this._say(other, band === 'near' ? (this.rng() < 0.5 ? 'soko' : 'sou') : 'sou',
          { excitement: Math.min(1, excitement + 0.15), gain: 0.6, caption: false });
      }, delay * 1000);
    }

    const base = band === 'far' ? 2.15 : band === 'mid' ? 1.55 : 1.05;
    this.cue.next = base * (off > 1.9 ? 0.62 : 1) + this.rng() * 0.35;
  }

  _say(friend, word, opts = {}) {
    if (!friend) return;
    friend.ch.state = 'call';
    friend.ch.intensity = opts.excitement ?? 0.3;
    friend.ch.callUntil = this.time + 0.9;
    clearTimeout(friend._callTimer);
    friend._callTimer = setTimeout(() => {
      if (friend.ch.state === 'call') friend.ch.state = 'idle';
    }, 900);
    this.audio.speak(friend.id, word, { ...friend.voice, ...opts });
    if (opts.caption !== false) this.ui.caption?.(WORD_TEXT[word] || '');
  }

  /* ================================================================ *
   * the break
   * ================================================================ */

  _doBreak() {
    this.break_ = { t: 0 };
    this.melonWhole.visible = false;
    this.melonBroken.visible = true;
    this.melonShadow.material.opacity = 0.22;

    this.audio.impact();
    this.audio.splash();
    this.audio.unhush(0.2);
    this.director.shake(0.9);
    this.renderer.toneMappingExposure = 1.30;   // sunlight floods back in

    // the cloth is off in a fifth of a second: the whole point of the beat
    this.blindfoldLift = { t: 0, from: this.blindfold.amount };
    setTimeout(() => { this.band.visible = false; }, 190);

    this.director.setShot('hero');

    // authored resting poses: three big pieces, opened like a flower
    const chunks = this.melonBroken.userData.chunks;
    chunks.forEach((c, i) => {
      const sign = i % 2 === 0 ? 1 : -1;
      c.userData.roll = sign * (0.95 + this.rng() * 0.35);
      c.userData.tip = 0.18 + this.rng() * 0.18;
      c.userData.push = 0.10 + this.rng() * 0.09;
      c.userData.spinY = (this.rng() - 0.5) * 0.5;
      c.userData.delay = i * 0.035;
    });

    const seeds = this.melonBroken.userData.seeds;
    seeds.mesh.visible = true;
    seeds.state.forEach((s) => { s.pos = s.p0.clone(); s.vel = s.v.clone(); s.rest = 0; });

    if (this.juice) {
      this.juice.mesh.visible = true;
      this.juice.state.forEach((d) => {
        d.p.set(
          Math.cos(d.a) * 0.04,
          this.melonPos.y - 0.02 + Math.random() * 0.1,
          Math.sin(d.a) * 0.04,
        );
        d.p.x += this.melonPos.x; d.p.z += this.melonPos.z;
        d.v.set(Math.cos(d.a) * d.sp * 0.55, d.up, Math.sin(d.a) * d.sp * 0.55);
        d.life = 1;
      });
    }

    // everybody erupts
    this.friends.forEach((f, i) => {
      f.ch.state = 'cheer';
      f.target.copy(f.home);
      f.boost = 1;
      setTimeout(() => this._say(f, i === 0 ? 'yatta' : i === 1 ? 'waa' : 'sugoi',
        { excitement: 1, gain: 0.95, caption: i === 0 }), 90 + i * 130);
    });
    this.controls && (this.controls.allowStrike = false);
    this.ui.onBreak?.();
  }

  _updateBreak(dt) {
    if (this.blindfoldLift) {
      this.blindfoldLift.t += dt;
      const t = Math.min(1, this.blindfoldLift.t / 0.20);
      this.blindfold.amount = this.blindfoldLift.from * (1 - easeOutCubic(t));
      if (t >= 1) { this.blindfold.amount = 0; this.blindfoldLift = null; }
    }
    if (!this.break_) return;
    const b = this.break_;
    b.t += dt;

    const chunks = this.melonBroken.userData.chunks;
    const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    for (const c of chunks) {
      const u = c.userData;
      const local = Math.max(0, b.t - u.delay);
      const crack = THREE.MathUtils.clamp(local / 0.11, 0, 1);
      const fall = THREE.MathUtils.clamp((local - 0.09) / 0.62, 0, 1);
      const e = fall <= 0 ? 0 : easeOutBack(fall);

      // hairline crack first, then the wedge topples open
      const out = u.out;
      const push = 0.010 * crack + u.push * e;
      const hop = Math.sin(Math.PI * Math.min(1, fall)) * 0.055;
      c.position.set(
        out.x * push,
        -(MELON.ry - 0.082) * e + hop,
        out.z * push,
      );

      // roll about the radial axis so a red face ends up looking upward
      q1.setFromAxisAngle(out, u.roll * e);
      axis.crossVectors(UP, out).normalize();
      q2.setFromAxisAngle(axis, u.tip * e);
      c.quaternion.copy(q1).multiply(q2);
      c.rotateY(u.spinY * e);
    }

    // seeds
    const seeds = this.melonBroken.userData.seeds;
    if (seeds.mesh.visible) {
      const groundLocal = -(MELON.ry) + 0.004;
      for (let i = 0; i < seeds.state.length; i++) {
        const s = seeds.state[i];
        if (s.rest < 1) {
          s.vel.y -= 9.81 * dt;
          s.pos.addScaledVector(s.vel, dt);
          s.rot.x += s.spin.x * dt; s.rot.y += s.spin.y * dt; s.rot.z += s.spin.z * dt;
          if (s.pos.y <= groundLocal) {
            s.pos.y = groundLocal;
            s.vel.multiplyScalar(0.22); s.vel.y = Math.abs(s.vel.y) * 0.3;
            s.spin.multiplyScalar(0.4);
            if (s.vel.length() < 0.12) s.rest = 1;
          }
        }
        seeds.dummy.position.copy(s.pos);
        seeds.dummy.rotation.copy(s.rot);
        seeds.dummy.updateMatrix();
        seeds.mesh.setMatrixAt(i, seeds.dummy.matrix);
      }
      seeds.mesh.instanceMatrix.needsUpdate = true;
    }

    // juice
    if (this.juice && this.juice.mesh.visible) {
      const groundY = this.melonPos.y - MELON.ry + 0.006;
      let alive = 0;
      for (let i = 0; i < this.juice.state.length; i++) {
        const d = this.juice.state[i];
        if (d.life > 0) {
          d.v.y -= 9.81 * dt;
          d.p.addScaledVector(d.v, dt);
          if (d.p.y <= groundY) { d.p.y = groundY; d.life -= dt * 3.5; d.v.set(0, 0, 0); }
          else alive++;
          d.life -= dt * 0.35;
        }
        const s = Math.max(0.0001, d.r * THREE.MathUtils.clamp(d.life, 0, 1));
        this.juice.dummy.position.copy(d.p);
        this.juice.dummy.scale.setScalar(s);
        this.juice.dummy.updateMatrix();
        this.juice.mesh.setMatrixAt(i, this.juice.dummy.matrix);
      }
      this.juice.mesh.instanceMatrix.needsUpdate = true;
      if (alive === 0 && b.t > 2.5) this.juice.mesh.visible = false;
    }

    // juice soaking into the sheet
    this.puddle.material.opacity = THREE.MathUtils.clamp((b.t - 0.25) * 0.20, 0, 0.20);
    this.puddle.scale.setScalar(THREE.MathUtils.clamp(0.4 + b.t * 0.40, 0.4, 0.95));
  }

  /* ================================================================ *
   * frame
   * ================================================================ */

  render(dt) {
    this.blindfold.render(this.scene, this.camera, dt);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.pixelRatioCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.blindfold.setSize(w, h, dpr);
  }

  /** Start the next round from the replay button. */
  replay() {
    this._setupRound(this.round + 1);
  }

  /* ---- deterministic hooks for automated runs ---- */
  debugState() {
    return {
      phase: this.phase,
      round: this.round,
      blindfold: +this.blindfold.amount.toFixed(3),
      avatar: { x: +this.avatar.pos.x.toFixed(2), z: +this.avatar.pos.z.toFixed(2), yaw: +this.avatar.yaw.toFixed(3) },
      melon: { x: +this.melonPos.x.toFixed(2), z: +this.melonPos.z.toFixed(2) },
      distance: +Math.hypot(this.melonPos.x - this.avatar.pos.x, this.melonPos.z - this.avatar.pos.z).toFixed(2),
      bearing: this.searchInfo ? +this.searchInfo.relLeft.toFixed(3) : 0,
    };
  }
}
