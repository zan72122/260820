import * as THREE from 'three';
import { Rng, makeValueNoise2D, clamp, smoothstep } from '../util/rng';
import {
  groundTexture,
  barkTexture,
  litterLeafTexture,
  fernTexture,
  canopyTexture,
  mistTexture,
} from '../util/textures';

// Temperate mountain forest spring, just after rain, early morning.
// Species logic: one climate zone only — beech/oak-like trunks, ferns,
// moss on damp shaded faces, brown leaf litter. No mixed-biome props.

export const POND_RADIUS = 1.5;

export interface Environment {
  group: THREE.Group;
  terrainHeight: (x: number, z: number) => number;
  stonePos: THREE.Vector3;
  stoneTop: THREE.Vector3;
  setStoneDust: (t: number) => void;
  getStoneDust: () => number;
  update: (dt: number, time: number, camera: THREE.Camera) => void;
  setLowDetail: (low: boolean) => void;
}

export function buildEnvironment(scene: THREE.Scene, rng: Rng, e2e: boolean): Environment {
  const group = new THREE.Group();
  scene.add(group);

  const noise = makeValueNoise2D(rng, 16);

  // --- height field -------------------------------------------------------
  // Bowl 0.2–0.6 m deep so a child can read the bottom, flat wet bank,
  // then a slope rising into the forest (steeper behind the unicorn).
  const terrainHeight = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    let h: number;
    if (r < POND_RADIUS) {
      const t = r / POND_RADIUS;
      h = -0.58 * (1 - t * t) - 0.02;
    } else if (r < 2.6) {
      h = 0.015 * (r - POND_RADIUS);
    } else {
      const d = r - 2.6;
      h = 0.017 + Math.pow(d, 1.4) * 0.075;
    }
    if (r > 1.7) {
      h += (noise(x * 0.55 + 7, z * 0.55 + 3) - 0.5) * 0.1 * smoothstep(1.7, 2.8, r);
      h += Math.max(0, -z - 2.4) * 0.16; // hillside rises behind the spring
    }
    return h;
  };

  // --- sky ----------------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir;
        void main(){
          float up = clamp(vDir.y, 0.0, 1.0);
          vec3 zenith = vec3(0.62, 0.70, 0.74);
          vec3 horizon = vec3(0.78, 0.80, 0.72);
          // pale warm glow low in the east (+x), sun still behind trees
          float east = pow(clamp(dot(normalize(vec3(vDir.x,0.12,vDir.z)), normalize(vec3(1.0,0.16,0.45))), 0.0, 1.0), 3.0);
          vec3 col = mix(horizon, zenith, pow(up, 0.55));
          col += vec3(0.16, 0.12, 0.05) * east * (1.0 - up);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  group.add(sky);

  scene.fog = new THREE.Fog(0xa7b5a5, 5.0, 17);
  scene.background = new THREE.Color(0xa7b5a5);

  // --- lights -------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xc6d5dc, 0x5c5440, 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffeed6, 2.6);
  sun.position.set(6.5, 4.2, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(e2e ? 512 : 1024, e2e ? 512 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -2.8;
  sc.right = 2.8;
  sc.top = 3.2;
  sc.bottom = -3.2;
  sc.near = 2;
  sc.far = 16;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, -0.8);
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x9fb4bb, 0.8);
  fill.position.set(-4, 3, -4);
  scene.add(fill);

  // --- ground -------------------------------------------------------------
  const SEG = e2e ? 72 : 110;
  const SIZE = 30;
  const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cWetMud = new THREE.Color(0x4b3c2b);
  const cMud = new THREE.Color(0x77614a);
  const cLitter = new THREE.Color(0x8a7252);
  const cMoss = new THREE.Color(0x66784a);
  const tmpC = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    const r = Math.hypot(x, z);
    const n1 = noise(x * 0.8 + 20, z * 0.8 + 20);
    const n2 = noise(x * 2.2 + 40, z * 2.2 + 40);
    // wet dark mud at the waterline, litter further out, moss in damp
    // hollows on the north-facing slope only.
    tmpC.copy(cMud).lerp(cLitter, clamp(n1 * 1.4 - 0.2, 0, 1));
    const wet = 1 - smoothstep(1.5, 2.15, r);
    tmpC.lerp(cWetMud, wet * 0.9);
    const mossAmt = smoothstep(0.55, 0.8, n2) * smoothstep(2.2, 3.6, r) * smoothstep(0.5, 0.9, noise(x * 0.3, z * 0.3)) * (z < 0 ? 1 : 0.35);
    tmpC.lerp(cMoss, mossAmt * 0.7);
    const shade = 0.85 + n2 * 0.3;
    colors[i * 3] = tmpC.r * shade;
    colors[i * 3 + 1] = tmpC.g * shade;
    colors[i * 3 + 2] = tmpC.b * shade;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTexture(rng),
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  groundMat.map!.repeat.set(7, 7);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // wet sheen ring right at the waterline (lower roughness = rain-wet mud)
  const ringGeo = new THREE.RingGeometry(POND_RADIUS - 0.04, 2.05, 64, 3);
  ringGeo.rotateX(-Math.PI / 2);
  const rp = ringGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) {
    rp.setY(i, terrainHeight(rp.getX(i), rp.getZ(i)) + 0.008);
  }
  ringGeo.computeVertexNormals();
  const wetRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({
      color: 0x3a2f21,
      roughness: 0.24,
      metalness: 0,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
  );
  wetRing.receiveShadow = true;
  group.add(wetRing);

  // --- rocks --------------------------------------------------------------
  const makeRock = (radius: number, elong: number, wetTo: number, mossy: number, seedOff: number): THREE.Mesh => {
    const geo = new THREE.IcosahedronGeometry(radius, 3);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const cRock = new THREE.Color(0x7a7468);
    const cRockDark = new THREE.Color(0x4d4a44);
    const cWet = new THREE.Color(0x35322d);
    const cMossR = new THREE.Color(0x4c5c33);
    const v = new THREE.Vector3();
    const hueShift = rng.range(-0.06, 0.06);
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const n = noise(v.x * 3 + seedOff, v.z * 3 + v.y * 2 + seedOff);
      const n2 = noise(v.x * 8 + seedOff * 3, v.y * 8 - v.z * 6);
      v.multiplyScalar(0.74 + n * 0.5 + (n2 - 0.5) * 0.18);
      v.y *= 0.72;
      v.x *= elong;
      p.setXYZ(i, v.x, v.y, v.z);
      tmpC.copy(cRock).lerp(cRockDark, noise(v.x * 6 + seedOff * 2, v.y * 6) * 0.9);
      tmpC.offsetHSL(hueShift, 0.01, (n2 - 0.5) * 0.05);
      // wet band from below (waterline / rain splash)
      const wet = 1 - smoothstep(wetTo - 0.06, wetTo + 0.05, v.y);
      tmpC.lerp(cWet, wet * 0.85);
      // moss only on upward damp faces, patchy — never uniform coating
      const upness = v.clone().normalize().y;
      const mossN = noise(v.x * 5 + 90 + seedOff, v.z * 5 + 90);
      if (upness > 0.45 && mossN > 0.55 && wet < 0.5) {
        tmpC.lerp(cMossR, mossy * smoothstep(0.55, 0.8, mossN));
      }
      col[i * 3] = tmpC.r;
      col[i * 3 + 1] = tmpC.g;
      col[i * 3 + 2] = tmpC.b;
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 + rng.next() * 0.25, metalness: 0.02 })
    );
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // rim rocks — irregular sizes and spacing, sunk into the mud
  // (the sector around the unicorn's stance at -z is kept clear)
  const rimAngles = [0.25, 0.85, 1.5, 2.2, 2.75, 3.35, 5.6];
  rimAngles.forEach((a, i) => {
    const rr = POND_RADIUS + rng.range(-0.12, 0.28);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const size = rng.range(0.1, 0.3);
    const rock = makeRock(size, rng.range(0.9, 1.7), 0.02, rng.range(0.2, 0.8), i * 3.7);
    const gy = terrainHeight(x, z);
    rock.position.set(x, gy + size * 0.28, z);
    rock.rotation.y = rng.next() * Math.PI * 2;
    group.add(rock);
  });
  // two stepping stones inside the water, tops just above the surface
  [
    { x: -0.75, z: 0.55, s: 0.26 },
    { x: 0.62, z: 0.78, s: 0.2 },
  ].forEach((st, i) => {
    const rock = makeRock(st.s, 1.15, 0.05, 0.35, 40 + i * 5);
    rock.position.set(st.x, st.s * 0.32 - 0.1, st.z);
    group.add(rock);
  });

  // --- purification stone -------------------------------------------------
  // Porous black stone on the bank: where wound-up murk is deposited.
  const stonePos = new THREE.Vector3(0.95, 0, -1.2);
  stonePos.y = terrainHeight(stonePos.x, stonePos.z);
  const stoneGeo = new THREE.IcosahedronGeometry(0.26, 3);
  {
    const p = stoneGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const n = noise(v.x * 9 + 5, v.y * 9 + v.z * 7);
      const pore = smoothstep(0.62, 0.78, noise(v.x * 16, v.y * 16 + v.z * 12)) * 0.05;
      v.multiplyScalar(0.9 + n * 0.28 - pore);
      v.y *= 0.85;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    stoneGeo.computeVertexNormals();
  }
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x39322f, roughness: 0.9, metalness: 0 });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.position.copy(stonePos).add(new THREE.Vector3(0, 0.16, 0));
  stone.castShadow = true;
  stone.receiveShadow = true;
  group.add(stone);
  const stoneTop = stone.position.clone().add(new THREE.Vector3(0, 0.2, 0));
  // dust cap: dried murk powder accumulating on top
  const dustMat = new THREE.MeshStandardMaterial({
    color: 0x4a3a4e,
    roughness: 1,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const dust = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), dustMat);
  dust.scale.set(1, 0.32, 1);
  dust.position.copy(stone.position).add(new THREE.Vector3(0, 0.13, 0));
  group.add(dust);
  let dustAmt = 0;
  const setStoneDust = (t: number) => {
    dustAmt = clamp(t, 0, 1);
    dustMat.opacity = dustAmt * 0.85;
  };

  // --- trees --------------------------------------------------------------
  const treeCount = e2e ? 14 : 26;
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.2, 1, 7, 3);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ map: barkTexture(rng), roughness: 0.85, color: 0x9a8f80 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyMat = new THREE.MeshBasicMaterial({
    map: canopyTexture(rng),
    transparent: true,
    depthWrite: false,
    opacity: 0.94,
    color: 0x93a385,
  });
  const canopies = new THREE.Group();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const treePositions: THREE.Vector3[] = [];
  let placed = 0;
  let guard = 0;
  while (placed < treeCount && guard++ < 300) {
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(4.2, 13);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // keep the sight-line from the camera side (-x,+z) to the pond open
    if (x < -1.2 && z > 1.2 && r < 7) continue;
    if (treePositions.some((p) => p.distanceTo(new THREE.Vector3(x, 0, z)) < 1.7)) continue;
    const y = terrainHeight(x, z);
    const h = rng.range(6, 10);
    const w = rng.range(0.8, 1.6);
    q.setFromEuler(new THREE.Euler(rng.range(-0.05, 0.05), rng.next() * Math.PI * 2, rng.range(-0.06, 0.06)));
    s.set(w, h, w);
    m4.compose(new THREE.Vector3(x, y - 0.1, z), q, s);
    trunks.setMatrixAt(placed, m4);
    treePositions.push(new THREE.Vector3(x, 0, z));
    // two crossed canopy planes per tree
    for (let k = 0; k < 2; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(2.6, 4.2), rng.range(2, 3.2)), canopyMat);
      c.position.set(x + rng.range(-0.6, 0.6), y + h * rng.range(0.55, 0.8), z + rng.range(-0.6, 0.6));
      c.rotation.y = rng.next() * Math.PI;
      canopies.add(c);
    }
    placed++;
  }
  trunks.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  trunks.castShadow = false;
  group.add(trunks);
  group.add(canopies);

  // --- ferns (cross-quads) ------------------------------------------------
  const fernCount = e2e ? 22 : 46;
  const fernGeo = new THREE.PlaneGeometry(0.58, 0.34);
  fernGeo.translate(0, 0.155, 0);
  const fernMat = new THREE.MeshStandardMaterial({
    map: fernTexture(rng),
    transparent: true,
    alphaTest: 0.18,
    side: THREE.DoubleSide,
    roughness: 0.8,
    color: 0xbfcbb0,
  });
  const ferns = new THREE.InstancedMesh(fernGeo, fernMat, fernCount * 2);
  let fi = 0;
  for (let i = 0; i < fernCount; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(2.3, 5.2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = terrainHeight(x, z);
    const sc = rng.range(0.6, 1.5);
    for (let k = 0; k < 2; k++) {
      q.setFromEuler(new THREE.Euler(0, rng.next() * Math.PI, 0));
      s.set(sc, sc, sc);
      m4.compose(new THREE.Vector3(x, y, z), q, s);
      ferns.setMatrixAt(fi++, m4);
    }
  }
  ferns.count = fi;
  ferns.instanceMatrix.needsUpdate = true;
  group.add(ferns);

  // --- leaf litter --------------------------------------------------------
  const litterCount = e2e ? 90 : 240;
  const litterGeo = new THREE.PlaneGeometry(0.085, 0.11);
  litterGeo.rotateX(-Math.PI / 2);
  const litterMat = new THREE.MeshStandardMaterial({
    map: litterLeafTexture(rng),
    transparent: true,
    alphaTest: 0.4,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const litter = new THREE.InstancedMesh(litterGeo, litterMat, litterCount);
  for (let i = 0; i < litterCount; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = 1.62 + Math.pow(rng.next(), 0.7) * 5.5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = terrainHeight(x, z);
    q.setFromEuler(new THREE.Euler(rng.range(-0.15, 0.15), rng.next() * Math.PI * 2, rng.range(-0.15, 0.15)));
    const sc = rng.range(0.7, 1.5);
    s.set(sc, sc, sc);
    m4.compose(new THREE.Vector3(x, y + 0.008, z), q, s);
    litter.setMatrixAt(i, m4);
  }
  litter.instanceMatrix.needsUpdate = true;
  group.add(litter);

  // --- mist ---------------------------------------------------------------
  const mistMat = new THREE.MeshBasicMaterial({
    map: mistTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
    fog: false,
  });
  const mists: THREE.Mesh[] = [];
  const mistCount = e2e ? 3 : 6;
  for (let i = 0; i < mistCount; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(5, 9), rng.range(1.6, 2.6)), mistMat);
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(5, 10);
    m.position.set(Math.cos(a) * r, rng.range(0.7, 2.2), Math.sin(a) * r);
    m.renderOrder = 20;
    mists.push(m);
    group.add(m);
  }

  const update = (dt: number, time: number, camera: THREE.Camera) => {
    for (let i = 0; i < mists.length; i++) {
      const m = mists[i];
      m.position.x += Math.sin(time * 0.05 + i * 2.2) * dt * 0.05;
      m.position.z += Math.cos(time * 0.04 + i * 1.4) * dt * 0.04;
      m.quaternion.copy(camera.quaternion);
    }
  };

  const setLowDetail = (low: boolean) => {
    litter.count = low ? Math.floor(litterCount * 0.5) : litterCount;
    mists.forEach((m, i) => (m.visible = !low || i < 2));
  };

  return {
    group,
    terrainHeight,
    stonePos,
    stoneTop,
    setStoneDust,
    getStoneDust: () => dustAmt,
    update,
    setLowDetail,
  };
}
