import {
  Color, InstancedMesh, Matrix4, Mesh, Object3D, PointLight, Quaternion,
  Texture, Vector3, type IUniform,
} from 'three';
import { Rand } from '../core/Rand';
import { clamp, damp } from '../core/Easing';
import type { QualitySettings } from '../core/Quality';
import { PaintMask } from '../gfx/PaintMask';
import { createSparkles } from '../gfx/Sparkles';
import { SeamGlow } from '../gfx/SeamGlow';
import {
  createCrystalMaterial, createDruzyMaterial, createShellMaterial, u,
} from '../gfx/materials';
import {
  buildCrystalGeometry, buildGeodeHalf, defaultShape, placeCrystals, seamOffsetAt,
  type GeodeShape,
} from './geodeGeometry';
import type { Variety } from './varieties';

const _v = new Vector3();
const _q = new Quaternion();
const _m = new Matrix4();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);

export interface GeodeOptions {
  seed: number;
  variety: Variety;
  quality: QualitySettings;
  envMap: Texture | null;
  dpr: number;
  uTime: IUniform<number>;
}

/**
 * One geode: two mating halves, the crystals inside, the masks the player
 * paints on by washing and dusting, and the light that escapes when it opens.
 */
export class Geode {
  readonly root = new Object3D();
  /** Rotated/tilted when the stone is held up to the light. */
  readonly carrier = new Object3D();
  readonly bottom = new Object3D();
  /** Hinge the lid swings on; the lid mesh is offset forward from it. */
  readonly hinge = new Object3D();
  readonly top = new Object3D();

  readonly shape: GeodeShape;
  readonly variety: Variety;
  readonly seed: number;

  readonly mud: PaintMask;
  readonly wet: PaintMask;
  readonly powderBottom: PaintMask;
  readonly powderTop: PaintMask;

  readonly shellMeshes: Mesh[] = [];
  readonly cavityMeshes: Mesh[] = [];

  readonly seamGlow: SeamGlow;
  readonly innerLight: PointLight;

  /** 0 = shut, 1 = fully swung open. */
  openAmount = 0;
  /** Straight-line separation of the halves, in world units. */
  gap = 0;

  readonly uHint = u(0);
  readonly uSeamGlow = u(0);
  readonly uStress = u(0);
  readonly uStressLon = u(Math.PI / 2);
  readonly uCrystalGlow = u(0);
  readonly uSparkle = u(0);

  private readonly uHue: IUniform<Color>;
  private readonly uSeed = u(new Vector3());
  private readonly disposables: { dispose(): void }[] = [];
  private readonly maxAngle = 2.02;
  private readonly closedGap: number;
  private crystalCount = 0;

