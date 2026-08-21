import { Group, Mesh } from 'three'
import type { Rng } from '../../core/rng'
import { rngRange } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import {
  KUTSUNUGI,
  TOBIISHI_D_MAX,
  TOBIISHI_D_MIN,
  TOBIISHI_EXPOSED_MAX,
  TOBIISHI_EXPOSED_MIN,
  TOBIISHI_PATH,
} from '../../scene/layout'
import { mergeParts } from '../util/geo'
import { makeStone } from '../util/stone'
import type { GroundBuilder } from './ground'

/**
 * 沓脱石と飛石の列。千鳥の制御点は layout.ts（歩幅ピッチ≒450〜550）。
 * 各石は据えた分だけ土に沈み（接地痕）、天端だけが 30〜60mm 覗く。
 * 人が跳び渡る動線なので、石の周囲の土は踏まれて草が禿げる。
 */
export function buildTobiishi(kit: MatKit, rng: Rng, ground: GroundBuilder): Group {
  const group = new Group()
  group.name = 'tobiishi'

  const stoneParts = []

  // --- 沓脱石: 大判の切り出し石（縁側の昇降のための実用寸法） -----------
  {
    const geo = makeStone(rng, {
      radius: KUTSUNUGI.w / 2,
      height: KUTSUNUGI.h + 0.08,
      irregularity: 0.12,
      topFlatten: 0.9,
      mossiness: 0.25,
      baseColor: '#7f7b72',
    })
    geo.scale(1, 1, KUTSUNUGI.d / KUTSUNUGI.w)
    const gy = ground.heightAt(KUTSUNUGI.x, KUTSUNUGI.z)
    geo.translate(KUTSUNUGI.x, gy - 0.08, KUTSUNUGI.z)
    stoneParts.push(geo)
    ground.addDepression(KUTSUNUGI.x, KUTSUNUGI.z, KUTSUNUGI.w * 0.75, 0.014)
    ground.addWear(KUTSUNUGI.x, KUTSUNUGI.z + 0.35, 0.5, 0.5)
  }

  // --- 飛石 ---------------------------------------------------------------
  for (const p of TOBIISHI_PATH) {
    const d = rngRange(rng, TOBIISHI_D_MIN, TOBIISHI_D_MAX)
    const exposed = rngRange(rng, TOBIISHI_EXPOSED_MIN, TOBIISHI_EXPOSED_MAX)
    const totalH = exposed + rngRange(rng, 0.05, 0.08)
    // 歩幅方向に僅かに長い石を選ぶ（実際の据え方の癖）
    const jx = p.x + (rng() - 0.5) * 0.05
    const jz = p.z + (rng() - 0.5) * 0.05
    const geo = makeStone(rng, {
      radius: d / 2,
      height: totalH,
      irregularity: 0.24,
      topFlatten: 0.85,
      mossiness: 0.45,
      soilRingH: totalH - exposed > 0.02 ? 0.035 : 0.02,
    })
    geo.rotateY(rng() * Math.PI * 2)
    const gy = ground.heightAt(jx, jz)
    geo.translate(jx, gy - (totalH - exposed), jz)
    stoneParts.push(geo)
    // 据え跡は石の縁の内側に留める（広いと「穴」に見えてしまう）
    ground.addDepression(jx, jz, d * 0.42, 0.007)
    // 動線の踏み分け（石の間に足が降りる）
    ground.addWear(jx, jz, d * 1.5, 0.32)
  }

  const stones = new Mesh(mergeParts(stoneParts), kit.stone)
  stones.castShadow = true
  stones.receiveShadow = true
  group.add(stones)
  return group
}

/** 飛石の天端高さ（M6でプレイヤーの足がわずかに乗るために使う）。 */
export function tobiishiTopAt(
  ground: GroundBuilder,
  x: number,
  z: number,
): number | null {
  for (const p of TOBIISHI_PATH) {
    const d = Math.hypot(x - p.x, z - p.z)
    if (d < 0.22) return ground.heightAt(p.x, p.z) + 0.045
  }
  const dK = Math.hypot(x - KUTSUNUGI.x, z - KUTSUNUGI.z)
  if (dK < KUTSUNUGI.w / 2) return ground.heightAt(KUTSUNUGI.x, KUTSUNUGI.z) + KUTSUNUGI.h
  return null
}
