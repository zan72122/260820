import * as THREE from '../../vendor/three.module.js';
import { GLSL_SKY } from './sky.js';
import { SUN_DIR, PALETTE, GLSL_ENV, WATER_LEVEL, depthAt, seabedY } from './env.js';

export const MAX_RIPPLES = 6;

// Four travelling swells. Long and low: this is a sheltered shallow, not open sea.
const WAVES = [
  { dx: 0.87, dz: 0.49, k: 0.44, a: 0.062, w: 0.95 },
  { dx: -0.34, dz: 0.94, k: 0.79, a: 0.038, w: 1.20 },
  { dx: 0.60, dz: -0.80, k: 1.70, a: 0.016, w: 1.55 },
  { dx: 0.99, dz: 0.14, k: 3.30, a: 0.006, w: 2.10 }
];

const GLSL_WAVES = /* glsl */`
  uniform float uTime;
  uniform vec4 uRipples[${MAX_RIPPLES}];  // xz = centre, z = age (<0 idle), w = strength

  const vec4 W0 = vec4(${WAVES[0].dx}, ${WAVES[0].dz}, ${WAVES[0].k}, ${WAVES[0].a});
  const vec4 W1 = vec4(${WAVES[1].dx}, ${WAVES[1].dz}, ${WAVES[1].k}, ${WAVES[1].a});
  const vec4 W2 = vec4(${WAVES[2].dx}, ${WAVES[2].dz}, ${WAVES[2].k}, ${WAVES[2].a});
  const vec4 W3 = vec4(${WAVES[3].dx}, ${WAVES[3].dz}, ${WAVES[3].k}, ${WAVES[3].a});
  const vec4 WW = vec4(${WAVES[0].w}, ${WAVES[1].w}, ${WAVES[2].w}, ${WAVES[3].w});

  float shoal(vec2 xz){
    // Swell flattens as it runs into the sandy shallow.
    return clamp(envDepth(xz) / 1.35, 0.06, 1.0);
  }

  float rippleHeight(vec2 xz){
    float h = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++){
      vec4 rp = uRipples[i];
      if (rp.z < 0.0) continue;
      float age = rp.z;
      float r = length(xz - rp.xy);
      float front = age * 2.45;
      float g = exp(-pow((r - front) / 0.62, 2.0));
      float decay = exp(-age * 0.78) * exp(-r * 0.075);
      h += rp.w * 0.115 * g * sin((r - front) * 6.6) * decay;
    }
    return h;
  }

  float waterHeight(vec2 xz){
    float s = shoal(xz);
    float h = 0.0;
    h += W0.w * s * sin(dot(W0.xy, xz) * W0.z + uTime * WW.x);
    h += W1.w * s * sin(dot(W1.xy, xz) * W1.z + uTime * WW.y);
    h += W2.w * s * sin(dot(W2.xy, xz) * W2.z + uTime * WW.z);
    h += W3.w * s * sin(dot(W3.xy, xz) * W3.z + uTime * WW.w);
    return h + rippleHeight(xz);
  }
`;

/** JS twin of waterHeight (base swell only) so the net, drips and fish agree with the shader. */
export function makeHeightSampler() {
  let time = 0;
  const ripples = [];
  const shoal = (x, z) => Math.min(1, Math.max(0.22, depthAt(x, z) / 1.35));
  return {
    setTime(t) { time = t; },
    ripples,
    heightAt(x, z) {
      const s = shoal(x, z);
      let h = 0;
      for (let i = 0; i < WAVES.length; i++) {
        const w = WAVES[i];
        h += w.a * s * Math.sin((w.dx * x + w.dz * z) * w.k + time * w.w);
      }
      for (let i = 0; i < ripples.length; i++) {
        const rp = ripples[i];
        if (rp.age < 0) continue;
        const r = Math.hypot(x - rp.x, z - rp.z);
        const front = rp.age * 2.45;
        const g = Math.exp(-Math.pow((r - front) / 0.62, 2));
        const decay = Math.exp(-rp.age * 0.78) * Math.exp(-r * 0.075);
        h += rp.strength * 0.115 * g * Math.sin((r - front) * 6.6) * decay;
      }
      return h;
    }
  };
}

