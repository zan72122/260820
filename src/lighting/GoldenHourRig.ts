import {
  BackSide,
  CameraHelper,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { Flags } from '../core/flags'
import { sunDirection } from '../scene/layout'

/**
 * 夕方の斜光に固定したライティング。
 *
 * - 太陽: 高度12°/方位285°(西北西)の DirectionalLight。長い影がシルエット
 *   分離の主役。影フラスタムは近景の庭にタイトフィット。
 * - 環境光: HemisphereLight のみ（天頂=冷、地面=暖の照り返し）。夕暮れの
 *   実際の環境光構造で、フラットな AmbientLight は使わない。
 * - 空: グラデーションドーム＋控えめな太陽ディスク。ブルーム等の後処理は
 *   一切使わない。
 * - 空気遠近: リニアフォグ（暖色ヘイズ）。近景はほぼ影響を受けない。
 */
export interface GoldenHourRig {
  sun: DirectionalLight
  hemi: HemisphereLight
  skyDome: Mesh
}

/** 夕陽の色（約3000K相当の暖色）。 */
export const SUN_COLOR = '#ffb066'
export const SUN_INTENSITY = 2.6
export const HEMI_SKY_COLOR = '#7d87ae'
export const HEMI_GROUND_COLOR = '#7a5c40'
export const HEMI_INTENSITY = 0.42
export const FOG_COLOR = '#c99a78'
export const FOG_NEAR = 30
export const FOG_FAR = 520

const SKY_RADIUS = 820

export function createGoldenHourRig(scene: Scene, flags: Flags): GoldenHourRig {
  const dir = sunDirection()
  const sunDir = new Vector3(dir.x, dir.y, dir.z)

  // --- 太陽 ---------------------------------------------------------------
  const sun = new DirectionalLight(SUN_COLOR, SUN_INTENSITY)
  sun.position.copy(sunDir).multiplyScalar(45)
  sun.target.position.set(0, 0, 0.5) // 庭の中心
  scene.add(sun.target)
  sun.castShadow = !flags.e2eFast
  if (sun.castShadow) {
    sun.shadow.mapSize.set(2048, 2048)
    const cam = sun.shadow.camera
    cam.left = -11
    cam.right = 11
    cam.top = 11
    cam.bottom = -11
    cam.near = 1
    cam.far = 90
    // 12°のレーキング光はアクネの最悪条件: normalBias を主対策にする。
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.025
  }
  scene.add(sun)

  // --- 環境光 -------------------------------------------------------------
  const hemi = new HemisphereLight(HEMI_SKY_COLOR, HEMI_GROUND_COLOR, HEMI_INTENSITY)
  scene.add(hemi)

  // --- 空気遠近 -----------------------------------------------------------
  scene.fog = new Fog(FOG_COLOR, FOG_NEAR, FOG_FAR)

  // --- 空ドーム -----------------------------------------------------------
  const skyDome = new Mesh(
    new SphereGeometry(SKY_RADIUS, 32, 16),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSunDir: { value: sunDir.clone() },
        uHorizon: { value: new Color('#e8a06a') },
        uZenith: { value: new Color('#5a6a96') },
        uGroundHaze: { value: new Color('#b98f6e') },
        uSunTint: { value: new Color('#ffcf9c') },
        uSunDisc: { value: new Color('#fff0d4') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uGroundHaze;
        uniform vec3 uSunTint;
        uniform vec3 uSunDisc;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          // 高度による地平→天頂グラデーション（夕暮れは地平近くが厚く暖かい）
          float t = smoothstep(-0.02, 0.42, d.y);
          vec3 sky = mix(uHorizon, uZenith, t);
          // 地平線下はヘイズ色へ沈める（地形が覆うが念のため破綻させない）
          sky = mix(uGroundHaze, sky, smoothstep(-0.25, 0.0, d.y));
          // 太陽方向の広い暖色ロブ（ミー散乱の近似、地平近くほど強い）
          float sunAmount = max(dot(d, uSunDir), 0.0);
          float horizonBoost = 1.0 - smoothstep(0.0, 0.35, abs(d.y));
          sky += uSunTint * pow(sunAmount, 6.0) * (0.35 + 0.65 * horizonBoost);
          // 控えめな太陽ディスク（視半径約0.35°、ブルームなし）
          float disc = smoothstep(0.999955, 0.999985, sunAmount);
          sky += uSunDisc * disc * 2.2;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    }),
  )
  skyDome.name = 'skyDome'
  scene.add(skyDome)
  scene.background = null

  if (flags.debug === 'shadow' && sun.castShadow) {
    scene.add(new CameraHelper(sun.shadow.camera))
  }

  return { sun, hemi, skyDome }
}
