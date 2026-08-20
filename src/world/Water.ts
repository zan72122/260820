import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  ShaderMaterial,
  Texture,
  UniformsLib,
  UniformsUtils,
  Vector3,
  Vector4,
} from 'three'
import { FLUME, THETA_MAX, WATER_HALF_WIDTH } from '../config'


const MAX_RIPPLES = 8

const vert = /* glsl */ `
  varying vec3 vWorld;
  varying float vAcross;
  #include <fog_pars_vertex>
  void main() {
    vAcross = uv.y;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    #include <fog_vertex>
    gl_Position = projectionMatrix * mvPosition;
  }
`

const frag = /* glsl */ `
  precision highp float;

  varying vec3 vWorld;
  varying float vAcross;

  uniform float uTime;
  uniform float uFlow;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uBedLight;
  uniform vec3 uTint;
  uniform float uNodeSpacing;
  uniform float uNodePhase;
  uniform float uRInner;
  uniform float uThetaMax;
  uniform float uDepth;
  uniform float uUvPeriod;
  uniform sampler2D uBedMap;
  uniform vec4 uRipples[${MAX_RIPPLES}];
  uniform float uDappleAmount;
  uniform vec4 uDbg;   // x spec, y foam, z caustics, w reflection

  #include <fog_pars_fragment>

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
               mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  // --- surface height field -------------------------------------------------
  // Returns (dH/dx, dH/dz) directly: we only ever need the slope.
  vec2 surfaceSlope(vec2 p, float t) {
    vec2 g = vec2(0.0);
    // long ripples running with the flow
    {
      float k = 33.0, ax = 3.0, a = 0.00260;
      float c = cos(k * p.y + ax * p.x - k * uFlow * t) * a;
      g += vec2(ax * c, k * c);
    }
    {
      float k = 62.0, ax = -14.0, a = 0.00190;
      float c = cos(k * p.y + ax * p.x - k * uFlow * t) * a;
      g += vec2(ax * c, k * c);
    }
    {
      float k = 140.0, ax = 7.0, a = 0.00105;
      float c = cos(k * p.y + ax * p.x - k * uFlow * t) * a;
      g += vec2(ax * c, k * c);
    }
    // micro chop
    {
      float k = 255.0, ax = 34.0, a = 0.00052;
      float ph = k * p.y + ax * p.x - k * uFlow * 1.06 * t;
      float c = cos(ph) * a;
      g += vec2(ax * c, k * c);
    }
    // cross-trough slosh
    {
      float k = 9.0, ax = 190.0, a = 0.00040;
      float ph = k * p.y + ax * p.x - 27.0 * t;
      float c = cos(ph) * a;
      g += vec2(ax * c, k * c);
    }
    // the drag layer against each wall
    {
      float w = smoothstep(0.55, 1.0, abs(p.x - uNodePhase * 0.0) / ${WATER_HALF_WIDTH.toFixed(5)});
      float k = 320.0;
      float c = cos(k * p.y - k * uFlow * 0.72 * t + p.x * 60.0) * 0.00042 * w;
      g += vec2(60.0 * c, k * c);
    }
    // standing wave train shed by each culm node
    float nAbs = (p.y - uNodePhase) / uNodeSpacing;
    float nz = uNodePhase + floor(nAbs) * uNodeSpacing;
    float d = p.y - nz;
    float env = exp(-d * 7.5) * smoothstep(0.0, 0.012, d);
    float ph = d * 165.0 - t * 96.0;
    g.y += cos(ph) * 165.0 * 0.00026 * env;
    g.x += sin(p.x * 120.0 + t * 3.0) * 0.00016 * env * 60.0;

    // impacts: somen entering, droplets landing, chopsticks breaking the surface
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      if (r.w <= 0.0) continue;
      float age = t - r.z;
      if (age < 0.0 || age > 1.5) continue;
      vec2 dv = p - r.xy;
      float dist = length(dv) + 1e-5;
      float front = age * 0.55;
      float fall = exp(-dist * 11.0) * exp(-age * 2.4) * smoothstep(front + 0.02, front - 0.06, dist);
      float k2 = 150.0;
      float c = cos(dist * k2 - age * 44.0) * r.w * 0.0016 * fall * k2;
      g += (dv / dist) * c;
    }
    return g;
  }

  uniform vec3 uSurround;

  // What the water actually sees. At the grazing angles you get looking down a
  // flume, almost everything reflected is garden, not sky — so the horizon
  // band is green, and only steeper reflections reach the blue.
  // A cheap, irregular caustic web. On shallow flowing water this is the
  // single most recognisable cue that there is water there at all.
  float caustic(vec2 p, float t) {
    vec2 q = vec2(p.x * 74.0, p.y * 34.0);
    mat2 R = mat2(0.80, -0.60, 0.60, 0.80);
    float v = 0.0;
    for (int i = 0; i < 3; i++) {
      q = R * q * 1.63 + vec2(2.1, -1.3);
      v += sin(q.x + t * (1.7 + float(i) * 0.9)) * sin(q.y * 1.14 - t * 1.5);
    }
    return pow(clamp(v * 0.30 + 0.46, 0.0, 1.0), 5.0);
  }

  vec3 skyColor(vec3 d) {
    float t = clamp(d.y, 0.0, 1.0);
    vec3 c = mix(uHorizon, uZenith, pow(t, 0.42));
    c = mix(uSurround, c, smoothstep(-0.05, 0.55, d.y));
    float sd = max(dot(d, uSunDir), 0.0);
    c += uSunColor * pow(sd, 7.0) * 0.26;
    c += uSunColor * pow(sd, 2.0) * 0.07 * (1.0 - t);
    return c;
  }

  // Cheap moving leaf-shade used only to keep the glitter from sparkling
  // inside the tree shadows.
  float dapple(vec3 p) {
    vec2 q = p.xz * 1.9 + vec2(p.y * 0.4);
    q += vec2(sin(uTime * 0.23 + q.y * 0.6), cos(uTime * 0.19 + q.x * 0.5)) * 0.35;
    float a = sin(q.x * 1.7) * sin(q.y * 1.3 + 1.1);
    float b = sin(q.x * 0.7 - 2.0) * sin(q.y * 0.9 + 0.4);
    float m = smoothstep(-0.35, 0.45, a * 0.6 + b * 0.5);
    return mix(1.0, m, uDappleAmount);
  }

  void main() {
    float t = uTime;
    vec2 g = surfaceSlope(vec2(vWorld.x, vWorld.z), t);
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 V = normalize(cameraPosition - vWorld);
    float ndv = max(dot(N, V), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

    // --- what shows through: the wet culm floor, refracted ------------------
    vec3 R = refract(-V, N, 1.0 / 1.333);
    float travel = uDepth / max(-R.y, 0.12);
    vec3 hit = vWorld + R * travel;
    float sinTh = clamp((hit.x - (vWorld.x - vAcross * ${WATER_HALF_WIDTH.toFixed(5)})) / uRInner, -1.0, 1.0);
    float th = asin(sinTh);
    vec2 bedUv = vec2((hit.z - uNodePhase) / uUvPeriod, (th + uThetaMax) / (2.0 * uThetaMax));
    vec3 bed = texture2D(uBedMap, bedUv).rgb;

    // caustics, advected with the stream
    float caus = caustic(vec2(hit.x, hit.z + t * uFlow * 0.55), t);
    caus += caustic(vec2(hit.x * 1.9 + 3.1, (hit.z + t * uFlow * 0.42) * 1.9), t * 1.31) * 0.7;
    vec3 through = bed * uBedLight * uTint * (0.86 + caus * 0.60 * uDbg.z);

    // --- sky and sun on the surface ----------------------------------------
    vec3 refl = skyColor(reflect(-V, N));
    vec3 H = normalize(V + uSunDir);
    float shade = dapple(vWorld);
    float spec = pow(max(dot(N, H), 0.0), 300.0) * 1.30 + pow(max(dot(N, H), 0.0), 60.0) * 0.10;

    // --- aeration streaks: the clearest sign that the water is moving ------
    float adv = vWorld.z + t * uFlow;
    // Streaks, not speckles: low frequency along the flow, high across it.
    float st = vnoise(vec2(vAcross * 9.0, adv * 2.6)) * 0.62
             + vnoise(vec2(vAcross * 21.0, adv * 6.8)) * 0.38;
    float wall = smoothstep(0.45, 1.0, abs(vAcross));
    float nAbs = (vWorld.z - uNodePhase) / uNodeSpacing;
    float d = vWorld.z - (uNodePhase + floor(nAbs) * uNodeSpacing);
    float nodeFoam = exp(-d * 26.0) * smoothstep(0.0, 0.010, d) * 0.42;
    float foam = clamp(
      smoothstep(0.74, 0.98, st) * (0.10 + wall * 0.34) + nodeFoam * (0.25 + 0.45 * st),
      0.0, 1.0);
    // slight lightening where the flow is aerated, even short of real foam
    float milk = smoothstep(0.45, 0.92, st) * 0.09;

    vec3 col = mix(through, refl, F * 0.86 * uDbg.w);
    col += uSunColor * spec * shade * uDbg.x;
    col = mix(col, vec3(0.72, 0.79, 0.77) * (0.35 + 0.65 * shade), foam * 0.55 * uDbg.y);

    // meniscus: surface tension pulls the water up the wall and catches a
    // thin bright line along the contact.
    float edge = smoothstep(0.90, 1.0, abs(vAcross));
    float lip = smoothstep(0.955, 0.995, abs(vAcross)) * (1.0 - smoothstep(0.995, 1.0, abs(vAcross)));
    col += vec3(0.55, 0.60, 0.58) * lip * 0.5 * shade;
    float alpha = clamp(0.62 + F * 0.34 + foam * 0.28 + milk + edge * 0.3, 0.0, 0.97);
    col = mix(col, through * 0.78, edge * 0.6);

    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

export class Water {
  readonly mesh: Mesh
  readonly material: ShaderMaterial
  private ripples: Vector4[] = []
  private rippleCursor = 0

  constructor(bedMap: Texture) {
    for (let i = 0; i < MAX_RIPPLES; i++) this.ripples.push(new Vector4(0, 0, -99, 0))

    const geo = buildWaterGeometry()
    this.material = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: true,
      side: DoubleSide,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uFlow: { value: 0.95 },
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunColor: { value: new Color(1.0, 0.94, 0.8) },
          uZenith: { value: new Color(0.095, 0.225, 0.62) },
          uHorizon: { value: new Color(0.545, 0.625, 0.685) },
          uSurround: { value: new Color(0.085, 0.105, 0.055) },
          uBedLight: { value: new Color(1.5, 1.45, 1.3) },  // replaced at runtime
          uTint: { value: new Color(0.62, 0.86, 0.83) },
          uNodeSpacing: { value: FLUME.nodeSpacing },
          uNodePhase: { value: FLUME.nodePhase },
          uRInner: { value: FLUME.rInner },
          uThetaMax: { value: THETA_MAX },
          uDepth: { value: FLUME.waterDepth },
          uUvPeriod: { value: FLUME.nodeSpacing * 2 },
          uBedMap: { value: null },
          uRipples: { value: this.ripples },
          uDappleAmount: { value: 0.55 },
          uDbg: { value: new Vector4(1, 1, 1, 1) },
        },
      ]),
    })
    this.material.uniforms.uBedMap.value = bedMap
    // UniformsUtils.merge() deep-clones values, so re-bind the live array.
    this.material.uniforms.uRipples.value = this.ripples
    this.mesh = new Mesh(geo, this.material)
    this.mesh.renderOrder = 4
    this.mesh.name = 'water'
    this.mesh.frustumCulled = false
  }

  /** Register a surface disturbance at (x, z). */
  addRipple(x: number, z: number, strength: number, time: number): void {
    const r = this.ripples[this.rippleCursor]
    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES
    r.set(x, z, time, strength)
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time
  }

  get flowSpeed(): number {
    return this.material.uniforms.uFlow.value as number
  }
}

function buildWaterGeometry(): BufferGeometry {
  const COLS = 11
  const zs: number[] = []
  for (let z = FLUME.zStart + 0.06; z < -4.6; z += 0.06) zs.push(z)
  for (let z = -4.6; z <= FLUME.zEnd - 0.05; z += 0.028) zs.push(z)

  const rows = zs.length
  const pos = new Float32Array(rows * COLS * 3)
  const uv = new Float32Array(rows * COLS * 2)
  const idx: number[] = []
  let p = 0
  let q = 0
  for (let i = 0; i < rows; i++) {
    const z = zs[i]
    const cx = FLUME.xAt(z)
    // Deliberately smooth: the node's effect on the surface is a wave train in
    // the shader, not a faceted ridge in the mesh.
    const ri = FLUME.rInner
    const half = Math.sqrt(Math.max(1e-6, ri * ri - (ri - FLUME.waterDepth) ** 2))
    const y = FLUME.yAt(z) + FLUME.waterDepth
    for (let c = 0; c < COLS; c++) {
      const a = (c / (COLS - 1)) * 2 - 1
      // Sink the outermost ring slightly into the wall so no seam shows.
      const w = half * (Math.abs(a) > 0.999 ? 1.03 : 1.0)
      pos[p++] = cx + a * w
      pos[p++] = y - Math.abs(a) ** 6 * 0.0015
      pos[p++] = z
      uv[q++] = 0
      uv[q++] = a
    }
    if (i > 0) {
      const base = (i - 1) * COLS
      for (let c = 0; c < COLS - 1; c++) {
        const A = base + c
        const B = base + c + 1
        const C = base + COLS + c
        const D = base + COLS + c + 1
        idx.push(A, C, B, B, C, D)
      }
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  return geo
}

export { WATER_HALF_WIDTH }
