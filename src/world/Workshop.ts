import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight, Float32BufferAttribute,
  Group, HemisphereLight, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshPhysicalMaterial,
  Object3D, PlaneGeometry, Quaternion, Scene, SphereGeometry, SpotLight, Texture, TorusGeometry,
  Vector2, Vector3, type IUniform,
} from 'three';
import { Rand } from '../core/Rand';
import { clamp, damp } from '../core/Easing';
import type { QualitySettings } from '../core/Quality';
import { Caustics } from '../gfx/Caustics';
import {
  createBristleMaterial, createMetalMaterial, createPlasterMaterial, createStoneMaterial,
  createVelvetMaterial, createWaterMaterial, createWoodMaterial, u,
} from '../gfx/materials';

/** Where each verb happens. Everything is within a comfortable thumb-swipe. */
export const STATION = {
  wash: new Vector3(-0.70, 0.455, 0.10),
  cradle: new Vector3(0.20, 0.560, -0.02),
  pedestal: new Vector3(1.14, 0.640, 0.24),
};

const UP = new Vector3(0, 1, 0);

/** Triangular-prism chisel blade: flat face down, tapering to an edge. */
function wedgeBlade(len: number, width: number, thick: number): BufferGeometry {
  const hw = width / 2, ht = thick / 2;
  const p = [
    // tip edge (x = -len)
    -len, 0, -hw, -len, 0, hw,
    // back face
    0, ht, -hw, 0, ht, hw, 0, -ht, -hw, 0, -ht, hw,
  ];
  const idx = [
    0, 1, 3, 0, 3, 2,   // top bevel
    0, 4, 5, 0, 5, 1,   // bottom bevel
    2, 3, 5, 2, 5, 4,   // back
    0, 2, 4,            // left side
    1, 5, 3,            // right side
  ];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface WorkshopOptions {
  quality: QualitySettings;
  envMap: Texture | null;
  uTime: IUniform<number>;
  seed: number;
}

/**
 * The whole world: one bench, one basin, three tools, one wall. Kept
 * deliberately small so the texture and draw-call budget can go almost
 * entirely into the stone.
 */
export class Workshop {
  readonly root = new Group();
  readonly cradle = new Group();
  readonly wedge = new Group();
  readonly brush = new Group();
  readonly pedestal = new Group();
  readonly water: Mesh;
  readonly caustics: Caustics;

  readonly keyLight: DirectionalLight;
  readonly fillLight: DirectionalLight;
  readonly hemi: HemisphereLight;
  readonly spot: SpotLight;

  readonly uWaterAgitate = u(0);
  readonly uWaterTouch = u(new Vector2());
  readonly uBenchWet = u(0.35);
  readonly uBasinWet = u(0.8);

  /** 1 = workshop lit normally, 0 = dimmed for the finale. */
  mood = 1;
  private moodCurrent = 1;
  private baseKey: number;
  private baseFill: number;
  private baseHemi: number;

  private disposables: { dispose(): void }[] = [];
  private bristles: InstancedMesh | null = null;
  private bristleBase: Matrix4[] = [];
  private bristleBend = 0;

  constructor(private opts: WorkshopOptions) {
    const q = opts.quality;
    const rand = new Rand(opts.seed ^ 0x9e37);
    const env = opts.envMap;
    const apply = <T extends MeshPhysicalMaterial>(m: T): T => {
      if (env) m.envMap = env;
      this.disposables.push(m);
      return m;
    };

    // ---------------- bench + wall ----------------
    const wood = apply(createWoodMaterial(opts.uTime, this.uBenchWet));
    const bench = new Mesh(new BoxGeometry(4.6, 0.24, 2.8), wood);
    bench.position.set(0.15, -0.12, 0.05);
    bench.receiveShadow = q.shadows;
    bench.castShadow = false;
    this.root.add(bench);
    this.disposables.push(bench.geometry);

    const plaster = apply(createPlasterMaterial());
    const wall = new Mesh(new PlaneGeometry(14, 8), plaster);
    wall.position.set(0, 2.0, -1.85);
    wall.receiveShadow = q.shadows;
    this.root.add(wall);
    this.disposables.push(wall.geometry);

    // ---------------- basin + water ----------------
    const stone = apply(createStoneMaterial(new Color(0.62, 0.60, 0.58), this.uBasinWet));
    const profile: Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      // Shallow dish: flat centre, curved wall, flared rim.
      const r = 0.86 * t;
      const y = 0.02 + 0.20 * Math.pow(t, 2.4);
      profile.push(new Vector2(r, y));
    }
    profile.push(new Vector2(0.90, 0.24), new Vector2(0.88, 0.05), new Vector2(0.86, -0.02));
    const basin = new Mesh(new LatheGeometry(profile, 40), stone);
    basin.position.copy(STATION.wash).setY(0);
    basin.position.z = STATION.wash.z;
    basin.receiveShadow = q.shadows;
    basin.castShadow = q.shadows;
    this.root.add(basin);
    this.disposables.push(basin.geometry);

    const waterMat = apply(createWaterMaterial(opts.uTime, this.uWaterAgitate, this.uWaterTouch));
    this.water = new Mesh(new PlaneGeometry(1.5, 1.5, 24, 24), waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(STATION.wash.x, 0.088, STATION.wash.z);
    this.water.renderOrder = 2;
    this.root.add(this.water);
    this.disposables.push(this.water.geometry);

    // ---------------- cradle ----------------
    const steel = apply(createMetalMaterial(opts.uTime, new Color(0.72, 0.74, 0.78), 0.8, 0.45));
    const brass = apply(createMetalMaterial(opts.uTime, new Color(0.86, 0.68, 0.36), 0.35, 0.6));

    const ring = new Mesh(new TorusGeometry(0.355, 0.022, 6, 34), steel);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.215;
    ring.castShadow = q.shadows;
    this.cradle.add(ring);
    this.disposables.push(ring.geometry);

    const legGeo = new CylinderGeometry(0.017, 0.023, 0.235, 8);
    this.disposables.push(legGeo);
    const padGeo = new SphereGeometry(0.036, 10, 8);
    this.disposables.push(padGeo);
    const padMat = apply(createVelvetMaterial(new Color(0.16, 0.12, 0.13)));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const leg = new Mesh(legGeo, brass);
      leg.position.set(Math.cos(a) * 0.33, 0.108, Math.sin(a) * 0.33);
      leg.rotation.z = -Math.cos(a) * 0.16;
      leg.rotation.x = Math.sin(a) * 0.16;
      leg.castShadow = q.shadows;
      this.cradle.add(leg);

      const pad = new Mesh(padGeo, padMat);
      pad.position.set(Math.cos(a) * 0.34, 0.238, Math.sin(a) * 0.34);
      pad.scale.set(1, 0.55, 1);
      this.cradle.add(pad);
    }
    this.cradle.position.set(STATION.cradle.x, 0, STATION.cradle.z);
    this.root.add(this.cradle);

    // ---------------- wedge ----------------
    const bladeGeo = wedgeBlade(0.135, 0.085, 0.042);
    const blade = new Mesh(bladeGeo, steel);
    blade.castShadow = q.shadows;
    this.wedge.add(blade);
    this.disposables.push(bladeGeo);

    const collarGeo = new CylinderGeometry(0.030, 0.026, 0.035, 10);
    const collar = new Mesh(collarGeo, brass);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 0.018;
    this.wedge.add(collar);
    this.disposables.push(collarGeo);

    const handleGeo = new CylinderGeometry(0.030, 0.040, 0.19, 12);
    const handle = new Mesh(handleGeo, wood);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.130;
    handle.castShadow = q.shadows;
    this.wedge.add(handle);
    this.disposables.push(handleGeo);
    this.wedge.visible = false;
    this.root.add(this.wedge);

    // ---------------- brush ----------------
    const bHandleGeo = new CylinderGeometry(0.028, 0.036, 0.24, 12);
    const bHandle = new Mesh(bHandleGeo, wood);
    bHandle.position.y = 0.20;
    bHandle.castShadow = q.shadows;
    this.brush.add(bHandle);
    this.disposables.push(bHandleGeo);

    const ferruleGeo = new CylinderGeometry(0.034, 0.030, 0.055, 12);
    const ferrule = new Mesh(ferruleGeo, brass);
    ferrule.position.y = 0.062;
    this.brush.add(ferrule);
    this.disposables.push(ferruleGeo);

    const bristleMat = apply(createBristleMaterial());
    const bristleGeo = new CylinderGeometry(0.0016, 0.0038, 1.0, 4, 1, false);
    bristleGeo.translate(0, -0.5, 0); // grow downward from the ferrule
    this.disposables.push(bristleGeo);
    const nBristles = Math.max(36, Math.round(120 * q.particleMul));
    const bristles = new InstancedMesh(bristleGeo, bristleMat, nBristles);
    bristles.castShadow = false;
    const m = new Matrix4(), qq = new Quaternion(), sc = new Vector3(), pv = new Vector3();
    for (let i = 0; i < nBristles; i++) {
      const a = rand.range(0, Math.PI * 2);
      const rr = Math.sqrt(rand.next()) * 0.030;
      pv.set(Math.cos(a) * rr, 0.038, Math.sin(a) * rr);
      const len = rand.range(0.070, 0.098) * (1 - rr * 1.4);
      const tilt = new Vector3(Math.cos(a) * rr * 2.6, -1, Math.sin(a) * rr * 2.6).normalize();
      qq.setFromUnitVectors(UP, tilt);
      sc.set(1, len, 1);
      m.compose(pv, qq, sc);
      bristles.setMatrixAt(i, m);
      this.bristleBase.push(m.clone());
    }
    bristles.instanceMatrix.needsUpdate = true;
    this.brush.add(bristles);
    this.bristles = bristles;
    this.brush.visible = false;
    this.root.add(this.brush);

    // ---------------- pedestal ----------------
    const baseGeo = new CylinderGeometry(0.30, 0.345, 0.11, 28);
    const base = new Mesh(baseGeo, wood);
    base.position.y = 0.055;
    base.castShadow = q.shadows;
    base.receiveShadow = q.shadows;
    this.pedestal.add(base);
    this.disposables.push(baseGeo);

    const velvetMat = apply(createVelvetMaterial(new Color(0.30, 0.055, 0.11)));
    const cushionGeo = new SphereGeometry(0.275, 28, 18);
    const cushion = new Mesh(cushionGeo, velvetMat);
    cushion.scale.set(1, 0.42, 1);
    cushion.position.y = 0.135;
    cushion.receiveShadow = q.shadows;
    this.pedestal.add(cushion);
    this.disposables.push(cushionGeo);
    this.pedestal.position.set(STATION.pedestal.x, 0, STATION.pedestal.z);
    this.root.add(this.pedestal);

    // ---------------- light ----------------
    this.keyLight = new DirectionalLight(0xffe4bc, 2.9);
    this.keyLight.position.set(-3.1, 4.0, 2.0);
    this.keyLight.target.position.set(0.1, 0.3, 0);
    if (q.shadows) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      const c = this.keyLight.shadow.camera;
      c.left = -2.2; c.right = 2.2; c.top = 2.0; c.bottom = -1.2; c.near = 0.5; c.far = 10;
      this.keyLight.shadow.bias = -0.0012;
      this.keyLight.shadow.normalBias = 0.018;
      this.keyLight.shadow.radius = 2.4;
    }
    this.root.add(this.keyLight, this.keyLight.target);

    this.fillLight = new DirectionalLight(0xa9c6ff, 0.55);
    this.fillLight.position.set(3.2, 1.8, -1.8);
    this.root.add(this.fillLight);

    this.hemi = new HemisphereLight(0x35405e, 0x1b1310, 0.42);
    this.root.add(this.hemi);

    this.spot = new SpotLight(0xfff2dc, 0, 4.5, 0.52, 0.62, 1.4);
    this.spot.position.set(STATION.pedestal.x + 0.25, 2.15, STATION.pedestal.z + 0.85);
    this.spot.target.position.set(STATION.pedestal.x, 0.5, STATION.pedestal.z);
    this.root.add(this.spot, this.spot.target);

    this.baseKey = this.keyLight.intensity;
    this.baseFill = this.fillLight.intensity;
    this.baseHemi = this.hemi.intensity;

    // ---------------- caustics ----------------
    this.caustics = new Caustics(opts.uTime);
    this.caustics.bench.position.set(STATION.cradle.x, 0.014, STATION.cradle.z + 0.15);
    this.caustics.wall.position.set(0.1, 1.35, -1.83);
    this.root.add(this.caustics.bench, this.caustics.wall);
    this.disposables.push(this.caustics);
  }

  addTo(scene: Scene): void {
    scene.add(this.root);
  }

  /** Splash ripples radiating from a world point on the water. */
  touchWater(world: Vector3, strength: number): void {
    this.uWaterTouch.value.set(world.x - this.water.position.x, world.z - this.water.position.z);
    this.uWaterAgitate.value = Math.min(1.4, this.uWaterAgitate.value + strength);
  }

  /** 0 = relaxed bristles, 1 = pressed flat against the crystals. */
  setBristleBend(amount: number): void {
    this.bristleBend = clamp(amount);
  }

  update(dt: number): void {
    this.uWaterAgitate.value = damp(this.uWaterAgitate.value, 0, 1.5, dt);

    this.moodCurrent = damp(this.moodCurrent, this.mood, 2.2, dt);
    const mo = this.moodCurrent;
    this.keyLight.intensity = this.baseKey * (0.14 + 0.86 * mo);
    this.fillLight.intensity = this.baseFill * (0.10 + 0.90 * mo);
    this.hemi.intensity = this.baseHemi * (0.16 + 0.84 * mo);

    if (this.bristles) {
      const m = new Matrix4();
      const bend = this.bristleBend;
      if (Math.abs(bend - this.lastBend) > 0.01) {
        this.lastBend = bend;
        for (let i = 0; i < this.bristleBase.length; i++) {
          m.copy(this.bristleBase[i]);
          // Squash length and splay outward: a loaded brush fans out.
          const sy = 1 - bend * 0.34;
          m.elements[4] *= sy; m.elements[5] *= sy; m.elements[6] *= sy;
          m.elements[12] *= 1 + bend * 0.5;
          m.elements[14] *= 1 + bend * 0.5;
          this.bristles.setMatrixAt(i, m);
        }
        this.bristles.instanceMatrix.needsUpdate = true;
      }
    }

    this.caustics.update();
  }

  private lastBend = -1;

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.bristles?.dispose();
    this.root.removeFromParent();
  }

  get quality(): QualitySettings { return this.opts.quality; }
}

/** Utility: aim an object at a target, used for tools that "point at" the work. */
export function lookAlong(obj: Object3D, from: Vector3, to: Vector3): void {
  obj.position.copy(from);
  obj.lookAt(to);
}
