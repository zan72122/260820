// ---------------------------------------------------------------------------
// The loop: look over the white field, sweep the snow away, find the leaf
// tips, grip and pull until the carrot pops free, drop it in the crate, and
// go looking for the next one. No timers, no failure, no words.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {
  Field, BED_W, BED_D, MAX_SNOW, soilHeight, RIDGE_PERIOD,
} from './field.js';
import { buildWorld, groundHeight } from './world.js';
import {
  makeCarrotPlant, makeSoilCap, makeHole, makeHarvestedCarrot, CARROT_LEN,
} from './carrot.js';
import { Fx } from './fx.js';
import { CameraRig, framePose } from './camerarig.js';
import { SpotMarker, GestureHint } from './hints.js';
import { makeMitten, HandController } from './hand.js';
import * as A from './audio.js';
import {
  clamp, clamp01, lerp, damp, smoothstep, easeOutCubic, easeOutBack,
  easeInOutCubic, easeOutQuint, makeRng,
} from './util.js';

const S = {
  INTRO: 'intro', OVERVIEW: 'overview', APPROACH: 'approach', DIG: 'dig',
  GRAB: 'grab', PULL: 'pull', POP: 'pop', CARRY: 'carry', BOX: 'box',
  REFILL: 'refill',
};

const BRUSH_R = 0.135;         // a mittened hand's worth of snow per stroke
const SPOTS_PER_ROUND = 4;
const CRATE_SLOTS = 12;

export class Game {
  constructor({ renderer, scene, camera, container, quality }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.container = container;
    this.quality = quality;
    this.rng = makeRng(20260819);

    this.field = new Field(renderer);
    scene.add(this.field.group);
    this.world = buildWorld(scene, renderer, quality);
    this.fx = new Fx(scene, this.field.soilMap);

    this.rig = new CameraRig(camera);
    this.hint = new GestureHint(container);

    this.mitten = makeMitten(this.field.grain);
    scene.add(this.mitten);
    this.hand = new HandController(this.mitten);

    // --- reusable carrot set --------------------------------------------
    this.spots = [];
    for (let i = 0; i < SPOTS_PER_ROUND; i++) {
      const plant = makeCarrotPlant({
        seed: i + 1,
        aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
        leafHeight: 0.125 + this.rng() * 0.032,
        fronds: 13 + ((this.rng() * 4) | 0),
      });
      scene.add(plant);
      const cap = makeSoilCap(this.field.soilMap, this.field.soilBump);
      scene.add(cap);
      const hole = makeHole(this.field.soilMap);
      hole.visible = false;
      scene.add(hole);
      this.spots.push({
        x: 0, z: 0, y: 0, plant, cap, hole,
        marker: new SpotMarker(scene),
        leafHeight: plant.userData.leafHeight,
        capAmount: 1, done: true, revealed: false, rise: 0,
      });
    }

    // --- crate ------------------------------------------------------------
    this.crate = this.world.crate;
    this.cratePile = new THREE.Group();
    this.crate.add(this.cratePile);
    this.crateCount = 0;
    this.crateMarker = new SpotMarker(scene);
    const cw = new THREE.Vector3();
    this.crate.getWorldPosition(cw);
    this.crateMarker.setAt(cw.x, cw.y + 0.24, cw.z);

    // --- interaction state ------------------------------------------------
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.pointer = { down: false, x: 0, y: 0, px: 0, py: 0, moved: 0 };
    this.lastWorld = new THREE.Vector3();
    this.hasLastWorld = false;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.freezeT = 0;
    this.idleT = 0;

    this.state = S.INTRO;
    this.stateT = 0;
    this.active = null;
    this.pullPx = 0;
    this.pullProgress = 0;
    this.digUp = 0;
    this.digSide = 0;
    this.shortcuts = 0;
    this.carried = false;
    this.audioStarted = false;

    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
    this.plane = new THREE.Plane();
    this._up = new THREE.Vector3(0, 1, 0);
    this.cratePos = new THREE.Vector3();
    this._axis = new THREE.Vector3();
    this._q = new THREE.Quaternion();

    this.newRound(true);
    this.enterIntro();
  }

  // ------------------------------------------------------------------ setup
  get aspect() { return this.container.clientWidth / this.container.clientHeight; }

