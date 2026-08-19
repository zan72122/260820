// ---------------------------------------------------------------------------
// Everything around the working bed: sky, low winter sun, the snowed-under
// field stretching to the horizon, tool shed, bare trees, fence, the wooden
// crate the carrots go into, and the falling snow.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng, lerp, clamp01, fbm, smoothstep } from './util.js';
import {
  skyTexture, snowGrainTexture, woodTexture, snowflakeSprite, barkTexture,
} from './textures.js';
import { soilHeight, snowDepthProfile, BED_W, BED_D } from './field.js';

/**
 * Snow surface height of the surrounding field. Right next to the worked bed
 * this is exactly soil + the same snow profile the bed uses, so the two meshes
 * meet seamlessly; further out the rows fade away and broad drifts take over.
 */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  // geometric rows only where the mesh can still resolve them; beyond that the
  // row texture takes over and the surface eases into broad wind drifts
  const ridgeFade = 1 - smoothstep(3.4, 5.0, r);
  const rimFade = 1 - smoothstep(60, 130, r);     // settle to a flat plain at the rim
  const roll = fbm(x * 0.045, z * 0.045, 3) * 0.85 + fbm(x * 0.16, z * 0.16, 2) * 0.15;
  return soilHeight(x, z) * ridgeFade
       + snowDepthProfile(x, z, ridgeFade)
       + roll * smoothstep(3.2, 18, r) * rimFade
       - trackDepth(x, z);
}

/**
 * Boot prints tramped in beside the bed, on the way to and from the crate.
 * Baked into the ground height so they are real dents in the snow.
 */
const TRACKS = (() => {
  const out = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = lerp(3.1, 1.72, t) + (i % 2 ? 0.10 : -0.10);
    const z = lerp(3.4, 0.98, t);
    out.push([x, z, Math.atan2(-1.38, -2.42)]);
  }
  return out;
})();

function trackDepth(x, z) {
  let d = 0;
  for (let i = 0; i < TRACKS.length; i++) {
    const t = TRACKS[i];
    const dx = x - t[0], dz = z - t[1];
    const ca = Math.cos(t[2]), sa = Math.sin(t[2]);
    const u = (dx * ca + dz * sa) / 0.155;      // along the foot
    const v = (-dx * sa + dz * ca) / 0.085;     // across the foot
    const r2 = u * u + v * v;
    if (r2 < 4) d += 0.075 * Math.exp(-r2 * 1.5);
  }
  return d;
}

/**
 * Ground grid. Lines land exactly on the bed's edges so the rectangular hole
 * cut for the worked bed lines up seam-free, and the zone around the player is
 * sampled finely enough to resolve the 50 cm rows; past that the spacing grows
 * geometrically out to the horizon, where the row texture carries the field.
 */
function axisCoords(inner, fine, outer, step) {
  // inner block: exactly the bed, divided evenly
  const innerSteps = Math.max(4, Math.round((inner * 2) / step));
  const fineSteps = Math.max(2, Math.round((fine - inner) / step));
  const half = [];
  for (let i = 1; i <= fineSteps; i++) half.push(inner + ((fine - inner) * i) / fineSteps);
  // geometric run-out to the horizon
  const farSteps = 26;
  const ratio = Math.pow(outer / fine, 1 / farSteps);
  let x = fine;
  for (let i = 0; i < farSteps; i++) { x *= ratio; half.push(Math.min(x, outer)); }
  const a = [];
  for (let i = half.length - 1; i >= 0; i--) a.push(-half[i]);
  for (let i = 0; i <= innerSteps; i++) a.push(-inner + (2 * inner * i) / innerSteps);
  for (const v of half) a.push(v);
  return a;
}

