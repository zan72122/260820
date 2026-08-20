/**
 * The hero object. Skin, down and ripening all hang off the same parametric
 * surface, and the sheet's bounce light drives both what you see now (fill,
 * rim on the down) and what you get later (the blush mask).
 */
import * as THREE from 'three'
import { peachNormal, peachPoint, type PeachShape } from './peachShape'
import { makeFuzzShellAlpha, makePeachTextures, type PeachTextures } from './textures'
import { BOUNCE_AT_FRAGMENT, withBounce } from './bounceMaterial'
import { BlushField, type Occluder } from '../sim/blush'
import { GLSL_BOUNCE } from '../sim/lightMath'
import type { LightRig } from './lightRig'
import type { QualitySettings } from '../core/quality'

export function buildPeachGeometry(shape: PeachShape, segU: number, segV: number): THREE.BufferGeometry {
  const vertCount = (segU + 1) * (segV + 1)
  const pos = new Float32Array(vertCount * 3)
  const nrm = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)
  const idx: number[] = []
  let k = 0
  for (let j = 0; j <= segV; j++) {
    const v = j / segV
    for (let i = 0; i <= segU; i++) {
      const u = i / segU
      const p = peachPoint(u, v, shape)
      const n = peachNormal(u, v, shape)
      pos[k * 3] = p.x
      pos[k * 3 + 1] = p.y
      pos[k * 3 + 2] = p.z
      nrm[k * 3] = n.x
      nrm[k * 3 + 1] = n.y
      nrm[k * 3 + 2] = n.z
      uvs[k * 2] = u
      uvs[k * 2 + 1] = v
      k++
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i
      const b = a + 1
      const c = a + segU + 1
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

const SHELL_VERT = /* glsl */ `
uniform float uOffset;
varying vec2 vShellUv;
varying vec3 vShellN;
varying vec3 vShellWN;
varying vec3 vShellWP;
varying vec3 vShellV;
void main() {
  vShellUv = uv;
  vec3 p = position + normal * uOffset;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vShellV = -mv.xyz;
  vShellN = normalize(normalMatrix * normal);
  vShellWN = normalize(mat3(modelMatrix) * normal);
  vShellWP = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}
`

const SHELL_FRAG = /* glsl */ `
uniform sampler2D uShellAlpha;
uniform sampler2D uFuzzMap;
uniform sampler2D uBlushMap;
uniform vec3 uDownColor;
uniform vec3 uSheetTint;
uniform vec3 uQ0;
uniform vec3 uQ1;
uniform vec3 uQ2;
uniform vec3 uQ3;
uniform vec3 uSheetNormal;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSheetAlbedo;
uniform float uSunStrength;
uniform float uSheetDeployed;
uniform float uBounceGain;
uniform float uLayer;
uniform float uLayers;
uniform float uDensity;
varying vec2 vShellUv;
varying vec3 vShellN;
varying vec3 vShellWN;
varying vec3 vShellWP;
varying vec3 vShellV;

${GLSL_BOUNCE}

void main() {
  vec2 tuv = vShellUv * vec2(7.0, 4.0);
  float tip = texture2D(uShellAlpha, tuv).a;
  float dens = texture2D(uFuzzMap, vShellUv).r;
  float layerT = uLayer / max(1.0, uLayers);
  float fall = pow(1.0 - layerT, 1.35);

  vec3 N = normalize(vShellN);
  vec3 V = normalize(vShellV);
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 1.7);

  // Down reads at the silhouette. Across the face it must stay almost nothing,
  // or the shells simply repaint the fruit white.
  float a = tip * dens * uDensity * fall * (0.05 + 0.95 * rim);
  if (a < 0.004) discard;

  vec3 wn = normalize(vShellWN);
  float sun = max(0.0, dot(wn, uSunDir)) * uSunStrength;
  float bnc = momoBounce(vShellWP, wn, uQ0, uQ1, uQ2, uQ3, uSheetNormal, uSunDir,
                         uSheetAlbedo, uSunStrength, uSheetDeployed) * uBounceGain;
  // Backlit down also transmits a little, which is why it reads as fibre.
  float trans = pow(max(0.0, dot(-wn, uSunDir)) * 0.5 + 0.5, 3.0) * uSunStrength * 0.25;

  float blush = texture2D(uBlushMap, vShellUv).r;
  // Down over a ripening cheek picks up the colour underneath it.
  vec3 base = mix(uDownColor, uDownColor * vec3(1.02, 0.76, 0.72), smoothstep(0.15, 0.9, blush));
  vec3 lit = base * (0.22 + sun * 0.62 + trans) * uSunColor + uSheetTint * bnc * 1.5;

  gl_FragColor = vec4(lit, clamp(a, 0.0, 0.34));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export class Peach {
  readonly group = new THREE.Group()
  readonly mesh: THREE.Mesh
  readonly blush: BlushField
  shape: PeachShape

  private geometry: THREE.BufferGeometry
  private textures: PeachTextures
  private shellAlpha: THREE.DataTexture
  private shells: THREE.Mesh[] = []
  private material: THREE.MeshPhysicalMaterial
  private shellMaterials: THREE.ShaderMaterial[] = []
  private readonly sunColorUniform: THREE.IUniform<THREE.Color>
  private readonly fuzzStrength: THREE.IUniform<number>

  constructor(
    private rig: LightRig,
    private q: QualitySettings,
    shape: PeachShape,
  ) {
    this.shape = shape
    this.textures = makePeachTextures(shape.seed, shape.sutureA / (Math.PI * 2))
    this.shellAlpha = makeFuzzShellAlpha(shape.seed + 3)
    this.blush = new BlushField(shape)
    this.geometry = buildPeachGeometry(shape, q.peachSegments, Math.round(q.peachSegments * 0.72))
    this.sunColorUniform = { value: new THREE.Color(0xfff2d8) }
    this.fuzzStrength = { value: 1 }

    this.material = this.makeSkinMaterial()
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.group.add(this.mesh)
    this.buildShells()
  }

  private makeSkinMaterial(): THREE.MeshPhysicalMaterial {
    const t = this.textures
    const mat = new THREE.MeshPhysicalMaterial({
      map: t.map,
      normalMap: t.normalMap,
      roughnessMap: t.roughnessMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 1,
      metalness: 0,
      // Sheen is what makes skin look downy - but at full strength it lays a
      // white coat over the fruit and every trace of colour disappears.
      sheen: 0.4,
      sheenColor: new THREE.Color(0xc9a493),
      sheenRoughness: 0.8,
      envMapIntensity: 0.22,
    })
    return withBounce(mat, this.rig, {
      uniforms: {
        uBlushMap: { value: this.blush.texture },
        uFuzzMap: { value: t.fuzzMap },
        uFuzzColor: { value: new THREE.Color(0xfff0e2) },
        uFuzzStrength: this.fuzzStrength,
        uSunColor: this.sunColorUniform,
      },
      fragmentCommon: /* glsl */ `
        uniform sampler2D uBlushMap;
        uniform sampler2D uFuzzMap;
        uniform vec3 uFuzzColor;
        uniform vec3 uSunColor;
        uniform float uFuzzStrength;
        ${BOUNCE_AT_FRAGMENT}
      `,
      afterMap: /* glsl */ `
        {
          // Ripening is a mask that grew, not a tint that faded in: the edge is
          // broken up by the fruit's own mottle so it reads as skin, not paint.
          float raw = texture2D(uBlushMap, vMapUv).r;
          float mottle = texture2D(uFuzzMap, vMapUv * 2.3).g;
          float m = clamp(raw * 1.12 + (mottle - 0.5) * 0.3 * smoothstep(0.02, 0.6, raw), 0.0, 1.0);
          // Straw -> apricot -> the deep crimson cheek, in two stages, so the
          // middle of the range still looks like a half-ripened peach.
          vec3 unripe = diffuseColor.rgb;
          vec3 apricot = unripe * vec3(1.24, 0.82, 0.5);
          vec3 crimson = vec3(0.62, 0.11, 0.1);
          vec3 col = mix(unripe, apricot, smoothstep(0.02, 0.34, m));
          col = mix(col, crimson, smoothstep(0.3, 0.96, m));
          diffuseColor.rgb = col;
        }
      `,
      afterLights: /* glsl */ `
        {
          float bnc = momoBounceHere() * uBounceGain;
          // The sheet is an area source: it fills, it never blows out.
          reflectedLight.indirectDiffuse += uSheetTint * bnc * 1.75 * diffuseColor.rgb;
        }
      `,
      afterOpaque: /* glsl */ `
        {
          float bnc = momoBounceHere() * uBounceGain;
          vec3 V = normalize(vViewPosition);
          float ndv = clamp(dot(normal, V), 0.0, 1.0);
          float rim = pow(1.0 - ndv, 2.7);
          float dens = texture2D(uFuzzMap, vMapUv).r;
          vec3 wn = normalize(vMomoWNrm);
          float sun = max(0.0, dot(wn, uSunDir)) * uSunStrength;
          float back = pow(max(0.0, dot(-wn, uSunDir)) * 0.5 + 0.5, 3.5) * uSunStrength * 0.3;
          vec3 downLight = uSunColor * (sun * 0.5 + back) + uSheetTint * bnc * 2.1 + vec3(0.1);
          gl_FragColor.rgb += uFuzzColor * downLight * rim * dens * 0.85 * uFuzzStrength;
        }
      `,
    })
  }

  private buildShells(): void {
    this.disposeShells()
    const count = this.q.fuzzShells
    if (count <= 0) return
    const step = this.shape.radius * 0.0042
    for (let i = 0; i < count; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT,
        fragmentShader: SHELL_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        uniforms: {
          uOffset: { value: step * (i + 1) },
          uLayer: { value: i },
          uLayers: { value: count },
          uDensity: { value: 0.9 },
          uShellAlpha: { value: this.shellAlpha },
          uFuzzMap: { value: this.textures.fuzzMap },
          uBlushMap: { value: this.blush.texture },
          uDownColor: { value: new THREE.Color(0xf6ead9) },
          uSunColor: this.sunColorUniform,
          ...(this.rig.uniforms as unknown as Record<string, THREE.IUniform>),
        },
      })
      const shell = new THREE.Mesh(this.geometry, mat)
      shell.renderOrder = 3 + i
      shell.castShadow = false
      shell.receiveShadow = false
      this.group.add(shell)
      this.shells.push(shell)
      this.shellMaterials.push(mat)
    }
  }

  private disposeShells(): void {
    for (const s of this.shells) this.group.remove(s)
    for (const m of this.shellMaterials) m.dispose()
    this.shells = []
    this.shellMaterials = []
  }

  setQuality(q: QualitySettings): void {
    this.q = q
    this.buildShells()
  }

  /** Hide the down while the bag is on - you should not see it through paper. */
  setVisible(v: boolean): void {
    this.group.visible = v
  }

  setFuzzStrength(v: number): void {
    this.fuzzStrength.value = v
  }

  syncTransform(): void {
    this.group.updateWorldMatrix(true, true)
    this.blush.setTransform(this.mesh.matrixWorld)
  }

  update(dt: number, dSim: number, occluders: Occluder[]): void {
    this.sunColorUniform.value.copy(this.rig.sun.color)
    this.blush.update(dt, dSim, this.rig.sheetState, this.rig.sunDir, this.rig.sunStrength, occluders)
  }

  /** Re-seed for the next fruit without rebuilding the whole scene. */
  reshape(shape: PeachShape): void {
    this.shape = shape
    this.textures.dispose()
    this.textures = makePeachTextures(shape.seed, shape.sutureA / (Math.PI * 2))
    this.shellAlpha.dispose()
    this.shellAlpha = makeFuzzShellAlpha(shape.seed + 3)
    this.geometry.dispose()
    this.geometry = buildPeachGeometry(shape, this.q.peachSegments, Math.round(this.q.peachSegments * 0.72))
    this.mesh.geometry = this.geometry
    this.material.map = this.textures.map
    this.material.normalMap = this.textures.normalMap
    this.material.roughnessMap = this.textures.roughnessMap
    this.material.needsUpdate = true
    this.blush.reset(shape)
    this.buildShells()
    this.syncTransform()
  }

  dispose(): void {
    this.disposeShells()
    this.geometry.dispose()
    this.material.dispose()
    this.textures.dispose()
    this.shellAlpha.dispose()
    this.blush.dispose()
  }
}
