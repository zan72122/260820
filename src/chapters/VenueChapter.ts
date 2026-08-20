import * as THREE from 'three'
import type { Chapter } from '../core/Game'
import { CameraDirector, pose } from '../core/CameraDirector'
import { Picker } from '../core/Picker'
import type { Ambience } from '../core/Audio'
import type { Hud } from '../ui/Hud'
import { Environment } from '../world/environment'
import { Water } from '../world/water'
import { buildTerrain } from '../world/terrain'
import { GrassField } from '../world/grass'
import { buildBridge } from '../world/bridge'
import { buildProps } from '../world/props'
import { buildCity, type CityBuild } from '../world/city'
import { Crowd } from '../world/crowd'
import { LampSystem } from '../world/lights'
import { MarkerLayer } from '../world/markers'
import { MaterialLib } from '../world/materials'
import { buildGate, MasterLever, type Barricade, type RoadSign } from '../world/interactives'
import { box, merge, strut } from '../world/geom'
import { groundHeight, L } from '../world/layout'
import { easeInOutSine, lerp, smoothstep } from '../core/util'

/* ------------------------------------------------------------------ *
 * ショット（見せる絵）。ユーザーに視点を探させない。
 * ------------------------------------------------------------------ */
const SHOTS = {
  introA: pose(254, 31, 252, 58, 11, 40, 44),
  introB: pose(196, 10.6, 214, 54, 6.0, 36, 46),

  gateA: pose(1.6, 12.1, 253, 0.0, 10.2, 228, 45),
  gateB: pose(0.5, 11.0, 244, 0.0, 9.9, 225, 45),

  lightsA: pose(124, 11.4, 214, 123, 4.6, 152, 45),
  lightsB: pose(125.5, 9.2, 199, 123, 3.9, 149, 45),

  leverA: pose(111.6, 5.2, 185.6, 114.9, 3.85, 178.5, 44),
  leverB: pose(113.3, 4.05, 181.0, 114.9, 3.7, 178.4, 40),

  finaleA: pose(168, 12.5, 206, 40, 12, 60, 46),
  finaleB: pose(214, 24, 240, -6, 16, 26, 46),
}

type Phase = 'idle' | 'intro' | 'gate' | 'gateDone' | 'lights' | 'lightsDone' | 'lever' | 'night' | 'finale'

type LightTarget = {
  id: string
  anchor: THREE.Vector3
  lampIds: number[]
  markerId: number
  done: boolean
}

export class VenueChapter implements Chapter {
  readonly scene = new THREE.Scene()
  readonly director: CameraDirector

  private lib: MaterialLib
  private env: Environment
  private water: Water
  private grass: GrassField
  private city: CityBuild
  private crowd: Crowd
  private lamps = new LampSystem()
  private markers = new MarkerLayer()
  private picker = new Picker()
  private hud: Hud
  private audio: Ambience

  private barricades: Barricade[] = []
  private sign: RoadSign
  private lever: MasterLever
  private bridgeLampIds: number[] = []
  private lightTargets: LightTarget[] = []
  private barricadeMarkers: number[] = []
  private leverMarker = -1

  private phase: Phase = 'idle'
  private timers: { t: number; fn: () => void }[] = []
  private nightT = 0
  private nightTarget = 0
  private gateDoneCount = 0
  private lightDoneCount = 0
  private aspect = 1

