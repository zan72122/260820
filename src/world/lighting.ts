import * as THREE from 'three'
import { FAST } from '../core/flags'

export interface Lights {
  key: THREE.DirectionalLight
  spec: THREE.SpotLight
  rim: THREE.DirectionalLight
  fill: THREE.HemisphereLight
  cavity: THREE.PointLight
}

/**
 * Soft key so the cut face reads, a tight top spot for candy speculars, a cool
 * rim to lift the cake off the kitchen, and a dim point inside the cavity so the
 * hole never goes to pure black. Only the key casts shadows, and its shadow
 * camera is sized to the cake alone.
 */
export function setupLighting(scene: THREE.Scene): Lights {
  const fill = new THREE.HemisphereLight(0xffe9d2, 0x33261e, 0.52)
  scene.add(fill)

  const key = new THREE.DirectionalLight(0xfff0da, 3.6)
  key.position.set(-16, 30, 20)
  key.target.position.set(0, 5, 0)
  scene.add(key, key.target)
  if (!FAST) {
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    const c = key.shadow.camera
    c.left = -22
    c.right = 22
    c.top = 22
    c.bottom = -22
    c.near = 8
    c.far = 78
    c.updateProjectionMatrix()
    key.shadow.bias = -0.0009
    key.shadow.normalBias = 0.05
    key.shadow.radius = 2.6
  }

  const spec = new THREE.SpotLight(0xffffff, 260, 60, Math.PI / 5, 0.55, 1.6)
  spec.position.set(4, 34, 6)
  spec.target.position.set(0, 6, 0)
  scene.add(spec, spec.target)

  const rim = new THREE.DirectionalLight(0x9dc6ff, 1.5)
  rim.position.set(14, 13, -22)
  rim.target.position.set(0, 5, 0)
  scene.add(rim, rim.target)

  const cavity = new THREE.PointLight(0xffd9ad, 9, 16, 1.7)
  cavity.position.set(0, 6.5, 0)
  scene.add(cavity)

  const bounce = new THREE.DirectionalLight(0xffcf9d, 0.32)
  bounce.position.set(6, -4, 14)
  scene.add(bounce)

  return { key, spec, rim, fill, cavity }
}
