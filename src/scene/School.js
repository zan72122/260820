/**
 * The fish, and how they behave.
 *
 * Deliberately not a flocking simulation. Each fish is a heading, a speed and
 * a preferred depth, steered by four small opinions — wander, stay in the tub,
 * get away from that thing, and (when the paper is genuinely underneath them)
 * drift towards its middle. That last one is the assist: it is a force with a
 * speed cap, never a snap, so a four-year-old is helped without being able to
 * feel the game playing itself.
 */

import * as THREE from 'three';
import { buildFishBody, buildFishFins, applySwim, makeSwimUniforms } from './Fish.js';
import { fishTexture, finTexture } from './textures.js';
import { clamp, damp, lerp, smoothstep, angleDelta, TAU } from '../core/Rng.js';
import { evaluateCatch, attractionWeight, supportRatio, CAPTURE } from '../game/capture.js';

const VARIETIES = [
  { kind: 'wakin', depth: 0.4, plump: 0.6, tail: 0.6, mass: 0.85 },
  { kind: 'sarasa', depth: 0.44, plump: 0.65, tail: 0.72, mass: 0.95 },
  { kind: 'demekin', depth: 0.54, plump: 0.8, tail: 0.8, mass: 1.25 },
  { kind: 'calico', depth: 0.46, plump: 0.68, tail: 0.68, mass: 1.0 },
];

export const FISH_MODE = {
  SWIM: 'swim',
  ON_PAPER: 'onPaper',
  TO_BOWL: 'toBowl',
  IN_BOWL: 'inBowl',
};

class Fish {
  constructor(spec, meshes) {
    this.spec = spec;
    this.group = meshes.group;
    this.body = meshes.body;
    this.fins = meshes.fins;
    this.uniforms = meshes.uniforms;
    this.shadow = meshes.shadow;

    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = spec.cruise;
    this.roll = 0;
    this.pitch = 0;
    this.mode = FISH_MODE.SWIM;
    this.wanderPhase = spec.phase;
    this.threat = 0;
    this.burst = 0;
    this.assist = new THREE.Vector2();
    this.paperX = 0;
    this.paperY = 0;
    this._flankSide = 1;
    this.struggle = 0;
    this.airTime = 0;
    this.bowlT = 0;
    this.forgiveness = 0;
    this.guide = 0;
    this.depthTarget = spec.depth;
    this._flickCooldown = 0;
    this._breakSurface = false;
  }

  get halfWidthDisc() {
    // The footprint that has to rest on paper: the body, not the fins.
    return (this.spec.length * 0.32) / this.spec.poiRadius;
  }

  setPose() {
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
  }
}

export class School {
  /**
   * @param {object} o
   * @param {import('../core/Rng.js').Rng} o.rng
   * @param {object} o.settings
   * @param {number} o.poiRadius
   */
  constructor({ rng, settings, poiRadius }) {
    this.rng = rng;
    this.settings = settings;
    this.poiRadius = poiRadius;
    this.group = new THREE.Group();
    this.group.name = 'school';
    this.fish = [];
    this.bounds = { rx: 0.48, rz: 0.62 };
    this.floorY = -0.16;
    this.texCache = new Map();
    this.shadowTexture = this._makeShadowTexture();
    this.shadowGroup = new THREE.Group();
    this.group.add(this.shadowGroup);
    this.events = [];
  }

