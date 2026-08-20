import * as THREE from 'three';
import type { QualityProfile } from '../core/Quality';
import { clamp01, lerp, TAU } from '../core/mathx';
import { makeLeafDappleTexture } from './textures';

export interface SkyColors {
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  ambient: number;
}

/** Key light positions and colours through one day, keyed by cycle phase. */
const DAY_KEYS: { t: number; c: SkyColors; elev: number; azim: number }[] = [
  {
    t: 0.0, // early morning
    elev: 16, azim: 78,
    c: {
      zenith: new THREE.Color(0x74a8d8), horizon: new THREE.Color(0xf3d6a6),
      ground: new THREE.Color(0x6d6a4e), sun: new THREE.Color(0xffd9a0),
      sunIntensity: 1.85, ambient: 0.5,
    },
  },
  {
    t: 0.26, // late morning, the game's default light
    elev: 52, azim: 42,
    c: {
      zenith: new THREE.Color(0x5f9fdd), horizon: new THREE.Color(0xdfeaf2),
      ground: new THREE.Color(0x7e7a58), sun: new THREE.Color(0xfff2d8),
      sunIntensity: 2.6, ambient: 0.7,
    },
  },
  {
    t: 0.42, // high summer noon
    elev: 74, azim: 8,
    c: {
      zenith: new THREE.Color(0x4d92dc), horizon: new THREE.Color(0xe9f1f6),
      ground: new THREE.Color(0x8a8462), sun: new THREE.Color(0xfffaf0),
      sunIntensity: 2.9, ambient: 0.74,
    },
  },
  {
    t: 0.6, // late afternoon
    elev: 22, azim: -52,
    c: {
      zenith: new THREE.Color(0x6f97c8), horizon: new THREE.Color(0xf6c98a),
      ground: new THREE.Color(0x7a6446), sun: new THREE.Color(0xffc073),
      sunIntensity: 2.0, ambient: 0.54,
    },
  },
  {
    t: 0.72, // dusk
    elev: 4, azim: -78,
    c: {
      zenith: new THREE.Color(0x3c4e7e), horizon: new THREE.Color(0xd98d63),
      ground: new THREE.Color(0x4a4238), sun: new THREE.Color(0xe89058),
      sunIntensity: 0.95, ambient: 0.4,
    },
  },
  {
    t: 0.85, // night: the moon takes the key
    elev: 46, azim: -20,
    c: {
      zenith: new THREE.Color(0x1a2340), horizon: new THREE.Color(0x2b3a5c),
      ground: new THREE.Color(0x232a34), sun: new THREE.Color(0x9fb8e8),
      sunIntensity: 0.55, ambient: 0.3,
    },
  },
  {
    t: 1.0, // back to early morning
    elev: 16, azim: 78,
    c: {
      zenith: new THREE.Color(0x74a8d8), horizon: new THREE.Color(0xf3d6a6),
      ground: new THREE.Color(0x6d6a4e), sun: new THREE.Color(0xffd9a0),
      sunIntensity: 1.85, ambient: 0.5,
    },
  },
];

