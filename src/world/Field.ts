import * as THREE from 'three'
import { noiseTexture } from './noise'
import { applyMurk } from './murk'
import { NOISE_GLSL } from './shaders'

function srand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * Everything past the working area: the wide paddy, the bunds, the pump and
 * truck on the bank, a low farmhouse, a treeline. Distance is carried by
 * saturation, contrast and detail density plus fog — not by defocus.
 */
export class Field {
  group = new THREE.Group()
  private leaves: THREE.InstancedMesh
  private stubs: THREE.InstancedMesh
  private leafCount: number
  private stubCount: number
  pumpPos = new THREE.Vector3(-7.5, 0.02, -9.0)
  private pump!: THREE.Group
  /** rectangles cut out of the paddy floor so each dug plot can sink into it */
  private holes: THREE.Vector4[] = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0))

  constructor(bedY: number, murkColor: THREE.Color) {
    const r = srand(20260820)

    // ---- the mud floor of the whole paddy
    const bedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 })
    bedMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNoise = { value: noiseTexture() }
      sh.uniforms.uHoles = { value: this.holes }
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nuniform vec4 uHoles[6];\nvarying vec3 vFieldW;`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // a dug plot owns its own patch of floor; the flat paddy must not
           // cover the crater the player just cut
           for(int hi = 0; hi < 6; hi++){
             vec4 h = uHoles[hi];
             if(h.w > 0.5 && abs(vFieldW.x - h.x) < h.z && abs(vFieldW.z - h.y) < h.z) discard;
           }
           float n = fbm(vFieldW.xz*2.2);
           float n2 = fbm(vFieldW.xz*13.0);
           // the finest grain is faded out with distance so the far paddy does
           // not shimmer; aerial perspective, not defocus
           float near = 1.0 - smoothstep(6.0, 26.0, length(vFieldW - cameraPosition));
           float n3 = fbm(vFieldW.xz*46.0);
           vec3 c = mix(vec3(0.185,0.170,0.135), vec3(0.135,0.135,0.105), n);
           c *= 0.82 + 0.34*n2;
           c *= 1.0 + (n3 - 0.5) * 0.32 * near;
           diffuseColor.rgb *= c;`,
        )
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFieldW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFieldW = (modelMatrix*vec4(transformed,1.0)).xyz;')
    }
    bedMat.customProgramCacheKey = () => 'fieldbed'
    applyMurk(bedMat, murkColor, 0)
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 1, 1), bedMat)
    bed.rotation.x = -Math.PI / 2
    bed.position.y = bedY
    bed.receiveShadow = true
    this.group.add(bed)

    // ---- bunds dividing the paddies
    const earth = new THREE.MeshStandardMaterial({ color: 0x6a6350, roughness: 0.95 })
    const grass = new THREE.MeshStandardMaterial({ color: 0x6d6f4e, roughness: 0.95 })
    const bunds = new THREE.Group()
    const addBund = (x: number, z: number, w: number, d: number) => {
      const h = 0.34
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), earth)
      m.position.set(x, h / 2 - 0.06, z)
      m.receiveShadow = true
      m.castShadow = true
      bunds.add(m)
      const g = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.05, d * 0.85), grass)
      g.position.set(x, h - 0.06, z)
      bunds.add(g)
    }
    addBund(0, -13.5, 120, 1.5)
    addBund(0, 15.5, 120, 1.6)
    addBund(-16.5, 0, 1.4, 60)
    addBund(19.5, 2, 1.4, 60)
    addBund(0, -34, 160, 1.8)
    addBund(0, 34, 160, 1.8)
    this.group.add(bunds)

    // ---- cut petiole stubs across the whole paddy: the field reads as harvested
    this.stubCount = 2600
    const stubGeo = new THREE.CylinderGeometry(0.006, 0.009, 0.26, 4, 1)
    stubGeo.translate(0, 0.13, 0)
    const stubMat = new THREE.MeshStandardMaterial({ color: 0x585637, roughness: 0.85 })
    applyMurk(stubMat, murkColor, 0.05)
    this.stubs = new THREE.InstancedMesh(stubGeo, stubMat, this.stubCount)
    this.stubs.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const sc = new THREE.Vector3()
    const pv = new THREE.Vector3()
    for (let i = 0; i < this.stubCount; i++) {
      let x = 0
      let z = 0
      for (let tries = 0; tries < 8; tries++) {
        x = (r() - 0.5) * 62
        z = (r() - 0.5) * 58
        if (Math.hypot(x - 1.0, z - 1.6) > 6.6) break
      }
      pv.set(x, -0.16 - r() * 0.06, z)
      e.set((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5)
      q.setFromEuler(e)
      sc.set(1, 0.6 + r() * 0.9, 1)
      m4.compose(pv, q, sc)
      this.stubs.setMatrixAt(i, m4)
    }
    this.stubs.instanceMatrix.needsUpdate = true
    this.stubs.frustumCulled = false
    this.group.add(this.stubs)

    // ---- the last standing leaves, big and browning
    this.leafCount = 170
    const leafGeo = new THREE.CircleGeometry(0.34, 10)
    leafGeo.rotateX(-Math.PI / 2)
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x7d7a4e,
      roughness: 0.88,
      side: THREE.DoubleSide,
    })
    leafMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNoise = { value: noiseTexture() }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vLeafUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeafUv = uv;\ntransformed.y += (0.5 - length(uv-0.5))*0.16;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nvarying vec2 vLeafUv;`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float rr = length(vLeafUv-0.5)*2.0;
           float wither = smoothstep(0.45,1.0,rr) * (0.5+0.6*fbm(vLeafUv*14.0));
           diffuseColor.rgb *= mix(vec3(0.36,0.38,0.24), vec3(0.42,0.32,0.19), clamp(wither,0.0,1.0));`,
        )
    }
    leafMat.customProgramCacheKey = () => 'leaf'
    this.leaves = new THREE.InstancedMesh(leafGeo, leafMat, this.leafCount)
    for (let i = 0; i < this.leafCount; i++) {
      let x = 0
      let z = 0
      for (let tries = 0; tries < 8; tries++) {
        x = (r() - 0.5) * 58
        z = (r() - 0.5) * 54
        if (Math.hypot(x - 1.0, z - 1.6) > 3.6) break
      }
      const h = 0.25 + r() * 0.75
      pv.set(x, h, z)
      e.set((r() - 0.5) * 0.8, r() * 6.28, (r() - 0.5) * 0.8)
      q.setFromEuler(e)
      const s = 0.6 + r() * 0.85
      sc.set(s, s, s)
      m4.compose(pv, q, sc)
      this.leaves.setMatrixAt(i, m4)
    }
    this.leaves.instanceMatrix.needsUpdate = true
    this.leaves.frustumCulled = false
    this.group.add(this.leaves)

    // stems for the standing leaves (cheap: one instanced thin cylinder set)
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.016, 1, 4, 1)
    stemGeo.translate(0, 0.5, 0)
    const stems = new THREE.InstancedMesh(stemGeo, stubMat, this.leafCount)
    for (let i = 0; i < this.leafCount; i++) {
      this.leaves.getMatrixAt(i, m4)
      m4.decompose(pv, q, sc)
      const h = pv.y + 0.2
      const base = new THREE.Vector3(pv.x, -0.2, pv.z)
      m4.compose(base, new THREE.Quaternion(), new THREE.Vector3(1, h, 1))
      stems.setMatrixAt(i, m4)
    }
    stems.instanceMatrix.needsUpdate = true
    stems.frustumCulled = false
    this.group.add(stems)

    // ---- pump on the bund, the source of the hose
    const metal = new THREE.MeshStandardMaterial({ color: 0x8b3f34, roughness: 0.55, metalness: 0.35 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x3c3f42, roughness: 0.6, metalness: 0.4 })
    const pump = new THREE.Group()
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.4), metal)
    engine.position.y = 0.32
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.3, 14), dark)
    drum.rotation.z = Math.PI / 2
    drum.position.set(0.32, 0.22, 0)
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), dark)
    skid.position.y = 0.06
    engine.castShadow = drum.castShadow = skid.castShadow = true
    pump.add(engine, drum, skid)
    const raft = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 0.8), new THREE.MeshStandardMaterial({ color: 0x6f6a5c, roughness: 0.9 }))
    raft.position.y = -0.02
    pump.add(raft)
    pump.position.copy(this.pumpPos).setY(0.02)
    pump.rotation.y = 0.6
    this.pump = pump
    this.group.add(pump)

    // ---- kei truck parked on the far bund
    const truck = new THREE.Group()
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcfd2cd, roughness: 0.55, metalness: 0.15 })
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x2b3338, roughness: 0.25, metalness: 0.5 })
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.45), bodyMat)
    cab.position.set(-0.7, 0.95, 0)
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.3), glassMat)
    glass.position.set(-1.38, 1.15, 0)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 1.45), bodyMat)
    deck.position.set(0.75, 0.72, 0)
    for (const [x, z] of [
      [-0.75, 0.7],
      [-0.75, -0.7],
      [0.95, 0.7],
      [0.95, -0.7],
    ]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.16, 10), dark)
      w.rotation.x = Math.PI / 2
      w.position.set(x, 0.3, z)
      truck.add(w)
    }
    cab.castShadow = deck.castShadow = true
    truck.add(cab, glass, deck)
    truck.position.set(4.5, 0.12, -13.4)
    truck.rotation.y = 0.08
    this.group.add(truck)

    // ---- low farmhouse and sheds beyond the bund
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xbdb9ac, roughness: 0.92 })
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4c50, roughness: 0.85 })
    const house = new THREE.Group()
    const hb = new THREE.Mesh(new THREE.BoxGeometry(11, 3.1, 6.5), wallMat)
    hb.position.y = 1.55
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.6, 1.9, 4), roofMat)
    roof.position.y = 4.0
    roof.rotation.y = Math.PI / 4
    roof.scale.set(1, 1, 0.62)
    house.add(hb, roof)
    house.position.set(-16, 0.2, -30)
    house.rotation.y = 0.25
    this.group.add(house)
    const shed = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 4), new THREE.MeshStandardMaterial({ color: 0x8d8d84, roughness: 0.9 }))
    shed.position.set(-6, 1.2, -33)
    this.group.add(shed)

    // ---- treeline, dark and low contrast in the haze
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x4a5346, roughness: 1.0 })
    const treeGeo = new THREE.SphereGeometry(1, 7, 5)
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, 90)
    for (let i = 0; i < 90; i++) {
      const a = -Math.PI * 0.15 + r() * Math.PI * 1.5
      const rad = 52 + r() * 34
      const s = 2.6 + r() * 3.4
      pv.set(Math.sin(a) * rad, s * 0.55, -Math.abs(Math.cos(a)) * rad - 6)
      q.setFromEuler(e.set(0, r() * 6.28, 0))
      sc.set(s * (0.7 + r() * 0.5), s, s * (0.7 + r() * 0.5))
      m4.compose(pv, q, sc)
      trees.setMatrixAt(i, m4)
    }
    trees.instanceMatrix.needsUpdate = true
    this.group.add(trees)
  }

  /** the pump follows the worker around the paddy so the hose never crosses the dig */
  setPumpPosition(p: THREE.Vector3) {
    this.pumpPos.lerp(p, 0.05)
    this.pump.position.set(this.pumpPos.x, 0.02, this.pumpPos.z)
    this.pump.rotation.y = Math.atan2(-this.pumpPos.x, -this.pumpPos.z) + 0.4
  }

  /** tell the paddy floor which plot rectangles to leave open */
  setHoles(list: { x: number; z: number; half: number }[]) {
    for (let i = 0; i < this.holes.length; i++) {
      const h = list[i]
      if (h) this.holes[i].set(h.x, h.z, h.half, 1)
      else this.holes[i].set(0, 0, 0, 0)
    }
  }

  setDensity(d: number) {
    this.leaves.count = Math.max(10, Math.round(this.leafCount * d))
    this.stubs.count = Math.max(200, Math.round(this.stubCount * d))
  }
}
