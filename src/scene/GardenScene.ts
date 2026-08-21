import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from 'three'
import type { Flags } from '../core/flags'
import { sunDirection } from './layout'

/**
 * Assembles the world into the scene. Milestone 0 contents: a ground plane,
 * provisional sun/sky light and three proxy boxes at near/mid/far distances
 * to validate depth layering. Later milestones replace these with the real
 * builders.
 */
export interface SceneHandles {
  /** Objects the per-frame sync may need to touch. */
  playerRoot: Mesh
}

export function buildGardenScene(scene: Scene, flags: Flags): SceneHandles {
  void flags
  scene.background = new Color('#c9a27c')

  const ground = new Mesh(
    new PlaneGeometry(30, 30),
    new MeshStandardMaterial({ color: '#8a7355', roughness: 1.0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const sun = new DirectionalLight('#ffb066', 2.5)
  const dir = sunDirection()
  sun.position.set(dir.x * 50, dir.y * 50, dir.z * 50)
  scene.add(sun)
  scene.add(new HemisphereLight('#7d87ae', '#7a5c40', 0.4))

  // Depth-layer proxies (near 5 m / mid 30 m / far 300 m), removed in M3+.
  const proxyMat = new MeshStandardMaterial({ color: '#9c8f7a', roughness: 0.9 })
  const near = new Mesh(new BoxGeometry(1, 1, 1), proxyMat)
  near.position.set(2, 0.5, -3)
  const mid = new Mesh(new BoxGeometry(6, 4, 6), proxyMat)
  mid.position.set(-12, 2, -28)
  const far = new Mesh(new BoxGeometry(120, 60, 40), proxyMat)
  far.position.set(60, 30, -290)
  scene.add(near, mid, far)

  // Player stand-in until the real rig lands (M6).
  const playerRoot = new Mesh(
    new BoxGeometry(0.4, 1.3, 0.3),
    new MeshStandardMaterial({ color: '#3a4a6b', roughness: 0.9 }),
  )
  playerRoot.position.y = 0.65
  scene.add(playerRoot)

  return { playerRoot }
}
