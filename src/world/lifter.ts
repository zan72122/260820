import * as THREE from 'three';
import { TAU, clamp, clamp01, lerp } from '../core/math';
import type { QualitySettings } from '../core/quality';
import { applyMaps, cached, steelMaps, steelMetalnessMap, type SteelWear } from '../core/textures';

/**
 * The cassava root lifter.
 *
 * A real one is three parts and nothing else: a foot plate that sits on the
 * ground, a pivot standing on it, and a bar that crosses the pivot with a
 * short arm on the crop side and a long handle on the operator side. A chain
 * from the short arm carries a jaw clamp that bites the stem.
 *
 * Pushing the handle down rotates the bar about the pivot; the short arm
 * rises; the chain pulls the stem straight up. Every dimension below is the
 * real lever geometry the animation is driven by, so the force direction and
 * the fulcrum stay physically legible from any of the fixed camera angles.
 */

export const LEVER = {
  /** Distance from the stem to the fulcrum, along +Z. */
  fulcrumZ: 0.40,
  /** Height of the pivot pin above the soil. */
  pivotY: 0.34,
  /** Pivot -> chain attachment (crop side). */
  shortArm: 0.40,
  /** Pivot -> grip (operator side). */
  handleArm: 0.80,
  /** Chain length from short-arm clevis down to the clamp. */
  chain: 0.055,
  /** Handle elevation at rest, radians. */
  restPhi: 0.454,
  /**
   * Elevation after the first, tentative push. Chosen so the stem comes up by
   * roughly seven centimetres — enough that the shoulder of the thickest root
   * reaches the underside of the ground and shows through the split, and no
   * more than that.
   */
  firstPhi: 0.230,
  /** Elevation at full stroke. */
  fullPhi: -0.349,
  /** How far the foot plate presses into the soil under full load. */
  maxSink: 0.035,
} as const;

/** Height of the chain attachment point for a given handle elevation. */
export function clevisHeight(phi: number): number {
  return LEVER.pivotY - LEVER.shortArm * Math.sin(phi);
}

/** Net vertical travel delivered to the stem, sink included. */
export function liftForPhi(phi: number, sink: number): number {
  return clevisHeight(phi) - clevisHeight(LEVER.restPhi) - sink;
}

export const MAX_LIFT = liftForPhi(LEVER.fullPhi, LEVER.maxSink);

function steelMaterial(wear: SteelWear, q: QualitySettings, repeat: THREE.Vector2): THREE.MeshStandardMaterial {
  const size = Math.max(256, q.textureSize / 2);
  const maps = cached(`steel${size}${wear}`, () => steelMaps(size, wear));
  const metal = cached(`steelM${size}${wear}`, () => steelMetalnessMap(size, wear));
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.9 });
  applyMaps(mat, maps, repeat, q.anisotropy);
  const m = metal.clone();
  m.repeat.copy(repeat);
  m.needsUpdate = true;
  mat.metalnessMap = m;
  return mat;
}

export class Lifter {
  readonly group = new THREE.Group();
  /** Everything that swings about the pivot. */
  readonly bar = new THREE.Group();
  /** Foot plate + pivot post; sinks under load. */
  readonly stand = new THREE.Group();
  /** The jaw clamp; free until it bites the stem. */
  readonly clamp = new THREE.Group();
  /** Rear of the clamp body — where a finger may rest without hiding the jaws. */
  readonly clampGrabPoint = new THREE.Object3D();
  /** The worn grip at the far end of the handle. */
  readonly grip = new THREE.Object3D();
  /** Chain attachment on the short arm. */
  readonly clevis = new THREE.Object3D();

  private chain: THREE.LineSegments;
  private chainLinks: THREE.Mesh[] = [];
  private jawLeft = new THREE.Group();
  private jawRight = new THREE.Group();
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  private phi: number = LEVER.restPhi;
  private sink = 0;
  private jawClose = 0;

