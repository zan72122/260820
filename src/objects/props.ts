import * as THREE from 'three'
import { BOTTLE } from '../core/dims'
import { roundedRectShape } from '../core/geometry'
import { Rng } from '../core/math'

function lathe(points: [number, number][], seg = 72): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  )
  g.computeVertexNormals()
  return g
}

/** Wide ceramic mixing bowl — deep enough that folding reads as folding. */
export function makeBowl(): THREE.Mesh {
  const geo = lathe([
    [0.0, 0.008],
    [0.04, 0.0105],
    [0.08, 0.031],
    [0.106, 0.062],
    [0.115, 0.092],
    [0.1185, 0.0945],
    [0.1215, 0.0925],
    [0.1205, 0.0885],
    [0.11, 0.058],
    [0.082, 0.024],
    [0.05, 0.004],
    [0.044, 0.0],
    [0.02, 0.0],
    [0.0, 0.0016],
  ])
  const mat = new THREE.MeshStandardMaterial({
    color: 0xebe5d9,
    roughness: 0.4,
    metalness: 0.02,
    side: THREE.DoubleSide,
  })
  mat.shadowSide = THREE.DoubleSide
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  m.receiveShadow = true
  m.name = 'bowl'
  return m
}

/** Silicone spatula: flexible blade, long handle, reads at arm's length. */
export function makeSpatula(): THREE.Group {
  const g = new THREE.Group()
  const bladeShape = roundedRectShape(0.062, 0.082, 0.016)
  const blade = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelSize: 0.0022,
    bevelThickness: 0.0018,
    bevelSegments: 2,
    curveSegments: 12,
  })
  blade.translate(0, -0.047, -0.003)
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.55, metalness: 0.02 })
  const bladeMesh = new THREE.Mesh(blade, bladeMat)
  bladeMesh.castShadow = true

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0092, 0.0115, 0.165, 20, 1),
    new THREE.MeshStandardMaterial({ color: 0x3f5c60, roughness: 0.45, metalness: 0.05 }),
  )
  handle.position.y = 0.082
  handle.castShadow = true

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0102, 0.0102, 0.012, 20),
    new THREE.MeshStandardMaterial({ color: 0x2c4448, roughness: 0.4, metalness: 0.1 }),
  )
  collar.position.y = 0.004
  g.add(bladeMesh, handle, collar)
  g.name = 'spatula'
  return g
}

/** Thin palette knife. Blade is offset so a fingertip never covers the tip. */
export function makePaletteKnife(): THREE.Group {
  const g = new THREE.Group()
  const shape = new THREE.Shape()
  shape.moveTo(-0.0075, 0)
  shape.lineTo(0.0075, 0)
  shape.lineTo(0.0075, 0.086)
  shape.quadraticCurveTo(0.0075, 0.097, 0, 0.098)
  shape.quadraticCurveTo(-0.0075, 0.097, -0.0075, 0.086)
  shape.closePath()
  const blade = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0011,
    bevelEnabled: true,
    bevelSize: 0.0004,
    bevelThickness: 0.0003,
    bevelSegments: 1,
    curveSegments: 10,
  })
  const bladeMesh = new THREE.Mesh(
    blade,
    new THREE.MeshStandardMaterial({ color: 0xd7dadd, roughness: 0.22, metalness: 0.95 }),
  )
  bladeMesh.castShadow = true

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0088, 0.0105, 0.082, 18),
    new THREE.MeshStandardMaterial({ color: 0x7a5333, roughness: 0.62, metalness: 0.02 }),
  )
  handle.position.y = -0.043
  handle.castShadow = true
  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0092, 0.0092, 0.009, 18),
    new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.3, metalness: 0.9 }),
  )
  ferrule.position.y = -0.0035
  g.add(bladeMesh, handle, ferrule)
  g.name = 'palette-knife'
  return g
}

/**
 * The cooling bottle. Deliberately simple transparency — one pass, no depth
 * write — with a fresnel rim so the edges and the neck stay readable.
 */
export function makeBottle(): THREE.Group {
  const g = new THREE.Group()
  const geo = lathe(
    [
      [0.0, 0.0012],
      [0.03, 0.0012],
      [0.0335, 0.005],
      [0.034, 0.02],
      [0.0338, 0.12],
      [0.0322, 0.142],
      [0.026, 0.163],
      [0.0185, 0.182],
      [0.0152, 0.198],
      [0.0148, 0.216],
      [0.0162, 0.2225],
      [0.0162, BOTTLE.height],
      [0.0125, BOTTLE.height],
      [0.0122, 0.214],
      [0.0108, 0.198],
      [0.0142, 0.178],
      [0.0218, 0.158],
      [0.0286, 0.138],
      [0.0302, 0.118],
      [0.0304, 0.02],
      [0.0295, 0.009],
      [0.0, 0.009],
    ],
    64,
  )
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcfe3e6,
    roughness: 0.06,
    metalness: 0.0,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.6);
       totalEmissiveRadiance += vec3(0.72, 0.80, 0.85) * fres * 1.25;
       diffuseColor.a = clamp(diffuseColor.a + fres * 0.62, 0.0, 1.0);`,
    )
  }
  const body = new THREE.Mesh(geo, mat)
  body.renderOrder = 6
  body.name = 'bottle-glass'

  // A faint contact shadow disc keeps the bottle grounded without depth writes.
  const shade = new THREE.Mesh(
    new THREE.CircleGeometry(0.046, 32),
    new THREE.MeshBasicMaterial({
      color: 0x3a2c1e,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
  shade.rotation.x = -Math.PI / 2
  shade.position.y = 0.0022
  shade.renderOrder = 1

  g.add(shade, body)
  g.name = 'bottle'
  return g
}

/** Condensation beading on the bottle as the hot pan cools above it. */
export function makeCondensation(): THREE.Points {
  const rng = new Rng(8123)
  const n = 90
  const pos = new Float32Array(n * 3)
  const size = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    const y = rng.range(0.01, 0.15)
    const r = 0.0342
    pos[i * 3] = Math.cos(a) * r
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = Math.sin(a) * r
    size[i] = rng.range(0.0016, 0.004)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1))
  const m = new THREE.PointsMaterial({
    color: 0xf2fbff,
    size: 0.0035,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const p = new THREE.Points(g, m)
  p.renderOrder = 7
  return p
}

/** Wire cooling rack in the mid ground. */
export function makeCoolingRack(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.8 })
  const bar = new THREE.CylinderGeometry(0.0022, 0.0022, 0.24, 6)
  for (let i = 0; i < 13; i++) {
    const m = new THREE.Mesh(bar, mat)
    m.rotation.z = Math.PI / 2
    m.position.set(0, 0.016, -0.11 + i * 0.0183)
    m.castShadow = true
    g.add(m)
  }
  const cross = new THREE.CylinderGeometry(0.0024, 0.0024, 0.235, 6)
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(cross, mat)
    m.rotation.x = Math.PI / 2
    m.position.set(-0.09 + i * 0.09, 0.0142, 0)
    g.add(m)
  }
  for (const [x, z] of [
    [-0.1, -0.1],
    [0.1, -0.1],
    [-0.1, 0.1],
    [0.1, 0.1],
  ]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.016, 6), mat)
    foot.position.set(x, 0.008, z)
    g.add(foot)
  }
  g.name = 'cooling-rack'
  return g
}
