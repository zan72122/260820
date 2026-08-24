// The cloud band and its knot. One low moist band flows windward → leeward
// (-x → +x), snags on the ridge outcrop, and is pinched into three rope-like
// loops at its center. The band's outer fringe keeps drifting with the wind
// while the knot core stays frozen — that contrast is the puzzle's silent
// statement. No stacked white puffballs, no glowing outlines.

import * as THREE from 'three';
import { mulberry32, clamp, smoothstep, lerp, damp } from './util';

export const LOOP_COUNT = 3;

const SCRATCH_Q = new THREE.Quaternion();
const SCRATCH_V1 = new THREE.Vector3();
const SCRATCH_V2 = new THREE.Vector3();
const SCRATCH_V3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const NOISE_GLSL = /* glsl */ `
  float chash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float cnoise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = mix(chash(i), chash(i + vec3(1,0,0)), u.x);
    float b = mix(chash(i + vec3(0,1,0)), chash(i + vec3(1,1,0)), u.x);
    float c = mix(chash(i + vec3(0,0,1)), chash(i + vec3(1,0,1)), u.x);
    float d = mix(chash(i + vec3(0,1,1)), chash(i + vec3(1,1,1)), u.x);
    return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
  }
  float cfbm(vec3 p) {
    float s = 0.5 * cnoise3(p);
    s += 0.25 * cnoise3(p * 2.13);
    s += 0.125 * cnoise3(p * 4.41);
    return s / 0.875;
  }
`;

const BAND_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  uniform float time;
  uniform float steerX;
  uniform float steerW;
  ${NOISE_GLSL}
  void main() {
    vUv = uv;
    float u = uv.x;
    // thickness profile: thin dissipating ends, a modest squeeze at the
    // center — the band stays a rope; the LOOPS wrap around it, not inside it
    float r = 1.0 + 0.55 * exp(-pow(u - 0.5, 2.0) / 0.02);
    r *= smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.9, u);
    r += 0.22 * (cfbm(vec3(u * 9.0, uv.y * 2.5, 1.7)) - 0.5);
    vec3 p = position + normal * (r - 1.0);
    // free-steer: the released band's belly follows the finger almost fully —
    // the child must feel they are CARRYING the cloud, not nudging it
    vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
    float belly = smoothstep(0.15, 0.5, u) * smoothstep(0.85, 0.5, u);
    wp.x += (steerX - wp.x) * steerW * belly * 0.9;
    wp.y -= steerW * belly * 0.8;
    vWorld = wp;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const BAND_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  uniform float time;
  uniform float openAll;   // 0 knot tight .. 1 fully released
  uniform float sunUp;
  uniform vec3 camPos;
  uniform vec3 fogColor;
  ${NOISE_GLSL}
  void main() {
    float u = vUv.x;
    // wind scroll freezes toward the knot center — outer moves, core holds
    float freeze = smoothstep(0.055, 0.17, abs(u - 0.5));
    float flow = time * 0.05 * mix(freeze, 1.0, openAll);
    float n = cfbm(vec3(u * 11.0 - flow * 3.0, vUv.y * 3.4, u * 3.0 + flow));
    float n2 = cfbm(vec3(u * 25.0 - flow * 5.0, vUv.y * 7.0 + 3.1, 6.0));

    float center = exp(-pow(u - 0.5, 2.0) / 0.018);
    float density = 0.62 + 0.38 * center * (1.0 - openAll * 0.55);
    float ends = smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.86, u);
    vec3 vdir = normalize(camPos - vWorld);
    float rim = abs(dot(normalize(vNormal), vdir));
    float alpha = density * ends;
    alpha *= smoothstep(0.18, 0.6, n * 0.7 + n2 * 0.3 + density * 0.3);
    // keep the band visible even end-on: it must always thread the loops
    alpha *= mix(0.55, 1.0, rim);
    if (alpha < 0.01) discard;

    // lit from above; underside heavier; core darker while knotted —
    // the band must sit DARK against the pale sky, not vanish into it
    float up = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 lit = mix(vec3(0.20, 0.215, 0.255), vec3(0.56, 0.565, 0.60), up);
    lit = mix(lit, lit * vec3(0.55, 0.56, 0.62), center * (1.0 - openAll) * 0.8);
    // faint interior scatter where trapped water sits
    lit += vec3(0.08, 0.09, 0.11) * center * (1.0 - openAll) * (0.5 + 0.5 * n2);
    lit *= 0.92 + sunUp * 0.35;
    lit = mix(lit, lit * vec3(1.08, 1.0, 0.92), sunUp * 0.4);

    float dist = length(camPos - vWorld);
    lit = mix(lit, fogColor, clamp(1.0 - exp(-0.00004 * dist * dist), 0.0, 1.0));
    gl_FragColor = vec4(lit, alpha);
  }
