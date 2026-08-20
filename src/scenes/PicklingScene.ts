import * as THREE from 'three';
import { BaseScene, ContactShadow, type GameContext } from '../core/SceneBase';
import type { StageId } from '../core/GameState';
import type { Pointer } from '../core/Input';
import { clamp, clamp01, damp, lerp, smoothstep, TAU } from '../core/mathx';
import { Rng } from '../core/rng';
import { BrineModel } from '../core/BrineModel';
import {
  createBrineBodyMaterial, createBrineSurfaceMaterial, createGlassMaterial,
  createGlassSolidMaterial, createSaltMaterial, createUmeMaterial, createWoodMaterial,
  createRunnelMaterial, type UmeMaterial,
} from '../world/materials';
import { makeJarGeometry, makeScoopGeometry, makeStemGeometry } from '../world/geometry';
import { phaseForDay } from '../world/Environment';

const BENCH_Y = 0.9;
const JAR_X = 0.035;
const JAR_Z = -0.085;
const JAR_R = 0.108;
const JAR_H = 0.265;
const JAR_WALL = 0.011;
const INNER_R = JAR_R - JAR_WALL;
const FRUIT_IN_JAR = 9;
const MAX_DAYS = 6;

interface JarFruit {
  mesh: THREE.Mesh;
  /** Local position inside the jar group. */
  pos: THREE.Vector3;
  radius: number;
  material: UmeMaterial;
}

interface Grain {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  spin: THREE.Vector3;
  scale: number;
  /** -1 falling, -2 at rest on glass/bench, >=0 resting on that fruit. */
  state: number;
  /** Offset from the fruit it rests on. */
  offset: THREE.Vector3;
  life: number;
  active: boolean;
  mesh: number;
}

interface Droplet {
  mesh: THREE.Mesh;
  /** 'bead' clings and swells, 'run' slides down, 'fall' drops free. */
  mode: 'idle' | 'bead' | 'run' | 'fall';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fruit: number;
  age: number;
  size: number;
}

/**
 * Stage 2 -- the workbench.
 *
 * This is the scene the whole game exists for. Salt lands on the fruit; days
 * are pulled across the bench by hand; the skin darkens, beads, drips; juice
 * gathers in the bottom of the jar and the level creeps up between the fruit.
 * All of it happens in one unbroken shot, so the cause and the effect are
 * never separated by a cut.
 */
export class PicklingScene extends BaseScene {
  readonly id: StageId = 'pickling';
  ambience = 0.35;

  private brine = new BrineModel({ maxDays: MAX_DAYS, fruitCount: FRUIT_IN_JAR });
  private rng = new Rng(0x2f1a);

  private bench!: THREE.Group;
  private jarGroup!: THREE.Group;
  private jarBack!: THREE.Mesh;
  private jarFront!: THREE.Mesh;
  private jarInner!: THREE.Mesh;
  private jarRim!: THREE.Mesh;
  private jarBase!: THREE.Mesh;
  private fruits: JarFruit[] = [];
  private brineBody!: THREE.Mesh;
  private brineSurface!: THREE.Mesh;
  private runnels: THREE.Mesh[] = [];
  private scoop!: THREE.Group;
  private scoopSalt!: THREE.Mesh;
  private saltBowl!: THREE.Group;
  private saltHeap!: THREE.Mesh;
  private lightPatch!: THREE.Mesh;
  private windowSun!: THREE.Mesh;
  private windowMoon!: THREE.Mesh;
  private windowSky!: THREE.ShaderMaterial;
  private lid!: THREE.Group;
  private roomFill!: THREE.PointLight;

  private saltMeshes: THREE.InstancedMesh[] = [];
  private grains: Grain[] = [];
  private grainCursor = 0;
  private droplets: Droplet[] = [];

  private scoopFill = 1;
  private scoopTilt = 0;
  private scoopTiltTarget = 0;
  private scoopHome = new THREE.Vector3();
  private jarSpin = 0;
  private jarSpinVel = 0;
  private hintPulse = 0;
  private freeplayTime = 0;
  private lidVisible = false;
  private lastLevel = 0;
  private pourSound = 0;
  private cameraCloseness = 0;
  private beadTimer = 0;

