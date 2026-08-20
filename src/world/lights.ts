import * as THREE from 'three'
import { makeGlow } from './textures'
import { clamp, damp } from '../core/util'

/**
 * 会場の灯り。実光源は数を絞り、
 * 見た目（グロー・地面の光だまり・電球の発光）で「点いた感」を作る。
 */

export type LampOptions = {
  color?: THREE.ColorRepresentation
  /** グローの見かけの大きさ（m） */
  glowSize?: number
  /** 地面に落ちる光だまりの半径（0 なら作らない） */
  poolRadius?: number
  poolY?: number
  /** 実際の PointLight を割り当てるか */
  realLight?: boolean
  realRange?: number
  realPower?: number
  /** 電球そのものの玉を出すか */
  bulb?: boolean
  bulbSize?: number
  flicker?: number
}

type Lamp = {
  pos: THREE.Vector3
  color: THREE.Color
  target: number
  value: number
  glow: THREE.Sprite
  pool?: THREE.Mesh
  bulb?: THREE.Mesh
  light?: THREE.PointLight
  glowSize: number
  poolRadius: number
  realPower: number
  flicker: number
  phase: number
}

export class LampSystem {
  readonly group = new THREE.Group()
  private lamps: Lamp[] = []
  private glowTex = makeGlow(128, 2.6)
  private poolTex = makeGlow(128, 1.5)
  private clock = 0

  constructor() {
    this.group.name = 'lamps'
  }

  add(pos: THREE.Vector3, opts: LampOptions = {}) {
    const color = new THREE.Color(opts.color ?? '#ffc478')
    const glowSize = opts.glowSize ?? 2.4
    const spriteMat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color: color.clone(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
      fog: false,
      toneMapped: true,
    })
    const glow = new THREE.Sprite(spriteMat)
    glow.position.copy(pos)
    glow.scale.setScalar(glowSize)
    this.group.add(glow)

    const lamp: Lamp = {
      pos: pos.clone(),
      color,
      target: 0,
      value: 0,
      glow,
      glowSize,
      poolRadius: opts.poolRadius ?? 0,
      realPower: opts.realPower ?? 26,
      flicker: opts.flicker ?? 0,
      phase: Math.random() * 6.283,
    }

    if (opts.poolRadius && opts.poolRadius > 0) {
      const g = new THREE.PlaneGeometry(1, 1)
      g.rotateX(-Math.PI / 2)
      const m = new THREE.MeshBasicMaterial({
        map: this.poolTex,
        color: color.clone(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
        fog: false,
      })
      const pool = new THREE.Mesh(g, m)
      pool.position.set(pos.x, opts.poolY ?? 0.06, pos.z)
      pool.scale.setScalar(opts.poolRadius * 2)
      pool.renderOrder = 3
      this.group.add(pool)
      lamp.pool = pool
    }

    if (opts.bulb !== false) {
      const s = opts.bulbSize ?? 0.16
      const g = new THREE.SphereGeometry(s, 8, 6)
      const m = new THREE.MeshBasicMaterial({ color: color.clone(), fog: false })
      m.color.multiplyScalar(0.06)
      const bulb = new THREE.Mesh(g, m)
      bulb.position.copy(pos)
      this.group.add(bulb)
      lamp.bulb = bulb
    }

    if (opts.realLight) {
      const light = new THREE.PointLight(color, 0, opts.realRange ?? 34, 1.7)
      light.position.copy(pos)
      this.group.add(light)
      lamp.light = light
    }

    this.lamps.push(lamp)
    return this.lamps.length - 1
  }

  setOn(index: number, on: number) {
    const l = this.lamps[index]
    if (l) l.target = clamp(on, 0, 1)
  }

  setAll(on: number) {
    for (const l of this.lamps) l.target = clamp(on, 0, 1)
  }

  /** 順番に点灯させる（0 から順に delay 秒ずつ）。 */
  isOn(index: number) {
    return (this.lamps[index]?.target ?? 0) > 0.5
  }

  get count() {
    return this.lamps.length
  }

  position(index: number) {
    return this.lamps[index].pos
  }
  color(index: number) {
    return this.lamps[index].color
  }
  value(index: number) {
    return this.lamps[index].value
  }

  /** 補間を待たずに現在の目標値へ飛ばす（デバッグ・リプレイ用）。 */
  snap() {
    for (const l of this.lamps) l.value = l.target
  }

  update(dt: number) {
    this.clock += dt
    for (const l of this.lamps) {
      l.value = damp(l.value, l.target, 4.5, dt)
      let v = l.value
      if (l.flicker > 0 && v > 0.02) {
        v *= 1 - l.flicker * (0.5 + 0.5 * Math.sin(this.clock * 11.3 + l.phase))
      }
      const sm = l.glow.material as THREE.SpriteMaterial
      sm.opacity = v * 0.95
      l.glow.scale.setScalar(l.glowSize * (0.75 + 0.25 * v))
      if (l.pool) {
        ;(l.pool.material as THREE.MeshBasicMaterial).opacity = v * 0.8
      }
      if (l.bulb) {
        const bm = l.bulb.material as THREE.MeshBasicMaterial
        bm.color.copy(l.color).multiplyScalar(0.06 + v * 2.6)
      }
      if (l.light) l.light.intensity = v * l.realPower
    }
  }
}