function warpedGround(halfSize, seg, hole) {
  const hw = hole.w / 2, hd = hole.d / 2;
  const step = 5.6 / Math.max(40, seg * 0.62);   // ~7-9 cm on the default tier
  const xs = axisCoords(hw, 5.0, halfSize, step);
  const zs = axisCoords(hd, 5.0, halfSize, step);
  const pos = [], uv = [], col = [], nrm = [], idx = [];
  const E = 0.02;
  for (let j = 0; j < zs.length; j++) {
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i], z = zs[j];
      // Sink the rim of the hole slightly. The bed's own mesh laps over it, so
      // the coarse edge of this mesh can never float above the bed's finer
      // surface and open a sliver of sky along the join.
      const dEdge = Math.max(Math.abs(x) - hw, Math.abs(z) - hd);
      const sink = dEdge < 0.075 ? 0.015 * (1 - Math.max(0, dEdge) / 0.075) : 0;
      pos.push(x, groundHeight(x, z) - sink, z);
      uv.push(x, z);
      // Analytic normals rather than face averages: the coarse far cells stay
      // smooth, and along the bed's edge they match the snow shader's own
      // gradient exactly, so no shading seam betrays where the bed begins.
      const hx = groundHeight(x + E, z) - groundHeight(x - E, z);
      const hz = groundHeight(x, z + E) - groundHeight(x, z - E);
      const inv = 1 / Math.hypot(hx, 2 * E, hz);
      nrm.push(-hx * inv, 2 * E * inv, -hz * inv);
      col.push(0.97, 0.99, 1.0);
    }
  }
  const W = xs.length;
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      // the bed occupies exactly one block of cells - drop them
      if (xs[i] >= -hw - 1e-6 && xs[i + 1] <= hw + 1e-6 &&
          zs[j] >= -hd - 1e-6 && zs[j + 1] <= hd + 1e-6) continue;
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/**
 * The rows keep marching to the horizon long after the geometry has smoothed
 * out, so the far field carries them as a soft light/shade stripe across U.
 */
function rowStripeTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // one ridge per tile: bright crest, cool shaded furrow
      const s = Math.cos(u * Math.PI * 2) * 0.5 + 0.5;
      const n = fbm(x / size * 5, y / size * 5, 3) * 0.5 + 0.5;
      const k = 0.925 + s * 0.075 + n * 0.030;
      const i = (y * size + x) * 4;
      d[i] = 244 * k * (0.985 + s * 0.02);
      d[i + 1] = 248 * k;
      d[i + 2] = 255 * k;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Collapse a pile of small parts into one mesh per material. Fences, crates
 * and tree bases are made of dozens of little boxes and cylinders; merged,
 * they cost one draw call each instead of sixty.
 */
function mergeParts(parts) {
  const byMaterial = new Map();
  for (const { geometry, matrix, material } of parts) {
    const g = geometry.clone();
    g.applyMatrix4(matrix);
    if (!byMaterial.has(material)) byMaterial.set(material, []);
    byMaterial.get(material).push(g);
  }
  const out = new THREE.Group();
  for (const [material, geos] of byMaterial) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    out.add(mesh);
  }
  return out;
}

function snowMaterial(grain, repeat = 2.4) {
  const bump = grain.clone();
  bump.repeat.set(repeat, repeat);
  bump.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color: 0xf4f7fc,
    roughness: 0.66,
    metalness: 0.0,
    bumpMap: bump,
    bumpScale: 0.9,
    vertexColors: false,
  });
}

const RIDGE_SPACING = 0.5;

