import * as THREE from 'three'
import { mulberry32 } from './util'

// Procedural canvas textures — no external assets, everything ships in the bundle.

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, rng: () => number,
  alpha: [number, number], size: [number, number], hue: string) {
  for (let i = 0; i < n; i++) {
    const a = alpha[0] + rng() * (alpha[1] - alpha[0])
    const s = size[0] + rng() * (size[1] - size[0])
    ctx.fillStyle = hue
    ctx.globalAlpha = a
    ctx.fillRect(rng() * w, rng() * h, s, s)
  }
  ctx.globalAlpha = 1
}

export function concreteFloorTexture(): THREE.CanvasTexture {
  const rng = mulberry32(101)
  const [c, ctx] = makeCanvas(512, 512)
  ctx.fillStyle = '#9a9891'
  ctx.fillRect(0, 0, 512, 512)
  grain(ctx, 512, 512, 5200, rng, [0.03, 0.1], [1, 3], '#6f6d66')
  grain(ctx, 512, 512, 4200, rng, [0.03, 0.09], [1, 3], '#b3b1a8')
  // faint patch stains (asymmetric)
  for (let i = 0; i < 9; i++) {
    const x = rng() * 512, y = rng() * 512, r = 25 + rng() * 90
    const g = ctx.createRadialGradient(x, y, 2, x, y, r)
    g.addColorStop(0, 'rgba(85,82,74,0.10)')
    g.addColorStop(1, 'rgba(85,82,74,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // expansion joint lines
  ctx.strokeStyle = 'rgba(70,68,62,0.5)'
  ctx.lineWidth = 2
  for (const p of [0, 256]) {
    ctx.beginPath(); ctx.moveTo(p + 0.5, 0); ctx.lineTo(p + 0.5, 512); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p + 0.5); ctx.lineTo(512, p + 0.5); ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function concreteBeamTexture(): THREE.CanvasTexture {
  const rng = mulberry32(77)
  const [c, ctx] = makeCanvas(512, 128)
  ctx.fillStyle = '#b8b5ad'
  ctx.fillRect(0, 0, 512, 128)
  grain(ctx, 512, 128, 2400, rng, [0.03, 0.08], [1, 2], '#8f8c84')
  grain(ctx, 512, 128, 1600, rng, [0.03, 0.08], [1, 2], '#cfccc3')
  // precast form joint lines
  ctx.strokeStyle = 'rgba(105,102,95,0.55)'
  ctx.lineWidth = 2
  for (let x = 0; x < 512; x += 128) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, 128); ctx.stroke()
  }
  // slight water streaks from top edge
  for (let i = 0; i < 14; i++) {
    const x = rng() * 512
    ctx.fillStyle = 'rgba(120,117,110,0.12)'
    ctx.fillRect(x, 0, 2 + rng() * 3, 20 + rng() * 60)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Running surface of the beam: rubber tires polish the concrete along two strips.
export function beamTopTexture(): THREE.CanvasTexture {
  const rng = mulberry32(78)
  const [c, ctx] = makeCanvas(256, 128)
  ctx.fillStyle = '#b4b1a9'
  ctx.fillRect(0, 0, 256, 128)
  grain(ctx, 256, 128, 1200, rng, [0.03, 0.08], [1, 2], '#8f8c84')
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0.16, 'rgba(96,94,90,0)')
  g.addColorStop(0.34, 'rgba(96,94,90,0.34)')
  g.addColorStop(0.5, 'rgba(96,94,90,0.06)')
  g.addColorStop(0.66, 'rgba(96,94,90,0.34)')
  g.addColorStop(0.84, 'rgba(96,94,90,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 128)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Woven lifting sling belt (webbing) texture.
export function slingTexture(): THREE.CanvasTexture {
  const rng = mulberry32(55)
  const [c, ctx] = makeCanvas(64, 128)
  ctx.fillStyle = '#c98319'
  ctx.fillRect(0, 0, 64, 128)
  // weave: diagonal herringbone
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 64; x += 8) {
      const off = (Math.floor(y / 4) % 2) * 4
      ctx.fillStyle = 'rgba(90,55,8,0.35)'
      ctx.fillRect(x + off, y, 4, 2)
      ctx.fillStyle = 'rgba(255,200,110,0.28)'
      ctx.fillRect(x + off + 4, y + 2, 4, 2)
    }
  }
  // edge stitching
  ctx.fillStyle = 'rgba(70,40,5,0.8)'
  ctx.fillRect(0, 0, 4, 128)
  ctx.fillRect(60, 0, 4, 128)
  // light wear
  grain(ctx, 64, 128, 260, rng, [0.05, 0.13], [1, 2], '#7a5210')
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Yellow/black hatched safety marking (painted floor border, crane counterweight edge).
export function hazardTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 32)
  ctx.fillStyle = '#e8b90c'
  ctx.fillRect(0, 0, 128, 32)
  ctx.fillStyle = '#26241f'
  for (let x = -32; x < 160; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, 32); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 16, 32)
    ctx.closePath(); ctx.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export interface MaterialKit {
  concreteFloor: THREE.MeshStandardMaterial
  concreteBeam: THREE.MeshStandardMaterial
  beamTop: THREE.MeshStandardMaterial
  paintedSteelBlue: THREE.MeshStandardMaterial   // bogie frame
  machinedSteel: THREE.MeshStandardMaterial      // pin faces, machined pads
  darkRubber: THREE.MeshStandardMaterial         // tires
  airSpringRubber: THREE.MeshStandardMaterial
  sling: THREE.MeshStandardMaterial
  wireRope: THREE.MeshStandardMaterial
  craneYellow: THREE.MeshStandardMaterial
  craneWhite: THREE.MeshStandardMaterial
  hookSteel: THREE.MeshStandardMaterial
  hazard: THREE.MeshStandardMaterial
  galvanized: THREE.MeshStandardMaterial         // fences, poles
  glassDark: THREE.MeshStandardMaterial
  vest: THREE.MeshStandardMaterial
  helmetWhite: THREE.MeshStandardMaterial
  workwear: THREE.MeshStandardMaterial
  skin: THREE.MeshStandardMaterial
  trailerRed: THREE.MeshStandardMaterial
  woodBlock: THREE.MeshStandardMaterial
}

export function buildMaterials(): MaterialKit {
  const floorTex = concreteFloorTexture()
  floorTex.repeat.set(18, 18)
  const beamTex = concreteBeamTexture()
  beamTex.repeat.set(6, 1)
  const beamTopTex = beamTopTexture()
  beamTopTex.repeat.set(14, 1)

  return {
    concreteFloor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.96, metalness: 0.0, color: 0xffffff }),
    concreteBeam: new THREE.MeshStandardMaterial({ map: beamTex, roughness: 0.92, metalness: 0.0 }),
    beamTop: new THREE.MeshStandardMaterial({ map: beamTopTex, roughness: 0.85, metalness: 0.0 }),
    paintedSteelBlue: new THREE.MeshStandardMaterial({ color: 0x5b7292, roughness: 0.55, metalness: 0.3 }),
    machinedSteel: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.85 }),
    darkRubber: new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.94, metalness: 0.0 }),
    airSpringRubber: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.85, metalness: 0.0 }),
    sling: new THREE.MeshStandardMaterial({ map: slingTexture(), roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }),
    wireRope: new THREE.MeshStandardMaterial({ color: 0x5c5e60, roughness: 0.5, metalness: 0.75 }),
    craneYellow: new THREE.MeshStandardMaterial({ color: 0xd9a415, roughness: 0.5, metalness: 0.25 }),
    craneWhite: new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.5, metalness: 0.2 }),
    hookSteel: new THREE.MeshStandardMaterial({ color: 0x3c3e42, roughness: 0.45, metalness: 0.7 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7, metalness: 0.0 }),
    galvanized: new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.6, metalness: 0.6 }),
    glassDark: new THREE.MeshStandardMaterial({ color: 0x18232c, roughness: 0.12, metalness: 0.4 }),
    vest: new THREE.MeshStandardMaterial({ color: 0xc8d61e, roughness: 0.85, metalness: 0.0 }),
    helmetWhite: new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.4, metalness: 0.05 }),
    workwear: new THREE.MeshStandardMaterial({ color: 0x3d4a56, roughness: 0.9, metalness: 0.0 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc9a183, roughness: 0.75, metalness: 0.0 }),
    trailerRed: new THREE.MeshStandardMaterial({ color: 0x7a2f26, roughness: 0.6, metalness: 0.3 }),
    woodBlock: new THREE.MeshStandardMaterial({ color: 0x8a6b48, roughness: 0.95, metalness: 0.0 })
  }
}

