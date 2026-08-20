import * as THREE from 'three';
import { Rng, clamp01, lerp } from '../core/math';
import type { QualitySettings } from '../core/quality';
import type { SoilKind } from '../core/textures';
import { LEVER, Lifter } from './lifter';
import { RootCluster, type ArchetypeName } from './root';
import { GrainField, SoilPatch } from './soil';
import { Stem } from './stem';
import { makeContactShadow } from './environment';

/**
 * One plant, its ground, and the tool standing next to it.
 *
 * The rules never change between plots: the clamp always goes to the stem
 * base, the stem always takes three rocks, and the lever is always the same
 * length with the same two-stage stroke. What changes is the plant — how many
 * roots, how they fan out, the mix of long-thin and short-stout, how big the
 * clods are, how the stem leans, and whether the ground is red ferralitic or
 * pale sandy.
 */

export const PLOT_SPACING = 1.5;
/** The field itself is red ferralitic; sandier plots tint out of it locally. */
export const FIELD_SOIL: SoilKind = 'ferralitic';
/** Depth of the stem node below the soil line. */
export const NODE_DEPTH = 0.065;
/** Rocks required to loosen the stem. Identical for every plot, by design. */
export const ROCKS_REQUIRED = 3;

export interface PlotVariation {
  archetype: ArchetypeName;
  soil: SoilKind;
  clodScale: number;
  stemTilt: number;
  stemHeight: number;
  facing: number;
  mound: number;
}

/**
 * Hand-ordered so the first plant is the clearest possible reading of the
 * idea, and each following one changes exactly one or two things.
 */
export const VARIATIONS: PlotVariation[] = [
  // 1: open fan, upright stem, red soil — the clearest first read.
  { archetype: 'openFan', soil: 'ferralitic', clodScale: 0.45, stemTilt: 0.0, stemHeight: 0.27, facing: -0.35, mound: 0.030 },
  // 2: few, stout roots and heavier clods.
  { archetype: 'tightBunch', soil: 'ferralitic', clodScale: 0.85, stemTilt: 0.10, stemHeight: 0.23, facing: -1.05, mound: 0.038 },
  // 3: everything on one side, in loose sandy soil.
  { archetype: 'lopsided', soil: 'sandy', clodScale: 0.30, stemTilt: 0.17, stemHeight: 0.29, facing: 0.55, mound: 0.022 },
  // 4: deep, steep roots under a small stub.
  { archetype: 'plunge', soil: 'ferralitic', clodScale: 0.95, stemTilt: 0.05, stemHeight: 0.21, facing: -0.20, mound: 0.042 },
  // 5: two lobes, many roots, sandy again.
  { archetype: 'twinLobe', soil: 'sandy', clodScale: 0.55, stemTilt: 0.13, stemHeight: 0.26, facing: 1.20, mound: 0.026 },
  // 6: back to a wide fan, but bigger and leaning the other way.
  { archetype: 'openFan', soil: 'ferralitic', clodScale: 0.70, stemTilt: -0.12, stemHeight: 0.30, facing: 2.05, mound: 0.034 },
];

export class Plot {
  readonly group = new THREE.Group();
  readonly stem: Stem;
  readonly cluster: RootCluster;
  readonly patch: SoilPatch;
  readonly lifter: Lifter;
  readonly grains: GrainField;
  readonly variation: PlotVariation;
  readonly index: number;

  /** Group carrying whatever the clamp has hold of. */
  private liftGroup = new THREE.Group();
  private clusterAnchor = new THREE.Group();
  private stemShadow: THREE.Mesh;
  private toolShadow: THREE.Mesh;
  private lift = 0;

