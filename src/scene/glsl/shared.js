/**
 * GLSL fragments shared between materials.
 *
 * `TEAR_GLSL` and `SAG_GLSL` are line-for-line mirrors of `src/game/paper.js`.
 * The CPU copy decides whether a fish is caught; the GPU copy decides what the
 * child sees. If the two ever disagree, a fish falls through paper that looks
 * solid, and the causal chain the whole game rests on breaks.
 */

export const MAX_RIPPLES = 8;
export const MAX_TEARS_GLSL = 6;

/** Expanding ring waves in world XZ. Uniform: vec4(x, z, startTime, strength). */
export const RIPPLE_GLSL = /* glsl */ `
#define RIPPLE_LIFE 3.1
#define RIPPLE_SPEED 1.05
#define RIPPLE_K 34.0

uniform vec4 uRipples[RIPPLE_COUNT];
uniform float uTime;
uniform float uSwell;

float rippleAt(vec2 p, vec4 r, float t) {
  float age = t - r.z;
  if (age < 0.0 || age > RIPPLE_LIFE || r.w == 0.0) return 0.0;
  float d = distance(p, r.xy);
  float band = d - age * RIPPLE_SPEED;
  if (band > 0.0) return 0.0;
  float trail = exp(band * 3.1);
  float fade = exp(-age * 1.15);
  float spread = 1.0 / (1.0 + d * 3.4);
  return r.w * sin(band * RIPPLE_K) * trail * fade * spread;
}

// Slow breathing of the whole surface plus a fine chop, so the water is never
// dead flat even when nobody is touching it.
float swellAt(vec2 p, float t) {
  float h = 0.0;
  h += sin(p.x * 3.1 + t * 0.75) * 0.0062;
  h += sin(p.y * 2.55 - t * 0.61) * 0.0055;
  h += sin((p.x + p.y) * 7.3 + t * 1.6) * 0.0024;
  h += sin((p.x - p.y * 1.4) * 12.1 - t * 2.1) * 0.0013;
  h += sin((p.x * 1.7 + p.y * 2.2) * 19.0 + t * 2.8) * 0.0006;
  return h * uSwell;
}

float waterHeight(vec2 p, float t) {
  float h = swellAt(p, t);
  for (int i = 0; i < RIPPLE_COUNT; i++) {
    h += rippleAt(p, uRipples[i], t);
  }
  return h;
}

vec3 waterNormalAt(vec2 p, float t, float eps) {
  float h0 = waterHeight(p, t);
  float hx = waterHeight(p + vec2(eps, 0.0), t);
  float hz = waterHeight(p + vec2(0.0, eps), t);
  return normalize(vec3(-(hx - h0) / eps, 1.0, -(hz - h0) / eps));
}
`;

/** Ragged holes in the paper. Uniform: vec4(x, y, radius, wobbleSeed). */
export const TEAR_GLSL = /* glsl */ `
uniform vec4 uTears[TEAR_COUNT];

float tearWobble(float a, float s) {
  return 1.0
    + 0.30 * sin(a * 5.0 + s * 6.2831853)
    + 0.17 * sin(a * 9.0 - s * 11.0)
    + 0.08 * sin(a * 17.0 + s * 3.7);
}

// > 0 means the paper is gone at this point. Matches holeDepth() in paper.js.
float holeDepth(vec2 p) {
  float best = -1000.0;
  for (int i = 0; i < TEAR_COUNT; i++) {
    vec4 t = uTears[i];
    if (t.z <= 0.0) continue;
    vec2 d = p - t.xy;
    float len = length(d);
    float edge = t.z * tearWobble(atan(d.y, d.x), t.w);
    best = max(best, edge - len);
  }
  return best;
}
`;

/** Vertical droop of the sheet. Matches sagProfile() in paper.js. */
export const SAG_GLSL = /* glsl */ `
float sagProfile(float r, float sag, float load, float loadR) {
  float base = -sag * (1.0 - r * r) * (0.55 + 0.45 * (1.0 - r));
  float d = (r - loadR) / 0.5;
  return base - load * 0.85 * exp(-d * d);
}
`;

/**
 * Tone mapping is off globally so that the refraction copy of the frame and
 * the frame itself stay in the same numeric space. Hero shaders instead apply
 * this small filmic knee to keep lantern highlights from clipping flat.
 */
export const FILMIC_GLSL = /* glsl */ `
vec3 filmicKnee(vec3 c) {
  return c / (1.0 + max(vec3(0.0), c - 0.72) * 0.85);
}
`;

/** Cheap hash / value noise available to every custom material. */
export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm2(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}
`;

/**
 * Caustics: two counter-rotating Voronoi-ish cell patterns, the standard cheap
 * trick, modulated by the same ripples that move the surface.
 */
export const CAUSTIC_GLSL = /* glsl */ `
float causticCell(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash12(i + g), hash12(i + g + 17.3));
      o = 0.5 + 0.42 * sin(t * 0.9 + 6.2831 * o);
      d = min(d, length(g + o - f));
    }
  }
  return d;
}

float caustics(vec2 p, float t) {
  float a = causticCell(p * 3.1 + vec2(t * 0.06, -t * 0.04), t);
  float b = causticCell(p * 4.4 - vec2(t * 0.05, t * 0.07), t * 1.3);
  float c = pow(1.0 - min(a, b), 3.2);
  return clamp(c, 0.0, 1.0);
}
`;
