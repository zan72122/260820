import * as THREE from 'three';
import { BaseScene, ContactShadow, type GameContext } from '../core/SceneBase';
import type { StageId } from '../core/GameState';
import type { Pointer } from '../core/Input';
import { clamp, clamp01, damp, lerp, smoothstep, TAU } from '../core/mathx';
import { fbm2D, makeValueNoise2D, Rng } from '../core/rng';
import { DryModel } from '../core/DryModel';
import { createUmeMaterial, createWoodMaterial, type UmeMaterial } from '../world/materials';
import { makeStemGeometry, makeTrayGeometry } from '../world/geometry';

const TABLE_Y = 0.72;
const TRAY_R = 0.30;
const TRAY_X = 0.0;
const TRAY_Z = -0.02;
const COUNT = 12;

interface DryFruitView {
  mesh: THREE.Mesh;
  shadow: ContactShadow;
  material: UmeMaterial;
  radius: number;
  /** Tray-local position; y is handled separately. */
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  lift: number;
  /** 0..1 progress of the current flip animation. */
  flip: number;
  flipFrom: THREE.Quaternion;
  flipTo: THREE.Quaternion;
  rest: THREE.Quaternion;
  placed: boolean;
  held: boolean;
}

/**
 * Stage 3 -- drying in the summer sun.
 *
 * A calm farm robot lays the tray out and steps back; from then on the child
 * places every fruit by hand, sends the sun across, and turns fruit over to
 * find the pale side that never saw the light.
 */
export class DryingScene extends BaseScene {
  readonly id: StageId = 'drying';
  ambience = 0.8;

  private model = new DryModel(COUNT, 2.0);
  private rng = new Rng(0x7ac3);
  private noise = makeValueNoise2D(0x4411);

  private table!: THREE.Group;
  private tray!: THREE.Group;
  private basket!: THREE.Group;
  private robot!: THREE.Group;
  private robotLight!: THREE.Mesh;
  private stake!: THREE.Group;
  private stakeShadow!: THREE.Mesh;
  private shadowGrab!: THREE.Mesh;
  private plate!: THREE.Group;
  private views: DryFruitView[] = [];

  private sunT = 0;
  private robotPhase = 0;
  private hintPulse = 0;
  private freeplayTime = 0;
  private plateVisible = false;
  private topDown = 0;

