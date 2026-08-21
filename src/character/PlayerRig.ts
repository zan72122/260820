import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three'
import type { Rng } from '../core/rng'
import type { MatKit } from '../materials/matkit'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../builders/util/geo'

/**
 * プレイヤー: 3.5頭身・全高1.3m の剛体パーツ階層リグ。
 * 麦わら帽＋藍の作務衣＋地下足袋 — 庭仕事の装いという機能から決めた
 * 造形で、リアル人体の不気味の谷を意図的に避けた「木偶」の素朴さ。
 * SkinnedMesh を使わないので決定的・軽量・Nodeでもテスト可能。
 */
export interface RigJoints {
  root: Group
  hips: Object3D
  spine: Object3D
  head: Object3D
  shoulderL: Object3D
  shoulderR: Object3D
  elbowL: Object3D
  elbowR: Object3D
  /** 道具のアタッチ先 */
  wristR: Object3D
  thighL: Object3D
  thighR: Object3D
  kneeL: Object3D
  kneeR: Object3D
  footL: Object3D
  footR: Object3D
}

export const HIPS_H = 0.52
export const THIGH_LEN = 0.22
export const SHIN_LEN = 0.25
export const TORSO_LEN = 0.35
export const ARM_UPPER = 0.16
export const ARM_LOWER = 0.15

