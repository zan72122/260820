/**
 * Shared GLSL. Every hero material is shaded procedurally in the fragment
 * shader rather than from baked textures: the camera pushes very close during
 * the crack beat, and procedural detail stays crisp at any zoom while costing
 * almost no texture memory on a phone.
 */

/** Hash + gradient noise + fbm + worley. No sin() hashing (banding on mobile GPUs). */
export const NOISE = /* glsl */ `
vec3 gh33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}
vec2 gh22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
}
float gh11(vec3 p) {
  vec3 p3 = fract(p * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float gnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dot(gh33(i + vec3(0,0,0)), f - vec3(0,0,0)),
            dot(gh33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
        mix(dot(gh33(i + vec3(0,1,0)), f - vec3(0,1,0)),
            dot(gh33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
    mix(mix(dot(gh33(i + vec3(0,0,1)), f - vec3(0,0,1)),
            dot(gh33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
        mix(dot(gh33(i + vec3(0,1,1)), f - vec3(0,1,1)),
            dot(gh33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z) * 1.1;
}

float fbm3(vec3 p, int oct) {
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * gnoise(p); n += a; p = p * 2.03 + 7.31; a *= 0.5;
  }
  return s / max(n, 1e-4);
}

/** Ridged multifractal — the sharp broken-rock look. */
float ridged3(vec3 p, int oct) {
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float v = 1.0 - abs(gnoise(p));
    v *= v;
    s += a * v; n += a; p = p * 2.11 + 3.77; a *= 0.55;
  }
  return s / max(n, 1e-4);
}

/** Worley F1/F2 on the plane — mud clumps, druzy cells, velvet tufts. */
vec2 worley2(vec2 p) {
  vec2 ip = floor(p), fp = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = gh22(ip + g) * 0.5 + 0.5;
      float d = length(g + o - fp);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return vec2(f1, f2);
}

/** Direction -> equirectangular uv. Used so masks can be painted on the geode
 *  without ever unwrapping it; the shader and the CPU painter agree exactly. */
vec2 dirToEquirect(vec3 d) {
  d = normalize(d);
  return vec2(atan(d.z, d.x) * 0.15915494 + 0.5,
              asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}
`;

/** Fragment-only: needs screen-space derivatives. */
export const BUMP = /* glsl */ `
/** Perturb a view-space normal by the screen-space gradient of a height field.
 *  One noise evaluation instead of a tangent-space normal map. */
vec3 bumpPerturb(vec3 N, vec3 P, float h, float scale) {
  vec3 dPdx = dFdx(P), dPdy = dFdy(P);
  float dHdx = dFdx(h) * scale, dHdy = dFdy(h) * scale;
  vec3 r1 = cross(dPdy, N), r2 = cross(N, dPdx);
  float det = dot(dPdx, r1);
  vec3 grad = sign(det) * (dHdx * r1 + dHdy * r2);
  return normalize(abs(det) * N - grad);
}

float fresnelTerm(vec3 N, vec3 V, float p) {
  return pow(clamp(1.0 - abs(dot(normalize(N), normalize(V))), 0.0, 1.0), p);
}
`;
