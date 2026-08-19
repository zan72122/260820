// The diorama: a snowed-in back street, and the channel running under its gutter.
import * as THREE from '../vendor/three/three.module.min.js';
import * as TX from './textures.js';
import { fbm, makeRng, clamp, lerp, smoothstep } from './noise.js';

export const CFG = {
  xMin: -13, xMax: 13,
  roadFar: -3.40,          // far kerb
  roadNear: 1.05,          // gutter kerb face
  chZ0: 1.05, chZ1: 2.40,  // channel in z
  cutZ: 2.10,              // section plane for the underground view
  snowTop: 0.36,
  coverTop: 0.03,          // top of the gutter slabs
  ceilY: -0.30,            // underside of the slabs = channel ceiling
  waterY: -1.32,
  floorY: -2.00,
  flow: -1,                // water runs toward -x
  flowSpeed: 1.9,
  inlets: [-4.2, 0.4, 5.0],
  chanEnd: 10.4,          // where the channel disappears into the dark
  fadeStart: -7.4, gone: -9.9,
  lidHalfX: 0.55,
  lidZ0: 1.16, lidZ1: 2.30,
};

const M = (...a) => new THREE.Vector3(...a);

/** Grid mesh in the XZ plane with explicit uv, so texture and geometry agree. */
function gridPlaneXZ(x0, x1, z0, z1, sx, sz, heightFn) {
  const g = new THREE.BufferGeometry();
  const nx = sx + 1, nz = sz + 1;
  const pos = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  let p = 0, q = 0;
  for (let j = 0; j < nz; j++) {
    const v = j / sz;
    const z = lerp(z0, z1, v);
    for (let i = 0; i < nx; i++) {
      const u = i / sx;
      const x = lerp(x0, x1, u);
      pos[p++] = x; pos[p++] = heightFn ? heightFn(u, v, x, z) : 0; pos[p++] = z;
      uv[q++] = u; uv[q++] = v;
    }
  }
  const idx = [];
  for (let j = 0; j < sz; j++) {
    for (let i = 0; i < sx; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Lumpy snow blob, used for drifts, banks and the shovel load. */
export function blobGeometry(radius, detail, seed, squash = 0.62, amp = 0.26) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const n = fbm(seed, 3, 3);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.clone().normalize();
    const k = 1 + (n(d.x * 0.5 + 0.5, d.z * 0.5 + 0.5) - 0.5) * amp * 2 + (n(d.y * 0.5 + 0.5, d.x * 0.5 + 0.5) - 0.5) * amp;
    v.multiplyScalar(k);
    v.y *= squash;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export class World {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.mats = {};
    this.scroll = { water: null, foam: null };
    this.lids = [];
    this.inletLights = [];
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 60);
  }

  build() {
    this._env();
    this._lights();
    this._ground();
    this._channel();
    this._water();
    this._gutter();
    this._sceneryFar();
    this._sceneryNear();
    this._distance();
    this._weather();
  }

  // ------------------------------------------------------------------ env
  _env() {
    const skyTex = TX.makeSkyEquirect(512);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const envRT = pmrem.fromEquirectangular(skyTex);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 0.62;
    this.scene.background = envRT.texture;
    this.scene.backgroundBlurriness = 0.42;
    this.scene.backgroundIntensity = 0.92;
    this.scene.fog = new THREE.Fog(0xd2dfec, 40, 230);
    skyTex.dispose();
    pmrem.dispose();
  }

  _lights() {
    const hemi = new THREE.HemisphereLight(0xcfe2f6, 0x8fa2b6, 0.62);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffeed6, 1.55);
    sun.position.set(9, 12, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0011;
    sun.shadow.normalBias = 0.035;
    const c = sun.shadow.camera;
    c.near = 1; c.far = 60;
    c.left = -12; c.right = 12; c.top = 12; c.bottom = -8;
    c.updateProjectionMatrix();
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // a cool bounce from the snow so shadow sides don't go dead
    const fill = new THREE.DirectionalLight(0x9ec0e6, 0.22);
    fill.position.set(-8, 5, -10);
    this.scene.add(fill);
  }

  setShadowFocus(x) {
    if (!this.sun) return;
    this.sun.position.set(x + 9, 12, 14);
    this.sun.target.position.set(x, 0, -0.5);
    this.sun.target.updateMatrixWorld();
  }

  setSunMapSize(n) {
    if (!this.sun) return;
    this.sun.shadow.mapSize.set(n, n);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
  }

  // --------------------------------------------------------------- ground
  _ground() {
    const S = TX.makeRoadSnow(1024);
    this.roadSnowTex = S;
    const snowMat = new THREE.MeshStandardMaterial({
      map: S.map, normalMap: S.normal, roughnessMap: S.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.7,
      normalScale: new THREE.Vector2(1.1, 1.1),
    });
    this.mats.roadSnow = snowMat;

    const H = (u, v) => TX.roadSnowField(u, v).h * CFG.snowTop;
    this.roadGeo = gridPlaneXZ(CFG.xMin, CFG.xMax, CFG.roadFar, CFG.roadNear, 224, 34, H);
    const road = new THREE.Mesh(this.roadGeo, snowMat);
    road.receiveShadow = true;
    road.castShadow = false;
    this.scene.add(road);
    this.road = road;

    // asphalt body underneath (its cut edge is what you see at the kerb)
    const A = TX.makeAsphalt(512);
    this.mats.asphalt = new THREE.MeshStandardMaterial({
      map: A.map, normalMap: A.normal, roughnessMap: A.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.9, color: 0xffffff,
    });
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(CFG.xMax - CFG.xMin, 0.26, CFG.roadNear - CFG.roadFar),
      this.mats.asphalt);
    slab.position.set(0, -0.13, (CFG.roadFar + CFG.roadNear) / 2);
    slab.receiveShadow = true;
    this.scene.add(slab);

    // verges either side of the street
    const bank = TX.makeSnowBank(512);
    this.mats.snow = new THREE.MeshStandardMaterial({
      map: bank.map, normalMap: bank.normal, roughnessMap: bank.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.85,
      normalScale: new THREE.Vector2(0.8, 0.8),
    });
    this.mats.snowPlain = new THREE.MeshStandardMaterial({
      map: bank.map, normalMap: bank.normal, roughnessMap: bank.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.85,
    });

    const soil = TX.makeSoil(256);
    this.mats.soil = new THREE.MeshStandardMaterial({
      map: soil.map, normalMap: soil.normal, roughness: 1, metalness: 0, envMapIntensity: 0.3,
    });

    const drift = fbm(31337, 5, 4);
    // far side: a bank ploughed up against the wall that tapers onto the road
    const farVerge = new THREE.Mesh(
      gridPlaneXZ(CFG.xMin, CFG.xMax, -13.5, CFG.roadFar + 0.6, 110, 26, (u, v, x, z) => {
        const d = CFG.roadFar - z;                       // 0 at kerb, grows away from road
        const bank = smoothstep(-0.6, 0.55, d) * (1 - smoothstep(1.6, 4.2, d) * 0.62);
        const n = drift(u * 2.4, v) * 0.3;
        return 0.02 + bank * 0.86 + n * smoothstep(-0.2, 0.7, d);
      }),
      this.mats.snow);
    farVerge.receiveShadow = true; farVerge.castShadow = true;
    this.scene.add(farVerge);

    // near side: heaped against the gutter, then flat garden snow
    const nearVerge = new THREE.Mesh(
      gridPlaneXZ(CFG.xMin, CFG.xMax, CFG.chZ1 - 0.14, 16.5, 110, 30, (u, v, x, z) => {
        const d = z - CFG.chZ1;
        const bank = smoothstep(-0.1, 0.5, d) * (1 - smoothstep(1.2, 3.6, d) * 0.55);
        const n = drift(u * 2.6, 1 - v) * 0.28;
        return 0.02 + bank * 0.74 + n * smoothstep(0.0, 0.8, d);
      }),
      this.mats.snow);
    nearVerge.receiveShadow = true; nearVerge.castShadow = true;
    this.scene.add(nearVerge);

    // solid earth so the diorama reads as a block of ground, not a floating skin
    const earthFar = new THREE.Mesh(
      new THREE.BoxGeometry(CFG.xMax - CFG.xMin, 9, -CFG.roadFar + 13.5), this.mats.soil);
    earthFar.position.set(0, -4.5, (-13.5 + CFG.roadFar) / 2);
    this.scene.add(earthFar);
    const earthNear = new THREE.Mesh(
      new THREE.BoxGeometry(CFG.xMax - CFG.xMin, 9, 16.5 - CFG.chZ1), this.mats.soil);
    earthNear.position.set(0, -4.5, (CFG.chZ1 + 16.5) / 2);
    this.scene.add(earthNear);
  }

  /** Snow surface height on the road, for placing things. */
  roadHeightAt(x, z) {
    const u = (x - CFG.xMin) / (CFG.xMax - CFG.xMin);
    const v = (z - CFG.roadFar) / (CFG.roadNear - CFG.roadFar);
    return TX.roadSnowField(clamp(u, 0, 1), clamp(v, 0, 1)).h * CFG.snowTop;
  }

  // -------------------------------------------------------------- channel
  _channel() {
    const wall = TX.makeConcrete({ size: 512, moss: 0.85, wetLine: 0.62, tint: 0.92 });
    this.mats.wall = new THREE.MeshStandardMaterial({
      map: wall.map, normalMap: wall.normal, roughnessMap: wall.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.14, fog: false,
    });
    this.mats.wall.map.repeat.set(10, 1);
    this.mats.wall.normalMap.repeat.set(10, 1);
    this.mats.wall.roughnessMap.repeat.set(10, 1);

    const g = new THREE.Group();
    this.scene.add(g);
    this.underground = g;

    const L = CFG.xMax - CFG.xMin, cx = 0;
    const H = CFG.coverTop - CFG.floorY;

    // far wall (this is the face you look at across the water)
    const far = new THREE.Mesh(new THREE.BoxGeometry(L, H + 0.2, 0.22), this.mats.wall);
    far.position.set(cx, (CFG.floorY - 0.2 + CFG.coverTop) / 2, CFG.chZ0 - 0.11);
    far.receiveShadow = true;
    g.add(far);

    // bed
    const bedMat = this.mats.wall.clone();
    bedMat.color = new THREE.Color(0x9aa39c);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(L, 0.2, CFG.chZ1 - CFG.chZ0), bedMat);
    bed.position.set(cx, CFG.floorY - 0.1, (CFG.chZ0 + CFG.chZ1) / 2);
    bed.receiveShadow = true;
    g.add(bed);

    // near wall: exists for the street view, sliced away by the clip plane below ground
    const near = new THREE.Mesh(new THREE.BoxGeometry(L, H + 0.2, 0.5), this.mats.wall);
    near.position.set(cx, (CFG.floorY - 0.2 + CFG.coverTop) / 2, CFG.chZ1 + 0.25);
    g.add(near);

    // dark ends so lumps drift away into somewhere, not into a wall
    const endMat = new THREE.MeshBasicMaterial({ color: 0x05070a, fog: false });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(CFG.chZ1 - CFG.chZ0, CFG.coverTop - CFG.floorY), endMat);
      e.rotation.y = s * Math.PI / 2;
      e.position.set(s * CFG.chanEnd, (CFG.floorY + CFG.ceilY) / 2, (CFG.chZ0 + CFG.chZ1) / 2);
      g.add(e);
    }

    // section caps: the concrete you see cut through at the front of the diorama
    const strata = TX.makeStrata(512, 256);
    this.mats.strata = new THREE.MeshStandardMaterial({
      map: strata, roughness: 0.95, metalness: 0, envMapIntensity: 0.35,
      side: THREE.DoubleSide, fog: false,
    });
    const capZ = CFG.cutZ - 0.004;

    const soilCut = TX.makeSoil(256);
    soilCut.map.repeat.set(9, 2.6); soilCut.normal.repeat.set(9, 2.6);
    const lowerMat = new THREE.MeshStandardMaterial({
      map: soilCut.map, normalMap: soilCut.normal, roughness: 0.97, metalness: 0,
      envMapIntensity: 0.22, fog: false,
    });
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(L, 13), lowerMat);
    lower.position.set(cx, CFG.floorY - 6.5, capZ);
    g.add(lower);

    // upper cap runs the whole street, but the piece at each inlet belongs to its lid
    this.capSegs = [];
    const capH = CFG.coverTop - CFG.ceilY;
    const capY = (CFG.coverTop + CFG.ceilY) / 2;
    const capMat = new THREE.MeshStandardMaterial({
      map: strata, roughness: 0.9, metalness: 0, envMapIntensity: 0.35, fog: false, side: THREE.DoubleSide,
    });
    this.mats.cap = capMat;
    const cuts = [];
    for (const ix of CFG.inlets) cuts.push([ix - CFG.lidHalfX - 0.06, ix + CFG.lidHalfX + 0.06]);
    let x = CFG.xMin;
    for (const [a, b] of cuts) {
      if (a > x) this._capPiece(g, x, a, capY, capH, capZ, capMat, false);
      this._capPiece(g, a, b, capY, capH, capZ, capMat, true);
      x = b;
    }
    if (x < CFG.xMax) this._capPiece(g, x, CFG.xMax, capY, capH, capZ, capMat, false);
  }

  _capPiece(parent, x0, x1, y, h, z, mat, isInlet) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, h), mat);
    m.position.set((x0 + x1) / 2, y, z);
    parent.add(m);
    if (isInlet) this.capSegs.push(m);
  }

  // ---------------------------------------------------------------- water
  _water() {
    const nrm = TX.makeWaterNormal(512);
    nrm.repeat.set(16, 1.4);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x22323d, roughness: 0.11, metalness: 0.1,
      normalMap: nrm, normalScale: new THREE.Vector2(0.9, 0.9),
      envMapIntensity: 0.55, fog: false,
    });
    this.mats.water = mat;
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.xMax - CFG.xMin, CFG.chZ1 - CFG.chZ0, 60, 4), mat);
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, CFG.waterY, (CFG.chZ0 + CFG.chZ1) / 2);
    w.receiveShadow = false;
    this.underground.add(w);
    this.waterMesh = w;
    this.scroll.water = nrm;

    const foamTex = TX.makeFoam(512);
    foamTex.repeat.set(22, 1.6);
    const foamMat = new THREE.MeshBasicMaterial({
      map: foamTex, transparent: true, opacity: 0.22, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    this.mats.foam = foamMat;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(CFG.xMax - CFG.xMin, CFG.chZ1 - CFG.chZ0), foamMat);
    f.rotation.x = -Math.PI / 2;
    f.position.set(0, CFG.waterY + 0.012, (CFG.chZ0 + CFG.chZ1) / 2);
    this.underground.add(f);
    this.foamMesh = f;
    this.scroll.foam = foamTex;

    // specks riding the current: cheap, but they sell the speed
    const N = 220;
    const pos = new Float32Array(N * 3);
    const rng = makeRng(4242);
    this.driftSeeds = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = lerp(-CFG.chanEnd, CFG.chanEnd, rng());
      pos[i * 3 + 1] = CFG.waterY + 0.02 + rng() * 0.03;
      pos[i * 3 + 2] = lerp(CFG.chZ0 + 0.12, CFG.chZ1 - 0.12, rng());
      this.driftSeeds.push(0.7 + rng() * 0.7);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({
      size: 0.055, map: TX.makeSoftDot(32), transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcfe6ff, fog: false,
      sizeAttenuation: true,
    });
    this.drift = new THREE.Points(geo, pm);
    this.underground.add(this.drift);
  }

  // ------------------------------------------------------- gutter + lids
  _gutter() {
    const slabTex = TX.makeConcrete({ size: 512, moss: 0.2, wetLine: -1, tint: 1.0 });
    this.mats.slab = new THREE.MeshStandardMaterial({
      map: slabTex.map, normalMap: slabTex.normal, roughnessMap: slabTex.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.7,
    });
    this.mats.slab.map.repeat.set(14, 1);
    this.mats.slab.normalMap.repeat.set(14, 1);
    this.mats.slab.roughnessMap.repeat.set(14, 1);

    const g = new THREE.Group();
    this.scene.add(g);

    const thick = CFG.coverTop - CFG.ceilY;
    const zc = (CFG.chZ0 + CFG.chZ1) / 2, zw = CFG.chZ1 - CFG.chZ0;
    const cuts = CFG.inlets.map((ix) => [ix - CFG.lidHalfX - 0.06, ix + CFG.lidHalfX + 0.06]);
    let x = CFG.xMin;
    const addSlab = (a, b) => {
      if (b - a < 0.02) return;
      // individual slabs with joints, like a real gutter run
      const n = Math.max(1, Math.round((b - a) / 0.62));
      const w = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w - 0.022, thick, zw), this.mats.slab);
        m.position.set(a + w * (i + 0.5), (CFG.coverTop + CFG.ceilY) / 2, zc);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
      }
    };
    for (const [a, b] of cuts) { addSlab(x, a); x = b; }
    addSlab(x, CFG.xMax);

    // kerb lip along the road edge
    const kerbMat = this.mats.slab.clone();
    kerbMat.color = new THREE.Color(0xe6ecf2);
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(CFG.xMax - CFG.xMin, 0.16, 0.16), kerbMat);
    kerb.position.set(0, CFG.coverTop + 0.02, CFG.chZ0 + 0.02);
    kerb.castShadow = true; kerb.receiveShadow = true;
    g.add(kerb);

    // --- inlet covers -----------------------------------------------------
    const P = TX.makeSteelPlate(512);
    this.mats.steel = new THREE.MeshStandardMaterial({
      map: P.map, normalMap: P.normal, roughnessMap: P.roughness, metalnessMap: P.metalness,
      roughness: 1, metalness: 1, envMapIntensity: 1.0, side: THREE.DoubleSide,
      normalScale: new THREE.Vector2(1.0, 1.0),
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x6d6a66, roughness: 0.55, metalness: 0.85, envMapIntensity: 0.9,
      side: THREE.DoubleSide,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x53504c, roughness: 0.62, metalness: 0.8, envMapIntensity: 0.8,
    });

    const lw = CFG.lidHalfX * 2, ld = CFG.lidZ1 - CFG.lidZ0, lt = 0.075;
    for (let i = 0; i < CFG.inlets.length; i++) {
      const ix = CFG.inlets[i];

      // recessed steel frame the cover drops into
      const fr = new THREE.Group();
      const fo = 0.075;
      for (const [w, d, ox, oz] of [
        [lw + fo * 2, fo, 0, -(ld / 2 + fo / 2)],
        [lw + fo * 2, fo, 0, ld / 2 + fo / 2],
        [fo, ld, -(lw / 2 + fo / 2), 0],
        [fo, ld, lw / 2 + fo / 2, 0],
      ]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), frameMat);
        m.position.set(ox, -0.015, oz);
        m.castShadow = true; m.receiveShadow = true;
        fr.add(m);
      }
      fr.position.set(ix, CFG.coverTop, (CFG.lidZ0 + CFG.lidZ1) / 2);
      this.scene.add(fr);

      // hinge at the far edge so the cover opens toward the street
      const pivot = new THREE.Group();
      pivot.position.set(ix, CFG.coverTop - lt / 2, CFG.lidZ0);
      this.scene.add(pivot);

      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(lw, lt, ld),
        [sideMat, sideMat, this.mats.steel, this.mats.steel, sideMat, sideMat]);
      lid.position.set(0, 0, ld / 2);
      lid.castShadow = true; lid.receiveShadow = true;
      pivot.add(lid);

      // lifting slot at the near edge
      const slot = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, lt + 0.02, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.8, metalness: 0.4 }));
      slot.position.set(0, 0, ld - 0.12);
      pivot.add(slot);

      // the little chunk of section cap that belongs to this cover
      const seg = this.capSegs[i];
      if (seg) { seg.userData.lidIndex = i; }

      const light = new THREE.PointLight(0xcbe2f7, 0, 8, 2);
      light.position.set(ix, CFG.waterY + 0.85, (CFG.chZ0 + CFG.chZ1) / 2);
      this.scene.add(light);
      this.inletLights.push(light);

      // daylight falling through the opening
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.62, CFG.coverTop - CFG.waterY, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xd2e6ff, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        }));
      shaft.position.set(ix, (CFG.coverTop + CFG.waterY) / 2, (CFG.chZ0 + CFG.chZ1) / 2);
      shaft.scale.set(1, 1, 1.6);
      this.scene.add(shaft);

      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.15),
        new THREE.MeshBasicMaterial({
          map: TX.makeSoftDot(128, 0.3), color: 0xbcd8f4, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(ix, CFG.waterY + 0.02, (CFG.chZ0 + CFG.chZ1) / 2);
      this.scene.add(pool);

      this.lids.push({
        index: i, x: ix, pivot, lid, frame: fr, light, shaft, pool, seg,
        open: 0, target: 0, cleared: false,
      });
    }
  }

  // -------------------------------------------------------------- scenery
  _sceneryFar() {
    const rng = makeRng(606);
    const g = new THREE.Group();
    this.scene.add(g);
    this.farScenery = g;

    const wallTex = TX.makeBlockWall(512);
    this.mats.block = new THREE.MeshStandardMaterial({
      map: wallTex.map, normalMap: wallTex.normal, roughnessMap: wallTex.roughness,
      roughness: 1, metalness: 0, envMapIntensity: 0.6,
    });

    // continuous block wall along the far side, with snow capping it
    for (let x = CFG.xMin; x < CFG.xMax; x += 3.2) {
      const w = 3.1;
      const h = 1.25 + rng() * 0.35;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.26), this.mats.block);
      wall.position.set(x + w / 2, h / 2 + 0.42, CFG.roadFar - 0.35);
      wall.castShadow = true; wall.receiveShadow = true;
      g.add(wall);
      const cap = new THREE.Mesh(blobGeometry(0.2, 2, 900 + Math.round(x * 7), 0.85, 0.42), this.mats.snowPlain);
      cap.rotation.y = rng() * 0.3;
      cap.scale.set(w / 0.40, 1.15, 1.7);
      cap.position.set(x + w / 2, h + 0.42, CFG.roadFar - 0.35);
      cap.castShadow = true;
      g.add(cap);
    }

    const houses = [
      [-13.5, 5.4, 5.6, 0], [-7.6, 4.6, 4.9, 1], [-2.4, 5.0, 6.1, 2],
      [3.2, 4.4, 5.2, 3], [8.4, 5.8, 5.9, 0], [14.0, 5.0, 5.4, 1],
    ];
    for (const [x, w, h, style] of houses) g.add(this._house(x, CFG.roadFar - 4.4, w, 5.6, h, style, rng));

    for (const x of [-9.5, 0.6, 11.2]) g.add(this._pole(x, CFG.roadFar - 0.85, rng));
  }

  _sceneryNear() {
    const rng = makeRng(707);
    const g = new THREE.Group();
    this.scene.add(g);
    this.nearScenery = g;

    // wall on the near side, opened up in front of every inlet so people can
    // shovel out of their gate straight into the channel
    const gaps = CFG.inlets.map((x) => [x - 2.3, x + 2.3]);
    const inGap = (a, b) => gaps.some(([ga, gb]) => b > ga && a < gb);
    for (let x = CFG.xMin; x < CFG.xMax; x += 2.6) {
      const w = 2.5;
      if (inGap(x, x + w)) continue;
      const h = 1.2 + rng() * 0.3;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.24), this.mats.block);
      wall.position.set(x + w / 2, h / 2 + 0.38, 3.05);
      wall.castShadow = true; wall.receiveShadow = true;
      g.add(wall);
      const cap = new THREE.Mesh(blobGeometry(0.2, 2, 300 + Math.round(x * 11), 0.85, 0.42), this.mats.snowPlain);
      cap.rotation.y = rng() * 0.3;
      cap.scale.set(w / 0.40, 1.1, 1.6);
      cap.position.set(x + w / 2, h + 0.36, 3.05);
      cap.castShadow = true;
      g.add(cap);
    }

    // gate posts on either side of every opening
    for (const [ga, gb] of gaps) {
      for (const px of [ga, gb]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.75, 0.3), this.mats.block);
        post.position.set(px, 0.3 + 0.875, 3.05);
        post.castShadow = true; post.receiveShadow = true;
        g.add(post);
        const cap = new THREE.Mesh(blobGeometry(0.19, 1, 400 + px * 31, 0.4, 0.22), this.mats.snowPlain);
        cap.position.set(px, 2.2, 3.05);
        cap.castShadow = true;
        g.add(cap);
      }
    }

    // the near row sits well back so the street stays readable from the camera
    const houses = [[-12.5, 5.4, 5.6, 2], [-4.0, 5.0, 5.2, 0], [4.0, 5.6, 5.9, 1], [12.5, 5.2, 5.3, 3]];
    for (const [x, w, h, style] of houses) g.add(this._house(x, 12.4, w, 5.2, h, style, rng));

    // drifts heaped against the near verge
    for (let i = 0; i < 26; i++) {
      const x = lerp(CFG.xMin, CFG.xMax, rng());
      const m = new THREE.Mesh(blobGeometry(0.4 + rng() * 0.36, 2, 1000 + i * 13, 0.5, 0.3), this.mats.snow);
      m.position.set(x, 0.3, 2.52 + rng() * 0.34);
      m.rotation.y = rng() * 6.28;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
  }

  _house(x, z, w, d, h, style, rng) {
    const g = new THREE.Group();
    if (!this.mats.siding) {
      this.mats.siding = [0, 1, 2, 3].map((i) => {
        const s = TX.makeSiding(256, i);
        return new THREE.MeshStandardMaterial({
          map: s.map, normalMap: s.normal, roughnessMap: s.roughness,
          roughness: 1, metalness: 0, envMapIntensity: 0.55,
        });
      });
      const r = TX.makeRoofTile(256);
      this.mats.roof = new THREE.MeshStandardMaterial({
        map: r.map, normalMap: r.normal, roughnessMap: r.roughness,
        roughness: 1, metalness: 0.05, envMapIntensity: 0.7,
      });
      this.mats.glass = new THREE.MeshStandardMaterial({
        color: 0x33424f, roughness: 0.16, metalness: 0.3, envMapIntensity: 1.2,
      });
      this.mats.frame = new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.7, metalness: 0.1 });
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mats.siding[style % 4]);
    body.position.set(x, h / 2, z);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    // gable roof
    const rise = 1.15, over = 0.42;
    const half = w / 2 + over;
    const slope = Math.hypot(half, rise);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.14, d + over * 2), this.mats.roof);
      p.position.set(x + s * half / 2, h + rise / 2, z);
      p.rotation.z = -s * Math.atan2(rise, half);
      p.castShadow = true; p.receiveShadow = true;
      g.add(p);
      const sn = new THREE.Mesh(new THREE.BoxGeometry(slope * 0.98, 0.13, d + over * 2 - 0.1), this.mats.snowPlain);
      sn.position.set(x + s * half / 2, h + rise / 2 + 0.13, z);
      sn.rotation.z = -s * Math.atan2(rise, half);
      sn.castShadow = true;
      g.add(sn);
    }
    // gable ends
    for (const s of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, rise); shape.closePath();
      const tri = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.mats.siding[style % 4]);
      tri.position.set(x, h, z + s * d / 2);
      if (s < 0) tri.rotation.y = Math.PI;
      g.add(tri);
    }

    // windows on the street face: recessed glass inside a real frame
    const nz = z > 0 ? -1 : 1;                 // outward normal of the street face
    const face = z + nz * (d / 2);
    const rows = h > 5 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const wy = 1.45 + r * 2.05;
      const cols = Math.max(1, Math.floor(w / 2.1));
      for (let cI = 0; cI < cols; cI++) {
        const wx = x - w / 2 + (cI + 0.5) * (w / cols);
        const fw = 1.2, fh = 1.3, b = 0.09;
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), this.mats.glass);
        gl.position.set(wx, wy, face + nz * 0.012);
        if (nz < 0) gl.rotation.y = Math.PI;
        g.add(gl);
        for (const [bw, bh, ox, oy] of [
          [fw + b * 2, b, 0, fh / 2 + b / 2], [fw + b * 2, b, 0, -fh / 2 - b / 2],
          [b, fh, -fw / 2 - b / 2, 0], [b, fh, fw / 2 + b / 2, 0], [0.055, fh, 0, 0],
        ]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.09), this.mats.frame);
          bar.position.set(wx + ox, wy + oy, face + nz * 0.045);
          bar.castShadow = true;
          g.add(bar);
        }
      }
    }
    return g;
  }

  _pole(x, z, rng) {
    const g = new THREE.Group();
    if (!this.mats.pole) {
      this.mats.pole = new THREE.MeshStandardMaterial({ color: 0x9d9c98, roughness: 0.85, metalness: 0 });
      this.mats.wire = new THREE.LineBasicMaterial({ color: 0x2b3138, transparent: true, opacity: 0.75 });
    }
    const h = 8.2;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, h, 10), this.mats.pole);
    p.position.set(x, h / 2, z);
    p.castShadow = true;
    g.add(p);
    for (const y of [h - 0.7, h - 1.6]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.09), this.mats.pole);
      arm.position.set(x, y, z);
      arm.castShadow = true;
      g.add(arm);
    }
    // snow riding the top
    const cap = new THREE.Mesh(blobGeometry(0.2, 1, 2000 + x, 0.4, 0.2), this.mats.snowPlain);
    cap.position.set(x, h + 0.05, z);
    g.add(cap);
    return g;
  }

  _distance() {
    const g = new THREE.Group();
    this.scene.add(g);
    const rng = makeRng(808);
    const far = new THREE.MeshStandardMaterial({ color: 0xb9c9db, roughness: 1, metalness: 0 });
    for (let i = 0; i < 30; i++) {
      const w = 5 + rng() * 10, h = 4 + rng() * 11;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 7), far);
      b.position.set(lerp(-95, 95, rng()), h / 2 - 1.5, -46 - rng() * 46);
      g.add(b);
    }
    const hill = new THREE.MeshStandardMaterial({ color: 0xe4eef6, roughness: 1, metalness: 0 });
    for (let i = 0; i < 9; i++) {
      const r = 70 + rng() * 60;
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, r * (0.2 + rng() * 0.12), 22), hill);
      m.position.set(lerp(-240, 240, rng()), -14, -165 - rng() * 55);
      g.add(m);
    }
  }

  _weather() {
    const N = 900;
    const pos = new Float32Array(N * 3);
    const spd = new Float32Array(N);
    const rng = makeRng(909);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = lerp(-22, 22, rng());
      pos[i * 3 + 1] = lerp(-1, 17, rng());
      pos[i * 3 + 2] = lerp(-16, 14, rng());
      spd[i] = 0.5 + rng() * 0.9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.075, map: TX.makeSoftDot(32), transparent: true, opacity: 0.85,
      depthWrite: false, color: 0xffffff, sizeAttenuation: true,
    });
    this.snowfall = new THREE.Points(geo, mat);
    this.snowfall.frustumCulled = false;
    this.snowfallSpeed = spd;
    this.scene.add(this.snowfall);
  }

  // ---------------------------------------------------------------- frame
  update(dt, t, camera) {
    const f = CFG.flow * CFG.flowSpeed;
    if (this.scroll.water) {
      this.scroll.water.offset.x += f * dt * 0.13;
      this.scroll.water.offset.y = Math.sin(t * 0.32) * 0.03;
    }
    if (this.scroll.foam) this.scroll.foam.offset.x += f * dt * 0.2;

    if (this.drift) {
      const p = this.drift.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i) + f * CFG.flowSpeed * 0.55 * this.driftSeeds[i] * dt;
        const span = CFG.chanEnd * 2;
        if (x < -CFG.chanEnd) x += span;
        if (x > CFG.chanEnd) x -= span;
        p.setX(i, x);
        p.setY(i, CFG.waterY + 0.025 + Math.sin(t * 3.1 + i) * 0.008);
      }
      p.needsUpdate = true;
    }

    if (this.snowfall) {
      const p = this.snowfall.geometry.attributes.position;
      const cx = camera.position.x, cz = camera.position.z;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - this.snowfallSpeed[i] * dt;
        let x = p.getX(i) + Math.sin(t * 0.6 + i * 0.7) * 0.22 * dt;
        if (y < -2) { y = 17; }
        // keep the flurry around the camera without it ever popping in view
        let dx = x - cx;
        if (dx > 22) x -= 44; else if (dx < -22) x += 44;
        let z = p.getZ(i);
        const dz = z - cz;
        if (dz > 16) z -= 32; else if (dz < -16) z += 32;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
    }
  }
}