export function buildPlayerRig(kit: MatKit, rng: Rng): RigJoints {
  const cloth = new MeshStandardMaterial({
    color: '#3c4867',
    roughness: 0.94,
    vertexColors: true,
  })
  const clothDark = new MeshStandardMaterial({
    color: '#2e3750',
    roughness: 0.94,
    vertexColors: true,
  })
  const skin = new MeshStandardMaterial({ color: '#c9a183', roughness: 0.75 })
  const tabi = new MeshStandardMaterial({ color: '#26221c', roughness: 0.9 })

  const root = new Group()
  root.name = 'player'

  const hips = new Object3D()
  hips.position.y = HIPS_H
  root.add(hips)

  // --- 腰・胴 -------------------------------------------------------------
  const spine = new Object3D()
  hips.add(spine)
  {
    const waist = chamferBox(0.26, 0.14, 0.19, 0.03)
    setVertexColor(waist, tintJitter(rng, '#32405e', 0.03))
    moveGeo(waist, 0, 0.02, 0)
    const waistMesh = new Mesh(waist, clothDark)
    waistMesh.castShadow = true
    hips.add(waistMesh)

    const torso = chamferBox(0.3, TORSO_LEN, 0.21, 0.045)
    setVertexColor(torso, tintJitter(rng, '#3c4867', 0.03))
    moveGeo(torso, 0, TORSO_LEN / 2 + 0.06, 0)
    // 作務衣の襟（前合わせ）: 細い帯を斜めに。前は -Z（キャラの向き）
    const collarL = chamferBox(0.05, 0.2, 0.02, 0.005)
    setVertexColor(collarL, tintJitter(rng, '#2a3350', 0.03))
    collarL.rotateZ(0.42)
    moveGeo(collarL, -0.05, TORSO_LEN - 0.02, -0.1)
    const collarR = chamferBox(0.05, 0.2, 0.02, 0.005)
    setVertexColor(collarR, tintJitter(rng, '#2a3350', 0.03))
    collarR.rotateZ(-0.42)
    moveGeo(collarR, 0.05, TORSO_LEN - 0.02, -0.1)
    const torsoMesh = new Mesh(mergeParts([torso, collarL, collarR]), cloth)
    torsoMesh.castShadow = true
    spine.add(torsoMesh)
  }

  // --- 頭＋麦わら帽 -------------------------------------------------------
  const head = new Object3D()
  head.position.y = TORSO_LEN + 0.1
  spine.add(head)
  {
    const skull = new SphereGeometry(0.105, 14, 12)
    skull.scale(0.95, 1, 0.98)
    const skullMesh = new Mesh(skull, skin)
    skullMesh.position.y = 0.07
    skullMesh.castShadow = true
    head.add(skullMesh)

    // 麦わら帽: つば＋山＋巻き紐
    const hatParts = []
    const brim = new CylinderGeometry(0.24, 0.255, 0.012, 18)
    setVertexColor(brim, tintJitter(rng, '#c9ad62', 0.05))
    brim.translate(0, 0, 0)
    hatParts.push(brim)
    const crown = new CylinderGeometry(0.1, 0.12, 0.09, 14)
    setVertexColor(crown, tintJitter(rng, '#c2a558', 0.05))
    crown.translate(0, 0.05, 0)
    hatParts.push(crown)
    const band = new CylinderGeometry(0.117, 0.121, 0.02, 14)
    setVertexColor(band, new Color('#4a3b2a'))
    band.translate(0, 0.015, 0)
    hatParts.push(band)
    for (const p of hatParts) offsetUvs(p, rng(), rng())
    const hat = new Mesh(mergeParts(hatParts), kit.bamboo)
    hat.castShadow = true
    hat.position.y = 0.155
    hat.rotation.x = 0.06
    hat.rotation.z = -0.03
    head.add(hat)
  }

  // --- 腕 -----------------------------------------------------------------
  const makeArm = (side: 1 | -1) => {
    const shoulder = new Object3D()
    shoulder.position.set(side * 0.17, TORSO_LEN + 0.02, 0)
    spine.add(shoulder)

    const upper = new CylinderGeometry(0.048, 0.042, ARM_UPPER, 10)
    setVertexColor(upper, tintJitter(rng, '#3c4867', 0.04))
    upper.translate(0, -ARM_UPPER / 2, 0)
    offsetUvs(upper, rng(), rng())
    const upperMesh = new Mesh(upper, cloth)
    upperMesh.castShadow = true
    shoulder.add(upperMesh)

    const elbow = new Object3D()
    elbow.position.y = -ARM_UPPER
    shoulder.add(elbow)

    const lowerParts = []
    const lower = new CylinderGeometry(0.04, 0.034, ARM_LOWER, 10)
    setVertexColor(lower, tintJitter(rng, '#3c4867', 0.04))
    lower.translate(0, -ARM_LOWER / 2, 0)
    lowerParts.push(lower)
    // 手甲（藍の袖口あて）
    const tekkou = new CylinderGeometry(0.037, 0.037, 0.05, 10)
    setVertexColor(tekkou, new Color('#2a3350'))
    tekkou.translate(0, -ARM_LOWER + 0.03, 0)
    lowerParts.push(tekkou)
    for (const p of lowerParts) offsetUvs(p, rng(), rng())
    const lowerMesh = new Mesh(mergeParts(lowerParts), cloth)
    lowerMesh.castShadow = true
    elbow.add(lowerMesh)

    const wrist = new Object3D()
    wrist.position.y = -ARM_LOWER - 0.02
    elbow.add(wrist)
    const hand = new Mesh(new SphereGeometry(0.036, 10, 8), skin)
    hand.castShadow = true
    wrist.add(hand)

    return { shoulder, elbow, wrist }
  }
  const armL = makeArm(-1)
  const armR = makeArm(1)

  // --- 脚 -----------------------------------------------------------------
  const makeLeg = (side: 1 | -1) => {
    const thigh = new Object3D()
    thigh.position.set(side * 0.075, 0, 0)
    hips.add(thigh)

    // もんぺ: 腿は太くゆったり
    const upper = new CylinderGeometry(0.062, 0.055, THIGH_LEN, 10)
    setVertexColor(upper, tintJitter(rng, '#32405e', 0.04))
    upper.translate(0, -THIGH_LEN / 2, 0)
    offsetUvs(upper, rng(), rng())
    const upperMesh = new Mesh(upper, clothDark)
    upperMesh.castShadow = true
    thigh.add(upperMesh)

    const knee = new Object3D()
    knee.position.y = -THIGH_LEN
    thigh.add(knee)

    const shin = new CylinderGeometry(0.05, 0.04, SHIN_LEN - 0.05, 10)
    setVertexColor(shin, tintJitter(rng, '#32405e', 0.04))
    shin.translate(0, -(SHIN_LEN - 0.05) / 2, 0)
    offsetUvs(shin, rng(), rng())
    const shinMesh = new Mesh(shin, clothDark)
    shinMesh.castShadow = true
    knee.add(shinMesh)

    const foot = new Object3D()
    foot.position.y = -SHIN_LEN
    knee.add(foot)
    // 足首関節は靴底の50mm上（実際の距骨の高さ）: 底面が接地基準。
    // つま先は前（-Z、キャラの向き）へ出る。
    const shoe = chamferBox(0.075, 0.05, 0.15, 0.012)
    moveGeo(shoe, 0, -0.025, -0.03)
    const shoeMesh = new Mesh(shoe, tabi)
    shoeMesh.castShadow = true
    foot.add(shoeMesh)

    return { thigh, knee, foot }
  }
  const legL = makeLeg(-1)
  const legR = makeLeg(1)

  return {
    root,
    hips,
    spine,
    head,
    shoulderL: armL.shoulder,
    shoulderR: armR.shoulder,
    elbowL: armL.elbow,
    elbowR: armR.elbow,
    wristR: armR.wrist,
    thighL: legL.thigh,
    thighR: legR.thigh,
    kneeL: legL.knee,
    kneeR: legR.knee,
    footL: legL.foot,
    footR: legR.foot,
  }
}
