import * as THREE from 'three';
import { clamp, damp, makeRng, smoothstep } from '../core/util';
import type { TextureSet } from '../gfx/textures';
import {
  makeBareMetal,
  makeConcrete,
  makeFoliage,
  makeLeaf,
  makePaintedMetal,
  makePuddle,
  makeRock,
  makeRubber,
  makeWood,
} from '../gfx/materials';
import type { Terrain } from './terrain';
import type { Water } from './water';
import {
  NX,
  NZ,
  WORLD_D,
  WORLD_W,
  gridToWorldX,
  gridToWorldZ,
  worldToGridX,
  worldToGridZ,
  type Layout,
} from './layout';

export const GATE_TRAVEL = 0.16;

/* ------------------------------------------------------------------ */
/* wooden sluice gate                                                  */
/* ------------------------------------------------------------------ */

export class Gate {
  readonly group = new THREE.Group();
  readonly board = new THREE.Group();
  readonly handleHit: THREE.Mesh;
  readonly handleAnchor = new THREE.Object3D();

  open = 0;
  private shownOpen = 0;
  private tremble = 0;
  private nudge = 0;
  private sillY = 0;
  private width = 0.6;

  constructor(tex: TextureSet) {
    const wood = makeWood(tex, 1.4);
    const woodDark = makeWood(tex, 2.2);
    woodDark.color = new THREE.Color(0xa8927a);
    const metal = makeBareMetal(tex, 0x9aa0a3, 3);

    // --- moving board -------------------------------------------------
    const planks = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.098, 0.032), wood);
      pl.position.y = 0.052 + i * 0.101;
      pl.castShadow = true;
      pl.receiveShadow = true;
      planks.add(pl);
    }
    // iron straps holding the planks together
    for (const sx of [-0.2, 0.2]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.008), metal);
      strap.position.set(sx, 0.155, 0.021);
      strap.castShadow = true;
      planks.add(strap);
      for (let b = 0; b < 3; b++) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), metal);
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(sx, 0.055 + b * 0.1, 0.028);
        planks.add(bolt);
      }
    }
    this.board.add(planks);

    // --- handle -------------------------------------------------------
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.44, 12), woodDark);
    hb.rotation.z = Math.PI / 2;
    hb.position.set(0, 0.395, 0.0);
    hb.castShadow = true;
    this.board.add(hb);
    for (const sx of [-0.13, 0.13]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.016), metal);
      arm.position.set(sx, 0.34, 0.0);
      arm.castShadow = true;
      this.board.add(arm);
    }
    for (const sx of [-0.22, 0.22]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.02, 12), metal);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(sx, 0.395, 0);
      this.board.add(cap);
    }
    this.handleAnchor.position.set(0, 0.395, 0);
    this.board.add(this.handleAnchor);

    // generous invisible target: a four-year-old's finger is not precise
    this.handleHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.34, 0.3),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.handleHit.position.set(0, 0.32, 0);
    this.board.add(this.handleHit);

    this.group.add(this.board);

    // --- fixed frame --------------------------------------------------
    for (const sx of [-0.345, 0.345]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.1), wood);
      post.position.set(sx, 0.2, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      this.group.add(post);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.56, 0.05), metal);
      rail.position.set(sx + (sx > 0 ? -0.04 : 0.04), 0.22, 0.0);
      this.group.add(rail);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.075, 0.1), wood);
    beam.position.set(0, 0.545, 0);
    beam.castShadow = true;
    beam.receiveShadow = true;
    this.group.add(beam);

    this.group.matrixAutoUpdate = true;
  }

  place(layout: Layout) {
    const gx = gridToWorldX(layout.gateU * (NX - 1));
    const gz = gridToWorldZ(layout.gateV * (NZ - 1));
    this.sillY = layout.sillY;
    this.group.position.set(gx, this.sillY, gz);
    this.open = 0;
    this.shownOpen = 0;
    this.board.position.y = 0;
  }

  get widthWorld() {
    return this.width;
  }

  /** One physical shake of the handle — the first hint, before any words. */
  nudgeHandle() {
    this.nudge = 1;
  }

  update(dt: number, elapsed: number, pressure: number) {
    this.shownOpen = damp(this.shownOpen, this.open, 0.045, dt);
    this.nudge = Math.max(0, this.nudge - dt * 1.5);

    // water pressure makes the closed board creak and shiver
    const press = clamp(pressure, 0, 1) * (1 - this.shownOpen * 0.75);
    this.tremble = damp(this.tremble, press, 0.2, dt);
    const t = elapsed;
    const shiver =
      Math.sin(t * 41.3) * 0.0011 + Math.sin(t * 27.1 + 1.3) * 0.0008 + Math.sin(t * 63.7) * 0.0004;

    const nudgeY = Math.sin(this.nudge * Math.PI * 2.0) * 0.03 * smoothstep(0, 0.25, this.nudge);
    this.board.position.y = this.shownOpen * GATE_TRAVEL + nudgeY;
    this.board.position.z = shiver * this.tremble * 14;
    this.board.rotation.x = shiver * this.tremble * 5;
  }

  get displayOpen() {
    return this.shownOpen;
  }
}