  constructor(quality: number, shadowMap: number, hud: Hud, audio: Ambience, aspect: number) {
    this.hud = hud
    this.audio = audio
    this.aspect = aspect
    this.director = new CameraDirector(aspect)

    this.lib = new MaterialLib(quality)
    this.env = new Environment(this.scene, shadowMap)

    const terrain = buildTerrain(quality, this.lib)
    this.scene.add(terrain.group)

    this.water = new Water()
    this.scene.add(this.water.mesh)

    this.grass = new GrassField(quality)
    this.scene.add(this.grass.mesh)

    const bridge = buildBridge(this.lib)
    this.scene.add(bridge.group)

    this.scene.add(buildProps(this.lib, quality))

    this.city = buildCity(this.lib, quality)
    this.scene.add(this.city.group)

    this.crowd = new Crowd(quality, bridge.walkway)
    this.scene.add(this.crowd.group)

    // --- 橋の照明 ---
    for (const a of bridge.lampAnchors) {
      this.bridgeLampIds.push(
        this.lamps.add(a, {
          color: '#ffcf90',
          glowSize: 3.4,
          bulbSize: 0.17,
          realLight: false,
        }),
      )
    }

    // --- 河川敷の案内灯・足元灯 ---
    this.scene.add(this.buildPathLights())

    // --- 橋のバリケード ---
    const gate = buildGate(this.lib)
    this.scene.add(gate.group)
    this.barricades = gate.barricades
    this.sign = gate.sign

    // --- 大元スイッチ ---
    this.lever = new MasterLever(this.lib)
    this.scene.add(this.lever.group)

    this.scene.add(this.lamps.group)
    this.scene.add(this.markers.group)

    // --- タップ対象の登録 ---
    this.barricades.forEach((b, i) => {
      const id = `barricade-${i}`
      this.picker.register(id, b.anchor, 1)
      this.barricadeMarkers.push(this.markers.add(b.anchor, 1))
    })
    this.picker.register('lever', this.lever.anchor, 1.2)
    this.leverMarker = this.markers.add(this.lever.anchor, 1.25)

    // --- 川面に映る灯り ---
    this.refreshReflections(bridge.lampAnchors)

    this.env.setTime(0)
    this.city.setNight(0)
    this.director.cut(SHOTS.introA)
  }

  /* -------------------------------------------------------------- *
   * 河川敷の灯り（案内灯 3 本 + 足元灯 2 かたまり）
   * -------------------------------------------------------------- */
  private pathZ(x: number) {
    return L.path.z + Math.sin(x * 0.017) * 3.4 + Math.sin(x * 0.041 + 1.7) * 1.5
  }

  private buildPathLights() {
    const group = new THREE.Group()
    group.name = 'path-lights'
    const poleParts: (THREE.BufferGeometry | null)[] = []
    const stakeParts: (THREE.BufferGeometry | null)[] = []

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

    const addPole = (x: number, order: number) => {
      const z = this.pathZ(x) + 3.0
      const y = groundHeight(x, z)
      const h = 3.5
      poleParts.push(strut(V(x, y - 0.2, z), V(x, y + h, z), 0.13, 0.13, 1.0))
      poleParts.push(strut(V(x, y + h, z), V(x, y + h + 0.14, z - 0.62), 0.1, 0.1, 1.0))
      const shade = new THREE.ConeGeometry(0.36, 0.3, 12, 1, true)
      shade.rotateX(Math.PI)
      shade.translate(x, y + h + 0.02, z - 0.62)
      poleParts.push(shade)
      // 台座
      poleParts.push(box(0.42, 0.22, 0.42, x, y + 0.1, z, 1.2))
      const bulb = V(x, y + h - 0.12, z - 0.62)
      const id = this.lamps.add(bulb, {
        color: '#ffc477',
        glowSize: 2.9,
        poolRadius: 9.0,
        poolY: y + 0.07,
        realLight: true,
        realPower: 34,
        realRange: 30,
        bulbSize: 0.13,
      })
      this.lightTargets.push({
        id: `light-${order}`,
        anchor: bulb.clone().add(V(0, 0.55, 0)),
        lampIds: [id],
        markerId: -1,
        done: false,
      })
    }

    const addFootCluster = (xCenter: number, order: number) => {
      const ids: number[] = []
      for (let i = 0; i < 5; i++) {
        const x = xCenter + (i - 2) * 2.1
        const side = i % 2 === 0 ? 1 : -1
        const z = this.pathZ(x) + side * 2.5
        const y = groundHeight(x, z)
        stakeParts.push(strut(V(x, y - 0.1, z), V(x, y + 0.44, z), 0.055, 0.055, 1.6))
        stakeParts.push(box(0.17, 0.1, 0.13, x, y + 0.48, z, 1.6))
        ids.push(
          this.lamps.add(V(x, y + 0.47, z), {
            color: '#ffb964',
            glowSize: 0.85,
            poolRadius: 2.2,
            poolY: y + 0.05,
            realLight: i === 2,
            realPower: 9,
            realRange: 11,
            bulbSize: 0.055,
          }),
        )
      }
      const cz = this.pathZ(xCenter)
      this.lightTargets.push({
        id: `light-${order}`,
        anchor: V(xCenter, groundHeight(xCenter, cz) + 1.1, cz),
        lampIds: ids,
        markerId: -1,
        done: false,
      })
    }

    // 手前（カメラに近い）→ 奥 の順に並べる
    addPole(104, 0)
    addFootCluster(114, 1)
    addPole(124, 2)
    addFootCluster(134, 3)
    addPole(144, 4)

    const poles = new THREE.Mesh(merge(poleParts), this.lib.steel)
    poles.castShadow = true
    poles.receiveShadow = true
    group.add(poles)
    const stakes = new THREE.Mesh(merge(stakeParts), this.lib.steelDark)
    stakes.castShadow = true
    group.add(stakes)

    for (const t of this.lightTargets) {
      this.picker.register(t.id, t.anchor, 1)
      t.markerId = this.markers.add(t.anchor, 1)
    }
    return group
  }

