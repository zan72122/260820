import {
  Color, InstancedMesh, Matrix4, Mesh, Object3D, PointLight, Quaternion,
  Texture, Vector2, Vector3, type IUniform,
} from 'three';
import { Rand } from '../core/Rand';
import { clamp, damp, smoothstep } from '../core/Easing';
import type { QualitySettings } from '../core/Quality';
import { PaintMask } from '../gfx/PaintMask';
import { createSparkles } from '../gfx/Sparkles';
import { SeamGlow } from '../gfx/SeamGlow';
import {
  createCrystalMaterial, createDruzyMaterial, createShellMaterial, u,
} from '../gfx/materials';
import {
  buildCrystalGeometry, buildGeodeHalf, defaultShape, placeCrystals, seamOffsetAt, seamRadiusAt,
  type GeodeShape,
} from './geodeGeometry';
import type { Variety } from './varieties';

const _v = new Vector3();
const _stroke = new Vector3();
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
  private readonly closedGap: number;
  private crystalCount = 0;
  private lastWash: Vector3 | null = null;
  private lastDust: Vector2 | null = null;

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
    // 1/2.2 is where the cavity edge lands under the disc projection below.
    const powderOpts = { width: q.maskSize, aspect: 1 as const, discRadius: 1 / 2.2 };
    this.powderBottom = new PaintMask('erode', powderOpts);
    this.powderTop = new PaintMask('erode', powderOpts);
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
      this.disposables.push(inst);

      if (q.sparkles) {
        const step = Math.max(1, Math.round(1 / Math.min(1, q.particleMul)));
        const picked = tips.filter((_, i) => i % step === 0);
        const sp = createSparkles(picked, opts.uTime, this.uSparkle, opts.variety.hue, opts.dpr);
        parent.add(sp);
        this.disposables.push(sp.geometry, sp.material as unknown as { dispose(): void });
      }
    };

    // ---- assemble ----
    // The lid pivots about the stone's own centre and rises: hinging about the
    // rim like a clamshell throws the free edge a full diameter into the air
    // and breaks the composition apart.
    this.hinge.position.set(0, 0, 0);
    this.top.position.set(0, 0, 0);
    this.hinge.add(this.top);

    makeHalf(-1, this.bottom, this.powderBottom);
    makeHalf(1, this.top, this.powderTop);

    this.carrier.add(this.bottom, this.hinge);
    this.root.add(this.carrier);

    this.seamGlow = new SeamGlow(this.shape.radius, opts.uTime);
    this.seamGlow.uColor.value.copy(opts.variety.hue);
    this.carrier.add(this.seamGlow.mesh);
    this.disposables.push(this.seamGlow);

    this.innerLight = new PointLight(opts.variety.hue.clone(), 0, this.shape.radius * 3.2, 2);
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
  /**
   * Powder still on the crystals of the open bowl, 1 → 0.
   *
   * Only the bowl counts. The lid tips back and can be brushed, but its bed
   * never fully faces the player, so averaging the two would make "clean"
   * unreachable and leave a child brushing forever.
   */
  get powderLeft(): number { return this.powderBottom.coverage; }

  seamYAt(lon: number): number {
    return seamOffsetAt(lon, this.shape.seamAmp, this.shape.seamPhase);
  }

  /** How far out the rock actually reaches at this point on the break line. */
  seamRadiusAt(lon: number): number {
    return seamRadiusAt(lon, this.shape);
  }

  /**
   * Scrub: remove mud and add water along the path the finger travelled since
   * the last frame.
   *
   * Painting only at the sampled point would make washing depend on frame
   * rate — a fast swipe on a struggling phone would leave a dotted line of
   * clean spots instead of a stroke. Interpolating the arc fixes that.
   */
  washAt(worldPoint: Vector3, mesh: Mesh, radius: number, strength: number): void {
    const local = mesh.worldToLocal(_v.copy(worldPoint));
    if (local.lengthSq() < 1e-8) return;
    local.normalize();
    this.strokeEquirect(this.lastWash, local, radius, (d, r) => {
      this.mud.paintEquirect(d, r, strength);
      // Water does not stop at the fingertip: a weak, much wider pass makes the
      // mud dissolve outward from the stroke instead of leaving a stencil.
      this.mud.paintEquirect(d, r * 2.1, strength * 0.22);
      this.wet.paintEquirect(d, r * 2.4, strength * 0.8);
    });
    if (!this.lastWash) this.lastWash = new Vector3();
    this.lastWash.copy(local);
  }

  /** Call when the finger lifts, so the next stroke does not join to this one. */
  endStroke(): void {
    this.lastWash = null;
    this.lastDust = null;
  }

  /** Walk the great-circle arc between two surface directions, brushing as it goes. */
  private strokeEquirect(
    from: Vector3 | null, to: Vector3, radius: number,
    paint: (dir: Vector3, radius: number) => void,
  ): void {
    if (!from) { paint(to, radius); return; }
    const arc = from.angleTo(to);
    const stepArc = Math.max(0.02, radius * Math.PI * 0.55);
    const steps = Math.min(16, Math.max(1, Math.ceil(arc / stepArc)));
    for (let i = 1; i <= steps; i++) {
      _stroke.copy(from).lerp(to, i / steps).normalize();
      paint(_stroke, radius);
    }
  }

  /** Splash: wet only, no scrubbing. */
  wetAt(worldPoint: Vector3, mesh: Mesh, radius: number, strength: number): void {
    const local = mesh.worldToLocal(_v.copy(worldPoint));
    if (local.lengthSq() < 1e-8) return;
    this.wet.paintEquirect(local, radius, strength);
  }

  /** Brush: sweep powder off the crystal bed, along the path just travelled. */
  dustAt(worldPoint: Vector3, mesh: Mesh, radius: number, strength: number): void {
    const local = mesh.worldToLocal(_v.copy(worldPoint));
    const span = this.shape.cavityR * 2.2;
    const uu = local.x / span + 0.5;
    const vv = local.z / span + 0.5;
    const mask = mesh.parent === this.top ? this.powderTop : this.powderBottom;

    const sweep = (x: number, y: number) => {
      mask.paintUV(x, y, radius, radius, strength);
      // Bristles fan out; powder does not leave in a stencilled dot.
      mask.paintUV(x, y, radius * 2.4, radius * 2.4, strength * 0.34);
    };
    const prev = this.lastDust;
    if (prev) {
      const dist = Math.hypot(uu - prev.x, vv - prev.y);
      const steps = Math.min(16, Math.max(1, Math.ceil(dist / Math.max(0.01, radius * 0.55))));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        sweep(prev.x + (uu - prev.x) * t, prev.y + (vv - prev.y) * t);
      }
    } else {
      sweep(uu, vv);
    }
    if (!this.lastDust) this.lastDust = new Vector2();
    this.lastDust.set(uu, vv);
  }

  maskForMesh(mesh: Mesh): PaintMask {
    return mesh.parent === this.top ? this.powderTop : this.powderBottom;
  }

  /** True if a world point lands on a crystal bed rather than the outside. */
  isCavityPoint(worldPoint: Vector3, mesh: Mesh): boolean {
    const local = mesh.worldToLocal(_v.copy(worldPoint));
    return local.length() < this.shape.cavityR * 1.25;
  }

  /** Start the stone caked in mud and bone dry. */
  resetSurface(mudAmount = 1): void {
    this.endStroke();
    this.mud.fill(mudAmount);
    this.wet.reset();
    this.powderBottom.fill(0.92);
    this.powderTop.fill(0.92);
    this.mud.refresh();
    this.wet.refresh();
    this.powderBottom.refresh();
    this.powderTop.refresh();
  }

  /**
   * Opening is one continuous motion: the lid first parts to a sliver — that is
   * where the light gets out — then arcs up, turns right over and comes to rest
   * behind the bowl, cavity up, the way a split geode is actually laid out.
   */
  private applyOpen(): void {
    const a = clamp(this.openAmount);
    const R = this.shape.radius;
    // The flip is held back until the crack has visibly widened.
    const tilt = smoothstep((a - 0.16) / 0.84);
    const arc = Math.sin(tilt * Math.PI);
    this.hinge.rotation.x = -tilt * Math.PI;
    this.hinge.position.y = this.closedGap + this.gap
      + R * (0.34 * a * (1 - tilt) + 0.86 * arc - 0.30 * tilt);
    this.hinge.position.z = -tilt * R * 1.95;
  }

  update(dt: number, camera: { quaternion: { copy(q: unknown): unknown } }): void {
    this.applyOpen();

    this.mud.update(dt);
    this.wet.update(dt);
    this.powderBottom.update(dt);
    this.powderTop.update(dt);

    // Water evaporates: the stone dulls again if the player stops washing.
    this.wet.decay(dt * 0.11);

    const a = clamp(this.openAmount);
    const opening = clamp(this.gap / (this.shape.radius * 0.22)) * 0.55 + a * 0.45;

    this.seamGlow.uGap.value = damp(
      this.seamGlow.uGap.value,
      0.012 + clamp(this.gap / this.shape.radius, 0, 0.6) * 0.34 + a * 0.16,
      9, dt);
    this.seamGlow.uIntensity.value = damp(
      this.seamGlow.uIntensity.value,
      Math.min(1.0, this.uSeamGlow.value) * (1 - a * 0.82),
      7, dt);
    this.seamGlow.update(camera as never);

    this.innerLight.intensity = opening * 0.85 * (1 - a * 0.9)
      * (0.6 + 0.4 * Math.min(1.2, this.uCrystalGlow.value));
    this.innerLight.color.copy(this.variety.hue);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.root.removeFromParent();
  }
}
