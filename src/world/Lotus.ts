import * as THREE from 'three'
import { noiseTexture } from './noise'
import { NOISE_GLSL, MURK_GLSL } from './shaders'

export type LotusSpec = {
  /** number of swollen joints (節) */
  nodes: number
  /** world position of the first joint's start, on the bed plane */
  origin: THREE.Vector3
  /** heading in radians on the XZ plane */
  heading: number
  /** per-joint heading change; the root is never straight */
  curve: number
  /** how far the crown of the root sits below the mud surface, metres */
  depth: number
  /** joint thickness scale */
  radius: number
  /** a side shoot off one of the middle joints */
  branch: boolean
  /** how much clay film clings to the surface, 0..1 */
  dirt: number
  seed: number
}

export type LotusSample = {
  pos: THREE.Vector3
  radius: number
  node: number
  s: number
}

const RADIAL = 14

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** thickness profile inside one joint: fat middle, narrow neck at both ends */
function jointProfile(p: number) {
  const bump = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, p))), 0.42)
  return 0.5 + 0.5 * bump
}

type Chain = {
  points: THREE.Vector3[]
  nodeOf: number[]
  lengths: number[]
}

function buildChain(spec: LotusSpec): Chain {
  const r = rng(spec.seed)
  const points: THREE.Vector3[] = []
  const nodeOf: number[] = []
  const lengths: number[] = []
  let heading = spec.heading
  let pos = spec.origin.clone()
  const perJoint = 9
  for (let n = 0; n < spec.nodes; n++) {
    const len = 0.105 + r() * 0.06 + (n === 0 ? 0.01 : 0)
    lengths.push(len)
    heading += spec.curve * (0.6 + r() * 0.8) * (n === 0 ? 0.5 : 1)
    // joints in the middle of the chain sit deepest, the tips rise toward the bed
    for (let i = 0; i < perJoint; i++) {
      const p = i / perJoint
      const t = (n + p) / spec.nodes
      const sink = Math.sin(Math.PI * t) * 0.06
      const step = len / perJoint
      pos = pos.clone()
      pos.x += Math.cos(heading + (p - 0.5) * spec.curve) * step
      pos.z += Math.sin(heading + (p - 0.5) * spec.curve) * step
      pos.y = spec.origin.y - spec.depth - sink + Math.sin(t * 7.0 + spec.seed) * 0.012
      points.push(pos.clone())
      nodeOf.push(n)
    }
  }
  points.push(pos.clone())
  nodeOf.push(spec.nodes - 1)
  return { points, nodeOf, lengths }
}

export type LotusBuild = {
  geometry: THREE.BufferGeometry
  samples: LotusSample[]
  nodeCenters: LotusSample[]
  totalLength: number
  bbox: THREE.Box3
}