  private grab: 'scoop' | 'light' | 'jar' | null = null;
  private grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BENCH_Y);
  private grabPoint = new THREE.Vector3();
  private grabOffset = new THREE.Vector3();
  private tmpV = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();

  // ------------------------------------------------------------------ build

  build(ctx: GameContext): void {
    if (this.built) return;
    this.built = true;
    this.buildRoom(ctx);
    this.buildJar(ctx);
    this.buildFruit(ctx);
    this.buildBrine(ctx);
    this.buildSalt(ctx);
    this.buildScoop(ctx);
    this.buildLightPatch(ctx);
    this.buildLid(ctx);
  }

  private buildRoom(ctx: GameContext): void {
    this.bench = new THREE.Group();
    const woodMat = this.track(createWoodMaterial(ctx.assets.wood, { roughness: 1 }));
    const top = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.9, 0.062, 1.55)), woodMat);
    top.position.set(0, BENCH_Y - 0.031, 0.2);
    top.receiveShadow = true;
    top.castShadow = ctx.quality.shadows;
    this.bench.add(top);

    // A visible front edge: the bench must read as a solid slab, not a plane.
    const legMat = this.track(createWoodMaterial(ctx.assets.woodFine, { roughness: 1 }));
    legMat.color = new THREE.Color(0x8a6b45);
    for (const [lx, lz] of [[-0.82, -0.5], [0.82, -0.5], [-0.82, 0.88], [0.82, 0.88]]) {
      const leg = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.07, BENCH_Y - 0.06, 0.07)), legMat);
      leg.position.set(lx, (BENCH_Y - 0.06) / 2, lz);
      leg.castShadow = ctx.quality.shadows;
      this.bench.add(leg);
    }
    this.root.add(this.bench);

    const floor = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(9, 9)),
      this.track(new THREE.MeshStandardMaterial({
        map: ctx.assets.ground.map, roughness: 1, metalness: 0, color: 0x8b7d63,
      })),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);

    const wallMat = this.track(new THREE.MeshStandardMaterial({
      map: ctx.assets.wall.map,
      roughnessMap: ctx.assets.wall.roughnessMap,
      normalMap: ctx.assets.wall.normalMap,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    }));
    const wall = new THREE.Mesh(this.track(new THREE.PlaneGeometry(6, 3.4)), wallMat);
    wall.position.set(0, 1.6, -1.15);
    wall.receiveShadow = true;
    this.root.add(wall);

    // Window: the frame is real geometry, and what crosses it is the day.
    const frameMat = this.track(createWoodMaterial(ctx.assets.woodFine, { roughness: 0.8 }));
    frameMat.color = new THREE.Color(0x8f7048);
    const winW = 0.86;
    const winH = 0.6;
    const winY = 1.34;
    const winZ = -1.14;
    const sky = this.track(new THREE.ShaderMaterial({
      uniforms: { uNight: { value: 0 } },
      toneMapped: false,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vU; uniform float uNight;
        void main(){
          vec3 day = mix(vec3(0.86,0.90,0.80), vec3(0.52,0.72,0.92), pow(vU.y, 0.7));
          vec3 night = mix(vec3(0.06,0.09,0.17), vec3(0.03,0.05,0.12), pow(vU.y, 0.7));
          gl_FragColor = vec4(mix(day, night, uNight), 1.0);
        }`,
    }));
    this.windowSky = sky;
    const pane = new THREE.Mesh(this.track(new THREE.PlaneGeometry(winW, winH)), sky);
    pane.position.set(-0.05, winY, winZ - 0.005);
    this.root.add(pane);
    for (const [w, h, x, y] of [
      [winW + 0.07, 0.05, -0.05, winY + winH / 2],
      [winW + 0.07, 0.05, -0.05, winY - winH / 2],
      [0.05, winH + 0.05, -0.05 - winW / 2, winY],
      [0.05, winH + 0.05, -0.05 + winW / 2, winY],
      [0.035, winH, -0.05, winY],
      [winW, 0.03, -0.05, winY],
    ]) {
      const bar = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, h, 0.05)), frameMat);
      bar.position.set(x, y, winZ);
      bar.castShadow = ctx.quality.shadows;
      this.root.add(bar);
    }

    const sunMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfff3cf, toneMapped: false }));
    this.windowSun = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.072, 24)), sunMat);
    this.windowSun.position.set(-0.05, winY, winZ - 0.004);
    this.root.add(this.windowSun);
    const moonMat = this.track(new THREE.MeshBasicMaterial({ color: 0xdfe7f7, toneMapped: false }));
    this.windowMoon = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.052, 24)), moonMat);
    this.windowMoon.position.set(-0.05, winY, winZ - 0.004);
    this.root.add(this.windowMoon);

    // Interior bounce so night never becomes an unreadable black frame.
    this.roomFill = new THREE.PointLight(0xffd7a0, 0.6, 6, 2);
    this.roomFill.position.set(-0.4, 1.7, 0.5);
    this.root.add(this.roomFill);
  }

  private buildJar(ctx: GameContext): void {
    this.jarGroup = new THREE.Group();
    this.jarGroup.position.set(JAR_X, BENCH_Y, JAR_Z);
    this.root.add(this.jarGroup);

    const parts = makeJarGeometry(JAR_R, JAR_H, JAR_WALL, ctx.quality.tier === 'low' ? 28 : 52);
    this.track(parts.outer);
    this.track(parts.inner);
    this.track(parts.rim);
    this.track(parts.base);
    const wear = ctx.assets.glassWear;

    // Back half first, contents next, front half last: correct layering with
    // no dependence on per-object transparency sorting.
    const backMat = this.track(createGlassMaterial(wear, THREE.BackSide, ctx.quality));
    this.jarBack = new THREE.Mesh(parts.outer, backMat);
    this.jarBack.renderOrder = 0;
    this.jarGroup.add(this.jarBack);

    const innerMat = this.track(createGlassMaterial(wear, THREE.BackSide, ctx.quality));
    innerMat.opacity = 0.1;
    this.jarInner = new THREE.Mesh(parts.inner, innerMat);
    this.jarInner.renderOrder = 1;
    this.jarGroup.add(this.jarInner);

    const solid = this.track(createGlassSolidMaterial(ctx.quality));
    this.jarBase = new THREE.Mesh(parts.base, solid);
    this.jarBase.renderOrder = 1;
    this.jarGroup.add(this.jarBase);

    const frontMat = this.track(createGlassMaterial(wear, THREE.FrontSide, ctx.quality));
    this.jarFront = new THREE.Mesh(parts.outer, frontMat);
    this.jarFront.renderOrder = 40;
    this.jarGroup.add(this.jarFront);

    this.jarRim = new THREE.Mesh(parts.rim, solid);
    this.jarRim.renderOrder = 41;
    this.jarGroup.add(this.jarRim);

    const shadow = this.track(new ContactShadow(ctx.assets.contactShadow, JAR_R * 3.4, 0.6));
    shadow.follow(JAR_X, JAR_Z, 0, BENCH_Y + 0.001);
    this.root.add(shadow.mesh);
  }

  private buildFruit(ctx: GameContext): void {
    // Two settled layers, packed but not interpenetrating.
    const layout: { x: number; z: number; y: number }[] = [];
    const ring = (count: number, rad: number, y: number, phase: number): void => {
      for (let i = 0; i < count; i++) {
        const a = phase + (i / count) * TAU;
        layout.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad, y });
      }
    };
    ring(5, INNER_R * 0.6, JAR_WALL + 0.043, 0.2);
    layout.push({ x: 0, z: 0, y: JAR_WALL + 0.045 });
    ring(3, INNER_R * 0.5, JAR_WALL + 0.118, 1.1);

    for (let i = 0; i < FRUIT_IN_JAR; i++) {
      const spot = layout[i];
      const radius = this.rng.range(0.038, 0.047);
      const variant = this.rng.int(0, 3);
      const geo = ctx.assets.umeGeometry(0x3000 + i * 271, radius, 0.72 + variant * 0.12, true);
      const mat = this.track(createUmeMaterial(ctx.assets.umeMaps[variant], ctx.quality));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spot.x, spot.y, spot.z);
      mesh.quaternion.setFromEuler(
        new THREE.Euler(this.rng.range(0, TAU), this.rng.range(0, TAU), this.rng.range(0, TAU)),
      );
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.renderOrder = 5;
      this.jarGroup.add(mesh);
      if (this.rng.next() < 0.4) {
        const stem = new THREE.Mesh(
          this.track(makeStemGeometry(radius)),
          this.track(new THREE.MeshStandardMaterial({ color: 0x6a5334, roughness: 0.9 })),
        );
        stem.position.y = radius * 0.86;
        mesh.add(stem);
      }
      this.fruits.push({ mesh, pos: mesh.position.clone(), radius, material: mat });
    }
  }

  private buildBrine(ctx: GameContext): void {
    const bodyGeo = this.track(new THREE.CylinderGeometry(INNER_R * 0.995, INNER_R * 0.995, 1, 40, 1, true));
    bodyGeo.translate(0, 0.5, 0);
    const bodyMat = this.track(createBrineBodyMaterial());
    this.brineBody = new THREE.Mesh(bodyGeo, bodyMat);
    this.brineBody.position.y = JAR_WALL;
    this.brineBody.scale.y = 0.0001;
    this.brineBody.renderOrder = 20;
    this.brineBody.visible = false;
    this.jarGroup.add(this.brineBody);

    const surfGeo = this.track(new THREE.CircleGeometry(INNER_R * 0.995, 44));
    surfGeo.rotateX(-Math.PI / 2);
    const surfMat = this.track(createBrineSurfaceMaterial());
    this.brineSurface = new THREE.Mesh(surfGeo, surfMat);
    this.brineSurface.renderOrder = 21;
    this.brineSurface.visible = false;
    this.jarGroup.add(this.brineSurface);

    // Thin runnels tracing juice down the inside of the glass.
    const runGeo = this.track(new THREE.PlaneGeometry(0.006, 1, 1, 8));
    runGeo.translate(0, -0.5, 0);
    for (let i = 0; i < 5; i++) {
      const mat = this.track(createRunnelMaterial());
      const m = new THREE.Mesh(runGeo, mat);
      const a = (i / 5) * TAU + 0.4;
      m.position.set(Math.cos(a) * INNER_R * 0.985, JAR_H * 0.86, Math.sin(a) * INNER_R * 0.985);
      m.lookAt(0, JAR_H * 0.86, 0);
      m.scale.y = 0.0001;
      m.renderOrder = 22;
      this.jarGroup.add(m);
      this.runnels.push(m);
    }

    // Droplet pool.
    const dropGeo = this.track(new THREE.SphereGeometry(1, 12, 10));
    const dropMat = this.track(new THREE.MeshPhysicalMaterial({
      color: 0xe8bd6a,
      roughness: 0.03,
      metalness: 0,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: 0,
      ior: 1.42,
      envMapIntensity: 1.5,
    }));
    const budget = ctx.quality.dropletBudget;
    for (let i = 0; i < budget; i++) {
      const m = new THREE.Mesh(dropGeo, dropMat);
      m.visible = false;
      m.renderOrder = 25;
      m.scale.setScalar(0.004);
      this.jarGroup.add(m);
      this.droplets.push({
        mesh: m, mode: 'idle', pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        fruit: 0, age: 0, size: 0.004,
      });
    }
  }

  private buildSalt(ctx: GameContext): void {
    const budget = ctx.quality.saltBudget;
    const perMesh = Math.ceil(budget / 3);
    const mat = this.track(createSaltMaterial(ctx.quality));
    for (let g = 0; g < 3; g++) {
      const geo = ctx.assets.saltGeometries[g];
      const im = new THREE.InstancedMesh(geo, mat, perMesh);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = perMesh;
      im.frustumCulled = false;
      im.renderOrder = 10;
      im.castShadow = false;
      this.jarGroup.add(im);
      this.saltMeshes.push(im);
      this.track(im);
    }
    for (let i = 0; i < perMesh * 3; i++) {
      this.grains.push({
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(),
        spin: new THREE.Vector3(), scale: 0, state: -1, offset: new THREE.Vector3(),
        life: 0, active: false, mesh: i % 3,
      });
    }
    this.hideAllGrains();

    // The salt bowl on the bench, with a real heap in it.
    this.saltBowl = new THREE.Group();
    const bowlMat = this.track(new THREE.MeshStandardMaterial({
      map: ctx.assets.wall.map,
      normalMap: ctx.assets.wall.normalMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      color: 0x9a8d78, roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
    }));
    const bowl = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.095, 24, 16, 0, TAU, Math.PI * 0.52, Math.PI * 0.48)),
      bowlMat,
    );
    bowl.position.y = 0.062;
    bowl.castShadow = ctx.quality.shadows;
    bowl.receiveShadow = true;
    this.saltBowl.add(bowl);
    const heapMat = this.track(createSaltMaterial(ctx.quality));
    this.saltHeap = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.072, 20, 12, 0, TAU, 0, Math.PI * 0.5)), heapMat);
    this.saltHeap.position.y = 0.028;
    this.saltHeap.scale.y = 0.55;
    this.saltBowl.add(this.saltHeap);
    this.saltHeap.add(this.crystalCrust(ctx, 0.071, 130, heapMat));
    this.saltBowl.position.set(-0.205, BENCH_Y, 0.115);
    this.root.add(this.saltBowl);
    const bs = this.track(new ContactShadow(ctx.assets.contactShadow, 0.3, 0.5));
    bs.follow(-0.205, 0.115, 0, BENCH_Y + 0.001);
    this.root.add(bs.mesh);
  }

  private buildScoop(ctx: GameContext): void {
    this.scoop = new THREE.Group();
    const parts = makeScoopGeometry(0.058);
    this.track(parts.bowl);
    this.track(parts.handle);
    const mat = this.track(createWoodMaterial(ctx.assets.woodFine, { roughness: 0.78 }));
    mat.color = new THREE.Color(0xd8bb8c);
    const bowl = new THREE.Mesh(parts.bowl, mat);
    bowl.castShadow = ctx.quality.shadows;
    const handle = new THREE.Mesh(parts.handle, mat);
    handle.castShadow = ctx.quality.shadows;
    this.scoop.add(bowl, handle);

    const saltMat = this.track(createSaltMaterial(ctx.quality));
    this.scoopSalt = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.044, 16, 10, 0, TAU, 0, Math.PI * 0.5)), saltMat);
    this.scoopSalt.scale.y = 0.5;
    this.scoopSalt.position.y = 0.012;
    this.scoopSalt.add(this.crystalCrust(ctx, 0.043, 70, saltMat));
    this.scoop.add(this.scoopSalt);

    this.scoopHome.set(-0.195, BENCH_Y + 0.075, 0.115);
    this.scoop.position.copy(this.scoopHome);
    this.scoop.rotation.y = -0.5;
    this.root.add(this.scoop);

    const ss = this.track(new ContactShadow(ctx.assets.contactShadow, 0.2, 0.45));
    this.scoop.userData.shadow = ss;
    this.root.add(ss.mesh);
  }

  /**
   * Scatters real crystals over the surface of a hemispherical heap, so a
   * pile of salt is made of the same grains that get poured out of it.
   * Parented to the heap mesh, so it follows as the heap shrinks.
   */
  private crystalCrust(
    ctx: GameContext,
    radius: number,
    count: number,
    mat: THREE.Material,
  ): THREE.InstancedMesh {
    const geo = ctx.assets.saltGeometries[1];
    const im = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, TAU);
      const r = radius * Math.sqrt(this.rng.next()) * 0.97;
      const y = Math.sqrt(Math.max(0, radius * radius - r * r));
      e.set(this.rng.range(0, TAU), this.rng.range(0, TAU), this.rng.range(0, TAU));
      q.setFromEuler(e);
      const s = this.rng.range(0.0035, 0.008);
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
        q,
        new THREE.Vector3(s, s, s),
      );
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false;
    this.track(im);
    return im;
  }

  private buildLightPatch(ctx: GameContext): void {
    // The bright rectangle the window throws onto the bench. Dragging it is
    // dragging the hour, and the hour is what makes juice appear.
    const geo = this.track(new THREE.PlaneGeometry(0.24, 0.22, 1, 1));
    geo.rotateX(-Math.PI / 2);
    const mat = this.track(new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      map: ctx.assets.softRect,
      alphaMap: ctx.assets.softRect,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    this.lightPatch = new THREE.Mesh(geo, mat);
    this.lightPatch.position.set(0.205, BENCH_Y + 0.0025, 0.115);
    this.lightPatch.renderOrder = 3;
    this.root.add(this.lightPatch);
  }

  private buildLid(ctx: GameContext): void {
    this.lid = new THREE.Group();
    const mat = this.track(createWoodMaterial(ctx.assets.woodFine, { roughness: 0.8 }));
    mat.color = new THREE.Color(0xc7a878);
    const disc = new THREE.Mesh(this.track(new THREE.CylinderGeometry(JAR_R * 0.97, JAR_R * 0.97, 0.016, 30)), mat);
    const knob = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.022, 14, 10)), mat);
    knob.position.y = 0.018;
    knob.scale.y = 0.75;
    this.lid.add(disc, knob);
    // Close beside the jar: once the camera has pushed in, anything further
    // out would be off screen exactly when it is offered.
    this.lid.position.set(-0.155, BENCH_Y + 0.009, -0.145);
    this.lid.visible = false;
    this.lid.castShadow = ctx.quality.shadows;
    this.root.add(this.lid);
  }

  // --------------------------------------------------------------- lifecycle

  enter(ctx: GameContext): void {
    super.enter(ctx);
    ctx.env.setCanopyVisible(false);
    ctx.env.setPhase(phaseForDay(0));
    ctx.env.focusShadows(new THREE.Vector3(0, BENCH_Y, 0), 1.3);
    ctx.rig.setShot(this.shot(ctx, 0), 0);
    if (ctx.state.stepProgress('pourSalt') <= 0) this.resetStage();
  }

  private resetStage(): void {
    this.brine.reset();
    this.hideAllGrains();
    for (const d of this.droplets) {
      d.mode = 'idle';
      d.mesh.visible = false;
    }
    this.scoopFill = 1;
    this.scoopTilt = 0;
    this.scoopTiltTarget = 0;
    this.scoop.position.copy(this.scoopHome);
    this.scoop.rotation.set(0, -0.5, 0);
    this.jarSpin = 0;
    this.jarSpinVel = 0;
    this.freeplayTime = 0;
    this.lidVisible = false;
    this.lid.visible = false;
    this.lightPatch.position.set(0.205, BENCH_Y + 0.0025, 0.115);
    this.cameraCloseness = 0;
    for (const f of this.fruits) {
      f.material.userData.uniforms.uWet.value = 0;
      f.material.userData.uniforms.uBloom.value = 1;
      f.material.userData.uniforms.uBrineLine.value = -10;
    }
  }

  /**
   * One continuous composition. `closeness` eases the lens from a 45mm view of
   * the whole bench to a ~78mm read on the jar as the juice starts to gather:
   * a move, never a cut, and the jar keeps its place in the frame.
   */
  private shot(ctx: GameContext, closeness: number): Parameters<GameContext['rig']['setShot']>[0] {
    const portrait = ctx.viewport.height >= ctx.viewport.width;
    const c = clamp01(closeness);
    return {
      target: new THREE.Vector3(
        lerp(0.0, JAR_X, c),
        lerp(BENCH_Y + 0.10, BENCH_Y + 0.12, c),
        lerp(-0.02, JAR_Z, c),
      ),
      radius: lerp(portrait ? 0.32 : 0.29, portrait ? 0.225 : 0.2, c),
      focalMm: lerp(44, 74, c),
      yaw: lerp(-12, -8, c),
      pitch: lerp(19, 14, c),
      // The jar sits high in both orientations so a hand on the scoop or the
      // light patch never covers the droplets or the rising level.
      anchorPortrait: { x: -0.04, y: lerp(0.26, 0.2, c) },
      anchorLandscape: { x: lerp(0.04, 0.02, c), y: lerp(0.2, 0.17, c) },
      margin: 1.12,
    };
  }

  update(dt: number, ctx: GameContext): void {
    this.hintPulse += dt;
    const hint = ctx.hints.update(0);

    this.brine.tick(dt);
    this.updateScoop(dt, ctx);
    this.updateGrains(dt, ctx);
    this.updateDroplets(dt, ctx);
    this.updateBrineVisuals(dt, ctx);
    this.updateWindow(ctx);
    this.applyHintMotion(hint, dt);

    // Jar spin from free-play flicks, with a soft stop.
    this.jarSpin += this.jarSpinVel * dt;
    this.jarSpinVel = damp(this.jarSpinVel, 0, 3.2, dt);
    this.jarGroup.rotation.y = this.jarSpin;

    this.updateProgress(ctx);

    // Push in as soon as the juice starts to gather, and stay there.
    const wantClose = clamp01(
      Math.max(this.brine.firstContact ? 0.35 : 0, this.brine.extraction * 3.2),
    );
    const before = this.cameraCloseness;
    this.cameraCloseness = damp(this.cameraCloseness, wantClose, 0.55, dt);
    if (Math.abs(this.cameraCloseness - before) > 1e-5) {
      ctx.rig.retarget((s) => {
        const next = this.shot(ctx, this.cameraCloseness);
        s.target.copy(next.target as THREE.Vector3);
        s.radius = next.radius;
        s.focalMm = next.focalMm;
        s.yaw = next.yaw;
        s.pitch = next.pitch;
        s.anchorPortrait = next.anchorPortrait!;
        s.anchorLandscape = next.anchorLandscape!;
      });
    }

    if (ctx.state.phase === 'freeplay') {
      this.freeplayTime += dt;
      if (this.freeplayTime > 10 && !this.lidVisible) {
        this.lidVisible = true;
        this.lid.visible = true;
      }
    }
    if (this.lid.visible) {
      this.lid.position.y = BENCH_Y + 0.009 + Math.max(0, Math.sin(this.hintPulse * 1.6)) * 0.005;
    }
  }

  // ------------------------------------------------------------------- salt

  private hideAllGrains(): void {
    for (const g of this.grains) {
      g.active = false;
      g.scale = 0;
    }
    this.writeGrainMatrices();
  }

  private spawnGrain(worldPos: THREE.Vector3, vel: THREE.Vector3, size: number): void {
    const g = this.grains[this.grainCursor];
    this.grainCursor = (this.grainCursor + 1) % this.grains.length;
    if (!g) return;
    // Grains live in jar-local space so spinning the jar carries them along.
    this.jarGroup.worldToLocal(g.pos.copy(worldPos));
    g.vel.copy(vel).applyQuaternion(this.tmpQ.copy(this.jarGroup.quaternion).invert());
    g.quat.setFromEuler(new THREE.Euler(this.rng.range(0, TAU), this.rng.range(0, TAU), this.rng.range(0, TAU)));
    g.spin.set(this.rng.jitter(9), this.rng.jitter(9), this.rng.jitter(9));
    g.scale = size;
    g.state = -1;
    g.life = 0;
    g.active = true;
  }

  private updateGrains(dt: number, ctx: GameContext): void {
    const dissolve = this.brine.dissolved;
    const level = this.brineLevelY();
    let landedOnFruit = 0;
    for (const g of this.grains) {
      if (!g.active) continue;
      g.life += dt;
      if (g.state === -1) {
        g.vel.y -= 9.81 * dt;
        g.pos.addScaledVector(g.vel, dt);
        g.quat.multiply(
          this.tmpQ.setFromEuler(new THREE.Euler(g.spin.x * dt, g.spin.y * dt, g.spin.z * dt)),
        );

        // Fruit: bounce lightly, then slide off the shoulder into the gaps.
        for (let i = 0; i < this.fruits.length; i++) {
          const f = this.fruits[i];
          this.tmpV.subVectors(g.pos, f.pos);
          const rr = f.radius + g.scale * 0.5;
          const d = this.tmpV.length();
          if (d < rr && d > 1e-5) {
            this.tmpV.multiplyScalar(1 / d);
            g.pos.copy(f.pos).addScaledVector(this.tmpV, rr);
            const vn = g.vel.dot(this.tmpV);
            if (vn < 0) g.vel.addScaledVector(this.tmpV, -vn * 1.28);
            g.vel.multiplyScalar(0.42);
            // Salt that stays put is salt that is working on that fruit.
            if (g.vel.lengthSq() < 0.02 && this.tmpV.y > 0.25) {
              g.state = i;
              g.offset.subVectors(g.pos, f.pos);
              this.brine.addSalt(0.012, i);
              landedOnFruit++;
            } else {
              this.brine.addSalt(0.006, i);
            }
            break;
          }
        }

        // Jar wall: slide down instead of passing through.
        const r = Math.hypot(g.pos.x, g.pos.z);
        const inJar = g.pos.y < JAR_H + 0.02 && r < JAR_R + 0.02;
        if (inJar && r > INNER_R - g.scale * 0.5) {
          const nx = g.pos.x / r;
          const nz = g.pos.z / r;
          g.pos.x = nx * (INNER_R - g.scale * 0.5);
          g.pos.z = nz * (INNER_R - g.scale * 0.5);
          const vn = g.vel.x * nx + g.vel.z * nz;
          if (vn > 0) {
            g.vel.x -= vn * nx * 1.3;
            g.vel.z -= vn * nz * 1.3;
            if (vn > 0.35) ctx.audio.play('saltGlass', clamp01(vn * 0.7));
          }
        }

        // Floor: the jar bottom inside, the bench outside.
        const floorY = inJar ? JAR_WALL + this.bottomPileHeight() : 0.0;
        if (g.pos.y <= floorY + g.scale * 0.4) {
          g.pos.y = floorY + g.scale * 0.4;
          if (g.vel.y < -0.25) {
            ctx.audio.play('saltHeap', clamp01(-g.vel.y * 0.5));
            g.vel.y *= -0.22;
            g.vel.x *= 0.5;
            g.vel.z *= 0.5;
          } else {
            g.state = -2;
            g.vel.set(0, 0, 0);
          }
        }
        if (!inJar && g.pos.y < -0.4) g.active = false;
      } else if (g.state >= 0) {
        const f = this.fruits[g.state];
        if (f) g.pos.copy(f.pos).add(g.offset);
      }

      // Salt below the juice line melts away; that is where it goes.
      if (g.pos.y < level - 0.002) g.scale = Math.max(0, g.scale * (1 - dt * 2.4));
      else if (g.state !== -1) g.scale = Math.max(0, g.scale * (1 - dissolve * dt * 0.28));
      if (g.scale < 0.0004) g.active = false;
    }
    if (landedOnFruit > 0) ctx.audio.play('saltHeap', clamp01(landedOnFruit * 0.22));
    this.writeGrainMatrices();
  }

  private bottomPileHeight(): number {
    let resting = 0;
    for (const g of this.grains) if (g.active && g.state === -2) resting++;
    return Math.min(0.03, resting * 0.00006);
  }

  private writeGrainMatrices(): void {
    const counts = [0, 0, 0];
    for (const g of this.grains) {
      const im = this.saltMeshes[g.mesh];
      if (!im) continue;
      const idx = counts[g.mesh]++;
      if (idx >= im.instanceMatrix.count) continue;
      if (!g.active || g.scale <= 0) {
        this.tmpM.makeScale(0, 0, 0);
      } else {
        this.tmpS.setScalar(g.scale);
        this.tmpM.compose(g.pos, g.quat, this.tmpS);
      }
      im.setMatrixAt(idx, this.tmpM);
    }
    for (let i = 0; i < this.saltMeshes.length; i++) {
      this.saltMeshes[i].count = counts[i];
      this.saltMeshes[i].instanceMatrix.needsUpdate = true;
    }
  }

  private updateScoop(dt: number, ctx: GameContext): void {
    this.scoopTilt = damp(this.scoopTilt, this.scoopTiltTarget, 9, dt);
    this.scoop.rotation.z = -this.scoopTilt * 1.35;

    // Dip it back in the bowl and it fills again: the loop needs no words.
    const nearBowl =
      this.scoop.position.distanceTo(
        this.tmpV.copy(this.saltBowl.position).setY(BENCH_Y + 0.075),
      ) < 0.11;
    if (nearBowl && this.scoopFill < 1) {
      const before = this.scoopFill;
      this.scoopFill = Math.min(1, this.scoopFill + dt * 0.9);
      if (this.scoopFill > before) ctx.audio.play('saltScoop', 0.4);
    }
    this.scoopSalt.visible = this.scoopFill > 0.02;
    this.scoopSalt.scale.set(
      0.55 + this.scoopFill * 0.45,
      (0.2 + this.scoopFill * 0.5) * (1 - clamp01(this.scoopTilt) * 0.4),
      0.55 + this.scoopFill * 0.45,
    );

    const shadow = this.scoop.userData.shadow as ContactShadow | undefined;
    shadow?.follow(
      this.scoop.position.x,
      this.scoop.position.z,
      Math.max(0, this.scoop.position.y - BENCH_Y - 0.06),
      BENCH_Y + 0.001,
    );

    // Pouring: how much comes out follows tilt and how fast the hand moves.
    if (this.scoopTilt > 0.18 && this.scoopFill > 0.005) {
      const rate = (this.scoopTilt - 0.15) * (0.55 + this.pourSound) * 42;
      const n = Math.min(9, Math.floor(rate * dt * 10));
      for (let i = 0; i < n; i++) {
        this.tmpV.set(
          this.scoop.position.x + this.rng.jitter(0.018),
          this.scoop.position.y - 0.012,
          this.scoop.position.z + this.rng.jitter(0.018),
        );
        this.spawnGrain(
          this.tmpV,
          new THREE.Vector3(this.rng.jitter(0.06), -0.04, this.rng.jitter(0.06)),
          this.rng.range(0.0045, 0.0092),
        );
        this.scoopFill = Math.max(0, this.scoopFill - 0.006);
      }
      if (n > 0) ctx.audio.play('saltScoop', clamp01(n * 0.16));
    }
    this.pourSound = damp(this.pourSound, 0, 3, dt);
  }

  // --------------------------------------------------------------- droplets

  private takeDroplet(): Droplet | null {
    for (const d of this.droplets) if (d.mode === 'idle') return d;
    return null;
  }

  private spawnDroplet(fruitIndex: number, size: number, runs: boolean): void {
    const d = this.takeDroplet();
    const f = this.fruits[fruitIndex] ?? this.fruits[0];
    if (!d || !f) return;
    const a = this.rng.range(0, TAU);
    const el = this.rng.range(-0.25, 0.55);
    d.pos.set(
      f.pos.x + Math.cos(a) * f.radius * Math.cos(el),
      f.pos.y + Math.sin(el) * f.radius,
      f.pos.z + Math.sin(a) * f.radius * Math.cos(el),
    );
    d.vel.set(0, 0, 0);
    d.fruit = fruitIndex;
    d.age = 0;
    d.size = 0.0022 + size * 0.0042;
    d.mode = runs ? 'run' : 'bead';
    d.mesh.visible = true;
    d.mesh.position.copy(d.pos);
    d.mesh.scale.setScalar(0.0006);
  }

  private updateDroplets(dt: number, ctx: GameContext): void {
    for (const ev of this.brine.consumeDroplets()) {
      this.spawnDroplet(ev.fruit, ev.size, ev.runs);
    }
    // Beads keep forming while the salt is still working, so the cause stays
    // on screen even when nobody is touching anything.
    this.beadTimer -= dt;
    if (this.beadTimer <= 0 && this.brine.drive > 0.1 && this.brine.day > 0.25) {
      this.beadTimer = this.rng.range(0.5, 1.4);
      const busy = this.droplets.reduce((n, d) => n + (d.mode === 'idle' ? 0 : 1), 0);
      if (busy < Math.min(10, this.droplets.length)) {
        this.spawnDroplet(this.rng.int(0, this.fruits.length), 0.5, this.brine.extraction > 0.12);
      }
    }
    const level = this.brineLevelY();
    for (const d of this.droplets) {
      if (d.mode === 'idle') continue;
      d.age += dt;
      const f = this.fruits[d.fruit];
      if (d.mode === 'bead') {
        // A bead swells in place first: the water is coming out of the skin.
        const grow = clamp01(d.age / 1.6);
        d.mesh.scale.setScalar(d.size * (0.25 + grow * 0.75));
        if (f) {
          this.tmpV.subVectors(d.pos, f.pos).normalize();
          d.pos.copy(f.pos).addScaledVector(this.tmpV, f.radius * 0.98);
          d.mesh.position.copy(d.pos);
        }
        if (d.age > 2.6) d.mode = 'run';
      } else if (d.mode === 'run') {
        // Then it creeps down the curve of the fruit and lets go.
        d.vel.y -= 0.35 * dt;
        d.pos.y += d.vel.y * dt;
        if (f) {
          const dx = d.pos.x - f.pos.x;
          const dz = d.pos.z - f.pos.z;
          const dy = d.pos.y - f.pos.y;
          const len = Math.hypot(dx, dy, dz);
          if (len < f.radius * 0.99 || dy < -f.radius * 0.72) {
            d.mode = 'fall';
            d.vel.set(0, -0.05, 0);
          } else {
            const k = (f.radius * 0.99) / Math.max(1e-5, len);
            d.pos.set(f.pos.x + dx * k, f.pos.y + dy * k, f.pos.z + dz * k);
          }
        } else {
          d.mode = 'fall';
        }
        d.mesh.position.copy(d.pos);
        d.mesh.scale.setScalar(d.size);
      } else if (d.mode === 'fall') {
        d.vel.y -= 9.81 * dt * 0.5;
        d.pos.addScaledVector(d.vel, dt);
        d.mesh.position.copy(d.pos);
        const floor = Math.max(level, JAR_WALL + 0.002);
        if (d.pos.y <= floor) {
          d.mode = 'idle';
          d.mesh.visible = false;
          ctx.audio.play('drip', 0.55, this.rng.jitter(0.5));
        }
      }
    }
  }

  // ----------------------------------------------------------------- liquid

  private brineLevelY(): number {
    return JAR_WALL + this.brine.level * (JAR_H - JAR_WALL * 2) * 0.92;
  }

  private updateBrineVisuals(dt: number, ctx: GameContext): void {
    const y = this.brineLevelY();
    const visible = this.brine.level > 0.004;
    this.brineBody.visible = visible;
    this.brineSurface.visible = visible;
    if (visible) {
      this.brineBody.scale.y = Math.max(0.0001, y - JAR_WALL);
      this.brineSurface.position.y = y;
      const bu = (this.brineBody.material as THREE.ShaderMaterial & { userData: { uniforms: { uTime: { value: number }; uLevel: { value: number }; uBottom: { value: number }; uLightDir: { value: THREE.Vector3 } } } }).userData.uniforms;
      bu.uTime.value = ctx.time;
      bu.uLevel.value = y;
      bu.uBottom.value = JAR_WALL;
      bu.uLightDir.value.copy(ctx.env.sunDirection);
      const su = (this.brineSurface.material as THREE.ShaderMaterial & { userData: { uniforms: { uTime: { value: number }; uLevel: { value: number }; uLightDir: { value: THREE.Vector3 } } } }).userData.uniforms;
      su.uTime.value = ctx.time;
      su.uLevel.value = y;
      su.uLightDir.value.copy(ctx.env.sunDirection);
    }

    // The juice line is a world height, so submerged fruit really do darken.
    const worldLine = this.jarGroup.position.y + y;
    const wet = this.brine.wetness;
    for (const f of this.fruits) {
      const u = f.material.userData.uniforms;
      u.uWet.value = wet;
      u.uBloom.value = 1 - clamp01(this.brine.dissolved * 1.5);
      u.uBrineLine.value = visible ? worldLine : -10;
    }

    // Runnels: brief bright streaks whenever the level actually moves.
    const rising = Math.max(0, this.brine.level - this.lastLevel);
    this.lastLevel = this.brine.level;
    if (rising > 0.0004) ctx.audio.play('pour', clamp01(rising * 90));
    for (let i = 0; i < this.runnels.length; i++) {
      const m = this.runnels[i];
      const mat = m.material as THREE.MeshBasicMaterial;
      const active = rising > 0.0002 || this.brine.drive > 0.15;
      const phase = (ctx.time * 0.6 + i * 0.37) % 1;
      const target = active ? 0.34 * (1 - phase) : 0;
      mat.opacity = damp(mat.opacity, target, 4, dt);
      m.position.y = lerp(JAR_H * 0.9, y + 0.004, phase);
      m.scale.y = Math.max(0.0001, (JAR_H * 0.9 - y) * 0.35 * (1 - phase * 0.4));
    }

    // Salt heap in the bowl drops as it is spooned out.
    const left = clamp01(1 - this.brine.saltPoured * 0.85);
    this.saltHeap.scale.set(0.7 + left * 0.3, (0.18 + left * 0.42), 0.7 + left * 0.3);
  }

  private updateWindow(ctx: GameContext): void {
    const phase = (ctx.env.currentPhase % 1 + 1) % 1;
    // Sun and moon really do cross the window as the days are pulled across.
    const arc = (t: number): { x: number; y: number; vis: boolean } => {
      const k = clamp01(t);
      return {
        x: -0.05 + (k - 0.5) * 0.7,
        y: 1.34 + Math.sin(k * Math.PI) * 0.2 - 0.06,
        vis: k > 0.02 && k < 0.98,
      };
    };
    const dayT = (phase - 0.1) / 0.62;
    const nightT = phase > 0.72 ? (phase - 0.72) / 0.38 : (phase + 0.28) / 0.38;
    const s = arc(dayT);
    this.windowSun.position.set(s.x, s.y, this.windowSun.position.z);
    this.windowSun.visible = s.vis && dayT >= 0 && dayT <= 1;
    const mo = arc(nightT);
    this.windowMoon.position.set(mo.x, mo.y, this.windowMoon.position.z);
    this.windowMoon.visible = !this.windowSun.visible;

    const night = ctx.env.nightAmount;
    this.windowSky.uniforms.uNight.value = night;
    this.roomFill.intensity = lerp(0.35, 1.1, night);
    const patchMat = this.lightPatch.material as THREE.MeshBasicMaterial;
    // Moonlight still leaves a visible pool: the child must be able to keep
    // dragging the hour along after dark.
    patchMat.opacity = lerp(0.55, 0.46, night);
    patchMat.color.setHex(night > 0.4 ? 0xc3d6ff : 0xfff0c8);
    // The patch itself slides with the hour, and it is what the hand grabs.
    const travel = ((phase - 0.1) / 0.62) * 2 - 1;
    this.lightPatch.position.x = 0.205 + clamp(travel, -1, 1) * 0.085;
    this.lightPatch.position.z = 0.115 - clamp(travel, -1, 1) * 0.03;
    this.lightPatch.scale.set(1 + Math.abs(travel) * 0.4, 1, 1 + Math.abs(travel) * 0.25);
  }

  // ------------------------------------------------------------------ hints

  private applyHintMotion(
    hint: { level: number; strength: number; target: string | null; cue: number },
    dt: number,
  ): void {
    void dt;
    const s = hint.strength;
    if (hint.target === 'pourSalt' && hint.level >= 1 && this.grab !== 'scoop') {
      // The scoop settles and turns a little, as if the wood were breathing.
      const breathe = Math.sin(this.hintPulse * 1.6) * 0.004 * s;
      this.scoop.position.y = this.scoopHome.y + breathe + hint.cue * 0.012 * s;
      this.scoop.rotation.y = -0.5 + Math.sin(this.hintPulse * 1.1) * 0.05 * s + hint.cue * 0.12 * s;
    }
    if (hint.target === 'passDays' && hint.level >= 1 && this.grab !== 'light') {
      const mat = this.lightPatch.material as THREE.MeshBasicMaterial;
      mat.opacity += Math.sin(this.hintPulse * 2.1) * 0.09 * s + hint.cue * 0.16 * s;
      this.lightPatch.position.x += hint.cue * 0.02 * s;
    }
  }

  private updateProgress(ctx: GameContext): void {
    if (ctx.state.stage !== 'pickling') return;
    ctx.state.setProgress('pourSalt', clamp01(this.brine.saltPoured / 0.34));
    // Understanding is complete when days have visibly passed AND the level
    // has visibly climbed -- never on salt alone.
    const days = clamp01(this.brine.day / 3.0);
    const level = clamp01(this.brine.level / 0.34);
    ctx.state.setProgress('passDays', Math.min(days, level));
  }

  // ------------------------------------------------------------------ input

  onPointerDown(p: Pointer, ctx: GameContext): void {
    if (!p.primary) return;

    if (this.lid.visible) {
      if (ctx.picker.first(p.ndc, ctx.rig.camera, [this.lid])) {
        ctx.audio.play('placeUme', 0.7);
        ctx.advanceStage();
        return;
      }
    }

    if (ctx.state.isStepUnlocked('pourSalt')) {
      const hit = ctx.picker.first(p.ndc, ctx.rig.camera, [this.scoop, this.saltBowl]);
      if (hit) {
        this.grab = 'scoop';
        // Grab on the plane the scoop is actually resting on, so screen
        // movement maps one-to-one onto bench movement for the whole drag.
        this.grabPlane.set(new THREE.Vector3(0, 1, 0), -this.scoop.position.y);
        const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.grabPoint);
        if (pt) this.grabOffset.subVectors(this.scoop.position, pt);
        else this.grabOffset.set(0, 0, 0);
        ctx.audio.play('saltScoop', 0.35);
        return;
      }
    }

    if (ctx.state.isStepUnlocked('passDays')) {
      const hit = ctx.picker.first(p.ndc, ctx.rig.camera, [this.lightPatch]);
      if (hit) {
        this.grab = 'light';
        this.grabPlane.set(new THREE.Vector3(0, 1, 0), -(BENCH_Y + 0.003));
        ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.grabPoint);
        return;
      }
    }

    // Anywhere on the jar: turn it and watch the drops from another side.
    if (ctx.picker.first(p.ndc, ctx.rig.camera, [this.jarGroup])) {
      this.grab = 'jar';
      return;
    }
    this.grab = null;
  }

  onPointerMove(p: Pointer, ctx: GameContext): void {
    if (!p.primary || !this.grab) return;
    if (this.grab === 'scoop') {
      const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.tmpV);
      if (!pt) return;
      let nx = clamp(pt.x + this.grabOffset.x, -0.4, 0.4);
      let nz = clamp(pt.z + this.grabOffset.z, -0.34, 0.36);

      // A horizontal drag plane turns up-the-screen into away-from-the-camera,
      // so "put the scoop where the jar looks" would land it behind the jar.
      // Magnetise toward the mouth when the finger is over it on screen, which
      // is the only frame of reference a child actually has.
      this.tmpV.set(JAR_X, BENCH_Y + JAR_H, JAR_Z).project(ctx.rig.camera);
      const screenGap = Math.hypot(p.ndc.x - this.tmpV.x, p.ndc.y - this.tmpV.y);
      const pull = 1 - smoothstep(0.1, 0.32, screenGap);
      if (pull > 0) {
        nx = lerp(nx, JAR_X, pull * 0.92);
        nz = lerp(nz, JAR_Z, pull * 0.92);
      }
      const dx = nx - this.scoop.position.x;
      const speed = Math.hypot(p.dx, p.dy) / Math.max(1, ctx.viewport.height);
      this.scoop.position.x = nx;
      this.scoop.position.z = nz;

      // Carrying the scoop over the jar is what tips it: no separate gesture
      // to discover, and no way to hold it over the fruit without pouring.
      // How much comes out then follows how fast the hand is moving.
      const over = 1 - smoothstep(JAR_R * 0.3, JAR_R * 1.7,
        Math.hypot(nx - JAR_X, nz - JAR_Z));
      this.scoop.position.y = lerp(BENCH_Y + 0.075, BENCH_Y + JAR_H + 0.075, over);
      this.clampScoopAboveJar();
      this.scoopTiltTarget = clamp(over * 0.85 + Math.abs(dx) * 4.5 + speed * 5, 0, 1.15);
      this.pourSound = clamp01(speed * 12);
    } else if (this.grab === 'light') {
      const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.tmpV);
      if (!pt) return;
      const dx = pt.x - this.grabPoint.x;
      this.grabPoint.copy(pt);
      // Either direction advances time: a child should not have to guess.
      const days = Math.abs(dx) / 0.075;
      if (days > 0.0005) {
        const before = this.brine.day;
        this.brine.advanceDays(days);
        if (this.brine.day > before) {
          ctx.env.setPhase(phaseForDay(this.brine.day));
          ctx.audio.play('sunMove', clamp01(days * 6));
        }
      }
    } else if (this.grab === 'jar') {
      this.jarSpinVel = clamp(this.jarSpinVel - p.dx * 0.02, -4, 4);
    }
  }

  /** Keeps the scoop resting on the jar's rim rather than passing through it. */
  private clampScoopAboveJar(): void {
    const d = Math.hypot(this.scoop.position.x - JAR_X, this.scoop.position.z - JAR_Z);
    if (d < JAR_R + 0.05) {
      const minY = BENCH_Y + JAR_H + 0.05;
      if (this.scoop.position.y < minY) this.scoop.position.y = minY;
    }
  }

  onPointerUp(_p: Pointer, _ctx: GameContext): void {
    if (this.grab === 'scoop') {
      this.scoopTiltTarget = 0;
      // A released scoop is put down on the bench, nudged clear of the jar --
      // never left balanced on the rim, which would make the next pick-up
      // start from a different height and feel unpredictable.
      const dx = this.scoop.position.x - JAR_X;
      const dz = this.scoop.position.z - JAR_Z;
      const d = Math.hypot(dx, dz);
      const clear = JAR_R + 0.075;
      if (d < clear) {
        if (d < 1e-3) {
          this.scoop.position.x = JAR_X - clear;
        } else {
          this.scoop.position.x = JAR_X + (dx / d) * clear;
          this.scoop.position.z = JAR_Z + (dz / d) * clear;
        }
      }
      this.scoop.position.y = BENCH_Y + 0.075;
    }
    this.grab = null;
  }

  onLongPress(_p: Pointer, _ctx: GameContext): void {
    // Holding the scoop still while tipped keeps a slow, steady stream.
    if (this.grab === 'scoop') this.scoopTiltTarget = Math.max(this.scoopTiltTarget, 0.42);
  }

  onQualityChange(ctx: GameContext): void {
    void ctx;
  }

  /** Scripted actions for automated verification only. */
  debugAct(name: string, amount: number | undefined, ctx: GameContext): void {
    const a = amount ?? 1;
    if (name === 'salt') {
      for (let i = 0; i < Math.round(a * 60); i++) {
        const f = this.fruits[i % this.fruits.length];
        this.tmpV.copy(f.pos).add(new THREE.Vector3(this.rng.jitter(0.02), 0.11, this.rng.jitter(0.02)));
        this.jarGroup.localToWorld(this.tmpV);
        this.spawnGrain(this.tmpV, new THREE.Vector3(0, -0.05, 0), this.rng.range(0.0045, 0.009));
      }
      this.brine.addSalt(a * 0.4, 0);
      this.scoopFill = Math.max(0, this.scoopFill - a * 0.4);
    } else if (name === 'days') {
      this.brine.advanceDays(a);
      ctx.env.setPhase(phaseForDay(this.brine.day));
    } else if (name === 'spin') {
      this.jarSpinVel = a * 2;
    } else if (name === 'lid') {
      this.freeplayTime = 99;
      this.lidVisible = true;
      this.lid.visible = true;
    } else if (name === 'scoopOver') {
      this.scoop.position.set(JAR_X - 0.045, BENCH_Y + JAR_H + 0.07, JAR_Z + 0.02);
      this.scoopTilt = 0.8;
      this.scoopTiltTarget = 0.8;
      this.scoop.rotation.z = -1.05;
    }
  }

  debugHotspots(): Record<string, THREE.Vector3> {
    return {
      scoop: this.scoop.position.clone(),
      jarMouth: new THREE.Vector3(JAR_X, BENCH_Y + JAR_H + 0.06, JAR_Z),
      jar: new THREE.Vector3(JAR_X, BENCH_Y + JAR_H * 0.5, JAR_Z),
      light: this.lightPatch.position.clone(),
      lid: this.lid.position.clone(),
      bowl: this.saltBowl.position.clone().setY(BENCH_Y + 0.08),
    };
  }

  debugProbe(): Record<string, number> {
    let grains = 0;
    for (const g of this.grains) if (g.active) grains++;
    let drops = 0;
    for (const d of this.droplets) if (d.mode !== 'idle') drops++;
    return {
      salt: this.brine.saltPoured,
      day: this.brine.day,
      extraction: this.brine.extraction,
      level: this.brine.level,
      wetness: this.brine.wetness,
      grains,
      drops,
      closeness: this.cameraCloseness,
      scoopFill: this.scoopFill,
    };
  }

  get model(): BrineModel {
    return this.brine;
  }

  dispose(): void {
    void this.jarBack;
    void this.jarFront;
    void this.jarInner;
    void this.jarRim;
    void this.jarBase;
    void this.smoothstepRef;
    super.dispose();
  }

  private smoothstepRef = smoothstep;
}
