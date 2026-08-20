/**
 * The game.
 *
 * There are three states and no menus, no score and no failure.
 *
 *   ATTRACT  the fish swim; one of them drifts past the poi lying on the rim,
 *            and the handle lifts a couple of millimetres. Nothing else asks
 *            the child for anything.
 *   FIRST    the first touch. One fish is quietly made easy — slow, shallow,
 *            unafraid, forgiving — so that the first attempt almost always
 *            ends with a goldfish coming up out of the water on a sheet of
 *            paper. That single unbroken shot is the whole tutorial.
 *   FREE     everything is real from here. The paper soaks, sags, cracks and
 *            goes; the fish are quick and shy and all slightly different.
 *            When a sheet finally gives way it drops into the tub and the
 *            stall keeper hands over a new poi. Play never stops.
 */

import * as THREE from 'three';
import { Water } from '../scene/Water.js';
import { Poi, POI_RADIUS } from '../scene/Poi.js';
import { School, FISH_MODE } from '../scene/School.js';
import { Droplets } from '../scene/Droplets.js';
import { Stage, TUB } from '../scene/Stage.js';
import { CameraRig } from '../scene/CameraRig.js';
import { washiTextures, waterNormalTexture } from '../scene/textures.js';
import { updatePaper, integrity } from './paper.js';
import { clamp, damp, lerp, smoothstep, Rng } from '../core/Rng.js';

/**
 * How far above the finger the poi rides, in NDC. A small hand covers a
 * surprising amount of a phone; the tool and the fish have to stay visible.
 */
export const POI_SCREEN_OFFSET_NDC = 0.23;

export const STATE = {
  ATTRACT: 'attract',
  FIRST: 'first',
  FREE: 'free',
};

/** How far the opening sheet is allowed to wear. Two holes, never the third. */
const FIRST_PAPER_DAMAGE_CAP = 0.58;

const FIRST_FISH = {
  cruise: 0.048,
  turnRate: 1.05,
  wanderRate: 0.34,
  wanderAmp: 0.5,
  skittish: 0.2,
  depthPref: -0.035,
  length: 0.116,
  waveSpeed: 6.4,
};

export class Game {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {THREE.PerspectiveCamera} o.camera
   * @param {object} o.settings
   * @param {import('../core/Input.js').Input} o.input
   * @param {import('../core/Audio.js').Audio} o.audio
   * @param {number} [o.seed]
   */
  constructor({ scene, camera, settings, input, audio, seed = 0x5eed1234 }) {
    this.scene = scene;
    this.settings = settings;
    this.input = input;
    this.audio = audio;
    this.rng = new Rng(seed);
    this.time = 0;
    this.state = STATE.ATTRACT;
    this.bowlCount = 0;
    this.caughtTotal = 0;
    this.poiTotal = 1;

    this.rig = new CameraRig(camera);

    const washi = washiTextures(512);
    this.water = new Water({ settings, normalMap: waterNormalTexture(256) });
    scene.add(this.water.mesh);

    this.stage = new Stage({
      scene,
      settings,
      waterUniforms: this.water.uniforms,
      rng: this.rng,
    });

    this.poi = new Poi({ fibre: washi.map, thickness: washi.thickness, settings, rng: this.rng });
    scene.add(this.poi.group);

    this.school = new School({ rng: this.rng, settings, poiRadius: POI_RADIUS });
    this.school.floorY = TUB.floorY;
    scene.add(this.school.group);

    this.droplets = new Droplets({ budget: settings.dropletBudget, rng: this.rng });
    scene.add(this.droplets.mesh);
    this.droplets.onSplash = (x, z, size) => {
      this.water.addRipple(x, z, 0.0016 + size * 0.35);
      this.audio.droplet(0.85 + this.rng.range(0, 0.5));
    };

    this.school.populate(settings.fishCount, FIRST_FISH);
    this.firstFish = this.school.fish[0];
    this.firstFish.forgiveness = 1;
    this.firstFish.guide = 0.45;

    // --- runtime bits -------------------------------------------------------
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._local = { x: 0, y: 0, above: 0 };
    this._nudge = 0;
    this._nudgeCooldown = 1.4;
    this._wakeRipple = 0;
    this._dripTimer = 0;
    this._dripBudget = 0;
    this._tearCount = 0;
    this._paperChange = null;
    this._fallen = null;
    this._bowlPulse = 0;
    this._handT = 0;
    this._pendingFirstDelivery = false;
    this.paperIntegrity = 1;
    this._integrityTimer = 0;

    this.resize(
      typeof window !== 'undefined' ? window.innerWidth : 390,
      typeof window !== 'undefined' ? window.innerHeight : 720
    );
    this._placePoiAtRest(true);
  }

