import * as THREE from '../vendor/three.module.js';
import { PIER_TOP, WATER_LEVEL, depthAt, zoneOf } from './world/env.js';
import { createSky } from './world/sky.js';
import { createWater, createSeabed, makeHeightSampler, MAX_RIPPLES } from './world/water.js';
import { createShore, createTank, createRopeCoil, createLights } from './world/shore.js';
import { createFish, FishSystem } from './world/fish.js';
import { CastNet } from './net/castnet.js';
import { Rope } from './net/rope.js';
import { Spray, FoamRings, NetShadow } from './fx/effects.js';
import { Director } from './camera.js';
import { Input, gestureToCast } from './input.js';
import { Hud } from './ui/hud.js';
import { Sound } from './audio.js';
import { Rng } from './util/rng.js';
import { clamp, lerp, smoothstep } from './util/math.js';
import * as TEX from './util/textures.js';

const REST_POS = new THREE.Vector3(-0.02, PIER_TOP + 0.13, -0.18);
const HAND_POS = new THREE.Vector3(-0.74, PIER_TOP + 0.13, 0.72);

/** The planks the rope has to rest on rather than sink through. */
function deckFloor(x, z) {
  return (Math.abs(x) < 2.58 && z > -1.25 && z < 6.25) ? PIER_TOP + 0.022 : -9;
}

// Two authored openings. Portrait keeps more sky above the horizon; landscape
// tips down so the near planks and the coil stay comfortably in the short axis.
const IDLE_SHOT = {
  pos: new THREE.Vector3(0.0, 1.92, 2.35),
  look: new THREE.Vector3(0.05, 0.30, -3.6)
};
const IDLE_SHOT_LAND = {
  pos: new THREE.Vector3(0.0, 1.74, 1.95),
  look: new THREE.Vector3(0.05, -0.26, -3.1)
};

export class Game {
  constructor({ renderer, canvasEl, quality, seed = 20260825 }) {
    this.renderer = renderer;
    this.quality = quality;
    this.rng = new Rng(seed);
    this.time = 0;
    this.state = 'idle';
    this.stateT = 0;
    this.sinceInput = 0;
    this.castCount = 0;
    this.viewHeight = 800;
    this.lastCast = null;
    this.history = [];

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, 1, 0.05, 2000);
    this.director = new Director(this.camera);

    // ---- textures (all procedural, generated once) -------------------------
    const t0 = performance.now();
    this.tex = {
      net: TEX.makeNetTexture(renderer, { size: quality.netTexSize }),
      rope: TEX.makeRopeTexture(renderer),
      fuzz: TEX.makeFuzzTexture(renderer),
      wood: TEX.makeWoodTexture(renderer),
      woodRough: TEX.makeWoodRoughness(renderer),
      sand: TEX.makeSandTexture(renderer),
      noise: TEX.makeNoiseTexture(renderer),
      drop: TEX.makeDropletTexture(renderer)
    };
    this.texMs = performance.now() - t0;

    // ---- world -------------------------------------------------------------
    this.heights = makeHeightSampler();
    for (let i = 0; i < MAX_RIPPLES; i++) this.heights.ripples.push({ x: 0, z: 0, age: -1, strength: 0 });

    this.sky = createSky();
    this.scene.add(this.sky);

