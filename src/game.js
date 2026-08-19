// Game logic: what the finger does, where the camera looks, and what happens to
// a lump of snow between the road and the dark.
import * as THREE from '../vendor/three/three.module.min.js';
import { CFG, blobGeometry } from './world.js';
import * as TX from './textures.js';
import { makeRng, clamp, lerp, smoothstep } from './noise.js';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const HINTS = {
  lid: 'ふたを タップ',
  reveal: 'したに おみずが ながれてる！',
  shovel: 'ゆきを あなに いれよう',
  carried: 'あなの ちかくで はなしてね',
  flowed: 'おみずが はこんでくれた！',
  cleared: 'きれいに なったね',
  next: 'つぎの ふたを タップ',
  finale: 'ぜんぶ きれいに なった！',
};

const CHANNEL_MID = (CFG.chZ0 + CFG.chZ1) / 2;

export class Game {
  constructor({ renderer, scene, camera, world, audio, ui }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.audio = audio;
    this.ui = ui;

    this.state = 'intro';
    this.active = 0;
    this.time = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.rng = makeRng(24601);

    this.piles = [];
    this.chunks = [];
    this.ripples = [];
    this.carry = null;
    this.drag = null;
    this.magnetHold = 0;
    this.hasFlowedOnce = false;

    this.cam = {
      pos: new THREE.Vector3(), look: new THREE.Vector3(),
      from: { pos: new THREE.Vector3(), look: new THREE.Vector3() },
      to: { pos: new THREE.Vector3(), look: new THREE.Vector3() },
      t: 1, dur: 1,
    };
    this.clip = { value: 60, target: 60 };
    // one stable array: swapping between 0 and 1 planes would recompile every shader
    this.clipPlanes = [this.world.clipPlane];
    this.renderer.clippingPlanes = this.clipPlanes;

    this._buildSnowMaterials();
    this._buildScoop();
    this._buildMarkers();
    this._buildSplash();
    this._spawnAllSnow();
  }

  // ------------------------------------------------------------ resources
  _buildSnowMaterials() {
    this.pileMat = this.world.mats.snow;
    this.chunkMatBase = this.world.mats.snow.clone();
    this.chunkMatBase.transparent = true;
    this.chunkMatBase.opacity = 1;
    this.chunkGeos = [];
    for (let i = 0; i < 5; i++) this.chunkGeos.push(blobGeometry(0.24, 2, 5000 + i * 91, 0.8, 0.34));
    this.pileGeos = [];
    for (let i = 0; i < 6; i++) this.pileGeos.push(blobGeometry(0.42, 2, 6000 + i * 77, 0.66, 0.3));
  }