  private refreshReflections(bridgeAnchors: THREE.Vector3[]) {
    const picks = bridgeAnchors
      .filter((a) => Math.abs(a.z) < 130)
      .slice(0, 8)
      .map((p) => ({ pos: p.clone(), color: new THREE.Color('#ffcf90'), power: 1 }))
    for (const g of this.city.glowAnchors) {
      picks.push({ pos: g.clone(), color: new THREE.Color('#ffd6a0'), power: 0.5 })
    }
    this.water.setReflectedLights(picks.slice(0, 12))
  }

  /* -------------------------------------------------------------- *
   * 進行
   * -------------------------------------------------------------- */
  private after(sec: number, fn: () => void) {
    this.timers.push({ t: sec, fn })
  }

  enter() {
    this.titleHold()
  }

  /** タイトル画面の裏で、会場をゆっくり見せておく。 */
  titleHold() {
    this.phase = 'idle'
    this.timers.length = 0
    this.hud.showHud(false)
    this.picker.disableAll()
    this.markers.hideAll()
    this.director.cut(SHOTS.introA)
    this.director.play(
      SHOTS.introA,
      pose(236, 27, 240, 54, 10, 36, 44),
      0,
      70,
      easeInOutSine,
    )
  }

  restart() {
    this.timers.length = 0
    // 置かれていた状態へ全部戻す
    for (const b of this.barricades) b.reset()
    this.sign.reset()
    this.lever.reset()
    for (const t of this.lightTargets) t.done = false
    this.crowd.holdBridge()
    this.crowd.releasePath(0)
    this.nightT = 0
    this.nightTarget = 0
    this.gateDoneCount = 0
    this.lightDoneCount = 0
    this.env.setTime(0)
    this.city.setNight(0)
    this.lamps.setAll(0)
    this.lamps.snap()
    this.picker.disableAll()
    this.markers.hideAll()
    this.hud.reset()
    this.hud.showHud(true)
    this.hud.hideTask()
    this.audio.setCrowd(0)
    this.audio.setNight(0)

    this.phase = 'intro'
    this.director.cut(SHOTS.introA)
    this.director.play(SHOTS.introA, SHOTS.introB, 0, 17.5, easeInOutSine)
    this.hud.setTask('しなのがわの かわらだよ', undefined, undefined)
    this.after(6.0, () => {
      if (this.phase === 'intro') this.hud.setTask('もうすぐ ながおか はなび')
    })
    this.after(13.5, () => this.beginGate())
  }

  private beginGate() {
    if (this.phase !== 'intro') return
    this.phase = 'gate'
    this.hud.setStep(0, 'active')
    this.director.play(SHOTS.gateA, SHOTS.gateB, 3.2, 26, easeInOutSine)
    this.after(2.2, () => {
      if (this.phase !== 'gate') return
      this.hud.setTask('はしの さくを おろそう', 0, 3)
      this.barricades.forEach((b, i) => {
        this.picker.enable(`barricade-${i}`, !b.done)
        this.markers.setVisible(this.barricadeMarkers[i], !b.done)
      })
    })
  }

  private onBarricade(i: number) {
    const b = this.barricades[i]
    if (!b || b.done) return
    b.activate()
    this.audio.clack()
    this.picker.enable(`barricade-${i}`, false)
    this.markers.setVisible(this.barricadeMarkers[i], false)
    this.gateDoneCount++
    this.hud.setTask('はしの さくを おろそう', this.gateDoneCount, 3)
    if (this.gateDoneCount >= 3) this.finishGate()
  }

