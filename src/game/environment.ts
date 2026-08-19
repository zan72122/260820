import * as THREE from 'three'
import { MeshBuilder, put } from './geom'
import { Rng } from './rng'
import { COLORS, FIELD_L, FIELD_W, HALF_W, PADDY_HALF_L, SUN_DIR } from './config'
import { LEVEE_OUT, LEVEE_TOP, PADDY_EDGE } from './terrain'

/* ------------------------------------------------------------------ *
 * Everything around the paddy: sky, sun, levees, neighbouring plots,
 * the village, the tree line and the mountains.  The layers are placed
 * deliberately so foreground / middle / far distance read apart.
 * ------------------------------------------------------------------ */

export const ROAD_X = HALF_W + 3.6

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s)

function sunVector(): THREE.Vector3 {
  const { azimuth, elevation } = SUN_DIR
  return new THREE.Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  ).normalize()
}

function skyDome(sunDir: THREE.Vector3): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: sunDir },
      uZenith: { value: new THREE.Color(0x3f79bd) },
      uHorizon: { value: new THREE.Color(0xd7dcc9) },
      uGround: { value: new THREE.Color(0xb6b7a0) },
      uSunColor: { value: new THREE.Color(0xfff3d6) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize( position );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSun, uZenith, uHorizon, uGround, uSunColor;
      void main() {
        vec3 d = normalize( vDir );
        float h = d.y;
        vec3 col = mix( uHorizon, uZenith, pow( clamp( h, 0.0, 1.0 ), 0.48 ) );
        col = mix( col, uGround, smoothstep( 0.0, -0.16, h ) );
        float s = max( dot( d, normalize( uSun ) ), 0.0 );
        col += uSunColor * pow( s, 900.0 ) * 2.2;
        col += uSunColor * pow( s, 7.0 ) * 0.20;
        col += uSunColor * pow( s, 2.0 ) * 0.05;
        gl_FragColor = vec4( col, 1.0 );
        #include <colorspace_fragment>
      }`,
  })
  const m = new THREE.Mesh(new THREE.SphereGeometry(760, 24, 16), mat)
  m.frustumCulled = false
  m.renderOrder = -1000
  return m
}

/** A folded curtain of ridges: peaks sit at different depths so the silhouette overlaps. */
function ridgeLayer(radius: number, height: number, base: number, color: number, seed: number): THREE.Mesh {
  const rng = new Rng(seed)
  const n = 120
  const b = new MeshBuilder()
  const c = new THREE.Color(color)
  const cTop = c.clone().lerp(new THREE.Color(0xffffff), 0.14)
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const idx: number[] = []
  let h1 = height * 0.5
  let h2 = height * 0.7
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    h1 += rng.gauss() * height * 0.22
    h2 += rng.gauss() * height * 0.1
    h1 = Math.max(height * 0.18, Math.min(height * 1.25, h1 * 0.86 + h2 * 0.14))
    const r = radius * (1 + rng.gauss() * 0.06)
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    pos.push(x, base, z, x, base + h1, z)
    nor.push(0, 0.3, 0, 0, 1, 0)
    col.push(c.r * 0.86, c.g * 0.86, c.b * 0.86, cTop.r, cTop.g, cTop.b)
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  const m = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }),
  )
  m.frustumCulled = false
  void b
  return m
}

/** Broadleaf tree: a trunk with a few overlapping foliage lumps. */
function treeGeometry(rng: Rng, scale: number, autumn: number): THREE.BufferGeometry {
  const b = new MeshBuilder()
  const trunk = new THREE.Color(0x4d4034)
  const h = scale * rng.range(0.85, 1.15)
  put(b, cyl(0.09 * scale, 0.16 * scale, h, 6), trunk, [0, h / 2, 0])
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, 6.28)
    put(
      b,
      cyl(0.03 * scale, 0.06 * scale, h * 0.45, 5),
      trunk,
      [Math.cos(a) * 0.12 * scale, h * 0.82, Math.sin(a) * 0.12 * scale],
      [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5],
    )
  }
  const green = new THREE.Color(0x3d5a2c)
  const gold = new THREE.Color(0x8a7331)
  const lumps = 5
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * 6.28 + rng.range(-0.4, 0.4)
    const r = rng.range(0.3, 0.62) * scale
    const d = i === 0 ? 0 : rng.range(0.3, 0.62) * scale
    const c = green.clone().lerp(gold, autumn * rng.range(0.35, 1)).multiplyScalar(rng.range(0.82, 1.12))
    put(
      b,
      new THREE.IcosahedronGeometry(r, 0),
      c,
      [Math.cos(a) * d, h + rng.range(0.0, 0.45) * scale, Math.sin(a) * d],
      [rng.range(0, 3), rng.range(0, 3), 0],
      [1, 0.86, 1],
    )
  }
  return b.build()
}

export interface EnvHandles {
  group: THREE.Group
  sun: THREE.DirectionalLight
  update(dt: number, focus: THREE.Vector3): void
  dispose(): void
}

export function buildEnvironment(scene: THREE.Scene, cloudTex: THREE.Texture, grassTex: THREE.Texture): EnvHandles {
  const group = new THREE.Group()
  const rng = new Rng(20260819)
  const sunDir = sunVector()

  scene.fog = new THREE.Fog(COLORS.fog, 42, 560)
  scene.background = null
  group.add(skyDome(sunDir))

  /* ------------------------------ light ----------------------------- */
  const sun = new THREE.DirectionalLight(0xfff2d4, 3.1)
  sun.position.copy(sunDir).multiplyScalar(40)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 90
  const S = 11
  sun.shadow.camera.left = -S
  sun.shadow.camera.right = S
  sun.shadow.camera.top = S
  sun.shadow.camera.bottom = -S
  sun.shadow.bias = -0.0012
  sun.shadow.normalBias = 0.022
  group.add(sun)
  group.add(sun.target)

  const hemi = new THREE.HemisphereLight(0xbcd6ec, 0x6a5c40, 1.35)
  group.add(hemi)
  const bounce = new THREE.DirectionalLight(0xffe6c0, 0.35)
  bounce.position.set(-sunDir.x * 20, 6, -sunDir.z * 20)
  group.add(bounce)

  /* ---------------------------- far ground -------------------------- */
  // A ring, not a sheet: the paddy floor sits 30 cm lower than the surrounding
  // land, so a single big plane would hide the whole thing from above.
  const landMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 1,
    metalness: 0,
  })
  const hx = HALF_W + PADDY_EDGE + LEVEE_OUT
  const hz = PADDY_HALF_L + PADDY_EDGE + LEVEE_OUT
  const FAR = 760
  const landQuad = (x0: number, x1: number, z0: number, z1: number) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1)
    g.rotateX(-Math.PI / 2)
    g.translate((x0 + x1) / 2, LEVEE_TOP - 0.02, (z0 + z1) / 2)
    // world-anchored uv so the texel density matches on every quad
    const pos = g.getAttribute('position')
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 16, pos.getZ(i) / 16)
    uv.needsUpdate = true
    const m = new THREE.Mesh(g, landMat)
    m.receiveShadow = false
    group.add(m)
  }
  landQuad(-FAR, -hx, -FAR, FAR)
  landQuad(hx, FAR, -FAR, FAR)
  landQuad(-hx, hx, hz, FAR)
  landQuad(-hx, hx, -FAR, -hz)

  /* ------------------------------ levees ----------------------------- */
  const levee = new MeshBuilder()
  const earth = new THREE.Color(0x7d6a4c)
  const earthTop = new THREE.Color(0x8d7c58)
  const ix = HALF_W + PADDY_EDGE
  const iz = PADDY_HALF_L + PADDY_EDGE
  const ox = ix + LEVEE_OUT
  const oz = iz + LEVEE_OUT
  // four banks; the inner face slopes down into the paddy
  const bank = (cx: number, cz: number, w: number, d: number) => {
    put(levee, box(w, LEVEE_TOP + 0.06, d), earth, [cx, (LEVEE_TOP - 0.06) / 2, cz])
    put(levee, box(w * 0.98, 0.05, d * 0.98), earthTop, [cx, LEVEE_TOP, cz])
  }
  bank(-(ix + ox) / 2, 0, ox - ix, oz * 2)
  bank((ix + ox) / 2, 0, ox - ix, oz * 2)
  bank(0, -(iz + oz) / 2, ix * 2, oz - iz)
  bank(0, (iz + oz) / 2, ix * 2, oz - iz)
  // sloped inner faces so the paddy floor sits believably below the bank
  for (const sx of [-1, 1]) {
    put(levee, box(0.5, 0.44, oz * 2), earth, [sx * (ix + 0.16), LEVEE_TOP - 0.24, 0], [0, 0, sx * 0.5])
  }
  for (const sz of [-1, 1]) {
    put(levee, box(ix * 2, 0.44, 0.5), earth, [0, LEVEE_TOP - 0.24, sz * (iz + 0.16)], [-sz * 0.5, 0, 0])
  }
  const leveeMesh = new THREE.Mesh(
    levee.build(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, metalness: 0 }),
  )
  leveeMesh.castShadow = true
  leveeMesh.receiveShadow = true
  group.add(leveeMesh)

  /* -------- grass, weeds and spider lilies along the banks ----------- */
  const tuft = new MeshBuilder()
  const gA = new THREE.Color(0x62762f)
  const gB = new THREE.Color(0x94a34c)
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, 6.28)
    const l = rng.range(0.14, 0.3)
    tuft.ribbon(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(a) * l * 0.35, l * 0.72, Math.sin(a) * l * 0.35),
        new THREE.Vector3(Math.cos(a) * l * 0.95, l * 0.9, Math.sin(a) * l * 0.95),
      ],
      [0.016, 0.011, 0.002],
      [gA, gA.clone().lerp(gB, 0.5), gB],
    )
  }
  const tuftMesh = new THREE.InstancedMesh(
    tuft.build(),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    900,
  )
  tuftMesh.receiveShadow = true
  tuftMesh.frustumCulled = false
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v3 = new THREE.Vector3()
  const s3 = new THREE.Vector3()
  let ti = 0
  for (let i = 0; i < 900; i++) {
    const side = rng.int(4)
    let x: number
    let z: number
    if (side < 2) {
      x = (side === 0 ? -1 : 1) * rng.range(ix + 0.1, ox - 0.05)
      z = rng.range(-oz, oz)
    } else {
      x = rng.range(-ox, ox)
      z = (side === 2 ? -1 : 1) * rng.range(iz + 0.1, oz - 0.05)
    }
    v3.set(x, LEVEE_TOP + 0.01, z)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, 6.28))
    s3.setScalar(rng.range(0.7, 1.5))
    m4.compose(v3, q, s3)
    tuftMesh.setMatrixAt(ti++, m4)
  }
  tuftMesh.count = ti
  tuftMesh.instanceMatrix.needsUpdate = true
  group.add(tuftMesh)

  // higanbana — the red spider lilies that mark the harvest season
  const lily = new MeshBuilder()
  const stemC = new THREE.Color(0x5c7a34)
  const redA = new THREE.Color(0xc31f1c)
  const redB = new THREE.Color(0xf25a3a)
  lily.strand(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.16, 0), new THREE.Vector3(0.01, 0.3, 0)],
    [0.008, 0.007, 0.006],
    [stemC, stemC, stemC],
    3,
  )
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28
    lily.strand(
      [
        new THREE.Vector3(0.01, 0.3, 0),
        new THREE.Vector3(Math.cos(a) * 0.05, 0.36, Math.sin(a) * 0.05),
        new THREE.Vector3(Math.cos(a) * 0.09, 0.31, Math.sin(a) * 0.09),
      ],
      [0.006, 0.005, 0.002],
      [redA, redB, redB],
      3,
    )
  }
  const lilyMesh = new THREE.InstancedMesh(
    lily.build(),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    44,
  )
  lilyMesh.frustumCulled = false
  for (let i = 0; i < 44; i++) {
    const side = rng.int(4)
    const x = side < 2 ? (side === 0 ? -1 : 1) * rng.range(ix + 0.2, ox - 0.1) : rng.range(-ox, ox)
    const z = side < 2 ? rng.range(-oz, oz) : (side === 2 ? -1 : 1) * rng.range(iz + 0.2, oz - 0.1)
    v3.set(x, LEVEE_TOP, z)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, 6.28))
    s3.setScalar(rng.range(0.85, 1.3))
    m4.compose(v3, q, s3)
    lilyMesh.setMatrixAt(i, m4)
  }
  lilyMesh.instanceMatrix.needsUpdate = true
  group.add(lilyMesh)

  /* --------------------- neighbouring paddies ------------------------ */
  const plots = new MeshBuilder()
  const standing = new THREE.Color(0xc39c33)
  const cutPlot = new THREE.Color(0xb5a879)
  const greenPlot = new THREE.Color(0x5d8434)
  const bankC = new THREE.Color(0x6f7a45)
  const plot = (cx: number, cz: number, w: number, d: number, col: THREE.Color) => {
    put(plots, box(w, 0.06, d), col, [cx, LEVEE_TOP - 0.09, cz])
    put(plots, box(w + 1.1, 0.1, 0.55), bankC, [cx, LEVEE_TOP - 0.03, cz - d / 2 - 0.28])
    put(plots, box(w + 1.1, 0.1, 0.55), bankC, [cx, LEVEE_TOP - 0.03, cz + d / 2 + 0.28])
    put(plots, box(0.55, 0.1, d), bankC, [cx - w / 2 - 0.28, LEVEE_TOP - 0.03, cz])
    put(plots, box(0.55, 0.1, d), bankC, [cx + w / 2 + 0.28, LEVEE_TOP - 0.03, cz])
  }
  plot(-ox - 11, -10, 19, 21, standing)
  plot(-ox - 11, 13, 19, 22, cutPlot)
  plot(-ox - 33, 2, 22, 40, greenPlot)
  plot(-ox - 33, -36, 22, 30, standing)
  plot(0, oz + 13, 26, 22, cutPlot)
  plot(-26, oz + 18, 20, 30, standing)
  plot(26, oz + 16, 20, 26, greenPlot)
  plot(0, -oz - 14, 26, 24, greenPlot)
  plot(-26, -oz - 18, 20, 30, cutPlot)
  plot(ROAD_X + 14, -6, 22, 30, cutPlot)
  plot(ROAD_X + 14, 26, 22, 26, standing)
  plot(ROAD_X + 40, 4, 26, 44, standing)
  plot(ROAD_X + 40, -44, 26, 34, cutPlot)
  group.add(
    new THREE.Mesh(
      plots.build(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }),
    ),
  )

  // real rice on the plot right across the west bank, so the middle
  // distance has genuine geometry to occlude and parallax against
  const neighbour = new MeshBuilder()
  const nGold = new THREE.Color(COLORS.riceGold)
  const nTip = new THREE.Color(COLORS.riceTip)
  const nStem = new THREE.Color(COLORS.riceStem)
  for (let s = 0; s < 3; s++) {
    const a = (s / 3) * 6.28
    neighbour.strand(
      [
        new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
        new THREE.Vector3(Math.cos(a) * 0.1, 0.5, Math.sin(a) * 0.1),
        new THREE.Vector3(Math.cos(a) * 0.2, 0.86, Math.sin(a) * 0.2),
      ],
      [0.024, 0.02, 0.012],
      [nStem, nGold, nTip],
      3,
    )
  }
  const nMesh = new THREE.InstancedMesh(
    neighbour.build(),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    1100,
  )
  nMesh.frustumCulled = false
  nMesh.receiveShadow = true
  let ni = 0
  // kept clear of every camera position: the shots all sit within ~14 m of the machine
  const strips: [number, number, number, number][] = [
    [-31, -20, -19, 0],
    [-31, -20, 3, 22],
  ]
  for (const [x0, x1, z0, z1] of strips) {
    const cols = Math.round((x1 - x0) / 0.55)
    const rows = Math.round((z1 - z0) / 0.55)
    for (let i = 0; i < cols && ni < 1100; i++) {
      for (let j = 0; j < rows && ni < 1100; j++) {
        v3.set(
          x0 + i * 0.55 + rng.range(-0.1, 0.1),
          LEVEE_TOP - 0.06,
          z0 + j * 0.55 + rng.range(-0.1, 0.1),
        )
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, 6.28))
        s3.setScalar(rng.range(0.85, 1.15))
        m4.compose(v3, q, s3)
        nMesh.setMatrixAt(ni++, m4)
      }
    }
  }
  nMesh.count = ni
  nMesh.instanceMatrix.needsUpdate = true
  group.add(nMesh)

  /* ------------------------------- road ------------------------------ */
  const road = new MeshBuilder()
  put(road, box(3.4, 0.08, 150), new THREE.Color(0x8f8065), [ROAD_X + 1.2, LEVEE_TOP + 0.02, 0])
  put(road, box(0.5, 0.05, 150), new THREE.Color(0x6f7a44), [ROAD_X - 0.6, LEVEE_TOP + 0.03, 0])
  put(road, box(0.5, 0.05, 150), new THREE.Color(0x6f7a44), [ROAD_X + 3.0, LEVEE_TOP + 0.03, 0])
  // irrigation ditch beside the road
  put(road, box(0.7, 0.3, 150), new THREE.Color(0x6e6d5c), [ROAD_X - 1.5, LEVEE_TOP - 0.1, 0])
  group.add(
    new THREE.Mesh(
      road.build(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    ),
  )
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 150),
    new THREE.MeshStandardMaterial({ color: 0x4c6b6a, roughness: 0.12, metalness: 0.2 }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(ROAD_X - 1.5, LEVEE_TOP - 0.06, 0)
  group.add(water)

  /* -------------------------- poles and wires ------------------------ */
  const poles = new MeshBuilder()
  const conc = new THREE.Color(0xa8a49a)
  const wood = new THREE.Color(0x6b5c48)
  const wire = new THREE.Color(0x2e3033)
  const poleZ: number[] = []
  for (let i = -4; i <= 6; i++) poleZ.push(i * 18)
  for (const z of poleZ) {
    put(poles, cyl(0.1, 0.15, 8.5, 6), conc, [ROAD_X + 3.6, LEVEE_TOP + 4.25, z])
    put(poles, box(1.5, 0.09, 0.09), wood, [ROAD_X + 3.6, LEVEE_TOP + 7.9, z])
    put(poles, box(1.2, 0.08, 0.08), wood, [ROAD_X + 3.6, LEVEE_TOP + 7.3, z])
    for (const sx of [-1, 1]) {
      put(poles, cyl(0.05, 0.05, 0.16, 5), new THREE.Color(0x8a9296), [ROAD_X + 3.6 + sx * 0.62, LEVEE_TOP + 8.02, z])
    }
  }
  for (let i = 0; i < poleZ.length - 1; i++) {
    const z0 = poleZ[i]
    const z1 = poleZ[i + 1]
    for (const sx of [-1, 1]) {
      for (const [yy, sag] of [
        [8.02, 0.5],
        [7.34, 0.42],
      ]) {
        const pts: THREE.Vector3[] = []
        for (let s = 0; s <= 5; s++) {
          const t = s / 5
          pts.push(
            new THREE.Vector3(
              ROAD_X + 3.6 + sx * 0.62,
              LEVEE_TOP + yy - Math.sin(t * Math.PI) * sag,
              z0 + (z1 - z0) * t,
            ),
          )
        }
        poles.strand(pts, [0.022, 0.022, 0.022, 0.022, 0.022, 0.022], [wire], 3)
      }
    }
  }
  const poleMesh = new THREE.Mesh(
    poles.build(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 }),
  )
  poleMesh.castShadow = true
  group.add(poleMesh)

  /* --------------------------- drying racks -------------------------- */
  const rack = new MeshBuilder()
  const rWood = new THREE.Color(0x6c5a42)
  const bundle = new THREE.Color(0xc7ab5f)
  for (let r = 0; r < 2; r++) {
    const bx = -24.5 + r * 4.5
    const bz = 13
    for (let p = 0; p < 5; p++) {
      put(rack, cyl(0.05, 0.06, 2.2, 5), rWood, [bx, LEVEE_TOP + 1.1, bz + p * 1.6])
      put(rack, cyl(0.04, 0.05, 2.4, 5), rWood, [bx + 0.35, LEVEE_TOP + 1.05, bz + p * 1.6], [0, 0, -0.28])
    }
    for (const y of [1.55, 2.0]) {
      put(rack, cyl(0.045, 0.045, 7.0, 5), rWood, [bx + 0.1, LEVEE_TOP + y, bz + 3.2], [Math.PI / 2, 0, 0])
    }
    // sheaves hung over the rails
    for (let i = 0; i < 34; i++) {
      const z = bz - 0.4 + (i / 33) * 7.4
      put(rack, box(0.5, 0.9, 0.16), bundle, [bx + 0.1, LEVEE_TOP + 1.62, z], [0, 0, rng.range(-0.1, 0.1)])
      put(rack, box(0.46, 0.85, 0.15), bundle.clone().multiplyScalar(0.92), [bx + 0.1, LEVEE_TOP + 2.07, z])
    }
  }
  const rackMesh = new THREE.Mesh(
    rack.build(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  )
  rackMesh.castShadow = true
  group.add(rackMesh)

  /* ----------------------------- village ----------------------------- */
  const vill = new MeshBuilder()
  const wallA = new THREE.Color(0xbdb5a2)
  const wallB = new THREE.Color(0x8a7860)
  const roofA = new THREE.Color(0x5a6068)
  const roofB = new THREE.Color(0x6d5f50)
  const houses: [number, number, number][] = [
    [46, -26, 1.1],
    [54, -12, 0.9],
    [50, 6, 1.25],
    [61, 20, 1.0],
    [42, 30, 0.95],
    [72, -34, 1.15],
    [-52, 34, 1.05],
    [-64, 12, 0.95],
    [-46, -30, 1.1],
    [30, 52, 1.0],
    [-24, 58, 1.2],
  ]
  for (const [hx, hz, hs] of houses) {
    const w = 7 * hs
    const d = 9 * hs
    const wallH = 3.2 * hs
    put(vill, box(w, wallH, d), rng.next() > 0.5 ? wallA : wallB, [hx, LEVEE_TOP + wallH / 2, hz])
    // hipped tile roof, built from two sloping slabs and a ridge
    const rc = rng.next() > 0.4 ? roofA : roofB
    for (const sx of [-1, 1]) {
      put(vill, box(w * 0.62, 0.16, d + 1.2), rc, [hx + sx * w * 0.27, LEVEE_TOP + wallH + 0.72 * hs, hz], [0, 0, sx * 0.55])
    }
    put(vill, box(0.5, 0.22, d + 1.3), rc.clone().multiplyScalar(0.85), [hx, LEVEE_TOP + wallH + 1.42 * hs, hz])
    // a shed or two
    if (rng.next() > 0.4) {
      put(vill, box(4 * hs, 2.4 * hs, 5 * hs), wallB, [hx + 6 * hs, LEVEE_TOP + 1.2 * hs, hz + 5 * hs])
      put(vill, box(4.6 * hs, 0.14, 5.6 * hs), roofB, [hx + 6 * hs, LEVEE_TOP + 2.5 * hs, hz + 5 * hs])
    }
  }
  const villMesh = new THREE.Mesh(
    vill.build(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
  )
  group.add(villMesh)

  /* ------------------------------ trees ------------------------------ */
  const nearTrees = new THREE.Group()
  // Nothing tall inside ~18 m of the paddy: every directed shot lives there.
  const treeSpots: [number, number, number][] = [
    [ROAD_X + 9.5, -26, 3.2],
    [ROAD_X + 9.0, 4, 2.7],
    [ROAD_X + 11, 30, 3.4],
    [-27, -16, 3.0],
    [-25.5, 10, 3.3],
    [-29, 30, 2.9],
    [30, -42, 3.6],
    [-38, -34, 3.2],
    [16, 46, 3.4],
    [-18, 48, 3.0],
    [44, 20, 3.5],
    [-46, 4, 3.3],
  ]
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true })
  for (const [tx, tz, ts] of treeSpots) {
    const m = new THREE.Mesh(treeGeometry(rng, ts, rng.range(0.1, 0.7)), treeMat)
    m.position.set(tx, LEVEE_TOP, tz)
    m.castShadow = true
    m.receiveShadow = true
    nearTrees.add(m)
  }
  group.add(nearTrees)

  // dense wood line closing off the middle distance
  const wood2 = new MeshBuilder()
  for (let i = 0; i < 150; i++) {
    const a = rng.range(0, 6.28)
    const r = rng.range(105, 165)
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    const s = rng.range(4, 9)
    const c = new THREE.Color(0x3a5230).lerp(new THREE.Color(0x7a6a34), rng.range(0, 0.55)).multiplyScalar(rng.range(0.8, 1.15))
    put(wood2, cyl(0.2, 0.35, s * 0.6, 4), new THREE.Color(0x463a2e), [x, LEVEE_TOP + s * 0.3, z])
    put(wood2, new THREE.IcosahedronGeometry(s * 0.5, 0), c, [x, LEVEE_TOP + s * 0.8, z], [rng.range(0, 3), rng.range(0, 3), 0], [1, 0.8, 1])
  }
  group.add(new THREE.Mesh(wood2.build(), new THREE.MeshLambertMaterial({ vertexColors: true })))

  /* ---------------------------- mountains ---------------------------- */
  group.add(ridgeLayer(215, 42, LEVEE_TOP, 0x5c7057, 3))
  group.add(ridgeLayer(320, 74, LEVEE_TOP, 0x6b8090, 17))
  group.add(ridgeLayer(455, 108, LEVEE_TOP, 0x87a0b4, 41))

  /* ------------------------------ clouds ----------------------------- */
  const clouds = new THREE.Group()
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTex,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: 0.9,
  })
  for (let i = 0; i < 11; i++) {
    const a = rng.range(0, 6.28)
    const r = rng.range(220, 520)
    const w = rng.range(120, 260)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.42), cloudMat)
    m.position.set(Math.sin(a) * r, rng.range(70, 165), Math.cos(a) * r)
    m.lookAt(0, m.position.y * 0.35, 0)
    m.renderOrder = -900
    clouds.add(m)
  }
  group.add(clouds)

  scene.add(group)

  const target = new THREE.Vector3()
  return {
    group,
    sun,
    update(dt: number, focus: THREE.Vector3) {
      // keep the shadow frustum tight around the machine
      target.copy(focus)
      sun.target.position.copy(target)
      sun.position.copy(target).addScaledVector(sunDir, 34)
      sun.target.updateMatrixWorld()
      clouds.rotation.y += dt * 0.0035
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else if (mat) mat.dispose()
      })
      scene.remove(group)
    },
  }
}

export { FIELD_W, FIELD_L }