export function buildLotusGeometry(spec: LotusSpec): LotusBuild {
  const chain = buildChain(spec)
  const curve = new THREE.CatmullRomCurve3(chain.points, false, 'catmullrom', 0.5)
  const totalLength = curve.getLength()
  const r = rng(spec.seed + 7)

  const jointScale: number[] = []
  for (let i = 0; i < spec.nodes; i++) jointScale.push(0.88 + r() * 0.26)

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const aS: number[] = []
  const aRoot: number[] = []
  const indices: number[] = []

  /** Appends one jointed tube. Rings are shared topology; joints come from the
   *  radius profile, so the seams between joints are impossible to see. */
  function emitTube(
    c: THREE.CatmullRomCurve3,
    N: number,
    radiusAt: (u: number) => number,
    sAt: (u: number) => number,
    caps: [boolean, boolean],
  ) {
    const frames = c.computeFrenetFrames(N, false)
    const ringStart: number[] = []
    const pts: THREE.Vector3[] = []
    const radii: number[] = []
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const p = c.getPointAt(u)
      const Nn = frames.normals[Math.min(i, N - 1)]
      const B = frames.binormals[Math.min(i, N - 1)]
      const rad = radiusAt(u)
      pts.push(p)
      radii.push(rad)
      ringStart.push(positions.length / 3)
      for (let k = 0; k < RADIAL; k++) {
        const a = (k / RADIAL) * Math.PI * 2
        const lobe = 1 + 0.035 * Math.sin(3 * a + u * 9.0 + spec.seed) + 0.022 * Math.sin(5 * a - u * 5.0)
        const rr = rad * lobe
        const dir = new THREE.Vector3().addScaledVector(Nn, Math.cos(a)).addScaledVector(B, Math.sin(a))
        const v = p.clone().addScaledVector(dir, rr)
        positions.push(v.x, v.y, v.z)
        normals.push(dir.x, dir.y, dir.z)
        uvs.push(k / RADIAL, u)
        aS.push(sAt(u))
        aRoot.push(0)
      }
    }
    for (let i = 0; i < N; i++) {
      const a = ringStart[i]
      const b = ringStart[i + 1]
      for (let k = 0; k < RADIAL; k++) {
        const k2 = (k + 1) % RADIAL
        indices.push(a + k, b + k, a + k2)
        indices.push(a + k2, b + k, b + k2)
      }
    }
    for (const [end, on] of [[0, caps[0]], [N, caps[1]]] as [number, boolean][]) {
      if (!on) continue
      const flip = end === 0
      const p = pts[end]
      const center = positions.length / 3
      const T = frames.tangents[Math.min(end, N - 1)]
      positions.push(p.x, p.y, p.z)
      normals.push(T.x * (flip ? -1 : 1), T.y * (flip ? -1 : 1), T.z * (flip ? -1 : 1))
      uvs.push(0.5, end / N)
      aS.push(sAt(end / N))
      aRoot.push(0)
      const base = ringStart[end]
      for (let k = 0; k < RADIAL; k++) {
        const k2 = (k + 1) % RADIAL
        if (flip) indices.push(center, base + k2, base + k)
        else indices.push(center, base + k, base + k2)
      }
    }
    return { pts, radii, frames }
  }

  const N = spec.nodes * 22
  const mainRadius = (u: number) => {
    const fs = u * spec.nodes
    const nodeIdx = Math.min(spec.nodes - 1, Math.floor(fs))
    const inNode = fs - nodeIdx
    let rad = spec.radius * jointScale[nodeIdx] * jointProfile(inNode)
    const endTaper = Math.min(1, Math.min(u, 1 - u) * spec.nodes * 1.7 + 0.22)
    rad *= 0.55 + 0.45 * endTaper
    if (u > 0.985) rad *= 0.35
    if (u < 0.015) rad *= 0.6
    return rad
  }
  const main = emitTube(curve, N, mainRadius, (u) => u, [true, true])

  const samples: LotusSample[] = []
  for (let i = 0; i <= N; i++) {
    const u = i / N
    samples.push({
      pos: main.pts[i].clone(),
      radius: main.radii[i],
      node: Math.min(spec.nodes - 1, Math.floor(u * spec.nodes)),
      s: u,
    })
  }
  const nodeCenters: LotusSample[] = []
  for (let n = 0; n < spec.nodes; n++) {
    const u = (n + 0.5) / spec.nodes
    nodeCenters.push(samples[Math.min(N, Math.round(u * N))])
  }

  // ---- side shoot off a middle joint
  if (spec.branch && spec.nodes >= 4) {
    const attachU = (Math.floor(spec.nodes / 2) + 0.5) / spec.nodes
    const idx = Math.round(attachU * N)
    const base = main.pts[idx].clone()
    const tan = main.frames.tangents[Math.min(idx, N - 1)].clone()
    const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize()
    const dir = tan.clone().multiplyScalar(0.45).addScaledVector(side, r() > 0.5 ? 0.9 : -0.9).normalize()
    const bp: THREE.Vector3[] = []
    let p = base.clone()
    for (let i = 0; i <= 14; i++) {
      bp.push(p.clone())
      p = p.clone().addScaledVector(dir, 0.018)
      p.y -= 0.004
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.06).normalize()
    }
    const bc = new THREE.CatmullRomCurve3(bp, false, 'catmullrom', 0.5)
    const bRad = spec.radius * 0.72
    emitTube(
      bc,
      30,
      (u) => bRad * jointProfile(Math.min(1, u * 2)) * (u > 0.94 ? 0.4 : 1) * (0.55 + 0.45 * Math.min(1, (1 - u) * 4)),
      (u) => Math.min(0.999, attachU + u * 0.06),
      [false, true],
    )
  }

  // ---- fine roots at the constrictions, drooping into the clay
  const addRoot = (origin: THREE.Vector3, dir: THREE.Vector3, len: number, s: number) => {
    const segs = 5
    const rad0 = 0.0022
    const start = positions.length / 3
    const up = new THREE.Vector3(0, 1, 0)
    const sideV = new THREE.Vector3().crossVectors(dir, up).normalize()
    if (sideV.lengthSq() < 1e-6) sideV.set(1, 0, 0)
    const nrm = new THREE.Vector3().crossVectors(sideV, dir).normalize()
    for (let i = 0; i <= segs; i++) {
      const f = i / segs
      const c = origin.clone().addScaledVector(dir, f * len)
      c.y -= f * f * len * 0.75
      c.x += Math.sin(f * 6.0 + s * 20.0) * 0.006
      const rr = rad0 * (1 - f * 0.85)
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2
        const d = sideV.clone().multiplyScalar(Math.cos(a)).addScaledVector(nrm, Math.sin(a))
        const v = c.clone().addScaledVector(d, rr)
        positions.push(v.x, v.y, v.z)
        normals.push(d.x, d.y, d.z)
        uvs.push(k / 4, f)
        aS.push(s)
        aRoot.push(1)
      }
    }
    for (let i = 0; i < segs; i++) {
      const a = start + i * 4
      const b = start + (i + 1) * 4
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4
        indices.push(a + k, b + k, a + k2)
        indices.push(a + k2, b + k, b + k2)
      }
    }
  }

  for (let n = 1; n < spec.nodes; n++) {
    const u = n / spec.nodes
    const p = samples[Math.min(samples.length - 1, Math.round(u * N))].pos
    const count = 3 + Math.floor(r() * 3)
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2
      const dir = new THREE.Vector3(Math.cos(a) * 0.85, -0.5 - r() * 0.5, Math.sin(a) * 0.85).normalize()
      addRoot(p.clone(), dir, 0.05 + r() * 0.07, u)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1))
  geometry.setAttribute('aRoot', new THREE.Float32BufferAttribute(aRoot, 1))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  const bbox = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute)

  return { geometry, samples, nodeCenters, totalLength, bbox }
}