  private finishGate() {
    this.phase = 'gateDone'
    this.hud.setStep(0, 'done')
    this.sign.open()
    this.after(0.7, () => {
      this.hud.shout('はしが ひらいた！', 2400)
      this.audio.chime(4)
      // 橋の灯りがうっすら入り、渡り始める人が出る
      this.bridgeLampIds.forEach((id, k) => {
        this.after(k * 0.09, () => this.lamps.setOn(id, 0.42))
      })
      this.crowd.releaseBridge()
      this.audio.setCrowd(0.35)
      this.hud.setTask('ひとが わたりはじめた')
    })
    this.after(4.4, () => this.beginLights())
  }

  private beginLights() {
    this.phase = 'lights'
    this.hud.setStep(1, 'active')
    this.director.play(SHOTS.lightsA, SHOTS.lightsB, 3.4, 30, easeInOutSine)
    this.after(2.4, () => {
      if (this.phase !== 'lights') return
      this.hud.setTask('あかりを つけよう', 0, this.lightTargets.length)
      for (const t of this.lightTargets) {
        if (t.done) continue
        this.picker.enable(t.id, true)
        this.markers.setVisible(t.markerId, true)
      }
    })
  }

  private onLight(id: string) {
    const t = this.lightTargets.find((x) => x.id === id)
    if (!t || t.done) return
    t.done = true
    this.picker.enable(id, false)
    this.markers.setVisible(t.markerId, false)
    t.lampIds.forEach((lid, k) => {
      this.after(k * 0.07, () => this.lamps.setOn(lid, 1))
    })
    this.audio.chime(this.lightDoneCount)
    this.lightDoneCount++
    this.hud.setTask('あかりを つけよう', this.lightDoneCount, this.lightTargets.length)
    this.crowd.releasePath(this.lightDoneCount / this.lightTargets.length)
    this.audio.setCrowd(0.35 + 0.4 * (this.lightDoneCount / this.lightTargets.length))
    if (this.lightDoneCount >= this.lightTargets.length) this.finishLights()
  }

  private finishLights() {
    this.phase = 'lightsDone'
    this.hud.setStep(1, 'done')
    this.after(0.6, () => {
      this.hud.shout('あかりが ついた！', 2400)
      this.hud.setTask('かいじょうの じゅんびが できた')
    })
    this.after(4.0, () => this.beginLever())
  }

  private beginLever() {
    this.phase = 'lever'
    this.hud.setStep(2, 'active')
    this.director.play(SHOTS.leverA, SHOTS.leverB, 3.4, 30, easeInOutSine)
    this.after(2.6, () => {
      if (this.phase !== 'lever') return
      this.hud.setTask('よるに しよう！')
      this.picker.enable('lever', true)
      this.markers.setVisible(this.leverMarker, true)
    })
  }

  private onLever() {
    if (this.lever.done) return
    this.lever.activate()
    this.picker.enable('lever', false)
    this.markers.hideAll()
    this.hud.setStep(2, 'done')
    this.hud.hideTask()
    this.audio.swell()
    this.phase = 'night'
    this.nightTarget = 1

    this.director.play(SHOTS.finaleA, SHOTS.finaleB, 3.6, 34, easeInOutSine)

    // 灯りが波のように入っていく
    this.bridgeLampIds.forEach((id, k) => {
      this.after(1.1 + k * 0.12, () => this.lamps.setOn(id, 1))
    })
    this.after(2.0, () => {
      this.lamps.setAll(1)
      this.hud.doFlash(0.16, 1400)
    })
    this.after(4.6, () => this.hud.shout('よるに なった！', 3200))
    this.after(9.0, () => {
      this.phase = 'finale'
      this.hud.setTask('また あした、そらに はなび')
    })
    this.after(13.5, () => {
      this.hud.hideTask()
      this.hud.showEnd(true)
    })
  }

  /* -------------------------------------------------------------- */

  onTap(x: number, y: number, rect: DOMRect) {
    if (this.phase === 'idle') return
    if (this.phase === 'intro') {
      // 導入は飛ばせる（子どもが待てないとき用）
      this.timers.length = 0
      this.beginGate()
      return
    }
    const hit = this.picker.pick(x, y, this.director.camera, rect)
    if (!hit) return
    if (hit.startsWith('barricade-')) this.onBarricade(Number(hit.split('-')[1]))
    else if (hit.startsWith('light-')) this.onLight(hit)
    else if (hit === 'lever') this.onLever()
  }

