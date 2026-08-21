import {
  BackSide,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Settings } from '../core/settings';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform float uTime;

// Dither to keep a wide dusk gradient free of banding on 8-bit phone panels.
float dither(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.25, 1.0);

  // Dusk gradient: deep blue overhead falling to a warm, dusty horizon.
  vec3 zenith  = vec3(0.150, 0.225, 0.375);
  vec3 mid     = vec3(0.430, 0.455, 0.520);
  vec3 horizon = vec3(0.905, 0.735, 0.560);

  vec3 col = mix(mid, zenith, smoothstep(0.05, 0.78, h));
  col = mix(horizon, col, smoothstep(-0.03, 0.26, h));

  float toSun = max(0.0, dot(d, uSunDir));
  float anti  = max(0.0, dot(d, -uSunDir));

  // The sun's own quarter of the sky: a tight core inside a wide warm wrap.
  col += vec3(0.85, 0.44, 0.16) * pow(toSun, 7.0) * 1.7;
  col += vec3(0.46, 0.26, 0.10) * pow(toSun, 1.7) * 0.85;

  // Opposite the sun, the real thing shows a pink belt sitting on the blue-grey
  // shadow of the Earth. Both are what the anti-solar sky actually looks like.
  float belt = exp(-pow((h - 0.075) / 0.075, 2.0)) * pow(anti, 1.2);
  col += vec3(0.42, 0.18, 0.20) * belt * 0.95;
  float shadow = smoothstep(0.045, -0.05, h) * pow(anti, 1.0);
  col = mix(col, vec3(0.300, 0.330, 0.430), shadow * 0.62);

  // Thin high cloud, catching the light from the sun side.
  float band = sin(d.y * 22.0 + uTime * 0.010 + d.x * 2.6) * 0.5 + 0.5;
  col += vec3(0.085, 0.058, 0.038) * band * smoothstep(0.03, 0.34, h) * (0.35 + 0.85 * pow(toSun, 1.4));

  col += (dither(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  readonly mesh: Mesh;
  readonly sun: DirectionalLight;
  readonly fill: HemisphereLight;
  /** Bounce off the wet ground and the mist, from the anti-solar side. */
  readonly bounce: DirectionalLight;
  private mat: ShaderMaterial;

  constructor(scene: Scene, settings: Settings) {
    this.mat = new ShaderMaterial({
      uniforms: {
        uSunDir: { value: new Vector3(-0.96, 0.15, 0.24).normalize() },
        uTime: { value: 0 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: true,
    });
    this.mesh = new Mesh(new SphereGeometry(1, 32, 20), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    this.sun = new DirectionalLight(new Color(1.0, 0.74, 0.48), 5.2);
    this.sun.position.set(-19, 3.0, 4.8);
    this.sun.castShadow = settings.shadows;
    if (settings.shadows) {
      const s = this.sun.shadow;
      s.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
      s.camera.near = 1;
      s.camera.far = 34;
      s.camera.left = -6.5;
      s.camera.right = 6.5;
      s.camera.top = 5.5;
      s.camera.bottom = -1.5;
      s.bias = -0.0016;
      s.normalBias = 0.035;
    }
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.fill = new HemisphereLight(new Color(0.46, 0.55, 0.74), new Color(0.24, 0.20, 0.15), 0.72);
    scene.add(this.fill);

    this.bounce = new DirectionalLight(new Color(0.46, 0.54, 0.72), 0.40);
    this.bounce.position.set(9, 2.2, -6);
    scene.add(this.bounce);
  }

  update(sunDir: Vector3, time: number): void {
    this.mat.uniforms.uSunDir.value.copy(sunDir);
    this.mat.uniforms.uTime.value = time;
    this.sun.position.copy(sunDir).multiplyScalar(20);
    this.sun.target.position.set(0, 0.9, 0);
    this.sun.target.updateMatrixWorld();

    // As the sun drops the light reddens and softens: no colour grade, just the lamp.
    const elev = Math.max(0.02, sunDir.y);
    const warm = Math.min(1, 0.30 + elev * 5.0);
    this.sun.color.setRGB(1.0, 0.62 + 0.20 * warm, 0.34 + 0.26 * warm);
    this.sun.intensity = 3.6 + 12.0 * elev;
    this.bounce.position.copy(sunDir).multiplyScalar(-16).setY(2.4);
  }

  syncToCamera(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
  }
}