/** Polar grid: dense where the net lands, reaching far enough to meet the haze. */
function polarGrid(rings, segs, radiusFn, centerX, centerZ) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= rings; i++) {
    const r = radiusFn(i / rings);
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      pos.push(centerX + Math.cos(a) * r, 0, centerZ + Math.sin(a) * r);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % segs;
      const a = i * segs + j, b = i * segs + j2;
      const c = (i + 1) * segs + j, d = (i + 1) * segs + j2;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  geo.boundingSphere.radius = 1e5;
  return geo;
}

export function createWater(renderer, noiseTex, quality) {
  const rings = quality.waterRings, segs = quality.waterSegs;
  const geo = polarGrid(rings, segs, (t) => 26 * t + 2974 * Math.pow(t, 5), 0, -7);

  const ripples = [];
  for (let i = 0; i < MAX_RIPPLES; i++) ripples.push(new THREE.Vector4(0, 0, -1, 0));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uRipples: { value: ripples },
      uSunDir: { value: SUN_DIR },
      uZenith: { value: PALETTE.skyZenith },
      uHorizon: { value: PALETTE.skyHorizon },
      uSunColor: { value: PALETTE.sunColor },
      uShallow: { value: PALETTE.waterShallow },
      uDeep: { value: PALETTE.waterDeep },
      uFoam: { value: PALETTE.foam },
      uNoise: { value: noiseTex },
      uWetness: { value: 0 }
    },
    vertexShader: /* glsl */`
      precision highp float;
      varying vec3 vWorld;
      varying vec3 vNormal2;
      varying float vDepth;
      ${GLSL_ENV}
      ${GLSL_WAVES}
      void main(){
        vec3 p = position;
        vec2 xz = p.xz;
        float h = waterHeight(xz);
        // Forward differences: exact enough for lighting, a third of the cost of central.
        float e = 0.16;
        float hx = waterHeight(xz + vec2(e, 0.0));
        float hz = waterHeight(xz + vec2(0.0, e));
        vNormal2 = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
        p.y = ${WATER_LEVEL.toFixed(3)} + h;
        vWorld = p;
        vDepth = envDepth(xz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vWorld;
      varying vec3 vNormal2;
      varying float vDepth;
      uniform vec3 uShallow, uDeep, uFoam;
      uniform sampler2D uNoise;
      uniform float uTime;
      ${GLSL_SKY}
      void main(){
        // Where the sand is out of the water there is simply no water.
        if (vDepth <= 0.004) discard;

        vec3 V = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);

        // Micro chop, fading out with distance so the offing stays calm and hazy.
        // Two samples at unrelated scales, the second rotated, so the tile of
        // the noise texture never shows up as a grid on the water.
        vec2 nuv = vWorld.xz * 0.38 + vec2(uTime * 0.030, uTime * 0.019);
        mat2 rot = mat2(0.802, -0.597, 0.597, 0.802);
        vec3 n1 = texture2D(uNoise, nuv).rgb;
        vec3 n2 = texture2D(uNoise, rot * vWorld.xz * 1.19 - vec2(uTime * 0.045, uTime * 0.021)).rgb;
        float micro = clamp(1.0 - dist / 95.0, 0.0, 1.0); micro *= micro;
        vec3 N = normalize(vNormal2 + vec3((n1.g - 0.5) * 0.14 + (n2.b - 0.5) * 0.075, 0.0,
                                           (n1.b - 0.5) * 0.14 + (n2.g - 0.5) * 0.075) * micro);

        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.2);
        fres = mix(0.03, 1.0, fres);

        vec3 R = reflect(-V, N);
        R.y = abs(R.y) * 0.92 + 0.02;
        vec3 refl = skyColor(R, uTime);

        // Body colour: sandy green over the shallow, cold blue where it drops away.
        float dz = clamp(vDepth / 3.0, 0.0, 1.0);
        vec3 body = mix(uShallow, uDeep, pow(dz, 0.62));

        // Sun glitter path — the clearest cue for where the light is coming from.
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 260.0) * 3.4;
        float sparkle = pow(max(dot(N, H), 0.0), 90.0) * pow(n2.r, 2.0) * 0.85 * micro;

        vec3 col = mix(body, refl, fres);
        col += uSunColor * (spec + sparkle);

        // Lace of foam where the swell meets the sand.
        float edge = 1.0 - smoothstep(0.006, 0.16, vDepth);
        float foam = smoothstep(0.52, 0.98, edge * (0.55 + n1.r * 0.95));
        col = mix(col, uFoam, foam * 0.48);

        float alpha = mix(0.12, 0.94, smoothstep(0.04, 3.6, vDepth));
        alpha = clamp(alpha + fres * 0.40 + foam * 0.5, 0.0, 1.0);

        // Dissolve into sea haze long before the geometry runs out.
        float haze = smoothstep(38.0, 520.0, dist);
        col = mix(col, skyColor(normalize(vec3(V.x, 0.008, V.z) * -1.0), uTime), haze);
        alpha = mix(alpha, 1.0, haze);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.name = 'water';

  return { mesh, material: mat, ripples };
}

/** Sea bed: wet ripple-barred sand, with caustics that only survive in shallow water. */
export function createSeabed(sandTex, quality) {
  const rings = quality.bedRings, segs = quality.bedSegs;
  const geo = polarGrid(rings, segs, (t) => 4 * t + 146 * Math.pow(t, 3), 0, -7);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, seabedY(pos.getX(i), pos.getZ(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSand: { value: sandTex },
      uSunDir: { value: SUN_DIR },
      uSunColor: { value: PALETTE.sunColor },
      uShallow: { value: PALETTE.waterShallow },
      uDeep: { value: PALETTE.waterDeep }
    },
    vertexShader: /* glsl */`
      precision highp float;
      varying vec3 vWorld;
      varying vec3 vN;
      void main(){
        vWorld = position;
        vN = normalize(normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vWorld;
      varying vec3 vN;
      uniform sampler2D uSand;
      uniform float uTime;
      uniform vec3 uSunDir, uSunColor, uShallow, uDeep;

      void main(){
        vec3 sand = texture2D(uSand, vWorld.xz * 0.16).rgb;
        float lam = max(dot(vN, uSunDir), 0.0) * 0.75 + 0.35;
        vec3 col = sand * lam * uSunColor;

        float depth = max(0.0, -vWorld.y);
        float above = max(0.0, vWorld.y);          // sand standing out of the water

        // Caustics: two drifting interference grids, only where light still
        // reaches — and only where there is water above the sand at all.
        vec2 q = vWorld.xz * 1.15;
        float c1 = sin(q.x * 1.7 + uTime * 0.75) + sin(q.y * 1.9 - uTime * 0.62);
        float c2 = sin((q.x + q.y) * 1.25 + uTime * 0.51) + sin((q.x - q.y) * 1.45 - uTime * 0.44);
        float caus = pow(clamp((c1 + c2) * 0.25 + 0.52, 0.0, 1.0), 3.0);
        col += uSunColor * caus * 0.46 * exp(-depth * 0.9) * smoothstep(0.0, 0.09, depth);

        // Sand just out of the water is still soaked, and much darker for it.
        col *= mix(0.56, 1.0, smoothstep(0.0, 0.42, above));

        // Water column swallows the sand with depth.
        vec3 water = mix(uShallow, uDeep, clamp(depth / 3.0, 0.0, 1.0));
        float ext = 1.0 - exp(-depth * 0.58);
        col = mix(col, water * 0.55, clamp(ext, 0.0, 0.96));

        float dist = length(cameraPosition - vWorld);
        col = mix(col, uDeep, smoothstep(30.0, 85.0, dist) * step(0.02, depth));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  mesh.name = 'seabed';
  return { mesh, material: mat };
}
