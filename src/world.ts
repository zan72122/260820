import * as THREE from 'three';
import { fbm, vnoise, clamp, smoothstep, lerp } from './core';

/**
 * World layout (metres):
 *  - unicorn starts near (0, y, 5) facing -Z
 *  - crevasse runs along X, z in [-2 .. -7]  (5 m wide, ~2.2 m deep, rocky bottom)
 *  - near anchor stone at ~(1.35, y, -1.55), far anchor rock at ~(0.85, y, -7.45)
 *  - droplet zone on near side x ∈ [-2.3, 2.3], z ∈ [1.6, 3.9]
 *  - far meadow with herd hoofprints + path into distant trees
 */

export interface WorldRefs {
  groundY: (x: number, z: number) => number;
  sunDir: THREE.Vector3;           // FROM scene TOWARD sun (for shaders)
  sun: THREE.DirectionalLight;
  nearAnchor: { pos: THREE.Vector3; groove: THREE.Vector3; standPos: THREE.Vector3 };
  farAnchor: { pos: THREE.Vector3 };
  dropletMounts: { pos: THREE.Vector3; onWeb: boolean }[];
  gapNearZ: number;
  gapFarZ: number;
  grassUniforms: { uTime: { value: number }; uGust: { value: number } };
}

const GAP_NEAR = -2.0;
const GAP_FAR = -7.0;
const GAP_DEPTH = 2.2;

function baseHeight(x: number, z: number): number {
  // gently rolling highland meadow
  let h = 0.25 * fbm(x * 0.09 + 3.1, z * 0.09 + 7.7, 4) + 0.08 * fbm(x * 0.4, z * 0.4, 3);
  // far side rises slightly toward the tree line
  h += smoothstep(-8, -26, z) * 0.9;
  // near side dips slightly toward the crevasse edge
  h -= smoothstep(2.0, -1.6, z) * 0.12 * (1 - smoothstep(GAP_NEAR, GAP_NEAR - 0.4, z));
  return h;
}

export function groundHeight(x: number, z: number): number {
  const h = baseHeight(x, z);
  // carve crevasse: steep noisy walls, rocky floor (no bottomless pit)
  const wallN = 0.35 * (vnoise(x * 1.7, 12.3) - 0.5);
  const nearEdge = GAP_NEAR + wallN;
  const farEdge = GAP_FAR - wallN;
  const inGap = smoothstep(nearEdge + 0.55, nearEdge - 0.35, z) * smoothstep(farEdge - 0.55, farEdge + 0.35, z);
  const floorRough = 0.25 * fbm(x * 0.9, z * 0.9 + 40, 3);
  return h - inGap * (GAP_DEPTH + floorRough);
}

// ------------------------------------------------------------------ sky & light

function makeSkyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d')!;
  // rain-washed sky: cool blue-grey, one bright break in the clouds (upper left)
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#9fb4c9');
  grad.addColorStop(0.42, '#8ba0b6');
  grad.addColorStop(0.62, '#a9b6c2');
  grad.addColorStop(0.78, '#c3c9cd');
  grad.addColorStop(1.0, '#c9cdd0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // bright cloud break where the sun comes through
  const sunX = 150, sunY = 155;
  const br = g.createRadialGradient(sunX, sunY, 6, sunX, sunY, 190);
  br.addColorStop(0, 'rgba(255,250,235,0.98)');
  br.addColorStop(0.14, 'rgba(255,244,214,0.75)');
  br.addColorStop(0.4, 'rgba(240,238,228,0.28)');
  br.addColorStop(1, 'rgba(240,238,228,0)');
  g.fillStyle = br;
  g.fillRect(0, 0, 512, 512);
  // ragged retreating rain clouds (dark bases, uneven)
  for (let i = 0; i < 46; i++) {
    const cx = (i * 97.3) % 512, cy = 40 + ((i * 61.7) % 200);
    const r = 30 + ((i * 37) % 60);
    const dSun = Math.hypot(cx - sunX, cy - sunY);
    if (dSun < 110) continue; // keep the break open
    const dark = 0.10 + 0.1 * ((i * 13) % 7) / 7;
    const cg = g.createRadialGradient(cx, cy + r * 0.25, r * 0.1, cx, cy, r);
    cg.addColorStop(0, `rgba(96,106,120,${dark})`);
    cg.addColorStop(0.65, `rgba(130,140,152,${dark * 0.6})`);
    cg.addColorStop(1, 'rgba(150,158,168,0)');
    g.fillStyle = cg;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSky(scene: THREE.Scene): { sun: THREE.DirectionalLight; sunDir: THREE.Vector3 } {
  const skyGeo = new THREE.SphereGeometry(90, 32, 18);
  const skyMat = new THREE.MeshBasicMaterial({
    map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  // rotate so the bright break sits up-left-behind the far cliff (over -Z, -X)
  sky.rotation.y = Math.PI * 0.68;
  scene.add(sky);

  scene.fog = new THREE.Fog(0xaeb9c2, 22, 85);
  scene.background = new THREE.Color(0xaeb9c2);

  // low warm sun slanting out of the cloud gap
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(-11, 10, -14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 45;
  const sc = 8;
  sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc;
  sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0.5, 0);

  const hemi = new THREE.HemisphereLight(0xbfd0e2, 0x4c5648, 0.85);
  scene.add(hemi);

  const sunDir = sun.position.clone().sub(sun.target.position).normalize();
  return { sun, sunDir };
}

// ------------------------------------------------------------------ terrain mesh

function buildTerrain(scene: THREE.Scene): void {
  const SIZE = 60, SEG = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x40573a);      // wet meadow green, cool
  const cGrassDry = new THREE.Color(0x5c6b48);
  const cRock = new THREE.Color(0x5b5852);
  const cRockWet = new THREE.Color(0x3e3c38);
  const cMud = new THREE.Color(0x4a4438);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = groundHeight(x, z);
    pos.setY(i, y);
    // classify by depth below the meadow surface
    const depth = baseHeight(x, z) - y;
    const rockness = smoothstep(0.12, 0.7, depth);
    const wet = 0.45 + 0.4 * vnoise(x * 0.55 + 9, z * 0.55);            // patchy wetness
    const grassMix = clamp(fbm(x * 0.35, z * 0.35 + 5, 3), 0, 1);
    c.copy(cGrass).lerp(cGrassDry, grassMix * 0.55);
    c.lerp(cMud, smoothstep(0.65, 0.95, wet) * 0.4);                    // muddy hollows
    const rockCol = cRock.clone().lerp(cRockWet, wet);
    c.lerp(rockCol, rockness);
    // darken toward crevasse floor
    c.multiplyScalar(1 - smoothstep(0.9, 2.0, depth) * 0.45);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.82, metalness: 0.0, envMapIntensity: 0.5
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // a couple of still puddles in near-side hollows (mirror-flat, sky-lit)
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x8fa2b6, roughness: 0.06, metalness: 0.35,
    envMapIntensity: 1.4, transparent: true, opacity: 0.85
  });
  const puddles: [number, number, number][] = [[-1.9, 4.6, 0.55], [2.6, 2.3, 0.4], [-3.4, 1.1, 0.35]];
  for (const [px, pz, pr] of puddles) {
    const pg = new THREE.CircleGeometry(pr, 20);
    pg.rotateX(-Math.PI / 2);
    const pm = new THREE.Mesh(pg, puddleMat);
    pm.position.set(px, groundHeight(px, pz) + 0.012, pz);
    pm.scale.set(1, 1, 0.72 + 0.3 * vnoise(px, pz));
    scene.add(pm);
  }
}

// ------------------------------------------------------------------ rocks & anchors

function distortedRock(r: number, seed: number, wet: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = fbm(v.x * 1.6 + seed, v.y * 1.6 + v.z + seed * 2, 3);
    v.multiplyScalar(0.72 + 0.55 * n);
    v.y *= 0.78; // rocks sit, not float
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const col = new THREE.Color(0x615d55).lerp(new THREE.Color(0x37342f), wet);
  const mat = new THREE.MeshStandardMaterial({
    color: col, roughness: lerp(0.85, 0.35, wet), metalness: 0.02, envMapIntensity: 0.7
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function buildRocks(scene: THREE.Scene): void {
  // uneven clusters near the crevasse rim — deliberately NOT evenly spaced
  const spots: [number, number, number, number][] = [
    [-3.2, -1.3, 0.5, 0.8], [-2.6, -1.6, 0.3, 0.9], [3.4, -1.1, 0.62, 0.75],
    [4.1, -1.6, 0.34, 0.6], [-4.8, -6.9, 0.55, 0.7], [2.9, -7.6, 0.45, 0.85],
    [3.5, -7.3, 0.28, 0.9], [-1.6, -8.2, 0.4, 0.5], [5.6, 2.2, 0.7, 0.35],
    [-5.9, 3.8, 0.8, 0.4], [0.7, -8.6, 0.3, 0.6]
  ];
  spots.forEach(([x, z, r, wet], i) => {
    const rock = distortedRock(r, i * 7.31, wet);
    rock.position.set(x, groundHeight(x, z) + r * 0.28, z);
    rock.rotation.y = i * 2.39;
    scene.add(rock);
  });
}

function buildAnchors(scene: THREE.Scene): {
  nearAnchor: WorldRefs['nearAnchor']; farAnchor: WorldRefs['farAnchor'];
} {
  // near anchor: a split standing stone right at the rim — the crack is the groove
  const nx = 1.35, nz = -1.62;
  const ny = groundHeight(nx, nz);
  const g1 = distortedRock(0.42, 3.7, 0.75);
  g1.scale.set(0.75, 1.55, 0.8);
  g1.position.set(nx - 0.13, ny + 0.42, nz);
  const g2 = distortedRock(0.36, 8.9, 0.8);
  g2.scale.set(0.65, 1.3, 0.75);
  g2.position.set(nx + 0.17, ny + 0.34, nz + 0.05);
  g2.rotation.y = 0.7;
  scene.add(g1, g2);
  const groove = new THREE.Vector3(nx + 0.02, ny + 0.78, nz - 0.02);

  // far anchor: a low rock horn on the opposite rim
  const fx = 0.85, fz = -7.42;
  const fy = groundHeight(fx, fz);
  const f1 = distortedRock(0.5, 5.2, 0.7);
  f1.scale.set(0.9, 1.15, 0.85);
  f1.position.set(fx, fy + 0.4, fz);
  const f2 = distortedRock(0.24, 11.3, 0.8);
  f2.scale.set(0.7, 1.6, 0.7);
  f2.position.set(fx - 0.2, fy + 0.72, fz - 0.12);
  f2.rotation.z = 0.28;
  scene.add(f1, f2);

  return {
    nearAnchor: {
      pos: new THREE.Vector3(nx, ny, nz),
      groove,
      standPos: new THREE.Vector3(nx - 0.4, 0, nz + 1.5)
    },
    farAnchor: { pos: new THREE.Vector3(fx - 0.14, fy + 0.95, fz - 0.06) }
  };
}

// ------------------------------------------------------------------ grass

function buildGrass(scene: THREE.Scene): WorldRefs['grassUniforms'] {
  const uniforms = { uTime: { value: 0 }, uGust: { value: 0 } };

  const blade = new THREE.PlaneGeometry(0.035, 1, 1, 3);
  blade.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4d6342, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uGust = uniforms.uGust;
    sh.vertexShader = 'uniform float uTime;\nuniform float uGust;\n' + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        // wet grass: heavy, bends over; only faint sway unless a gust passes
        float h = position.y;                       // 0..1 along blade
        vec4 wpos = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        float phase = wpos.x * 1.7 + wpos.z * 2.3;
        float lean = 0.22 + 0.18 * sin(phase * 3.1);
        float sway = (0.012 + uGust * 0.10) * sin(uTime * (1.1 + uGust * 2.0) + phase);
        transformed.x += h * h * (lean * 0.35 + sway);
        transformed.z += h * h * (lean * 0.22 * cos(phase));
        transformed.y -= h * h * lean * 0.25;
      }`
    );
    // darker base, lighter wet-sheen tips
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       diffuseColor.rgb *= 0.55 + 0.65 * vGrassH;`
    );
    sh.vertexShader = sh.vertexShader.replace(
      '#include <common>', '#include <common>\nvarying float vGrassH;'
    ).replace('#include <begin_vertex>', 'vGrassH = position.y;\n#include <begin_vertex>');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGrassH;');
  };

  const COUNT = 5200;
  const inst = new THREE.InstancedMesh(blade, mat, COUNT);
  inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let placed = 0, tries = 0;
  while (placed < COUNT && tries < COUNT * 6) {
    tries++;
    const r1 = vnoise(tries * 0.734, 1.2), r2 = vnoise(tries * 0.311, 7.9), r3 = vnoise(tries * 1.97, 3.3);
    const x = (r1 - 0.5) * 46;
    const z = 8 - r2 * 40;
    if (z < GAP_NEAR + 0.35 && z > GAP_FAR - 0.35) continue;      // not inside the gap
    const y = groundHeight(x, z);
    // clumpy density — bare muddy patches stay bare
    if (fbm(x * 0.5 + 2, z * 0.5, 3) < 0.34) continue;
    const dist = Math.abs(z - 3) + Math.abs(x) * 0.3;
    const hgt = (0.22 + r3 * 0.3) * (dist > 14 ? 1.5 : 1);        // far grass coarser (LOD-ish)
    p.set(x, y, z);
    eu.set(0, r3 * Math.PI * 2, 0);
    q.setFromEuler(eu);
    s.set(1 + r2, hgt / 1.0, 1);
    m4.compose(p, q, s);
    inst.setMatrixAt(placed, m4);
    placed++;
  }
  inst.count = placed;
  inst.frustumCulled = false;
  scene.add(inst);
  return uniforms;
}

// ------------------------------------------------------------------ spider web

function buildWeb(scene: THREE.Scene): THREE.Vector3[] {
  // an orb web slung between two grass tufts on the near side, holding droplets
  const cx = -1.15, cz = 2.85;
  const cy = groundHeight(cx, cz) + 0.5;
  const centre = new THREE.Vector3(cx, cy, cz);
  const norm = new THREE.Vector3(0.25, 0.08, 1).normalize(); // faces roughly toward camera
  const uAx = new THREE.Vector3().crossVectors(norm, new THREE.Vector3(0, 1, 0)).normalize();
  const vAx = new THREE.Vector3().crossVectors(uAx, norm).normalize();

  const pts: number[] = [];
  const R = 0.34;
  const spokeEnds: THREE.Vector3[] = [];
  const SPOKES = 9;
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * Math.PI * 2 + 0.25;
    const e = centre.clone()
      .addScaledVector(uAx, Math.cos(a) * R * (1 + 0.18 * vnoise(i, 3)))
      .addScaledVector(vAx, Math.sin(a) * R * (1 + 0.15 * vnoise(i, 8)));
    spokeEnds.push(e);
    pts.push(centre.x, centre.y, centre.z, e.x, e.y, e.z);
  }
  // spiral rings with sag
  for (let ring = 1; ring <= 5; ring++) {
    const rr = (ring / 5) * R * 0.92;
    for (let i = 0; i < SPOKES; i++) {
      const a0 = (i / SPOKES) * Math.PI * 2 + 0.25;
      const a1 = ((i + 1) / SPOKES) * Math.PI * 2 + 0.25;
      const p0 = centre.clone().addScaledVector(uAx, Math.cos(a0) * rr).addScaledVector(vAx, Math.sin(a0) * rr);
      const p1 = centre.clone().addScaledVector(uAx, Math.cos(a1) * rr).addScaledVector(vAx, Math.sin(a1) * rr);
      const mid = p0.clone().lerp(p1, 0.5); mid.y -= 0.012;
      pts.push(p0.x, p0.y, p0.z, mid.x, mid.y, mid.z, mid.x, mid.y, mid.z, p1.x, p1.y, p1.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xdde6ec, transparent: true, opacity: 0.38 });
  scene.add(new THREE.LineSegments(geo, mat));

  // droplet mounts on the web (lower rings, where real webs hold water)
  return [
    centre.clone().addScaledVector(uAx, 0.16).addScaledVector(vAx, -0.19),
    centre.clone().addScaledVector(uAx, -0.2).addScaledVector(vAx, -0.1)
  ];
}

// ------------------------------------------------------------------ far side / distance

function buildFarSide(scene: THREE.Scene): void {
  // herd hoofprints pressed into the wet far meadow, wandering toward the trees
  const printGeo = new THREE.CircleGeometry(0.09, 10);
  printGeo.rotateX(-Math.PI / 2);
  const printMat = new THREE.MeshStandardMaterial({ color: 0x33302a, roughness: 0.45, envMapIntensity: 0.8 });
  const track: [number, number][] = [];
  let tx = 0.4, tz = -8.2;
  for (let i = 0; i < 14; i++) {
    track.push([tx - 0.14, tz], [tx + 0.14, tz - 0.35]);
    tx += Math.sin(i * 0.8) * 0.35 - 0.05;
    tz -= 0.85;
  }
  for (const [x, z] of track) {
    const m = new THREE.Mesh(printGeo, printMat);
    m.position.set(x, groundHeight(x, z) + 0.015, z);
    m.scale.set(1, 1, 1.35);
    m.rotation.y = Math.atan2(0.1, 1);
    scene.add(m);
  }

  // worn path fading into the trees
  const pathGeo = new THREE.PlaneGeometry(1.1, 14, 1, 24);
  pathGeo.rotateX(-Math.PI / 2);
  const pp = pathGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), z = pp.getZ(i) - 16.5;
    pp.setX(i, x + Math.sin(z * 0.35) * 0.8);
    pp.setY(i, groundHeight(pp.getX(i), z) + 0.03);
    pp.setZ(i, z);
  }
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x574e3e, roughness: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.6
  });
  scene.add(new THREE.Mesh(pathGeo, pathMat));

  // tree line: instanced conifers, clustered unevenly
  const trunkG = new THREE.CylinderGeometry(0.06, 0.12, 1.1, 5);
  trunkG.translate(0, 0.55, 0);
  const crownG = new THREE.ConeGeometry(0.9, 2.6, 7);
  crownG.translate(0, 2.2, 0);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x3c332b, roughness: 0.9 });
  const crownM = new THREE.MeshStandardMaterial({ color: 0x2e4234, roughness: 0.9 });
  const N = 60;
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, N);
  const crowns = new THREE.InstancedMesh(crownG, crownM, N);
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const eu = new THREE.Euler();
  let n = 0;
  for (let i = 0; i < N * 3 && n < N; i++) {
    const r1 = vnoise(i * 0.61, 4.4), r2 = vnoise(i * 1.13, 9.1), r3 = vnoise(i * 0.37, 2.2);
    const x = (r1 - 0.5) * 44;
    const z = -19 - r2 * 12;
    if (fbm(x * 0.2, z * 0.2, 2) < 0.4) continue;         // clumps, with meadow gaps
    const y = groundHeight(x, z);
    const sc = 0.8 + r3 * 0.9;
    eu.set(0, r3 * 6.3, (r1 - 0.5) * 0.06);
    q.setFromEuler(eu);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc, sc));
    trunks.setMatrixAt(n, m4);
    crowns.setMatrixAt(n, m4);
    n++;
  }
  trunks.count = n; crowns.count = n;
  scene.add(trunks, crowns);

  // mountain ridges: flat silhouettes fading into aerial haze
  const ridge = (dist: number, h: number, col: number, op: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-70, -6);
    for (let x = -70; x <= 70; x += 4) {
      shape.lineTo(x, h * (0.4 + fbm(x * 0.03 + dist, dist, 3)));
    }
    shape.lineTo(70, -6);
    const g = new THREE.ShapeGeometry(shape);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: op, fog: false, depthWrite: false
    }));
    m.position.set(0, 0, -dist);
    return m;
  };
  scene.add(ridge(58, 11, 0x8494a8, 0.9));
  scene.add(ridge(48, 8, 0x76879c, 0.85));

  // drifting mist in the crevasse and along the far rim
  const mistTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 32, 4, 64, 32, 60);
    gr.addColorStop(0, 'rgba(226,232,238,0.55)');
    gr.addColorStop(1, 'rgba(226,232,238,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const mists: [number, number, number, number][] = [[-2, -4.5, 4, 0.5], [3, -5, 3, 0.4], [-6, -10, 6, 0.5]];
  for (const [x, z, sc, op] of mists) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: mistTex, transparent: true, opacity: op, depthWrite: false
    }));
    sp.position.set(x, groundHeight(x, z) + 0.8, z);
    sp.scale.set(sc, sc * 0.4, 1);
    scene.add(sp);
  }
}