function sampleDay(phase: number): { c: SkyColors; elev: number; azim: number; night: number } {
  const p = ((phase % 1) + 1) % 1;
  let i = 0;
  while (i < DAY_KEYS.length - 2 && DAY_KEYS[i + 1].t < p) i++;
  const a = DAY_KEYS[i];
  const b = DAY_KEYS[i + 1];
  const t = clamp01((p - a.t) / Math.max(1e-5, b.t - a.t));
  const c: SkyColors = {
    zenith: a.c.zenith.clone().lerp(b.c.zenith, t),
    horizon: a.c.horizon.clone().lerp(b.c.horizon, t),
    ground: a.c.ground.clone().lerp(b.c.ground, t),
    sun: a.c.sun.clone().lerp(b.c.sun, t),
    sunIntensity: lerp(a.c.sunIntensity, b.c.sunIntensity, t),
    ambient: lerp(a.c.ambient, b.c.ambient, t),
  };
  // Angles are interpolated the short way so the sun never snaps across the sky.
  let azimA = a.azim;
  let azimB = b.azim;
  if (azimB - azimA > 180) azimB -= 360;
  if (azimA - azimB > 180) azimB += 360;
  return {
    c,
    elev: lerp(a.elev, b.elev, t),
    azim: lerp(azimA, azimB, t),
    night: clamp01((p - 0.68) / 0.12) * clamp01((0.98 - p) / 0.1),
  };
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main(){
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h >= 0.0
      ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 0.4));
    // Sun / moon disc plus its glow.
    float sd = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
    col += uSunColor * pow(sd, 900.0) * 6.0;
    col += uSunColor * pow(sd, 12.0) * 0.28;
    // A few stars, only at night.
    if (uNight > 0.01 && h > 0.03) {
      vec3 g = floor(d * 220.0);
      float r = fract(sin(dot(g, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      col += vec3(0.9, 0.94, 1.0) * step(0.9985, r) * uNight * 1.4;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export interface EnvironmentOptions {
  quality: QualityProfile;
  /** Orchard/outdoor scenes get a canopy that throws real leaf shadows. */
  canopy?: boolean;
  canopyHeight?: number;
  canopyRadius?: number;
}

/**
 * Sky, key light, bounce and dappled shade. One rig serves every scene so a
 * change of light reads as the same world at a different hour, never as a cut.
 */
export class EnvironmentRig {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly bounce: THREE.DirectionalLight;
  readonly sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private canopy: THREE.Mesh | null = null;
  private canopyHeight = 0;
  private shadowTarget = new THREE.Vector3();
  private pmrem: THREE.PMREMGenerator | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private phase = 0.26;
  private quality: QualityProfile;
  private sunDir = new THREE.Vector3();

  constructor(opts: EnvironmentOptions) {
    this.quality = opts.quality;

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x5f9fdd) },
        uHorizon: { value: new THREE.Color(0xdfeaf2) },
        uGround: { value: new THREE.Color(0x7e7a58) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(0xfff2d8) },
        uNight: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 20), this.skyMat);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
    this.sun.castShadow = opts.quality.shadows;
    const s = opts.quality.shadowMapSize;
    this.sun.shadow.mapSize.set(s, s);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 42;
    this.sun.shadow.camera.left = -7;
    this.sun.shadow.camera.right = 7;
    this.sun.shadow.camera.top = 7;
    this.sun.shadow.camera.bottom = -7;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.022;
    this.sun.shadow.radius = 2.5;
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xdcecff, 0x6d6a4e, 0.72);
    this.group.add(this.hemi);

    // Warm bounce off wood / ground, from below and to the side.
    this.bounce = new THREE.DirectionalLight(0xffd9a8, 0.55);
    this.bounce.position.set(-2.5, 0.8, 2.4);
    this.group.add(this.bounce);

    if (opts.canopy) this.addCanopy(opts.canopyHeight ?? 4.6, opts.canopyRadius ?? 6);
    this.setPhase(this.phase);
  }

  private addCanopy(height: number, radius: number): void {
    if (!this.quality.shadows || !this.quality.atmosphere) return;
    const tex = makeLeafDappleTexture(512, 4242);
    const mat = new THREE.MeshBasicMaterial({
      alphaMap: tex,
      alphaTest: 0.5,
      transparent: false,
      // The canopy exists only to cast leaf shadows. It must contribute
      // nothing to the colour pass -- not even depth, or a camera that rises
      // to its height would find the whole frame occluded by it.
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    // Sized to the shadow frustum: a larger plane would have its shadow
    // clipped, drawing a hard rectangle across the ground.
    // Comfortably inside the shadow frustum, so the canopy's own soft rim
    // defines the edge of the shade rather than the shadow map being clipped.
    const geo = new THREE.CircleGeometry(radius * 0.58, 40);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height;
    this.canopyHeight = height;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.renderOrder = -999;
    this.canopy = mesh;
    this.group.add(mesh);
  }

  /** Rebuilds the image-based lighting. Called once per quality change. */
  buildEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    const tmp = new THREE.Scene();
    const skyClone = new THREE.Mesh(this.sky.geometry, this.skyMat.clone());
    tmp.add(skyClone);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(tmp, 0.04, 0.1, 100);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 0.68;
    skyClone.material.dispose();
  }

  /** phase 0..1 = one full day. Values beyond 1 simply wrap. */
  setPhase(phase: number): void {
    this.phase = phase;
    const d = sampleDay(phase);
    const elev = (d.elev * Math.PI) / 180;
    const azim = (d.azim * Math.PI) / 180;
    this.sunDir
      .set(Math.cos(elev) * Math.sin(azim), Math.sin(elev), Math.cos(elev) * Math.cos(azim))
      .normalize();

    this.sun.position.copy(this.sunDir).multiplyScalar(16);
    this.sun.color.copy(d.c.sun);
    this.sun.intensity = d.c.sunIntensity;
    this.hemi.color.copy(d.c.zenith).lerp(new THREE.Color(0xffffff), 0.35);
    this.hemi.groundColor.copy(d.c.ground);
    this.hemi.intensity = d.c.ambient;
    this.bounce.intensity = lerp(0.1, 0.45, clamp01(d.c.sunIntensity / 2.9));

    const u = this.skyMat.uniforms;
    (u.uZenith.value as THREE.Color).copy(d.c.zenith);
    (u.uHorizon.value as THREE.Color).copy(d.c.horizon);
    (u.uGround.value as THREE.Color).copy(d.c.ground);
    (u.uSunColor.value as THREE.Color).copy(d.c.sun);
    (u.uSunDir.value as THREE.Vector3).copy(this.sunDir);
    u.uNight.value = d.night;

    if (this.canopy) {
      // The canopy drifts a little so the dapple is never frozen.
      this.canopy.rotation.y = phase * 0.6;
      this.placeCanopy();
    }
  }

  get currentPhase(): number {
    return this.phase;
  }

  get sunDirection(): THREE.Vector3 {
    return this.sunDir;
  }

  /** 0 at midday, 1 in the middle of the night. */
  get nightAmount(): number {
    return sampleDay(this.phase).night;
  }

  /** Points the shadow frustum at whatever the scene currently cares about. */
  focusShadows(target: THREE.Vector3, radius: number): void {
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
    this.sun.position.copy(target).addScaledVector(this.sunDir, Math.max(8, radius * 3));
    const cam = this.sun.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.4;
    cam.far = Math.max(14, radius * 7);
    cam.updateProjectionMatrix();
    this.shadowTarget.copy(target);
    this.placeCanopy();
  }

  /**
   * Puts the canopy where its shadow will actually land on the subject. A
   * canopy centred over the target throws its shade off to one side as soon
   * as the sun is anywhere but straight overhead.
   */
  private placeCanopy(): void {
    if (!this.canopy) return;
    const y = Math.max(0.15, this.sunDir.y);
    const h = this.canopyHeight;
    this.canopy.position.set(
      this.shadowTarget.x + (this.sunDir.x / y) * h,
      h,
      this.shadowTarget.z + (this.sunDir.z / y) * h,
    );
  }

  animateCanopy(t: number): void {
    if (this.canopy) {
      // A breath of wind in the branches: the dapple is never quite still.
      this.canopy.position.x += Math.sin(t * 0.31) * 0.012;
      this.canopy.position.z += Math.cos(t * 0.23) * 0.012;
    }
  }

  setCanopyVisible(v: boolean): void {
    if (this.canopy) this.canopy.visible = v;
  }

  dispose(): void {
    this.skyMat.dispose();
    this.sky.geometry.dispose();
    this.envRT?.dispose();
    this.pmrem?.dispose();
    if (this.canopy) {
      this.canopy.geometry.dispose();
      (this.canopy.material as THREE.Material).dispose();
    }
  }
}

/** Days-elapsed -> day-cycle phase, starting in late morning. */
export function phaseForDay(days: number): number {
  return 0.26 + days;
}

export const dayAngle = (phase: number): number => (phase % 1) * TAU;