// --- trees ------------------------------------------------------------------
function buildBareTree(seed) {
  const rng = makeRng(seed);
  const pos = [], nrm = [], col = [], idx = [];
  const bark = new THREE.Color(0x4a4038);
  const snowC = new THREE.Color(0xe8eef7);

  function limb(origin, dir, len, rad, depth) {
    const RS = depth > 1 ? 5 : 4;
    const end = origin.clone().addScaledVector(dir, len);
    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const sx = new THREE.Vector3().crossVectors(dir, up).normalize();
    const sz = new THREE.Vector3().crossVectors(dir, sx).normalize();
    const base = pos.length / 3;
    for (let r = 0; r < RS; r++) {
      const a = (r / RS) * Math.PI * 2;
      const ox = Math.cos(a), oz = Math.sin(a);
      const n = sx.clone().multiplyScalar(ox).addScaledVector(sz, oz).normalize();
      for (let e = 0; e < 2; e++) {
        const p = e === 0 ? origin : end;
        const rr = e === 0 ? rad : rad * 0.62;
        pos.push(p.x + n.x * rr, p.y + n.y * rr, p.z + n.z * rr);
        nrm.push(n.x, n.y, n.z);
        // snow settles on whatever faces the sky
        const snowy = clamp01(n.y * 0.9 + dir.y * 0.35) * (depth <= 2 ? 0.85 : 0.4);
        const c = bark.clone().lerp(snowC, snowy);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let r = 0; r < RS; r++) {
      const a = base + r * 2, b = base + r * 2 + 1;
      const c = base + ((r + 1) % RS) * 2, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    if (depth <= 0 || len < 0.28) return;
    const branches = depth > 2 ? 2 : 2 + (rng() > 0.55 ? 1 : 0);
    for (let i = 0; i < branches; i++) {
      const nd = dir.clone();
      const ax = new THREE.Vector3(rng() - 0.5, rng() * 0.2, rng() - 0.5).normalize();
      nd.applyAxisAngle(ax, 0.42 + rng() * 0.55).normalize();
      nd.y = Math.max(nd.y, 0.1);
      nd.normalize();
      limb(end, nd, len * (0.58 + rng() * 0.22), rad * 0.6, depth - 1);
    }
  }

  limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 2.1 + rng() * 0.9,
       0.15 + rng() * 0.05, 4);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// --- shed -------------------------------------------------------------------
function buildShed(wood, grain) {
  const g = new THREE.Group();
  const W = 3.8, H = 2.35, D = 3.0;
  const wallMat = new THREE.MeshStandardMaterial({
    map: (() => { const t = wood.clone(); t.repeat.set(2.2, 1.6); t.needsUpdate = true; return t; })(),
    color: 0x9c8b74, roughness: 0.92, metalness: 0,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
  body.position.y = H / 2;
  g.add(body);

  // gable roof: two slabs plus a thick cap of settled snow
  const roofMat = new THREE.MeshStandardMaterial({
    map: (() => { const t = wood.clone(); t.repeat.set(3, 1); t.needsUpdate = true; return t; })(),
    color: 0x6d5b48, roughness: 0.95,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf6f9ff, roughness: 0.7,
    bumpMap: (() => { const t = grain.clone(); t.repeat.set(3, 2); t.needsUpdate = true; return t; })(),
    bumpScale: 0.6,
  });
  const slopeLen = Math.sqrt((D / 2) ** 2 + 0.85 ** 2);
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.35, 0.09, slopeLen), roofMat);
    slab.position.set(0, H + 0.42, s * D / 4);
    slab.rotation.x = s * Math.atan2(0.85, D / 2);
    g.add(slab);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.42, 0.13, slopeLen * 0.99), snowMat);
    cap.position.set(0, H + 0.52, s * D / 4);
    cap.rotation.x = slab.rotation.x;
    g.add(cap);
  }
  // gable ends
  const endShape = new THREE.Shape();
  endShape.moveTo(-W / 2, 0); endShape.lineTo(W / 2, 0); endShape.lineTo(0, 0.85); endShape.closePath();
  const endGeo = new THREE.ExtrudeGeometry(endShape, { depth: 0.12, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(endGeo, wallMat);
    m.position.set(0, H, s * (D / 2) - (s > 0 ? 0 : 0.12));
    g.add(m);
  }
  // door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 1.75, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x4d3f30, roughness: 0.9 })
  );
  door.position.set(-0.6, 0.88, D / 2 + 0.02);
  g.add(door);
  // window with cold blue glass
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x2b3b4a, roughness: 0.25, metalness: 0.1 })
  );
  win.position.set(0.85, 1.45, D / 2 + 0.02);
  g.add(win);
  // snow banked against the walls
  const bank = new THREE.Mesh(
    new THREE.CylinderGeometry(W * 0.62, W * 0.78, 0.34, 16),
    snowMat
  );
  bank.position.y = 0.12;
  bank.scale.set(1, 1, D / W * 1.15);
  g.add(bank);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}