  constructor(q: QualitySettings) {
    const barMat = steelMaterial('pooled', q, new THREE.Vector2(1, 5));
    const standMat = steelMaterial('fulcrum', q, new THREE.Vector2(2, 2));
    const gripMat = steelMaterial('handle', q, new THREE.Vector2(1, 3));
    const jawMat = steelMaterial('jaw', q, new THREE.Vector2(2, 2));
    this.disposables.push(barMat, standMat, gripMat, jawMat);

    /* ---- foot plate + pivot post ---- */
    const plateGeom = new THREE.BoxGeometry(0.22, 0.018, 0.17);
    const plate = new THREE.Mesh(plateGeom, standMat);
    plate.position.set(0, 0.009, LEVER.fulcrumZ);
    plate.castShadow = true;
    plate.receiveShadow = true;
    this.disposables.push(plateGeom);
    this.stand.add(plate);

    // Two splayed posts carrying the pin — the load path is visible.
    const postGeom = new THREE.CylinderGeometry(0.013, 0.017, LEVER.pivotY - 0.018, 10);
    this.disposables.push(postGeom);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(postGeom, standMat);
      post.position.set(sx * 0.052, (LEVER.pivotY - 0.018) / 2 + 0.018, LEVER.fulcrumZ);
      post.rotation.z = -sx * 0.14;
      post.castShadow = true;
      this.stand.add(post);
    }
    // Cross brace, so the frame is not two lonely sticks.
    const braceGeom = new THREE.BoxGeometry(0.13, 0.012, 0.02);
    this.disposables.push(braceGeom);
    const brace = new THREE.Mesh(braceGeom, standMat);
    brace.position.set(0, 0.12, LEVER.fulcrumZ);
    brace.castShadow = true;
    this.stand.add(brace);