  _makeShadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.62)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }

  _textures(kind) {
    if (!this.texCache.has(kind)) {
      this.texCache.set(kind, { map: fishTexture(kind), fin: finTexture(kind) });
    }
    return this.texCache.get(kind);
  }

  /**
   * @param {number} count
   * @param {object} [firstOverride] gentler numbers for the fish the child meets first
   */
  populate(count, firstOverride) {
    const rng = this.rng;
    for (let i = 0; i < count; i++) {
      const v = VARIETIES[i % VARIETIES.length];
      const spec = {
        kind: v.kind,
        length: rng.range(0.088, 0.126),
        depth: v.depth,
        plump: v.plump,
        tail: v.tail,
        mass: v.mass,
        poiRadius: this.poiRadius,
        cruise: rng.range(0.055, 0.125),
        turnRate: rng.range(1.15, 2.7),
        wanderRate: rng.range(0.35, 0.95),
        wanderAmp: rng.range(0.5, 1.4),
        skittish: rng.range(0.45, 1.0),
        depthPref: rng.range(-0.085, -0.03),
        phase: rng.range(0, TAU),
        waveAmp: rng.range(0.055, 0.085),
        waveSpeed: rng.range(6.2, 10.4),
        waveK: rng.range(3.4, 4.7),
      };
      if (i === 0 && firstOverride) Object.assign(spec, firstOverride);

      const f = this._spawn(spec);
      // Scatter them, but keep the first one out where it can be seen.
      const a = rng.range(0, TAU);
      const r = i === 0 ? 0.45 : rng.range(0.15, 0.8);
      f.pos.set(Math.cos(a) * this.bounds.rx * r, spec.depthPref, Math.sin(a) * this.bounds.rz * r);
      f.heading = rng.range(0, TAU);
      f.depthTarget = spec.depthPref;
      f.setPose();
      this.fish.push(f);
    }
    return this.fish;
  }

  _spawn(spec) {
    const tex = this._textures(spec.kind);
    const uniforms = makeSwimUniforms(spec);

    const bodyMat = applySwim(
      new THREE.MeshStandardMaterial({
        map: tex.map,
        roughness: 0.28,
        metalness: 0.06,
        envMapIntensity: 0.6,
      }),
      uniforms,
      'body'
    );
    const finMat = applySwim(
      new THREE.MeshStandardMaterial({
        map: tex.fin,
        transparent: true,
        opacity: 0.92,
        roughness: 0.42,
        metalness: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      uniforms,
      'fin'
    );

    const body = new THREE.Mesh(buildFishBody(spec), bodyMat);
    const fins = new THREE.Mesh(buildFishFins(spec), finMat);
    fins.renderOrder = 6;
    body.castShadow = false;
    body.receiveShadow = false;

    const group = new THREE.Group();
    group.add(body, fins);
    this.group.add(group);

    // A soft blob on the gravel instead of a real shadow map: underwater the
    // difference is invisible, and the shadow budget belongs to the poi.
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.length * 2.1, spec.length * 1.1),
      new THREE.MeshBasicMaterial({
        map: this.shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
        color: 0x000000,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 2;
    this.shadowGroup.add(shadow);

    return new Fish(spec, { group, body, fins, uniforms, shadow });
  }

  setBounds(rx, rz) {
    this.bounds.rx = rx;
    this.bounds.rz = rz;
  }

  /** Fish that are still in the water and catchable. */
  get swimming() {
    return this.fish.filter((f) => f.mode === FISH_MODE.SWIM);
  }

  get carried() {
    return this.fish.find((f) => f.mode === FISH_MODE.ON_PAPER) || null;
  }

  /**
   * @param {number} dt
   * @param {object} ctx
   * @param {import('./Poi.js').Poi} ctx.poi
   * @param {boolean} ctx.catchingEnabled
   * @param {number} ctx.time
   * @param {(x:number,z:number)=>number} ctx.waterHeightAt
   */
  update(dt, ctx) {
    this.events.length = 0;
    const poi = ctx.poi;
    const poiX = poi.group.position.x;
    const poiZ = poi.group.position.z;
    const poiY = poi.group.position.y;

    for (const f of this.fish) {
      f.uniforms.uTime.value = ctx.time;
      f.burst = Math.max(0, f.burst - dt * 2.4);
      f.uniforms.uBurst.value = f.burst;
      f._flickCooldown = Math.max(0, f._flickCooldown - dt);

      switch (f.mode) {
        case FISH_MODE.SWIM:
          this._swim(f, dt, ctx, poiX, poiY, poiZ);
          if (ctx.catchingEnabled) this._tryCatch(f, ctx);
          break;
        case FISH_MODE.ON_PAPER:
          this._ride(f, dt, ctx);
          break;
        case FISH_MODE.TO_BOWL:
          this._toBowl(f, dt, ctx);
          break;
        case FISH_MODE.IN_BOWL:
          this._inBowl(f, dt, ctx);
          break;
      }
      f.setPose();
      this._updateShadow(f);
    }
    return this.events;
  }

  _updateShadow(f) {
    const s = f.shadow;
    if (f.mode === FISH_MODE.IN_BOWL || f.mode === FISH_MODE.TO_BOWL) {
      s.visible = false;
      return;
    }
    s.visible = true;
    const drop = clamp((f.pos.y - this.floorY) / 0.2, 0, 1.6);
    s.position.set(f.pos.x + drop * 0.03, this.floorY + 0.002, f.pos.z + drop * 0.02);
    s.rotation.z = -f.heading;
    // A fish shrinking out at the bowl must not leave its shadow behind.
    const fade = f.group.scale.x;
    const spread = (1 + drop * 0.85) * fade;
    s.scale.set(spread, spread, 1);
    s.material.opacity = (0.55 / (1 + drop * 1.5)) * fade;
  }

  // ------------------------------------------------------------------ swim

  _swim(f, dt, ctx, poiX, poiY, poiZ) {
    const s = f.spec;
    const rng = this.rng;

    // 1. wander
    f.wanderPhase += dt * s.wanderRate;
    let desired =
      f.heading + Math.sin(f.wanderPhase) * s.wanderAmp * dt * 2.4 + rng.sym(0.35) * dt;

    // 2. stay in the tub — an elliptical fence with a soft inner margin
    const nx = f.pos.x / this.bounds.rx;
    const nz = f.pos.z / this.bounds.rz;
    const e = Math.hypot(nx, nz);
    if (e > 0.68) {
      const inward = Math.atan2(-f.pos.x, -f.pos.z);
      const w = smoothstep(0.68, 1.02, e);
      desired = f.heading + angleDelta(f.heading, inward) * w;
      if (e > 1.0) {
        // never let a fish leave the tub, even if the maths gets surprised
        const k = 1 / e;
        f.pos.x *= k;
        f.pos.z *= k;
      }
    }

    // 3. that thing in the water. A still poi is barely worth noticing; a poi
    //    swiping across the tub is terrifying. This is what teaches "gently".
    const dx = f.pos.x - poiX;
    const dz = f.pos.z - poiZ;
    const dist = Math.hypot(dx, dz);
    const near = smoothstep(0.34, 0.05, dist);
    const motion = clamp(ctx.poi.planarSpeed / 0.55, 0, 1.4);
    const fromAbove = clamp((poiY - f.pos.y) / 0.09, 0, 1);
    let threat = near * (0.16 + motion * 0.95 + fromAbove * 0.55) * s.skittish;
    threat *= 1 - f.forgiveness * 0.82;
    f.threat = damp(f.threat, clamp(threat, 0, 1), 9, dt);

    if (f.threat > 0.03) {
      const away = Math.atan2(dx, dz);
      desired = f.heading + angleDelta(f.heading, away) * f.threat * 0.85;
      if (f.threat > 0.45 && f._flickCooldown <= 0) {
        f.burst = 1;
        f._flickCooldown = 0.9;
        this.events.push({ type: 'dart', fish: f, strength: f.threat });
      }
    }

    // 4. the assist: once the paper really is underneath, ease the fish over
    //    its middle. A force with a ceiling — never a snap.
    const local = ctx.poi.worldToPaperLocal(f.pos);
    const distNorm = Math.hypot(local.x, local.y);
    const w = attractionWeight(distNorm, -local.above, ctx.poi.submerge, f.forgiveness);
    if (w > 0.001 && ctx.catchingEnabled) {
      const target = ctx.poi.paperWorldPoint(0, 0);
      const ax = target.x - f.pos.x;
      const az = target.z - f.pos.z;
      const len = Math.hypot(ax, az) || 1;
      const cap = CAPTURE.attractMaxSpeed * w * (1 + f.forgiveness * 0.5);
      f.assist.x = damp(f.assist.x, (ax / len) * cap, CAPTURE.attractAccel, dt);
      f.assist.y = damp(f.assist.y, (az / len) * cap, CAPTURE.attractAccel, dt);
      f.threat *= 1 - w * 0.55;
    } else {
      f.assist.x = damp(f.assist.x, 0, 5, dt);
      f.assist.y = damp(f.assist.y, 0, 5, dt);
    }

    // 5. the first fish is quietly kept in play near the poi, without ever
    //    swimming at it: it aims at a point off the poi's shoulder.
    if (f.guide > 0) {
      const lead = 0.14;
      const gx = poiX + Math.cos(ctx.time * 0.6) * lead;
      const gz = poiZ + Math.sin(ctx.time * 0.6) * lead;
      const toGuide = Math.atan2(gx - f.pos.x, gz - f.pos.z);
      const far = smoothstep(0.1, 0.4, Math.hypot(gx - f.pos.x, gz - f.pos.z));
      desired = f.heading + angleDelta(f.heading, toGuide) * f.guide * far * 0.55;
    }

    // integrate heading
    const turn = angleDelta(f.heading, desired);
    const maxTurn = s.turnRate * (1 + f.threat * 1.6) * dt;
    const applied = clamp(turn, -maxTurn, maxTurn);
    f.heading += applied;
    f.uniforms.uBend.value = damp(f.uniforms.uBend.value, clamp(-applied / Math.max(dt, 1e-3) * 0.06, -0.28, 0.28), 8, dt);
    f.roll = damp(f.roll, clamp((applied / Math.max(dt, 1e-3)) * 0.16, -0.5, 0.5), 7, dt);

    // speed: cruising, plus a shot of adrenaline
    const targetSpeed = s.cruise * (1 + f.threat * 2.1) * (1 - f.guide * 0.35);
    f.speed = damp(f.speed, targetSpeed, 3.4, dt);
    f.uniforms.uWaveSpeed.value = s.waveSpeed * (0.75 + (f.speed / s.cruise) * 0.4);

    f.pos.x += Math.sin(f.heading) * f.speed * dt + f.assist.x * dt;
    f.pos.z += Math.cos(f.heading) * f.speed * dt + f.assist.y * dt;

    // depth: they dive when scared and hang shallow when calm
    const wantDepth = clamp(s.depthPref - f.threat * 0.045, this.floorY + 0.022, -0.028);
    f.depthTarget = damp(f.depthTarget, wantDepth, 1.6, dt);
    const bob = Math.sin(ctx.time * 0.9 + s.phase) * 0.004;
    f.pos.y = damp(f.pos.y, f.depthTarget + bob, 3.2, dt);
    f.pitch = damp(f.pitch, clamp((f.depthTarget - f.pos.y) * 2.4, -0.35, 0.35), 5, dt);
  }

  // ------------------------------------------------------------- on the poi

  _tryCatch(f, ctx) {
    const poi = ctx.poi;
    if (poi.paper.destroyed) return;
    if (this.carried) return;
    const local = poi.worldToPaperLocal(f.pos);
    const res = evaluateCatch({
      paper: poi.paper,
      lx: local.x,
      ly: local.y,
      above: local.above,
      halfWidth: f.halfWidthDisc,
      liftSpeed: poi.liftSpeed,
      forgiveness: f.forgiveness,
    });
    if (!res.caught) return;

    f.mode = FISH_MODE.ON_PAPER;
    f._flankSide = this.rng.next() < 0.5 ? -1 : 1;
    f.paperX = clamp(local.x, -0.7, 0.7);
    f.paperY = clamp(local.y, -0.7, 0.7);
    f.struggle = 1;
    f.airTime = 0;
    f.burst = 1;
    f.assist.set(0, 0);
    f._breakSurface = false;
    this.events.push({ type: 'caught', fish: f });
  }

  _ride(f, dt, ctx) {
    const poi = ctx.poi;
    const wasAir = f.pos.y > ctx.waterHeightAt(f.pos.x, f.pos.z);

    // Fish thrash hardest the moment they leave the water, then give up.
    f.struggle = damp(f.struggle, 0.12, 0.75, dt);
    const wob = Math.sin(ctx.time * 17 + f.spec.phase) * f.struggle;
    const wob2 = Math.sin(ctx.time * 11.3 + f.spec.phase * 1.7) * f.struggle;

    // A struggling fish walks a little across the sheet — which is exactly how
    // a real one finds the hole you just made.
    f.paperX = clamp(f.paperX + wob * dt * 0.55, -0.85, 0.85);
    f.paperY = clamp(f.paperY + wob2 * dt * 0.55, -0.85, 0.85);

    const p = poi.paperWorldPoint(f.paperX, f.paperY);
    const sagY = -poi.uniforms.uSag.value * poi.radius * 0.6;
    f.pos.set(p.x, p.y + sagY + f.spec.length * 0.09, p.z);
    f.heading = damp(f.heading, poi.yaw + Math.PI * 0.5 + wob * 0.35, 6, dt);
    // A landed fish lies on its flank and flaps. That pose is also the one
    // that shows the child a whole goldfish rather than a lump.
    const flank = 1.45 * f._flankSide;
    f.roll = damp(f.roll, flank, 7, dt) + wob * 0.42;
    f.pitch = wob2 * 0.22;
    f.uniforms.uWaveSpeed.value = lerp(4.0, 18.0, f.struggle);
    f.burst = Math.max(f.burst, f.struggle * 0.8);

    const waterY = ctx.waterHeightAt(f.pos.x, f.pos.z);
    if (!f._breakSurface && f.pos.y > waterY + f.spec.length * 0.05) {
      f._breakSurface = true;
      this.events.push({ type: 'surfaced', fish: f });
    }
    if (f.pos.y > waterY) f.airTime += dt;
    else f.airTime = Math.max(0, f.airTime - dt * 2);
    if (!wasAir && f.pos.y > waterY) f.burst = 1;

    // Did the paper give way underneath it?
    const support = supportRatio(poi.paper, f.paperX, f.paperY, f.halfWidthDisc);
    const offSheet = Math.hypot(f.paperX, f.paperY) > 1.02;
    if (poi.paper.destroyed || support < 0.34 || offSheet) {
      f.mode = FISH_MODE.SWIM;
      f.threat = 1;
      f.burst = 1;
      f.struggle = 0;
      f.speed = f.spec.cruise * 2.2;
      this.events.push({ type: 'escaped', fish: f, throughHole: !offSheet });
      return;
    }

    // Into the bowl: immediately if the child carries it there, otherwise the
    // stall keeper's rhythm takes over after a beat, so nobody gets stuck
    // holding a fish while the paper quietly dissolves.
    const toBowl = Math.hypot(f.pos.x - ctx.bowl.x, f.pos.z - ctx.bowl.z);
    if (f.airTime > 0.28 && (toBowl < 0.14 || f.airTime > 1.05)) {
      f.mode = FISH_MODE.TO_BOWL;
      f.bowlT = 0;
      f._from = f.pos.clone();
      this.events.push({ type: 'toBowl', fish: f });
    }
  }

  _toBowl(f, dt, ctx) {
    f.bowlT = Math.min(1, f.bowlT + dt / 0.55);
    const t = f.bowlT;
    const ease = t * t * (3 - 2 * t);
    const from = f._from;
    const to = ctx.bowl;
    f.pos.x = lerp(from.x, to.x, ease);
    f.pos.z = lerp(from.z, to.z, ease);
    const arc = Math.sin(Math.PI * t) * 0.075;
    f.pos.y = lerp(from.y, to.y - 0.012, ease) + arc;
    f.heading = damp(f.heading, Math.atan2(to.x - from.x, to.z - from.z), 6, dt);
    f.roll = damp(f.roll, 0.6 * (1 - t), 6, dt);
    f.uniforms.uWaveSpeed.value = 14;
    if (t >= 1) {
      f.mode = FISH_MODE.IN_BOWL;
      f.bowlT = this.rng.range(0, TAU);
      this.events.push({ type: 'delivered', fish: f });
    }
  }

  _inBowl(f, dt, ctx) {
    f.bowlT += dt * 0.85;
    const r = 0.028 + (f.spec.length - 0.09) * 0.1;
    f.pos.set(
      ctx.bowl.x + Math.cos(f.bowlT) * r,
      ctx.bowl.y - 0.014 + Math.sin(f.bowlT * 2.1) * 0.004,
      ctx.bowl.z + Math.sin(f.bowlT) * r
    );
    f.heading = -f.bowlT + Math.PI * 0.5;
    f.roll = damp(f.roll, 0, 4, dt);
    f.pitch = 0;
    f.uniforms.uWaveSpeed.value = 5.5;
    f.group.scale.setScalar(0.86);
  }

  dispose() {
    for (const f of this.fish) {
      f.body.geometry.dispose();
      f.body.material.dispose();
      f.fins.geometry.dispose();
      f.fins.material.dispose();
      f.shadow.geometry.dispose();
      f.shadow.material.dispose();
    }
    this.shadowTexture.dispose();
    for (const t of this.texCache.values()) {
      t.map.dispose();
      t.fin.dispose();
    }
  }
}
