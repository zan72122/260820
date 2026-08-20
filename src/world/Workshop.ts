import {
  BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DirectionalLight,
  DoubleSide, Float32BufferAttribute, Fog, Group, HemisphereLight, InstancedMesh, LatheGeometry,
  Matrix4, Mesh, MeshPhysicalMaterial, Object3D, PlaneGeometry, PointLight, Quaternion, Scene,
  SphereGeometry, SpotLight, Texture, TorusGeometry, Vector2, Vector3, type IUniform,
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
  wash: new Vector3(-0.86, 0.500, 0.10),
  cradle: new Vector3(0.46, 0.560, -0.02),
  pedestal: new Vector3(1.40, 0.600, 0.20),
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
    const bench = new Mesh(new BoxGeometry(7.6, 0.32, 4.0), wood);
    bench.position.set(0.15, -0.16, 0.45);
    bench.receiveShadow = q.shadows;
    bench.castShadow = q.shadows;
    this.root.add(bench);
    this.disposables.push(bench.geometry);

    const plaster = apply(createPlasterMaterial());
    const wall = new Mesh(new PlaneGeometry(16, 9), plaster);
    wall.position.set(0, 2.4, -2.05);
    wall.receiveShadow = q.shadows;
    this.root.add(wall);
    this.disposables.push(wall.geometry);

    // A floor so the wall never runs off the bottom of a tall phone screen.
    const floor = new Mesh(new PlaneGeometry(16, 10), plaster);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2.2, 1.0);
    floor.receiveShadow = false;
    this.root.add(floor);
    this.disposables.push(floor.geometry);

    // ---------------- basin + water ----------------
    const stone = apply(createStoneMaterial(new Color(0.50, 0.49, 0.47), this.uBasinWet));
    stone.side = DoubleSide;
    // A shallow carved tray: flat floor, curved wall, thick rolled rim, then
    // straight back down the outside so it reads as a solid block of stone.
    const profile: Vector2[] = [
      new Vector2(0.00, 0.020), new Vector2(0.28, 0.026), new Vector2(0.50, 0.050),
      new Vector2(0.68, 0.110), new Vector2(0.80, 0.195), new Vector2(0.86, 0.238),
      new Vector2(0.91, 0.226), new Vector2(0.93, 0.180), new Vector2(0.93, 0.000),
      new Vector2(0.88, -0.03),
    ];
    const basin = new Mesh(new LatheGeometry(profile, 44), stone);
    basin.position.set(STATION.wash.x, 0, STATION.wash.z);
    basin.receiveShadow = q.shadows;
    basin.castShadow = q.shadows;
    this.root.add(basin);
    this.disposables.push(basin.geometry);

    const waterMat = apply(createWaterMaterial(opts.uTime, this.uWaterAgitate, this.uWaterTouch));
    this.water = new Mesh(new CircleGeometry(0.80, 44), waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(STATION.wash.x, 0.140, STATION.wash.z);
    this.water.renderOrder = 2;
    this.root.add(this.water);
    this.disposables.push(this.water.geometry);

    // ---------------- cradle ----------------
    const steel = apply(createMetalMaterial(opts.uTime, new Color(0.42, 0.44, 0.48), 1.0, 0.7));
    const brass = apply(createMetalMaterial(opts.uTime, new Color(0.50, 0.38, 0.20), 0.6, 0.78));

    const ring = new Mesh(new TorusGeometry(0.355, 0.026, 8, 40), steel);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.215;
    ring.castShadow = q.shadows;
    this.cradle.add(ring);
    this.disposables.push(ring.geometry);

    const standGeo = new CylinderGeometry(0.235, 0.285, 0.075, 26);
    const stand = new Mesh(standGeo, wood);
    stand.position.y = 0.038;
    stand.castShadow = q.shadows;
    stand.receiveShadow = q.shadows;
    this.cradle.add(stand);
    this.disposables.push(standGeo);

    const legGeo = new CylinderGeometry(0.014, 0.019, 0.185, 8);
    this.disposables.push(legGeo);
    const padGeo = new SphereGeometry(0.036, 10, 8);
    this.disposables.push(padGeo);
    const padMat = apply(createVelvetMaterial(new Color(0.075, 0.055, 0.060)));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const leg = new Mesh(legGeo, steel);
      leg.position.set(Math.cos(a) * 0.31, 0.130, Math.sin(a) * 0.31);
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
    const bladeGeo = wedgeBlade(0.19, 0.105, 0.052);
    const blade = new Mesh(bladeGeo, steel);
    blade.castShadow = q.shadows;
    this.wedge.add(blade);
    this.disposables.push(bladeGeo);

    const collarGeo = new CylinderGeometry(0.036, 0.031, 0.042, 12);
    const collar = new Mesh(collarGeo, brass);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 0.022;
    this.wedge.add(collar);
    this.disposables.push(collarGeo);

    const handleGeo = new CylinderGeometry(0.036, 0.048, 0.24, 12);
    const handle = new Mesh(handleGeo, wood);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.165;
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

    const velvetMat = apply(createVelvetMaterial(new Color(0.20, 0.040, 0.075)));
    const cushionGeo = new SphereGeometry(0.275, 28, 18);
    const cushion = new Mesh(cushionGeo, velvetMat);
    cushion.scale.set(1, 0.42, 1);
    cushion.position.y = 0.135;
    cushion.receiveShadow = q.shadows;
    this.pedestal.add(cushion);
    this.disposables.push(cushionGeo);
    this.pedestal.position.set(STATION.pedestal.x, 0, STATION.pedestal.z);
    this.pedestal.scale.setScalar(1);
    this.root.add(this.pedestal);

    // ---------------- light ----------------
    this.keyLight = new DirectionalLight(0xffe0b2, 3.1);
    this.keyLight.position.set(-3.1, 4.0, 2.4);
    this.keyLight.target.position.set(0.1, 0.3, 0);
    if (q.shadows) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      const c = this.keyLight.shadow.camera;
      c.left = -3.2; c.right = 3.2; c.top = 2.4; c.bottom = -1.5; c.near = 0.5; c.far = 12;
      this.keyLight.shadow.bias = -0.0012;
      this.keyLight.shadow.normalBias = 0.018;
      this.keyLight.shadow.radius = 2.4;
    }
    this.root.add(this.keyLight, this.keyLight.target);

    // Cool back-rim so the stone separates from a bench of the same brown.
    this.fillLight = new DirectionalLight(0x9fc0ff, 1.05);
    this.fillLight.position.set(2.6, 1.6, -2.6);
    this.root.add(this.fillLight);

    this.hemi = new HemisphereLight(0x2a3350, 0x140e0c, 0.40);
    this.root.add(this.hemi);

    // A dim practical near the bench so the workshop is legibly a room and not
    // an object floating in the void.
    const lamp = new PointLight(0xffbe78, 1.5, 5.0, 1.8);
    lamp.position.set(-1.9, 1.25, 1.25);
    this.root.add(lamp);

    this.spot = new SpotLight(0xfff2dc, 0, 5.0, 0.46, 0.55, 1.0);
    this.spot.position.set(STATION.pedestal.x + 0.20, 1.95, STATION.pedestal.z + 0.75);
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
    // Depth cue: the workshop should fall away into the dark behind the bench.
    scene.fog = new Fog(0x0d0a12, 3.6, 15.0);
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