// Car body side texture: paint, panel seams, doors, windows, stripe. One canvas per side.
export function carBodySideTexture(opts: {
  stripe1: string, stripe2: string, lengthM: number, mirror: boolean
}): THREE.CanvasTexture {
  const rng = mulberry32(31)
  const W = 1024, H = 256
  const [c, ctx] = makeCanvas(W, H)
  const pxPerM = W / opts.lengthM
  // body base: slightly warm white
  ctx.fillStyle = '#e7e6e2'
  ctx.fillRect(0, 0, W, H)
  // paint micro-variation
  grain(ctx, W, H, 2600, rng, [0.015, 0.04], [1, 3], '#c9c8c4')
  grain(ctx, W, H, 1800, rng, [0.015, 0.035], [1, 3], '#f7f6f2')

  // stripe band below windows (accent color of the fictional operator)
  const stripeY = H * 0.52
  ctx.fillStyle = opts.stripe1
  ctx.fillRect(0, stripeY, W, H * 0.115)
  ctx.fillStyle = opts.stripe2
  ctx.fillRect(0, stripeY + H * 0.115, W, H * 0.045)

  // vertical panel seams every ~2.35 m
  ctx.strokeStyle = 'rgba(120,120,118,0.4)'
  ctx.lineWidth = 1.5
  for (let m = 2.35; m < opts.lengthM; m += 2.35) {
    const x = Math.round(m * pxPerM) + 0.5
    ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, H - 8); ctx.stroke()
  }
  // light transport dust settling along the lower skirt (new car: subtle only)
  const g = ctx.createLinearGradient(0, H * 0.8, 0, H)
  g.addColorStop(0, 'rgba(122,118,110,0)')
  g.addColorStop(1, 'rgba(122,118,110,0.16)')
  ctx.fillStyle = g
  ctx.fillRect(0, H * 0.8, W, H * 0.2)

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (opts.mirror) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1 }
  return t
}
