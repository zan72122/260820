import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { LightingState } from '../core/Lighting'
import { clamp, damp, lerp, Rng, smoothstep } from '../util/math'
import { makeGlowTexture } from '../util/textures'
import type { LightRig } from './Lights'
import { materials } from './materials'

const VALLEY_Y = -9
const WATER_Y = -14.5
/** Where the hilltop plateau ends and the slope begins. */
export const CREST_Z = -15

/**
 * Shared terrain profile. The park sits on a hilltop; the ground falls away just
 * past the fence, but only far enough that the whole valley stays in view from
 * the swing — a deeper drop would hide the town behind its own crest.
 */
export function terrainHeight(x: number, z: number): number {
  if (z > CREST_Z) return 0
  // Gentle enough that the whole hillside — and the houses on it — stay in view
  // from the swing. A steeper drop would hide the near slope behind its own crest.
  const t = smoothstep(CREST_Z, -90, z)
  let y = lerp(0, VALLEY_Y, t)
  y -= smoothstep(-90, -270, z) * 4.5
  // ridges closing the valley on both sides
  const edge = smoothstep(110, 300, Math.abs(x))
  y += edge * 44 * smoothstep(-60, -200, z)
  y += Math.sin(x * 0.021) * Math.cos(z * 0.0165) * 2.2 * t
  y += Math.sin(x * 0.061 + 1.3) * 0.8 * t
  // the ground slips under the water at the far end of the bay
  y -= smoothstep(-268, -344, z) * 11
  return y
}

const townVert = /* glsl */ `
attribute vec3 aSize;
attribute float aSeed;
attribute float aLitBias;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vSeed;
varying float vLitBias;
varying vec2 vCells;
varying float vFace;
varying float vWave;

void main() {
  vUv = uv;
  vSeed = aSeed;
  vLitBias = aLitBias;

  vec3 n = normal;
  float face = abs(n.y) > 0.5 ? 2.0 : (abs(n.x) > 0.5 ? 0.0 : 1.0);
  vFace = face;
  vec2 sz = face == 0.0 ? vec2(aSize.z, aSize.y) : vec2(aSize.x, aSize.y);
  vCells = max(vec2(1.0), floor(sz / vec2(3.1, 3.5)));

  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vWave = world.x;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const townFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorld;
varying float vSeed;
varying float vLitBias;
varying vec2 vCells;
varying float vFace;
varying float vWave;

uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunPower;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uContrast;
uniform float uLitLevel;
uniform float uWindowEmissive;
uniform float uBreath;
uniform float uBreathFront;
uniform vec3 uWarm;
uniform vec3 uBase;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 N = normalize(vNormalW);
  float ndl = max(dot(N, normalize(uSunDir)), 0.0);
  float sky = 0.5 + 0.5 * N.y;

  float tone = 0.72 + hash21(vec2(vSeed, 3.1)) * 0.5;
  vec3 albedo = uBase * tone;
  if (vFace == 2.0) albedo *= 0.78;

  // The sun is behind the town, so the faces we can see are in their own shadow:
  // dark against a bright sky, lifted only by haze. That silhouette is what stops
  // the valley reading as a flat painted backdrop.
  vec3 col = albedo * (mix(uGroundAmbient, uSkyAmbient, sky) * 0.5 + uSunColor * ndl * uSunPower * 0.8);
  // a thin warm rim where an edge just catches the last light
  float rim = pow(1.0 - abs(dot(N, normalize(cameraPosition - vWorld))), 3.0);
  col += uSunColor * rim * uSunPower * 0.12;

  // --- windows ---------------------------------------------------------
  vec3 emissive = vec3(0.0);
  if (vFace != 2.0) {
    vec2 g = vUv * vCells;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float r = hash21(cell + vec2(vSeed * 17.3, vSeed * 5.7));
    // the breath sweeps across the valley rather than snapping on everywhere
    float wave = smoothstep(uBreathFront - 90.0, uBreathFront + 30.0, vWave);
    float thresh = clamp(uLitLevel * vLitBias + uBreath * wave * 1.1, 0.0, 1.0);
    float on = step(r, thresh);
    float inW =
      step(0.20, f.x) * step(f.x, 0.74) *
      step(0.24, f.y) * step(f.y, 0.80);
    float warmth = hash21(cell + vec2(vSeed * 2.9, 11.0));
    vec3 wc = mix(uWarm, uWarm * vec3(1.06, 0.94, 0.74), warmth);
    emissive = wc * on * inW * uWindowEmissive * (0.55 + warmth * 0.7);
  }

  // Aerial perspective. The haze thins as the town lights itself, so contrast in
  // the valley climbs for a reason the player can see, not as a global curve.
  float d = length(vWorld - cameraPosition);
  float dens = uFogDensity * (1.6 - uContrast);
  float fogAmt = 1.0 - exp(-pow(d * dens, 2.0));
  col = mix(col, uFogColor, clamp(fogAmt, 0.0, 0.88));
  // lit windows punch through the haze, which is exactly what real ones do
  col += emissive * (1.0 - fogAmt * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`

