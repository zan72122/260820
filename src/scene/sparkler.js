import * as THREE from 'three';
import { NOISE3, EMBER_RAMP, SCENE_LIGHT } from '../gfx/glsl.js';

// The koyori: a length of paper twisted into a cord, dyed at the top, charred at
// the bottom, with the bead of slag hanging off the end.
//
// It is simulated rather than animated. A verlet chain with a bending stiffness
// behaves like paper string -- it holds a gentle curve, it swings a beat behind
// the hand, and it passes that lag on to the fireball. That chain is the whole
// reason a small movement of a finger reads as one continuous object moving.

const SEGMENTS = 26;
const SEG_LEN = 0.0046;
const RADIAL = 7;

const VERT = /* glsl */ `
attribute float thin;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main(){
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
precision highp float;
${NOISE3}
${EMBER_RAMP}
${SCENE_LIGHT}

uniform float uTime;
uniform float uCharFront;   // v position where carbon begins (advances downward->up)
uniform float uGlow;        // how hot the char front is
uniform vec3 uDyeA;
uniform vec3 uDyeB;
uniform float uTwist;
uniform float uDetail;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main(){
  float u = vUv.x;
  float v = vUv.y;                 // 0 at the fingers, 1 at the tip

  // Twist: the seam of the rolled paper spirals down the cord.
  float tw = fract(u + v * uTwist);
  float ridge = abs(tw - 0.5) * 2.0;
  float groove = smoothstep(0.86, 1.0, ridge);
  float fibre = vnoise(vec3(u * 60.0, v * 320.0, 3.0)) * 0.5
              + vnoise(vec3(u * 22.0, v * 900.0, 9.0)) * 0.5;

  // Paper, dyed toward the top the way shop-bought senko-hanabi are.
  vec3 paper = vec3(0.50, 0.44, 0.33);
  paper *= 0.86 + fibre * 0.3;
  vec3 dye = mix(uDyeA, uDyeB, fract(v * 5.0));
  float dyeMask = smoothstep(0.34, 0.10, v);
  vec3 albedo = mix(paper, dye * (0.8 + fibre * 0.4), dyeMask * 0.9);

  // Scorching, then carbon. The transition band is where the paper is still
  // alight, so it is the only part of the cord that emits.
  float scorch = smoothstep(uCharFront - 0.16, uCharFront - 0.01, v);
  float carbon = smoothstep(uCharFront - 0.03, uCharFront + 0.05, v);
  albedo = mix(albedo, vec3(0.16, 0.10, 0.06), scorch * 0.85);
  albedo = mix(albedo, vec3(0.026, 0.022, 0.021), carbon);

  // Normal perturbation from the twist grooves. Cheap, and it is what makes the
  // cord read as *rolled paper* instead of a smooth wire at macro distance.
  vec3 n = normalize(vNormalW);
  if (uDetail > 0.5) {
    float bump = (fibre - 0.5) * 0.35 - groove * 0.5;
    vec3 dx = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + vec3(1e-5));
    n = normalize(n + dx * bump * 0.55 + vec3(0.0, (fibre - 0.5) * 0.12, 0.0));
  }

  vec3 toEmber = uEmberPos - vPosW;
  float d = length(toEmber);
  vec3 L = toEmber / max(d, 1e-5);
  float atten = emberFalloff(d);
  float ndl = wrapDiffuse(n, L, 0.45);

  // Paper is bright and the sky is the only large source here, so the cord
  // reads all the way down even when the bead is barely alight.
  vec3 lit = albedo * hemisphere(n) * 2.6;
  lit += albedo * uKeyColor * wrapDiffuse(n, uKeyDir, 0.6);
  lit += albedo * uEmberColor * ndl * atten;

  // Paper is translucent: light gets through the far side of a 1mm cord.
  float trans = pow(clamp(dot(-n, L) * 0.5 + 0.5, 0.0, 1.0), 2.0);
  lit += albedo * uEmberColor * trans * atten * 0.35 * (1.0 - carbon);

  // The burning front itself.
  float front = exp(-pow((v - (uCharFront - 0.015)) / 0.05, 2.0));
  float crackle = vnoise(vec3(u * 30.0, v * 260.0, uTime * 3.0));
  float emberT = clamp(0.35 + crackle * 0.5, 0.0, 1.0);
  lit += emberRamp(emberT) * front * uGlow * (1.2 + crackle * 2.4);

  // Glowing cracks in the carbon just above the bead.
  float deep = smoothstep(uCharFront + 0.02, 1.0, v);
  float cracks = smoothstep(0.62, 0.9, vnoise(vec3(u * 26.0, v * 130.0, uTime * 0.7)));
  lit += emberRamp(0.28) * cracks * deep * uGlow * 0.9;

  gl_FragColor = vec4(lit, 1.0);
}
`;