  update(dt: number) {
    // タイマー
    for (let i = this.timers.length - 1; i >= 0; i--) {
      this.timers[i].t -= dt
      if (this.timers[i].t <= 0) {
        const fn = this.timers[i].fn
        this.timers.splice(i, 1)
        fn()
      }
    }

    // 夜へ
    if (this.nightTarget > this.nightT) {
      this.nightT = Math.min(1, this.nightT + dt / 9.5)
      const k = easeInOutSine(this.nightT)
      this.env.setTime(k)
      this.city.setNight(smoothstep(0.15, 0.92, k))
      this.audio.setNight(k)
    }

    this.director.update(dt, this.aspect)
    const cam = this.director.camera

    this.env.update(dt, cam)
    this.water.update(dt, cam, this.env)
    this.grass.update(dt, cam, this.env)
    this.lamps.update(dt)
    this.markers.update(dt, cam)
    this.crowd.update(dt)
    for (const b of this.barricades) b.update(dt)
    this.sign.update(dt)
    this.lever.update(dt)
  }

  /**
   * 開発用：任意の場面へ飛ぶ。?dbg=<name> で呼ぶ。
   * 遊びの本筋には出てこない。
   */
  jump(name: string) {
    this.timers.length = 0
    this.hud.showHud(true)
    this.picker.disableAll()
    this.markers.hideAll()

    const openGate = () => {
      this.barricades.forEach((b, i) => {
        b.activate()
        b.update(4)
        this.picker.enable(`barricade-${i}`, false)
      })
      this.sign.open()
      this.sign.update(4)
      this.crowd.releaseBridge()
      this.bridgeLampIds.forEach((id) => this.lamps.setOn(id, 0.42))
      this.gateDoneCount = 3
      this.hud.setStep(0, 'done')
    }
    const litPath = () => {
      for (const t of this.lightTargets) {
        t.done = true
        t.lampIds.forEach((id) => this.lamps.setOn(id, 1))
      }
      this.lightDoneCount = this.lightTargets.length
      this.crowd.releasePath(1)
      this.hud.setStep(1, 'done')
    }
    const toNight = () => {
      this.nightT = 1
      this.nightTarget = 1
      this.env.setTime(1)
      this.city.setNight(1)
      this.lamps.setAll(1)
      this.lever.activate()
      this.lever.update(4)
      this.hud.setStep(2, 'done')
    }

    switch (name) {
      case 'intro':
        this.phase = 'intro'
        this.director.cut(SHOTS.introB)
        break
      case 'gate':
        this.phase = 'gate'
        this.director.cut(SHOTS.gateB)
        this.hud.setTask('はしの さくを おろそう', 0, 3)
        this.barricades.forEach((_b, i) => {
          this.picker.enable(`barricade-${i}`, true)
          this.markers.setVisible(this.barricadeMarkers[i], true)
        })
        break
      case 'gateopen':
        this.phase = 'gateDone'
        openGate()
        this.director.cut(SHOTS.gateB)
        break
      case 'lights':
        openGate()
        this.phase = 'lights'
        this.director.cut(SHOTS.lightsA)
        this.hud.setTask('あかりを つけよう', 0, this.lightTargets.length)
        for (const t of this.lightTargets) {
          this.picker.enable(t.id, true)
          this.markers.setVisible(t.markerId, true)
        }
        break
      case 'litpath':
        openGate()
        litPath()
        this.phase = 'lightsDone'
        this.director.cut(SHOTS.lightsB)
        break
      case 'lever':
        openGate()
        litPath()
        this.phase = 'lever'
        this.director.cut(SHOTS.leverA)
        this.hud.setTask('よるに しよう！')
        this.picker.enable('lever', true)
        this.markers.setVisible(this.leverMarker, true)
        break
      case 'night':
        openGate()
        litPath()
        toNight()
        this.phase = 'finale'
        this.director.cut(SHOTS.finaleA)
        break
      case 'finale':
        openGate()
        litPath()
        toNight()
        this.phase = 'finale'
        this.director.cut(SHOTS.finaleB)
        break
      default:
        return
    }
    this.lamps.snap()
    this.markers.update(0.5, this.director.camera)
  }

  setAspect(a: number) {
    this.aspect = a
  }

  get exposure() {
    // 夜に入るときだけ、ほんの少し露出を持ち上げて目が慣れる感じを出す
    const t = this.env.time
    return this.env.exposure * lerp(1, 1.05, smoothstep(0.3, 1, t))
  }

  get bloomStrength() {
    return this.env.bloomStrength
  }

  dispose() {
    this.timers.length = 0
  }
}
