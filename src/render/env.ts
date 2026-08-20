import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  WebGLRenderer,
} from 'three';

/**
 * A morning sky built in-engine: no HDRI download, and the same shader feeds
 * both the visible dome and the pre-filtered environment map that every PBR
 * material reflects.
 */
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uHaze;

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // Sky gradient with a soft, slightly hazy horizon band.
    float t = clamp(h, 0.0, 1.0);
    vec3 sky = mix(uHorizon, uZenith, pow(t, 0.58));
    // Warm morning glow lifting off the horizon around the sun azimuth.
    float az = max(0.0, dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))));
    sky += uSunColor * pow(az, 5.0) * exp(-t * 5.0) * 0.5 * uHaze;
    // Sun disc, deliberately soft so specular highlights stay round.
    float sd = dot(d, normalize(uSunDir));
    sky += uSunColor * smoothstep(0.9975, 0.99955, sd) * 9.0;
    sky += uSunColor * pow(max(sd, 0.0), 220.0) * 0.9;
    // Ground bounce below the horizon keeps metal from reflecting black.
    vec3 below = mix(uGround, uHorizon, smoothstep(-0.35, 0.0, h));
    vec3 col = mix(below, sky, smoothstep(-0.02, 0.05, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface SkyConfig {
  zenith: Color;
  horizon: Color;
  ground: Color;
  sunColor: Color;
  sunDir: [number, number, number];
  haze: number;
}

export const MORNING: SkyConfig = {
  zenith: new Color('#5b93c8').convertSRGBToLinear(),
  horizon: new Color('#dfe9ec').convertSRGBToLinear(),
  ground: new Color('#4c5340').convertSRGBToLinear(),
  sunColor: new Color('#ffe3bd').convertSRGBToLinear(),
  sunDir: [-0.4, 0.48, 0.78],
  haze: 1,
};

export function makeSkyMaterial(cfg: SkyConfig = MORNING): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: cfg.zenith.clone() },
      uHorizon: { value: cfg.horizon.clone() },
      uGround: { value: cfg.ground.clone() },
      uSunDir: { value: cfg.sunDir.slice() },
      uSunColor: { value: cfg.sunColor.clone() },
      uHaze: { value: cfg.haze },
    },
  });
}

export function makeSkyDome(cfg: SkyConfig = MORNING): Mesh {
  const mesh = new Mesh(new SphereGeometry(220, 32, 20), makeSkyMaterial(cfg));
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

/**
 * Environment map. The sky alone leaves the underside of objects dead, so the
 * baked scene also carries a couple of very cheap proxies — the ground plane
 * and a warm building wall — which is what makes the steel ball read as being
 * in a real place rather than floating in a gradient.
 */
export class EnvironmentBaker {
  private pmrem: PMREMGenerator;
  private scene = new Scene();
  private lastBake = -Infinity;
  texture: Texture | null = null;

  constructor(renderer: WebGLRenderer, cfg: SkyConfig = MORNING) {
    this.pmrem = new PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    const dome = new Mesh(new SphereGeometry(60, 24, 16), makeSkyMaterial(cfg));
    this.scene.add(dome);

    const ground = new Mesh(
      new BoxGeometry(120, 0.2, 120),
      new MeshBasicMaterial({ color: new Color('#8b8a70').convertSRGBToLinear() }),
    );
    ground.position.y = -2.2;
    this.scene.add(ground);

    // Distant tree line: a dark ring that grounds the horizon in reflections.
    const treeline = new Mesh(
      new SphereGeometry(52, 20, 8, 0, Math.PI * 2, Math.PI * 0.43, Math.PI * 0.13),
      new MeshBasicMaterial({ color: new Color('#4a5c42').convertSRGBToLinear(), side: BackSide }),
    );
    this.scene.add(treeline);
  }

  /** Re-bake at most once per `interval` seconds (Infinity = bake once). */
  update(now: number, interval: number, resolution: number): Texture {
    if (this.texture && now - this.lastBake < interval) return this.texture;
    const prev = this.texture;
    this.texture = this.pmrem.fromScene(this.scene, 0.04, 0.1, 100, { size: resolution }).texture;
    if (prev) prev.dispose();
    this.lastBake = now;
    return this.texture;
  }

  dispose(): void {
    this.pmrem.dispose();
    this.texture?.dispose();
  }
}
