import {
  Scene, PerspectiveCamera, WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping,
  PCFSoftShadowMap, WebGLCubeRenderTarget, CubeCamera, PMREMGenerator, HalfFloatType,
  Vector3, Vector2, Color, PointLight, Euler, Quaternion, MathUtils, Group,
} from 'three';
import { Environment, SUN_DIR } from '../scene/Environment.js';
import { Machine, M } from '../scene/Machine.js';
import { IceBlock } from '../scene/IceBlock.js';
import { makeBowl, BOWL } from '../scene/Bowl.js';
import { Mound } from '../scene/Mound.js';
import { Flakes } from '../scene/Flakes.js';
import { SyrupStage } from '../scene/Syrup.js';
import { SyrupSim } from '../materials/syrupSim.js';
import { CameraRig, SHOTS } from './CameraRig.js';
import { Input } from './Input.js';
import { Audio } from '../audio/Audio.js';
import { iceVolume, shavedIceMaps, skyEquirect } from '../util/procTextures.js';

const S = {
  IDLE: 'idle',            // the machine just sits there, and is a question
  ENGAGING: 'engaging',    // turning, but the ice has not caught yet
  FIRST: 'first',          // the single first flake, held on its own beat
  SHAVING: 'shaving',
  TO_SYRUP: 'to_syrup',
  SYRUP: 'syrup',
  FINISH: 'finish',
  CLEARING: 'clearing',
};

const SLACK = 1.9;             // radians of handle before the claws bite
const FIRST_ICE_ROT = 1.15;    // then this much ice rotation before the first flake
const TICK_STEP = (Math.PI * 2) / 24;
const CUT_DEPTH = 0.00240;     // metres of ice off the block per radian-metre of blade

function pickQuality() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('q');
  const fast = params.get('fast') === '1' || window.__E2E_FAST === true;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory || (coarse ? 4 : 8);
  let tier = coarse ? (mem >= 6 ? 'mid' : 'low') : 'high';
  if (forced) tier = forced;
  if (fast) tier = 'low';

  const base = {
    low: {
      tier: 'low', paintTex: 512, moundGrid: 64, flakeCount: 110, transmission: false,
      shadowMap: 1024, iceSteps: 4, syrupSize: 96, bowlSegments: 44, bottleSegments: 18,
      dropCount: 14, sheen: false, flakeShadows: false, maxDpr: 1.25, antialias: false,
    },
    mid: {
      tier: 'mid', paintTex: 1024, moundGrid: 80, flakeCount: 190, transmission: true,
      shadowMap: 1024, iceSteps: 6, syrupSize: 128, bowlSegments: 64, bottleSegments: 24,
      dropCount: 26, sheen: true, flakeShadows: false, maxDpr: 1.75, antialias: true,
    },
    high: {
      tier: 'high', paintTex: 1024, moundGrid: 96, flakeCount: 260, transmission: true,
      shadowMap: 2048, iceSteps: 8, syrupSize: 160, bowlSegments: 96, bottleSegments: 32,
      dropCount: 40, sheen: true, flakeShadows: true, maxDpr: 2, antialias: true,
    },
  }[tier] || null;
  const q = base || {
    tier: 'mid', paintTex: 1024, moundGrid: 80, flakeCount: 190, transmission: true,
    shadowMap: 1024, iceSteps: 6, syrupSize: 128, bowlSegments: 64, bottleSegments: 24,
    dropCount: 26, sheen: true, flakeShadows: false, maxDpr: 1.75, antialias: true,
  };
  q.fast = fast;
  if (fast) { q.maxDpr = 1; q.shadowMap = 512; }
  return q;
}