/* ------------------------------------------------------------------ */
/* floating leaf boat                                                  */
/* ------------------------------------------------------------------ */

function leafGeometry() {
  const seg = 16;
  const rings = 12;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const halfW = 0.098 * Math.pow(Math.sin(Math.PI * clamp(v, 0.001, 0.999)), 0.62);
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const e = Math.abs(u - 0.5) * 2;
      const y = 0.03 * e * e + 0.016 * Math.sin(Math.PI * v) * (1 - e * 0.4);
      pos.push((u - 0.5) * 2 * halfW, y, (v - 0.5) * 0.32);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const b = a + 1;
      const c = a + seg + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class LeafBoat {
  readonly group = new THREE.Group();
  private vel = new THREE.Vector2();
  private bob = 0;
  afloat = false;
  private restY = 0;

  constructor(tex: TextureSet) {
    const leaf = new THREE.Mesh(leafGeometry(), makeLeaf(tex));
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    this.group.add(leaf);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.0035, 0.075, 6),
      makeFoliage(0x6d6a3a),
    );
    stem.rotation.x = Math.PI / 2;
    stem.position.set(0, 0.012, -0.19);
    this.group.add(stem);
  }

  place(layout: Layout, terrain: Terrain) {
    const x = gridToWorldX((layout.pondU - 0.06) * (NX - 1));
    const z = gridToWorldZ((layout.pondV - 0.01) * (NZ - 1));
    this.restY = terrain.heightAt(x, z);
    this.group.position.set(x, this.restY + 0.004, z);
    this.group.rotation.set(0, 0.6, 0);
    this.vel.set(0, 0);
    this.afloat = false;
  }

  update(dt: number, elapsed: number, terrain: Terrain, water: Water) {
    const p = this.group.position;
    const s = water.sample(worldToGridX(p.x), worldToGridZ(p.z));
    const ground = terrain.heightAt(p.x, p.z);
    const floatDepth = 0.014;

    if (s.depth > floatDepth) {
      this.afloat = true;
      // gentle advection: the leaf follows the current, it never races
      this.vel.x = damp(this.vel.x, s.vx * 0.16, 0.35, dt);
      this.vel.y = damp(this.vel.y, s.vz * 0.16, 0.35, dt);
      p.x = clamp(p.x + this.vel.x * dt, -WORLD_W / 2 + 0.3, WORLD_W / 2 - 0.3);
      p.z = clamp(p.z + this.vel.y * dt, -WORLD_D / 2 + 0.3, WORLD_D / 2 - 0.3);
      this.bob += dt;
      const target = s.surface - 0.004 + Math.sin(this.bob * 2.1) * 0.0035;
      p.y = damp(p.y, target, 0.08, dt);
      const spin = (this.vel.x * 0.9 - this.vel.y * 0.2) * dt * 2.2;
      this.group.rotation.y += spin + Math.sin(elapsed * 0.7) * dt * 0.12;
      this.group.rotation.z = damp(this.group.rotation.z, Math.sin(this.bob * 1.7) * 0.05, 0.2, dt);
      this.group.rotation.x = damp(this.group.rotation.x, Math.cos(this.bob * 1.3) * 0.04, 0.2, dt);
    } else {
      this.afloat = false;
      this.vel.multiplyScalar(0.9);
      p.y = damp(p.y, ground + 0.004 + s.depth, 0.1, dt);
      this.group.rotation.z = damp(this.group.rotation.z, 0, 0.2, dt);
      this.group.rotation.x = damp(this.group.rotation.x, 0, 0.2, dt);
    }
  }
}

/* ------------------------------------------------------------------ */
/* sandbox surroundings, tools and scatter                             */
/* ------------------------------------------------------------------ */

function pebbleGeometry(rng: () => number) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const s = 0.62 + rng() * 0.6;
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.62, p.getZ(i) * (0.7 + rng() * 0.5));
  }
  g.computeVertexNormals();
  return g;
}

