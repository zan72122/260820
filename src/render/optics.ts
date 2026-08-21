import {
  Color,
  Material,
  Texture,
  Vector3,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';

/**
 * One shared uniform block drives every surface that can see the light
 * coming through the test plate: the tunnel interior, the water film,
 * the plate itself and the raft. Keeping it in one place is what makes
 * "turn the ring outside -> the light turns inside" impossible to break.
 */
export interface OpticsUniforms {
  [name: string]: IUniform;
  uLTTime: IUniform<number>;
  uLTOrigin: IUniform<Vector3>;
  uLTAxisU: IUniform<Vector3>;
  uLTAxisV: IUniform<Vector3>;
  uLTNormal: IUniform<Vector3>;
  uLTAxisU0: IUniform<Vector3>;
  uLTAxisV0: IUniform<Vector3>;
  uLTSun: IUniform<Vector3>;
  uLTSunColor: IUniform<Color>;
  uLTKind: IUniform<number>;
  uLTTrans: IUniform<number>;
  uLTFlow: IUniform<number>;
  uLTPhase: IUniform<number>;
  uLTRipple: IUniform<number>;
  uLTAper: IUniform<number>;
  uLTGain: IUniform<number>;
  uLTCloud: IUniform<number>;
  uLTMouthO: IUniform<Vector3>;
  uLTMouthDir: IUniform<Vector3>;
  uLTMouthRight: IUniform<Vector3>;
  uLTMouthGain: IUniform<number>;
  uLTCaustic: IUniform<Texture | null>;
  uLTCausticGain: IUniform<number>;
  uLTFoam: IUniform<Texture | null>;
  uLTOpenDir: IUniform<Vector3>;
  uLTBounce: IUniform<Color>;
  uLTBounceAt: IUniform<Vector3>;
  uLTMouthA: IUniform<Vector3>;
  uLTMouthB: IUniform<Vector3>;
}

export function createOpticsUniforms(): OpticsUniforms {
  return {
    uLTTime: { value: 0 },
    uLTOrigin: { value: new Vector3() },
    uLTAxisU: { value: new Vector3(1, 0, 0) },
    uLTAxisV: { value: new Vector3(0, 0, 1) },
    uLTNormal: { value: new Vector3(0, 1, 0) },
    uLTAxisU0: { value: new Vector3(1, 0, 0) },
    uLTAxisV0: { value: new Vector3(0, 0, 1) },
    uLTSun: { value: new Vector3(0, 1, 0) },
    uLTSunColor: { value: new Color(1, 0.96, 0.9) },
    uLTKind: { value: 0 },
    uLTTrans: { value: 0 },
    uLTFlow: { value: 0 },
    uLTPhase: { value: 0 },
    uLTRipple: { value: 0 },
    uLTAper: { value: 0.42 },
    uLTGain: { value: 1 },
    uLTCloud: { value: 0 },
    uLTMouthO: { value: new Vector3() },
    uLTMouthDir: { value: new Vector3(0, 0, 1) },
    uLTMouthRight: { value: new Vector3(1, 0, 0) },
    uLTMouthGain: { value: 0.35 },
    uLTCaustic: { value: null },
    uLTCausticGain: { value: 1 },
    uLTFoam: { value: null },
    uLTOpenDir: { value: new Vector3(1, 0, 0) },
    uLTBounce: { value: new Color(0, 0, 0) },
    uLTBounceAt: { value: new Vector3() },
    uLTMouthA: { value: new Vector3() },
    uLTMouthB: { value: new Vector3() },
  };
}

export const OPTICS_UNIFORM_DECL = /* glsl */ `
uniform float uLTTime;
uniform vec3  uLTOrigin;
uniform vec3  uLTAxisU;
uniform vec3  uLTAxisV;
uniform vec3  uLTNormal;
uniform vec3  uLTAxisU0;
uniform vec3  uLTAxisV0;
uniform vec3  uLTSun;
uniform vec3  uLTSunColor;
uniform float uLTKind;
uniform float uLTTrans;
uniform float uLTFlow;
uniform float uLTPhase;
uniform float uLTRipple;
uniform float uLTAper;
uniform float uLTGain;
uniform float uLTCloud;
uniform vec3  uLTMouthO;
uniform vec3  uLTMouthDir;
uniform vec3  uLTMouthRight;
uniform float uLTMouthGain;
uniform sampler2D uLTCaustic;
uniform float uLTCausticGain;
uniform sampler2D uLTFoam;
uniform vec3 uLTOpenDir;
uniform vec3 uLTBounce;
uniform vec3 uLTBounceAt;
uniform vec3 uLTMouthA;
uniform vec3 uLTMouthB;
varying vec3 vLTW;
varying vec3 vLTN;
`;

/** pattern + projection, shared verbatim by every receiver */
export const OPTICS_GLSL = /* glsl */ `
float ltHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// rounded-rectangle aperture: the shape of the actual cut window
float ltAperMask(vec2 p, float h, float r, float soft){
  vec2 q = abs(p) - vec2(h - r);
  float d = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
  return smoothstep(0.0, -soft, d);
}

vec3 ltSpectrum(float t){
  float a = 6.2831853 * fract(t);
  return vec3(0.56 + 0.56*cos(a), 0.52 + 0.54*cos(a - 2.1), 0.60 + 0.54*cos(a - 4.1));
}

// Plate pattern in plate-local metres.
vec3 ltPattern(vec2 p, float soft, float kind, out float inten){
  float s = max(soft, 0.008);
  float i = 0.0;
  float hue = 0.0;
  if (kind < 0.5) {
    // concentric moulded rings
    float r = length(p);
    float f = fract(r * 6.2);
    i = 1.0 - smoothstep(0.05, 0.16 + s * 2.0, abs(f - 0.24));
    hue = r * 1.55 + f * 0.14;
  } else if (kind < 1.5) {
    // fine slits: long bands that ride the barrel of the flume
    float f = fract(p.y * 8.0);
    i = 1.0 - smoothstep(0.04, 0.14 + s * 2.0, abs(f - 0.22));
    hue = p.y * 1.7 + f * 0.18;
  } else if (kind < 2.5) {
    // perforated plate: a scatter of small bores
    vec2 g = p * 7.0;
    vec2 c = floor(g + 0.5);
    float jit = ltHash(c);
    vec2 d = g - c + (vec2(jit, fract(jit * 7.13)) - 0.5) * 0.42;
    float dl = length(d);
    i = 1.0 - smoothstep(0.03, 0.17 + s * 2.2, dl);
    hue = jit + dl * 0.6;
  } else {
    // nothing fitted: raw sunlight through the open port
    inten = 1.0;
    return vec3(1.0, 0.97, 0.9);
  }
  inten = max(i, 0.0);
  return ltSpectrum(hue);
}

float ltCaustic(vec3 w, float wet){
  if (wet <= 0.001 || uLTCausticGain <= 0.001) return 0.0;
  vec2 a = w.xz * 0.62 + vec2(-uLTPhase * 0.55, uLTRipple * 0.06);
  vec2 b = w.xz * 0.41 + vec2(-uLTPhase * 0.34, -uLTRipple * 0.05);
  float c = texture2D(uLTCaustic, a).r * texture2D(uLTCaustic, b).g;
  return c * wet * uLTCausticGain;
}

/**
 * wetMask: 1 on the slide bed, 0 up on the dry crown.
 * Traces the point back along the sun direction onto the plate plane,
 * so the pattern inside is literally the plate's shadow.
 */
vec3 ltTunnelLight(vec3 wpos, vec3 wnrm, float wetMask, out float hitInten){
  hitInten = 0.0;
  if (uLTTrans <= 0.002) return vec3(0.0);
  float sn = dot(uLTSun, uLTNormal);
  if (sn < 0.06) return vec3(0.0);
  float t = dot(uLTOrigin - wpos, uLTNormal) / sn;
  if (t <= 0.0) return vec3(0.0);
  vec3 hit = wpos + uLTSun * t;
  vec3 d = hit - uLTOrigin;

  // resin scatters: the beam leaving the plate is not parallel, so the
  // footprint opens out with throw distance instead of staying plate-sized
  float mag = 1.0 + t * 0.6;
  // more water, longer streak: the footprint itself draws out downstream
  vec2 ap = vec2(dot(d, uLTAxisU0), dot(d, uLTAxisV0)) / mag;
  ap.x /= (1.0 + uLTFlow * 0.6);
  float aperture = ltAperMask(ap, uLTAper, 0.07, 0.04 + t * 0.05);
  if (aperture <= 0.002) return vec3(0.0);

  vec2 uv = vec2(dot(d, uLTAxisU), dot(d, uLTAxisV)) / mag;

  // the water film shoves the beam around before it lands
  float w = wetMask * uLTFlow;
  float rip = uLTRipple;
  float n1 = sin(uv.x * 5.4 - rip * 2.6 + sin(uv.y * 4.1) * 1.3);
  float n2 = sin(uv.x * 3.1 - rip * 1.7 + cos(uv.y * 6.2) * 1.1);
  uv += w * vec2(n1 * 0.055 + n2 * 0.028, n2 * 0.05);

  // and the current carries it away down the flume
  uv.x -= uLTPhase * (0.4 + 0.6 * wetMask);
  uv.x /= (1.0 + 0.32 * uLTFlow);

  float soft = 0.012 + t * 0.016 + uLTCloud * 0.16;
  float inten;
  vec3 col = ltPattern(uv, soft, uLTKind, inten);

  float ndl = smoothstep(-0.05, 0.5, dot(wnrm, uLTSun));
  float atten = 1.0 / (1.0 + t * t * 0.055);
  float caus = ltCaustic(wpos, wetMask * uLTFlow);
  inten *= aperture * ndl * atten * uLTTrans * clamp(sn, 0.0, 1.0);
  inten *= 1.0 + caus * 1.6;
  hitInten = inten;
  return col * uLTSunColor * (inten * uLTGain);
}

/**
 * How much sky a point inside the barrel can actually see. The environment
 * map has no idea it is inside a tube, so without this the interior lights
 * up like an open field and the projected pattern disappears.
 */
float ltBarrelOcclusion(vec3 wpos, vec3 wnrm){
  float facing = smoothstep(-0.25, 0.92, dot(wnrm, uLTOpenDir));
  float mouth = max(
    exp(-distance(wpos, uLTMouthA) * 0.5),
    exp(-distance(wpos, uLTMouthB) * 0.5)
  );
  return clamp(0.075 + facing * 0.5 + mouth * 0.75, 0.0, 1.25);
}

/** light that has already landed, spilling on to everything near it */
vec3 ltBounce(vec3 wpos){
  float d = distance(wpos, uLTBounceAt);
  return uLTBounce * exp(-d * 0.42) * uLTTrans;
}

/** the single soft streak that lies on the bed before anything is fitted */
float ltMouthStreak(vec3 wpos, vec3 wnrm){
  vec3 d = wpos - uLTMouthO;
  float along = dot(d, uLTMouthDir);
  float lat = abs(dot(d, uLTMouthRight));
  float up = smoothstep(0.02, 0.62, wnrm.y);
  float fall = exp(-max(along, 0.0) * 0.24) * smoothstep(-1.4, 0.6, along);
  float band = smoothstep(0.72, 0.06, lat);
  return up * fall * band;
}
`;

const VERT_DECL = /* glsl */ `
varying vec3 vLTW;
varying vec3 vLTN;
`;

export type OpticsReceiver = 'interior' | 'water' | 'plate' | 'body';

export interface OpticsInjectOptions {
  receiver: OpticsReceiver;
  /** static wetness override; interior derives it from the normal when omitted */
  wetExpr?: string;
  gain?: number;
  mouth?: boolean;
}

/** Adds the tunnel-light term to any three.js standard/physical material. */
export function injectOptics(
  material: Material,
  uniforms: OpticsUniforms,
  options: OpticsInjectOptions,
): void {
  const gain = options.gain ?? 1;
  const wetExpr =
    options.wetExpr ??
    (options.receiver === 'water' ? '1.0' : 'smoothstep(0.02, 0.72, normalize(vLTN).y)');
  const mouth = options.mouth ?? options.receiver === 'interior';

  let apply = '';
  if (options.receiver === 'water') {
    apply = /* glsl */ `
      float ltOcc = ltBarrelOcclusion(vLTW, normalize(vLTN));
      reflectedLight.indirectDiffuse *= ltOcc;
      reflectedLight.indirectSpecular *= ltOcc;
      reflectedLight.directDiffuse *= 0.12;
      reflectedLight.directSpecular *= 0.12;
      reflectedLight.indirectDiffuse += ltl * ${gain.toFixed(3)} * 0.55 + ltBounce(vLTW) * 0.5;
      reflectedLight.indirectSpecular += ltl * ${gain.toFixed(3)} * 1.35;
    `;
  } else if (options.receiver === 'plate') {
    apply = /* glsl */ `
      reflectedLight.indirectDiffuse += ltl * ${gain.toFixed(3)};
    `;
  } else {
    // inside the barrel: kill the open-field lighting first, then add the
    // only light that has any business being in here
    apply = /* glsl */ `
      float ltOcc = ltBarrelOcclusion(vLTW, normalize(vLTN));
      reflectedLight.indirectDiffuse *= ltOcc;
      reflectedLight.indirectSpecular *= ltOcc;
      reflectedLight.directDiffuse *= 0.05;
      reflectedLight.directSpecular *= 0.05;
      reflectedLight.indirectDiffuse += ltl * ${gain.toFixed(3)} * (diffuseColor.rgb * 0.8 + 0.2);
      reflectedLight.indirectSpecular += ltl * ${gain.toFixed(3)} * ltWet * 0.55;
      reflectedLight.indirectDiffuse += ltBounce(vLTW) * (diffuseColor.rgb * 0.9 + 0.1);
    `;
  }

  const mouthApply = mouth
    ? /* glsl */ `
      float ltStreak = ltMouthStreak(vLTW, normalize(vLTN)) * uLTMouthGain;
      reflectedLight.indirectDiffuse += vec3(0.68, 0.76, 0.94) * ltStreak * (diffuseColor.rgb * 0.4 + 0.6);
      reflectedLight.indirectSpecular += vec3(0.7, 0.78, 0.95) * ltStreak * ltWet * 0.5;
    `
    : '';

  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    if (prev) prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace(
        '#include <defaultnormal_vertex>',
        `#include <defaultnormal_vertex>\n  vLTN = normalize(mat3(modelMatrix) * objectNormal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n  vLTW = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${OPTICS_UNIFORM_DECL}\n${OPTICS_GLSL}`)
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          float ltWet = ${wetExpr};
          float ltInten;
          vec3 ltl = ltTunnelLight(vLTW, normalize(vLTN), ltWet, ltInten);
          ${apply}
          ${mouthApply}
        }`,
      );
  };
  material.customProgramCacheKey = () => `lt-${options.receiver}-${gain}-${wetExpr}-${mouth}`;
  material.needsUpdate = true;
}