// ------------------------------------------------------------------ droplet mounts

function pickDropletMounts(): { pos: THREE.Vector3; onWeb: boolean }[] {
  // hand-tuned tall grass tips on the near side — spread so fingers don't cover them
  const tips: [number, number, number][] = [
    [-0.35, 3.1, 0.56],
    [0.85, 2.6, 0.5],
    [1.7, 3.4, 0.62],
    [-1.9, 2.2, 0.46],
    [0.15, 1.9, 0.42],
    [2.3, 2.1, 0.5]
  ];
  return tips.map(([x, z, h]) => ({
    pos: new THREE.Vector3(x, groundHeight(x, z) + h, z),
    onWeb: false
  }));
}

/** Tall seed-head grass stalks under each droplet, so drops sit on something real. */
function buildDropletStalks(scene: THREE.Scene, mounts: { pos: THREE.Vector3; onWeb: boolean }[]): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a7a4e, roughness: 0.5, envMapIntensity: 0.6 });
  for (const m of mounts) {
    if (m.onWeb) continue;
    const groundYv = groundHeight(m.pos.x, m.pos.z);
    const h = m.pos.y - groundYv;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(m.pos.x + 0.03, groundYv, m.pos.z + 0.02),
      new THREE.Vector3(m.pos.x + 0.015, groundYv + h * 0.6, m.pos.z),
      new THREE.Vector3(m.pos.x, m.pos.y, m.pos.z)
    ]);
    const g = new THREE.TubeGeometry(curve, 8, 0.008, 5);
    scene.add(new THREE.Mesh(g, mat));
    // drooping seed head
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.05, 3, 6), mat);
    head.position.copy(m.pos);
    head.rotation.z = 0.5;
    scene.add(head);
  }
}

// ------------------------------------------------------------------ entry

export function buildWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer): WorldRefs {
  const { sun, sunDir } = buildSky(scene);

  // simple neutral environment for wet sheen (cheap, no HDR download)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x8899aa);
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xbccbdc, side: THREE.BackSide })
  );
  envScene.add(top);
  const bright = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2d0 })
  );
  bright.position.set(-4, 6, -5);
  bright.lookAt(0, 0, 0);
  envScene.add(bright);
  scene.environment = pmrem.fromScene(envScene, 0.06).texture;
  pmrem.dispose();

  buildTerrain(scene);
  buildRocks(scene);
  const { nearAnchor, farAnchor } = buildAnchors(scene);
  const grassUniforms = buildGrass(scene);
  const webMounts = buildWeb(scene);
  const mounts = pickDropletMounts();
  for (const w of webMounts) mounts.push({ pos: w, onWeb: true });
  buildDropletStalks(scene, mounts);
  buildFarSide(scene);

  return {
    groundY: groundHeight,
    sunDir, sun,
    nearAnchor, farAnchor,
    dropletMounts: mounts,
    gapNearZ: GAP_NEAR, gapFarZ: GAP_FAR,
    grassUniforms
  };
}
