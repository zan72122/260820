/** Shared GLSL fragments. Kept small: the budget belongs to the hero materials. */

export const NOISE_GLSL = /* glsl */ `
uniform sampler2D uNoise;
/** drop-in replacement for a 4-octave fbm, one texture fetch instead of 16 */
float fbm(vec2 p){
  vec4 n = texture2D(uNoise, p * 0.25);
  return n.r*0.52 + n.g*0.26 + n.b*0.14 + n.a*0.08;
}
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
`

/**
 * Turbid-water attenuation. Everything under the surface fades into the same
 * brown murk; only where the hose has just cleaned the water does it clear up.
 * This is what keeps "you see exactly where you sprayed" true.
 */
export const MURK_GLSL = /* glsl */ `
uniform vec3 uMurkColor;
uniform float uWaterY;
float murkAmount(vec3 wpos, float clean, float extra){
  float depth = max(0.0, uWaterY - wpos.y);
  float k = mix(3.3, 0.34, clamp(clean, 0.0, 1.0));
  float m = 1.0 - exp(-k * depth);
  return clamp(m + extra, 0.0, 1.0);
}
`
