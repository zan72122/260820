import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, makeRng, rrange } from '../core/util';
import { perf } from '../core/perf';
import { LeafPlacement, leafTint, makeLeafGeometry, makeLeafMaterial } from './foliage';
import { RIDGE_PERIOD, terrainHeight } from './terrain';
import { makeTuberGeometry, makeTuberMaterial } from './tuber';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Everything the player never touches. Density falls off with distance and
 * the far half is carried by silhouette and haze rather than geometry.
 */
export class Scenery {
  readonly group = new THREE.Group();
  private leafMat: THREE.MeshStandardMaterial;
  private uniforms: ReturnType<typeof makeLeafMaterial>['uniforms'];

  constructor(seed = 77, exclude: THREE.Vector3[] = []) {
    const rng = makeRng(seed);
    const { material, uniforms } = makeLeafMaterial();
    this.leafMat = material;
    this.uniforms = uniforms;

    /* ---- crop on the neighbouring ridges ---- */
    const placements: LeafPlacement[] = [];
    for (let row = -5; row <= 5; row++) {
      const x0 = row * RIDGE_PERIOD;
      const heroRow = Math.abs(x0) < 0.5; // authored by hand where the player works
      const density = (Math.abs(row) <= 2 ? 1.35 : Math.abs(row) <= 3 ? 0.75 : 0.35) * perf.foliage;
      const zFrom = -10;
      const zTo = 19;
      const step = 0.16 / density;
      for (let z = heroRow ? 12 : zFrom; z < zTo; z += step * rrange(rng, 0.7, 1.3)) {
        const lod = z > 9 ? 0.5 : 1;
        if (rng() > lod) continue;
        const x = x0 + rrange(rng, -0.46, 0.46);
        const p = new THREE.Vector3(x, terrainHeight(x, z) + rrange(rng, 0.01, 0.1), z);
        let skip = false;
        for (const e of exclude) {
          if (p.distanceTo(e) < 1.15) skip = true;
        }
        if (skip) continue;
        const a = rng() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(a) * rrange(rng, 0.25, 0.95), 1, Math.sin(a) * rrange(rng, 0.25, 0.95)).normalize();
        placements.push({ pos: p, dir, scale: rrange(rng, 0.10, 0.19) * (z > 9 ? 1.2 : 1), tint: leafTint(rng) });
      }
    }