  private grab: 'fruit' | 'shadow' | null = null;
  private grabView: DryFruitView | null = null;
  private grabMode: 'undecided' | 'move' | 'roll' = 'undecided';
  private grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_Y);
  private grabPoint = new THREE.Vector3();
  private shadowStartAngle = 0;
  private shadowAngle = -0.6;
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector2();

  build(ctx: GameContext): void {
    if (this.built) return;
    this.built = true;
    this.buildGround(ctx);
    this.buildTable(ctx);
    this.buildTray(ctx);
    this.buildBasket(ctx);
    this.buildRobot(ctx);
    this.buildStake(ctx);
    this.buildFruit(ctx);
    this.buildPlate(ctx);
  }

  private groundHeight(x: number, z: number): number {
    return (fbm2D(this.noise, x * 0.4 + 2, z * 0.4 + 6, 3) - 0.5) * 0.07;
  }

  private buildGround(ctx: GameContext): void {
    const geo = this.track(new THREE.PlaneGeometry(40, 40, 60, 60));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.groundHeight(pos.getX(i), pos.getZ(i)));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = this.track(new THREE.MeshStandardMaterial({
      map: ctx.assets.ground.map,
      roughnessMap: ctx.assets.ground.roughnessMap,
      normalMap: ctx.assets.ground.normalMap,
      roughness: 1,
      metalness: 0,
      color: 0xbaae8e,
      envMapIntensity: 0.6,
    }));
    const g = new THREE.Mesh(geo, mat);
    g.receiveShadow = true;
    this.root.add(g);
  }

  private buildTable(ctx: GameContext): void {
    this.table = new THREE.Group();
    const mat = this.track(createWoodMaterial(ctx.assets.wood, { roughness: 1 }));
    const top = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.35, 0.055, 0.92)), mat);
    top.position.y = TABLE_Y - 0.028;
    top.castShadow = ctx.quality.shadows;
    top.receiveShadow = true;
    this.table.add(top);
    const legMat = this.track(createWoodMaterial(ctx.assets.woodFine, { roughness: 1 }));
    legMat.color = new THREE.Color(0x8a6b45);
    for (const [lx, lz] of [[-0.56, -0.35], [0.56, -0.35], [-0.56, 0.35], [0.56, 0.35]]) {
      const leg = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.06, TABLE_Y - 0.055, 0.06)), legMat);
      leg.position.set(lx, (TABLE_Y - 0.055) / 2, lz);
      leg.castShadow = ctx.quality.shadows;
      this.table.add(leg);
    }
    this.root.add(this.table);
  }

  private buildTray(ctx: GameContext): void {
    this.tray = new THREE.Group();
    const parts = makeTrayGeometry(TRAY_R);
    this.track(parts.floor);
    this.track(parts.rim);
    this.track(parts.slats);
    const mat = this.track(createWoodMaterial(ctx.assets.woodFine, { roughness: 0.88 }));
    mat.color = new THREE.Color(0xdcc79c);
    mat.normalScale.set(1.0, 1.0);
    const weaveMat = this.track(new THREE.MeshStandardMaterial({
      map: ctx.assets.weave.map,
      normalMap: ctx.assets.weave.normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      color: 0xd6b784, roughness: 0.9, metalness: 0,
    }));
    const floor = new THREE.Mesh(parts.floor, weaveMat);
    floor.receiveShadow = true;
    const rim = new THREE.Mesh(parts.rim, mat);
    rim.castShadow = ctx.quality.shadows;
    const slats = new THREE.Mesh(parts.slats, mat);
    slats.receiveShadow = true;
    slats.castShadow = false;
    this.tray.add(floor, rim, slats);
    this.tray.position.set(TRAY_X, TABLE_Y + 0.012, TRAY_Z);
    this.root.add(this.tray);

    const sh = this.track(new ContactShadow(ctx.assets.contactShadow, TRAY_R * 2.9, 0.55));
    sh.follow(TRAY_X, TRAY_Z, 0, TABLE_Y + 0.0015);
    this.root.add(sh.mesh);
  }

  private buildBasket(ctx: GameContext): void {
    this.basket = new THREE.Group();
    const mat = this.track(new THREE.MeshStandardMaterial({
      map: ctx.assets.weave.map,
      normalMap: ctx.assets.weave.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      color: 0xc3a273, roughness: 0.88, metalness: 0, side: THREE.DoubleSide,
    }));
    const body = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.15, 0.12, 0.085, 20, 1, true)), mat);
    body.position.y = 0.042;
    const floor = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 20)), mat);
    const rim = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.15, 0.011, 6, 22)), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.085;
    this.basket.add(body, floor, rim);
    this.basket.position.set(-0.44, TABLE_Y + 0.006, 0.2);
    this.basket.castShadow = ctx.quality.shadows;
    this.root.add(this.basket);
    const sh = this.track(new ContactShadow(ctx.assets.contactShadow, 0.42, 0.5));
    sh.follow(this.basket.position.x, this.basket.position.z, 0, TABLE_Y + 0.0015);
    this.root.add(sh.mesh);
  }

  private buildRobot(ctx: GameContext): void {
    this.robot = new THREE.Group();
    const shell = this.track(new THREE.MeshPhysicalMaterial({
      color: 0xd6d9d2, roughness: 0.42, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.3,
    }));
    const accent = this.track(new THREE.MeshStandardMaterial({
      color: 0x6f8f5e, roughness: 0.6, metalness: 0.1,
    }));
    const body = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.11, 0.16, 6, 16)), shell);
    body.position.y = 0.28;
    body.castShadow = ctx.quality.shadows;
    const head = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.088, 20, 14)), shell);
    head.position.y = 0.47;
    head.scale.set(1, 0.86, 0.95);
    head.castShadow = ctx.quality.shadows;
    const visor = this.track(new THREE.MeshStandardMaterial({
      color: 0x21303a, roughness: 0.2, metalness: 0.3, emissive: 0x0d2430, emissiveIntensity: 0.6,
    }));
    const face = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.076, 18, 12, 0, TAU, 0, Math.PI * 0.5)), visor);
    face.position.set(0, 0.47, 0.024);
    face.rotation.x = Math.PI / 2;
    face.scale.set(1, 0.6, 0.8);
    // A single calm indicator, never flashing.
    this.robotLight = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.014, 10, 8)),
      this.track(new THREE.MeshBasicMaterial({ color: 0x9fe08a, toneMapped: false })),
    );
    this.robotLight.position.set(0.0, 0.55, 0.0);
    const arm = this.track(new THREE.CapsuleGeometry(0.026, 0.15, 4, 10));
    const armL = new THREE.Mesh(arm, accent);
    armL.position.set(-0.13, 0.33, 0.02);
    armL.rotation.z = 0.5;
    const armR = new THREE.Mesh(arm, accent);
    armR.position.set(0.13, 0.33, 0.02);
    armR.rotation.z = -0.5;
    const baseM = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.13, 0.15, 0.07, 18)), accent);
    baseM.position.y = 0.035;
    baseM.castShadow = ctx.quality.shadows;
    this.robot.add(body, head, face, this.robotLight, armL, armR, baseM);
    this.robot.userData.armL = armL;
    this.robot.userData.armR = armR;
    this.robot.position.set(-0.78, this.groundHeight(-0.78, 0.42), 0.42);
    this.robot.rotation.y = 0.6;
    this.root.add(this.robot);

    const sh = this.track(new ContactShadow(ctx.assets.contactShadow, 0.5, 0.5));
    this.robot.userData.shadow = sh;
    this.root.add(sh.mesh);
  }

  private buildStake(ctx: GameContext): void {
    this.stake = new THREE.Group();
    const mat = this.track(createWoodMaterial(ctx.assets.woodFine, { roughness: 0.95 }));
    const post = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 8)), mat);
    post.position.y = 0.11;
    post.castShadow = ctx.quality.shadows;
    this.stake.add(post);
    // Close enough to the tray that it stays in frame when the shot climbs
    // toward straight-down: the sun control must never leave the screen.
    this.stake.position.set(0.375, TABLE_Y + 0.002, 0.235);
    this.root.add(this.stake);

    const grabGeo = this.track(new THREE.CircleGeometry(0.15, 18));
    grabGeo.rotateX(-Math.PI / 2);
    this.shadowGrab = new THREE.Mesh(grabGeo, this.track(new THREE.MeshBasicMaterial({ visible: false })));
    this.shadowGrab.position.copy(this.stake.position).setY(this.stake.position.y + 0.005);
    this.root.add(this.shadowGrab);

    const geo = this.track(new THREE.PlaneGeometry(1, 1));
    geo.translate(0.5, 0, 0);
    geo.rotateX(-Math.PI / 2);
    const shMat = this.track(new THREE.MeshBasicMaterial({
      color: 0x231c10,
      alphaMap: ctx.assets.contactShadow,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      toneMapped: false,
    }));
    this.stakeShadow = new THREE.Mesh(geo, shMat);
    this.stakeShadow.position.set(0.375, TABLE_Y + 0.004, 0.235);
    this.stakeShadow.renderOrder = 3;
    this.root.add(this.stakeShadow);
  }

  private buildFruit(ctx: GameContext): void {
    const stemMat = this.track(new THREE.MeshStandardMaterial({ color: 0x6a5334, roughness: 0.9 }));
    for (let i = 0; i < COUNT; i++) {
      const radius = this.rng.range(0.033, 0.042);
      const variant = this.rng.int(0, 3);
      const geo = ctx.assets.umeGeometry(0x4000 + i * 419, radius, 0.8 + variant * 0.07, true);
      const mat = this.track(createUmeMaterial(ctx.assets.umeMaps[variant], ctx.quality));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = ctx.quality.shadows;
      mesh.receiveShadow = true;
      if (this.rng.next() < 0.35) {
        const stem = new THREE.Mesh(this.track(makeStemGeometry(radius)), stemMat);
        stem.position.y = radius * 0.86;
        mesh.add(stem);
      }
      this.root.add(mesh);
      const shadow = this.track(new ContactShadow(ctx.assets.contactShadow, radius * 5, 0.5));
      this.root.add(shadow.mesh);

      // Fruit start heaped in the basket, wet from the jar.
      const a = (i / COUNT) * TAU + this.rng.range(-0.2, 0.2);
      const rad = this.rng.range(0, 0.085);
      const view: DryFruitView = {
        mesh, shadow, material: mat, radius,
        x: this.basket.position.x + Math.cos(a) * rad,
        z: this.basket.position.z + Math.sin(a) * rad,
        homeX: this.basket.position.x + Math.cos(a) * rad,
        homeZ: this.basket.position.z + Math.sin(a) * rad,
        lift: 0,
        flip: 1,
        flipFrom: new THREE.Quaternion(),
        flipTo: new THREE.Quaternion(),
        rest: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(this.rng.range(-0.3, 0.3), this.rng.range(0, TAU), this.rng.range(-0.3, 0.3)),
        ),
        placed: false,
        held: false,
      };
      view.flipFrom.copy(view.rest);
      view.flipTo.copy(view.rest);
      mat.userData.uniforms.uWet.value = 0.62;
      this.views.push(view);
    }
  }

  private buildPlate(ctx: GameContext): void {
    this.plate = new THREE.Group();
    const mat = this.track(new THREE.MeshPhysicalMaterial({
      color: 0xf2ece0, roughness: 0.25, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2,
    }));
    const disc = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.12, 0.1, 0.014, 30)), mat);
    const lip = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.12, 0.008, 6, 26)), mat);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.008;
    this.plate.add(disc, lip);
    // Inside the frame the top-down shot settles into.
    this.plate.position.set(0.36, TABLE_Y + 0.008, -0.2);
    this.plate.visible = false;
    this.plate.castShadow = ctx.quality.shadows;
    this.root.add(this.plate);
    void ctx;
  }

  // --------------------------------------------------------------- lifecycle

  enter(ctx: GameContext): void {
    super.enter(ctx);
    ctx.env.setCanopyVisible(false);
    ctx.env.setPhase(0.3 + this.sunT * 0.2);
    ctx.env.focusShadows(new THREE.Vector3(0, TABLE_Y, 0), 1.2);
    ctx.rig.setShot(this.shot(ctx, 0), 0);
    if (ctx.state.stepProgress('placeUme') <= 0) this.resetStage();
  }

  private resetStage(): void {
    this.model.reset();
    this.sunT = 0;
    this.robotPhase = 0;
    this.freeplayTime = 0;
    this.plateVisible = false;
    this.plate.visible = false;
    this.topDown = 0;
    for (const v of this.views) {
      v.placed = false;
      v.held = false;
      v.lift = 0;
      v.x = v.homeX;
      v.z = v.homeZ;
      v.flip = 1;
      v.material.userData.uniforms.uDryA.value = 0;
      v.material.userData.uniforms.uDryB.value = 0;
      v.material.userData.uniforms.uWet.value = 0.62;
    }
  }

  /**
   * The shot climbs toward straight-down as the fruit finish drying, so the
   * final image is the row of ume seen from above -- reached by a slow move,
   * not by cutting to a results screen.
   */
  private shot(ctx: GameContext, top: number): Parameters<GameContext['rig']['setShot']>[0] {
    const portrait = ctx.viewport.height >= ctx.viewport.width;
    const t = clamp01(top);
    return {
      target: new THREE.Vector3(lerp(-0.05, TRAY_X, t), TABLE_Y + 0.05, lerp(0.02, TRAY_Z, t)),
      radius: lerp(portrait ? 0.52 : 0.48, portrait ? 0.42 : 0.4, t),
      focalMm: lerp(44, 55, t),
      yaw: lerp(10, 4, t),
      pitch: lerp(26, 72, t),
      anchorPortrait: { x: 0, y: lerp(0.16, 0.05, t) },
      anchorLandscape: { x: lerp(0.1, 0.02, t), y: lerp(0.12, 0.04, t) },
      margin: 1.12,
    };
  }

  update(dt: number, ctx: GameContext): void {
    this.hintPulse += dt;
    const hint = ctx.hints.update(0);

    ctx.env.setPhase(0.3 + this.sunT * 0.22);
    this.updateStakeShadow(ctx);
    this.updateRobot(dt, ctx);

    // Sun hours only accumulate while the sun is actually being sent across.
    this.model.tick(dt);
    this.relaxPlacement(dt);
    this.syncFruit(dt, ctx);
    this.applyHintMotion(hint);
    this.updateProgress(ctx);

    const wantTop = clamp01(this.model.overallDryness * 1.5);
    const before = this.topDown;
    this.topDown = damp(this.topDown, wantTop, 0.5, dt);
    if (Math.abs(this.topDown - before) > 1e-5) {
      ctx.rig.retarget((s) => {
        const next = this.shot(ctx, this.topDown);
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
      if (this.freeplayTime > 11 && !this.plateVisible) {
        this.plateVisible = true;
        this.plate.visible = true;
      }
    }
    if (this.plate.visible) {
      this.plate.position.y = TABLE_Y + 0.008 + Math.max(0, Math.sin(this.hintPulse * 1.5)) * 0.005;
    }
  }

  private updateStakeShadow(ctx: GameContext): void {
    const sun = ctx.env.sunDirection;
    const horiz = Math.hypot(sun.x, sun.z);
    // Same rule as the orchard: the shadow must stay big enough to grab.
    const len = clamp(0.24 * (horiz / Math.max(0.2, sun.y)), 0.15, 0.6);
    this.shadowAngle = Math.atan2(-sun.z, -sun.x);
    this.stakeShadow.rotation.y = -this.shadowAngle;
    this.stakeShadow.scale.set(len, 1, 0.05 + len * 0.09);
    (this.stakeShadow.material as THREE.MeshBasicMaterial).opacity = 0.24 + 0.22 * clamp01(sun.y * 1.4);
  }

  /** The robot lays the tray out, wipes it down, then keeps a calm distance. */
  private updateRobot(dt: number, ctx: GameContext): void {
    this.robotPhase = Math.min(1, this.robotPhase + dt * 0.22);
    const p = this.robotPhase;
    const approach = smoothstep(0, 0.35, p);
    const retreat = smoothstep(0.6, 1, p);
    const x = lerp(lerp(-0.95, -0.42, approach), -0.78, retreat);
    const z = lerp(lerp(0.62, 0.28, approach), 0.42, retreat);
    this.robot.position.set(x, this.groundHeight(x, z) + Math.sin(this.hintPulse * 1.4) * 0.004, z);
    this.robot.rotation.y = lerp(0.9, 0.55, retreat);

    const armR = this.robot.userData.armR as THREE.Mesh;
    const wipe = p > 0.34 && p < 0.62 ? Math.sin((p - 0.34) / 0.28 * Math.PI * 3) : 0;
    armR.rotation.z = -0.5 + wipe * 0.55;
    armR.rotation.x = wipe * 0.3;
    (this.robotLight.material as THREE.MeshBasicMaterial).color.setHex(
      p < 0.62 ? 0xffd27a : 0x9fe08a,
    );
    const sh = this.robot.userData.shadow as ContactShadow | undefined;
    sh?.follow(this.robot.position.x, this.robot.position.z, 0, this.groundHeight(x, z) + 0.002);
    void ctx;
  }

  /**
   * Placed fruit drift toward a tidy hexagonal lattice while pushing each
   * other apart -- so "close enough" always resolves into a neat row.
   */
  private relaxPlacement(dt: number): void {
    const placed = this.views.filter((v) => v.placed && !v.held);
    const spacing = 0.098;
    for (const v of placed) {
      // Nearest lattice site, in tray-local coordinates.
      const lx = v.x - TRAY_X;
      const lz = v.z - TRAY_Z;
      const row = Math.round(lz / (spacing * 0.866));
      const col = Math.round((lx - (row % 2 ? spacing * 0.5 : 0)) / spacing);
      const tx = TRAY_X + col * spacing + (row % 2 ? spacing * 0.5 : 0);
      const tz = TRAY_Z + row * spacing * 0.866;
      const inside = Math.hypot(tx - TRAY_X, tz - TRAY_Z) < TRAY_R - v.radius * 1.6;
      if (inside) {
        v.x = damp(v.x, tx, 2.6, dt);
        v.z = damp(v.z, tz, 2.6, dt);
      }
    }
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i];
          const b = placed[j];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const min = a.radius + b.radius + 0.008;
          const d = Math.hypot(dx, dz);
          if (d < min && d > 1e-6) {
            const push = (min - d) * 0.5;
            const nx = dx / d;
            const nz = dz / d;
            a.x -= nx * push;
            a.z -= nz * push;
            b.x += nx * push;
            b.z += nz * push;
          } else if (d <= 1e-6) {
            a.x -= 0.004;
            b.x += 0.004;
          }
        }
      }
      for (const v of placed) {
        const dx = v.x - TRAY_X;
        const dz = v.z - TRAY_Z;
        const r = Math.hypot(dx, dz);
        const lim = TRAY_R - v.radius * 1.35;
        if (r > lim && r > 1e-6) {
          v.x = TRAY_X + (dx / r) * lim;
          v.z = TRAY_Z + (dz / r) * lim;
        }
      }
    }
  }

  private syncFruit(dt: number, ctx: GameContext): void {
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      const f = this.model.fruits[i];
      const surfaceY = v.placed ? TABLE_Y + 0.038 : TABLE_Y + 0.02;
      v.lift = damp(v.lift, v.held ? 0.075 : 0, 12, dt);
      const y = surfaceY + v.radius + v.lift;
      v.mesh.position.set(v.x, y, v.z);

      if (v.flip < 1) {
        v.flip = Math.min(1, v.flip + dt * 2.6);
        const t = v.flip * v.flip * (3 - 2 * v.flip);
        v.mesh.quaternion.slerpQuaternions(v.flipFrom, v.flipTo, t);
        // A rolled fruit rides up over its own shoulder as it turns.
        v.mesh.position.y = y + Math.sin(t * Math.PI) * v.radius * 0.4;
        v.mesh.position.x = v.x + Math.sin(t * Math.PI) * v.radius * 0.22;
      } else {
        v.mesh.quaternion.copy(v.flipTo);
      }

      const u = v.material.userData.uniforms;
      u.uDryA.value = this.model.sideDryness(i, 0);
      u.uDryB.value = this.model.sideDryness(i, 1);
      u.uWet.value = Math.max(0, 0.62 - f.dryness * 0.8);
      v.shadow.follow(v.mesh.position.x, v.z, v.lift, surfaceY + 0.0018);
    }
    void ctx;
  }

  private applyHintMotion(hint: {
    level: number; strength: number; target: string | null; cue: number;
  }): void {
    const s = hint.strength;
    if (hint.target === 'placeUme' && hint.level >= 1) {
      // The topmost fruit in the basket rocks a little, then half-lifts.
      const v = this.views.find((x) => !x.placed && !x.held);
      if (v) {
        v.mesh.position.y += Math.sin(this.hintPulse * 2.2) * 0.003 * s + hint.cue * 0.014 * s;
        v.mesh.rotation.z += Math.sin(this.hintPulse * 1.7) * 0.02 * s;
      }
    }
    if (hint.target === 'sunDry' && hint.level >= 1) {
      const mat = this.stakeShadow.material as THREE.MeshBasicMaterial;
      mat.opacity += Math.sin(this.hintPulse * 2.2) * 0.08 * s + hint.cue * 0.14 * s;
      this.stakeShadow.rotation.y = -this.shadowAngle + hint.cue * 0.14 * s;
    }
  }

  private updateProgress(ctx: GameContext): void {
    if (ctx.state.stage !== 'drying') return;
    ctx.state.setProgress('placeUme', clamp01(this.model.placedCount / 8));
    // Sending the sun across is the step. Turning fruit over is a discovery
    // that visibly improves them, never a gate the child has to find first.
    ctx.state.setProgress(
      'sunDry',
      Math.min(clamp01(this.sunT / 0.72), clamp01(this.model.placedCount / 8)),
    );
  }

  // ------------------------------------------------------------------ input

  onPointerDown(p: Pointer, ctx: GameContext): void {
    if (!p.primary) return;

    if (this.plate.visible && ctx.picker.first(p.ndc, ctx.rig.camera, [this.plate])) {
      ctx.audio.play('placeUme', 0.7);
      ctx.advanceStage();
      return;
    }

    if (ctx.state.isStepUnlocked('sunDry')) {
      const hit = ctx.picker.first(p.ndc, ctx.rig.camera, [this.stakeShadow, this.stake, this.shadowGrab]);
      if (hit) {
        this.grab = 'shadow';
        this.grabPlane.set(new THREE.Vector3(0, 1, 0), -(TABLE_Y + 0.006));
        const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.grabPoint);
        this.shadowStartAngle = pt
          ? Math.atan2(pt.z - this.stake.position.z, pt.x - this.stake.position.x)
          : this.shadowAngle;
        return;
      }
    }

    const meshes = this.views.map((v) => v.mesh);
    const hit = ctx.picker.first(p.ndc, ctx.rig.camera, meshes, false);
    if (hit) {
      const v = this.views.find((x) => x.mesh === hit.object);
      if (v) {
        this.grab = 'fruit';
        this.grabView = v;
        // Fruit still in the basket are always picked up. Fruit already laid
        // out wait to see whether the finger flicks (roll) or lingers (move).
        this.grabMode = v.placed ? 'undecided' : 'move';
        v.held = this.grabMode === 'move';
        this.grabPlane.set(new THREE.Vector3(0, 1, 0), -(TABLE_Y + 0.06));
        ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.grabPoint);
        return;
      }
    }
    this.grab = null;
  }

  onPointerMove(p: Pointer, ctx: GameContext): void {
    if (!p.primary || !this.grab) return;
    if (this.grab === 'shadow') {
      const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.tmpV);
      if (!pt) return;
      const a = Math.atan2(pt.z - this.stake.position.z, pt.x - this.stake.position.x);
      let d = a - this.shadowStartAngle;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.shadowStartAngle = a;
      const step = Math.abs(d) / (Math.PI * 1.3);
      if (step > 0.0004) {
        this.sunT = clamp01(this.sunT + step);
        this.model.addSun(step * 5.2);
        ctx.audio.play('sunMove', clamp01(step * 22));
      }
      return;
    }

    const v = this.grabView;
    if (!v) return;

    if (this.grabMode === 'undecided') {
      const dt = performance.now() - p.downTime;
      const dist = Math.hypot(p.x - p.downX, p.y - p.downY);
      if (dist > 14) {
        const horizontal = Math.abs(p.x - p.downX) > Math.abs(p.y - p.downY) * 1.15;
        if (horizontal && dt < 700) {
          this.rollFruit(v, p.x - p.downX, ctx);
          this.grabMode = 'roll';
          return;
        }
        this.grabMode = 'move';
        v.held = true;
      } else if (dt > 260) {
        this.grabMode = 'move';
        v.held = true;
      }
      return;
    }
    if (this.grabMode === 'roll') return;

    const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.tmpV);
    if (!pt) return;
    v.x = clamp(pt.x, -0.62, 0.62);
    v.z = clamp(pt.z, -0.42, 0.44);
  }

  private rollFruit(v: DryFruitView, dx: number, ctx: GameContext): void {
    const i = this.views.indexOf(v);
    if (i < 0) return;
    this.model.roll(i);
    v.flipFrom.copy(v.mesh.quaternion);
    const axis = new THREE.Vector3(0, 0, dx >= 0 ? -1 : 1);
    v.flipTo.copy(v.flipFrom).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, Math.PI));
    v.flip = 0;
    ctx.audio.play('rollUme', 0.6, this.rng.jitter(0.4));
  }

  onPointerUp(_p: Pointer, ctx: GameContext): void {
    const v = this.grabView;
    if (v && this.grabMode !== 'roll') {
      v.held = false;
      const onTray = Math.hypot(v.x - TRAY_X, v.z - TRAY_Z) < TRAY_R + 0.075;
      if (onTray) {
        if (!v.placed) {
          v.placed = true;
          this.model.place(this.views.indexOf(v));
        }
        ctx.audio.play('placeUme', 0.55, this.rng.jitter(0.5));
      } else if (v.placed) {
        // Taken back off the tray: it goes home, and stops drying.
        v.placed = false;
        v.x = v.homeX;
        v.z = v.homeZ;
        const f = this.model.fruits[this.views.indexOf(v)];
        if (f) f.placed = false;
      } else {
        v.x = v.homeX;
        v.z = v.homeZ;
      }
    }
    this.grab = null;
    this.grabView = null;
    this.grabMode = 'undecided';
  }

  onLongPress(_p: Pointer, _ctx: GameContext): void {
    if (this.grab === 'fruit' && this.grabView && this.grabMode === 'undecided') {
      this.grabMode = 'move';
      this.grabView.held = true;
    }
  }

  /** Scripted actions for automated verification only. */
  debugAct(name: string, amount: number | undefined, ctx: GameContext): void {
    const a = amount ?? 1;
    if (name === 'placeAll') {
      const n = Math.min(this.views.length, Math.max(1, Math.round(a * this.views.length)));
      for (let i = 0; i < n; i++) {
        const v = this.views[i];
        const ring = i < 4 ? 0 : 1;
        const idx = ring === 0 ? i : i - 4;
        const cnt = ring === 0 ? 4 : 8;
        const rad = ring === 0 ? 0.085 : 0.185;
        const ang = (idx / cnt) * TAU;
        v.x = TRAY_X + Math.cos(ang) * rad;
        v.z = TRAY_Z + Math.sin(ang) * rad;
        v.placed = true;
        this.model.place(i);
      }
    } else if (name === 'sun') {
      this.sunT = clamp01(this.sunT + a);
      this.model.addSun(a * 3.4);
    } else if (name === 'roll') {
      const v = this.views.find((x) => x.placed);
      if (v) this.rollFruit(v, 1, ctx);
    } else if (name === 'rollAll') {
      for (const v of this.views) if (v.placed) this.rollFruit(v, 1, ctx);
    } else if (name === 'plate') {
      this.freeplayTime = 99;
      this.plateVisible = true;
      this.plate.visible = true;
    }
  }

  debugHotspots(): Record<string, THREE.Vector3> {
    const loose = this.views.find((v) => !v.placed);
    const placed = this.views.find((v) => v.placed);
    return {
      looseFruit: loose ? loose.mesh.position.clone() : new THREE.Vector3(0, TABLE_Y + 0.1, 0),
      placedFruit: placed ? placed.mesh.position.clone() : new THREE.Vector3(0, TABLE_Y + 0.1, 0),
      tray: new THREE.Vector3(TRAY_X, TABLE_Y + 0.05, TRAY_Z),
      trayEdge: new THREE.Vector3(TRAY_X + TRAY_R * 0.55, TABLE_Y + 0.05, TRAY_Z + TRAY_R * 0.45),
      shadow: this.stake.position.clone().add(
        new THREE.Vector3(Math.cos(this.shadowAngle) * 0.07, 0.008, Math.sin(this.shadowAngle) * 0.07),
      ),
      stake: this.stake.position.clone().setY(this.stake.position.y + 0.12),
      plate: this.plate.position.clone().setY(this.plate.position.y + 0.02),
    };
  }

  debugProbe(): Record<string, number> {
    return {
      placed: this.model.placedCount,
      sunT: this.sunT,
      dryness: this.model.overallDryness,
      dryA: this.model.sideDryness(0, 0),
      dryB: this.model.sideDryness(0, 1),
      dryBMax: this.model.fruits.reduce(
        (m, _f, i) => Math.max(m, this.model.sideDryness(i, 1)), 0),
      turned: this.model.fruits.reduce((n, f) => n + (f.up === 1 ? 1 : 0), 0),
      topDown: this.topDown,
      uDryA: this.views[0]?.material.userData.uniforms.uDryA.value ?? -1,
      uDryB: this.views[0]?.material.userData.uniforms.uDryB.value ?? -1,
    };
  }

  get dryModel(): DryModel {
    return this.model;
  }

  dispose(): void {
    void this.tmpV2;
    super.dispose();
  }
}
