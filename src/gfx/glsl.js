// Small shared GLSL chunks. Kept deliberately cheap: this runs on phone GPUs.

// 3D value noise + fbm. Cheaper than simplex and plenty for molten slag / smoke.
export const NOISE3 = /* glsl */ `
float hash31(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.1, 0.71, 0.113));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i + vec3(0.0,0.0,0.0)), hash31(i + vec3(1.0,0.0,0.0)), f.x),
        mix(hash31(i + vec3(0.0,1.0,0.0)), hash31(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.0,0.0,1.0)), hash31(i + vec3(1.0,0.0,1.0)), f.x),
        mix(hash31(i + vec3(0.0,1.0,1.0)), hash31(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}
float fbm3(vec3 p, int oct){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`;

// Blackbody-ish ramp for anything incandescent. t = 0 (dying red) .. 1 (white hot).
// Not a physical Planck curve: it is tuned so a sparkler reads correctly after
// ACES tonemapping, which desaturates the top end hard.
export const EMBER_RAMP = /* glsl */ `
vec3 emberRamp(float t){
  t = clamp(t, 0.0, 1.0);
  vec3 dying  = vec3(0.62, 0.055, 0.010);
  vec3 red    = vec3(1.00, 0.170, 0.020);
  vec3 orange = vec3(1.00, 0.460, 0.080);
  vec3 amber  = vec3(1.00, 0.720, 0.250);
  vec3 white  = vec3(1.00, 0.960, 0.820);
  vec3 c = mix(dying, red, smoothstep(0.00, 0.22, t));
  c = mix(c, orange, smoothstep(0.18, 0.46, t));
  c = mix(c, amber,  smoothstep(0.44, 0.74, t));
  c = mix(c, white,  smoothstep(0.72, 1.00, t));
  return c;
}
`;

// One warm local light (the fireball) plus a hemisphere term for the summer dusk
// and a dim warm key from the house. Every hero surface shares this block so the
// whole frame agrees about where light is coming from.
export const SCENE_LIGHT = /* glsl */ `
uniform vec3 uEmberPos;
uniform vec3 uEmberColor;
uniform float uEmberPower;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;

vec3 hemisphere(vec3 n){
  float k = n.y * 0.5 + 0.5;
  return mix(uGroundColor, uSkyColor, k);
}

// Wrapped diffuse: skin and paper both bend light around the terminator.
float wrapDiffuse(vec3 n, vec3 l, float w){
  return clamp((dot(n, l) + w) / (1.0 + w), 0.0, 1.0);
}

// Inverse square, with a soft core the size of the bead's own glow so that a
// surface sitting a millimetre from it does not turn into a white hole. The
// constant is calibrated so a fingertip about 12cm above the bead reads at
// roughly 0.9 x albedo at the brightest stage, and almost nothing at the first.
float emberFalloff(float d){
  return uEmberPower * 0.075 / (d * d + 0.0011);
}
`;

export const SHADER_LIGHT_UNIFORMS = () => ({
  uEmberPos: { value: null },
  uEmberColor: { value: null },
  uEmberPower: { value: 0 },
  uSkyColor: { value: null },
  uGroundColor: { value: null },
  uKeyDir: { value: null },
  uKeyColor: { value: null },
});