export class Sparkler {
  constructor(lightRig) {
    this.lightRig = lightRig;
    this.n = SEGMENTS;
    this.pos = new Float32Array(SEGMENTS * 3);
    this.prev = new Float32Array(SEGMENTS * 3);
    this.anchor = new THREE.Vector3();

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: lightRig.bind({
        uTime: { value: 0 },
        uCharFront: { value: 0.99 },
        uGlow: { value: 0.0 },
        uDyeA: { value: new THREE.Color(0.42, 0.10, 0.16) },
        uDyeB: { value: new THREE.Color(0.66, 0.52, 0.20) },
        uTwist: { value: 7.5 },
        uDetail: { value: 1 },
      }),
    });

    this._buildGeometry();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;

    this.tip = new THREE.Vector3();
    this.tipVel = new THREE.Vector3();
    this._prevTip = new THREE.Vector3();
    this._frameN = new THREE.Vector3();
    this._frameB = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  _buildGeometry() {
    const rings = SEGMENTS;
    const ring = RADIAL + 1;
    const count = rings * ring;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const index = [];
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j <= RADIAL; j++) {
        const k = i * ring + j;
        uv[k * 2] = j / RADIAL;
        uv[k * 2 + 1] = i / (rings - 1);
      }
    }
    for (let i = 1; i < rings; i++) {
      for (let j = 1; j <= RADIAL; j++) {
        const a = ring * (i - 1) + (j - 1);
        const b = ring * i + (j - 1);
        const c = ring * i + j;
        const d = ring * (i - 1) + j;
        index.push(a, b, d, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(normal, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.06, 0), 0.5);
    this.geometry = g;
  }

  radiusAt(t) {
    // Slightly fat where the fingers hold it, thinning to the tip, with a small
    // swelling of fused slag right at the end.
    const base = 0.00092 - t * 0.00030;
    const bulge = Math.exp(-Math.pow((t - 0.985) / 0.03, 2)) * 0.0007;
    return base + bulge;
  }

  reset(anchor, seed) {
    this.anchor.copy(anchor);
    for (let i = 0; i < SEGMENTS; i++) {
      const t = i / (SEGMENTS - 1);
      // Start with a natural droop rather than a straight line.
      const x = anchor.x + Math.sin(t * 2.0 + seed * 6.0) * 0.0016 * t;
      const y = anchor.y - t * SEG_LEN * (SEGMENTS - 1);
      const z = anchor.z + Math.cos(t * 1.7 + seed * 4.0) * 0.0012 * t;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.prev[i * 3] = x;
      this.prev[i * 3 + 1] = y;
      this.prev[i * 3 + 2] = z;
    }
    this.tip.set(this.pos[(SEGMENTS - 1) * 3], this.pos[(SEGMENTS - 1) * 3 + 1], this.pos[(SEGMENTS - 1) * 3 + 2]);
    this._prevTip.copy(this.tip);
    this.material.uniforms.uCharFront.value = 0.985;
  }

  step(dt, anchor, airDrag) {
    const p = this.pos;
    const q = this.prev;
    const damp = Math.exp(-airDrag * dt);
    const g = -9.81 * dt * dt;

    for (let i = 1; i < SEGMENTS; i++) {
      const o = i * 3;
      const vx = (p[o] - q[o]) * damp;
      const vy = (p[o + 1] - q[o + 1]) * damp;
      const vz = (p[o + 2] - q[o + 2]) * damp;
      q[o] = p[o];
      q[o + 1] = p[o + 1];
      q[o + 2] = p[o + 2];
      p[o] += vx;
      p[o + 1] += vy + g;
      p[o + 2] += vz;
    }

    p[0] = anchor.x;
    p[1] = anchor.y;
    p[2] = anchor.z;
    q[0] = anchor.x;
    q[1] = anchor.y;
    q[2] = anchor.z;

    // Symmetric relaxation gives the chain its dynamics...
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < SEGMENTS - 1; i++) {
        const a = i * 3;
        const b = a + 3;
        let dx = p[b] - p[a];
        let dy = p[b + 1] - p[a + 1];
        let dz = p[b + 2] - p[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (d - SEG_LEN) / d;
        const wA = i === 0 ? 0 : 0.5;
        const wB = i === 0 ? 1 : 0.5;
        dx *= diff;
        dy *= diff;
        dz *= diff;
        p[a] += dx * wA;
        p[a + 1] += dy * wA;
        p[a + 2] += dz * wA;
        p[b] -= dx * wB;
        p[b + 1] -= dy * wB;
        p[b + 2] -= dz * wB;
      }
      // Bending stiffness: paper cord resists kinking, string does not.
      const k = 0.16;
      for (let i = 1; i < SEGMENTS - 1; i++) {
        const a = (i - 1) * 3;
        const b = i * 3;
        const c = (i + 1) * 3;
        const mx = (p[a] + p[c]) * 0.5;
        const my = (p[a + 1] + p[c + 1]) * 0.5;
        const mz = (p[a + 2] + p[c + 2]) * 0.5;
        p[b] += (mx - p[b]) * k;
        p[b + 1] += (my - p[b + 1]) * k;
        p[b + 2] += (mz - p[b + 2]) * k;
      }
    }

    // ...and two root-anchored forward passes make it actually inextensible.
    // Without these, twenty-five links of Gauss-Seidel under gravity settle at
    // about 1.4x their rest length, and the bead hangs well below the paper.
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < SEGMENTS - 1; i++) {
        const a = i * 3;
        const b = a + 3;
        const dx = p[b] - p[a];
        const dy = p[b + 1] - p[a + 1];
        const dz = p[b + 2] - p[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const k = SEG_LEN / d;
        p[b] = p[a] + dx * k;
        p[b + 1] = p[a + 1] + dy * k;
        p[b + 2] = p[a + 2] + dz * k;
      }
    }

    this._prevTip.copy(this.tip);
    const last = (SEGMENTS - 1) * 3;
    this.tip.set(p[last], p[last + 1], p[last + 2]);
    if (dt > 1e-5) this.tipVel.copy(this.tip).sub(this._prevTip).divideScalar(dt);
  }

  updateGeometry() {
    const p = this.pos;
    const posAttr = this.geometry.attributes.position;
    const nrmAttr = this.geometry.attributes.normal;
    const P = posAttr.array;
    const N = nrmAttr.array;
    const ring = RADIAL + 1;

    // Parallel-transported frame: no twisting artefacts as the cord swings.
    let nx = 1;
    let ny = 0;
    let nz = 0;

    for (let i = 0; i < SEGMENTS; i++) {
      const o = i * 3;
      const oPrev = Math.max(0, i - 1) * 3;
      const oNext = Math.min(SEGMENTS - 1, i + 1) * 3;
      let tx = p[oNext] - p[oPrev];
      let ty = p[oNext + 1] - p[oPrev + 1];
      let tz = p[oNext + 2] - p[oPrev + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;

      // Re-orthogonalise the carried normal against the new tangent.
      const dot = nx * tx + ny * ty + nz * tz;
      nx -= tx * dot;
      ny -= ty * dot;
      nz -= tz * dot;
      let nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-4) {
        nx = Math.abs(tx) < 0.9 ? 1 : 0;
        ny = Math.abs(tx) < 0.9 ? 0 : 1;
        nz = 0;
        const d2 = nx * tx + ny * ty + nz * tz;
        nx -= tx * d2;
        ny -= ty * d2;
        nz -= tz * d2;
        nl = Math.hypot(nx, ny, nz) || 1;
      }
      nx /= nl;
      ny /= nl;
      nz /= nl;

      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;

      const t = i / (SEGMENTS - 1);
      const r = this.radiusAt(t);
      for (let j = 0; j <= RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const vx = nx * c + bx * s;
        const vy = ny * c + by * s;
        const vz = nz * c + bz * s;
        const k = (i * ring + j) * 3;
        N[k] = vx;
        N[k + 1] = vy;
        N[k + 2] = vz;
        P[k] = p[o] + vx * r;
        P[k + 1] = p[o + 1] + vy * r;
        P[k + 2] = p[o + 2] + vz * r;
      }
    }
    posAttr.needsUpdate = true;
    nrmAttr.needsUpdate = true;
  }

  setBurn(progress, glow) {
    // The cord is barely consumed -- the bead does the burning. Moving the char
    // front a little is enough to say "this has been alight for a while".
    this.material.uniforms.uCharFront.value = 0.985 - progress * 0.10;
    this.material.uniforms.uGlow.value = glow;
  }

  setDye(a, b) {
    this.material.uniforms.uDyeA.value.copy(a);
    this.material.uniforms.uDyeB.value.copy(b);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

export { SEGMENTS as CORD_SEGMENTS, SEG_LEN as CORD_SEGMENT_LENGTH };