  // ------------------------------------------------------------------ setup

  resize(w, h) {
    this.rig.setViewport(w, h);
    this.viewport = { w, h };
    const b = this.rig.targetBounds;
    this.bounds = b;
    this.water.setBounds(b.rx, b.rz);
    this.stage.setBounds(b.rx, b.rz);
    this.school.setBounds(b.rx * 0.94, b.rz * 0.94);
    const bowl = this.rig.bowlPoint;
    this.stage.setBowlPosition(bowl.x, bowl.y, bowl.z);
    this.bowlPoint = this.stage.bowlPoint;
    this.restPoint = this.rig.poiRestPoint;
  }

  _placePoiAtRest(snap = false) {
    const r = this.restPoint;
    this.poi.targetXZ.set(r.x, r.z);
    if (snap) {
      this.poi.pos.set(r.x, r.y, r.z);
      this.poi.prevPos.copy(this.poi.pos);
      this.poi.group.position.copy(this.poi.pos);
    }
  }

  // ----------------------------------------------------------------- update

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    this.input.update(dt);

    if (this.input.justPressed) {
      this.audio.unlock();
      if (this.state === STATE.ATTRACT) this._beginPlay();
    }

    switch (this.state) {
      case STATE.ATTRACT:
        this._updateAttract(dt);
        break;
      default:
        this._updatePlay(dt);
        break;
    }

    this.water.update(dt);
    this.droplets.update(dt, (x, z) => this.water.heightAt(x, z));
    this._updateFallenPaper(dt);
    this._updateBowl(dt);
    this.stage.update(dt, this.rig.camera);