`;

const LOOP_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  uniform float open;
  uniform float bounce;
  uniform float time;
  uniform float twist;
  ${NOISE_GLSL}
  void main() {
    vUv = uv;
    // torus local space: major circle in XY, axis = Z (mesh rotated so axis≈band)
    vec3 p = position;
    vec2 dir = normalize(p.xy + vec2(1e-5));
    vec2 ring = dir * 1.6;
    vec2 offs = p.xy - ring;
    float major = 1.0 + open * 1.2 + bounce * 0.05 * sin(time * 22.0);
    float minor = 1.0 - open * 0.5;
    // a thicker "head" travels around the ring with the twist — rotation
    // the eye can actually track on an otherwise symmetric ring
    float ang0 = atan(p.y, p.x);
    minor *= 1.0 + 0.22 * cos(ang0 - twist * 0.8);
    p.xy = ring * major + offs * minor;
    p.z *= minor;
    // gentle wobble (kept small: big displacement reads as faceted rock)
    float wob = cfbm(vec3(dir * 3.0, time * 0.15)) - 0.5;
    p += vec3(dir * wob, wob) * (0.09 + open * 0.4);
    vLocal = p;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const LOOP_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  uniform float open;
  uniform float twist;
  uniform float time;
  uniform float sunUp;
  uniform float working; // horn engaged on this loop
  uniform vec3 camPos;
  uniform vec3 fogColor;
  ${NOISE_GLSL}
  void main() {
    // angle around the ring, twisted by the accumulated rotation
    float ang = atan(vLocal.y, vLocal.x) + twist;
    float coil = sin(ang * 5.0 + vUv.y * 6.283 * 2.0);
    float n = cfbm(vec3(ang * 1.6, vUv.y * 3.0, twist * 0.35 + time * 0.02));
    float n2 = cnoise3(vec3(ang * 4.0, vUv.y * 8.0, twist * 0.6));

    float density = 0.95 - open * 0.5;
    float alpha = density * smoothstep(0.2, 0.58, n * 0.75 + n2 * 0.25 + 0.2);
    // rope reading: slightly denser braid lines along the coil
    alpha *= 0.72 + 0.28 * smoothstep(-0.25, 0.55, coil);
    vec3 vdir = normalize(camPos - vWorld);
    float rim = abs(dot(normalize(vNormal), vdir));
    // wispy noise-eroded silhouette, high solid interior: cloud, not glass
    alpha *= smoothstep(0.04, 0.4, rim + (n2 - 0.5) * 0.55);
    alpha = min(alpha * 1.25, 0.88);
    alpha *= 1.0 - open * 0.72;
    if (alpha < 0.012) discard;

    float up = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 lit = mix(vec3(0.19, 0.20, 0.245), vec3(0.60, 0.605, 0.64), up);
    // dark heavy core while tight; braid shading
    lit *= mix(0.68, 1.05, open) * (0.9 + 0.1 * coil);
    // weak scattered light inside (trapped droplets catching light) — not neon
    float pocket = smoothstep(0.55, 0.9, cnoise3(vec3(ang * 3.0, vUv.y * 5.0, 8.8)));
    lit += vec3(0.11, 0.12, 0.15) * pocket * (1.0 - open) * (0.6 + 0.4 * sin(time * 1.1 + ang * 2.0) * 0.5);
    lit += vec3(0.05, 0.055, 0.07) * working;
    lit *= 0.92 + sunUp * 0.35;

    float dist = length(camPos - vWorld);
    lit = mix(lit, fogColor, clamp(1.0 - exp(-0.00004 * dist * dist), 0.0, 1.0));
    gl_FragColor = vec4(lit, alpha);
  }
`;

