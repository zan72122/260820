import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'
import type { RigJoints } from '../character/PlayerRig'
import type { GameState } from '../sim/GameState'
import { CAN_HOME, CAN_OUT, CROPS } from './layout'
import type { SceneHandles } from './GardenScene'

interface Snapshot {
  parent: Object3D
  position: Vector3
  quaternion: Quaternion
}

/**
 * GameState（純データ）→ シーンへの一方向同期。
 * 土の湿り uniform、収穫済み作物の切替、道具の持ち替え、注水の見た目。
 */
export class SceneSync {
  private readonly snapshots = new Map<string, Snapshot>()
  private readonly stream: Mesh

  constructor(private readonly handles: SceneHandles) {
    const snap = (key: string, obj: Object3D) => {
      this.snapshots.set(key, {
        parent: obj.parent as Object3D,
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
      })
    }
    for (const [id, group] of handles.tools.tools) snap(id, group)

    // 注水の水: 蓮口から落ちる細い流れ（パーティクルではなく実メッシュ）
    const geo = new CylinderGeometry(0.006, 0.012, 0.5, 6, 1, true)
    geo.translate(0, -0.25, 0)
    this.stream = new Mesh(
      geo,
      new MeshStandardMaterial({
        color: '#aebfc9',
        roughness: 0.15,
        transparent: true,
        opacity: 0.55,
      }),
    )
    this.stream.visible = false
    handles.player.root.parent?.add(this.stream)
  }

  apply(state: GameState, rig: RigJoints, groundY: (x: number, z: number) => number): void {
    // --- 畝の湿り -----------------------------------------------------------
    for (const [bedId, mat] of this.handles.vegBeds.bedMaterials) {
      const uniform = mat.userData.moistureUniform as { value: number } | undefined
      const bed = state.beds[bedId]
      if (uniform && bed) uniform.value = bed.moisture
    }

    // --- 作物 --------------------------------------------------------------
    for (const crop of CROPS) {
      const g = this.handles.vegBeds.cropGroups.get(crop.id)
      const c = state.crops[crop.id]
      if (!g || !c) continue
      if (crop.kind === 'daikon') {
        for (const child of g.children) {
          if (child.name === 'hole') child.visible = c.harvested
          else child.visible = !c.harvested
        }
      } else if (crop.kind === 'tomato') {
        const ripe = g.getObjectByName('ripeFruit')
        if (ripe) ripe.visible = !c.harvested
      }
    }
    for (const [id, mesh] of this.handles.tree.lowFruits) {
      const c = state.crops[id]
      if (c) mesh.visible = !c.harvested
    }

    // --- 道具の持ち替え ------------------------------------------------------
    const place = (
      id: 'wateringCan' | 'hoe' | 'broom',
      group: Group,
      placeKind: string,
    ) => {
      const snap = this.snapshots.get(id)
      if (!snap) return
      if (placeKind === 'held') {
        if (group.parent !== rig.wristR) {
          rig.wristR.add(group)
          if (id === 'wateringCan') {
            group.position.set(0.03, -0.1, -0.02)
            group.rotation.set(0, -0.3, 0)
          } else {
            group.position.set(0.02, -0.06, 0)
            group.rotation.set(0.15, 0, -0.12)
          }
        }
        if (id === 'wateringCan') {
          // 注水中は傾ける
          group.rotation.z = state.pouring ? -0.95 : 0
        }
      } else {
        if (group.parent !== snap.parent) {
          snap.parent.add(group)
        }
        if (id === 'wateringCan') {
          const spot = placeKind === 'out' ? CAN_OUT : CAN_HOME
          group.position.set(spot.x, groundY(spot.x, spot.z), spot.z)
          group.rotation.set(0, placeKind === 'out' ? 0.9 : -0.5, 0)
        } else {
          group.position.copy(snap.position)
          group.quaternion.copy(snap.quaternion)
        }
      }
    }
    for (const [id, group] of this.handles.tools.tools) {
      place(id, group, state.tools[id])
    }

    // --- 注水の見た目 --------------------------------------------------------
    if (state.pouring && state.tools.wateringCan === 'held') {
      const can = this.handles.tools.tools.get('wateringCan')
      if (can) {
        // 蓮口の先端のワールド位置から下へ
        const tip = new Vector3(0.31, 0.28, 0)
        can.updateWorldMatrix(true, false)
        tip.applyMatrix4(can.matrixWorld)
        this.stream.position.copy(tip)
        const fall = tip.y - groundY(tip.x, tip.z) - 0.1
        this.stream.scale.set(1, Math.max(0.2, fall / 0.5), 1)
        this.stream.visible = true
      }
    } else {
      this.stream.visible = false
    }
  }

  /** 注水・保持の腕上書きポーズ（walk/idle の後に呼ぶ）。 */
  applyCarryPose(state: GameState, rig: RigJoints): void {
    if (state.player.held) {
      rig.shoulderR.rotation.x = Math.min(rig.shoulderR.rotation.x, -0.12) - 0.12
      rig.elbowR.rotation.x = -0.25
    }
    if (state.pouring) {
      rig.shoulderR.rotation.x = -0.72
      rig.elbowR.rotation.x = -0.3
      rig.spine.rotation.x = 0.16
    }
  }
}