    const geos = [makeLeafGeometry('heart', rng), makeLeafGeometry('lobed', rng), makeLeafGeometry('heart', rng)];
    const buckets: LeafPlacement[][] = geos.map(() => []);
    placements.forEach((p, i) => buckets[i % geos.length].push(p));
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    buckets.forEach((bucket, gi) => {
      if (!bucket.length) return;
      const im = new THREE.InstancedMesh(geos[gi], this.leafMat, bucket.length);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bucket.length * 3), 3);
      bucket.forEach((p, i) => {
        q.setFromUnitVectors(UP, p.dir);
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(p.dir, rng() * 6.28));
        sc.setScalar(p.scale);
        m4.compose(p.pos, q, sc);
        im.setMatrixAt(i, m4);
        im.setColorAt(i, p.tint);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = false;
      im.receiveShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    });

    /* ---- vines threading the neighbouring rows ---- */
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x6b7642, roughness: 0.93 });
    const vineParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < Math.round(46 * perf.foliage); i++) {
      const row = Math.round(rrange(rng, -3, 3));
      if (row === 0) continue;
      const x0 = row * RIDGE_PERIOD + rrange(rng, -0.2, 0.2);
      const z0 = rrange(rng, -12, 20);
      const head = rng() * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 5; s++) {
        const t = s / 5;
        const d = t * rrange(rng, 0.6, 1.5);
        const wx = x0 + Math.cos(head) * d + Math.sin(t * 6) * 0.1;
        const wz = z0 + Math.sin(head) * d + Math.cos(t * 5) * 0.1;
        pts.push(new THREE.Vector3(wx, terrainHeight(wx, wz) + 0.012, wz));
      }
      vineParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0085, 5, false));
    }
    const vines = BufferGeometryUtils.mergeGeometries(vineParts, false);
    if (vines) {
      const mesh = new THREE.Mesh(vines, vineMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    for (const g of vineParts) g.dispose();

    /* ---- crop already lifted, resting beside the old holes ---- */
    const tuberMat = makeTuberMaterial();
    tuberMat.userData.uMud.value = 0.85;
    const lifted = new THREE.Group();
    for (const spot of [
      new THREE.Vector3(0, 0, 4.35),
      new THREE.Vector3(-0.98, 0, 1.1),
    ]) {
      for (let i = 0; i < 4; i++) {
        const geo = makeTuberGeometry({
          length: rrange(rng, 0.14, 0.23),
          radius: rrange(rng, 0.03, 0.05),
          bend: rrange(rng, -0.04, 0.04),
          bias: rrange(rng, 0.3, 0.7),
          seed: Math.floor(rng() * 900),
        });
        const m = new THREE.Mesh(geo, tuberMat);
        const a = rng() * Math.PI * 2;
        const r = rrange(rng, 0.32, 0.55);
        const px = spot.x + Math.cos(a) * r;
        const pz = spot.z + Math.sin(a) * r;
        m.position.set(px, terrainHeight(px, pz) + 0.028, pz);
        m.rotation.set(rrange(rng, -0.2, 0.2), rng() * 6.28, Math.PI * 0.5 + rrange(rng, -0.4, 0.4));
        m.castShadow = true;
        m.receiveShadow = true;
        lifted.add(m);
      }
    }
    this.group.add(lifted);

    this.group.add(this.buildTreeline(rng));
    this.group.add(this.buildShed());
    this.group.add(this.buildDistantRows(rng));
  }

  /** Low autumn woodland closing the far end of the field. */
  private buildTreeline(rng: ReturnType<typeof makeRng>) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.2, 5).toNonIndexed();
    trunkGeo.translate(0, 1.1, 0);
    // three overlapping masses give a broken silhouette at distance
    const lobes: THREE.BufferGeometry[] = [];
    for (const [ox, oy, oz, r] of [
      [0, 2.75, 0, 1.15],
      [0.85, 2.2, -0.35, 0.85],
      [-0.7, 2.45, 0.4, 0.78],
    ]) {
      const lobe = new THREE.IcosahedronGeometry(r, 1);
      const lp = lobe.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < lp.count; i++) {
        const s = 0.7 + fbm(lp.getX(i) * 3 + ox, lp.getZ(i) * 3 + oz, 3, 5) * 0.75;
        lp.setXYZ(i, lp.getX(i) * s * 1.2, lp.getY(i) * s * 0.9, lp.getZ(i) * s * 1.2);
      }
      lobe.computeVertexNormals();
      lobe.translate(ox, oy, oz);
      lobes.push(lobe.toNonIndexed());
    }
    const crownGeo = BufferGeometryUtils.mergeGeometries(lobes, false)!;
    const paint = (g: THREE.BufferGeometry, r: number, gr: number, b: number) => {
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = r;
        col[i * 3 + 1] = gr;
        col[i * 3 + 2] = b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    paint(trunkGeo, 0.26, 0.21, 0.17);
    paint(crownGeo, 1, 1, 1);
    const merged = BufferGeometryUtils.mergeGeometries([trunkGeo, crownGeo], false);
    const group = new THREE.Group();
    if (!merged) return group;

    const mat = new THREE.MeshStandardMaterial({ color: 0x6f6f68, roughness: 1, vertexColors: true });
    const COUNT = perf.treeCount;
    const im = new THREE.InstancedMesh(merged, mat, COUNT);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s2 = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const t = i / COUNT;
      const z = 72 + Math.sin(t * 17) * 7 + rrange(rng, -5, 7);
      const x = -105 + t * 215 + rrange(rng, -6, 6);
      const scale = rrange(rng, 0.9, 1.7);
      q.setFromAxisAngle(UP, rng() * 6.28);
      s2.set(scale, scale * rrange(rng, 0.85, 1.3), scale);
      m4.compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.1, z), q, s2);
      im.setMatrixAt(i, m4);
      // autumn spread: olive through ochre to rust
      c.setHSL(rrange(rng, 0.07, 0.18), rrange(rng, 0.25, 0.5), rrange(rng, 0.055, 0.115));
      im.setColorAt(i, c);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = false;
    group.add(im);
    return group;
  }

  private buildShed() {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x7c7166, roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.8, metalness: 0.15 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 3.4), wallMat);
    body.position.y = 1.3;
    group.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.15, 4), roofMat);
    roof.position.y = 3.1;
    roof.rotation.y = Math.PI * 0.25;
    roof.scale.set(1, 1, 0.76);
    group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.06), new THREE.MeshStandardMaterial({ color: 0x4a4239, roughness: 1 }));
    door.position.set(-0.9, 0.9, 1.72);
    group.add(door);
    const x = -13.5;
    const z = 33;
    group.position.set(x, terrainHeight(x, z), z);
    group.rotation.y = 0.42;
    return group;
  }

  /** Rows continuing past the modelled crop: silhouette only. */
  private buildDistantRows(rng: ReturnType<typeof makeRng>) {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.62, 0.13, 1);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
    const mat = new THREE.MeshStandardMaterial({ color: 0x6c7546, roughness: 1, vertexColors: true });
    const COUNT = 240;
    const im = new THREE.InstancedMesh(geo, mat, COUNT);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    let n = 0;
    for (let row = -22; row <= 22 && n < COUNT; row++) {
      if (Math.abs(row) < 6) continue;
      for (let seg = 0; seg < 6 && n < COUNT; seg++) {
        const x = row * RIDGE_PERIOD * 1.02;
        const z = -10 + seg * 8 + rrange(rng, -1.5, 1.5);
        const len = rrange(rng, 5.5, 8.5);
        q.identity();
        s.set(rrange(rng, 0.8, 1.1), rrange(rng, 0.55, 1.0), len);
        m4.compose(new THREE.Vector3(x, terrainHeight(x, z) + 0.04, z), q, s);
        im.setMatrixAt(n, m4);
        c.setHSL(rrange(rng, 0.15, 0.24), rrange(rng, 0.14, 0.28), rrange(rng, 0.17, 0.29));
        im.setColorAt(n, c);
        n++;
      }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    return group;
  }

  update(time: number, sunViewDir: THREE.Vector3) {
    this.uniforms.uTime.value = time;
    this.uniforms.uSunViewDir.value.copy(sunViewDir);
  }

  setWind(v: number) {
    this.uniforms.uWind.value = v;
  }
}