  constructor(opts: GeodeOptions) {
    const rand = new Rand(opts.seed);
    this.seed = opts.seed;
    this.variety = opts.variety;
    const q = opts.quality;

    this.shape = defaultShape(opts.seed, rand);
    this.shape.nu = q.geodeNu;
    this.shape.nvOut = q.geodeNvOut;
    this.shape.nvIn = q.geodeNvIn;

    // A hair of separation even when "shut": the two break surfaces are the
    // same surface, and coincident faces z-fight on tile-based mobile GPUs.
    this.closedGap = this.shape.radius * 0.007;

    this.uSeed.value.set(rand.range(-40, 40), rand.range(-40, 40), rand.range(-40, 40));
    this.uHue = u(opts.variety.hue.clone());

    this.mud = new PaintMask('erode', { width: q.maskSize, aspect: 2 });
    this.wet = new PaintMask('accum', { width: q.maskSize, aspect: 2 });
    this.powderBottom = new PaintMask('erode', { width: q.maskSize, aspect: 1 });
    this.powderTop = new PaintMask('erode', { width: q.maskSize, aspect: 1 });
    this.disposables.push(this.mud, this.wet, this.powderBottom, this.powderTop);

    const shellMat = createShellMaterial({
      uMud: u(this.mud.texture),
      uWet: u(this.wet.texture),
      uTime: opts.uTime,
      uSeed: this.uSeed,
      uHue: this.uHue,
      uHint: this.uHint,
      uSeamGlow: this.uSeamGlow,
      uSeamAmp: u(this.shape.seamAmp),
      uSeamPhase: u(this.shape.seamPhase),
      uStoneTint: u(opts.variety.stone.clone()),
      uStress: this.uStress,
      uStressLon: this.uStressLon,
    });
    if (opts.envMap) shellMat.envMap = opts.envMap;
    this.disposables.push(shellMat);

    this.crystalCount = Math.max(28, Math.round(opts.variety.crystalCount * q.crystalMul));

    const makeHalf = (sign: 1 | -1, parent: Object3D, powder: PaintMask) => {
      const druzyMat = createDruzyMaterial({
        uPowder: u(powder.texture),
        uTime: opts.uTime,
        uSeed: this.uSeed,
        uHue: this.uHue,
        uGlow: this.uCrystalGlow,
        uCavityR: u(this.shape.cavityR),
        uDiscSign: u(1),
      });
      if (opts.envMap) druzyMat.envMap = opts.envMap;
      this.disposables.push(druzyMat);

      const geo = buildGeodeHalf(sign, this.shape);
      const mesh = new Mesh(geo, [shellMat, druzyMat]);
      mesh.castShadow = q.shadows;
      mesh.receiveShadow = q.shadows;
      parent.add(mesh);
      this.shellMeshes.push(mesh);
      this.cavityMeshes.push(mesh);
      this.disposables.push(geo);

      // ---- crystals ----
      const crystalMat = createCrystalMaterial({
        uHue: this.uHue,
        uGlow: this.uCrystalGlow,
        uTime: opts.uTime,
        uClarity: u(opts.variety.clarity),
        uPowder: u(powder.texture),
        uCavityR: u(this.shape.cavityR),
        uDiscSign: u(1),
      }, opts.variety.iridescent);
      if (opts.envMap) crystalMat.envMap = opts.envMap;
      this.disposables.push(crystalMat);

      const cgeo = buildCrystalGeometry(rand);
      this.disposables.push(cgeo);

      const places = placeCrystals(sign, this.shape, this.crystalCount, opts.variety.crystalScale, rand);
      const inst = new InstancedMesh(cgeo, crystalMat, places.length);
      inst.castShadow = false;
      inst.receiveShadow = q.shadows;
      inst.frustumCulled = false;

      const tips: Vector3[] = [];
      const tint = new Color();
      for (let i = 0; i < places.length; i++) {
        const p = places[i];
        _q.setFromUnitVectors(UP, p.normal);
        // Sink the base into the rock so crystals grow out instead of resting on.
        _v.copy(p.position).addScaledVector(p.normal, -p.height * 0.16);
        _s.set(p.radius, p.height, p.radius);
        _m.compose(_v, _q, _s);
        inst.setMatrixAt(i, _m);
        const g = rand.range(0.82, 1.18);
        tint.setRGB(g * rand.range(0.95, 1.05), g, g * rand.range(0.95, 1.06));
        inst.setColorAt(i, tint);
        tips.push(p.position.clone().addScaledVector(p.normal, p.height * 0.9));
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      parent.add(inst);

      if (q.sparkles) {
        const step = Math.max(1, Math.round(1 / Math.min(1, q.particleMul)));
        const picked = tips.filter((_, i) => i % step === 0);
        const sp = createSparkles(picked, opts.uTime, this.uSparkle, opts.variety.hue, opts.dpr);
        parent.add(sp);
        this.disposables.push(sp.geometry, sp.material as unknown as { dispose(): void });
      }
    };

    // ---- assemble ----
    this.hinge.position.set(0, 0, -this.shape.radius * 1.04);
    this.top.position.set(0, 0, this.shape.radius * 1.04);
    this.hinge.add(this.top);

    makeHalf(-1, this.bottom, this.powderBottom);
    makeHalf(1, this.top, this.powderTop);

    this.carrier.add(this.bottom, this.hinge);
    this.root.add(this.carrier);

    this.seamGlow = new SeamGlow(this.shape.radius, opts.uTime);
    this.seamGlow.uColor.value.copy(opts.variety.hue);
    this.carrier.add(this.seamGlow.mesh);
    this.disposables.push(this.seamGlow);

    this.innerLight = new PointLight(opts.variety.hue.clone(), 0, this.shape.radius * 6, 2);
    this.innerLight.position.set(0, -this.shape.cavityR * 0.35, 0);
    this.carrier.add(this.innerLight);

    this.applyOpen();
  }

  get radius(): number { return this.shape.radius; }
  get cavityR(): number { return this.shape.cavityR; }

  /** Mud still covering the stone, 1 → 0. */
  get mudLeft(): number { return this.mud.coverage; }
  /** How wet the stone currently is, 0 → 1. */
  get wetness(): number { return this.wet.coverage; }
  /** Powder still on the crystals of the open bowl, 1 → 0. */
  get powderLeft(): number { return (this.powderBottom.coverage + this.powderTop.coverage) * 0.5; }

  seamYAt(lon: number): number {
    return seamOffsetAt(lon, this.shape.seamAmp, this.shape.seamPhase);
  }

  /** Scrub: remove mud and add water at a world-space contact point. */
  washAt(worldPoint: Vector3, mesh: Mesh, radius: number, strength: number): void {
    const local = mesh.worldToLocal(_v.copy(worldPoint));
    if (local.lengthSq() < 1e-8) return;
    this.mud.paintEquirect(local, radius, strength);
    this.wet.paintEquirect(local, radius * 1.5, strength * 0.85);
  }

  /** Splash: wet only, no scrubbing. */
  wetAt(worldPoint: Vector3, mesh: Mesh, radius: number, strength: number): void {
    const local = mesh.worldToLocal(_v.copy(worldPoint));
    if (local.lengthSq() < 1e-8) return;
    this.wet.paintEquirect(local, radius, strength);
  }

  /** Brush: sweep powder off the crystal bed. */
  dustAt(worldPoint: Vector3, mesh: Mesh, radius: number, strength: number): void {
    const local = mesh.worldToLocal(_v.copy(worldPoint));
    const span = this.shape.cavityR * 2.2;
    const uu = local.x / span + 0.5;
    const vv = local.z / span + 0.5;
    const isTop = this.top.children.includes(mesh) || this.top === mesh.parent;
    const mask = isTop ? this.powderTop : this.powderBottom;
    mask.paintUV(uu, vv, radius, radius, strength);
  }

  maskForMesh(mesh: Mesh): PaintMask {
    return mesh.parent === this.top ? this.powderTop : this.powderBottom;
  }

  /** Start the stone caked in mud and bone dry. */
  resetSurface(mudAmount = 1): void {
    this.mud.fill(mudAmount);
    this.wet.reset();
    this.powderBottom.fill(0.92);
    this.powderTop.fill(0.92);
    this.mud.refresh();
    this.wet.refresh();
    this.powderBottom.refresh();
    this.powderTop.refresh();
  }

  private applyOpen(): void {
    const a = clamp(this.openAmount);
    this.hinge.rotation.x = -a * this.maxAngle;
    this.hinge.position.y = this.closedGap + this.gap;
    // Slide the lid back a touch as it swings so the rims do not clip.
    this.hinge.position.z = -this.shape.radius * 1.04 - a * this.shape.radius * 0.06;
  }

  update(dt: number, camera: { quaternion: { copy(q: unknown): unknown } }): void {
    this.applyOpen();

    this.mud.update(dt);
    this.wet.update(dt);
    this.powderBottom.update(dt);
    this.powderTop.update(dt);

    // Water evaporates: the stone dulls again if the player stops washing.
    this.wet.decay(dt * 0.055);

    const a = clamp(this.openAmount);
    const opening = clamp(this.gap / (this.shape.radius * 0.22)) * 0.55 + a * 0.45;

    this.seamGlow.uGap.value = damp(
      this.seamGlow.uGap.value,
      0.012 + clamp(this.gap / this.shape.radius, 0, 0.6) * 0.34 + a * 0.16,
      9, dt);
    this.seamGlow.uIntensity.value = damp(
      this.seamGlow.uIntensity.value,
      this.uSeamGlow.value * (1 - a * 0.82),
      7, dt);
    this.seamGlow.update(camera as never);

    this.innerLight.intensity = opening * 2.4 * (0.6 + 0.4 * this.uCrystalGlow.value);
    this.innerLight.color.copy(this.variety.hue);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.root.removeFromParent();
  }
}