    const carried = this.school.carried;
    const focus = carried ? carried.pos : this.poi.pos;
    const tension = carried ? 1 : this.poi.submerge * 0.35;
    this.rig.update(dt, focus, tension);
  }

  _beginPlay() {
    this.state = STATE.FIRST;
    this._nudge = 0;
  }

  // ---------------------------------------------------------------- attract

  /**
   * Nobody has touched anything yet. The poi lies across the rim, dry. When a
   * fish comes past it, the handle lifts a few millimetres and settles — the
   * only invitation this game ever makes.
   */
  _updateAttract(dt) {
    const r = this.restPoint;
    this.poi.pos.set(r.x, r.y, r.z);
    this.poi.prevPos.copy(this.poi.pos);
    this.poi.submerge = 0;
    this.poi.planarSpeed = 0;
    this.poi.liftSpeed = 0;

    this._nudgeCooldown -= dt;
    let nearest = 1e3;
    for (const f of this.school.fish) {
      nearest = Math.min(nearest, Math.hypot(f.pos.x - r.x, f.pos.z - r.z));
    }
    if (nearest < 0.26 && this._nudgeCooldown <= 0) {
      this._nudge = 1;
      this._nudgeCooldown = 3.2;
    }
    this._nudge = Math.max(0, this._nudge - dt * 1.7);

    // A few millimetres. Any more and it becomes a cartoon.
    const bob = Math.sin(this._nudge * Math.PI) * (1 - Math.pow(1 - this._nudge, 2));
    this.poi.group.position.set(r.x, r.y + bob * 0.006, r.z);
    this.poi.group.rotation.set(0.055 - bob * 0.055, -0.35, bob * 0.02, 'YXZ');
    this.poi.group.updateMatrixWorld(true);

    this.school.update(dt, {
      poi: this.poi,
      catchingEnabled: false,
      time: this.time,
      bowl: this.bowlPoint,
      waterHeightAt: (x, z) => this.water.heightAt(x, z),
    });
    this._handleFishEvents(dt);
    this.poi.syncMaterial(dt, this.time, 0, 0);
  }

  // ------------------------------------------------------------------- play

  _updatePlay(dt) {
    const changing = !!this._paperChange;
    const input = this.input;

    // --- where the finger is pointing ---------------------------------------
    if (!changing) {
      const hit = this.rig.screenToWater(
        input.ndcX,
        input.ndcY,
        TUB.waterY,
        POI_SCREEN_OFFSET_NDC,
        this._tmp
      );
      if (input.active) {
        // Keep the poi inside the tub, with a little room to work the rim.
        const rx = this.bounds.rx * 1.04;
        const rz = this.bounds.rz * 1.04;
        const e = Math.hypot(hit.x / rx, hit.z / rz);
        if (e > 1) {
          hit.x /= e;
          hit.z /= e;
        }
        this.poi.targetXZ.set(hit.x, hit.z);
      }
    }

    // --- how deep the sheet should sit ---------------------------------------
    const waterY = this.water.heightAt(this.poi.pos.x, this.poi.pos.z);
    let restDepth = waterY - 0.055;
    for (const f of this.school.fish) {
      if (f.mode !== FISH_MODE.SWIM) continue;
      const d = Math.hypot(f.pos.x - this.poi.pos.x, f.pos.z - this.poi.pos.z);
      if (d < 0.24) restDepth = Math.min(restDepth, f.pos.y - 0.045);
    }
    restDepth = Math.max(restDepth, TUB.floorY + 0.03);

    if (changing) {
      this._updatePaperChange(dt);
    } else {
      this.poi.step(dt, {
        waterY,
        restDepth,
        floorY: TUB.floorY,
        held: input.active,
        lift: input.lift,
      });
      this._poiWaterInteraction(dt, waterY);
    }

    // --- the sheet -----------------------------------------------------------
    const carried = this.school.carried;
    const grace = this.state === STATE.FIRST ? 0.42 : 1;
    const soak = this.state === STATE.FIRST ? 0.62 : 1;
    const load = carried ? clamp(carried.spec.mass * 0.9, 0, 1.4) : 0;
    const loadR = carried ? Math.hypot(carried.paperX, carried.paperY) : 0;

    if (this.poi.hasPaper && !changing) {
      const before = this.poi.paper.tears.length;
      updatePaper(
        this.poi.paper,
        dt,
        {
          submerged: this.poi.submerge * soak,
          planarSpeed: this.poi.planarSpeed * grace,
          liftSpeed: Math.max(this.poi.liftSpeed, 0) * grace,
          fishLoad: load * grace,
          struggling: carried ? carried.struggle : 0,
        },
        this.rng
      );
      // The very first sheet cannot be lost. A child who swishes it about for
      // two minutes without catching anything should still be looking at a
      // poi, not at a hand arriving with a new one: losing the paper before
      // the first fish teaches "the paper breaks" before it teaches "you
      // scoop a fish with it", which is the wrong order to learn them in.
      // It still wets, sags, cracks and opens a couple of holes on the way.
      if (this.state === STATE.FIRST) {
        this.poi.paper.damage = Math.min(this.poi.paper.damage, FIRST_PAPER_DAMAGE_CAP);
        this.poi.paper.destroyed = false;
      }
      const after = this.poi.paper.tears.length;
      if (after > before) {
        const t = this.poi.paper.tears[after - 1];
        this.audio.paperTear(0.3 + (t ? t.radius : 0.2));
      }
      if (this.poi.paper.stressPulse > 0.3) {
        this.audio.paperStress(this.poi.paper.stressPulse);
      }
      if (this.poi.paper.destroyed) this._beginPaperChange();
    }
    this.poi.syncMaterial(dt, this.time, load, loadR);

    this._integrityTimer -= dt;
    if (this._integrityTimer <= 0) {
      this._integrityTimer = 0.5;
      this.paperIntegrity = this.poi.hasPaper ? integrity(this.poi.paper) : 0;
    }

    // --- the fish ------------------------------------------------------------
    this.school.update(dt, {
      poi: this.poi,
      catchingEnabled: this.poi.hasPaper && !changing,
      time: this.time,
      bowl: this.bowlPoint,
      waterHeightAt: (x, z) => this.water.heightAt(x, z),
    });
    this._handleFishEvents(dt);

    // Once the child has understood it, hand the game over to them completely.
    if (this.state === STATE.FREE && this.firstFish) {
      this.firstFish.forgiveness = damp(this.firstFish.forgiveness, 0.12, 0.55, dt);
      this.firstFish.guide = damp(this.firstFish.guide, 0, 0.7, dt);
    }
  }

  /** Ripples, run-off, and the sounds of the paper meeting the surface. */
  _poiWaterInteraction(dt, waterY) {
    const poi = this.poi;

    if (poi.enteredWater) {
      const s = clamp(0.25 + poi.planarSpeed * 0.6 + Math.abs(poi.liftSpeed) * 0.5, 0.2, 1);
      this.water.addRipple(poi.pos.x, poi.pos.z, 0.006 + s * 0.012);
      this.audio.waterEnter(s);
      if (!poi.paper.everWet) this._setWetOrigin();
      this.droplets.splash(poi.pos.x, waterY, poi.pos.z, 3, 0.35);
    }

    if (poi.exitedWater) {
      const wet = poi.paper.wetness;
      this.water.addRipple(poi.pos.x, poi.pos.z, 0.007 + wet * 0.008);
      this.audio.waterExit(0.4 + wet * 0.6);
      // The surface lets go of the paper, and the film runs off the rim.
      this._dripBudget = Math.round(6 + wet * 10);
      this._dripTimer = 0;
    }

    // Drips keep coming for a moment after the sheet clears the surface.
    if (this._dripBudget > 0) {
      this._dripTimer -= dt;
      if (this._dripTimer <= 0) {
        this._dripTimer = 0.045;
        this._dripBudget--;
        this.droplets.runOff(poi, 1, 0.7 + poi.paper.wetness * 0.6);
      }
    }

    // A wake behind the sheet as it is dragged through the water.
    if (poi.submerge > 0.5 && poi.planarSpeed > 0.09) {
      this._wakeRipple -= dt;
      if (this._wakeRipple <= 0) {
        this._wakeRipple = 0.11;
        this.water.addRipple(
          poi.pos.x - poi.vel.x * 0.06,
          poi.pos.z - poi.vel.z * 0.06,
          clamp(poi.planarSpeed * 0.012, 0.0015, 0.009)
        );
      }
    }
  }

  /**
   * Water reaches the sheet at its lowest point first, and the stain spreads
   * from there — so the very first contact has a direction, and reads as
   * something that happened rather than a state that switched.
   */
  _setWetOrigin() {
    let bestY = Infinity;
    let bx = 0;
    let by = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dx = Math.cos(a) * 0.72;
      const dy = Math.sin(a) * 0.72;
      const p = this.poi.paperWorldPoint(dx, dy, this._tmp2);
      if (p.y < bestY) {
        bestY = p.y;
        bx = dx;
        by = dy;
      }
    }
    this.poi.paper.wetOriginX = bx;
    this.poi.paper.wetOriginY = by;
  }

  // ----------------------------------------------------------- fish events

  _handleFishEvents(dt) {
    for (const e of this.school.events) {
      const f = e.fish;
      switch (e.type) {
        case 'dart': {
          const wy = this.water.heightAt(f.pos.x, f.pos.z);
          if (f.pos.y > wy - 0.055) {
            this.water.addRipple(f.pos.x, f.pos.z, 0.0026 * e.strength);
            if (e.strength > 0.6) this.audio.tailFlick(e.strength * 0.5);
          }
          break;
        }
        case 'caught': {
          this.audio.tailFlick(0.8);
          this.rig.punchIn(0.75, 1.2);
          this.water.addRipple(f.pos.x, f.pos.z, 0.008);
          break;
        }
        case 'surfaced': {
          // The moment the whole game exists for.
          const wy = this.water.heightAt(f.pos.x, f.pos.z);
          this.water.addRipple(f.pos.x, f.pos.z, 0.014);
          this.droplets.splash(f.pos.x, wy, f.pos.z, 10, 0.85);
          this.droplets.runOff(this.poi, 6, 1.1);
          this.audio.waterExit(0.9);
          this.audio.tailFlick(1);
          break;
        }
        case 'escaped': {
          const wy = this.water.heightAt(f.pos.x, f.pos.z);
          this.water.addRipple(f.pos.x, f.pos.z, 0.012);
          this.droplets.splash(f.pos.x, wy, f.pos.z, 7, 0.7);
          this.audio.waterEnter(0.7);
          this.audio.tailFlick(0.9);
          break;
        }
        case 'delivered': {
          this.audio.bowlPlop();
          this._bowlPulse = 1;
          this.bowlCount++;
          this.caughtTotal++;
          if (this.state === STATE.FIRST) {
            // Understanding has happened. Take the training wheels off.
            this.state = STATE.FREE;
            this.rig.punchIn(0.5, 0.9);
          }
          this._recycleBowl();
          break;
        }
        default:
          break;
      }
    }
  }

  /**
   * The bowl fills, the keeper bags the earlier catch, and fresh fish arrive
   * in the tub. Nothing ever runs out, and nothing is ever taken from the
   * child while they are looking at it.
   */
  _recycleBowl() {
    const inBowl = this.school.fish.filter((f) => f.mode === FISH_MODE.IN_BOWL);
    if (inBowl.length <= 5) return;
    const oldest = inBowl[0];
    oldest._retiring = 0.001;
  }

  _updateBowl(dt) {
    this._bowlPulse = Math.max(0, this._bowlPulse - dt * 2.2);
    const w = this.stage.bowlWater;
    if (w) {
      const p = this._bowlPulse;
      w.scale.setScalar(1 + Math.sin(p * Math.PI * 3) * 0.035 * p);
      w.position.y = this.stage.bowlWaterY - p * 0.004;
    }

    // Retiring fish shrink out at the bowl and come back as new stock.
    for (const f of this.school.fish) {
      if (f._retiring === undefined) continue;
      f._retiring += dt;
      const t = f._retiring;
      if (t < 0.45) {
        f.group.scale.setScalar(lerp(0.86, 0.0, smoothstep(0, 0.45, t)));
      } else if (t < 0.5) {
        const a = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(0.55, 0.9);
        f.pos.set(
          Math.cos(a) * this.bounds.rx * r,
          f.spec.depthPref,
          -Math.abs(Math.sin(a)) * this.bounds.rz * r
        );
        f.mode = FISH_MODE.SWIM;
        f.heading = this.rng.range(0, Math.PI * 2);
        f.threat = 0;
        f.forgiveness = 0;
        f.guide = 0;
        f.speed = f.spec.cruise;
        f.group.scale.setScalar(0.001);
      } else if (t < 1.05) {
        f.group.scale.setScalar(lerp(0.0, 1.0, smoothstep(0.5, 1.05, t)));
      } else {
        f.group.scale.setScalar(1);
        delete f._retiring;
      }
    }
  }

  // ------------------------------------------------------- changing the poi

  /**
   * No failure screen, no dialogue. The sheet drops into the tub with a
   * "pochan", floats for a moment, and a hand comes in from the side with a
   * new poi in a different colour.
   */
  _beginPaperChange() {
    const detached = this.poi.detachPaper();
    if (detached) {
      const { mesh, uniforms } = detached;
      const m = new THREE.Matrix4().copy(this.poi.group.matrixWorld);
      m.decompose(mesh.position, mesh.quaternion, mesh.scale);
      this.scene.add(mesh);
      this._fallen = {
        mesh,
        uniforms,
        vy: -0.02,
        spin: this.rng.sym(0.9),
        t: 0,
        landed: false,
      };
    }
    this.audio.paperTear(1);
    this._paperChange = { t: 0, phase: 'drop' };
    this._handT = 0;
    this.poiTotal++;
  }

  _updatePaperChange(dt) {
    const pc = this._paperChange;
    pc.t += dt;

    // The empty frame is set down on the rim while the new one comes over.
    const r = this.restPoint;
    this.poi.targetXZ.set(r.x, r.z);
    this.poi.pos.x = damp(this.poi.pos.x, r.x, 5, dt);
    this.poi.pos.z = damp(this.poi.pos.z, r.z, 5, dt);
    this.poi.pos.y = damp(this.poi.pos.y, r.y + 0.02, 5, dt);
    this.poi.prevPos.copy(this.poi.pos);
    this.poi.submerge = 0;
    this.poi.planarSpeed = 0;
    this.poi.liftSpeed = 0;
    this.poi.group.position.copy(this.poi.pos);
    this.poi.group.rotation.set(0.06, -0.3, 0, 'YXZ');
    this.poi.group.updateMatrixWorld(true);

    if (pc.phase === 'drop' && pc.t > 0.55) {
      pc.phase = 'offer';
      pc.t = 0;
      this.audio.newPoi();
    }
    if (pc.phase === 'offer') {
      this._handT = Math.min(1, this._handT + dt / 0.55);
      this.stage.setHand(this._handT, this.poi.pos);
      if (this._handT >= 1 && !pc.fitted) {
        pc.fitted = true;
        this.poi.refresh();
        this.audio.newPoi();
      }
      if (pc.fitted && pc.t > 0.75) {
        pc.phase = 'withdraw';
        pc.t = 0;
      }
    }
    if (pc.phase === 'withdraw') {
      this._handT = Math.max(0, this._handT - dt / 0.45);
      this.stage.setHand(this._handT, this.poi.pos);
      if (this._handT <= 0) {
        this._paperChange = null;
        // If the child is already holding the screen, play resumes instantly.
        this.input.lift = 1;
      }
    }
  }

  _updateFallenPaper(dt) {
    const f = this._fallen;
    if (!f) return;
    f.t += dt;
    const m = f.mesh;
    const waterY = this.water.heightAt(m.position.x, m.position.z);

    if (!f.landed) {
      f.vy -= 3.4 * dt; // a sheet of wet paper falls slowly
      m.position.y += f.vy * dt;
      m.rotation.z += f.spin * dt;
      m.rotation.x += f.spin * 0.4 * dt;
      if (m.position.y <= waterY) {
        f.landed = true;
        m.position.y = waterY;
        this.audio.paperDrop();
        this.water.addRipple(m.position.x, m.position.z, 0.017);
        this.droplets.splash(m.position.x, waterY, m.position.z, 6, 0.5);
      }
    } else {
      // Floats, soaks through, and settles out of sight.
      m.position.y = damp(m.position.y, waterY - 0.055, 0.7, dt);
      m.rotation.x = damp(m.rotation.x, 0.1, 1.2, dt);
      m.rotation.z = damp(m.rotation.z, 0, 1.2, dt);
      f.uniforms.uWetness.value = 1;
      f.uniforms.uOpacity.value = damp(f.uniforms.uOpacity.value, 0, 0.55, dt);
      if (f.uniforms.uOpacity.value < 0.02) {
        this.scene.remove(m);
        m.material.dispose();
        this._fallen = null;
        return;
      }
    }
    f.uniforms.uTime.value = this.time;
  }

  // ----------------------------------------------------------------- probes

  /**
   * Where a finger has to be, in CSS pixels, for the poi to land on a given
   * point of the water. Used by the automated play-through.
   */
  aimScreen(x, z) {
    const v = this._tmp2.set(x, TUB.waterY, z).project(this.rig.camera);
    const ndcY = v.y - POI_SCREEN_OFFSET_NDC;
    return {
      x: (v.x * 0.5 + 0.5) * this.viewport.w,
      y: (1 - (ndcY * 0.5 + 0.5)) * this.viewport.h,
    };
  }

  /** Snapshot for tests and for the adaptive-quality heuristics. */
  snapshot() {
    const carried = this.school.carried;
    return {
      state: this.state,
      time: this.time,
      bowlCount: this.bowlCount,
      caughtTotal: this.caughtTotal,
      poiTotal: this.poiTotal,
      changingPoi: !!this._paperChange,
      paper: {
        wetness: this.poi.paper.wetness,
        damage: this.poi.paper.damage,
        tears: this.poi.paper.tears.length,
        destroyed: this.poi.paper.destroyed,
        wetFront: this.poi.paper.wetFront,
        everWet: this.poi.paper.everWet,
        integrity: this.paperIntegrity,
        hasPaper: this.poi.hasPaper,
      },
      poi: {
        x: this.poi.pos.x,
        y: this.poi.pos.y,
        z: this.poi.pos.z,
        submerge: this.poi.submerge,
        lift: this.input.lift,
      },
      carrying: carried ? carried.spec.kind : null,
      fish: this.school.fish.map((f) => ({
        kind: f.spec.kind,
        mode: f.mode,
        x: f.pos.x,
        y: f.pos.y,
        z: f.pos.z,
      })),
    };
  }

  dispose() {
    this.water.dispose();
    this.poi.dispose();
    this.school.dispose();
    this.droplets.dispose();
    this.stage.dispose();
  }
}