// --- crate ------------------------------------------------------------------
export function buildCrate(wood, grain) {
  const g = new THREE.Group();
  const W = 0.46, D = 0.32, H = 0.24, T = 0.014;
  const mat = new THREE.MeshStandardMaterial({
    map: (() => { const t = wood.clone(); t.repeat.set(1.6, 0.9); t.needsUpdate = true; return t; })(),
    color: 0xc4a781, roughness: 0.88, metalness: 0,
  });
  const matV = new THREE.MeshStandardMaterial({
    map: (() => { const t = wood.clone(); t.repeat.set(0.8, 0.6); t.needsUpdate = true; return t; })(),
    color: 0xb99b76, roughness: 0.88, metalness: 0,
  });
  const parts = [];
  const snowParts = [];
  const add = (geo, x, y, z, m = mat, snowy = false) => {
    const matrix = new THREE.Matrix4().makeTranslation(x, y, z);
    (snowy ? snowParts : parts).push({ geometry: geo, matrix, material: m });
  };
  // slatted long sides (two slats with a gap, like a real produce crate)
  const slatH = 0.085;
  for (const sz of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      add(new THREE.BoxGeometry(W, slatH, T), 0, 0.045 + k * 0.115, sz * (D / 2 - T / 2));
    }
  }
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      add(new THREE.BoxGeometry(T, slatH, D - T * 2), sx * (W / 2 - T / 2), 0.045 + k * 0.115, 0);
    }
  }
  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(0.03, H, 0.03), sx * (W / 2 - 0.015), H / 2 - 0.03, sz * (D / 2 - 0.015), matV);
  }
  // floor boards
  for (let k = 0; k < 3; k++) {
    add(new THREE.BoxGeometry(W - 0.03, T, D / 3 - 0.012), 0, 0.007, (k - 1) * (D / 3));
  }
  // snow caught on the rim
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf7fafe, roughness: 0.7,
    bumpMap: (() => { const t = grain.clone(); t.repeat.set(4, 4); t.needsUpdate = true; return t; })(),
    bumpScale: 0.5,
  });
  for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(W + 0.01, 0.018, T + 0.012), 0, 0.196, sz * (D / 2 - T / 2), snowMat, true);
  }
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(T + 0.012, 0.018, D - T), sx * (W / 2 - T / 2), 0.196, 0, snowMat, true);
  }
  const solid = mergeParts(parts);
  solid.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(solid);
  const capped = mergeParts(snowParts);
  capped.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  g.add(capped);
  g.userData.inner = { w: W - 0.06, d: D - 0.06, floor: 0.02 };
  return g;
}

// --- hand tools -------------------------------------------------------------
function buildBrushTool(wood) {
  const g = new THREE.Group();
  const handleMat = new THREE.MeshStandardMaterial({
    map: (() => { const t = wood.clone(); t.repeat.set(3, 1); t.needsUpdate = true; return t; })(),
    color: 0xc09a6a, roughness: 0.8,
  });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.035, 0.06), handleMat);
  head.position.y = 0.035;
  g.add(head);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.16, 8), handleMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.15, 0.045, 0);
  g.add(handle);
  const bristles = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.038, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x9a7b4e, roughness: 1.0 })
  );
  bristles.position.y = 0.0;
  g.add(bristles);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function buildScoop(wood) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.42, metalness: 0.65 });
  const blade = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), metal);
  blade.scale.set(1, 0.55, 1.25);
  blade.rotation.x = Math.PI;
  blade.position.y = 0.055;
  g.add(blade);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.017, 0.34, 8),
    new THREE.MeshStandardMaterial({
      map: (() => { const t = wood.clone(); t.repeat.set(4, 1); t.needsUpdate = true; return t; })(),
      color: 0xc9a878, roughness: 0.82,
    })
  );
  handle.rotation.z = Math.PI / 2.6;
  handle.position.set(0.18, 0.11, 0);
  g.add(handle);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// --- snowfall ---------------------------------------------------------------
function buildSnowfall(count = 480) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  const rng = makeRng(2468);
  const R = 16, HGT = 11;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rng() * 2 - 1) * R;
    pos[i * 3 + 1] = rng() * HGT;
    pos[i * 3 + 2] = (rng() * 2 - 1) * R;
    seed[i] = rng() * 100;
    size[i] = 0.012 + rng() * 0.030;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: snowflakeSprite(64) },
      uOrigin: { value: new THREE.Vector3() },
      uHeight: { value: HGT },
      uSpan: { value: R },
      uIntensity: { value: 1 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform vec3 uOrigin;
      uniform float uHeight;
      uniform float uSpan;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        float fall = 0.34 + fract(aSeed) * 0.5;
        p.y = mod(p.y - uTime * fall, uHeight);
        p.x += sin(uTime * 0.5 + aSeed * 6.0) * 0.55 + uTime * 0.12;
        p.z += cos(uTime * 0.37 + aSeed * 4.3) * 0.45;
        // keep the flurry centred on the camera
        p.x = mod(p.x - uOrigin.x + uSpan, uSpan * 2.0) - uSpan + uOrigin.x;
        p.z = mod(p.z - uOrigin.z + uSpan, uSpan * 2.0) - uSpan + uOrigin.z;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vAlpha = smoothstep(0.35, 1.4, d) * (1.0 - smoothstep(9.0, 17.0, d));
        gl_PointSize = aSize * 620.0 * uPixelRatio / max(d, 0.25);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uIntensity;
      varying float vAlpha;
      void main(){
        vec4 t = texture2D(uMap, gl_PointCoord);
        float a = t.a * vAlpha * uIntensity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0), a * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  return pts;
}