    const pinGeom = new THREE.CylinderGeometry(0.011, 0.011, 0.13, 12);
    this.disposables.push(pinGeom);
    const pin = new THREE.Mesh(pinGeom, steelMaterial('pooled', q, new THREE.Vector2(1, 1)));
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0, LEVER.pivotY, LEVER.fulcrumZ);
    pin.castShadow = true;
    this.stand.add(pin);

    this.group.add(this.stand);

    /* ---- the bar ---- */
    // Deeper section near the pivot where the bending moment peaks.
    const heavyLen = LEVER.shortArm + 0.28;
    const heavyGeom = new THREE.BoxGeometry(0.026, 0.048, heavyLen);
    this.disposables.push(heavyGeom);
    const heavy = new THREE.Mesh(heavyGeom, barMat);
    heavy.position.set(0, 0, -LEVER.shortArm + heavyLen / 2);
    heavy.castShadow = true;
    this.bar.add(heavy);

    const lightLen = LEVER.handleArm - 0.28;
    const lightGeom = new THREE.BoxGeometry(0.022, 0.032, lightLen);
    this.disposables.push(lightGeom);
    const light = new THREE.Mesh(lightGeom, barMat);
    light.position.set(0, 0, 0.28 + lightLen / 2);
    light.castShadow = true;
    this.bar.add(light);

    // Worn grip sleeve at the operator end.
    const gripGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.17, 12);
    this.disposables.push(gripGeom);
    const gripMesh = new THREE.Mesh(gripGeom, gripMat);
    gripMesh.rotation.x = Math.PI / 2;
    gripMesh.position.set(0, 0, LEVER.handleArm - 0.07);
    gripMesh.castShadow = true;
    this.bar.add(gripMesh);
    this.grip.position.copy(gripMesh.position);
    this.bar.add(this.grip);

    // End cap, so the bar does not read as a cut-off box.
    const capGeom = new THREE.SphereGeometry(0.021, 12, 8);
    this.disposables.push(capGeom);
    const cap = new THREE.Mesh(capGeom, gripMat);
    cap.position.set(0, 0, LEVER.handleArm + 0.012);
    this.bar.add(cap);

    // Clevis at the short-arm end.
    const clevisGeom = new THREE.BoxGeometry(0.034, 0.030, 0.030);
    this.disposables.push(clevisGeom);
    const clevisMesh = new THREE.Mesh(clevisGeom, jawMat);
    clevisMesh.position.set(0, -0.024, -LEVER.shortArm);
    clevisMesh.castShadow = true;
    this.bar.add(clevisMesh);
    this.clevis.position.set(0, -0.038, -LEVER.shortArm);
    this.bar.add(this.clevis);

    this.bar.position.set(0, LEVER.pivotY, LEVER.fulcrumZ);
    this.group.add(this.bar);

    /* ---- clamp ---- */
    const bodyGeom = new THREE.BoxGeometry(0.052, 0.038, 0.030);
    this.disposables.push(bodyGeom);
    const body = new THREE.Mesh(bodyGeom, jawMat);
    body.position.set(0, 0.028, 0);
    body.castShadow = true;
    this.clamp.add(body);

    // Shackle eye at the top: what the chain pulls on.
    const eyeGeom = new THREE.TorusGeometry(0.014, 0.005, 8, 14);
    this.disposables.push(eyeGeom);
    const eye = new THREE.Mesh(eyeGeom, jawMat);
    eye.position.set(0, 0.056, 0);
    eye.rotation.y = Math.PI / 2;
    this.clamp.add(eye);

    const armGeom = new THREE.BoxGeometry(0.012, 0.052, 0.020);
    this.disposables.push(armGeom);
    const jawGeom = new THREE.TorusGeometry(0.030, 0.0075, 8, 16, Math.PI * 0.9);
    this.disposables.push(jawGeom);
    const toothGeom = new THREE.ConeGeometry(0.004, 0.010, 5);
    this.disposables.push(toothGeom);

    for (const [side, jaw] of [
      [-1, this.jawLeft],
      [1, this.jawRight],
    ] as const) {
      const arm = new THREE.Mesh(armGeom, jawMat);
      arm.position.set(side * 0.022, 0.002, 0);
      arm.castShadow = true;
      jaw.add(arm);

      const bite = new THREE.Mesh(jawGeom, jawMat);
      bite.position.set(side * 0.026, -0.026, 0);
      bite.rotation.set(Math.PI / 2, 0, side > 0 ? Math.PI * 0.55 : Math.PI * 0.45);
      bite.castShadow = true;
      jaw.add(bite);

      // Teeth on the inside face only — the surface that meets the stem.
      for (let i = 0; i < 4; i++) {
        const a = lerp(0.5, 2.3, i / 3);
        const tooth = new THREE.Mesh(toothGeom, jawMat);
        tooth.position.set(
          side * (0.026 - Math.cos(a) * 0.024 * side),
          -0.026 + Math.sin(a) * 0.024,
          0,
        );
        tooth.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        jaw.add(tooth);
      }
      jaw.position.set(0, 0.012, 0);
      this.clamp.add(jaw);
    }

    // Hand screw that closes the jaws.
    const screwGeom = new THREE.CylinderGeometry(0.0055, 0.0055, 0.058, 8);
    this.disposables.push(screwGeom);
    const screw = new THREE.Mesh(screwGeom, gripMat);
    screw.rotation.z = Math.PI / 2;
    screw.position.set(0, 0.030, 0.020);
    this.clamp.add(screw);
    const knobGeom = new THREE.CylinderGeometry(0.013, 0.013, 0.008, 10);
    this.disposables.push(knobGeom);
    const knob = new THREE.Mesh(knobGeom, gripMat);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0.032, 0.030, 0.020);
    this.clamp.add(knob);

    // Grab anchor sits behind and above the jaws, so a fingertip placed here
    // never covers the biting edge or the stem base.
    this.clampGrabPoint.position.set(0, 0.048, 0.048);
    this.clamp.add(this.clampGrabPoint);

    this.group.add(this.clamp);

    /* ---- chain ---- */
    const chainMat = new THREE.LineBasicMaterial({ color: 0x4b4744 });
    this.disposables.push(chainMat);
    const chainGeom = new THREE.BufferGeometry();
    chainGeom.setAttribute('position', new THREE.Float32BufferAttribute(new Array(6 * 8).fill(0), 3));
    this.disposables.push(chainGeom);
    this.chain = new THREE.LineSegments(chainGeom, chainMat);
    this.chain.frustumCulled = false;
    this.group.add(this.chain);

    const linkGeom = new THREE.TorusGeometry(0.0085, 0.0026, 6, 10);
    this.disposables.push(linkGeom);
    for (let i = 0; i < 5; i++) {
      const link = new THREE.Mesh(linkGeom, jawMat);
      link.rotation.y = i % 2 === 0 ? 0 : Math.PI / 2;
      this.chainLinks.push(link);
      this.group.add(link);
    }
  }

  /** Handle elevation, radians. Drives the whole mechanism. */
  setPhi(phi: number): void {
    this.phi = clamp(phi, LEVER.fullPhi, LEVER.restPhi);
    this.bar.rotation.x = -this.phi;
    // Load rises as the handle comes down; the foot plate presses in.
    const load = clamp01((LEVER.restPhi - this.phi) / (LEVER.restPhi - LEVER.fullPhi));
    this.sink = load * LEVER.maxSink;
    this.stand.position.y = -this.sink;
    this.bar.position.y = LEVER.pivotY - this.sink;
  }

  get currentPhi(): number {
    return this.phi;
  }

  get currentSink(): number {
    return this.sink;
  }

  /** Net lift delivered to whatever the chain is holding. */
  get lift(): number {
    return liftForPhi(this.phi, this.sink);
  }

  /** 0 = jaws open, 1 = jaws bitten shut. */
  setJaw(t: number): void {
    this.jawClose = clamp01(t);
    const a = lerp(0.36, 0.0, this.jawClose);
    this.jawLeft.rotation.z = -a;
    this.jawRight.rotation.z = a;
  }

  get jaw(): number {
    return this.jawClose;
  }

  /** Redraw the chain between the clevis and the clamp shackle. */
  updateChain(slackPhase: number): void {
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    this.clevis.getWorldPosition(from);
    this.clamp.getWorldPosition(to);
    to.y += 0.056;
    this.group.worldToLocal(from);
    this.group.worldToLocal(to);

    const dist = from.distanceTo(to);
    // Slack only exists when the chain is not carrying anything.
    const slack = Math.max(0, LEVER.chain - dist) * 0.9;
    const pts: number[] = [];
    const n = this.chainLinks.length;
    const p = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      p.lerpVectors(from, to, t);
      p.y -= Math.sin(t * Math.PI) * slack;
      p.x += Math.sin(t * Math.PI) * slack * 0.3 * Math.sin(slackPhase);
      pts.push(p.x, p.y, p.z);
      if (i < n) {
        const link = this.chainLinks[i]!;
        const t2 = (i + 0.5) / n;
        link.position.lerpVectors(from, to, t2);
        link.position.y -= Math.sin(t2 * Math.PI) * slack;
        link.position.x += Math.sin(t2 * Math.PI) * slack * 0.3 * Math.sin(slackPhase);
        link.lookAt(to);
        link.rotateY(i % 2 === 0 ? 0 : Math.PI / 2);
      }
    }
    const arr: number[] = [];
    for (let i = 0; i < n; i++) {
      arr.push(pts[i * 3]!, pts[i * 3 + 1]!, pts[i * 3 + 2]!);
      arr.push(pts[(i + 1) * 3]!, pts[(i + 1) * 3 + 1]!, pts[(i + 1) * 3 + 2]!);
    }
    const attr = this.chain.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < arr.length; i++) (attr.array as Float32Array)[i] = arr[i]!;
    attr.needsUpdate = true;
  }

  /** Where the chain would hang the clamp if nothing were holding it. */
  restingClampPosition(out: THREE.Vector3): THREE.Vector3 {
    this.clevis.getWorldPosition(out);
    out.y -= LEVER.chain + 0.056;
    return out;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}

export { TAU };
