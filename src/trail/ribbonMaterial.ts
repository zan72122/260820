import {
  AdditiveBlending,
  CustomBlending,
  DoubleSide,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Texture,
  Vector3,
} from 'three';

const vertex = /* glsl */ `
attribute float aSide;
attribute float aBirth;
attribute float aDrop;
attribute float aDensity;
attribute float aDrift;

uniform float uTime;
uniform vec3  uWind;

varying float vSide;
varying float vAge;
varying float vDrop;
varying float vDensity;
varying vec3  vWorld;

void main() {
  float age = max(0.0, uTime - aBirth);
  vec3 p = position;

  // The wake keeps being carried by the same breeze that brought the mist here,
  // so an arc drifts a little after it is laid down instead of hanging rigid.
  p += uWind * (aDrift * age);

  // A wake in fine mist lifts on the air the seat drags with it, then the
  // droplets lose that and settle back down.
  float lift = aDrift * 0.46 * (1.0 - exp(-age * 0.28));
  p.y += lift - 0.0016 * aDrift * age * age;

  vSide = aSide;
  vAge = age;
  vDrop = aDrop;
  vDensity = aDensity;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = /* glsl */ `
precision highp float;

uniform sampler2D uSpectrum;
uniform vec3  uSunDir;      // unit vector from the scene toward the sun
uniform float uLifetime;
uniform float uIntensity;
uniform float uSunStrength;
uniform float uTime;

varying float vSide;
varying float vAge;
varying float vDrop;
varying float vDensity;
varying vec3  vWorld;

// Cheap value noise for droplet-scale grain (a wake is not a vector line).
float hash13(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.71, 0.37));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z);
}

void main() {
  float life = 1.0 - clamp(vAge / uLifetime, 0.0, 1.0);
  if (life <= 0.0 || vDensity <= 0.001) discard;

  vec3 viewDir = normalize(vWorld - cameraPosition);

  // Scattering angle between the incoming sunlight and the ray reaching the eye.
  // 0 = looking straight into the sun through the mist (corona / iridescence),
  // ~2.4 rad = the antisolar side where a real bow lives.
  float mu = clamp(dot(uSunDir, viewDir), -1.0, 1.0);
  float scatter = acos(mu);

  // Droplet size sets how far light is bent: small drops disperse more.
  float dsize = mix(0.86, 1.22, vDrop);

  // Turbulent mixing inside the wake, and the size gradient across its width.
  float turb = vnoise(vWorld * 1.6 + vec3(0.0, 0.0, vAge * 0.18)) - 0.5;
  // Across the thread the droplet population grades, so the spectral order runs
  // cleanly from one edge to the other the way a bow does.
  float dev = scatter / dsize + vSide * 0.95 + turb * 0.07;

  // Ping-pong through the spectrum: no seam where red would jump back to violet.
  float u = fract(dev * 0.46 + 0.11);
  u = 1.0 - abs(1.0 - 2.0 * u);

  vec4 spec = texture2D(uSpectrum, vec2(clamp(u, 0.01, 0.99), 0.5));

  // Saturation follows the two geometries where dispersion genuinely concentrates.
  float bow = exp(-pow((scatter - 2.40) / 0.78, 2.0));
  float corona = exp(-pow((scatter - 0.34) / 0.68, 2.0));
  float sat = 0.70 + 0.30 * max(bow, corona);

  // Unsaturated remainder is plain scattered sunset light, not white.
  vec3 haze = vec3(1.0, 0.86, 0.72);
  vec3 col = mix(haze, spec.rgb, sat);

  // Fade-in as the droplets are actually displaced, then a long slow decay.
  float bloom = smoothstep(0.0, 0.22, vAge);
  float decay = pow(life, 1.6);

  // Gaussian across the thread: no outline anywhere, just droplet density
  // thinning away from the line the seat edge actually cut.
  float edge = exp(-vSide * vSide * 2.1);
  float grain = 0.86 + 0.24 * vnoise(vWorld * 2.4 + vec3(vAge * 0.25));

  float a = vDensity * edge * bloom * decay * grain * uIntensity * spec.a * uSunStrength;
  a = clamp(a, 0.0, 1.0);
  if (a < 0.004) discard;

  // Premultiplied output. Alpha is deliberately below the colour weight so that
  // overlapping arcs add light like scattering does, instead of stacking into mud.
  gl_FragColor = vec4(col * a, a * 0.74);
}
`;

export interface RibbonUniforms {
  uTime: { value: number };
  uSunDir: { value: Vector3 };
  uWind: { value: Vector3 };
  uSpectrum: { value: Texture | null };
  uLifetime: { value: number };
  uIntensity: { value: number };
  uSunStrength: { value: number };
}

export function createRibbonMaterial(spectrum: Texture, lifetime: number): ShaderMaterial {
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new Vector3(0, 0.12, 1).normalize() },
      uWind: { value: new Vector3(0, 0, -0.08) },
      uSpectrum: { value: spectrum },
      uLifetime: { value: lifetime },
      uIntensity: { value: 1.32 },
      uSunStrength: { value: 1 },
    } satisfies RibbonUniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    toneMapped: true,
  });
  // Keep the constant referenced so tree-shaking of three's blending enums is safe.
  void AdditiveBlending;
  return mat;
}