  _buildScoop() {
    const g = new THREE.Group();
    const alu = new THREE.MeshStandardMaterial({
      color: 0xc9d0d6, roughness: 0.34, metalness: 0.88, envMapIntensity: 1.1,
    });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.5), alu);
    blade.castShadow = true;
    g.add(blade);
    for (const [w, d, ox, oz] of [[0.62, 0.05, 0, -0.25], [0.05, 0.5, -0.31, 0], [0.05, 0.5, 0.31, 0]]) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.13, d), alu);
      lip.position.set(ox, 0.05, oz);
      lip.castShadow = true;
      g.add(lip);
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.95, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f6fa8, roughness: 0.5, metalness: 0.2 }));
    shaft.position.set(0, 0.42, 0.5);
    shaft.rotation.x = -0.68;
    shaft.castShadow = true;
    g.add(shaft);

    const load = new THREE.Mesh(blobGeometry(0.3, 2, 777, 0.55, 0.3), this.world.mats.snow);
    load.position.y = 0.11;
    load.castShadow = true;
    g.add(load);
    this.scoopLoad = load;

    g.visible = false;
    this.scoop = g;
    this.scene.add(g);
  }

  _buildMarkers() {
    const ringTex = TX.makeRingSprite(256);
    const mk = (color, size) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          map: ringTex, color, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.AdditiveBlending, fog: false,
        }));
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      return m;
    };
    this.markLid = mk(0xfff2c4, 2.3);
    this.markHole = mk(0xbfe6ff, 2.0);
    this.markPile = mk(0xffffff, 1.5);
  }

  _buildSplash() {
    const N = 260;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09, map: TX.makeSoftDot(32), transparent: true, opacity: 0.9,
      depthWrite: false, color: 0xeaf6ff, sizeAttenuation: true, fog: false,
    });
    this.splash = new THREE.Points(geo, mat);
    this.splash.frustumCulled = false;
    this.scene.add(this.splash);
    this.splashP = [];
    for (let i = 0; i < N; i++) this.splashP.push({ life: 0, vx: 0, vy: 0, vz: 0 });
    this.splashHead = 0;

    // expanding ring on the water where a lump lands
    this.rippleGeo = new THREE.RingGeometry(0.12, 0.2, 24);
    this.rippleMat = new THREE.MeshBasicMaterial({
      color: 0xd6ecff, transparent: true, opacity: 0.6, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
  }

  // ---------------------------------------------------------------- snow
  _spawnAllSnow() {
    for (const p of this.piles) this.scene.remove(p.group);
    this.piles = [];
    for (let i = 0; i < CFG.inlets.length; i++) this._spawnSnowFor(i);
  }

  _makePile(inletIndex, x, z, n, seed) {
    const group = new THREE.Group();
    group.position.set(x, this.world.roadHeightAt(x, z), z);
    const blobs = [];
    for (let b = 0; b < n; b++) {
      const m = new THREE.Mesh(this.pileGeos[(seed + b) % this.pileGeos.length], this.pileMat);
      m.scale.setScalar(1 - b * 0.16);
      m.position.set((this.rng() - 0.5) * 0.22, 0.13 + b * 0.22, (this.rng() - 0.5) * 0.22);
      m.rotation.y = this.rng() * 6.28;
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      blobs.push(m);
    }
    this.scene.add(group);
    const pile = { inlet: inletIndex, group, blobs, x, z, charges: n };
    this.piles.push(pile);
    return pile;
  }

  _spawnSnowFor(inletIndex) {
    const ix = CFG.inlets[inletIndex];
    const spots = [[-1.55, 0.35], [0.05, -0.30], [1.5, 0.60]];
    for (let k = 0; k < spots.length; k++) {
      this._makePile(inletIndex, ix + spots[k][0], spots[k][1], 2, inletIndex * 3 + k);
    }
  }

  pilesFor(i) { return this.piles.filter((p) => p.inlet === i && p.charges > 0); }

  // ------------------------------------------------------------- camera
  viewFor(kind, x, aspect) {
    const tall = smoothstep(1.5, 0.72, aspect);   // 0 = wide, 1 = tall
    const P = kind === 'street'
      ? {
        wide: { p: [x + 3.90, 3.95, 4.70], l: [x - 0.60, 0.22, 0.92] },
        tall: { p: [x + 3.10, 4.35, 4.15], l: [x - 0.45, 0.18, 0.86] },
      }
      : {
        wide: { p: [x + 3.00, 2.45, 5.00], l: [x - 1.60, -0.78, 1.62] },
        tall: { p: [x + 2.15, 2.75, 4.30], l: [x - 1.05, -0.88, 1.62] },
      };
    const p = new THREE.Vector3(
      lerp(P.wide.p[0], P.tall.p[0], tall),
      lerp(P.wide.p[1], P.tall.p[1], tall),
      lerp(P.wide.p[2], P.tall.p[2], tall));
    const l = new THREE.Vector3(
      lerp(P.wide.l[0], P.tall.l[0], tall),
      lerp(P.wide.l[1], P.tall.l[1], tall),
      lerp(P.wide.l[2], P.tall.l[2], tall));

    // narrow screens need a little more standoff or the street crops badly
    const k = clamp(1.28 / Math.max(aspect, 0.001), 1, 1.5);
    p.sub(l).multiplyScalar(k).add(l);
    return { pos: p, look: l };
  }

  gotoView(kind, x, dur = 1.6) {
    const aspect = this.camera.aspect;
    const v = this.viewFor(kind, x, aspect);
    this.cam.from.pos.copy(this.cam.pos);
    this.cam.from.look.copy(this.cam.look);
    this.cam.to.pos.copy(v.pos);
    this.cam.to.look.copy(v.look);
    this.cam.t = 0;
    this.cam.dur = dur;
    this.viewKind = kind;
    this.viewX = x;
  }

  snapView(kind, x) {
    const v = this.viewFor(kind, x, this.camera.aspect);
    this.cam.pos.copy(v.pos); this.cam.look.copy(v.look);
    this.cam.to.pos.copy(v.pos); this.cam.to.look.copy(v.look);
    this.cam.from.pos.copy(v.pos); this.cam.from.look.copy(v.look);
    this.cam.t = 1;
    this.viewKind = kind; this.viewX = x;
    this._applyCamera();
  }

  /** Re-frame after a rotation without moving the camera's story position. */
  reframe() {
    if (!this.viewKind) return;
    const v = this.viewFor(this.viewKind, this.viewX, this.camera.aspect);
    if (this.cam.t >= 1) {
      this.cam.from.pos.copy(this.cam.pos); this.cam.from.look.copy(this.cam.look);
      this.cam.to.pos.copy(v.pos); this.cam.to.look.copy(v.look);
      this.cam.t = 0; this.cam.dur = 0.5;
    } else {
      this.cam.to.pos.copy(v.pos); this.cam.to.look.copy(v.look);
    }
  }

  _applyCamera() {
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.look);
  }

  // --------------------------------------------------------------- flow
  start() {
    this.state = 'intro';
    this.snapView('street', CFG.inlets[0] - 5.5);
    this.gotoView('street', CFG.inlets[0], 3.4);
    this.introT = 0;
    this.ui.hint('');
  }

  restart() {
    for (const c of this.chunks) this.scene.remove(c.mesh);
    this.chunks = [];
    for (const l of this.world.lids) { l.target = 0; l.cleared = false; }
    this._dropCarry(true);
    this._spawnAllSnow();
    this.active = 0;
    this.hasFlowedOnce = false;
    this.clip.target = 60;
    this.start();
  }

  _activeLid() { return this.world.lids[this.active]; }

  openActiveLid() {
    const lid = this._activeLid();
    if (!lid || lid.target > 0) return;
    lid.target = 1;
    this.state = 'opening';
    this.openT = 0;
    this.audio.lidOpen();
    this.ui.hint('');
    setTimeout(() => { if (this.state === 'opening') this.audio.reveal(); }, 520);
    this.gotoView('section', lid.x, 2.3);
    this.clip.target = CFG.cutZ;
  }

  _clearedInlet() {
    const lid = this._activeLid();
    lid.cleared = true;
    this.state = 'cleared';
    this.clearT = 0;
    this.audio.chime();
    this.ui.hint(HINTS.cleared);
  }

  _advance() {
    const lid = this._activeLid();
    lid.target = 0;
    this.audio.lidClose();
    this.active++;
    if (this.active >= this.world.lids.length) {
      this.state = 'finale';
      this.finaleT = 0;
      this.clip.target = 60;
      this.gotoView('street', 0.4, 3.0);
      this.ui.hint(HINTS.finale);
      return;
    }
    this.state = 'needLid';
    this.clip.target = 60;
    this.gotoView('street', CFG.inlets[this.active], 2.4);
    this.ui.hint(HINTS.next);
  }

  // -------------------------------------------------------------- input
  _ndc(px, py, rect) {
    this.pointer.x = ((px - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((py - rect.top) / rect.height) * 2 + 1;
  }

  _screenOf(v3, rect) {
    const p = v3.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * rect.width, y: (-p.y * 0.5 + 0.5) * rect.height, z: p.z };
  }

  holePoint() {
    const lid = this._activeLid();
    return new THREE.Vector3(lid.x, CFG.coverTop, CHANNEL_MID);
  }

  magnetRadius(rect) { return Math.min(rect.width, rect.height) * 0.22; }

  onDown(px, py, rect) {
    this._ndc(px, py, rect);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.downAt = { x: px, y: py, t: this.time };
    this.drag = { x: px, y: py, moved: 0 };

    if (this.state === 'needLid' || this.state === 'intro') {
      const lid = this._activeLid();
      const hits = this.raycaster.intersectObject(lid.lid, false);
      const s = this._screenOf(new THREE.Vector3(lid.x, CFG.coverTop, CHANNEL_MID), rect);
      const near = Math.hypot(px - s.x, py - s.y) < this.magnetRadius(rect);
      if (hits.length || near) { this.openActiveLid(); return; }
      return;
    }

    if (this.state === 'shovel' || this.state === 'cleared') {
      if (this.carry) { this._dropIntoHole(); return; }
      const pile = this._pickPile(rect, px, py);
      if (pile) this._pickUp(pile, rect);
    }
  }

  _pickPile(rect, px, py) {
    const live = this.pilesFor(this.active);
    if (!live.length) return null;
    const meshes = [];
    for (const p of live) meshes.push(...p.blobs.filter((b) => b.visible));
    const hit = this.raycaster.intersectObjects(meshes, false);
    if (hit.length) {
      const m = hit[0].object;
      return live.find((p) => p.blobs.includes(m));
    }
    // forgiving fallback: nearest pile on screen
    let best = null, bd = this.magnetRadius(rect) * 1.1;
    for (const p of live) {
      const s = this._screenOf(new THREE.Vector3(p.x, p.group.position.y + 0.3, p.z), rect);
      const d = Math.hypot(px - s.x, py - s.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  _pickUp(pile, rect) {
    const b = pile.blobs.filter((m) => m.visible).pop();
    if (!b) return;
    b.visible = false;
    pile.charges--;
    this.carry = { pos: new THREE.Vector3(pile.x, pile.group.position.y + 0.7, pile.z), t: 0 };
    this.scoop.visible = true;
    this.scoop.position.copy(this.carry.pos);
    this.scoop.scale.setScalar(0.001);
    this.audio.scoop();
    this.ui.hint(HINTS.carried);
    this.magnetHold = 0;
  }

  onMove(px, py, rect) {
    if (this.drag) {
      this.drag.moved = Math.max(this.drag.moved, Math.hypot(px - this.drag.x, py - this.drag.y));
    }
    if (!this.carry || this.carry.flying) return;
    this._ndc(px, py, rect);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.75);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, hit)) {
      const lid = this._activeLid();
      hit.x = clamp(hit.x, lid.x - 4.5, lid.x + 4.5);
      hit.z = clamp(hit.z, CFG.roadFar + 0.3, CFG.chZ1 - 0.15);
      this.carry.pos.lerp(hit, 0.55);
    }
    this.lastPointer = { x: px, y: py };
  }

  onUp(px, py, rect) {
    const quick = !!(this.drag && this.downAt && this.drag.moved < 14 && (this.time - this.downAt.t) < 0.45);
    if (this.carry) {
      const s = this._screenOf(this.holePoint(), rect);
      const d = Math.hypot(px - s.x, py - s.y);
      if (d < this.magnetRadius(rect) * 1.25 || quick) this._dropIntoHole();
      else this._dropCarry(false);
    } else if (quick && (this.state === 'shovel')) {
      const pile = this._pickPile(rect, px, py);
      if (pile) { this._pickUp(pile, rect); this._dropIntoHole(); }
    }
    this.drag = null;
  }

  onCancel() {
    if (this.carry) this._dropCarry(false);
    this.drag = null;
  }

  _dropIntoHole() {
    if (!this.carry || this.carry.flying) return;
    const lid = this._activeLid();
    const to = new THREE.Vector3(lid.x, CFG.coverTop + 0.62, CHANNEL_MID);
    const d = this.carry.pos.distanceTo(to);
    if (d < 0.45) { this._release(); return; }
    this.carry.flying = {
      from: this.carry.pos.clone(), to, t: 0,
      dur: clamp(d * 0.16, 0.24, 0.62), lift: clamp(d * 0.16, 0.12, 0.42),
    };
  }

  _release() {
    if (!this.carry) return;
    const lid = this._activeLid();
    this.carry = null;
    this.scoop.visible = false;
    this.audio.snowDrop();
    this.lastDropAt = this.time;
    this._spawnChunk(new THREE.Vector3(
      lid.x + (this.rng() - 0.5) * 0.34, CFG.coverTop + 0.35, CHANNEL_MID + (this.rng() - 0.5) * 0.34), 0.3);
    if (!this.hasFlowedOnce) { this.hasFlowedOnce = true; this.pendingFlowHint = 1.5; }
    else this.ui.hint(HINTS.shovel);
  }

  _dropCarry(silent) {
    if (!this.carry) return;
    const p = this.carry.pos.clone();
    this.carry = null;
    this.scoop.visible = false;
    if (!silent) this.audio.snowDrop();
    // nothing is ever lost: it simply sits back down wherever the finger let go
    const x = clamp(p.x, CFG.xMin + 1, CFG.xMax - 1);
    const z = clamp(p.z, CFG.roadFar + 0.4, CFG.chZ0 - 0.25);
    this._makePile(this.active, x, z, 1, (this.rng() * 6) | 0);
    this.ui.hint(HINTS.shovel);
  }

  // -------------------------------------------------------------- chunks
  _spawnChunk(pos, scale) {
    const geo = this.chunkGeos[(this.chunks.length + (this.rng() * 5 | 0)) % this.chunkGeos.length];
    const mat = this.chunkMatBase.clone();
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    m.scale.setScalar(scale / 0.24);
    m.castShadow = true;
    this.scene.add(m);
    const c = {
      mesh: m, mat, r: scale, phase: 'fall',
      vy: -0.4, vx: (this.rng() - 0.5) * 0.3, vz: (this.rng() - 0.5) * 0.2,
      spin: (this.rng() - 0.5) * 1.4, spinX: (this.rng() - 0.5) * 0.8,
      age: 0, crumbleAt: 0.9 + this.rng() * 0.9, bob: this.rng() * 6.28,
    };
    this.chunks.push(c);
    return c;
  }

  _splashBurst(pos, n, power) {
    const p = this.splash.geometry.attributes.position;
    for (let i = 0; i < n; i++) {
      const idx = this.splashHead = (this.splashHead + 1) % this.splashP.length;
      const a = this.rng() * 6.28, sp = (0.5 + this.rng() * 1.3) * power;
      p.setXYZ(idx, pos.x + (this.rng() - 0.5) * 0.2, pos.y + 0.03, pos.z + (this.rng() - 0.5) * 0.2);
      const q = this.splashP[idx];
      q.life = 0.5 + this.rng() * 0.4;
      q.vx = Math.cos(a) * sp * 0.4 + CFG.flow * 0.5;
      q.vy = (1.1 + this.rng() * 1.5) * power;
      q.vz = Math.sin(a) * sp * 0.35;
    }
    p.needsUpdate = true;
  }

  _ripple(pos) {
    const m = new THREE.Mesh(this.rippleGeo, this.rippleMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    m.position.y = CFG.waterY + 0.015;
    this.scene.add(m);
    this.ripples.push({ mesh: m, t: 0 });
  }

  _updateChunks(dt) {
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      c.age += dt;
      const m = c.mesh;
      if (c.phase === 'fall') {
        c.vy -= 9.0 * dt;
        m.position.x += c.vx * dt;
        m.position.z += c.vz * dt;
        m.position.y += c.vy * dt;
        m.rotation.y += c.spin * dt * 2;
        m.rotation.x += c.spinX * dt * 2;
        if (m.position.y <= CFG.waterY + c.r * 0.5) {
          m.position.y = CFG.waterY + c.r * 0.5;
          c.phase = 'float';
          c.age = 0;
          c.vx = CFG.flow * CFG.flowSpeed * (0.55 + this.rng() * 0.2);
          this.audio.splash();
          this._splashBurst(m.position, 26, clamp(c.r * 4, 0.6, 1.4));
          this._ripple(m.position);
          this.world.mats.water.normalScale.set(1.6, 1.6);
        }
      } else {
        // riding the current: accelerate up to flow speed, spin, wander
        const target = CFG.flow * CFG.flowSpeed * (0.85 + Math.sin(c.bob) * 0.1);
        c.vx += (target - c.vx) * clamp(dt * 1.6, 0, 1);
        m.position.x += c.vx * dt;
        m.position.z = lerp(m.position.z, CHANNEL_MID + Math.sin(c.age * 1.4 + c.bob) * 0.22, clamp(dt * 1.5, 0, 1));
        m.position.y = CFG.waterY + c.r * 0.42 + Math.sin(c.age * 3.4 + c.bob) * 0.022;
        m.rotation.y += (c.spin * 0.6 + 0.7) * dt;
        m.rotation.z += c.spin * 0.35 * dt;
        m.rotation.x += 0.25 * dt;

        if (c.age > c.crumbleAt && c.r > 0.1) {
          c.crumbleAt = c.age + 0.55 + this.rng() * 0.5;
          c.r *= 0.78;
          m.scale.setScalar(c.r / 0.24);
          this.audio.crumble(clamp(c.r * 4, 0.3, 1));
          this._splashBurst(m.position, 7, 0.45);
          if (c.r > 0.13 && this.chunks.length < 26) {
            const bit = this._spawnChunk(m.position.clone(), c.r * 0.45);
            bit.phase = 'float';
            bit.vx = c.vx * 0.9;
            bit.mesh.position.z += (this.rng() - 0.5) * 0.3;
          }
        }

        // fade away into the dark end of the channel
        const fadeStart = CFG.fadeStart, gone = CFG.gone;
        const x = m.position.x;
        if ((CFG.flow < 0 && x < fadeStart) || (CFG.flow > 0 && x > -fadeStart)) {
          const k = clamp((x - gone) / (fadeStart - gone), 0, 1);
          c.mat.opacity = k;
          m.scale.setScalar((c.r / 0.24) * (0.35 + 0.65 * k));
        }
        if (m.position.x < gone || m.position.x > -gone) {
          this.scene.remove(m); c.mat.dispose(); this.chunks.splice(i, 1);
        }
      }
    }

    // splash particles
    const p = this.splash.geometry.attributes.position;
    let dirty = false;
    for (let i = 0; i < this.splashP.length; i++) {
      const q = this.splashP[i];
      if (q.life <= 0) continue;
      q.life -= dt;
      q.vy -= 7.5 * dt;
      p.setXYZ(i, p.getX(i) + q.vx * dt, p.getY(i) + q.vy * dt, p.getZ(i) + q.vz * dt);
      if (q.life <= 0 || p.getY(i) < CFG.waterY - 0.1) { p.setY(i, -999); q.life = 0; }
      dirty = true;
    }
    if (dirty) p.needsUpdate = true;

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += dt;
      const k = r.t / 1.1;
      r.mesh.scale.setScalar(1 + k * 5);
      r.mesh.material.opacity = 0.6 * (1 - k);
      if (k >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.ripples.splice(i, 1); }
    }

    this.world.mats.water.normalScale.lerp(new THREE.Vector2(0.9, 0.9), clamp(dt * 2, 0, 1));
  }

  // --------------------------------------------------------------- frame
  update(dt, rect) {
    this.time += dt;
    const t = this.time;

    // camera tween
    if (this.cam.t < 1) {
      this.cam.t = clamp(this.cam.t + dt / this.cam.dur, 0, 1);
      const e = easeInOut(this.cam.t);
      this.cam.pos.lerpVectors(this.cam.from.pos, this.cam.to.pos, e);
      this.cam.look.lerpVectors(this.cam.from.look, this.cam.to.look, e);
    }
    // living camera: a breath of drift so it never feels like a still image
    const sway = this.viewKind === 'section' ? 0.035 : 0.09;
    this.camera.position.copy(this.cam.pos);
    this.camera.position.x += Math.sin(t * 0.31) * sway;
    this.camera.position.y += Math.sin(t * 0.24 + 1.3) * sway * 0.45;
    this.camera.lookAt(this.cam.look);

    // clip plane peels the near side away for the section view
    this.clip.value += (this.clip.target - this.clip.value) * clamp(dt * (this.clip.target > 10 ? 6 : 3.2), 0, 1);
    if (Math.abs(this.clip.target - this.clip.value) < 0.01) this.clip.value = this.clip.target;
    this.world.clipPlane.constant = this.clip.value;

    // lids
    for (const l of this.world.lids) {
      const k = clamp(dt * 4.6, 0, 1);
      l.open += (l.target - l.open) * k;
      if (Math.abs(l.target - l.open) < 0.002) l.open = l.target;
      l.pivot.rotation.x = -l.open * 1.32;
      const o = l.open;
      l.light.intensity = o * 7.5;
      l.shaft.material.opacity = o * 0.13;
      l.pool.material.opacity = o * 0.5;
      l.shaft.visible = o > 0.02;
      l.pool.visible = o > 0.02;
      if (l.seg) l.seg.visible = o < 0.5;
    }

    if (this.carry && !this.carry.flying && this.lastPointer && rect) {
      const s = this._screenOf(this.holePoint(), rect);
      const near = Math.hypot(this.lastPointer.x - s.x, this.lastPointer.y - s.y) < this.magnetRadius(rect);
      this.magnetHold = near ? this.magnetHold + dt : 0;
      if (this.magnetHold > 0.28) { this.magnetHold = 0; this._dropIntoHole(); }
    } else this.magnetHold = 0;

    this._updateChunks(dt);
    this._updateCarry(dt);
    this._updateMarkers(dt, rect);
    this._updateState(dt);

    this.world.setShadowFocus(this.cam.look.x);
    this.audio.update(dt, this._activeLid() ? this._activeLid().open * 0.85 + 0.15 * (this.viewKind === 'section' ? 1 : 0) : 0);
  }

  _updateCarry(dt) {
    if (!this.carry) {
      if (this.scoop.visible) this.scoop.scale.setScalar(Math.max(0.001, this.scoop.scale.x - dt * 5));
      return;
    }
    const fly = this.carry.flying;
    if (fly) {
      fly.t = clamp(fly.t + dt / fly.dur, 0, 1);
      const e = easeOut(fly.t);
      this.carry.pos.lerpVectors(fly.from, fly.to, e);
      this.carry.pos.y += Math.sin(fly.t * Math.PI) * fly.lift * 3;
      if (fly.t >= 1) { this._release(); return; }
    }
    this.carry.t += dt;
    const s = Math.min(1, this.scoop.scale.x + dt * 6);
    this.scoop.scale.setScalar(s);
    const p = this.carry.pos;
    this.scoop.position.lerp(new THREE.Vector3(p.x, Math.max(p.y, 0.62), p.z), clamp(dt * 14, 0, 1));
    this.scoop.rotation.y = Math.sin(this.carry.t * 2.2) * 0.12;
    this.scoop.rotation.z = Math.sin(this.carry.t * 1.7) * 0.05;
    this.scoopLoad.position.y = 0.11 + Math.sin(this.carry.t * 6) * 0.008;
  }

  _updateMarkers(dt, rect) {
    const t = this.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.0);

    const showLid = this.state === 'needLid' || (this.state === 'intro' && this.introT > 2.4);
    const lid = this._activeLid();
    if (lid) {
      this.markLid.position.set(lid.x, CFG.coverTop + 0.09, CHANNEL_MID);
      this.markLid.material.opacity = showLid ? 0.35 + pulse * 0.45 : Math.max(0, this.markLid.material.opacity - dt * 2);
      this.markLid.scale.setScalar(showLid ? 0.9 + pulse * 0.16 : 1);

      const showHole = this.state === 'shovel' && !!this.carry;
      this.markHole.position.set(lid.x, CFG.coverTop + 0.06, CHANNEL_MID);
      this.markHole.material.opacity = showHole ? 0.4 + pulse * 0.5 : Math.max(0, this.markHole.material.opacity - dt * 3);
      this.markHole.scale.setScalar(showHole ? 0.95 + pulse * 0.2 : 1);
    }

    const wantPile = this.state === 'shovel' && !this.carry;
    const live = this.pilesFor(this.active);
    if (wantPile && live.length) {
      const p = live[0];
      this.markPile.position.set(p.x, p.group.position.y + 0.08, p.z);
      this.markPile.material.opacity = 0.3 + pulse * 0.35;
      this.markPile.scale.setScalar(0.9 + pulse * 0.14);
    } else {
      this.markPile.material.opacity = Math.max(0, this.markPile.material.opacity - dt * 3);
    }
  }

  _updateState(dt) {
    if (this.pendingFlowHint > 0) {
      this.pendingFlowHint -= dt;
      if (this.pendingFlowHint <= 0) this.ui.hint(HINTS.flowed);
    }

    switch (this.state) {
      case 'intro':
        this.introT = (this.introT || 0) + dt;
        if (this.introT > 3.0) { this.state = 'needLid'; this.ui.hint(HINTS.lid); }
        break;

      case 'opening':
        this.openT += dt;
        if (this.openT > 0.55 && !this._revealShown) { this._revealShown = true; this.ui.hint(HINTS.reveal); }
        if (this.openT > 2.5) {
          this._revealShown = false;
          this.state = 'shovel';
          this.ui.hint(HINTS.shovel);
        }
        break;

      case 'shovel': {
        const settled = !this.chunks.some((c) => c.phase === 'fall');
        const watched = this.time - (this.lastDropAt || 0) > 3.2;
        if (!this.carry && this.pilesFor(this.active).length === 0 && settled && watched) this._clearedInlet();
        break;
      }

      case 'cleared':
        this.clearT += dt;
        if (this.clearT > 2.4) this._advance();
        break;

      case 'finale':
        this.finaleT += dt;
        if (this.finaleT > 4.5) {
          this.active = 0;
          this._spawnAllSnow();
          this.state = 'needLid';
          this.gotoView('street', CFG.inlets[0], 2.2);
          this.ui.hint(HINTS.lid);
        }
        break;
    }
  }
}
