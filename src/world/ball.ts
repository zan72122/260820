import * as THREE from 'three';
import { clamp01, damp } from '../util/math';
import type { BallSpec } from '../physics/params';

const _axis = new THREE.Vector3();

/**
 * The test ball.
 *
 * Two nested transforms: an outer node that squashes along the contact normal,
 * and an inner mesh that carries the spin. Because the squash is applied in the
 * parent frame, the ball flattens against whatever it has landed on while its
 * surface keeps rotating — which is how the child sees that it is the *same*
 * ball each time, just treated differently by each floor.
 *
 * The contact shadow is a separate always-on element. Dynamic shadows can be
 * dropped when quality falls, but a ball that appears to float above the floor
 * would break the causal read, so this one never turns off.
 */
export class BallView {
  readonly group = new THREE.Group();
  readonly squashNode = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly shadow: THREE.Mesh;

  private spinQuat = new THREE.Quaternion();
  private squashQuat = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private wetness = 0;
  private spec: BallSpec;
  private material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  private baseRoughness = 1;
  private baseClearcoat = 0;

  private segments: number;

  constructor(spec: BallSpec, material: THREE.Material, segments = 48) {
    this.spec = spec;
    this.segments = segments;
    const geo = new THREE.SphereGeometry(spec.radius, segments, Math.round(segments * 0.6));
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.squashNode.add(this.mesh);
    this.group.add(this.squashNode);
    this.material = material as THREE.MeshStandardMaterial;
    this.baseRoughness = this.material.roughness;
    this.baseClearcoat = (this.material as THREE.MeshPhysicalMaterial).clearcoat ?? 0;

    this.shadow = new THREE.Mesh(contactShadowGeometry(), contactShadowMaterial());
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 4;
    this.shadow.matrixAutoUpdate = true;
  }

  get radius() {
    return this.spec.radius;
  }

  /** Swap in a different specimen: new size, new surface, same rig. */
  setSpec(spec: BallSpec, material: THREE.Material) {
    const changedSize = Math.abs(spec.radius - this.spec.radius) > 1e-6;
    this.spec = spec;
    if (changedSize) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.SphereGeometry(
        spec.radius,
        this.segments,
        Math.round(this.segments * 0.6)
      );
    }
    this.wetness = 0;
    this.mesh.quaternion.identity();
    this.setMaterial(material);
  }

  setMaterial(material: THREE.Material) {
    this.mesh.material = material;
    this.material = material as THREE.MeshStandardMaterial;
    this.baseRoughness = this.material.roughness;
    this.baseClearcoat = (this.material as THREE.MeshPhysicalMaterial).clearcoat ?? 0;
  }

  /** Splash the ball wet; it dries off over the next few seconds. */
  wet(amount: number) {
    this.wetness = clamp01(Math.max(this.wetness, amount));
  }

  get isWet() {
    return this.wetness > 0.02;
  }

  /**
   * @param position   ball centre in world space
   * @param spin       angular velocity, rad/s
   * @param squash     0..1 compression amount
   * @param squashAxis unit vector the compression acts along
   * @param groundY    surface height directly beneath, for the contact shadow
   */
  update(
    dt: number,
    position: THREE.Vector3,
    spin: THREE.Vector3,
    squash: number,
    squashAxis: THREE.Vector3,
    groundY: number
  ) {
    this.group.position.copy(position);

    // Spin.
    const w = spin.length();
    if (w > 1e-5) {
      _axis.copy(spin).multiplyScalar(1 / w);
      this.spinQuat.setFromAxisAngle(_axis, w * dt);
      this.mesh.quaternion.premultiply(this.spinQuat);
    }

    // Volume-preserving squash along the contact normal.
    const s = clamp01(squash) * this.spec.squash;
    this.squashQuat.setFromUnitVectors(this.up, squashAxis);
    this.squashNode.quaternion.copy(this.squashQuat);
    const sy = 1 - s;
    const sxz = 1 / Math.sqrt(Math.max(sy, 0.05));
    this.squashNode.scale.set(sxz, sy, sxz);

    // Contact shadow: tight and dark when the ball is on the surface, wide and
    // faint as it rises. This is the cue that keeps the ball grounded.
    const h = Math.max(0, position.y - this.spec.radius - groundY);
    const spread = 1 + Math.min(h * 1.5, 2.2);
    const size = this.spec.radius * 2.35 * spread;
    this.shadow.scale.set(size, size, 1);
    this.shadow.position.set(position.x, groundY + 0.0025, position.z);
    const mat = this.shadow.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.66 / (spread * spread) + 0.04;

    // Water dries off: roughness climbs back and the film loses its gloss.
    if (this.wetness > 0) {
      this.wetness = Math.max(0, damp(this.wetness, 0, 0.35, dt) - dt * 0.012);
      this.material.roughness = this.baseRoughness * (1 - this.wetness * 0.75);
      const phys = this.material as THREE.MeshPhysicalMaterial;
      if (phys.isMeshPhysicalMaterial) {
        phys.clearcoat = Math.max(this.baseClearcoat, this.wetness);
        phys.clearcoatRoughness = 0.06 + (1 - this.wetness) * 0.4;
      }
    }
  }

  dispose() {
    // The shadow's geometry and texture are shared across specimens, so only
    // the ball's own geometry and this instance's shadow material go.
    this.mesh.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}

let sharedShadowTexture: THREE.Texture | null = null;
let sharedShadowGeometry: THREE.PlaneGeometry | null = null;

function contactShadowGeometry() {
  if (!sharedShadowGeometry) sharedShadowGeometry = new THREE.PlaneGeometry(1, 1);
  return sharedShadowGeometry;
}

function contactShadowTexture() {
  if (sharedShadowTexture) return sharedShadowTexture;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // A contact shadow is dense right under the ball and falls away fast.
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.34, 'rgba(0,0,0,0.86)');
  g.addColorStop(0.66, 'rgba(0,0,0,0.34)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  sharedShadowTexture = new THREE.CanvasTexture(c);
  sharedShadowTexture.colorSpace = THREE.NoColorSpace;
  return sharedShadowTexture;
}

function contactShadowMaterial() {
  return new THREE.MeshBasicMaterial({
    map: contactShadowTexture(),
    transparent: true,
    depthWrite: false,
    // Multiplicative darkening, so the shadow sits *in* the floor texture
    // rather than as a grey disc painted over it.
    blending: THREE.CustomBlending,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
    toneMapped: false,
  });
}