const waterVert = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUvW;
void main() {
  vUvW = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const waterFrag = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec2 vUvW;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uTime;
uniform vec3 uMoonDir;
uniform float uMoonGlow;
uniform vec3 uWarm;
uniform float uWarmStrength;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(V.y, 0.0), 2.4);
  vec3 col = mix(uDeep, uSky, clamp(fres, 0.0, 1.0));

  // last warmth of the sunset lying on the water
  col = mix(col, uWarm, uWarmStrength * 0.16 * fres);

  // moon glitter: a narrow column of broken highlights, not a mirror
  float lane = exp(-pow((vWorld.x - uMoonDir.x * 260.0) / 26.0, 2.0));
  float ripple = 0.0;
  vec2 p = vWorld.xz * 0.12;
  ripple += step(0.965, hash21(floor(p + vec2(0.0, uTime * 0.35))));
  ripple += step(0.978, hash21(floor(p * 1.9 - vec2(uTime * 0.22, 0.0))));
  col += vec3(0.85, 0.88, 0.98) * lane * ripple * uMoonGlow * 0.5;

  float d = length(vWorld - cameraPosition);
  float fogAmt = 1.0 - exp(-pow(d * uFogDensity * 1.1, 2.0));
  col = mix(col, uFogColor, clamp(fogAmt, 0.0, 0.94));
  gl_FragColor = vec4(col, 1.0);
}
`

const terrainVert = /* glsl */ `
varying vec3 vWorld;
varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const terrainFrag = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vN;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunPower;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uContrast;
uniform vec3 uGrass;
uniform vec3 uRock;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 N = normalize(vN);
  float slope = 1.0 - clamp(N.y, 0.0, 1.0);
  float n = hash21(floor(vWorld.xz * 0.06));
  vec3 albedo = mix(uGrass, uRock, clamp(slope * 2.2 + n * 0.18, 0.0, 1.0));
  float ndl = max(dot(N, normalize(uSunDir)), 0.0);
  float sky = 0.5 + 0.5 * N.y;
  vec3 col = albedo * (mix(uGroundAmbient, uSkyAmbient, sky) * 0.9 + uSunColor * ndl * uSunPower * 0.8);
  float d = length(vWorld - cameraPosition);
  float dens = uFogDensity * (1.6 - uContrast);
  float fogAmt = 1.0 - exp(-pow(d * dens, 2.0));
  col = mix(col, uFogColor, clamp(fogAmt, 0.0, 0.93));
  gl_FragColor = vec4(col, 1.0);
}
`

/** A cluster of far-away point lights driven as one switchable group. */
class LightCluster {
  readonly mesh: InstancedMesh
  private mat: MeshBasicMaterial
  constructor(points: Vector3[], size: number, colour: Color, parent: Object3D) {
    this.mat = new MeshBasicMaterial({
      map: makeGlowTexture(64, 2.2),
      color: colour,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0,
      fog: false,
    })
    this.mesh = new InstancedMesh(new PlaneGeometry(size, size), this.mat, points.length)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    const d = new Object3D()
    points.forEach((p, i) => {
      d.position.copy(p)
      d.scale.setScalar(0.75 + (i % 4) * 0.16)
      d.updateMatrix()
      this.mesh.setMatrixAt(i, d.matrix)
    })
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.renderOrder = 9
    parent.add(this.mesh)
  }
  face(camera: Object3D): void {
    this.mesh.quaternion.copy(camera.quaternion)
  }
  setLevel(v: number): void {
    this.mat.opacity = clamp(v)
  }
}

/**
 * The valley town, the roads, the tower, the harbour and the far ridges.
 *
 * Everything past the fence is one instanced building mesh plus a handful of
 * additive light clusters — hundreds of windows and street lamps for a couple of
 * draw calls and zero extra dynamic lights.
 */
export class Town {
  readonly group = new Group()
  private buildings!: InstancedMesh
  private townMat!: ShaderMaterial
  private terrainMat!: ShaderMaterial
  private waterMat!: ShaderMaterial
  private clusters: LightCluster[] = []
  private beacon!: Mesh
  private beaconMat!: MeshBasicMaterial
  private nearHouseGlass: MeshStandardMaterial[] = []
  private time = 0
  private breathFront = -400
  private breathActive = 0
  private litLevel = 0

  constructor(rig: LightRig) {
    this.buildTerrain()
    this.buildWater()
    this.buildBuildings()
    this.buildRoads(rig)
    this.buildTower(rig)
    this.buildHarbour(rig)
    this.buildRidges(rig)
    this.buildNearHouses(rig)
  }

  // ------------------------------------------------------------- geometry

  private buildTerrain(): void {
    const W = 1000
    const D = 620
    const geo = new PlaneGeometry(W, D, 116, 128)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    // Slide the sheet so its near edge lands exactly on the crest, where the
    // park's flat plateau stops.
    const offset = CREST_Z - D / 2
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i) + offset
      pos.setZ(i, z)
      pos.setY(i, terrainHeight(x, z))
    }
    geo.computeVertexNormals()

    this.terrainMat = new ShaderMaterial({
      vertexShader: terrainVert,
      fragmentShader: terrainFrag,
      uniforms: {
        uSunDir: { value: new Vector3(0, 0.2, -1) },
        uSunColor: { value: new Color('#ffd0a0') },
        uSunPower: { value: 1 },
        uSkyAmbient: { value: new Color('#8fa4cc') },
        uGroundAmbient: { value: new Color('#5a4b47') },
        uFogColor: { value: new Color('#c8a08c') },
        uFogDensity: { value: 0.006 },
        uContrast: { value: 0.6 },
        uGrass: { value: new Color('#33401f') },
        uRock: { value: new Color('#463f36') },
      },
    })
    const mesh = new Mesh(geo, this.terrainMat)
    mesh.frustumCulled = false
    this.group.add(mesh)
  }

  private buildWater(): void {
    this.waterMat = new ShaderMaterial({
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      uniforms: {
        uDeep: { value: new Color('#22304a') },
        uSky: { value: new Color('#8fa4cc') },
        uFogColor: { value: new Color('#c8a08c') },
        uFogDensity: { value: 0.006 },
        uTime: { value: 0 },
        uMoonDir: { value: new Vector3(0.4, 0.4, -1) },
        uMoonGlow: { value: 0 },
        uWarm: { value: new Color('#ff9a4d') },
        uWarmStrength: { value: 1 },
      },
    })
    const geo = new PlaneGeometry(1300, 460, 1, 1)
    geo.rotateX(-Math.PI / 2)
    const water = new Mesh(geo, this.waterMat)
    water.position.set(0, WATER_Y, -510)
    water.frustumCulled = false
    this.group.add(water)
  }

  private buildBuildings(): void {
    const rng = new Rng(881122)
    const placements: {
      p: Vector3
      s: Vector3
      rot: number
      seed: number
      bias: number
    }[] = []

    // Blocks laid out along the valley, denser near the water, sparser up the sides.
    const blocks: { cx: number; cz: number; r: number; n: number; tall: number }[] = [
      { cx: -34, cz: -128, r: 40, n: 46, tall: 0.22 },
      { cx: 48, cz: -146, r: 44, n: 50, tall: 0.3 },
      { cx: -104, cz: -168, r: 42, n: 40, tall: 0.2 },
      { cx: 8, cz: -190, r: 54, n: 60, tall: 0.5 },
      { cx: 122, cz: -180, r: 44, n: 40, tall: 0.24 },
      { cx: -158, cz: -200, r: 40, n: 32, tall: 0.2 },
      { cx: 62, cz: -226, r: 48, n: 44, tall: 0.38 },
      { cx: -62, cz: -232, r: 46, n: 40, tall: 0.3 },
      { cx: 176, cz: -234, r: 40, n: 28, tall: 0.22 },
      { cx: -14, cz: -266, r: 54, n: 38, tall: 0.18 },
      { cx: 132, cz: -286, r: 44, n: 26, tall: 0.16 },
      { cx: -128, cz: -284, r: 44, n: 26, tall: 0.16 },
    ]

    for (const b of blocks) {
      for (let i = 0; i < b.n; i++) {
        const a = rng.range(0, Math.PI * 2)
        const rr = Math.sqrt(rng.next()) * b.r
        const x = b.cx + Math.cos(a) * rr
        const z = b.cz + Math.sin(a) * rr * 0.8
        const gy = terrainHeight(x, z)
        if (gy < WATER_Y + 1.5) continue
        const tallness = rng.next() < b.tall ? rng.range(1.45, 2.9) : rng.range(0.45, 1.05)
        const h = lerp(5, 16, rng.next()) * tallness
        const w = rng.range(8, 17)
        const d = rng.range(8, 15)
        placements.push({
          p: new Vector3(x, gy + h / 2, z),
          s: new Vector3(w, h, d),
          rot: Math.round(rng.range(-2, 2)) * 0.18 + rng.range(-0.05, 0.05),
          seed: rng.range(0, 100),
          // buildings near the centre of town come to life first
          bias: clamp(0.45 + (1 - Math.hypot(x - 14, z + 190) / 240) * 0.75),
        })
      }
    }

    const count = placements.length
    this.townMat = new ShaderMaterial({
      vertexShader: townVert,
      fragmentShader: townFrag,
      uniforms: {
        uSunDir: { value: new Vector3(0, 0.2, -1) },
        uSunColor: { value: new Color('#ffd0a0') },
        uSunPower: { value: 1 },
        uSkyAmbient: { value: new Color('#8fa4cc') },
        uGroundAmbient: { value: new Color('#5a4b47') },
        uFogColor: { value: new Color('#c8a08c') },
        uFogDensity: { value: 0.006 },
        uContrast: { value: 0.6 },
        uLitLevel: { value: 0 },
        uWindowEmissive: { value: 0 },
        uBreath: { value: 0 },
        uBreathFront: { value: -400 },
        uWarm: { value: new Color('#ffc98a') },
        uBase: { value: new Color('#4c4b4e') },
      },
    })

    const geo = new BoxGeometry(1, 1, 1)
    this.buildings = new InstancedMesh(geo, this.townMat, count)
    this.buildings.frustumCulled = false
    const sizes = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const biases = new Float32Array(count)
    const dummy = new Object3D()
    const m = new Matrix4()
    placements.forEach((pl, i) => {
      dummy.position.copy(pl.p)
      dummy.rotation.set(0, pl.rot, 0)
      dummy.scale.copy(pl.s)
      dummy.updateMatrix()
      m.copy(dummy.matrix)
      this.buildings.setMatrixAt(i, m)
      sizes[i * 3] = pl.s.x
      sizes[i * 3 + 1] = pl.s.y
      sizes[i * 3 + 2] = pl.s.z
      seeds[i] = pl.seed
      biases[i] = pl.bias
    })
    this.buildings.instanceMatrix.needsUpdate = true
    geo.setAttribute('aSize', new InstancedBufferAttribute(sizes, 3))
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1))
    geo.setAttribute('aLitBias', new InstancedBufferAttribute(biases, 1))
    this.group.add(this.buildings)
  }

  private buildRoads(rig: LightRig): void {
    const roadMat = new MeshStandardMaterial({
      color: new Color('#3a3a3c'),
      roughness: 0.9,
      metalness: 0,
    })
    // Three roads threading the valley; each carries a strip of lamps.
    const roadDefs: { pts: Vector3[]; lamps: number }[] = []
    const mk = (fn: (t: number) => [number, number], n: number) => {
      const pts: Vector3[] = []
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const [x, z] = fn(t)
        pts.push(new Vector3(x, terrainHeight(x, z) + 0.4, z))
      }
      return pts
    }
    roadDefs.push({ pts: mk((t) => [-250 + t * 500, -152 - Math.sin(t * 3.1) * 24], 36), lamps: 24 })
    roadDefs.push({ pts: mk((t) => [-190 + t * 340, -250 + Math.sin(t * 2.2) * 18], 28), lamps: 20 })
    roadDefs.push({ pts: mk((t) => [26 + Math.sin(t * 1.6) * 40, -116 - t * 150], 22), lamps: 16 })

    const lampPts: Vector3[][] = [[], [], [], [], []]
    let strip = 0
    for (const rd of roadDefs) {
      for (let i = 0; i < rd.pts.length - 1; i++) {
        const a = rd.pts[i]
        const b = rd.pts[i + 1]
        const len = a.distanceTo(b)
        const seg = new Mesh(new PlaneGeometry(len * 1.06, 6.5), roadMat)
        seg.rotation.x = -Math.PI / 2
        seg.rotation.z = -Math.atan2(b.z - a.z, b.x - a.x)
        seg.position.copy(a).add(b).multiplyScalar(0.5)
        this.group.add(seg)
      }
      for (let i = 0; i < rd.lamps; i++) {
        const t = (i + 0.5) / rd.lamps
        const idx = Math.min(rd.pts.length - 1, Math.floor(t * (rd.pts.length - 1)))
        const p = rd.pts[idx].clone()
        p.y += 5.5
        p.x += (i % 2 === 0 ? 4.0 : -4.0)
        lampPts[strip % 5].push(p)
        strip++
      }
    }

    lampPts.forEach((pts, i) => {
      if (!pts.length) return
      const cluster = new LightCluster(pts, 6.0, new Color('#ffc07a'), this.group)
      this.clusters.push(cluster)
      rig.add({
        group: 'roads',
        index: i,
        position: pts[0],
        color: new Color('#ffc07a'),
        haloSize: 0,
        onLevel: (v) => cluster.setLevel(v * 0.85),
      })
    })
  }

  private buildTower(rig: LightRig): void {
    const M = materials()
    const x = 134
    const z = -206
    const gy = terrainHeight(x, z)
    const g = new Group()
    g.position.set(x, gy, z)
    this.group.add(g)

    const shaft = new Mesh(new CylinderGeometry(2.6, 4.8, 46, 12), M.concrete)
    shaft.position.y = 23
    g.add(shaft)
    const head = new Mesh(new CylinderGeometry(7, 5, 7, 12), M.concrete)
    head.position.y = 47.5
    g.add(head)
    const cap = new Mesh(new ConeGeometry(5.4, 8, 12), M.concrete)
    cap.position.y = 55
    g.add(cap)
    const mast = new Mesh(new CylinderGeometry(0.4, 0.55, 13, 6), M.steelGalv)
    mast.position.y = 65
    g.add(mast)

    this.beaconMat = new MeshBasicMaterial({
      map: makeGlowTexture(64, 2.0),
      color: new Color('#ff5a4a'),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0,
      fog: false,
    })
    this.beacon = new Mesh(new PlaneGeometry(15, 15), this.beaconMat)
    this.beacon.position.set(x, gy + 71, z)
    this.beacon.renderOrder = 9
    this.group.add(this.beacon)

    const ringPts: Vector3[] = []
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      ringPts.push(new Vector3(x + Math.cos(a) * 6.5, gy + 47.5, z + Math.sin(a) * 6.5))
    }
    const ring = new LightCluster(ringPts, 5, new Color('#ffd9a8'), this.group)
    this.clusters.push(ring)
    rig.add({
      group: 'tower',
      index: 0,
      position: new Vector3(x, gy + 47.5, z),
      color: new Color('#ffd9a8'),
      haloSize: 0,
      onLevel: (v) => {
        ring.setLevel(v * 0.9)
        this.beaconMat.userData.level = v
      },
    })
  }

  private buildHarbour(rig: LightRig): void {
    const M = materials()
    const clusters: Vector3[][] = [[], [], []]
    const rng = new Rng(4242)
    // three jetties reaching into the water, each with its own run of lamps
    for (let j = 0; j < 3; j++) {
      const bx = -78 + j * 80
      const bz = -286 - j * 6
      const len = 44 + j * 10
      const deck = new Mesh(new BoxGeometry(9, 1.4, len), M.wood)
      deck.position.set(bx, WATER_Y + 1.4, bz - len / 2)
      this.group.add(deck)
      for (let k = 0; k < 6; k++) {
        const pz = bz - (k / 5) * (len - 6) - 3
        const pile = new Mesh(new CylinderGeometry(0.8, 0.8, 7, 6), M.wood)
        pile.position.set(bx + (k % 2 ? 4 : -4), WATER_Y - 1.4, pz)
        this.group.add(pile)
        clusters[j].push(new Vector3(bx + (k % 2 ? 4.6 : -4.6), WATER_Y + 5.4, pz))
      }
      // a few moored hulls
      for (let b = 0; b < 3; b++) {
        const hull = new Mesh(new BoxGeometry(4, 2.2, 11), M.wood)
        hull.position.set(bx + rng.range(-16, 16), WATER_Y + 1, bz - rng.range(6, len))
        hull.rotation.y = rng.range(-0.4, 0.4)
        this.group.add(hull)
      }
    }
    clusters.forEach((pts, i) => {
      const c = new LightCluster(pts, 7, new Color('#ffe2b0'), this.group)
      this.clusters.push(c)
      rig.add({
        group: 'harbour',
        index: i,
        position: pts[0],
        color: new Color('#ffe2b0'),
        haloSize: 0,
        onLevel: (v) => c.setLevel(v * 0.95),
      })
    })
  }

  private buildRidges(rig: LightRig): void {
    // a switchback road, a farmhouse and a small shrine on the far hillsides
    const defs: { pts: Vector3[]; colour: string; size: number }[] = []
    const sw: Vector3[] = []
    for (let i = 0; i < 14; i++) {
      const t = i / 13
      const x = -228 + Math.sin(t * 6.2) * 30
      const z = -178 - t * 92
      sw.push(new Vector3(x, terrainHeight(x, z) + 5, z))
    }
    defs.push({ pts: sw, colour: '#ffcf95', size: 6 })

    const farm: Vector3[] = []
    for (let i = 0; i < 5; i++) {
      const x = 244 + (i % 3) * 9
      const z = -222 - Math.floor(i / 3) * 12
      farm.push(new Vector3(x, terrainHeight(x, z) + 6, z))
    }
    defs.push({ pts: farm, colour: '#ffdcae', size: 6.5 })

    const shrine: Vector3[] = []
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const x = -196 + Math.cos(a) * 10
      const z = -244 + Math.sin(a) * 10
      shrine.push(new Vector3(x, terrainHeight(x, z) + 7, z))
    }
    defs.push({ pts: shrine, colour: '#ffb98a', size: 6.5 })

    defs.forEach((d, i) => {
      const c = new LightCluster(d.pts, d.size, new Color(d.colour), this.group)
      this.clusters.push(c)
      rig.add({
        group: 'hills',
        index: i,
        position: d.pts[0],
        color: new Color(d.colour),
        haloSize: 0,
        onLevel: (v) => c.setLevel(v * 0.8),
      })
    })
  }

  private buildNearHouses(rig: LightRig): void {
    // Close enough down the slope to read as real houses with real windows.
    const spots: [number, number, number][] = [
      [-46, -86, 0.5],
      [30, -94, -0.35],
      [-14, -112, 0.15],
      [64, -120, 0.8],
    ]
    spots.forEach(([x, z, ry], i) => {
      const gy = terrainHeight(x, z)
      const g = new Group()
      g.position.set(x, gy, z)
      g.rotation.y = ry
      this.group.add(g)

      const w = 10
      const h = 7
      const d = 8.5
      const body = new Mesh(
        new BoxGeometry(w, h, d),
        new MeshStandardMaterial({ color: new Color('#8b8073'), roughness: 0.88, metalness: 0 }),
      )
      body.position.y = h / 2
      g.add(body)
      const roof = new Mesh(
        new ConeGeometry(w * 0.82, 3.4, 4),
        new MeshStandardMaterial({ color: new Color('#4a3b34'), roughness: 0.85, metalness: 0 }),
      )
      roof.position.y = h + 1.6
      roof.rotation.y = Math.PI / 4
      g.add(roof)

      const glass = new MeshStandardMaterial({
        color: new Color('#2a2823'),
        emissive: new Color('#ffcf90'),
        emissiveIntensity: 0,
        roughness: 0.25,
        metalness: 0,
        side: DoubleSide,
      })
      this.nearHouseGlass.push(glass)
      for (const [wx, wy, wz, ry2] of [
        [0, 3.6, d / 2 + 0.05, 0],
        [-2.9, 3.6, d / 2 + 0.05, 0],
        [2.9, 3.6, d / 2 + 0.05, 0],
        [w / 2 + 0.05, 3.4, 1.4, Math.PI / 2],
      ] as [number, number, number, number][]) {
        const win = new Mesh(new PlaneGeometry(1.9, 1.7), glass)
        win.position.set(wx, wy, wz)
        win.rotation.y = ry2
        g.add(win)
      }
      // porch lamp over the door
      const porch = new Mesh(new BoxGeometry(0.6, 0.5, 0.4), glass)
      porch.position.set(0, 5.4, d / 2 + 0.3)
      g.add(porch)

      rig.add({
        group: 'nearHouses',
        index: i,
        position: new Vector3(x, gy + 5.4, z + d / 2 + 0.4),
        color: new Color('#ffcf90'),
        glass,
        haloSize: 6.5,
        poolRadius: 0,
      })
    })
  }

  // ------------------------------------------------------------- behaviour

  triggerBreath(): void {
    this.breathActive = 1
    this.breathFront = -320
  }

  update(
    dt: number,
    L: LightingState,
    camera: Object3D,
    litFraction: number,
    breathPulse: number,
  ): void {
    this.time += dt

    // town window level rises with how much of the world the child has woken
    this.litLevel = damp(this.litLevel, clamp(litFraction * 1.05), 0.9, dt)

    if (this.breathActive > 0) {
      this.breathFront += dt * 420
      if (this.breathFront > 420) this.breathActive = 0
    }

    const setCommon = (u: Record<string, { value: unknown }>) => {
      ;(u.uSunDir.value as Vector3).copy(L.sunDir)
      ;(u.uSunColor.value as Color).copy(L.warmBand)
      u.uSunPower.value = L.sunIntensity * 0.45 + L.moonIntensity * 0.2
      ;(u.uSkyAmbient.value as Color).copy(L.ambientSky)
      ;(u.uGroundAmbient.value as Color).copy(L.ambientGround)
      ;(u.uFogColor.value as Color).copy(L.fogColor)
      u.uFogDensity.value = L.fogDensity
      u.uContrast.value = L.distantContrast
    }
    setCommon(this.townMat.uniforms)
    setCommon(this.terrainMat.uniforms)

    this.townMat.uniforms.uLitLevel.value = this.litLevel
    this.townMat.uniforms.uWindowEmissive.value = L.windowEmissive
    this.townMat.uniforms.uBreath.value = breathPulse
    this.townMat.uniforms.uBreathFront.value = this.breathFront
    ;(this.townMat.uniforms.uWarm.value as Color).setHex(0xffc98a)

    const w = this.waterMat.uniforms
    ;(w.uDeep.value as Color).copy(L.zenith).multiplyScalar(0.45)
    ;(w.uSky.value as Color).copy(L.horizon).lerp(L.zenith, 0.35)
    ;(w.uFogColor.value as Color).copy(L.fogColor)
    ;(w.uWarm.value as Color).copy(L.warmBand)
    w.uWarmStrength.value = L.warmStrength
    w.uFogDensity.value = L.fogDensity
    w.uTime.value = this.time
    ;(w.uMoonDir.value as Vector3).copy(L.moonDir)
    w.uMoonGlow.value = L.moonGlow * (0.3 + L.starVisibility * 0.7)

    for (const c of this.clusters) c.face(camera)

    // aircraft warning beacon: a slow, quiet blink once the tower is alive
    const lvl = (this.beaconMat.userData.level as number) ?? 0
    const blink = Math.max(0, Math.sin(this.time * 1.15)) ** 8
    this.beaconMat.opacity = lvl * blink * 0.85
    this.beacon.quaternion.copy(camera.quaternion)

    for (const g of this.nearHouseGlass) {
      g.emissiveIntensity = Math.min(g.emissiveIntensity, 3.2)
    }
  }
}