  /** Choose new carrot positions on the ridge crests and plant them. */
  newRound(initial = false) {
    // one carrot per visit, always sitting on a ridge crest
    const rows = [-RIDGE_PERIOD, 0, RIDGE_PERIOD];
    const picked = [];
    let guard = 0;
    while (picked.length < SPOTS_PER_ROUND && guard++ < 500) {
      const x = rows[(this.rng() * rows.length) | 0];
      const z = -1.02 + this.rng() * 2.04;
      if (picked.some((p) => Math.hypot(p.x - x, p.z - z) < 0.52)) continue;
      picked.push({ x, z });
    }
    while (picked.length < SPOTS_PER_ROUND) {
      picked.push({ x: rows[picked.length % 3], z: -0.9 + picked.length * 0.6 });
    }
    // nearest first, so the game always suggests the closest one
    picked.sort((a, b) => b.z - a.z);
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      s.x = picked[i].x;
      s.z = picked[i].z;
      s.y = soilHeight(s.x, s.z);
      s.done = false;
      s.revealed = false;
      s.capAmount = 1;
      s.rise = 0;
      s.plant.position.set(s.x, s.y + 0.011, s.z);
      s.plant.rotation.set(0, this.rng() * 6.28, 0);
      s.plant.scale.setScalar(1);
      s.plant.visible = initial;
      s.plant.userData.setStretch(0);
      s.plant.userData.setDirt(0.80);
      s.cap.position.set(s.x, s.y - 0.004, s.z);
      s.cap.rotation.y = this.rng() * 6.28;
      s.cap.scale.setScalar(1);
      s.cap.visible = initial;
      s.hole.position.set(s.x, s.y + 0.005, s.z);
      s.hole.visible = false;
      s.marker.setAt(s.x, s.y + 0.22, s.z);
      s.marker.show(false);
    }
    const mounds = this.spots.map((s) => {
      const lp = s.plant.userData.leafProfile;
      return {
        x: s.x, z: s.z,
        baseY: s.plant.position.y,      // world height the profile is measured from
        bin: lp.bin, prof: lp.max,
        margin: 0.028,                  // snow standing over the tallest leaf
      };
    });
    if (initial) this.field.reset(true, mounds);
    else this.field.startRegrow(mounds);
  }

  get remaining() { return this.spots.filter((s) => !s.done); }

  // --------------------------------------------------------------- camera
  // Each shot: (focus, yaw, tilt°, half-width to cover in metres, min distance)
  overviewPose() {
    return framePose(new THREE.Vector3(0, 0.16, -0.10), 0.03, 25, 0.78, this.camera, 2.25);
  }
  workPose(s) {
    return framePose(new THREE.Vector3(s.x, s.y + 0.06, s.z),
      0.16 + s.x * 0.18, 45, 0.30, this.camera, 0.72);
  }
  closePose(s) {
    return framePose(new THREE.Vector3(s.x, s.y + 0.07, s.z),
      0.20 + s.x * 0.18, 38, 0.215, this.camera, 0.58);
  }
  pullPose(s) {
    return framePose(new THREE.Vector3(s.x, s.y + 0.095, s.z),
      0.22 + s.x * 0.16, 30, 0.195, this.camera, 0.54);
  }
  /**
   * Carrot and crate can be metres apart, which never fits across a phone in
   * portrait - so line the two up along the screen's LONG axis instead by
   * standing behind the carrot and looking toward the crate.
   */
  carryPose(s) {
    const c = new THREE.Vector3();
    this.crate.getWorldPosition(c);
    const dx = s.x - c.x, dz = s.z - c.z;
    const L = Math.max(0.6, Math.hypot(dx, dz));
    const yaw = Math.atan2(dx, dz);
    const focus = new THREE.Vector3((s.x + c.x) / 2, s.y + 0.30, (s.z + c.z) / 2);
    const d = 0.58 * L + 0.95;
    const tilt = (32 * Math.PI) / 180;
    return {
      pos: new THREE.Vector3(
        focus.x + Math.sin(yaw) * d * Math.cos(tilt),
        focus.y + d * Math.sin(tilt),
        focus.z + Math.cos(yaw) * d * Math.cos(tilt)
      ),
      look: focus.clone(),
    };
  }

  /** Re-frame the current shot after a rotation or window resize. */
  currentPose() {
    const s = this.active;
    switch (this.state) {
      case S.INTRO:
      case S.OVERVIEW:
      case S.REFILL: return this.overviewPose();
      case S.APPROACH:
      case S.DIG: return s ? (s.revealed ? this.closePose(s) : this.workPose(s)) : this.overviewPose();
      case S.GRAB:
      case S.PULL:
      case S.POP: return s ? this.pullPose(s) : this.overviewPose();
      case S.CARRY:
      case S.BOX: return s ? this.carryPose(s) : this.overviewPose();
      default: return this.overviewPose();
    }
  }

  refreshPose() {
    const p = this.currentPose();
    this.rig.goTo(p.pos, p.look, 0.35, easeInOutCubic);
  }

  // ---------------------------------------------------------------- states
  setState(st) { this.state = st; this.stateT = 0; }

  enterIntro() {
    // establishing shot: start wide and high, off to the side so the shed,
    // the fence line and the long rows all read before we settle on the bed
    const p = this.overviewPose();
    this.rig.set(
      new THREE.Vector3(p.pos.x + 2.6, p.pos.y * 1.75 + 0.5, p.pos.z * 1.55),
      new THREE.Vector3(-2.2, 0.5, -3.4),
      this.camera.fov
    );
    this.rig.goTo(p.pos, p.look, 5.5, easeInOutCubic);
    this.setState(S.INTRO);
    this.hint.set('none');
  }

  enterOverview(dur = 1.5) {
    const p = this.overviewPose();
    this.rig.goTo(p.pos, p.look, dur, easeInOutCubic);
    this.setState(S.OVERVIEW);
    this.hand.show(false);
    for (const s of this.spots) s.marker.show(!s.done);
    this.crateMarker.show(false);
    this.hint.set('tap');
    this.idleT = 0;
  }

  selectSpot(s) {
    this.active = s;
    for (const o of this.spots) o.marker.show(false);
    const p = this.workPose(s);
    this.rig.goTo(p.pos, p.look, 1.35, easeInOutCubic);
    this.setState(S.APPROACH);
    A.playTwinkle(1.1);
  }

  enterDig() {
    this.setState(S.DIG);
    this.hand.setGrip(0);
    const s = this.active;
    this.hand.pos.set(s.x, s.y + 0.3, s.z + 0.12);
    this.hand.target.copy(this.hand.pos);
    this.hint.set('sweep');
    this.idleT = 0;
  }

  enterGrab() {
    const s = this.active;
    this.hand.show(false);
    const p = this.pullPose(s);
    this.rig.goTo(p.pos, p.look, 1.0, easeInOutCubic);
    this.setState(S.GRAB);
    this.pullPx = 0;
    this.pullProgress = 0;
    this.hand.setGrip(1);
    this.hint.set('pull');
    this.idleT = 0;
    s.marker.show(false);
    A.playTwinkle(1.3);
  }

  enterPull() {
    this.setState(S.PULL);
    this.hint.set('none');
    this.hand.setGrip(1);
  }

  enterPop() {
    const s = this.active;
    this.setState(S.POP);
    this.hint.set('none');
    this.hand.show(false);
    A.setPullTension(0);
    A.playPop();

    const cx = s.x, cz = s.z, cy = s.y;
    this.fx.popFlare(new THREE.Vector3(cx, cy + 0.10, cz));
    this.fx.burstSparkle(cx, cy + 0.10, cz, 18, 1.3);
    this.fx.puffSoil(cx, cy + 0.02, cz, 0.25, 1.6);
    this.fx.puffSnow(cx, cy + 0.04, cz, 0, 0, 0.12);
    this.rig.addShake(0.5);

    s.hole.visible = true;
    s.plant.userData.setStretch(0);
    s.plant.userData.setDirt(0.54);
    s.cap.visible = false;

    this.popFrom = s.rise;
    this.popT = 0;
    this.held = false;

    // a slow breath in on the orange against all that white
    const p = framePose(new THREE.Vector3(s.x, s.y + 0.13, s.z),
      0.22 + s.x * 0.16, 26, 0.17, this.camera, 0.48);
    this.rig.goTo(p.pos, p.look, 2.2, easeOutCubic);
  }

  enterCarry() {
    const s = this.active;
    this.setState(S.CARRY);
    const p = this.carryPose(s);
    this.rig.goTo(p.pos, p.look, 1.3, easeInOutCubic);
    this.crateMarker.show(true);
    this.carried = false;
    this.idleT = 0;
    this.carryPos = new THREE.Vector3(s.x, s.y + 0.30, s.z);
    this.hint.set('carry');
  }

  enterBox() {
    this.setState(S.BOX);
    this.hint.set('none');
    this.crateMarker.show(false);
    const s = this.active;
    const c = new THREE.Vector3();
    this.crate.getWorldPosition(c);
    this.boxFrom = this.carryPos.clone();
    this.boxTo = c.clone();
    this.boxTo.y += 0.16;
    this.boxT = 0;
  }

  enterRefill() {
    this.setState(S.REFILL);
    this.hint.set('none');
    const p = this.overviewPose();
    this.rig.goTo(
      new THREE.Vector3(p.pos.x, p.pos.y * 1.18, p.pos.z * 1.12),
      new THREE.Vector3(0, 0.25, -0.2), 2.0, easeInOutCubic
    );
    this.world.setSnowfallIntensity(3.2);
    this.newRound(false);
  }

  // --------------------------------------------------------------- picking
  /** March the pointer ray against the real (GPU-displaced) snow surface. */
  surfaceHeight(x, z) {
    if (this.field.inside(x, z)) return soilHeight(x, z) + this.field.snowAt(x, z);
    return groundHeight(x, z);
  }

  raySurface(out) {
    const r = this.raycaster.ray;
    const o = r.origin, d = r.direction;
    let t0 = 0.02, t1 = 16;
    if (d.y < -1e-4) {
      t0 = Math.max(t0, (0.55 - o.y) / d.y);
      t1 = Math.min(t1, (-0.45 - o.y) / d.y);
    }
    if (!(t1 > t0)) { t0 = 0.02; t1 = 16; }
    const f = (t) => {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      return y - this.surfaceHeight(x, z);
    };
    let pt = t0, pv = f(t0);
    const STEPS = 64;
    for (let i = 1; i <= STEPS; i++) {
      const t = t0 + ((t1 - t0) * i) / STEPS;
      const v = f(t);
      if (pv > 0 && v <= 0) {
        let a = pt, b = t;
        for (let k = 0; k < 12; k++) {
          const m = (a + b) / 2;
          if (f(m) > 0) a = m; else b = m;
        }
        const t2 = (a + b) / 2;
        out.set(o.x + d.x * t2, o.y + d.y * t2, o.z + d.z * t2);
        return true;
      }
      pt = t; pv = v;
    }
    return false;
  }

  setRayFromScreen(x, y) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  toScreen(v) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.tmpV2.copy(v).project(this.camera);
    return { x: (this.tmpV2.x * 0.5 + 0.5) * w, y: (-this.tmpV2.y * 0.5 + 0.5) * h };
  }

  // ------------------------------------------------------------------ input
  onDown(x, y) {
    if (!this.audioStarted) {
      this.audioStarted = A.initAudio();
    }
    A.resumeAudio();
    this.pointer.down = true;
    this.pointer.x = this.pointer.px = x;
    this.pointer.y = this.pointer.py = y;
    this.pointer.moved = 0;
    this.digUp = 0;
    this.digSide = 0;
    this.hasLastWorld = false;
    this.idleT = 0;

    if (this.state === S.INTRO) {
      this.enterOverview(1.1);
      return;
    }
    if (this.state === S.OVERVIEW && !this.rig.moving) {
      this.setRayFromScreen(x, y);
      const hit = this.raySurface(this.tmpV);
      const list = this.remaining;
      if (!list.length) return;
      let best = list[0], bd = Infinity;
      for (const s of list) {
        const d = hit ? Math.hypot(s.x - this.tmpV.x, s.z - this.tmpV.z)
                      : Math.hypot(this.toScreen(new THREE.Vector3(s.x, s.y + 0.1, s.z)).x - x,
                                   this.toScreen(new THREE.Vector3(s.x, s.y + 0.1, s.z)).y - y);
        if (d < bd) { bd = d; best = s; }
      }
      this.selectSpot(best);
      return;
    }
    if (this.state === S.GRAB) {
      this.enterPull();
      return;
    }
    if (this.state === S.CARRY) {
      this.carried = true;
      this.hint.set('none');
    }
  }

  onMove(x, y) {
    const dx = x - this.pointer.x, dy = y - this.pointer.y;
    this.pointer.px = this.pointer.x; this.pointer.py = this.pointer.y;
    this.pointer.x = x; this.pointer.y = y;
    if (!this.pointer.down) return;
    this.pointer.moved += Math.hypot(dx, dy);
    this.idleT = 0;

    if (this.state === S.DIG) {
      this.sweep(x, y);
      // Once any green is showing, a decisive upward tug counts as "I want
      // that one" - the last of the snow and soil comes away with the pull
      // rather than making the child keep sweeping.
      if (dy < 0) this.digUp += -dy;
      this.digSide += Math.abs(dx);
      if (this.active && this.active.revealed &&
          this.digUp > this.pullNeed() * 0.42 && this.digUp > this.digSide * 0.9) {
        this.shortcuts++;
        this.forceUncover();
      }
    } else if (this.state === S.PULL) {
      // only upward travel counts, and nothing ever takes progress away
      if (dy < 0) this.pullPx += -dy;
      this.pullPx += Math.abs(dx) * 0.18;
    } else if (this.state === S.CARRY && this.carried) {
      this.dragCarrot(x, y);
    }
  }

  onUp() {
    this.pointer.down = false;
    this.hasLastWorld = false;
    A.setPullTension(0);
    if (this.state === S.PULL) {
      // released early: it slips back a little, but keeps most of the effort
      this.pullPx *= 0.72;
      this.setState(S.GRAB);
      this.hint.set('pull');
    }
    if (this.state === S.CARRY) this.carried = false;
  }

  // ------------------------------------------------------------- gameplay
  sweep(sx, sy) {
    this.setRayFromScreen(sx, sy);
    if (!this.raySurface(this.tmpV)) return;
    const p = this.tmpV;
    const s = this.active;

    let ax = p.x, az = p.z, steps = 1;
    if (this.hasLastWorld) {
      const dist = Math.hypot(p.x - this.lastWorld.x, p.z - this.lastWorld.z);
      steps = clamp(Math.ceil(dist / 0.028), 1, 14);
    }
    let movedTotal = 0;
    let dirX = 0, dirZ = 0;
    for (let i = 1; i <= steps; i++) {
      const t = steps === 1 ? 1 : i / steps;
      const x = this.hasLastWorld ? lerp(this.lastWorld.x, p.x, t) : p.x;
      const z = this.hasLastWorld ? lerp(this.lastWorld.z, p.z, t) : p.z;
      if (!this.field.inside(x, z)) continue;
      const strength = this.hasLastWorld ? 0.030 : 0.016;
      const local = this.field.snowAt(x, z);
      if (local > 0.004) {
        movedTotal += this.field.brush(x, z, BRUSH_R, strength);
      } else {
        // bare soil now: scrub it, which is what frees the crown
        this.field.scrub(x, z, BRUSH_R * 0.8, strength * 1.2);
        if (this.rng() < 0.16) {
          this.fx.puffSoil(x, soilHeight(x, z), z, 0.04, 0.45);
        }
        movedTotal += 0.0004;
      }
      ax = x; az = z;
    }
    if (this.hasLastWorld) {
      dirX = p.x - this.lastWorld.x;
      dirZ = p.z - this.lastWorld.z;
    }
    const speed = Math.hypot(dirX, dirZ) * 60;

    // free the crown once the snow above it is gone
    if (s) {
      const dd = Math.hypot(ax - s.x, az - s.z);
      if (dd < 0.19 && this.field.snowAround(s.x, s.z, 0.075) < 0.055 && s.capAmount > 0) {
        const before = s.capAmount;
        s.capAmount = Math.max(0, s.capAmount - (0.010 + Math.min(0.05, speed * 0.02)));
        if (before > s.capAmount) {
          this.fx.puffSoil(ax, soilHeight(ax, az) + 0.01, az, 0.05, 0.6);
        }
      }
    }

    if (movedTotal > 0.00015) {
      const inSoil = this.field.snowAt(ax, az) <= 0.006;
      this.fx.puffSnow(ax, this.surfaceHeight(ax, az), az, dirX * 8, dirZ * 8,
                       Math.min(0.05, movedTotal * (inSoil ? 0.2 : 1)));
      A.playBrush(clamp01(speed * 0.55), inSoil ? 0.9 : 0);
    }

    this.hand.moveTo(ax, this.surfaceHeight(ax, az), az, dirX, dirZ, Math.min(1, speed * 0.5));
    this.lastWorld.set(p.x, p.y, p.z);
    this.hasLastWorld = true;
  }

  /**
   * Dragging the pulled carrot moves it across the ground, not across a plane
   * facing the camera: a swipe toward the crate always closes the distance to
   * the crate, however the shot happens to be angled.
   */
  /** Whisk away the remaining snow and soil, then go straight into the pull. */
  forceUncover() {
    const s = this.active;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      for (let r = 0; r <= 6; r++) {
        this.field.brush(s.x + Math.cos(a) * r * 0.026, s.z + Math.sin(a) * r * 0.026, 0.105, 0.8);
      }
    }
    this.field.scrub(s.x, s.z, 0.15, 0.5);
    s.capAmount = 0;
    this.fx.puffSnow(s.x, this.surfaceHeight(s.x, s.z), s.z, 0, 0, 0.07);
    this.fx.puffSoil(s.x, s.y + 0.012, s.z, 0.09, 0.8);
    A.playBrush(1, 0.35);
    const carried = this.digUp;
    this.enterGrab();
    this.enterPull();
    this.pullPx = carried;
  }

  dragCarrot(sx, sy) {
    this.setRayFromScreen(sx, sy);
    this.plane.set(this._up, -this.carryPos.y);
    const hit = this.tmpV2;
    if (this.raycaster.ray.intersectPlane(this.plane, hit)) {
      this.carryPos.x = lerp(this.carryPos.x, hit.x, 0.6);
      this.carryPos.z = lerp(this.carryPos.z, hit.z, 0.6);
    }
    const gy = this.surfaceHeight(this.carryPos.x, this.carryPos.z) + 0.24;
    this.carryPos.y = damp(this.carryPos.y, gy, 7, 1 / 60);
  }

  /** Where the next carrot sits inside the crate. */
  crateSlot(i) {
    const k = i % CRATE_SLOTS;
    const layer = Math.floor(k / 6);
    const n = k % 6;
    const col = n % 3, row = Math.floor(n / 3);
    return new THREE.Vector3(
      -0.13 + col * 0.13 + (layer ? 0.045 : 0),
      0.035 + layer * 0.045,
      -0.06 + row * 0.115 + (layer ? 0.02 : 0)
    );
  }

  addToCrate() {
    const c = makeHarvestedCarrot(4);
    const slot = this.crateSlot(this.crateCount);
    c.position.copy(slot);
    c.rotation.set(
      Math.PI / 2 + (this.rng() - 0.5) * 0.4,
      this.rng() * 6.28,
      (this.rng() - 0.5) * 0.5
    );
    this.cratePile.add(c);
    this.crateCount++;
    if (this.cratePile.children.length > CRATE_SLOTS) {
      const old = this.cratePile.children[0];
      this.cratePile.remove(old);
    }
  }

  // ------------------------------------------------------------------ tick
  update(dt) {
    // freeze-frame on the pop, so the orange gets a beat of silence
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      if (this.freezeT <= 0) this.timeScaleTarget = 1;
    }
    this.timeScale = damp(this.timeScale, this.timeScaleTarget, 9, dt);
    const sdt = dt * this.timeScale;
    this.stateT += dt;
    if (!this.pointer.down) this.idleT += dt;

    this.field.update(sdt);
    this.world.update(sdt, this.camera, this.renderer.getPixelRatio());
    this.fx.update(sdt, (x, z) => this.surfaceHeight(x, z), this.renderer.getPixelRatio());
    for (const s of this.spots) s.marker.update(sdt);
    this.crateMarker.update(sdt);
    this.hand.update(dt, this.camera);
    this.rig.update(dt);

    for (const s of this.spots) {
      if (!s.done && s.plant.visible) s.plant.userData.setWind(this.stateT + s.x * 3);
    }

    switch (this.state) {
      case S.INTRO: this.tickIntro(dt); break;
      case S.OVERVIEW: this.tickOverview(dt); break;
      case S.APPROACH: this.tickApproach(dt); break;
      case S.DIG: this.tickDig(dt); break;
      case S.GRAB: this.tickGrab(dt); break;
      case S.PULL: this.tickPull(dt); break;
      case S.POP: this.tickPop(dt); break;
      case S.CARRY: this.tickCarry(dt); break;
      case S.BOX: this.tickBox(dt); break;
      case S.REFILL: this.tickRefill(dt); break;
    }

    this.hint.update(dt);
  }

  tickIntro() {
    if (this.stateT > 5.2) this.enterOverview(1.2);
  }

  tickOverview(dt) {
    if (this.rig.moving) return;
    const list = this.remaining;
    if (!list.length) { this.enterRefill(); return; }
    // point at the nearest untouched spot so a tap is always suggested
    const s = list[0];
    // anchor the pointing hand on the snow surface, where the marker ring sits
    const p = this.toScreen(this.tmpV.set(s.x, this.field.surfaceY(s.x, s.z) + 0.02, s.z));
    this.hint.set('tap', p);
    this.hint.setAnchor(p.x, p.y);
    // never let a child get stuck staring at the field
    if (this.idleT > 11) this.selectSpot(s);
  }

  tickApproach() {
    if (!this.rig.moving) this.enterDig();
  }

  tickDig(dt) {
    const s = this.active;
    // measured over a small disc so the ploughed rim beside the hole does not
    // hide the fact that the middle is already clear
    const snowLeft = this.field.snowAround(s.x, s.z, 0.075);

    // soil cap shrinks as it is scrubbed off the crown
    const cs = clamp01(s.capAmount);
    s.cap.visible = cs > 0.04;
    s.cap.scale.set(lerp(0.55, 1, cs), lerp(0.15, 1, cs), lerp(0.55, 1, cs));

    if (!s.revealed && snowLeft < s.leafHeight - 0.004) {
      s.revealed = true;
      A.playReveal();
      this.fx.burstSparkle(s.x, s.y + s.leafHeight * 0.85, s.z, 12, 0.45);
      const p = this.closePose(s);
      this.rig.goTo(p.pos, p.look, 1.5, easeInOutCubic);
    }

    // hand hint follows the spot until the player takes over
    const scr = this.toScreen(this.tmpV.set(s.x, s.y + snowLeft + 0.015, s.z));
    this.hint.setAnchor(scr.x, scr.y);
    this.hint.set(this.pointer.moved > 40 && this.idleT < 2.2 ? 'none' : 'sweep');

    // the mitten only exists while a finger is on the glass
    this.hand.show(this.pointer.down);
    // a soft ring keeps saying "here" until the digging is well under way
    s.marker.show(!s.revealed, 0.55);

    if (snowLeft < 0.014 && s.capAmount <= 0.08) this.enterGrab();
  }

  tickGrab(dt) {
    const s = this.active;
    const scr = this.toScreen(this.tmpV.set(s.x, s.y + s.leafHeight * 0.62, s.z));
    this.hint.setAnchor(scr.x, scr.y);
    // From here on the child's own finger is the hand: the framing is far too
    // tight for the mitten, and it would sit right on top of the carrot.
    this.hand.show(false);
    // gently settle back toward the ground if they let go
    this.pullProgress = damp(this.pullProgress, this.pullPx / this.pullNeed(), 6, dt);
    this.applyRise(s, this.pullProgress);
  }

  pullNeed() {
    return Math.max(120, this.container.clientHeight * 0.20);
  }

  /** Non-linear give: sticks, then yields, so the release feels earned. */
  riseCurve(p) {
    if (p < 0.28) return 0.055 * (p / 0.28);
    if (p < 0.82) return 0.055 + 0.36 * Math.pow((p - 0.28) / 0.54, 1.25);
    return 0.415 + 0.30 * ((p - 0.82) / 0.18);
  }

  applyRise(s, progress) {
    const p = clamp01(progress);
    s.rise = this.riseCurve(p) * CARROT_LEN;
    const shudder = p > 0.2 ? (Math.random() - 0.5) * 0.0022 * p : 0;
    s.plant.position.set(s.x + shudder, s.y + 0.004 + s.rise, s.z + shudder * 0.6);
    s.plant.userData.setStretch(p * 0.85);
    if (p > 0.05) {
      s.hole.visible = true;
      s.hole.scale.setScalar(lerp(0.35, 1, clamp01(p * 1.4)));
    }
  }

  tickPull(dt) {
    const s = this.active;
    // holding on slowly wins even without much movement - nobody gets stuck
    if (this.pointer.down) this.pullPx += dt * this.pullNeed() * 0.16;
    const raw = this.pullPx / this.pullNeed();
    const prev = this.pullProgress;
    this.pullProgress = damp(this.pullProgress, raw, 14, dt);
    this.applyRise(s, this.pullProgress);
    A.setPullTension(clamp01(this.pullProgress * 1.1));

    if (this.pullProgress - prev > 0.0025) {
      if (this.rng() < 0.55) {
        this.fx.puffSoil(s.x, s.y + 0.01, s.z, 0.03, 0.35);
      }
      this.field.scrub(s.x, s.z, 0.11, 0.02);
      this.rig.addShake(0.05);
    }
    const scr = this.toScreen(this.tmpV.set(s.x, s.y + s.leafHeight * 0.55 + s.rise, s.z));
    this.hint.setAnchor(scr.x, scr.y);

    if (this.pullProgress >= 0.995) this.enterPop();
  }

  tickPop(dt) {
    const s = this.active;
    this.popT += dt;
    const t = clamp01(this.popT / 0.34);
    const e = easeOutBack(t);
    const to = CARROT_LEN * 1.06 + 0.045;
    s.rise = lerp(this.popFrom, to, e);
    s.plant.position.set(s.x, s.y + 0.004 + s.rise, s.z);
    s.plant.rotation.z = Math.sin(t * Math.PI) * 0.22;
    s.plant.rotation.x = Math.sin(t * Math.PI * 1.4) * 0.10;
    s.plant.userData.setStretch(lerp(0.85, 0.0, t));
    // once it is clear of the ground, hold the world still for a beat so the
    // orange gets a moment alone against all that white
    if (!this.held && t >= 1) {
      this.held = true;
      this.freezeT = 0.62;
      this.timeScaleTarget = 0.14;
    }
    if (this.stateT > 2.0) this.enterCarry();
  }

  tickCarry(dt) {
    const s = this.active;
    const c = this.cratePos;
    this.crate.getWorldPosition(c);

    if (!this.carried) {
      // bob invitingly in mid-air
      this.carryPos.y = damp(this.carryPos.y, s.y + 0.34, 4, dt)
        + Math.sin(this.stateT * 2.4) * 0.0016;
    }
    // Nobody ever gets stuck holding a carrot: leave it alone for a moment,
    // or wrestle with it for a while, and it drifts over to the crate itself.
    if ((!this.carried && this.idleT > 2.2) || this.stateT > 7) {
      this.carryPos.lerp(this.tmpV.set(c.x, c.y + 0.30, c.z), 1 - Math.exp(-2.0 * dt));
    }
    // Tip the carrot across the line of sight, whichever way the shot is
    // angled, so its whole orange length is on show rather than pointing
    // straight down the lens.
    this._axis.set(c.x - this.camera.position.x, 0, c.z - this.camera.position.z).normalize();
    this._q.setFromAxisAngle(this._axis, 0.80 + Math.sin(this.stateT * 1.5) * 0.06);
    s.plant.quaternion.slerp(this._q, 1 - Math.exp(-5 * dt));
    s.plant.position.copy(this.carryPos);
    // gathered in a fist, the way you actually carry a carrot by its tops
    s.plant.userData.setStretch(Math.min(0.88, this.stateT * 1.2));

    const scr = this.toScreen(this.carryPos);
    const cs = this.toScreen(this.tmpV.set(c.x, c.y + 0.22, c.z));
    this.hint.setAnchor(scr.x, scr.y);
    this.hint.setSecondary(cs.x, cs.y);
    if (!this.carried && this.idleT > 0.8) this.hint.set('carry');

    const d = Math.hypot(this.carryPos.x - c.x, this.carryPos.z - c.z);
    if (d < 0.42 && this.stateT > 0.5) this.enterBox();
  }

  tickBox(dt) {
    const s = this.active;
    this.boxT += dt;
    const t = clamp01(this.boxT / 0.5);
    const e = easeOutCubic(t);
    s.plant.position.lerpVectors(this.boxFrom, this.boxTo, e);
    s.plant.position.y += Math.sin(t * Math.PI) * 0.09;   // little arc
    this._q.setFromAxisAngle(this._axis, 0.80 + e * 0.75);  // tips over as it drops in
    s.plant.quaternion.slerp(this._q, 1 - Math.exp(-6 * dt));
    s.plant.scale.setScalar(lerp(1, 0.85, e));
    if (t >= 1 && !s.done) {
      s.done = true;
      s.plant.visible = false;
      s.hole.visible = false;
      s.cap.visible = false;
      A.playKnock();
      this.addToCrate();
      const c = this.boxTo;
      this.fx.burstSparkle(c.x, c.y, c.z, 16, 0.55);
      this.rig.addShake(0.14);
    }
    if (this.boxT > 1.15) {
      if (this.remaining.length) this.enterOverview(1.6);
      else this.enterRefill();
    }
  }

  tickRefill(dt) {
    this.world.setSnowfallIntensity(lerp(1, 3.4, Math.sin(clamp01(this.stateT / 3.4) * Math.PI)));
    // slip the new crop back in only once the snow is deep enough to hide it
    if (this.stateT > 2.2) {
      for (const s of this.spots) { s.plant.visible = true; s.cap.visible = true; }
    }
    if (this.stateT > 4.2) {
      this.world.setSnowfallIntensity(1);
      this.enterOverview(1.6);
    }
  }
}