    // One irradiance probe baked from our own sky. Without it every metal
    // surface in the scene renders black, and damp wood loses its sheen.
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const probeScene = new THREE.Scene();
      probeScene.add(createSky({ forEnv: true }));
      this.envRT = pmrem.fromScene(probeScene, 0, 0.5, 900);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = 0.85;
      pmrem.dispose();
    } catch { /* an old device without float targets simply gets flatter metal */ }

    this.water = createWater(renderer, this.tex.noise, quality);
    this.scene.add(this.water.mesh);
    this.seabed = createSeabed(this.tex.sand, quality);
    this.scene.add(this.seabed.mesh);

    const shore = createShore(this.tex.wood, this.tex.woodRough, this.tex.sand);
    this.scene.add(shore.group);
    this.tank = createTank(this.tex.noise);
    this.scene.add(this.tank.group);
    this.scene.add(createRopeCoil(this.tex.rope));
    this.lights = createLights(this.scene);

    this.fish = createFish(quality);
    this.scene.add(this.fish.mesh);
    this.fishes = new FishSystem(this.fish, this.heights, this.rng);
    this.fishes.populate(4);

    // ---- net, rope, effects -------------------------------------------------
    this.spray = new Spray(this.tex.drop, this.heights, (x, z, s) => this.addRipple(x, z, s));
    this.scene.add(this.spray.points);
    this.foam = new FoamRings(this.heights);
    this.scene.add(this.foam.group);
    this.netShadow = new NetShadow();
    this.scene.add(this.netShadow.mesh);
    this.restShadow = new NetShadow();
    this.restShadow.mesh.renderOrder = 3;
    this.scene.add(this.restShadow.mesh);

    this.sound = new Sound();

    this.net = new CastNet({
      netTex: this.tex.net,
      quality, rng: this.rng, heights: this.heights,
      onSplash: (x, z, s) => { this.addRipple(x, z, s); this.foam.spawn(x, z, this.net.openRadius || 1.5); },
      onDrip: (x, y, z) => { this.spray.drip(x, y, z); if (this.rng.next() < 0.10) this.sound.drip(); },
      onSpray: (center, radius, stats) => {
        this.spray.crown(center, radius, clamp(0.6 + stats.sharpness * 0.7, 0.5, 1.4), this.rng);
        this.sound.splash(clamp(0.6 + stats.sharpness * 0.6, 0.5, 1.3));
      }
    });
    this.scene.add(this.net.mesh);
    this.scene.add(this.net.horn);
    this.scene.add(this.net.weights);
    this.scene.add(this.net.brails);
    this.net.foldAt(REST_POS);

    this.rope = new Rope({ ropeTex: this.tex.rope, fuzzTex: this.tex.fuzz });
    this.scene.add(this.rope.mesh);
    this.scene.add(this.rope.fuzz);

    // ---- input / overlay ----------------------------------------------------
    this.hud = new Hud(document.getElementById('overlay'));
    this.input = new Input(canvasEl, (g) => this.onGesture(g));
    canvasEl.addEventListener('pointerdown', () => this.sound.start(), { once: false });

    this.nextJump = this.rng.range(2.5, 5.0);
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_LEVEL);
    this._ray = new THREE.Raycaster();
    this._tmp = new THREE.Vector3();
    this._castDir = new THREE.Vector3(0, 0, -1);
    this._shotPos = new THREE.Vector3();
    this._shotLook = new THREE.Vector3();
    this._mustSee = [new THREE.Vector3(), new THREE.Vector3()];
    this._rimPts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  }

  // ------------------------------------------------------------------ ripples

  addRipple(x, z, strength = 1) {
    const list = this.heights.ripples;
    let slot = 0, oldest = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].age < 0) { slot = i; oldest = Infinity; break; }
      if (list[i].age > oldest) { oldest = list[i].age; slot = i; }
    }
    list[slot].x = x; list[slot].z = z; list[slot].age = 0; list[slot].strength = strength;
  }

  _syncRipples(dt) {
    const list = this.heights.ripples;
    const u = this.water.ripples;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.age >= 0) { r.age += dt; if (r.age > 5.5) r.age = -1; }
      u[i].set(r.x, r.z, r.age, r.strength);
    }
  }

  // ------------------------------------------------------------------- input

  onGesture(g) {
    this.sound.start();
    this.sinceInput = 0;
    if (g.kind === 'tap') this._onTap(g);
    else this._onSwipe(g);
  }

  _screenToWater(nx, ny) {
    this._ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.camera);
    const hit = this._ray.ray.intersectPlane(this._plane, this._tmp.clone());
    return hit;
  }

  _onTap(g) {
    switch (this.state) {
      case 'idle': {
        const hit = this._screenToWater(g.nx, g.ny);
        if (hit && hit.z < -1.25 && hit.distanceTo(this.camera.position) < 60) {
          // Look closer at the water; the surface answers, and so do the fish.
          this.director.nudgeGaze(hit);
          this.addRipple(hit.x, hit.z, 0.30);
          this.spray.splashlet(hit.x, this.heights.heightAt(hit.x, hit.z), hit.z, this.rng, 4);
          this.fishes.disturb(hit.x, hit.z, 1.6, 0.35);
          this.sound.drip();
        } else {
          // Touching the bundle: it shifts, and a little water comes out of it.
          this.net.nudge(0.9);
          this.director.nudgeGaze(this.net.center);
          if (this.net.wetness > 0.2) for (let i = 0; i < 5; i++) {
            this.spray.drip(REST_POS.x + this.rng.range(-0.2, 0.2), REST_POS.y + 0.1, REST_POS.z + this.rng.range(-0.2, 0.2));
          }
        }
        break;
      }
      case 'sunk': this._startHaul(); break;
      case 'observe': this._startRelease(); break;
      default: break;
    }
  }

  _onSwipe(g) {
    switch (this.state) {
      case 'idle': this._startCast(g); break;
      case 'sunk': this._startHaul(); break;
      case 'observe': this._startRelease(); break;
      // A swipe during flight is not an error; it is impatience. Remember it.
      case 'cast': case 'haul': this.queued = g; break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ states

  _startCast(gestureOrParams) {
    const params = gestureOrParams.kind ? gestureToCast(gestureOrParams) : gestureOrParams;
    this._castDir.set(Math.sin(params.azimuth), 0, -Math.cos(params.azimuth)).normalize();
    this.lastCast = this.net.launch(params, HAND_POS);
    this.lastCast.zone = zoneOf(this.net.landing.x, this.net.landing.z) > 0.5 ? 'deep' : 'shallow';
    this.lastCast.depth = depthAt(this.net.landing.x, this.net.landing.z);
    this.state = 'cast';
    this.stateT = 0;
    this.castCount++;
    this.history.push(this.lastCast);
    if (this.history.length > 24) this.history.shift();
    this.sound.whoosh(0.6 + params.sharpness * 0.8);
    this.caught = null;
  }

  _startHaul() {
    if (!this.net.beginHaul()) return;
    // Anything still inside the ring comes up with it — at most one, never a score.
    this.caught = this.fishes.catchIn(this.net.center.x, this.net.center.z, this.net.openRadiusNow * 0.8);
    this.state = 'haul';
    this.stateT = 0;
    this.sound.haul();
  }

  _startRelease() {
    if (!this.fishes.hasTankFish) { this._toIdle(); return; }
    const x = this.rng.range(-1.2, 1.2);
    const z = -2.2 + this.rng.range(-0.5, 0.5);
    const target = new THREE.Vector3(x, this.heights.heightAt(x, z), z);
    this.fishes.releaseTank(target, (rx, rz, s) => {
      this.addRipple(rx, rz, s);
      this.spray.splashlet(rx, this.heights.heightAt(rx, rz), rz, this.rng, 8);
      this.sound.splash(0.4);
      this.fishes.spawn('darters', { dist: 3.0, side: rx });
    });
    this.releaseTarget = target;
    this.state = 'release';
    this.stateT = 0;
    this.sound.release();
  }

  _toIdle() {
    this.state = 'idle';
    this.stateT = 0;
    this.caught = null;
    if (this.queued) { const g = this.queued; this.queued = null; this._onSwipe(g); }
  }

  // ------------------------------------------------------------------ update

  update(dt) {
    dt = Math.min(dt, 1 / 24);
    this.time += dt;
    this.stateT += dt;
    this.sinceInput += dt;
    this.heights.setTime(this.time);
    this._syncRipples(dt);

    // --- ambient life: the sea keeps moving whether or not anyone throws.
    this.nextJump -= dt;
    if (this.nextJump <= 0) {
      this.nextJump = this.rng.range(3.4, 7.5);
      const jx = this.rng.range(-3.4, 3.4);
      const jz = -this.rng.range(2.6, 8.0);
      this.fishes.jump(jx, jz, (x, z, s) => {
        this.addRipple(x, z, s);
        this.spray.splashlet(x, this.heights.heightAt(x, z), z, this.rng, 7);
        this.sound.splash(0.35);
      });
    }
    if (this.fishes.shoals.length < 4 && this.rng.next() < dt * 0.6) this.fishes.populate(4);

    // --- state machine
    switch (this.state) {
      case 'idle': break;
      case 'cast':
        if (this.net.phase === 'sink' || this.net.phase === 'settled') { this.state = 'sunk'; this.stateT = 0; }
        break;
      case 'sunk': {
        // A gentle tug on the line after a while, then the net comes home by itself.
        if (this.stateT > 3.4 && this.stateT < 3.9) this.net.center.y += Math.sin((this.stateT - 3.4) / 0.5 * Math.PI) * 0.010;
        if (this.stateT > 6.5) this._startHaul();
        break;
      }
      case 'haul':
        if (this.net.phase === 'folded') {
          if (this.caught && this.fishes.putInTank(this.tank.center, this.caught.kind, this.caught.scale)) {
            this.state = 'observe'; this.stateT = 0;
          } else {
            this._toIdle();
          }
        }
        break;
      case 'observe':
        if (this.stateT > 4.6) this._startRelease();
        break;
      case 'release':
        if (!this.fishes.hasTankFish && this.stateT > 0.6) this._toIdle();
        break;
    }

    // --- simulation
    this.net.update(dt, this.time, {
      handPos: HAND_POS,
      restPos: REST_POS,
      liftDir: this._castDir,
      onTouchdown: (c, r, stats) => this._onTouchdown(c, r, stats)
    });

    const slack = this.net.isAirborne ? 0.06
      : this.net.phase === 'haul' ? 0.22
        : this.net.isSubmerged ? 0.30 : 0.55;
    this.rope.update(HAND_POS, this.net.center, slack, this.net.wetness, this.time, deckFloor);

    this.fishes.update(dt, this.time);
    this.spray.update(dt);
    this.foam.update(dt);

    const showShadow = this.net.phase !== 'folded' && this.net.phase !== 'landed'
      && this.net.center.z < -1.0;
    this.netShadow.update(
      this.net.center.x, this.net.center.z,
      this.net.openRadiusNow * 0.95,
      Math.max(0, this.net.center.y),
      showShadow
    );
    const onDeck = this.net.phase === 'folded' || this.net.phase === 'landed';
    this.restShadow.update(this.net.center.x, this.net.center.z,
      this.net.openRadiusNow * 1.05, 0.25, onDeck, PIER_TOP + 0.012);

    // --- camera
    this._applyShot(dt);

    // Point sprites are sized in metres; convert with the live projection.
    this.spray.material.uniforms.uScale.value =
      this.viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) * 0.5));

    // --- shader clocks
    this.water.material.uniforms.uTime.value = this.time;
    this.seabed.material.uniforms.uTime.value = this.time;
    this.tank.surfMat.uniforms.uTime.value = this.time;
    this.tank.surfMat.uniforms.uActive.value = this.fishes.hasTankFish ? 1 : 0;
    this.sky.userData.update(this.time);

    this.hud.update(this.input.active ? this.input.path : null, dt);
  }

  _onTouchdown(center, radius, stats) {
    this.director.kick(0.35 + stats.sharpness * 0.35);
    this.fishes.disturb(center.x, center.z, radius, 1.0);
    for (let i = 0; i < 3; i++) {
      this.addRipple(
        center.x + this.rng.range(-radius * 0.5, radius * 0.5),
        center.z + this.rng.range(-radius * 0.5, radius * 0.5),
        0.45
      );
    }
  }

  /** Where the camera stands for this beat. Authored, not solved. */
  _applyShot(dt) {
    const net = this.net;
    const P = this._shotPos, L = this._shotLook;
    const portrait = this.director.portrait;
    const fovIdle = portrait ? 64 : 58;
    const fovWide = portrait ? 66 : 62;
    const IDLE = portrait ? IDLE_SHOT : IDLE_SHOT_LAND;
    let fov = fovIdle, rate = 2.6;

    const cd = this._castDir;
    const D = net.landing ? Math.hypot(net.landing.x - HAND_POS.x, net.landing.z - HAND_POS.z) : 6;

    if (this.state === 'idle') {
      P.copy(IDLE.pos); L.copy(IDLE.look);
      rate = 2.2;
    } else if (this.state === 'cast' && net.phase === 'lift') {
      // Stay put: the child must see the net leave their own feet.
      P.copy(IDLE.pos); L.copy(IDLE.look).lerp(net.center, 0.25);
      rate = 3.2;
    } else if (this.state === 'cast' && net.phase === 'fly' && net.phaseT / net.flightTime < 0.42) {
      // One step back, and only one, to let the flower open in the air.
      P.copy(IDLE.pos).add(new THREE.Vector3(0, 0.62, 1.05));
      L.copy(net.center).lerp(IDLE.look, 0.22);
      L.y -= 0.20;
      rate = 2.6;
    } else if (this.state === 'cast' || this.state === 'sunk') {
      // Drift overhead: the circle on the water and the cone under it.
      // Low enough that the hand stays in frame without the framing solver
      // having to back off, which is what used to shrink the landing.
      const back = 1.95 + D * 0.075;
      const high = (this.state === 'sunk' ? 1.85 : 1.62) + D * 0.095;
      P.set(HAND_POS.x - cd.x * back, HAND_POS.y + high, HAND_POS.z - cd.z * back);
      const focus = this.state === 'sunk' ? 0.86 : 0.55;
      L.set(
        lerp(HAND_POS.x, net.center.x, focus),
        lerp(HAND_POS.y, net.center.y, 0.72) - 0.15,
        lerp(HAND_POS.z, net.center.z, focus)
      );
      fov = fovWide;
      rate = this.state === 'sunk' ? 1.9 : 1.55;
    } else if (this.state === 'haul') {
      // Hold the overhead angle while the net rises and pours, then walk the
      // frame back down to eye level as it reaches the planks.
      const back = 1.95 + D * 0.075;
      const high = 1.85 + D * 0.095;
      P.set(HAND_POS.x - cd.x * back, HAND_POS.y + high, HAND_POS.z - cd.z * back);
      const home = smoothstep(0.85, 2.0, this.stateT);
      P.lerp(IDLE.pos, home);
      L.copy(net.center);
      L.y -= 0.18;
      L.lerp(IDLE.look, home * 0.85);
      fov = lerp(fovWide, fovIdle, home);
      rate = 2.2;
    } else if (this.state === 'observe' || this.state === 'release') {
      const c = this.tank.center;
      P.set(c.x + 0.06, c.y + 0.44, c.z + 0.62);
      L.copy(c).add(new THREE.Vector3(0, -0.05, -0.06));
      if (this.state === 'release') {
        const t = smoothstep(0.1, 0.9, this.stateT);
        P.lerp(IDLE.pos, t);
        L.lerp(this.releaseTarget || IDLE.look, t);
      }
      fov = portrait ? 58 : 48;
      rate = 2.8;
    } else {
      P.copy(IDLE.pos); L.copy(IDLE.look);
    }

    this._mustSee[0].copy(HAND_POS);
    this._mustSee[1].copy(net.center);
    let see = this._mustSee;
    if (this.state === 'observe') {
      // Looking into the pail. The rope is not the subject of this beat.
      this._mustSee[0].copy(this.tank.center);
      this._mustSee[1].copy(this.tank.center);
    }
    if (this.state === 'cast' || this.state === 'sunk' || this.state === 'haul') {
      // While the net is open, its whole rim is the subject: frame the circle.
      see = this._mustSee.concat(net.rimPoints(this._rimPts));
    }
    this.director.apply({ pos: P, look: L, fov, rate, mustSee: see }, dt);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.director.setViewport(w / h);
    this.camera.updateProjectionMatrix();
    this.viewHeight = h;
  }

  render() { this.renderer.render(this.scene, this.camera); }

  /** Test/inspection surface. Deterministic, so a run can be replayed exactly. */
  debugState() {
    return {
      state: this.state,
      netPhase: this.net.phase,
      castCount: this.castCount,
      wetness: +this.net.wetness.toFixed(3),
      netRadius: +this.net.openRadiusNow.toFixed(3),
      rimY: +this.net.lowestRimY.toFixed(3),
      netCenter: this.net.center.toArray().map((v) => +v.toFixed(3)),
      landing: this.net.landing ? this.net.landing.toArray().map((v) => +v.toFixed(2)) : null,
      lastCast: this.lastCast,
      caught: !!this.caught,
      tankFish: this.fishes.hasTankFish,
      shoals: this.fishes.shoals.map((s) => s.kind),
      framingError: +this.director.framingError.toFixed(3),
      cameraPos: this.camera.position.toArray().map((v) => +v.toFixed(2)),
      fps: this.fps || 0
    };
  }
}
