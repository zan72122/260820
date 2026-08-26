import * as THREE from '../../vendor/three.module.js';
import { SUN_DIR, PALETTE, PIER_TOP, seabedY } from './env.js';
import { fbm2, hash2 } from '../util/rng.js';

const DECK_FRONT = -1.2;   // seaward edge of the planking
const DECK_BACK = 6.2;
const DECK_HALF_X = 2.55;

/**
 * A small working pier: individually laid planks, wet in patches, standing in
 * ankle-deep water. Nothing decorative is added that a fisher would not own.
 */
export function createShore(woodTex, woodRough, sandTex) {
  const group = new THREE.Group();
  group.name = 'shore';

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughnessMap: woodRough,
    roughness: 0.92,
    metalness: 0.0,
    vertexColors: true
  });

  // ---- deck planks -------------------------------------------------------
  const plankDepth = 0.285, gap = 0.016;
  const span = DECK_BACK - DECK_FRONT;
  const count = Math.floor(span / (plankDepth + gap));
  const plankGeos = [];
  for (let i = 0; i < count; i++) {
    const z = DECK_FRONT + plankDepth * 0.5 + i * (plankDepth + gap);
    const warp = (hash2(i * 3.7, 1.1) - 0.5) * 0.012;      // boards are not co-planar
    const thick = 0.055 + hash2(i * 1.9, 5.5) * 0.012;
    const g = new THREE.BoxGeometry(DECK_HALF_X * 2, thick, plankDepth, 1, 1, 1);
    // The seaward boards take the spray and stay darker than the rest.
    const splash = Math.max(0, 1 - i / 3.2);
    g.rotateZ((hash2(i * 5.1, 9.3) - 0.5) * 0.006);
    g.translate((hash2(i * 2.3, 4.4) - 0.5) * 0.02, PIER_TOP - thick * 0.5 + warp, z);
    worldUv(g, 2.35);
    tintGeometry(g, i, 1 - splash * 0.34);
    plankGeos.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(plankGeos), woodMat));

  // ---- bearers and posts -------------------------------------------------
  const struct = [];
  for (const sx of [-1, 1]) {
    const bearer = new THREE.BoxGeometry(0.09, 0.11, span * 0.98);
    bearer.translate(sx * (DECK_HALF_X - 0.16), PIER_TOP - 0.115, (DECK_FRONT + DECK_BACK) / 2);
    worldUv(bearer, 2.35);
    tintGeometry(bearer, 40);
    struct.push(bearer);
  }
  for (const [px, pz] of [[-2.3, -0.85], [2.3, -0.85], [-2.3, 1.7], [2.3, 1.7], [-2.3, 4.3], [2.3, 4.3]]) {
    const bed = seabedY(px, pz);
    const h = PIER_TOP - bed + 0.35;
    const post = new THREE.CylinderGeometry(0.082, 0.098, h, 9, 3);
    post.translate(px, PIER_TOP - h / 2, pz);
    postUv(post, px, pz, 1.5);
    tintPost(post);
    struct.push(post);
  }
  group.add(new THREE.Mesh(mergeGeometries(struct), woodMat));

  // ---- the beach the pier grows out of -----------------------------------
  const beachSand = sandTex.clone();
  beachSand.needsUpdate = true;
  beachSand.repeat.set(30, 15);
  const sandMat = new THREE.MeshStandardMaterial({ map: beachSand, roughness: 1.0, metalness: 0.0 });
  const beach = new THREE.PlaneGeometry(70, 30, 40, 18);
  beach.rotateX(-Math.PI / 2);
  {
    const p = beach.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) + 16.5;
      const rise = Math.max(0, z - 1.5) * 0.10;
      p.setY(i, -0.06 + rise + (fbm2(x * 0.25, z * 0.25, 3) - 0.5) * 0.07);
      p.setZ(i, z);
    }
    p.needsUpdate = true;
    beach.computeVertexNormals();
  }
  const beachMesh = new THREE.Mesh(beach, sandMat);
  beachMesh.renderOrder = 0;
  group.add(beachMesh);

  // ---- soft occlusion under the pier -------------------------------------
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(5.3, span + 0.4),
    new THREE.MeshBasicMaterial({
      color: 0x0b1a22, transparent: true, opacity: 0.34,
      depthWrite: false, blending: THREE.NormalBlending
    })
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(0, 0.012, (DECK_FRONT + DECK_BACK) / 2);
  shade.renderOrder = 3;
  group.add(shade);

  return { group, woodMat };
}

/**
 * The observation tub: a zinc pail of sea water sunk into the deck, where a fish
 * can be looked at for a moment before it goes back.
 */