export class Game {
  constructor(host) {
    this.host = host;
    this.quality = pickQuality();
    const q = this.quality;

    this.renderer = new WebGLRenderer({
      antialias: q.antialias, powerPreference: 'high-performance',
      alpha: false, stencil: false, depth: true,
    });
    this.baseDpr = Math.min(window.devicePixelRatio || 1, q.maxDpr);
    this.renderScale = 1;
    this.renderer.setPixelRatio(this.baseDpr);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    if ('transmissionResolutionScale' in this.renderer) {
      this.renderer.transmissionResolutionScale = q.tier === 'high' ? 0.8 : 0.6;
    }
    host.appendChild(this.renderer.domElement);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(38, 1, 0.03, 60);
    this.scene.add(this.camera);

    // temporary image-based light until the shop itself is captured
    const pmremTmp = new PMREMGenerator(this.renderer);
    const sky = skyEquirect(384);
    this._bootEnv = pmremTmp.fromEquirectangular(sky);
    this.scene.environment = this._bootEnv.texture;
    sky.dispose(); pmremTmp.dispose();

    this.env = new Environment(this.scene, q);

    // a light that never actually lights anything except the one glint on the
    // chrome while the machine is waiting to be understood
    this.glint = new PointLight(new Color(1, 0.97, 0.9), 0, 0.55, 2);
    this.glint.position.set(0.22, 0.50, 0.20);
    this.glint.castShadow = false;
    this.scene.add(this.glint);

    // everything bolted together shares one node, so the faint kick-back of the
    // handle carries the block with the frame instead of shearing it off
    this.rig3d = new Group();
    this.scene.add(this.rig3d);
    this.machine = new Machine(this.rig3d, q);
    this.iceVol = iceVolume(q.tier === 'low' ? 48 : 64);
    this.ice = new IceBlock(this.rig3d, { volume: this.iceVol, envMap: null, sun: SUN_DIR, quality: q });
    this.bowl = makeBowl(this.scene, q);

    const iceMaps = shavedIceMaps(q.tier === 'low' ? 256 : 512);
    this.mound = new Mound(this.scene, {
      quality: q, syrupSurf: null, syrupSoak: null,
      iceNormal: iceMaps.normalMap, sparkle: iceMaps.sparkleMap, clump: iceMaps.clumpMap,
      envMap: null, sun: SUN_DIR,
    });
    this.sim = new SyrupSim(this.renderer, {
      size: q.syrupSize, cell: this.mound.cell, heightTex: this.mound.tex,
    });
    const mu = this.mound.material.userData.uniforms;
    mu.tSurf.value = this.sim.surfTexture;
    mu.tSoak.value = this.sim.soakTexture;

    this.flakes = new Flakes(this.scene, { count: q.flakeCount, mound: this.mound, quality: q });
    this.syrup = new SyrupStage(this.scene, { quality: q, mound: this.mound });

    this.rig = new CameraRig(this.camera);
    this.input = new Input(this.renderer.domElement, this.camera);
    this.input.bottles = this.syrup.bottles;
    this.audio = new Audio();

    this._resetRun(true);
    this.time = 0;
    this.frameTimes = [];
    this._peak = new Vector3();
    this._q = new Quaternion();
    this._e = new Euler();
    this._v = new Vector3();
    this.onState = () => {};

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 220));
    this.resize();
  }

  _resetRun(hard) {
    this.state = S.IDLE;
    this.stateT = 0;
    this.crankAngle = 0;
    this.crankVel = 0;
    this.omega = 0;
    this.iceLocked = false;
    this.slackUsed = 0;
    this.lockAngle = 0;
    this.iceAngle = 0;
    this.tickAcc = 0;
    this.iceRotSinceLock = 0;
    this.firstFlakeDone = false;
    this.firstFlakeAt = -10;
    this.leftover = 0;
    this.flakeAcc = 0;
    this.idleTouched = false;
    this.glintDone = false;
    this.poured = 0;
    this.shaveNow = 0;
    this.lastLanding = 0;
    this.idleQuiet = 0;
    this.input.mode = 'crank';
    this.input.enabledCrank = true;
    if (this.onState) this.onState(S.IDLE);
    if (hard) return;
    this.mound.reset();
    this.flakes.reset();
    this.syrup.reset();
    this.sim.clear(this.renderer);
    if (this.ice.wornFraction > 0.8) this.ice.height = this.ice.h0;
  }

  /** One-time capture of the shop for reflections in the chrome, ice and glass. */
  captureEnvironment() {
    const hide = [this.machine.group, this.ice.mesh, this.ice.puddle, this.bowl.mesh, this.mound.mesh, this.flakes.mesh, this.syrup.stream, this.syrup.drops];
    for (const b of this.syrup.bottles) hide.push(b.group);
    const was = hide.map((o) => o.visible);
    hide.forEach((o) => { o.visible = false; });
    const shadowsWere = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = false;

    const rt = new WebGLCubeRenderTarget(this.quality.tier === 'low' ? 128 : 256, { type: HalfFloatType });
    const cam = new CubeCamera(0.05, 40, rt);
    cam.position.set(0, 0.26, 0.20);
    this.scene.add(cam);
    cam.update(this.renderer, this.scene);
    this.scene.remove(cam);

    const pmrem = new PMREMGenerator(this.renderer);
    const target = pmrem.fromCubemap(rt.texture);
    this.scene.environment = target.texture;
    if (this._bootEnv) { this._bootEnv.dispose(); this._bootEnv = null; }
    pmrem.dispose();
    rt.dispose();

    this.renderer.shadowMap.enabled = shadowsWere;
    hide.forEach((o, i) => { o.visible = was[i]; });
    this.mound.mesh.visible = this.mound.volume > 0;
  }

  resize() {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.baseDpr * this.renderScale);
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.portrait = h > w;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- the chain
  /** x-range where the turning block is actually over the blade, in world x. */
  contactSpan(theta) {
    const a = M.iceSize.x * 0.5 * 0.97;
    const d = M.bladeZ - M.iceCenter.z;
    const c = Math.cos(theta), s = Math.sin(theta);
    let lo = -Infinity, hi = Infinity;
    if (Math.abs(c) > 1e-4) {
      const p = (-a - d * s) / c, q = (a - d * s) / c;
      lo = Math.max(lo, Math.min(p, q)); hi = Math.min(hi, Math.max(p, q));
    } else if (Math.abs(d * s) > a) return null;
    if (Math.abs(s) > 1e-4) {
      const p = (d * c - a) / s, q = (d * c + a) / s;
      lo = Math.max(lo, Math.min(p, q)); hi = Math.min(hi, Math.max(p, q));
    } else if (Math.abs(d * c) > a) return null;
    lo = Math.max(lo, -M.bladeHalfX); hi = Math.min(hi, M.bladeHalfX);
    if (hi - lo < 0.004) return null;
    return [lo + M.iceCenter.x, hi + M.iceCenter.x];
  }

  /**
   * The blade removes ice per *radian the block turns*, not per second — which is
   * both what a real machine does and what keeps a child's slow, thoughtful turn
   * worth exactly as much snow as a fast one. Speed only changes what the shavings
   * look like.
   */
  produce(dIce, dt, forceOne) {
    const span = this.contactSpan(this.iceAngle);
    if (!span) { this.shaveNow *= Math.pow(0.02, dt); return; }
    const L = span[1] - span[0];

    if (forceOne) {
      const x = span[0] + L * (0.35 + Math.random() * 0.3);
      this.flakes.spawn(x, M.tableFrontZ + 0.002, 0.017, 6e-7, 0.05);
      this.ice.consume(6e-7);
      return;
    }

    const damp = 1 - Math.pow(this.mound.fill, 3.0) * 0.95;   // eases off before it overflows
    const vol = Math.abs(dIce) * 0.035 * L * CUT_DEPTH * damp;
    this.shaveNow += (Math.min(1, vol / (dt * 2.4e-5)) - this.shaveNow) * Math.min(1, dt * 12);
    if (vol <= 0) return;
    this.ice.consume(vol);

    const s = Math.min(1, Math.abs(this.omega) / 9);
    const len = MathUtils.lerp(0.0130, 0.0046, s);
    const push = MathUtils.lerp(0.05, 0.26, s);
    this.flakeAcc += Math.abs(dIce) * MathUtils.lerp(4.5, 11, s);
    let placed = 0;
    const n = Math.min(24, Math.floor(this.flakeAcc));
    if (n > 0) {
      this.flakeAcc -= n;
      const per = vol / n;
      for (let i = 0; i < n; i++) {
        const x = span[0] + L * Math.random();
        if (this.flakes.spawn(x, M.tableFrontZ + 0.002, len, per, push)) placed += per;
      }
    }
    // whatever the pool could not carry still lands, as fine spray
    const rest = vol - placed;
    if (rest > 0) {
      this.leftover += rest;
      if (this.leftover > 1.5e-8) {
        const x = span[0] + L * Math.random();
        this.mound.deposit(x, BOWL.center.z + (Math.random() - 0.5) * 0.014, this.leftover);
        this.leftover = 0;
      }
    }
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
    this.onState(s);
  }

  update(dt) {
    this.time += dt;
    this.stateT += dt;
    const st = this.state;

    // ------------------------------------------------------------ crank input
    let d = this.input.consumeCrank();
    const canCrank = st === S.IDLE || st === S.ENGAGING || st === S.FIRST || st === S.SHAVING;
    if (!canCrank) d = 0;
    if (d !== 0) this.idleTouched = true;

    if (this.input.active === 'crank' && canCrank) {
      this.crankAngle += d;
      this.crankVel = d / Math.max(dt, 1e-4);
    } else {
      // a short coast, then the machine stops -- there is no free spinning
      this.crankVel *= Math.pow(0.02, dt / 0.28);
      if (Math.abs(this.crankVel) < 0.05) this.crankVel = 0;
      this.crankAngle += this.crankVel * dt;
      d = this.crankVel * dt;
    }
    this.omega += (this.crankVel - this.omega) * Math.min(1, dt * 14);
    if (Math.abs(this.omega) < 0.02) this.omega = 0;

    // idle: the handle is never quite still, and the chrome catches the sun once
    let displayAngle = this.crankAngle;
    if (st === S.IDLE && !this.idleTouched) {
      const t = this.time;
      const twitch = Math.exp(-((t % 4.2) - 0.2) * 6) * Math.sin((t % 4.2) * 34) * 0.05;
      displayAngle += Math.sin(t * 0.55) * 0.012 + twitch;
      if (!this.glintDone && t > 2.4 && t < 3.4) {
        const k = (t - 2.4) / 1.0;
        this.glint.intensity = Math.sin(k * Math.PI) * 0.30;
        this.glint.position.set(0.34 - k * 0.30, 0.50, 0.26 - k * 0.05);
      } else if (t >= 3.4) { this.glint.intensity = 0; this.glintDone = true; }
    } else {
      this.glint.intensity = 0;
    }

    // ---------------------------------------------------- slack, then lock-up
    if (canCrank && d !== 0) {
      if (!this.iceLocked) {
        this.slackUsed += Math.abs(d);
        if (this.state === S.IDLE) this.setState(S.ENGAGING);
        if (this.slackUsed >= SLACK) {
          this.iceLocked = true;
          this.lockAngle = this.crankAngle;
          this.audio.clunk();
          this.rig.setShot(SHOTS.firstShave);
        }
      } else {
        this.iceRotSinceLock += Math.abs(d) * M.gearRatio;
      }
    }
    this.iceAngle = this.iceLocked ? -(this.crankAngle - this.lockAngle) * M.gearRatio : 0;

    // gear teeth clicking past, locked to the actual rotation
    if (canCrank) {
      this.tickAcc += Math.abs(d);
      while (this.tickAcc >= TICK_STEP) {
        this.tickAcc -= TICK_STEP;
        this.audio.tick(Math.min(1, 0.4 + Math.abs(this.omega) / 8));
      }
    }

    // ------------------------------------------------------------- the flakes
    if (this.iceLocked && !this.firstFlakeDone && this.iceRotSinceLock > FIRST_ICE_ROT) {
      this.firstFlakeDone = true;
      this.firstFlakeAt = this.time;
      this.produce(0, dt, true);
      this.audio.firstFlake();
      this.rig.nudge(-0.05);
      this.setState(S.FIRST);
    } else if (this.firstFlakeDone && this.time - this.firstFlakeAt > 0.45 && canCrank) {
      if (this.state === S.FIRST) this.setState(S.SHAVING);
      this.produce(d * M.gearRatio, dt, false);
    } else {
      this.shaveNow *= Math.pow(0.001, dt);
    }

    const prevOmega = this._lastOmega === undefined ? 0 : this._lastOmega;
    this._lastOmega = this.omega;
    this.machine.setCrank(displayAngle, this.iceAngle, this.ice.top);
    this.machine.setReaction(this.rig3d, this.omega, (this.omega - prevOmega) / Math.max(dt, 1e-4), dt);
    this.ice.apply(this.iceAngle);
    this.ice.update(this.camera, dt, Math.min(1, this.mound.fill * 0.6 + Math.abs(this.omega) * 0.04));

    this.flakes.update(dt);
    this.mound.update(dt);
    if (this.flakes.landedThisFrame > 0 && this.time - this.lastLanding > 0.07) {
      this.lastLanding = this.time;
      this.audio.sprinkle();
    }
    this.audio.setMachine(Math.abs(this.omega), this.shaveNow, Math.min(1, this.flakes.live / 45));

    // ------------------------------------------------------- enough of a pile
    if (st === S.SHAVING) {
      if (Math.abs(this.omega) < 0.35) this.idleQuiet += dt; else this.idleQuiet = 0;
      if (this.mound.fill >= 0.72 && this.idleQuiet > 0.75) this.toSyrup();
    }

    // ------------------------------------------------------------------ syrup
    this.updateSyrup(dt);
    this.syrup.update(dt, this.camera);

    // ------------------------------------------------------------- clear-away
    if (st === S.CLEARING) {
      const k = Math.pow(0.004, dt / 0.55);
      const snow = this.mound.snow;
      for (let i = 0; i < snow.length; i++) snow[i] *= k;
      this.mound.volume *= k;
      this.mound.dirty = true;
      if (this.stateT > 0.72) {
        this._resetRun(false);
        this.rig.setShot(SHOTS.intro);
        this.time = 0;
        this.glintDone = false;
      }
    }

    // ------------------------------------------------------------ the framing
    if (st === S.SHAVING || st === S.FIRST) {
      this.rig.setBlend(SHOTS.firstShave, SHOTS.growing, this.mound.fill / 0.68);
    }
    this.env.update(dt);
    this.rig.update(dt, this.aspect);
  }

  toSyrup() {
    this.setState(S.TO_SYRUP);
    this.input.mode = 'bottle';
    this.input.enabledCrank = false;
    this.rig.setShot(SHOTS.syrup);
    this.crankVel = 0;
  }

  updateSyrup(dt) {
    const st = this.state;
    if (st === S.TO_SYRUP && this.stateT > 0.9) this.setState(S.SYRUP);
    const active = st === S.SYRUP || st === S.TO_SYRUP || st === S.FINISH;
    if (!active) { this.syrup.pouring = null; this.audio.setSyrup(0); return; }

    // where the pile is highest -- the camera and the pour plane both use it
    this.mound.peakWorld(this._peak);
    const planeY = Math.max(this._peak.y + 0.055, BOWL.center.y + 0.10);

    const held = this.input.heldBottle;
    for (const b of this.syrup.bottles) {
      if (b === held) continue;
      b.target.copy(b.home);
      b.tiltTarget = 0;
      b.yawExtra = 0;
    }

    if (held) {
      this.input._updateBottleTarget(planeY);
      const t = this.input.bottleTarget;
      const dx = t.x - BOWL.center.x, dz = t.z - BOWL.center.z;
      const r = Math.hypot(dx, dz);
      const over = r < 0.088;
      const clampR = Math.min(r, 0.105);
      const tx = BOWL.center.x + (r > 1e-5 ? dx / r : 0) * clampR;
      const tz = BOWL.center.z + (r > 1e-5 ? dz / r : 0) * clampR;

      held.tiltTarget = over ? 0.98 : 0.12;
      held.yawExtra = 0;
      // place the body so the spout ends up exactly on the point the finger drives
      this._e.set(0, held.baseYaw, -held.tilt);
      this._q.setFromEuler(this._e);
      this._v.copy(held.spoutLocal).applyQuaternion(this._q);
      held.target.set(tx - this._v.x, planeY - this._v.y, tz - this._v.z);
      this.syrup.pouring = { bottle: held };
    } else {
      this.syrup.pouring = null;
    }

    // ---- paint what is actually falling out of the bottle -------------------
    const flow = this.syrup.flow;
    this.audio.setSyrup(flow);
    let brush = null;
    if (flow > 0.03 && this.syrup.pouring) {
      const b = this.syrup.pouring.bottle;
      b.spoutWorld(this._v);
      const [u, v] = this.mound.uvOf(this._v.x, this._v.z);
      brush = {
        u, v,
        radius: 0.017 + flow * 0.009,
        amount: flow * 3.4,
        color: b.flavour.color,
      };
      this.poured += flow * dt;
      if (Math.random() < dt * 5.5 * flow) this.audio.plip();
    }
    this.sim.step(this.renderer, dt, brush);
    const mu = this.mound.material.userData.uniforms;
    mu.tSurf.value = this.sim.surfTexture;
    mu.tSoak.value = this.sim.soakTexture;

    if (st === S.SYRUP) {
      const idleFor = performance.now() / 1000 - this.input.releasedAt;
      if (this.poured > 0.80 && !held && idleFor > 1.5) {
        this.setState(S.FINISH);
        this.rig.setShot(SHOTS.finish);
        this.audio.chime();
      }
    }
    if (st === S.FINISH && this.input.heldBottle) {
      this.setState(S.SYRUP);
      this.rig.setShot(SHOTS.syrup);
    }
  }

  serveAnother() {
    if (this.state !== S.FINISH && this.state !== S.SYRUP) return;
    this.setState(S.CLEARING);
    this.rig.setShot(SHOTS.intro);
    this.input.mode = 'crank';
  }

  render() { this.renderer.render(this.scene, this.camera); }

  /** Keeps the frame rate honest on weak phones by trading internal resolution. */
  measure(ms) {
    const f = this.frameTimes;
    f.push(ms);
    if (f.length < 45) return;
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    f.length = 0;
    if (avg > 23 && this.renderScale > 0.62) {
      this.renderScale = Math.max(0.62, this.renderScale - 0.12);
      this.resize();
    } else if (avg < 13.0 && this.renderScale < 1) {
      this.renderScale = Math.min(1, this.renderScale + 0.06);
      this.resize();
    }
  }
}

export { S as STATES };