// --- assembly ---------------------------------------------------------------
export function buildWorld(scene, renderer, quality) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const grain = snowGrainTexture(quality.texBig);
  grain.anisotropy = aniso;
  const wood = woodTexture(quality.texBig, { planks: 5 });
  wood.anisotropy = aniso;

  scene.fog = new THREE.FogExp2(0xd3e0ee, 0.0165);
  scene.background = null;

  // --- sky ---------------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(512, 512), side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // --- lights ------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0x9dc3f2, 0x93a6bd, 0.70);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0cd, 3.15);
  sun.position.set(-5.6, 2.5, 4.6);    // low winter sun, raking across the rows
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  const sc = sun.shadow.camera;
  sc.left = -2.6; sc.right = 2.6; sc.top = 3.2; sc.bottom = -3.2;
  sc.near = 0.5; sc.far = 22;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.018;
  scene.add(sun);

  // gentle bounce from the snow so shadowed sides stay readable
  const fill = new THREE.DirectionalLight(0xd2e2ff, 0.30);
  fill.position.set(5.0, 2.0, -5.5);
  scene.add(fill);

  // --- ground ------------------------------------------------------------
  const groundGeo = warpedGround(300, quality.groundSeg, { w: BED_W, d: BED_D });
  const groundMat = snowMaterial(grain, 22);
  groundMat.vertexColors = true;
  // wins any depth tie with the bed mesh it overlaps at the rim
  groundMat.polygonOffset = true;
  groundMat.polygonOffsetFactor = -1;
  groundMat.polygonOffsetUnits = -2;
  // uv on this mesh is world (x, z) in metres, so one repeat == one row
  const rows = rowStripeTexture(256);
  rows.repeat.set(1 / RIDGE_SPACING, 0.07);
  rows.anisotropy = aniso;
  groundMat.map = rows;
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // faint rows continuing into the haze

  // --- distant hills -----------------------------------------------------
  const hills = new THREE.Group();
  for (const [radius, height, tint, seed] of [[135, 20, 0xc4d3e4, 5], [215, 36, 0xd0dce9, 17]]) {
    const seg = 220;
    const pos = [], idx = [], col = [];
    const base = new THREE.Color(0xdae4ef);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      // rounded, weathered ridges rather than paper-cutout spikes
      const n = fbm(Math.cos(a) * 1.7 + seed, Math.sin(a) * 1.7, 3) * 0.5 + 0.5;
      const n2 = fbm(Math.cos(a) * 4.6 + seed * 2, Math.sin(a) * 4.6, 2) * 0.5 + 0.5;
      const h = height * (0.30 + n * 0.80 + n2 * 0.22);
      pos.push(Math.cos(a) * radius, -3, Math.sin(a) * radius);
      col.push(base.r, base.g, base.b);
      pos.push(Math.cos(a) * radius, h, Math.sin(a) * radius);
      const c = new THREE.Color(tint);
      col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.DoubleSide, fog: true,
    }));
    hills.add(m);
  }
  scene.add(hills);

  // --- trees -------------------------------------------------------------
  const treeVariants = [buildBareTree(11), buildBareTree(23), buildBareTree(41)];
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const trees = new THREE.Group();
  const rng = makeRng(99);
  const treeSpots = [
    [-12.5, -15.5], [-16.0, -19.0], [10.5, -17.5], [15.0, -13.0],
    [-20.0, -8.0], [19.5, -21.0], [-9.0, -24.0], [24.0, -6.0], [3.0, -26.0],
  ];
  const footGeo = new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const footMat = new THREE.MeshStandardMaterial({ color: 0xf2f6fc, roughness: 0.8 });
  const footParts = [];
  const fm = new THREE.Matrix4();
  for (const [tx, tz] of treeSpots) {
    const t = new THREE.Mesh(treeVariants[(rng() * 3) | 0], treeMat);
    const sc = 0.9 + rng() * 0.7;
    t.scale.setScalar(sc);
    t.position.set(tx, groundHeight(tx, tz) - 0.1, tz);
    t.rotation.y = rng() * 6.28;
    trees.add(t);
    // snow piled at the foot
    fm.compose(new THREE.Vector3(tx, groundHeight(tx, tz) - 0.12, tz),
      new THREE.Quaternion(), new THREE.Vector3(sc, sc * 0.35, sc));
    footParts.push({ geometry: footGeo, matrix: fm.clone(), material: footMat });
  }
  trees.add(mergeParts(footParts));
  footGeo.dispose();
  scene.add(trees);

  // --- shed --------------------------------------------------------------
  const shed = buildShed(wood, grain);
  shed.position.set(-8.6, groundHeight(-8.6, -12.5) - 0.18, -12.5);
  shed.rotation.y = 0.42;
  scene.add(shed);

  // --- fence -------------------------------------------------------------
  const postMat = new THREE.MeshStandardMaterial({
    map: (() => { const t = barkTexture(128); t.repeat.set(1, 2); return t; })(),
    color: 0x8a7a66, roughness: 0.95,
  });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x6a6f77, roughness: 0.6, metalness: 0.3 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf6f9ff, roughness: 0.7 });
  {
    const postGeo = new THREE.CylinderGeometry(0.045, 0.055, 1.05, 6);
    const capGeo = new THREE.SphereGeometry(0.055, 7, 5);
    const wireGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 4);
    const parts = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const posAt = (i) => {
      const px = -3.4 - i * 0.06, pz = -2.6 - i * 1.85;
      return new THREE.Vector3(px, groundHeight(px, pz) - 0.14, pz);
    };
    for (let i = 0; i < 16; i++) {
      const p = posAt(i);
      m.compose(new THREE.Vector3(p.x, p.y + 0.525, p.z),
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(i * 2.1) * 0.05),
        new THREE.Vector3(1, 1, 1));
      parts.push({ geometry: postGeo, matrix: m.clone(), material: postMat });
      m.compose(new THREE.Vector3(p.x, p.y + 1.05, p.z), q.identity(), new THREE.Vector3(1, 0.6, 1));
      parts.push({ geometry: capGeo, matrix: m.clone(), material: capMat });
      if (i > 0) {
        const pp = posAt(i - 1);
        for (const wy of [0.42, 0.78]) {
          const a = new THREE.Vector3(pp.x, pp.y + wy, pp.z);
          const b = new THREE.Vector3(p.x, p.y + wy, p.z);
          const len = a.distanceTo(b);
          m.compose(a.clone().lerp(b, 0.5),
            q.setFromUnitVectors(up, b.clone().sub(a).normalize()),
            new THREE.Vector3(1, len, 1));
          parts.push({ geometry: wireGeo, matrix: m.clone(), material: wireMat });
        }
      }
    }
    const fence = mergeParts(parts);
    postGeo.dispose(); capGeo.dispose(); wireGeo.dispose();
    scene.add(fence);
  }

  // --- crate + tools -----------------------------------------------------
  const crate = buildCrate(wood, grain);
  const crateX = 1.46, crateZ = 0.72;
  crate.position.set(crateX, groundHeight(crateX, crateZ) - 0.055, crateZ);
  crate.rotation.y = -0.52;
  scene.add(crate);

  const brush = buildBrushTool(wood);
  brush.position.set(-1.44, groundHeight(-1.44, 0.95) - 0.02, 0.95);
  brush.rotation.set(0.06, 1.1, 0.02);
  scene.add(brush);

  const scoop = buildScoop(wood);
  scoop.position.set(1.72, groundHeight(1.72, -0.35) - 0.03, -0.35);
  scoop.rotation.set(0, -0.85, 0.1);
  scene.add(scoop);

  // --- weather -----------------------------------------------------------
  const snowfall = buildSnowfall(quality.snowflakes);
  scene.add(snowfall);

  return {
    sky, sun, fill, hemi, ground, crate, snowfall, grain, wood, trees, shed,
    setSnowfallIntensity(v) { snowfall.material.uniforms.uIntensity.value = v; },
    update(dt, camera, pixelRatio) {
      const u = snowfall.material.uniforms;
      u.uTime.value += dt;
      u.uOrigin.value.copy(camera.position);
      u.uPixelRatio.value = pixelRatio;
      sky.position.set(camera.position.x, 0, camera.position.z);
    },
  };
}
