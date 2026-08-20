/**
 * Sky, sun and image-based lighting.
 *
 * A small equirectangular sky is generated on the CPU and pushed through PMREM, so every
 * metal fitting, wet glue patch and rubber tyre reflects the actual time of day. The phase
 * runs 0 (bright craft room) -> 1 (golden yard) -> 2 (dusk) -> 3 (night), and the whole
 * lighting rig is interpolated along it.
 */

import {
  Color,
  DataTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  FloatType,
  FogExp2,
  HemisphereLight,
  LinearFilter,
  LinearSRGBColorSpace,
  PMREMGenerator,
  RGBAFormat,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { clamp, lerp } from '../util/math';
import { hash1 } from '../util/noise';
import type { QualitySettings } from '../core/Quality';

interface SkyPreset {
  zenith: string;
  horizon: string;
  ground: string;
  sun: Vector3;
  sunColor: string;
  sunIntensity: number;
  ambient: string;
  ambientIntensity: number;
  fog: string;
  fogDensity: number;
  envIntensity: number;
  stars: number;
  exposure: number;
}

const PRESETS: SkyPreset[] = [
  {
    zenith: '#79aee6',
    horizon: '#d8e7f4',
    ground: '#bdb2a0',
    sun: new Vector3(0.42, 0.78, 0.46),
    sunColor: '#fff4e2',
    sunIntensity: 2.9,
    ambient: '#cfe0f0',
    ambientIntensity: 0.72,
    fog: '#d5e2ee',
    fogDensity: 0.012,
    envIntensity: 1.0,
    stars: 0,
    exposure: 1.0,
  },
  {
    zenith: '#5188c9',
    horizon: '#f2c68c',
    ground: '#9d8b6f',
    sun: new Vector3(0.78, 0.3, 0.32),
    sunColor: '#ffd6a1',
    sunIntensity: 2.5,
    ambient: '#e3cbaa',
    ambientIntensity: 0.85,
    fog: '#e8c79c',
    fogDensity: 0.02,
    envIntensity: 0.95,
    stars: 0,
    exposure: 1.0,
  },
  {
    zenith: '#25406b',
    horizon: '#dd7440',
    ground: '#4b4249',
    sun: new Vector3(0.88, 0.07, 0.28),
    sunColor: '#ff9a54',
    sunIntensity: 0.85,
    ambient: '#7b7a99',
    ambientIntensity: 0.66,
    fog: '#7c5f63',
    fogDensity: 0.036,
    envIntensity: 0.62,
    stars: 0.25,
    exposure: 1.06,
  },
  {
    zenith: '#080f22',
    horizon: '#22305c',
    ground: '#0d1017',
    sun: new Vector3(0.55, 0.34, 0.45),
    sunColor: '#7d93c6',
    sunIntensity: 0.16,
    ambient: '#333c63',
    ambientIntensity: 0.3,
    fog: '#131a2c',
    fogDensity: 0.052,
    envIntensity: 0.3,
    stars: 1,
    exposure: 1.18,
  },
];

const SKY_W = 128;
const SKY_H = 64;

function mixColor(a: string, b: string, t: number, out: Color): Color {
  return out.set(a).lerp(new Color(b), t);
}

function blend(p: number): SkyPreset {
  const i = clamp(Math.floor(p), 0, PRESETS.length - 1);
  const j = clamp(i + 1, 0, PRESETS.length - 1);
  const t = clamp(p - i, 0, 1);
  const A = PRESETS[i];
  const B = PRESETS[j];
  const c = new Color();
  return {
    zenith: `#${mixColor(A.zenith, B.zenith, t, c).getHexString()}`,
    horizon: `#${mixColor(A.horizon, B.horizon, t, c).getHexString()}`,
    ground: `#${mixColor(A.ground, B.ground, t, c).getHexString()}`,
    sun: new Vector3().lerpVectors(A.sun, B.sun, t).normalize(),
    sunColor: `#${mixColor(A.sunColor, B.sunColor, t, c).getHexString()}`,
    sunIntensity: lerp(A.sunIntensity, B.sunIntensity, t),
    ambient: `#${mixColor(A.ambient, B.ambient, t, c).getHexString()}`,
    ambientIntensity: lerp(A.ambientIntensity, B.ambientIntensity, t),
    fog: `#${mixColor(A.fog, B.fog, t, c).getHexString()}`,
    fogDensity: lerp(A.fogDensity, B.fogDensity, t),
    envIntensity: lerp(A.envIntensity, B.envIntensity, t),
    stars: lerp(A.stars, B.stars, t),
    exposure: lerp(A.exposure, B.exposure, t),
  };
}

export class Environment {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  readonly fog: FogExp2;
  exposure = 1;
  /** Ambient colour reaching the back of the paper, used by the washi shader. */
  readonly backAmbient = new Color('#cddcf0');

  private readonly pmrem: PMREMGenerator;
  private readonly data: Float32Array;
  private readonly skyTex: DataTexture;
  private envMap: Texture | null = null;
  private envRT: WebGLRenderTarget | null = null;
  private lastBaked = -99;
  private phase = 0;

  constructor(
    renderer: WebGLRenderer,
    private readonly scene: Scene,
    quality: QualitySettings,
  ) {
    this.pmrem = new PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.data = new Float32Array(SKY_W * SKY_H * 4);
    this.skyTex = new DataTexture(this.data, SKY_W, SKY_H, RGBAFormat, FloatType);
    this.skyTex.mapping = EquirectangularReflectionMapping;
    this.skyTex.colorSpace = LinearSRGBColorSpace;
    this.skyTex.minFilter = LinearFilter;
    this.skyTex.magFilter = LinearFilter;
    this.skyTex.needsUpdate = true;

    this.sun = new DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 22;
    this.sun.shadow.camera.left = -5;
    this.sun.shadow.camera.right = 5;
    this.sun.shadow.camera.top = 5;
    this.sun.shadow.camera.bottom = -5;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.022;
    scene.add(this.sun, this.sun.target);

    this.hemi = new HemisphereLight(0xcfe0f0, 0x8a7a63, 1.0);
    scene.add(this.hemi);

    this.fog = new FogExp2(0xd5e2ee, 0.012);
    scene.fog = this.fog;

    this.setPhase(0, true);
  }

  get currentPhase(): number {
    return this.phase;
  }

  setPhase(p: number, force = false): void {
    this.phase = clamp(p, 0, PRESETS.length - 1);
    const s = blend(this.phase);

    this.sun.color.set(s.sunColor);
    this.sun.intensity = s.sunIntensity;
    // after dusk the sun contributes almost nothing, so its shadow pass is dropped and the
    // budget goes to the lamp inside the nebuta instead
    this.sun.castShadow = s.sunIntensity > 0.5;
    this.sun.position.copy(s.sun).multiplyScalar(9);
    this.sun.target.position.set(0, 0.6, 0);
    this.sun.target.updateMatrixWorld();

    this.hemi.color.set(s.zenith);
    this.hemi.groundColor.set(s.ground);
    this.hemi.intensity = s.ambientIntensity;

    this.fog.color.set(s.fog);
    this.fog.density = s.fogDensity;
    this.scene.environmentIntensity = s.envIntensity;
    this.exposure = s.exposure;
    this.backAmbient.set(s.ambient).multiplyScalar(0.55 + 0.45 * s.ambientIntensity);

    // rebaking IBL is not free, so only do it when the sky has actually moved
    if (force || Math.abs(this.phase - this.lastBaked) > 0.055) {
      this.bake(s);
      this.lastBaked = this.phase;
    }
  }

  private bake(s: SkyPreset): void {
    const zenith = new Color(s.zenith);
    const horizon = new Color(s.horizon);
    const ground = new Color(s.ground);
    const sunCol = new Color(s.sunColor);
    const sun = s.sun;

    let i = 0;
    for (let y = 0; y < SKY_H; y++) {
      // row 0 is straight down, row SKY_H-1 straight up
      const v = (y + 0.5) / SKY_H;
      const elev = (v - 0.5) * Math.PI;
      const dy = Math.sin(elev);
      const horiz = Math.cos(elev);
      for (let x = 0; x < SKY_W; x++) {
        const u = (x + 0.5) / SKY_W;
        const az = u * Math.PI * 2;
        const dx = Math.cos(az) * horiz;
        const dz = Math.sin(az) * horiz;

        let r: number;
        let g: number;
        let b: number;
        if (dy < 0) {
          const t = clamp(-dy / 0.35, 0, 1);
          r = lerp(horizon.r, ground.r, t);
          g = lerp(horizon.g, ground.g, t);
          b = lerp(horizon.b, ground.b, t);
        } else {
          const t = Math.pow(clamp(dy / 0.62, 0, 1), 0.72);
          r = lerp(horizon.r, zenith.r, t);
          g = lerp(horizon.g, zenith.g, t);
          b = lerp(horizon.b, zenith.b, t);
        }

        const d = dx * sun.x + dy * sun.y + dz * sun.z;
        const disc = Math.pow(Math.max(d, 0), 260) * s.sunIntensity * 9;
        const glow = Math.pow(Math.max(d, 0), 5.5) * s.sunIntensity * 0.42;
        r += (disc + glow) * sunCol.r;
        g += (disc + glow) * sunCol.g;
        b += (disc + glow) * sunCol.b;

        if (s.stars > 0.02 && dy > 0.02) {
          const h = hash1(x * 7.13 + y * 131.7);
          if (h > 0.993) {
            const tw = 0.6 + 0.4 * hash1(x * 3.1 + y * 5.7);
            const a = s.stars * tw * clamp(dy * 2.2, 0, 1) * 5.5;
            r += a;
            g += a * 0.97;
            b += a * 0.9;
          }
        }

        this.data[i++] = r;
        this.data[i++] = g;
        this.data[i++] = b;
        this.data[i++] = 1;
      }
    }
    this.skyTex.needsUpdate = true;

    // Reuse one PMREM target: re-baking the sky several times a second during the walk out
    // to the yard would otherwise leak a render target per frame.
    this.envRT = this.pmrem.fromEquirectangular(this.skyTex, this.envRT ?? undefined);
    this.envMap = this.envRT.texture;
    this.scene.environment = this.envMap;
    // the cube-UV texture renders as a real sky dome; the raw equirect would be stretched flat
    this.scene.background = this.envMap;
    this.scene.backgroundIntensity = 1;
    this.scene.backgroundBlurriness = 0;
  }

  dispose(): void {
    this.pmrem.dispose();
    this.skyTex.dispose();
    this.envRT?.dispose();
  }
}
