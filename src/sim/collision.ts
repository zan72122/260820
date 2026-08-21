/** Static collision: player circle vs axis-aligned boxes and circles.
 * Pure math, unit-testable; the collider list comes from scene/layout.ts. */

export interface BoxCollider {
  kind: 'box'
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface CircleCollider {
  kind: 'circle'
  x: number
  z: number
  r: number
}

export type Collider = BoxCollider | CircleCollider

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function isBlocked(
  x: number,
  z: number,
  r: number,
  colliders: readonly Collider[],
): boolean {
  for (const c of colliders) {
    if (c.kind === 'box') {
      const dx = Math.max(c.minX - x, 0, x - c.maxX)
      const dz = Math.max(c.minZ - z, 0, z - c.maxZ)
      if (dx * dx + dz * dz < r * r - 1e-9) return true
    } else {
      const dx = x - c.x
      const dz = z - c.z
      const minD = r + c.r
      if (dx * dx + dz * dz < minD * minD - 1e-9) return true
    }
  }
  return false
}

/**
 * Push a circle of radius r at (x,z) out of every collider and clamp to the
 * walkable bounds. Iterative so corner overlaps of several colliders resolve.
 */
export function resolveCollisions(
  x: number,
  z: number,
  r: number,
  colliders: readonly Collider[],
  bounds: Bounds,
): { x: number; z: number } {
  let px = x
  let pz = z
  for (let iter = 0; iter < 4; iter++) {
    let moved = false
    for (const c of colliders) {
      if (c.kind === 'box') {
        const nearestX = Math.max(c.minX, Math.min(c.maxX, px))
        const nearestZ = Math.max(c.minZ, Math.min(c.maxZ, pz))
        const dx = px - nearestX
        const dz = pz - nearestZ
        const d2 = dx * dx + dz * dz
        if (d2 < r * r) {
          if (d2 > 1e-12) {
            const d = Math.sqrt(d2)
            px = nearestX + (dx / d) * r
            pz = nearestZ + (dz / d) * r
          } else {
            // Centre is inside the box: exit through the nearest face whose
            // landing spot is itself clear (avoids ping-ponging between two
            // touching boxes).
            const exits = [
              { d: px - c.minX, x: c.minX - r, z: pz },
              { d: c.maxX - px, x: c.maxX + r, z: pz },
              { d: pz - c.minZ, x: px, z: c.minZ - r },
              { d: c.maxZ - pz, x: px, z: c.maxZ + r },
            ]
            exits.sort((a, b) => a.d - b.d)
            const clear = exits.find((e) => !isBlocked(e.x, e.z, r, colliders))
            const e = clear ?? exits[0]
            if (e) {
              px = e.x
              pz = e.z
            }
          }
          moved = true
        }
      } else {
        const dx = px - c.x
        const dz = pz - c.z
        const minD = r + c.r
        const d2 = dx * dx + dz * dz
        if (d2 < minD * minD) {
          const d = Math.sqrt(Math.max(d2, 1e-12))
          px = c.x + (dx / d) * minD
          pz = c.z + (dz / d) * minD
          moved = true
        }
      }
    }
    if (!moved) break
  }
  px = Math.max(bounds.minX + r, Math.min(bounds.maxX - r, px))
  pz = Math.max(bounds.minZ + r, Math.min(bounds.maxZ - r, pz))
  return { x: px, z: pz }
}