function grassTuftGeometry() {
  const pos: number[] = [];
  const idx: number[] = [];
  const uvs: number[] = [];
  const rng = makeRng(21);
  let base = 0;
  for (let b = 0; b < 5; b++) {
    const a = rng() * Math.PI * 2;
    const len = 0.09 + rng() * 0.09;
    const bend = 0.35 + rng() * 0.5;
    const segs = 4;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = 0.008 * (1 - t * 0.9);
      const y = len * t;
      const off = bend * len * t * t;
      pos.push(dx * off - dz * w, y, dz * off + dx * w);
      pos.push(dx * off + dz * w, y, dz * off - dx * w);
      uvs.push(0, t, 1, t);
    }
    for (let s = 0; s < segs; s++) {
      const i0 = base + s * 2;
      idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
    }
    base += (segs + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Surroundings {
  readonly group = new THREE.Group();
  readonly stoneGroup = new THREE.Group();
  private stoneGeo: THREE.BufferGeometry;
  private stoneMat: THREE.Material;
  private bucket = new THREE.Group();
  private scoop = new THREE.Group();

  /** Anywhere on the paving, never inside the sand. */
  private static scatter(rng: () => number) {
    for (let n = 0; n < 40; n++) {
      const a = rng() * Math.PI * 2;
      const dist = 2.6 + rng() * 7.2;
      const x = Math.cos(a) * dist * 1.35;
      const z = Math.sin(a) * dist;
      if (Math.abs(x) < WORLD_W / 2 + 0.45 && Math.abs(z) < WORLD_D / 2 + 0.45) continue;
      return { x, z };
    }
    return { x: WORLD_W / 2 + 1.4, z: 0 };
  }

  constructor(tex: TextureSet) {
    const wood = makeWood(tex, 3.2);
    const rng = makeRng(1337);

    // --- ground beyond the sandbox -----------------------------------
    // The paving has a hole exactly the size of the box, otherwise it would
    // show through wherever the sand is dug below paving level.
    const bw = 0.22;
    const holeX = WORLD_W / 2 + bw;
    const holeZ = WORLD_D / 2 + bw;
    const shape = new THREE.Shape();
    shape.moveTo(-23, -23);
    shape.lineTo(23, -23);
    shape.lineTo(23, 23);
    shape.lineTo(-23, 23);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-holeX, -holeZ);
    hole.lineTo(-holeX, holeZ);
    hole.lineTo(holeX, holeZ);
    hole.lineTo(holeX, -holeZ);
    hole.closePath();
    shape.holes.push(hole);
    const groundGeo = new THREE.ShapeGeometry(shape);
    const guv = groundGeo.attributes.uv as THREE.BufferAttribute;
    const gpos = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, gpos.getX(i) / 0.55, gpos.getY(i) / 0.55);
    groundGeo.setAttribute('uv1', guv);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(groundGeo, makeConcrete(tex, 1));
    ground.position.y = -0.135;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Damp sand filling the box below the playable surface, so digging
    // through never reveals a hole in the world.
    const pitMat = new THREE.MeshStandardMaterial({
      color: 0x6a5a44,
      roughness: 0.95,
      metalness: 0,
      side: THREE.BackSide,
      envMapIntensity: 0.5,
    });
    const pit = new THREE.Mesh(new THREE.BoxGeometry(holeX * 2, 0.62, holeZ * 2), pitMat);
    pit.position.y = 0.1 - 0.31;
    pit.receiveShadow = true;
    this.group.add(pit);

    // rain that has not dried yet
    const puddleMat = makePuddle();
    for (let i = 0; i < 7; i++) {
      const r = 0.3 + rng() * 0.6;
      const pd = new THREE.Mesh(new THREE.CircleGeometry(r, 22), puddleMat);
      pd.rotation.x = -Math.PI / 2;
      const s = Surroundings.scatter(rng);
      pd.position.set(s.x, -0.132, s.z);
      pd.scale.set(1, 1, 0.6 + rng() * 0.6);
      pd.renderOrder = 1;
      this.group.add(pd);
    }

    // --- sandbox frame ------------------------------------------------
    const bh = 0.3;
    const hw = WORLD_W / 2 + bw / 2;
    const hd = WORLD_D / 2 + bw / 2;
    const beams: [number, number, number, number][] = [
      [0, -hd, WORLD_W + bw * 2, bw],
      [0, hd, WORLD_W + bw * 2, bw],
      [-hw, 0, bw, WORLD_D],
      [hw, 0, bw, WORLD_D],
    ];
    for (const [x, z, sx, sz] of beams) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, bh, sz), wood);
      m.position.set(x, 0.09 - bh / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
    // corner caps so the frame reads as built, not extruded
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.35, 0.075, bw * 1.35), wood);
        cap.position.set(sx * hw, 0.115, sz * hd);
        cap.castShadow = true;
        cap.receiveShadow = true;
        this.group.add(cap);
      }
    }

    // --- pebbles ------------------------------------------------------
    const pebGeo = pebbleGeometry(makeRng(9));
    const pebMat = makeRock(tex);
    const pebbles = new THREE.InstancedMesh(pebGeo, pebMat, 78);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (let i = 0; i < 78; i++) {
      const sp = Surroundings.scatter(rng);
      v.set(sp.x, -0.128, sp.z);
      e.set(rng() * 3, rng() * 6, rng() * 3);
      q.setFromEuler(e);
      const s = 0.02 + rng() * 0.045;
      sc.set(s, s, s);
      m4.compose(v, q, sc);
      pebbles.setMatrixAt(i, m4);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    pebbles.castShadow = true;
    pebbles.receiveShadow = true;
    this.group.add(pebbles);

    // --- grass along the paving joints --------------------------------
    const grass = new THREE.InstancedMesh(grassTuftGeometry(), makeFoliage(0x53702f), 120);
    for (let i = 0; i < 120; i++) {
      const sp = Surroundings.scatter(rng);
      v.set(sp.x, -0.135, sp.z);
      e.set(0, rng() * 6.28, 0);
      q.setFromEuler(e);
      const s = 0.7 + rng() * 0.8;
      sc.set(s, s, s);
      m4.compose(v, q, sc);
      grass.setMatrixAt(i, m4);
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.castShadow = true;
    this.group.add(grass);

    // --- bucket -------------------------------------------------------
    const bucket = this.bucket;
    const paint = makePaintedMetal(tex, 2);
    const bareMetal = makeBareMetal(tex, 0xa8adb0, 3);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.115, 0.2, 28, 1, true), paint);
    body.position.y = 0.1;
    body.castShadow = true;
    body.receiveShadow = true;
    bucket.add(body);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.113, 0.198, 28, 1, true), paint);
    inner.position.y = 0.1;
    inner.material = paint;
    inner.scale.set(-1, 1, 1);
    bucket.add(inner);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.115, 28), paint);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.002;
    bucket.add(bottom);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.009, 8, 28), bareMetal);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.2;
    rim.castShadow = true;
    bucket.add(rim);
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.0055, 6, 20, Math.PI), bareMetal);
    bail.position.y = 0.2;
    bail.rotation.set(0, Math.PI / 2, 0);
    bail.castShadow = true;
    bucket.add(bail);
    bucket.rotation.y = 0.5;
    bucket.rotation.z = 0.1;
    this.group.add(bucket);

    // --- scoop --------------------------------------------------------
    const scoop = this.scoop;
    const blade = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), bareMetal);
    blade.scale.set(1, 0.45, 1.3);
    blade.rotation.x = Math.PI;
    blade.castShadow = true;
    blade.receiveShadow = true;
    scoop.add(blade);
    const shaftWood = makeWood(tex, 1.1);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.52, 10), shaftWood);
    shaft.position.set(0, 0.25, -0.05);
    shaft.rotation.x = -0.18;
    shaft.castShadow = true;
    scoop.add(shaft);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.12, 12), makeRubber());
    grip.position.set(0, 0.485, -0.093);
    grip.rotation.x = -0.18;
    grip.castShadow = true;
    scoop.add(grip);
    scoop.rotation.set(-1.15, -0.66, 0.12);
    this.group.add(scoop);

    this.stoneGeo = pebbleGeometry(makeRng(555));
    this.stoneMat = makeRock(tex);
    this.group.add(this.stoneGroup);
  }

  /** Toys rest on the sand at whatever height the sand happens to be. */
  placeTools(terrain: Terrain) {
    const bx = WORLD_W / 2 - 0.58;
    const bz = WORLD_D / 2 - 0.75;
    this.bucket.position.set(bx, terrain.heightAt(bx, bz) - 0.01, bz);
    const sx = -WORLD_W / 2 + 0.52;
    const sz = WORLD_D / 2 - 1.3;
    this.scoop.position.set(sx, terrain.heightAt(sx, sz) + 0.055, sz);
  }

  /** Stones half-buried in the sand, matching the bumps in the height field. */
  placeStones(layout: Layout, terrain: Terrain) {
    for (const c of this.stoneGroup.children) (c as THREE.Mesh).geometry.dispose?.();
    this.stoneGroup.clear();
    for (const s of layout.stones) {
      const m = new THREE.Mesh(this.stoneGeo, this.stoneMat);
      const x = gridToWorldX(s.u * (NX - 1));
      const z = gridToWorldZ(s.v * (NZ - 1));
      m.position.set(x, terrain.heightAt(x, z) + s.r * 0.1, z);
      m.scale.set(s.r, s.r * 0.72, s.r * 0.9);
      m.rotation.set(0.2, s.rot, 0.12);
      m.castShadow = true;
      m.receiveShadow = true;
      this.stoneGroup.add(m);
    }
  }
}
