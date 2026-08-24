// Terrain, sky, distant ranges, wet-ground mask.
// One ridge crosses the scene at z ~ -28; the valley opens toward +z
// (toward the camera). Dryness is told through several small pieces of
// evidence (cracks, a damp trace in the stream bed, patchy grass), not
// by painting everything brown.

import * as THREE from 'three';
import { fbm2, ridged2, clamp, smoothstep, lerp } from './util';

export const WET_REGION = { x0: -46, x1: 46, z0: -34, z1: 30, size: 192 };

export function terrainHeight(x: number, z: number): number {
  // Main ridge: asymmetric (steeper on the valley side), height varies along x.
  const crest = 11.5 + 3.0 * fbm2(x * 0.03 + 7.1, 0.5) - 2.0 * smoothstep(10, 50, Math.abs(x));
  const dzR = z + 28;
  const widthUp = 15.0;   // windward (far) side, gentler
  const widthDown = 8.5;  // valley side, steeper
  const w = dzR < 0 ? widthUp : widthDown;
  let h = crest * Math.exp(-(dzR * dzR) / (2 * w * w));
  // Rock outcrop where the cloud snags (slightly off-center: no symmetry).
  const ox = x - 1.5, oz = z + 26;
  h += 2.1 * Math.exp(-(ox * ox) / 16 - (oz * oz) / 9);
  // Second, lower shoulder to the left for asymmetry.
  const sx = x + 26, sz = z + 30;
  h += 2.2 * Math.exp(-(sx * sx) / 90 - (sz * sz) / 60);
  // Valley floor undulation + gentle dish.
  h += 1.4 * fbm2(x * 0.045 + 3.3, z * 0.045 + 9.9) - 0.7;
  h += 0.35 * fbm2(x * 0.16, z * 0.16 + 4.4);
  // Dry stream channel winding through the valley.
  const cz = streamZ(x);
  const d = z - cz;
  h -= 1.35 * Math.exp(-(d * d) / 2.6) * smoothstep(-14, -6, z - (-28)); // only past the ridge foot
  return h;
}

export function streamZ(x: number): number {
  return 6 + 4.5 * Math.sin(x * 0.075 + 0.8) + 2.0 * Math.sin(x * 0.031 + 3.0);
}

export class WetMask {
  size = WET_REGION.size;
  // 8-bit storage: iOS GPUs cannot linear-filter float32 textures (no
  // OES_texture_float_linear), which would silently sample as zero.
  data: Uint8Array;
  tex: THREE.DataTexture;
  dirty = false;
  totalWet = 0;
  private frame = 0;

  constructor() {
    this.data = new Uint8Array(this.size * this.size);
    this.tex = new THREE.DataTexture(
      this.data as unknown as BufferSource, this.size, this.size, THREE.RedFormat, THREE.UnsignedByteType
    );
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
  }

  uv(x: number, z: number): [number, number] {
    const u = (x - WET_REGION.x0) / (WET_REGION.x1 - WET_REGION.x0);
    const v = (z - WET_REGION.z0) / (WET_REGION.z1 - WET_REGION.z0);
    return [u, v];
  }

  splat(x: number, z: number, radius = 1.4, amount = 0.5) {
    const [u, v] = this.uv(x, z);
    const s = this.size;
    const cx = u * s, cy = v * s;
    const r = (radius / (WET_REGION.x1 - WET_REGION.x0)) * s;
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(s - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(s - 1, Math.ceil(cy + r));
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        const dx = ix - cx, dy = iy - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const fall = 1 - d2 / r2;
        const idx = iy * s + ix;
        const before = this.data[idx];
        const after = Math.min(255, before + amount * fall * fall * 255);
        this.data[idx] = after;
        this.totalWet += (after - before) / 255;
      }
    }
    this.dirty = true;
  }

  sample(x: number, z: number): number {
    const [u, v] = this.uv(x, z);
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const ix = Math.floor(u * (this.size - 1));
    const iy = Math.floor(v * (this.size - 1));
    return this.data[iy * this.size + ix] / 255;
  }

  update() {
    // throttle GPU re-uploads: wetness spread is not frame-critical
    this.frame++;
    if (this.dirty && this.frame % 3 === 0) {
      this.tex.needsUpdate = true;
      this.dirty = false;
    }
  }
}