const CROSS_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CROSS_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  uniform float time;
  uniform float openAll;
  uniform float sunUp;
  uniform vec3 camPos;
  uniform vec3 fogColor;
  ${NOISE_GLSL}
  void main() {
    float n = cfbm(vec3(vUv.x * 7.0, vUv.y * 3.0, time * 0.02));
    float n2 = cnoise3(vec3(vUv.x * 16.0, vUv.y * 7.0, 3.3));
    float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    vec3 vdir = normalize(camPos - vWorld);
    float rim = abs(dot(normalize(vNormal), vdir));
    float alpha = 0.9 * ends * smoothstep(0.2, 0.55, n * 0.8 + 0.25);
    alpha *= smoothstep(0.04, 0.4, rim + (n2 - 0.5) * 0.5);
    alpha = min(alpha, 0.85) * (1.0 - openAll);
    if (alpha < 0.015) discard;
    float up = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 lit = mix(vec3(0.185, 0.195, 0.24), vec3(0.58, 0.585, 0.62), up);
    lit *= 0.9 + sunUp * 0.35;
    gl_FragColor = vec4(mix(lit, fogColor, 0.04), alpha);
  }
`;

const STRAND_VERT = /* glsl */ `
  varying float vT;
  uniform float time;
  uniform vec3 hornLocal;  // horn tip in strand local space
  uniform float pull;      // 0..1 attraction to horn
  uniform float sway;
  void main() {
    float t = uv.x; // 0 root .. 1 free tip
    vT = t;
    vec3 p = position;
    float w = sin(time * 1.9 + t * 4.0) * sway;
    p.y += w * t * t * 0.55;
    p.z += sin(time * 1.3 + t * 3.0) * sway * t * t * 0.4;
    vec3 toHorn = hornLocal - p;
    p += toHorn * pull * t * t * 0.85;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const STRAND_FRAG = /* glsl */ `
  precision highp float;
  varying float vT;
  uniform float pull;
  void main() {
    float a = (1.0 - vT * 0.75) * 0.34;
    vec3 c = vec3(0.62, 0.63, 0.68);
    gl_FragColor = vec4(c, a * (0.75 + pull * 0.25));
  }
`;

export interface LoopState {
  progress: number;      // 0 tight .. 1 open
  twist: number;         // accumulated visual rotation
  hintTwist: number;     // transient rotation for bounces & tighten hints
  bounce: number;        // wrong-direction pulse
  jiggle: number;        // trapped droplet agitation
  working: number;       // horn engaged glow
  open: boolean;
  center: THREE.Vector3; // world center
  releasedHero: boolean; // first 3-5 drops fired
}

export class CloudBand {
  group = new THREE.Group();
  curve: THREE.CatmullRomCurve3;
  loops: LoopState[] = [];
  loopMeshes: THREE.Mesh[] = [];
  loopUniforms: Record<string, THREE.IUniform>[] = [];
  bandUniforms: Record<string, THREE.IUniform>;
  spriteUniforms: Record<string, THREE.IUniform>;
  strandUniforms: Record<string, THREE.IUniform>;
  strandRoot: THREE.Object3D;
  dropletMeshes: THREE.Mesh[] = [];
  dropletUniforms: Record<string, THREE.IUniform>[] = [];
  crossUniforms!: Record<string, THREE.IUniform>;
  private sprites: { u: number; side: number; lift: number; scale: number; phase: number }[] = [];
  private spriteMesh: THREE.InstancedMesh;
  private spriteDummy = new THREE.Object3D();
  steerX = 0;
  steerW = 0; // 0 until all loops open

  constructor(quality: number, seed = 777) {
    const rand = mulberry32(seed);
    this.curve = new THREE.CatmullRomCurve3([
      // the band clears the crest then sags toward the valley, where it knots
      // above the outcrop — silhouetted against sky, not against rock
      new THREE.Vector3(-72, 20.5, -40),
      new THREE.Vector3(-46, 18.5, -34),
      new THREE.Vector3(-22, 17.4, -29),
      new THREE.Vector3(-8, 16.6, -25),
      new THREE.Vector3(0, 16.2, -23.2),
      new THREE.Vector3(8, 16.5, -23.6),
      new THREE.Vector3(24, 17.6, -28),
      new THREE.Vector3(50, 19.4, -35),
      new THREE.Vector3(76, 21.5, -42),
    ]);

    // ---- main band ribbon ----
    const tubularSegs = quality > 0 ? 96 : 64;
    const radialSegs = quality > 0 ? 12 : 9;
    const tube = new THREE.TubeGeometry(this.curve, tubularSegs, 1.0, radialSegs, false);
    this.bandUniforms = {
      time: { value: 0 },
      openAll: { value: 0 },
      sunUp: { value: 0 },
      camPos: { value: new THREE.Vector3() },
      fogColor: { value: new THREE.Color(0.47, 0.48, 0.51) },
      steerX: { value: 0 },
      steerW: { value: 0 },
    };
    const bandMat = new THREE.ShaderMaterial({
      vertexShader: BAND_VERT,
      fragmentShader: BAND_FRAG,
      uniforms: this.bandUniforms,
      transparent: true,
      depthWrite: false,
    });
    const band = new THREE.Mesh(tube, bandMat);
    band.frustumCulled = false;
    band.renderOrder = 10;
    this.group.add(band);

    // ---- knot loops ----
    // loops packed tight so they read as ONE tangle threaded on the band,
    // not three separate rings; loop 0 nearest the unicorn (leeward)
    const loopUs = [0.509, 0.5, 0.491];
    for (let i = 0; i < LOOP_COUNT; i++) {
      const u = loopUs[i];
      const c = this.curve.getPointAt(u);
      const tan = this.curve.getTangentAt(u);
      const uniforms: Record<string, THREE.IUniform> = {
        open: { value: 0 },
        twist: { value: 0 },
        bounce: { value: 0 },
        working: { value: 0 },
        time: { value: 0 },
        sunUp: { value: 0 },
        camPos: { value: new THREE.Vector3() },
        fogColor: { value: new THREE.Color(0.47, 0.48, 0.51) },
      };
      const geo = new THREE.TorusGeometry(1.6, 0.55, quality > 0 ? 14 : 10, quality > 0 ? 40 : 28);
      const mat = new THREE.ShaderMaterial({
        vertexShader: LOOP_VERT,
        fragmentShader: LOOP_FRAG,
        uniforms,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(c);
      // torus axis (local +Z) aligned to band tangent, small irregular tilt
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan.clone().normalize());
      mesh.quaternion.copy(q);
      // interlocking tilts: adjacent rings lean against each other so their
      // silhouettes cross — the crossing is what makes "knot" readable
      const tiltZ = [0.55, -0.35, 0.4][i];
      const tiltX = [0.28, -0.2, 0.24][i];
      mesh.rotateZ(tiltZ + (rand() - 0.5) * 0.1);
      mesh.rotateX(tiltX + (rand() - 0.5) * 0.1);
      mesh.frustumCulled = false;
      mesh.renderOrder = 12;
      this.group.add(mesh);
      this.loopMeshes.push(mesh);
      this.loopUniforms.push(uniforms);
      this.loops.push({
        progress: 0, twist: 0, hintTwist: 0, bounce: 0, jiggle: 0, working: 0,
        open: false, center: c.clone(), releasedHero: false,
      });

      // trapped droplets inside this loop
      const dropCount = quality > 0 ? 22 : 14;
      const dgeo = new THREE.InstancedBufferGeometry();
      const oct = new THREE.OctahedronGeometry(0.13, 0);
      oct.scale(0.8, 1.5, 0.8); // teardrop-leaning silhouette
      dgeo.index = oct.index;
      dgeo.attributes.position = oct.attributes.position;
      dgeo.attributes.normal = oct.attributes.normal;
      const offs = new Float32Array(dropCount * 3);
      const seedsA = new Float32Array(dropCount);
      for (let k = 0; k < dropCount; k++) {
        // most droplets sag to the bottom of the loop, like a full water
        // balloon — water that wants to fall, held in
        const a = rand() < 0.7
          ? -Math.PI / 2 + (rand() - 0.5) * 1.7
          : rand() * Math.PI * 2;
        const rr = 1.6 + (rand() - 0.5) * 0.7;
        offs[k * 3] = Math.cos(a) * rr;
        offs[k * 3 + 1] = Math.sin(a) * rr;
        offs[k * 3 + 2] = (rand() - 0.5) * 0.9;
        seedsA[k] = rand();
      }
      dgeo.setAttribute('iOff', new THREE.InstancedBufferAttribute(offs, 3));
      dgeo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seedsA, 1));
      dgeo.instanceCount = dropCount;
      const dUniforms: Record<string, THREE.IUniform> = {
        time: { value: 0 },
        jiggle: { value: 0 },
        fade: { value: 1 },
        camPos: { value: new THREE.Vector3() },
      };
      const dmat = new THREE.ShaderMaterial({
        uniforms: dUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          attribute vec3 iOff;
          attribute float iSeed;
          varying vec3 vN;
          varying float vSeed;
          uniform float time;
          uniform float jiggle;
          void main() {
            vSeed = iSeed;
            vec3 p = iOff;
            float j = jiggle * (0.5 + 0.5 * iSeed);
            p += vec3(
              sin(time * (5.0 + iSeed * 4.0) + iSeed * 40.0),
              cos(time * (6.0 + iSeed * 3.0) + iSeed * 21.0),
              sin(time * 4.4 + iSeed * 13.0)
            ) * 0.24 * j;
            p += position * (0.8 + iSeed * 0.5);
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying vec3 vN;
          varying float vSeed;
          uniform float fade;
          uniform float time;
          void main() {
            // caught light: dark water body, one restrained moving glint
            float glint = pow(max(dot(normalize(vN), normalize(vec3(-0.4, 0.85, 0.35))), 0.0), 3.0);
            float tw = 0.75 + 0.25 * sin(time * (1.4 + vSeed) + vSeed * 30.0);
            vec3 c = vec3(0.30, 0.35, 0.44) + vec3(0.30, 0.31, 0.33) * glint * tw;
            gl_FragColor = vec4(c, fade * (0.42 + glint * 0.35));
          }
        `,
      });
      const dm = new THREE.Mesh(dgeo, dmat);
      dm.position.copy(c);
      dm.quaternion.copy(mesh.quaternion);
      dm.frustumCulled = false;
      dm.renderOrder = 13;
      this.group.add(dm);
      this.dropletMeshes.push(dm);
      this.dropletUniforms.push(dUniforms);
    }

    // ---- crossing strand: the one visible over-under that says "knot" ----
    {
      const K = this.loops[1].center;
      const crossCurve = new THREE.CatmullRomCurve3([
        K.clone().add(new THREE.Vector3(-3.6, -0.9, 0.4)),
        K.clone().add(new THREE.Vector3(-1.5, 1.4, 1.1)),
        K.clone().add(new THREE.Vector3(0.6, 1.8, 1.3)),
        K.clone().add(new THREE.Vector3(2.6, -0.5, 0.6)),
        K.clone().add(new THREE.Vector3(3.7, -1.3, 0.2)),
      ]);
      const cg = new THREE.TubeGeometry(crossCurve, 24, 0.5, 8, false);
      this.crossUniforms = {
        time: { value: 0 },
        openAll: { value: 0 },
        sunUp: { value: 0 },
        camPos: { value: new THREE.Vector3() },
        fogColor: { value: new THREE.Color(0.47, 0.48, 0.51) },
      };
      const cm = new THREE.Mesh(cg, new THREE.ShaderMaterial({
        vertexShader: CROSS_VERT,
        fragmentShader: CROSS_FRAG,
        uniforms: this.crossUniforms,
        transparent: true,
        depthWrite: false,
      }));
      cm.frustumCulled = false;
      cm.renderOrder = 13; // in FRONT of the loops: over-under crossing
      this.group.add(cm);
    }

    // ---- fringe sprites (drifting outer vapor) ----
    const spriteCount = quality > 0 ? 20 : 12;
    const tex = makeWispTexture();
    const smat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0.2,
      color: new THREE.Color(0.42, 0.43, 0.47),
    });
    this.spriteMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.5, 2.2), smat, spriteCount);
    this.spriteMesh.frustumCulled = false;
    this.spriteMesh.renderOrder = 11;
    this.spriteUniforms = {};
    for (let i = 0; i < spriteCount; i++) {
      this.sprites.push({
        u: 0.2 + rand() * 0.6, // fringe hugs the visible stretch of the band
        side: rand() > 0.5 ? 1 : -1,
        lift: (rand() - 0.35) * 1.4,
        scale: 0.55 + rand() * 0.7,
        phase: rand() * Math.PI * 2,
      });
    }
    this.group.add(this.spriteMesh);

    // ---- loose strand near loop 0 (the invitation) ----
    const strandGeo = new THREE.PlaneGeometry(4.2, 0.22, 20, 1);
    strandGeo.translate(2.1, 0, 0); // root at origin, extends +x
    this.strandUniforms = {
      time: { value: 0 },
      hornLocal: { value: new THREE.Vector3(3, -1, 1) },
      pull: { value: 0 },
      sway: { value: 0.5 },
    };
    const strandMat = new THREE.ShaderMaterial({
      vertexShader: STRAND_VERT,
      fragmentShader: STRAND_FRAG,
      uniforms: this.strandUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const strand = new THREE.Mesh(strandGeo, strandMat);
    // the loose strand hangs from loop 0's lower edge, drifting toward the
    // unicorn's side — the one thread that still moves in the wind
    const l0 = this.loops[0].center;
    this.strandRoot = new THREE.Object3D();
    this.strandRoot.position.set(l0.x + 1.1, l0.y - 1.5, l0.z + 0.9);
    this.strandRoot.rotation.y = -0.35;
    this.strandRoot.rotation.z = -0.55;
    this.strandRoot.add(strand);
    strand.renderOrder = 14;
    strand.frustumCulled = false;
    this.group.add(this.strandRoot);
  }

  get openCount(): number {
    return this.loops.filter((l) => l.open).length;
  }
  get allOpen(): boolean {
    return this.openCount === LOOP_COUNT;
  }
  get openAll(): number {
    return this.loops.reduce((s, l) => s + l.progress, 0) / LOOP_COUNT;
  }

  strandTipWorld(out: THREE.Vector3): THREE.Vector3 {
    out.set(4.2, 0, 0);
    return this.strandRoot.localToWorld(out);
  }

  /**
   * Where loop i's freed section of band releases its rain: the leeward
   * loop rains down-valley of the knot, the windward one up-valley — so the
   * ORDER of unwinding decides where rain arrives first.
   */
  releaseCenter(i: number, out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.loops[i].center);
    out.x += [5.5, 0, -5.5][i];
    out.y -= 0.4;
    return out;
  }

  update(dt: number, time: number, cam: THREE.Camera, windAmp: number, sunUp: number, hornWorld: THREE.Vector3, hornNear: number) {
    this.bandUniforms.time.value = time;
    this.bandUniforms.openAll.value = this.openAll;
    this.bandUniforms.sunUp.value = sunUp;
    (this.bandUniforms.camPos.value as THREE.Vector3).copy(cam.position);
    this.bandUniforms.steerX.value = this.steerX;
    this.bandUniforms.steerW.value = damp(this.bandUniforms.steerW.value, this.steerW, 2, dt);

    this.crossUniforms.time.value = time;
    this.crossUniforms.openAll.value = this.openAll;
    this.crossUniforms.sunUp.value = sunUp;
    (this.crossUniforms.camPos.value as THREE.Vector3).copy(cam.position);

    for (let i = 0; i < LOOP_COUNT; i++) {
      const L = this.loops[i];
      const U = this.loopUniforms[i];
      L.bounce = Math.max(0, L.bounce - dt * 2.2);
      L.working = damp(L.working, 0, 3, dt);
      // held drops tremble, then settle: the tremble is a state, not a mood
      if (!L.open && L.working < 0.2) L.jiggle = damp(L.jiggle, 0.08, 0.35, dt);
      U.open.value = damp(U.open.value, L.progress, 5, dt);
      L.hintTwist = damp(L.hintTwist, 0, 2.5, dt); // hint kicks spring back
      U.twist.value = L.twist + L.hintTwist;
      U.bounce.value = L.bounce;
      U.working.value = L.working;
      U.time.value = time;
      U.sunUp.value = sunUp;
      (U.camPos.value as THREE.Vector3).copy(cam.position);

      const D = this.dropletUniforms[i];
      D.time.value = time;
      D.jiggle.value = damp(D.jiggle.value as number, L.jiggle, 4, dt);
      // droplets thin out once the loop is open (they've become rain)
      D.fade.value = damp(D.fade.value as number, L.open ? 0.12 : 1, 1.2, dt);
    }

    // fringe sprites drift with wind; frozen near the knot core until it opens.
    // The drift must be plainly visible — the moving-fringe / rigid-core
    // contrast is the puzzle's one silent statement.
    cam.getWorldQuaternion(SCRATCH_Q);
    const q = SCRATCH_Q;
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i];
      const freeze = smoothstep(0.045, 0.13, Math.abs(s.u - 0.5));
      const speed = 0.016 * windAmp * lerp(freeze, 1, this.openAll);
      s.u += speed * dt * 6;
      if (s.u > 0.82) s.u = 0.18;
      const p = this.curve.getPointAt(clamp(s.u, 0, 1), SCRATCH_V1);
      const tan = this.curve.getTangentAt(clamp(s.u, 0, 1), SCRATCH_V2);
      const sideV = SCRATCH_V3.crossVectors(tan, UP).normalize();
      const wobble = Math.sin(time * 0.4 + s.phase) * 0.5;
      this.spriteDummy.position.copy(p)
        .addScaledVector(sideV, s.side * (1.5 + wobble * 0.6));
      this.spriteDummy.position.y += s.lift + Math.sin(time * 0.3 + s.phase * 2) * 0.3;
      this.spriteDummy.quaternion.copy(q);
      const sc = s.scale * (1 + 0.08 * Math.sin(time * 0.5 + s.phase));
      this.spriteDummy.scale.set(sc, sc, sc);
      this.spriteDummy.updateMatrix();
      this.spriteMesh.setMatrixAt(i, this.spriteDummy.matrix);
    }
    this.spriteMesh.instanceMatrix.needsUpdate = true;

    // loose strand: sways in wind; leans toward the horn when it comes close
    this.strandUniforms.time.value = time;
    this.strandUniforms.sway.value = 0.35 + windAmp * 0.3;
    const local = hornWorld.clone();
    this.strandRoot.worldToLocal(local);
    (this.strandUniforms.hornLocal.value as THREE.Vector3).copy(local);
    this.strandUniforms.pull.value = damp(this.strandUniforms.pull.value, hornNear, 4, dt);
  }

  setSpriteCount(n: number) {
    this.spriteMesh.count = Math.min(n, this.sprites.length);
  }
}

function makeWispTexture(): THREE.CanvasTexture {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  const rand = mulberry32(42);
  // a few soft elongated blobs — irregular, not one round puff
  for (let i = 0; i < 7; i++) {
    const x = S * (0.2 + rand() * 0.6);
    const y = S * (0.35 + rand() * 0.3);
    const rx = S * (0.14 + rand() * 0.22);
    const ry = rx * (0.35 + rand() * 0.3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(255,255,255,${0.16 + rand() * 0.14})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