export function createTank() {
  const group = new THREE.Group();
  group.position.set(0.86, PIER_TOP, 0.86);

  const zinc = new THREE.MeshStandardMaterial({
    color: 0x74776f, roughness: 0.78, metalness: 0.34, envMapIntensity: 0.5
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.215, 0.22, 24, 1, true), zinc);
  wall.material.side = THREE.DoubleSide;
  wall.position.y = 0.11;
  group.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.215, 24), new THREE.MeshStandardMaterial({
    color: 0x4c504c, roughness: 0.9, metalness: 0.2, envMapIntensity: 0.45
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.005;
  group.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.014, 6, 26), zinc);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.22;
  group.add(rim);

  // Water inside, with its own tiny surface motion.
  const surfMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: PALETTE.waterShallow },
      uSunColor: { value: PALETTE.sunColor },
      uActive: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv; varying vec3 vW;
      uniform float uTime;
      void main(){
        vUv = uv; vec3 p = position;
        p.z += sin(p.x * 22.0 + uTime * 2.4) * 0.0035 + sin(p.y * 19.0 - uTime * 1.9) * 0.003;
        vW = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv; varying vec3 vW;
      uniform float uTime; uniform vec3 uShallow, uSunColor; uniform float uActive;
      void main(){
        vec2 c = vUv * 2.0 - 1.0;
        float r = length(c);
        // Sea water in a zinc pail: dark, holding one soft window of sky.
        float sky = smoothstep(0.75, -0.35, c.y + sin(c.x * 3.0 + uTime * 0.9) * 0.10);
        vec3 col = uShallow * 0.13;
        col += vec3(0.26, 0.31, 0.34) * sky * 0.55;
        float ripple = sin(r * 34.0 - uTime * 2.6 + sin(c.x * 8.0) * 1.4) * 0.5 + 0.5;
        col += uSunColor * pow(ripple, 8.0) * 0.030;
        col *= 0.86 + 0.20 * smoothstep(1.0, 0.35, r);
        col += uSunColor * 0.045 * uActive;
        float a = 0.95 * smoothstep(1.0, 0.95, r);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const surf = new THREE.Mesh(new THREE.CircleGeometry(0.212, 28), surfMat);
  surf.rotation.x = -Math.PI / 2;
  surf.position.y = 0.168;
  surf.renderOrder = 6;
  group.add(surf);

  return { group, surfMat, waterY: PIER_TOP + 0.168, center: new THREE.Vector3(0.86, PIER_TOP + 0.168, 0.86) };
}

/** A coil of spare warp beside the caster's feet. It is where the rope comes from. */
export function createRopeCoil(ropeTex) {
  const mat = new THREE.MeshStandardMaterial({
    map: ropeTex, color: 0xd9c8a4, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.12
  });
  const group = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const r = 0.19 - i * 0.031;
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.017, 5, 22), mat);
    t.rotation.x = Math.PI / 2;
    t.rotation.z = i * 0.7;
    t.position.y = 0.017 + i * 0.019;
    group.add(t);
  }
  group.position.set(-0.72, PIER_TOP, 0.62);
  return group;
}

export function createLights(scene) {
  const sun = new THREE.DirectionalLight(PALETTE.sunColor.clone().multiplyScalar(1.0), 2.35);
  sun.position.copy(SUN_DIR).multiplyScalar(40);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(PALETTE.skyHorizon, PALETTE.waterShallow, 1.15);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(PALETTE.skyZenith, 0.5);
  fill.position.set(6, 8, 10);
  scene.add(fill);
  return { sun, hemi, fill };
}

// ---------------------------------------------------------------------------

/** Project UVs from world space so the grain never repeats per box face. */
function worldUv(geo, scale = 1.0) {
  const p = geo.attributes.position;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Cylindrical UVs for the piles: grain running up the post. */
function postUv(geo, cx, cz, scale = 1.0) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) - cx, y = p.getY(i), z = p.getZ(i) - cz;
    uv[i * 2] = (Math.atan2(z, x) / Math.PI) * 0.45 / scale;
    uv[i * 2 + 1] = y / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function tintGeometry(geo, seed, scale = 1) {
  // Face shading only. Anything smoother than a plank has to come from the
  // texture: a box has four corners per face, and per-vertex damp patches
  // interpolate into visible rectangles.
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const tone = (0.86 + hash2(seed * 3.9, 2.7) * 0.26) * scale;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const l = (y > PIER_TOP - 0.09 ? 1 : 0.60) * tone;
    col[i * 3] = l; col[i * 3 + 1] = l; col[i * 3 + 2] = l;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function tintPost(geo) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // Permanently soaked below the tideline, greened by weed just at it.
    const soak = 1 - Math.min(1, Math.max(0, (y - (-0.02)) / 0.30));
    const weed = Math.exp(-Math.pow((y - 0.02) / 0.13, 2)) * (0.35 + fbm2(x * 9.0, z * 9.0 + y * 6.0, 3) * 0.9);
    const l = 1 - soak * 0.45;
    col[i * 3] = l * (1 - weed * 0.45);
    col[i * 3 + 1] = l * (1 - weed * 0.10);
    col[i * 3 + 2] = l * (1 - weed * 0.42) * (1 - soak * 0.05);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Tiny merge helper: keeps draw calls low without pulling in an addon. */
function mergeGeometries(geos) {
  let vTotal = 0, iTotal = 0;
  for (const g of geos) {
    vTotal += g.attributes.position.count;
    iTotal += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vTotal * 3);
  const nor = new Float32Array(vTotal * 3);
  const uv = new Float32Array(vTotal * 2);
  const col = new Float32Array(vTotal * 3);
  const idx = new Uint32Array(iTotal);
  let vo = 0, io = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, vo * 3);
    else col.fill(1, vo * 3, vo * 3 + n * 3);
    const gi = g.index ? g.index.array : null;
    for (let i = 0; i < (gi ? gi.length : n); i++) idx[io + i] = (gi ? gi[i] : i) + vo;
    io += gi ? gi.length : n;
    vo += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