const TERRAIN_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vCrack;
  varying float vGrass;
  varying float vDamp;
  attribute float crack;
  attribute float grass;
  attribute float damp;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vCrack = crack; vGrass = grass; vDamp = damp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TERRAIN_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vCrack;
  varying float vGrass;
  varying float vDamp;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform vec3 skyColor;
  uniform vec3 groundBounce;
  uniform sampler2D wetMask;
  uniform vec4 wetRegion; // x0, z0, 1/w, 1/h
  uniform vec3 fogColor;
  uniform float fogDensity;
  uniform vec3 camPos;
  uniform float cloudShadow[6]; // 3 loops: xCenter, strength pairs
  uniform float bandShadowZ;
  uniform float sunUp; // 0 overcast .. 1 sun returned

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    // --- albedo build-up ---
    vec3 soil = vec3(0.42, 0.33, 0.24);
    vec3 soilPale = vec3(0.52, 0.44, 0.33);
    vec3 dryGrass = vec3(0.55, 0.47, 0.26);
    vec3 liveGrass = vec3(0.30, 0.38, 0.18);
    vec3 rock = vec3(0.46, 0.44, 0.42);

    float grain = vnoise(vWorld.xz * 2.1) * 0.5 + vnoise(vWorld.xz * 7.3) * 0.5;
    vec3 alb = mix(soil, soilPale, grain);
    // grass patches: only part of the grass is dry — keep some sage remnants
    float g = vGrass;
    vec3 grassC = mix(dryGrass, liveGrass, smoothstep(0.55, 0.9, g));
    alb = mix(alb, grassC, smoothstep(0.25, 0.6, g));
    // rock on steep slopes / high ground
    float steep = 1.0 - n.y;
    float rockM = smoothstep(0.28, 0.5, steep) + smoothstep(9.0, 13.0, vWorld.y) * 0.6;
    alb = mix(alb, rock * (0.85 + grain * 0.3), clamp(rockM, 0.0, 1.0));
    // soil cracks: thin darker lines only where flat & dry
    float crackM = vCrack * (1.0 - rockM) * (1.0 - smoothstep(0.4, 0.7, g));
    alb *= 1.0 - crackM * 0.55;
    // damp trace in the stream bed: a cool dark meander, clearly wetter
    alb = mix(alb, alb * vec3(0.42, 0.48, 0.58), clamp(vDamp * 1.5, 0.0, 1.0));

    // wet mask (rain that has landed)
    vec2 wuv = vec2((vWorld.x - wetRegion.x) * wetRegion.z,
                    (vWorld.z - wetRegion.y) * wetRegion.w);
    float wet = 0.0;
    if (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0)
      wet = texture2D(wetMask, wuv).r;
    alb = mix(alb, alb * vec3(0.5, 0.52, 0.6), clamp(wet * 1.3, 0.0, 1.0) * 0.72);

    // --- lighting ---
    float ndl = max(dot(n, sunDir), 0.0);
    vec3 light = sunColor * ndl + skyColor * (0.55 + 0.45 * n.y) + groundBounce * max(-n.y, 0.0);

    // soft cloud shadow: dark under the band, lighter where loops opened
    float sh = 0.0;
    float dz = vWorld.z - bandShadowZ;
    float bandFall = exp(-dz * dz / 160.0) * smoothstep(46.0, 20.0, abs(vWorld.x));
    for (int i = 0; i < 3; i++) {
      float cx = cloudShadow[i * 2];
      float st = cloudShadow[i * 2 + 1];
      float dx = vWorld.x - cx;
      sh += st * exp(-dx * dx / 130.0);
    }
    sh = clamp(sh, 0.0, 1.0) * bandFall;
    light *= 1.0 - sh * (0.28 - 0.13 * sunUp);

    vec3 col = alb * light;
    // wet ground gets a faint sky reflection sheen
    col += skyColor * wet * 0.05 * (1.0 - steep);

    // dusty air: distance fog with a warm tint low, cooler high
    float dist = length(vWorld - camPos);
    float f = 1.0 - exp(-fogDensity * fogDensity * dist * dist);
    vec3 fogC = mix(fogColor * vec3(1.04, 1.0, 0.92), fogColor, smoothstep(0.0, 18.0, vWorld.y));
    col = mix(col, fogC, clamp(f, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface WorldRefs {
  terrain: THREE.Mesh;
  terrainUniforms: Record<string, THREE.IUniform>;
  sky: THREE.Mesh;
  skyUniforms: Record<string, THREE.IUniform>;
  wetMask: WetMask;
  group: THREE.Group;
}

export function buildWorld(quality: number): WorldRefs {
  const group = new THREE.Group();
  const wetMask = new WetMask();

  // ---- terrain mesh ----
  const segX = quality > 0 ? 150 : 100;
  const segZ = quality > 0 ? 110 : 74;
  const geo = new THREE.PlaneGeometry(180, 96, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -12); // x in [-65,65], z in [-60,36]
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const crackA = new Float32Array(count);
  const grassA = new Float32Array(count);
  const dampA = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // cracks: ridged noise thresholded to thin lines, valley floor only
    const r = ridged2(x * 0.55 + 11, z * 0.55 + 5);
    const flat = smoothstep(-24, -16, z) * (1 - smoothstep(6, 10, h));
    crackA[i] = smoothstep(0.78, 0.94, r) * flat;
    // grass cover: patchy; a bit fresher near the stream bed
    const patch = fbm2(x * 0.07 + 21, z * 0.07 + 13, 4);
    const nearStream = Math.exp(-Math.pow(z - streamZ(x), 2) / 30);
    grassA[i] = clamp(patch * 0.9 + nearStream * 0.45 - smoothstep(6, 11, h) * 0.5, 0, 1);
    // damp trace only along the channel bottom
    dampA[i] = Math.exp(-Math.pow(z - streamZ(x), 2) / 3.2) *
      smoothstep(-16, -8, z) * (0.35 + 0.4 * fbm2(x * 0.2, 5));
  }
  geo.setAttribute('crack', new THREE.BufferAttribute(crackA, 1));
  geo.setAttribute('grass', new THREE.BufferAttribute(grassA, 1));
  geo.setAttribute('damp', new THREE.BufferAttribute(dampA, 1));
  geo.computeVertexNormals();

  const terrainUniforms: Record<string, THREE.IUniform> = {
    sunDir: { value: new THREE.Vector3(-0.35, 0.7, 0.45).normalize() },
    sunColor: { value: new THREE.Color(0.55, 0.55, 0.58) },
    skyColor: { value: new THREE.Color(0.42, 0.46, 0.52) },
    groundBounce: { value: new THREE.Color(0.16, 0.13, 0.1) },
    wetMask: { value: wetMask.tex },
    wetRegion: {
      value: new THREE.Vector4(
        WET_REGION.x0, WET_REGION.z0,
        1 / (WET_REGION.x1 - WET_REGION.x0), 1 / (WET_REGION.z1 - WET_REGION.z0)
      ),
    },
    fogColor: { value: new THREE.Color(0.47, 0.48, 0.51) },
    fogDensity: { value: 0.0075 },
    camPos: { value: new THREE.Vector3() },
    cloudShadow: { value: new Float32Array([-4.5, 0.8, 0, 1.0, 4.5, 0.8]) },
    bandShadowZ: { value: -22.5 },
    sunUp: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: terrainUniforms,
  });
  const terrain = new THREE.Mesh(geo, mat);
  terrain.frustumCulled = false;
  group.add(terrain);

  // ---- distant ridgelines (three haze-tinted layers, asymmetric) ----
  const layers = [
    // value rule under overcast: horizon sky is the brightest far value;
    // ridges sit below it, nearer = darker
    { z: -95, base: 10, amp: 9, col: new THREE.Color(0.175, 0.19, 0.225), seed: 3.7 },
    { z: -150, base: 15, amp: 13, col: new THREE.Color(0.235, 0.25, 0.29), seed: 9.2 },
    { z: -215, base: 20, amp: 17, col: new THREE.Color(0.30, 0.31, 0.35), seed: 15.8 },
  ];
  for (const L of layers) {
    const n = 60;
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    for (let i = 0; i < n; i++) {
      const x0 = -240 + (480 * i) / n;
      const x1 = -240 + (480 * (i + 1)) / n;
      const h0 = L.base + L.amp * (fbm2(x0 * 0.012 + L.seed, L.seed) - 0.25) + L.amp * 0.5 * fbm2(x0 * 0.05, L.seed * 2.0);
      const h1 = L.base + L.amp * (fbm2(x1 * 0.012 + L.seed, L.seed) - 0.25) + L.amp * 0.5 * fbm2(x1 * 0.05, L.seed * 2.0);
      verts.push(x0, -30, L.z, x1, -30, L.z, x0, h0, L.z);
      verts.push(x1, -30, L.z, x1, h1, L.z, x0, h0, L.z);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    const m = new THREE.MeshBasicMaterial({ color: L.col, fog: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // matte fill between the terrain edge and the distant ranges (no sky gap)
  {
    const g = new THREE.PlaneGeometry(520, 220);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.155, 0.165, 0.19) });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(0, -0.6, -160);
    group.add(mesh);
  }

  // thin dry river line in the far valley floor (evidence: the river runs low)
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = -60 + (120 * i) / 40;
      pts.push(new THREE.Vector3(x, terrainHeight(x, streamZ(x)) + 0.06, streamZ(x)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 60, 0.16, 5, false);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.23, 0.27), transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(g, m);
    group.add(mesh);
  }

  // ---- sky dome ----
  const skyUniforms: Record<string, THREE.IUniform> = {
    topColor: { value: new THREE.Color(0.24, 0.28, 0.35) },
    midColor: { value: new THREE.Color(0.37, 0.39, 0.425) },
    horizonColor: { value: new THREE.Color(0.50, 0.475, 0.42) }, // dusty warm horizon
    sunUp: { value: 0 },
    sunDir: { value: new THREE.Vector3(-0.35, 0.7, 0.45).normalize() },
    time: { value: 0 },
  };
  const skyGeo = new THREE.SphereGeometry(400, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vDir;
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor;
      uniform float sunUp; uniform vec3 sunDir; uniform float time;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
      }
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.02, 0.34, h));
        col = mix(col, topColor, smoothstep(0.36, 0.8, h));
        // overcast texture: broad slow variation, heavier low — not uniform noise
        float ov = vnoise(vDir.xz / max(vDir.y, 0.12) * 1.4 + time * 0.008);
        ov = ov * 0.5 + 0.5 * vnoise(vDir.xz / max(vDir.y, 0.12) * 3.1 - time * 0.004);
        col *= 1.0 - (1.0 - sunUp) * 0.24 * ov * (1.0 - h * 0.7);
        // one thin spot in the overcast where light almost breaks through —
        // the gloom is a condition, not the whole world's mood
        vec3 thinDir = normalize(vec3(-0.55, 0.28, -0.75));
        float thin = pow(max(dot(normalize(vDir), thinDir), 0.0), 14.0);
        col += vec3(0.10, 0.09, 0.07) * thin * (1.0 - sunUp);
        // returning sun: warm glow + soft disc
        float sd = max(dot(normalize(vDir), sunDir), 0.0);
        col += sunUp * (vec3(1.0, 0.92, 0.75) * (pow(sd, 220.0) * 0.9 + pow(sd, 8.0) * 0.16));
        col = mix(col, col * vec3(1.05, 1.02, 0.97) + vec3(0.06,0.055,0.04), sunUp * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  group.add(sky);

  // ---- scattered rocks on the ridge (deformed, not noise-cracked) ----
  const rockMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.45, 0.43, 0.41) });
  // keep rocks away from the knot's silhouette so stone never reads as cloud
  const rockSpots = [
    [-14, -28.5, 1.3], [16.5, -27, 1.0], [-22.5, -30, 1.6], [24, -29, 1.2],
  ];
  for (let ri = 0; ri < rockSpots.length; ri++) {
    const [rx, rz, s] = rockSpots[ri];
    const rg = new THREE.IcosahedronGeometry(s, 1);
    const rp = rg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) {
      const vx = rp.getX(i), vy = rp.getY(i), vz = rp.getZ(i);
      const d = 1 + 0.35 * (fbm2(vx * 1.3 + ri * 7, vz * 1.3 + vy) - 0.5);
      rp.setXYZ(i, vx * d * 1.15, vy * d * 0.75, vz * d);
    }
    rg.computeVertexNormals();
    const rm = new THREE.Mesh(rg, rockMat);
    rm.position.set(rx, terrainHeight(rx, rz) + s * 0.25, rz);
    rm.rotation.y = ri * 1.7;
    group.add(rm);
  }

  return { terrain, terrainUniforms, sky, skyUniforms, wetMask, group };
}
