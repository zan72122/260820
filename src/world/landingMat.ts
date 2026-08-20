import { BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { MaterialLibrary } from '../render/materials';
import { roundedBox } from '../objects/geometry';
import { clamp, damp } from '../core/math';
import type { MatState } from '../sim/simulate';

export const MAT_HALF_X = 0.62;
export const MAT_HALF_Z = 0.5;
export const MAT_THICKNESS = 0.052;

/**
 * The soft landing pad. It is not a scoring target — it is a place to put a
 * guess. When something lands on it the foam actually gives way under the
 * contact point, and springs back afterwards.
 */
export class LandingMat {
  readonly root = new Group();
  readonly mesh: Mesh;
  readonly state: MatState = {
    x: 5.9,
    z: 0,
    halfX: MAT_HALF_X,
    halfZ: MAT_HALF_Z,
    thickness: MAT_THICKNESS,
    present: false,
    depression: 0,
  };
  private rest: Float32Array;
  private dipAmount = 0;
  private dipTarget = 0;
  private dipX = 0;
  private dipZ = 0;

  constructor(lib: MaterialLibrary) {
    this.root.name = 'landingMat';
    const geo = roundedBox(MAT_HALF_X * 2, MAT_THICKNESS, MAT_HALF_Z * 2, 0.03, 9);
    this.rest = (geo.attributes.position as BufferAttribute).array.slice() as Float32Array;
    const cloth = lib.felt().clone();
    cloth.color.set('#7fa8bd').convertSRGBToLinear();
    cloth.sheenColor.set('#cfe4ee').convertSRGBToLinear();
    this.mesh = new Mesh(geo, cloth);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'grab:mat';
    this.root.add(this.mesh);

    // A webbing edge so the pad reads as a made object.
    const trim = new Mesh(
      roundedBox(MAT_HALF_X * 2 + 0.03, MAT_THICKNESS * 0.5, MAT_HALF_Z * 2 + 0.03, 0.02, 4),
      lib.rubber('#243138'),
    );
    trim.position.y = -MAT_THICKNESS * 0.28;
    trim.receiveShadow = true;
    this.root.add(trim);

    this.root.visible = false;
    this.root.position.set(this.state.x, MAT_THICKNESS / 2, this.state.z);
  }

  setPresent(v: boolean): void {
    this.state.present = v;
    this.root.visible = v;
  }

  moveTo(x: number, z: number): void {
    this.state.x = x;
    this.state.z = z;
    this.root.position.set(x, MAT_THICKNESS / 2, z);
  }

  /** Push the foam down under a world-space contact point. */
  press(worldX: number, worldZ: number, strength: number): void {
    this.dipX = clamp(worldX - this.state.x, -MAT_HALF_X, MAT_HALF_X);
    this.dipZ = clamp(worldZ - this.state.z, -MAT_HALF_Z, MAT_HALF_Z);
    this.dipTarget = Math.max(this.dipTarget, clamp(strength, 0, 1));
  }

  update(dt: number, held: boolean): void {
    this.dipTarget = held ? this.dipTarget : damp(this.dipTarget, 0, 0.06, dt);
    this.dipAmount = damp(this.dipAmount, this.dipTarget, held ? 0.55 : 0.14, dt);
    this.state.depression = this.dipAmount;
    if (!this.root.visible) return;

    const pos = this.mesh.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    const r2 = 0.055;
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      const k = i * 3;
      const x = this.rest[k];
      const y = this.rest[k + 1];
      const z = this.rest[k + 2];
      const dx = x - this.dipX;
      const dz = z - this.dipZ;
      const fall = Math.exp(-(dx * dx + dz * dz) / r2);
      // The top surface sinks; the base only follows a little.
      const w = y > 0 ? 1 : 0.25;
      const ny = y - this.dipAmount * MAT_THICKNESS * 1.35 * fall * w;
      if (arr[k + 1] !== ny) {
        arr[k + 1] = ny;
        changed = true;
      }
    }
    if (changed) {
      pos.needsUpdate = true;
      this.mesh.geometry.computeVertexNormals();
    }
  }

  /** True if a world point is over the pad (used for dragging). */
  contains(x: number, z: number, pad = 0.12): boolean {
    return (
      Math.abs(x - this.state.x) <= MAT_HALF_X + pad && Math.abs(z - this.state.z) <= MAT_HALF_Z + pad
    );
  }

  worldPosition(out = new Vector3()): Vector3 {
    return out.set(this.state.x, MAT_THICKNESS, this.state.z);
  }
}