export const PROFILE_SIZE = 64

/**
 * The renkon material. Two surfaces really: clay-filmed and water-washed.
 * The profile texture carries per-length dirt / wetness / exposure so washing
 * and uncovering are visible along the body rather than as a global switch.
 */
export function makeLotusMaterial(murkColor: THREE.Color) {
  const profileData = new Uint8Array(PROFILE_SIZE * 4)
  for (let i = 0; i < PROFILE_SIZE; i++) {
    profileData[i * 4 + 0] = 0
    profileData[i * 4 + 1] = 255
    profileData[i * 4 + 2] = 200
    profileData[i * 4 + 3] = 255
  }
  const profile = new THREE.DataTexture(profileData, PROFILE_SIZE, 1, THREE.RGBAFormat)
  profile.minFilter = THREE.LinearFilter
  profile.magFilter = THREE.LinearFilter
  profile.wrapS = THREE.ClampToEdgeWrapping
  profile.needsUpdate = true

  const uniforms = {
    uNoise: { value: noiseTexture() },
    uProfile: { value: profile },
    uMurkColor: { value: murkColor.clone() },
    uWaterY: { value: 0 },
    uLift: { value: 0 },
    uGrabS: { value: 0.5 },
    uRise: { value: 0 },
    uDrift: { value: new THREE.Vector3() },
    uSeed: { value: 0 },
    uNodes: { value: 4 },
    uAboveWater: { value: 0 },
  }

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.0,
  })
  mat.customProgramCacheKey = () => 'renkon'

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute float aS;
        attribute float aRoot;
        uniform sampler2D uProfile;
        uniform float uLift;
        uniform float uGrabS;
        uniform float uRise;
        uniform vec3 uDrift;
        varying float vS;
        varying float vRoot;
        varying vec3 vWorldPos;
        varying vec3 vObjPos;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        vS = aS;
        vRoot = aRoot;
        vObjPos = position;
        float delay = abs(aS - uGrabS) * 0.62;
        float k = smoothstep(delay, delay + 0.42, uLift);
        transformed.y += uRise * k;
        transformed += uDrift * k;
        `,
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed,1.0)).xyz;
        `,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        ${NOISE_GLSL}
        ${MURK_GLSL}
        uniform sampler2D uProfile;
        uniform float uSeed;
        uniform float uNodes;
        uniform float uAboveWater;
        varying float vS;
        varying float vRoot;
        varying vec3 vWorldPos;
        varying vec3 vObjPos;
        `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec4 prof = texture2D(uProfile, vec2(clamp(vS,0.002,0.998), 0.5));
        float dirt = prof.g;

        // triplanar-ish grain so the surface never reads as symmetric plastic
        vec2 pA = vObjPos.xz * 34.0 + uSeed;
        vec2 pB = vec2(vObjPos.y, vObjPos.x) * 41.0 - uSeed;
        float grain = fbm(pA) * 0.55 + fbm(pB) * 0.45;
        float fine = fbm(pA * 5.3) ;

        vec3 flesh = vec3(0.885, 0.836, 0.706);
        flesh *= 0.90 + 0.16 * grain;
        // faint longitudinal streaks and scuffs
        flesh -= vec3(0.055,0.05,0.042) * smoothstep(0.55,0.95, fbm(vec2(vObjPos.y*90.0, vS*70.0)));
        // darker collars where the joints pinch
        float collar = pow(abs(sin(vS * 3.14159 * uNodes)), 6.0);
        flesh = mix(flesh, vec3(0.62,0.55,0.44), collar * 0.35);
        // root scars
        float scars = smoothstep(0.72, 0.95, fbm(pA*2.1 + 7.0));
        flesh = mix(flesh, vec3(0.50,0.43,0.34), scars*0.30*collar);

        vec3 clay = vec3(0.246, 0.208, 0.156) * (0.75 + 0.5*fine);
        float cling = clamp(dirt * (0.35 + 0.85 * fbm(pA*1.4 + 3.0)), 0.0, 1.0);
        cling = smoothstep(0.06, 0.75, cling);
        vec3 base = mix(flesh, clay, cling);
        base = mix(base, vec3(0.30,0.26,0.20)*(0.7+0.6*fine), vRoot*0.92);
        diffuseColor.rgb *= base;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `float roughnessFactor = roughness;
        {
          vec4 prof2 = texture2D(uProfile, vec2(clamp(vS,0.002,0.998), 0.5));
          float dirt2 = prof2.g;
          float wet2 = prof2.b;
          float rq = mix(0.30, 0.80, dirt2);
          roughnessFactor = mix(rq, rq*0.42 + 0.08, wet2);
          roughnessFactor = clamp(roughnessFactor + (fbm(vObjPos.xz*70.0)-0.5)*0.08, 0.06, 0.95);
        }
        `,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          vec4 prof3 = texture2D(uProfile, vec2(clamp(vS,0.002,0.998), 0.5));
          float clean = prof3.r;
          float m = murkAmount(vWorldPos, clean, 0.0) * (1.0 - uAboveWater);
          outgoingLight = mix(outgoingLight, uMurkColor, m);
        }
        #include <opaque_fragment>`,
      )
  }

  return { material: mat, uniforms, profile, profileData }
}
