import {
  BackSide,
  CanvasTexture,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { QualitySettings } from '../core/Quality';
import type { OpticsState } from '../state/OpticsState';
import { cloudTexture } from '../materials/Textures';

export interface SkyBuild {
  group: Group;
  sun: DirectionalLight;
  hemi: HemisphereLight;
  update(state: OpticsState, dt: number): void;
  dispose(): void;
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uCloud;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -1.0, 1.0);
  vec3 zenith = vec3(0.055, 0.19, 0.52);
  vec3 horizon = vec3(0.56, 0.72, 0.88);
  vec3 col = mix(horizon, zenith, pow(clamp(up, 0.0, 1.0), 0.62));
  col = mix(col, vec3(0.44, 0.45, 0.42), smoothstep(0.015, -0.16, up));
  float sd = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.82, 0.55) * pow(sd, 7.0) * 0.42 * (1.0 - 0.55 * uCloud);
  col += vec3(1.0, 0.96, 0.88) * smoothstep(0.99955, 0.99985, sd) * (3.4 - 2.6 * uCloud);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function equirectSky(sunDir: Vector3): CanvasTexture {
  const w = 256;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const el = (0.5 - y / h) * Math.PI; // +PI/2 at top
    const up = Math.sin(el);
    for (let x = 0; x < w; x++) {
      let r: number;
      let g: number;
      let b: number;
      const t = Math.pow(Math.max(up, 0), 0.62);
      r = 0.62 * (1 - t) + 0.09 * t;
      g = 0.74 * (1 - t) + 0.24 * t;
      b = 0.86 * (1 - t) + 0.55 * t;
      // a bright sun blob so glossy gelcoat and steel get a real highlight
      const az = (x / w) * Math.PI * 2 - Math.PI;
      const dx = Math.cos(el) * Math.sin(az);
      const dy = up;
      const dz = Math.cos(el) * Math.cos(az);
      const sd = dx * sunDir.x + dy * sunDir.y + dz * sunDir.z;
      const glow = Math.pow(Math.max(sd, 0), 24) * 1.4 + Math.pow(Math.max(sd, 0), 6) * 0.22;
      r += glow;
      g += glow * 0.93;
      b += glow * 0.8;
      if (up < 0.02) {
        const k = Math.min(1, (0.02 - up) / 0.18);
        r = r * (1 - k) + 0.44 * k;
        g = g * (1 - k) + 0.45 * k;
        b = b * (1 - k) + 0.42 * k;
      }
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, r * 255);
      img.data[i + 1] = Math.min(255, g * 255);
      img.data[i + 2] = Math.min(255, b * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.mapping = EquirectangularReflectionMapping;
  return tex;
}

/**
 * One sun, one sky. Everything else in the game is that light after it has
 * been through resin, water or a dark barrel.
 */
export function buildSky(
  scene: Scene,
  renderer: WebGLRenderer,
  q: QualitySettings,
  sunDirection: Vector3,
): SkyBuild {
  const group = new Group();

  const skyMat = new ShaderMaterial({
    uniforms: { uSun: { value: new Vector3(0, 1, 0) }, uCloud: { value: 0 } },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new Mesh(new SphereGeometry(620, 32, 20), skyMat);
  dome.renderOrder = -1000;
  group.add(dome);

  const sun = new DirectionalLight(0xfff3e2, 3.1);
  sun.castShadow = q.shadows;
  sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.035;
  sun.target.position.set(0, 2.2, 0);
  group.add(sun, sun.target);

  const hemi = new HemisphereLight(0x9dc4e8, 0x5b5a4c, 0.85);
  group.add(hemi);

  // drifting cloud sheets — when one crosses the sun the pattern goes soft
  // one high band drifts across the sun's own line, the rest just give the
  // sky some weather; the occlusion below is measured, not scripted
  const clouds: Mesh[] = [];
  const cloudTex = cloudTexture();
  const sunHigh = sunDirection.clone().multiplyScalar(430);
  for (let i = 0; i < q.cloudLayers; i++) {
    const m = new MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.46 + i * 0.08,
      depthWrite: false,
      fog: false,
    });
    const high = i === 0;
    const size = high ? 300 : 220 + i * 90;
    const cloud = new Mesh(new PlaneGeometry(size, size * 0.4), m);
    if (high) cloud.position.set(-520, sunHigh.y, sunHigh.z);
    else cloud.position.set(-300 + i * 210, 74 + i * 20, -230 - i * 130);
    cloud.renderOrder = -900;
    clouds.push(cloud);
    group.add(cloud);
  }

  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const equi = equirectSky(sunDirection);
  const env = pmrem.fromEquirectangular(equi);
  scene.environment = env.texture;
  scene.environmentIntensity = 1.0;
  equi.dispose();
  pmrem.dispose();

  scene.fog = new Fog(new Color(0.70, 0.78, 0.85), 42, 320);

  const sunPos = new Vector3();
  const cloudDir = new Vector3();

  return {
    group,
    sun,
    hemi,
    update(state, dt) {
      sunPos.copy(state.sunDir).multiplyScalar(46);
      sun.position.copy(sunPos).add(sun.target.position);
      skyMat.uniforms.uSun.value.copy(state.sunDir);
      skyMat.uniforms.uCloud.value = state.cloudCover;

      // clouds actually drift, and actually occlude
      let cover = 0;
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.position.x += dt * (i === 0 ? 7.5 : 2.4 + i * 0.8);
        if (c.position.x > 520) c.position.x = -520;
        c.lookAt(0, 40, 0);
        cloudDir.copy(c.position).normalize();
        const d = cloudDir.dot(state.sunDir);
        cover = Math.max(cover, Math.max(0, (d - 0.93) / 0.07) * (i === 0 ? 1 : 0.25));
      }
      state.cloudCover += (Math.min(1, cover) - state.cloudCover) * Math.min(1, dt * 1.3);
      const dim = 1 - 0.62 * state.cloudCover;
      sun.intensity = 3.1 * dim;
      hemi.intensity = 0.85 + 0.35 * state.cloudCover;
    },
    dispose() {
      env.texture.dispose();
      skyMat.dispose();
      for (const c of clouds) (c.material as MeshBasicMaterial).dispose();
    },
  };
}