  constructor(index: number, variation: PlotVariation, q: QualitySettings) {
    this.index = index;
    this.variation = variation;
    const seed = 1000 + index * 977;
    const rng = new Rng(seed ^ 0x77);

    this.cluster = new RootCluster(
      {
        seed,
        archetype: variation.archetype,
        soil: variation.soil,
        facing: variation.facing,
        clodScale: variation.clodScale,
      },
      q,
    );

    this.patch = new SoilPatch(
      {
        seed,
        soil: variation.soil,
        fieldSoil: FIELD_SOIL,
        layout: this.cluster.layout,
        mound: variation.mound,
        heroAzimuth: this.cluster.heroAzimuth,
      },
      q,
    );

    this.stem = new Stem(
      {
        seed,
        height: variation.stemHeight,
        tilt: variation.stemTilt,
        tiltAzimuth: variation.facing + rng.jitter(0.4),
        baseRadius: 0.023,
      },
      q,
    );

    this.lifter = new Lifter(q);
    this.grains = new GrainField(q, variation.soil);

    // The node sits below the soil line; everything above and below it moves
    // together as one plant.
    this.clusterAnchor.position.y = -NODE_DEPTH;
    this.clusterAnchor.add(this.cluster.group);
    this.liftGroup.add(this.stem.group, this.clusterAnchor);

    this.stemShadow = makeContactShadow(0.09);
    this.stemShadow.position.y = 0.004;
    this.toolShadow = makeContactShadow(0.17);
    this.toolShadow.position.set(0, 0.004, LEVER.fulcrumZ);

    this.group.add(
      this.patch.group,
      this.liftGroup,
      this.lifter.group,
      this.grains.points,
      this.stemShadow,
      this.toolShadow,
    );

    // The tool waits beside the row, angled in, until the clamp is carried
    // across to the stem. Nothing about it is labelled; its shape is the label.
    this.lifter.group.position.set(0.27, 0, 0.17);
    this.lifter.group.rotation.y = -0.30;
    this.lifter.setPhi(LEVER.restPhi);
    this.lifter.setJaw(0);
  }

  /** World-space point where the clamp must bite. */
  gripWorldPoint(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.stem.gripPoint);
    this.liftGroup.updateWorldMatrix(true, false);
    this.liftGroup.localToWorld(out);
    return out;
  }

  /** Slide the tool into its working position beside the stem. */
  seatTool(t: number): void {
    const k = clamp01(t);
    this.lifter.group.position.set(lerp(0.27, 0, k), 0, lerp(0.17, 0, k));
    this.lifter.group.rotation.y = lerp(-0.30, 0, k);
    this.toolShadow.position.set(
      this.lifter.group.position.x,
      0.004,
      this.lifter.group.position.z + LEVER.fulcrumZ,
    );
  }

  /** Vertical travel currently applied to the plant, metres. */
  get currentLift(): number {
    return this.lift;
  }

  setLift(metres: number): void {
    this.lift = Math.max(0, metres);
    this.liftGroup.position.y = this.lift;
    this.cluster.setLift(this.lift);
    // The plant leaves the ground, so its contact shadow has to leave with it.
    const fade = clamp01(1 - this.lift * 3.2);
    (this.stemShadow.material as THREE.MeshBasicMaterial).opacity = 0.42 * fade;
  }

  /**
   * Cluster sits inside the crater until the lift clears it, at which point
   * the last soil bridges break.
   */
  get clearsHole(): boolean {
    return this.lift >= this.cluster.maxDepth + NODE_DEPTH - 0.01;
  }

  update(dt: number, rock: number): void {
    // The cluster is bolted to the stem: one object, above and below ground.
    this.cluster.update(dt, rock);
    this.patch.update(dt);
    this.grains.update(dt, -this.cluster.maxDepth - 0.15);
    this.liftGroup.rotation.z = rock * 0.05;
  }

  /**
   * Move only the plant. The hole it came out of, the tool and the fallen soil
   * all stay exactly where they were, which is what lets the player compare
   * the cluster with the crater while carrying it.
   */
  setCarry(x: number, z: number): void {
    this.liftGroup.position.x = x;
    this.liftGroup.position.z = z;
  }

  get carryOffset(): THREE.Vector2 {
    return new THREE.Vector2(this.liftGroup.position.x, this.liftGroup.position.z);
  }

  hidePlant(): void {
    this.liftGroup.visible = false;
    this.stemShadow.visible = false;
  }

  hideTool(): void {
    this.lifter.group.visible = false;
    this.toolShadow.visible = false;
  }

  /** Emit falling grains from a point in plot space. */
  spill(local: THREE.Vector3, count: number, spread = 0.06): void {
    this.grains.emit(local, count, spread);
  }

  dispose(): void {
    this.cluster.dispose();
    this.patch.dispose();
    this.stem.dispose();
    this.lifter.dispose();
    this.grains.dispose();
    (this.stemShadow.material as THREE.Material).dispose();
    this.stemShadow.geometry.dispose();
    (this.toolShadow.material as THREE.Material).dispose();
    this.toolShadow.geometry.dispose();
    this.group.removeFromParent();
  }
}
