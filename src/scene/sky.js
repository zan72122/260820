import * as THREE from 'three';

// The sky is computed from the view ray rather than painted on a plate.
//
// A textured quad has to be sized to the frustum, which means it re-frames
// itself every time the phone is turned, and a gradient that steep bands badly
// in 8-bit. Deriving the colour from the direction you are looking solves both,
// costs one full-screen pass of arithmetic, and lets the residual sunset sit at
// a fixed compass bearing the way a real one does.

const VERT = /* glsl */ `
varying vec3 vRay;
uniform mat4 uInvProj;
uniform mat3 uCamRot;
void main(){
  vec4 view = uInvProj * vec4(position.xy, 1.0, 1.0);
  vRay = uCamRot * (view.xyz / view.w);
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vRay;
uniform float uTime;
uniform float uStars;

float hash31(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.1, 0.71, 0.113));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec3 hash33(vec3 p){
  return vec3(hash31(p), hash31(p + 19.19), hash31(p + 47.71));
}

void main(){
  vec3 d = normalize(vRay);
  float el = clamp(d.y, -1.0, 1.0);

  // Deep summer dusk: navy overhead, and the last of the sun sitting low in one
  // direction rather than smeared evenly round the horizon.
  // Authored against a measured frame, not by eye: ACES pulls a deep blue
  // toward violet, so green is lifted a little to keep it gunjou-iro.
  vec3 zenith  = vec3(0.0105, 0.0195, 0.0570);
  vec3 mid     = vec3(0.0180, 0.0355, 0.1020);
  vec3 horizon = vec3(0.0350, 0.0570, 0.1380);

  float t = clamp(el * 2.6, 0.0, 1.0);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.45, t));
  col = mix(col, zenith, smoothstep(0.35, 1.0, t));

  // Residual sunset, low and off to one side.
  vec3 sunDir = normalize(vec3(0.80, 0.02, -0.60));
  float az = max(0.0, dot(normalize(vec3(d.x, 0.0, d.z)), vec3(sunDir.x, 0.0, sunDir.z)));
  float low = exp(-max(0.0, el) * 9.0);
  col += vec3(0.098, 0.0300, 0.0175) * pow(az, 3.0) * low;
  col += vec3(0.020, 0.0110, 0.0170) * low * 0.6;

  // Below the horizon the sky is just the dark of the ground haze; the garden
  // plates cover this, but it must not be black in case a sliver shows.
  col = mix(vec3(0.0110, 0.0135, 0.0210), col, smoothstep(-0.06, 0.02, el));

  // Stars. One cell lookup, so a few get clipped at cell borders -- at this
  // brightness nobody will ever find them.
  if (el > 0.02) {
    vec3 sd = d * 190.0;
    vec3 cell = floor(sd);
    vec3 f = fract(sd) - 0.5;
    vec3 h = hash33(cell);
    float present = step(0.982, h.x);
    vec2 off = (h.yz - 0.5) * 0.7;
    float r = length(f.xy - off) + abs(f.z) * 0.4;
    float star = present * exp(-r * r * 260.0);
    float twinkle = 0.7 + 0.3 * sin(uTime * (1.4 + h.y * 2.6) + h.z * 12.0);
    vec3 tint = mix(vec3(0.85, 0.90, 1.0), vec3(1.0, 0.92, 0.80), h.z);
    col += tint * star * twinkle * uStars * smoothstep(0.02, 0.22, el);
  }

  // Ordered-ish dither: the gradient is far too shallow to survive 8 bits.
  col += (hash31(vec3(gl_FragCoord.xy, 1.0)) - 0.5) * 0.0016;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uInvProj: { value: new THREE.Matrix4() },
        uCamRot: { value: new THREE.Matrix3() },
        uTime: { value: 0 },
        uStars: { value: 0.55 },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
  }

  update(camera, time) {
    const u = this.material.uniforms;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamRot.value.setFromMatrix4(camera.matrixWorld);
    u.uTime.value = time;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
