import * as THREE from 'three';
import { BaseScene, ContactShadow, type GameContext } from '../core/SceneBase';
import type { StageId } from '../core/GameState';
import type { Pointer } from '../core/Input';
import { clamp, clamp01, damp, easeOutBack, lerp, smoothstep, TAU } from '../core/mathx';
import { fbm2D, makeValueNoise2D, Rng } from '../core/rng';
import { massForRadius, PileSolver, type PileBody } from '../world/Pile';
import { createNetMaterial, createUmeMaterial, createWoodMaterial, type UmeMaterial } from '../world/materials';
import { makeLeafCardTexture } from '../world/textures';
import { makeStemGeometry, makeTrunkGeometry } from '../world/geometry';

const NET_HALF = 0.98;
const NET_GRID = 26;
const FRUIT_COUNT = 9;
const CANOPY_FRUIT = 42;

interface Fruit {
  body: PileBody;
  mesh: THREE.Mesh;
  shadow: ContactShadow;
  baseQuat: THREE.Quaternion;
  landed: boolean;
  variant: number;
}

/**
 * Stage 1 -- early summer orchard.
 *
 * Three causalities, offered strictly one at a time:
 *   pull the net's rolled edge  -> it unrolls over the uneven ground
 *   swing the stake's shadow    -> the hour moves and ripe fruit let go
 *   lift the net's rim          -> everything rolls together into the middle
 */
export class OrchardScene extends BaseScene {
  readonly id: StageId = 'orchard';
  ambience = 0.85;

  private ground!: THREE.Mesh;
  private groundNoise = makeValueNoise2D(0x51a2);
  private net!: THREE.Mesh;
  private netBase!: Float32Array;
  private netUV!: Float32Array;
  private roll!: THREE.Mesh;
  private stake!: THREE.Group;
  private stakeShadow!: THREE.Mesh;
  private shadowGrab!: THREE.Mesh;
  private basket!: THREE.Group;
  private canopyFruit!: THREE.InstancedMesh;
  private fruits: Fruit[] = [];
  private solver!: PileSolver;
  private umeMaterials: UmeMaterial[] = [];

  // --- interaction state --------------------------------------------------
  private spread = 0.5;
  private cornerSnap = 0;
  private bowl = 0;
  private bowlTarget = 0;
  private pullDir = new THREE.Vector2(0, 1);
  private sunT = 0;
  private dropped = 0;
  private dropTimer = 0;
  private hintPulse = 0;
  private freeplayTime = 0;
  private basketGlow = 0;

  private grab: 'roll' | 'shadow' | 'rim' | 'fruit' | null = null;
  private grabFruit: Fruit | null = null;
  private grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private grabPoint = new THREE.Vector3();
  private shadowStartAngle = 0;
  private shadowAngle = -0.9;

  private rng = new Rng(0x0417);
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector2();
  private hitTargets: THREE.Object3D[] = [];

  // ------------------------------------------------------------------ build

  build(ctx: GameContext): void {
    if (this.built) return;
    this.built = true;
    this.buildGround(ctx);
    this.buildTree(ctx);
    this.buildNet(ctx);
    this.buildStake(ctx);
    this.buildFruit(ctx);
    this.buildBasket(ctx);
    this.buildSolver();
  }

  /** Gentle, believable unevenness: the net has to find this shape. */
  private groundHeight(x: number, z: number): number {
    return (fbm2D(this.groundNoise, x * 0.42 + 8, z * 0.42 + 3, 3) - 0.5) * 0.11;
  }

  private buildGround(ctx: GameContext): void {
    const geo = new THREE.PlaneGeometry(46, 46, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const far = smoothstep(3, 14, Math.hypot(x, z));
      pos.setY(i, this.groundHeight(x, z) + far * (fbm2D(this.groundNoise, x * 0.11, z * 0.11, 3) - 0.5) * 1.5);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = this.track(new THREE.MeshStandardMaterial({
      map: ctx.assets.ground.map,
      roughnessMap: ctx.assets.ground.roughnessMap,
      normalMap: ctx.assets.ground.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.55,
    }));
    this.ground = new THREE.Mesh(this.track(geo), mat);
    this.ground.receiveShadow = true;
    this.root.add(this.ground);
  }

  private buildTree(ctx: GameContext): void {
    const trunkGeo = this.track(makeTrunkGeometry(0x77aa, 2.5, 0.19));
    const bark = this.track(createWoodMaterial(ctx.assets.bark, { roughness: 1 }));
    bark.color = new THREE.Color(0x6b5843);
    bark.normalScale.set(1.6, 1.6);
    const trunk = new THREE.Mesh(trunkGeo, bark);
    trunk.position.set(-1.55, -0.03, -1.35);
    trunk.castShadow = ctx.quality.shadows;
    trunk.receiveShadow = true;
    this.root.add(trunk);

    // Limbs reaching over the net.
    const limbRng = new Rng(0x9911);
    for (let i = 0; i < 4; i++) {
      const g = this.track(makeTrunkGeometry(0x2200 + i * 37, 1.5, 0.075));
      const limb = new THREE.Mesh(g, bark);
      limb.position.set(-1.55, 1.55 + i * 0.25, -1.35);
      limb.rotation.z = limbRng.range(-0.9, 0.9);
      limb.rotation.x = limbRng.range(-0.9, 0.9);
      limb.castShadow = ctx.quality.shadows;
      this.root.add(limb);
    }

    // Canopy: alpha-tested leaf clusters, never alpha blended.
    const leaf = makeLeafCardTexture(Math.max(256, ctx.quality.bgTexture), 0x4a4a);
    this.track(leaf.map);
    this.track(leaf.alphaMap);
    const leafMat = this.track(new THREE.MeshStandardMaterial({
      map: leaf.map,
      alphaMap: leaf.alphaMap,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0,
      envMapIntensity: 0.8,
    }));
    const cardGeo = this.track(new THREE.PlaneGeometry(1, 1));
    const cards = ctx.quality.tier === 'low' ? 22 : 46;
    const canopy = new THREE.InstancedMesh(cardGeo, leafMat, cards);
    canopy.castShadow = false;
    canopy.receiveShadow = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const rng = new Rng(0x3131);
    for (let i = 0; i < cards; i++) {
      const a = rng.range(0, TAU);
      const rad = rng.range(0.25, 1.5);
      const p = new THREE.Vector3(
        -1.55 + Math.cos(a) * rad,
        rng.range(1.75, 3.2),
        -1.35 + Math.sin(a) * rad * 0.9,
      );
      e.set(rng.range(-0.8, 0.8), rng.range(0, TAU), rng.range(-0.6, 0.6));
      q.setFromEuler(e);
      const s = rng.range(0.7, 1.5);
      m.compose(p, q, new THREE.Vector3(s, s, s));
      canopy.setMatrixAt(i, m);
    }
    canopy.instanceMatrix.needsUpdate = true;
    this.root.add(canopy);
    this.track(canopy);

    // Distant fruit still hanging in the tree: instanced, low detail.
    const fruitGeo = ctx.assets.umeGeometry(0x1002, 0.032, 0.85, false);
    const fruitMat = this.track(createUmeMaterial(ctx.assets.umeMaps[1], ctx.quality));
    this.canopyFruit = new THREE.InstancedMesh(fruitGeo, fruitMat, CANOPY_FRUIT);
    this.canopyFruit.castShadow = false;
    const rng2 = new Rng(0x8080);
    for (let i = 0; i < CANOPY_FRUIT; i++) {
      const a = rng2.range(0, TAU);
      const rad = rng2.range(0.3, 1.45);
      const p = new THREE.Vector3(
        -1.55 + Math.cos(a) * rad,
        rng2.range(1.7, 3.05),
        -1.35 + Math.sin(a) * rad * 0.9,
      );
      const s = rng2.range(0.8, 1.25);
      m.compose(p, new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      this.canopyFruit.setMatrixAt(i, m);
    }
    this.canopyFruit.instanceMatrix.needsUpdate = true;
    this.root.add(this.canopyFruit);
    this.track(this.canopyFruit);
  }

  private buildNet(ctx: GameContext): void {
    const geo = new THREE.PlaneGeometry(NET_HALF * 2, NET_HALF * 2, NET_GRID, NET_GRID);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    this.netBase = new Float32Array(pos.count * 2);
    this.netUV = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      this.netBase[i * 2] = x;
      this.netBase[i * 2 + 1] = z;
      this.netUV[i * 2] = (x + NET_HALF) / (NET_HALF * 2);
      this.netUV[i * 2 + 1] = (z + NET_HALF) / (NET_HALF * 2);
    }
    const mat = this.track(createNetMaterial(ctx.assets.net));
    this.net = new THREE.Mesh(this.track(geo), mat);
    this.net.castShadow = false;
    this.net.receiveShadow = true;
    this.root.add(this.net);

    // Invisible grab volume that travels with the rolled leading edge.
    const rollGeo = this.track(new THREE.BoxGeometry(0.34, 0.34, NET_HALF * 2.1));
    const rollMat = this.track(new THREE.MeshBasicMaterial({ visible: false }));
    this.roll = new THREE.Mesh(rollGeo, rollMat);
    this.root.add(this.roll);
  }

  private buildStake(ctx: GameContext): void {
    this.stake = new THREE.Group();
    const woodMat = this.track(createWoodMaterial(ctx.assets.woodFine, { roughness: 0.95 }));
    const post = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.016, 0.022, 0.36, 8)),
      woodMat,
    );
    post.position.y = 0.18;
    post.castShadow = ctx.quality.shadows;
    this.stake.add(post);
    const cap = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.026, 10, 8)), woodMat);
    cap.position.y = 0.365;
    this.stake.add(cap);
    // Standing on the ground just in front of the net's near edge, so it is
    // always in frame and always below the fruit the child is watching.
    this.stake.position.set(0.78, this.groundHeight(0.78, 1.02), 1.02);
    this.root.add(this.stake);

    // A generous invisible catch area around the stake, so the hour stays
    // reachable however short the real shadow gets.
    const grabGeo = this.track(new THREE.CircleGeometry(0.34, 20));
    grabGeo.rotateX(-Math.PI / 2);
    this.shadowGrab = new THREE.Mesh(grabGeo, this.track(new THREE.MeshBasicMaterial({ visible: false })));
    this.shadowGrab.position.copy(this.stake.position).setY(this.stake.position.y + 0.006);
    this.root.add(this.shadowGrab);

    // The stake's shadow is a real, touchable object: dragging it moves the hour.
    const shGeo = this.track(new THREE.PlaneGeometry(1, 1));
    shGeo.translate(0.5, 0, 0);
    shGeo.rotateX(-Math.PI / 2);
    const shMat = this.track(new THREE.MeshBasicMaterial({
      color: 0x151b14,
      alphaMap: ctx.assets.contactShadow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
    }));
    this.stakeShadow = new THREE.Mesh(shGeo, shMat);
    this.stakeShadow.renderOrder = 2;
    this.stakeShadow.position.copy(this.stake.position).setY(this.stake.position.y + 0.004);
    this.root.add(this.stakeShadow);
  }

  private buildFruit(ctx: GameContext): void {
    this.umeMaterials = [0, 1, 2].map((i) =>
      this.track(createUmeMaterial(ctx.assets.umeMaps[i], ctx.quality)),
    );
    const stemMat = this.track(new THREE.MeshStandardMaterial({
      color: 0x6a5334, roughness: 0.9, metalness: 0,
    }));
    for (let i = 0; i < FRUIT_COUNT; i++) {
      const radius = this.rng.range(0.036, 0.052);
      const variant = this.rng.int(0, 3);
      const ripeness = 0.6 + variant * 0.18;
      const geo = ctx.assets.umeGeometry(0x2000 + i * 313, radius, ripeness, true);
      const mesh = new THREE.Mesh(geo, this.umeMaterials[variant]);
      mesh.castShadow = ctx.quality.shadows;
      mesh.receiveShadow = true;
      mesh.visible = false;
      if (this.rng.next() < 0.45) {
        const stem = new THREE.Mesh(this.track(makeStemGeometry(radius)), stemMat);
        stem.position.y = radius * 0.86;
        mesh.add(stem);
      }
      this.root.add(mesh);

      const shadow = this.track(new ContactShadow(ctx.assets.contactShadow, radius * 5.2, 0.5));
      shadow.setVisible(false);
      this.root.add(shadow.mesh);

      this.fruits.push({
        body: {
          pos: new THREE.Vector3(0, -5, 0),
          vel: new THREE.Vector3(),
          quat: new THREE.Quaternion(),
          radius,
          mass: massForRadius(radius),
          restitution: 0.16 + this.rng.range(0, 0.08),
          sleeping: true,
          sleepTimer: 0,
          ref: i,
          held: false,
        },
        mesh,
        shadow,
        baseQuat: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(this.rng.range(0, TAU), this.rng.range(0, TAU), this.rng.range(0, TAU)),
        ),
        landed: false,
        variant,
      });
    }
  }

  private buildBasket(ctx: GameContext): void {
    this.basket = new THREE.Group();
    const mat = this.track(new THREE.MeshStandardMaterial({
      map: ctx.assets.weave.map,
      normalMap: ctx.assets.weave.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
      color: 0xcaa877,
    }));
    const body = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.23, 0.18, 0.19, 22, 1, true)),
      mat,
    );
    body.position.y = 0.095;
    body.castShadow = ctx.quality.shadows;
    const floor = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 22)), mat);
    floor.position.y = 0.008;
    const rim = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.23, 0.016, 6, 26)), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.19;
    this.basket.add(body, floor, rim);
    // Just off the near-left corner of the net, so it is always in frame
    // when it appears -- an affordance the child cannot see is not one.
    this.basket.position.set(-0.44, this.groundHeight(-0.44, 1.04), 1.04);
    this.basket.visible = false;
    this.root.add(this.basket);

    const bs = this.track(new ContactShadow(ctx.assets.contactShadow, 0.62, 0.5));
    bs.follow(this.basket.position.x, this.basket.position.z, 0, this.basket.position.y);
    bs.mesh.visible = false;
    this.basket.userData.shadow = bs;
    this.root.add(bs.mesh);
  }

  private buildSolver(): void {
    this.solver = new PileSolver({
      gravity: 9.81,
      linearDamping: 0.5,
      rollingFriction: 1.05,
      bounds: { kind: 'cylinder', center: new THREE.Vector3(0, 0, 0), radius: NET_HALF * 0.99 },
      floorAt: (x, z) => this.surfaceHeight(x, z),
      slopeAt: (x, z, out) => this.surfaceSlope(x, z, out),
    });
    for (const f of this.fruits) this.solver.bodies.push(f.body);
  }

  // ------------------------------------------------------------ net surface

  /** Height of the spread net (or bare ground where it has not reached yet). */
  private surfaceHeight(x: number, z: number): number {
    const g = this.groundHeight(x, z);
    const u = (x + NET_HALF) / (NET_HALF * 2);
    if (u > this.spread) return g;
    return g + 0.014 + this.bowlHeight(x, z);
  }

  private bowlHeight(x: number, z: number): number {
    if (this.bowl <= 0.0005) return 0;
    const rr = Math.min(1, Math.hypot(x, z) / NET_HALF);
    const rm = Math.min(1, Math.max(Math.abs(x), Math.abs(z)) / NET_HALF);
    const shape = Math.pow(rr * 0.55 + rm * 0.45, 1.75);
    const dirBias =
      clamp((x * this.pullDir.x + z * this.pullDir.y) / NET_HALF, 0, 1) * 0.35;
    // Scaled to the reach of a child's hand, not a hammock.
    return this.bowl * (0.16 * shape + dirBias * 0.08 * shape);
  }

  private surfaceSlope(x: number, z: number, out: THREE.Vector2): THREE.Vector2 {
    const e = 0.05;
    const hx = this.surfaceHeight(x + e, z) - this.surfaceHeight(x - e, z);
    const hz = this.surfaceHeight(x, z + e) - this.surfaceHeight(x, z - e);
    return out.set(-hx / (2 * e), -hz / (2 * e));
  }

  /** Rewrites the net mesh from the current spread / bowl / load state. */
  private updateNetMesh(): void {
    const pos = this.net.geometry.attributes.position as THREE.BufferAttribute;
    const rollRadius = 0.155 * clamp01((1 - this.spread) / 0.5);
    const snapEase = easeOutBack(this.cornerSnap);
    for (let i = 0; i < pos.count; i++) {
      const bx = this.netBase[i * 2];
      const bz = this.netBase[i * 2 + 1];
      const u = this.netUV[i * 2];
      let x = bx;
      const z = bz;
      let y: number;
      if (u <= this.spread) {
        y = this.groundHeight(x, z) + 0.014 + this.bowlHeight(x, z);
        // Fruit weight presses dimples into the mesh.
        for (const f of this.fruits) {
          if (!f.landed) continue;
          const d2 = (x - f.body.pos.x) ** 2 + (z - f.body.pos.z) ** 2;
          const r = f.body.radius * 3.1;
          if (d2 < r * r) y -= Math.exp(-d2 / (r * r * 0.35)) * f.body.radius * 0.62;
        }
        // Cloth slack: a gentle drape between the pegged corners.
        const sx = Math.abs(x) / NET_HALF;
        const sz = Math.abs(z) / NET_HALF;
        y -= (1 - sx * sx) * (1 - sz * sz) * 0.018 * (1 - this.bowl * 0.6);
        // Corner suction on completion: the last few centimetres pull tight.
        if (this.cornerSnap > 0 && this.cornerSnap < 1) {
          y += Math.sin(snapEase * Math.PI) * 0.02 * (1 - sx) * (1 - sz);
        }
      } else {
        // Still rolled up: wind the remainder into a bundle at the leading edge.
        const t = clamp01((u - this.spread) / Math.max(1e-3, 1 - this.spread));
        const ang = t * TAU * 2.4;
        const rad = rollRadius * (1 - t * 0.5);
        const anchorX = lerp(-NET_HALF, NET_HALF, this.spread);
        x = anchorX + Math.sin(ang) * rad + rad * 0.2;
        y = this.groundHeight(anchorX, z) + rollRadius * 0.95 + Math.cos(ang) * rad;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    this.net.geometry.computeVertexNormals();

    const anchorX = lerp(-NET_HALF, NET_HALF, this.spread);
    this.roll.position.set(anchorX + 0.03, this.groundHeight(anchorX, 0) + rollRadius, 0);
    this.roll.visible = this.spread < 0.995;
    this.roll.scale.set(1, 1, 1);
  }

  // ---------------------------------------------------------------- gameplay

  enter(ctx: GameContext): void {
    super.enter(ctx);
    ctx.env.setCanopyVisible(true);
    ctx.env.setPhase(0.16 + this.sunT * 0.2);
    ctx.rig.setShot(this.shot(ctx), 0);
    ctx.env.focusShadows(new THREE.Vector3(0, 0, 0), 6.2);
    this.hitTargets = [this.roll, this.stakeShadow, this.shadowGrab, this.net, this.basket];
    if (ctx.state.stage === 'orchard' && ctx.state.stepProgress('spreadNet') <= 0) {
      this.resetStage();
    }
  }

  private resetStage(): void {
    this.spread = 0.5;
    this.cornerSnap = 0;
    this.bowl = 0;
    this.bowlTarget = 0;
    this.sunT = 0;
    this.dropped = 0;
    this.dropTimer = 0;
    this.shadowAngle = -0.9;
    this.freeplayTime = 0;
    this.basketGlow = 0;
    this.basket.visible = false;
    const shadow = this.basket.userData.shadow as ContactShadow | undefined;
    shadow?.setVisible(false);
    for (const f of this.fruits) {
      f.landed = false;
      f.body.pos.set(0, -5, 0);
      f.body.vel.set(0, 0, 0);
      f.body.sleeping = true;
      f.mesh.visible = false;
      f.shadow.setVisible(false);
    }
  }

  private shot(ctx: GameContext): Parameters<GameContext['rig']['setShot']>[0] {
    const portrait = ctx.viewport.height >= ctx.viewport.width;
    return {
      target: new THREE.Vector3(0.0, 0.16, -0.02),
      radius: portrait ? 1.0 : 0.92,
      focalMm: 40,
      yaw: 16,
      pitch: 24,
      // Portrait keeps the net a touch low so the hand works below the fruit;
      // landscape recentres because the thumb comes in from the side.
      anchorPortrait: { x: -0.02, y: -0.06 },
      anchorLandscape: { x: -0.02, y: 0.0 },
      margin: 1.06,
    };
  }

  update(dt: number, ctx: GameContext): void {
    const hint = ctx.hints.update(0);
    this.hintPulse += dt;

    // Sun / hour follows the shadow the child dragged.
    ctx.env.setPhase(0.16 + this.sunT * 0.2);
    this.updateStakeShadow(ctx);

    // The net's bowl relaxes back down when the hand lets go.
    // Held: the rim follows the hand. Released: the net settles slowly, and
    // the fruit keep rolling inward while it does -- which is exactly what a
    // lifted tarp does, and what makes the gathering readable.
    this.bowl = damp(this.bowl, this.bowlTarget, this.grab === 'rim' ? 14 : 0.75, dt);
    if (this.bowl > 0.02) this.solver.wakeAll();
    if (this.cornerSnap > 0 && this.cornerSnap < 1) {
      this.cornerSnap = Math.min(1, this.cornerSnap + dt * 1.5);
    }

    this.applyHintMotion(hint, dt, ctx);
    this.releaseFruit(dt, ctx);

    this.solver.step(dt);
    for (const imp of this.solver.consumeImpacts()) {
      const f = this.fruits[imp.body.ref];
      if (!f) continue;
      const s = clamp01(imp.speed / 2.4);
      if (imp.kind === 'floor') {
        ctx.audio.play(f.variant === 0 ? 'umeFallPop' : 'umeFallSoft', 0.35 + s * 0.65, f.variant - 1);
      } else if (s > 0.25) {
        ctx.audio.play('umeFallRoll', 0.3 + s * 0.5, f.variant - 1);
      }
    }

    this.syncFruit(ctx);
    this.updateNetMesh();
    this.updateProgress(ctx);
    this.updateBasket(dt, ctx);

    ctx.rig.retarget((s) => {
      const portrait = ctx.viewport.height >= ctx.viewport.width;
      s.radius = portrait ? 1.0 : 0.92;
    });
  }

  private updateStakeShadow(ctx: GameContext): void {
    // Shadow length and direction follow the real sun, so dragging it is
    // dragging the hour: the two are never allowed to disagree.
    const sun = ctx.env.sunDirection;
    const horiz = Math.hypot(sun.x, sun.z);
    // Never let the shadow shrink below a hand-sized target: at midday a
    // physically correct shadow would be too small for a four year old to grab.
    const len = clamp(0.62 * (horiz / Math.max(0.18, sun.y)), 0.34, 1.5);
    this.shadowAngle = Math.atan2(-sun.z, -sun.x);
    this.stakeShadow.rotation.y = -this.shadowAngle;
    this.stakeShadow.scale.set(len, 1, 0.09 + len * 0.1);
    const mat = this.stakeShadow.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.34 + 0.26 * clamp01(sun.y * 1.4);
  }

  /** Ripe fruit let go on their own as the hour moves. Nobody shakes the tree. */
  private releaseFruit(dt: number, ctx: GameContext): void {
    const want = Math.floor(clamp01(this.sunT) * FRUIT_COUNT + 0.001);
    if (this.dropped >= want) return;
    this.dropTimer -= dt;
    if (this.dropTimer > 0) return;
    this.dropTimer = this.rng.range(0.32, 0.85);
    const f = this.fruits[this.dropped];
    this.dropped++;
    if (!f) return;
    const a = this.rng.range(0, TAU);
    const rad = this.rng.range(0.12, 0.62);
    f.body.pos.set(Math.cos(a) * rad, 1.55 + this.rng.range(0, 0.5), Math.sin(a) * rad);
    f.body.vel.set(this.rng.jitter(0.12), 0, this.rng.jitter(0.12));
    f.body.sleeping = false;
    f.body.sleepTimer = 0;
    f.landed = true;
    f.mesh.visible = true;
    f.shadow.setVisible(true);
    // Three different voices, so the falling never sounds mechanical.
    ctx.audio.play(
      f.variant === 0 ? 'umeFallPop' : f.variant === 1 ? 'umeFallSoft' : 'umeFallRoll',
      0.5,
      this.rng.jitter(0.6),
    );
  }

  private syncFruit(ctx: GameContext): void {
    const groundLike = (x: number, z: number): number => this.surfaceHeight(x, z);
    for (const f of this.fruits) {
      if (!f.landed) continue;
      f.mesh.position.copy(f.body.pos);
      f.mesh.quaternion.copy(f.body.quat).multiply(f.baseQuat);
      const gy = groundLike(f.body.pos.x, f.body.pos.z);
      f.shadow.follow(f.body.pos.x, f.body.pos.z, f.body.pos.y - gy - f.body.radius, gy);
    }
    void ctx;
  }

  private updateProgress(ctx: GameContext): void {
    const st = ctx.state;
    if (st.stage !== 'orchard') return;
    st.setProgress('spreadNet', smoothstep(0.5, 0.985, this.spread));
    if (st.isStepDone('spreadNet') && this.cornerSnap === 0) {
      this.cornerSnap = 0.001;
      ctx.audio.play('netSettle', 0.8);
    }
    st.setProgress('callSun', clamp01(this.sunT / 0.92));

    // Gathering is measured by where the fruit actually ended up.
    let near = 0;
    let landed = 0;
    for (const f of this.fruits) {
      if (!f.landed) continue;
      landed++;
      if (Math.hypot(f.body.pos.x, f.body.pos.z) < 0.4) near++;
    }
    if (landed >= 3) st.setProgress('gather', clamp01(near / Math.max(3, landed * 0.6)));
  }

  private updateBasket(dt: number, ctx: GameContext): void {
    if (ctx.state.stage !== 'orchard') return;
    if (ctx.state.phase !== 'freeplay') return;
    this.freeplayTime += dt;
    // Free play first: the basket only offers itself after a good while.
    if (this.freeplayTime > 9 && !this.basket.visible) {
      this.basket.visible = true;
      (this.basket.userData.shadow as ContactShadow | undefined)?.setVisible(true);
    }
    if (!this.basket.visible) return;
    this.basketGlow = damp(this.basketGlow, 1, 1.2, dt);
    const pulse = 1 + Math.sin(this.hintPulse * 1.7) * 0.022 * this.basketGlow;
    this.basket.scale.setScalar(pulse);
    this.basket.position.y =
      this.groundHeight(this.basket.position.x, this.basket.position.z) +
      Math.max(0, Math.sin(this.hintPulse * 1.7)) * 0.006 * this.basketGlow;
  }

  /** Wordless hinting: the one object that matters breathes, then twitches. */
  private applyHintMotion(
    hint: { level: number; strength: number; target: string | null; cue: number },
    dt: number,
    ctx: GameContext,
  ): void {
    void dt;
    const s = hint.strength;
    // Reset anything a previous hint moved.
    this.roll.rotation.z = 0;

    if (hint.target === 'spreadNet' && hint.level >= 1) {
      // The rolled edge stirs in the breeze, then gives one short tug.
      const breeze = Math.sin(this.hintPulse * 1.9) * 0.012 * s;
      const tug = hint.cue * 0.055 * s;
      this.roll.position.x += breeze + tug;
      this.net.position.x = breeze * 0.35 + tug * 0.45;
    } else {
      this.net.position.x = damp(this.net.position.x, 0, 6, 1 / 60);
    }

    if (hint.target === 'callSun' && hint.level >= 1) {
      const mat = this.stakeShadow.material as THREE.MeshBasicMaterial;
      mat.opacity += Math.sin(this.hintPulse * 2.3) * 0.08 * s + hint.cue * 0.16 * s;
      this.stakeShadow.rotation.y = -this.shadowAngle + hint.cue * 0.16 * s;
    }

    if (hint.target === 'gather' && hint.level >= 1) {
      // The far rim breathes upward a little, hinting the lift.
      this.bowlTarget = Math.max(this.bowlTarget, hint.cue * 0.1 * s);
    }
    void ctx;
  }

  // ------------------------------------------------------------------ input

  onPointerDown(p: Pointer, ctx: GameContext): void {
    if (!p.primary) return;
    const st = ctx.state;

    if (this.basket.visible) {
      const hit = ctx.picker.first(p.ndc, ctx.rig.camera, [this.basket]);
      if (hit) {
        this.grab = null;
        ctx.audio.play('placeUme', 0.8);
        ctx.advanceStage();
        return;
      }
    }

    if (st.isStepUnlocked('callSun')) {
      const hit = ctx.picker.first(p.ndc, ctx.rig.camera, [this.stakeShadow, this.stake, this.shadowGrab]);
      if (hit) {
        this.grab = 'shadow';
        this.grabPlane.set(new THREE.Vector3(0, 1, 0), -(this.stake.position.y + 0.01));
        const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.grabPoint);
        this.shadowStartAngle = pt
          ? Math.atan2(pt.z - this.stake.position.z, pt.x - this.stake.position.x)
          : this.shadowAngle;
        return;
      }
    }

    if (!st.isStepDone('spreadNet') || this.spread < 0.995) {
      const hit = ctx.picker.first(p.ndc, ctx.rig.camera, [this.roll]);
      if (hit) {
        this.grab = 'roll';
        this.grabPlane.set(new THREE.Vector3(0, 1, 0), -(this.groundHeight(0, 0) + 0.1));
        ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.grabPoint);
        return;
      }
    }

    if (st.isStepUnlocked('gather')) {
      // A fruit under the finger is nudged directly; the rim lifts the net.
      const fruitMeshes = this.fruits.filter((f) => f.landed).map((f) => f.mesh);
      const fh = ctx.picker.first(p.ndc, ctx.rig.camera, fruitMeshes, false);
      if (fh) {
        const f = this.fruits.find((x) => x.mesh === fh.object);
        if (f) {
          this.grab = 'fruit';
          this.grabFruit = f;
          f.body.sleeping = false;
          this.grabPlane.set(new THREE.Vector3(0, 1, 0), -f.body.pos.y);
          ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.grabPoint);
          return;
        }
      }
      const nh = ctx.picker.first(p.ndc, ctx.rig.camera, [this.net], false);
      if (nh) {
        const r = Math.hypot(nh.point.x, nh.point.z) / NET_HALF;
        if (r > 0.42) {
          this.grab = 'rim';
          this.pullDir.set(nh.point.x, nh.point.z).normalize();
          this.grabPoint.copy(nh.point);
          return;
        }
      }
    }
    this.grab = null;
  }

  onPointerMove(p: Pointer, ctx: GameContext): void {
    if (!p.primary || !this.grab) return;
    switch (this.grab) {
      case 'roll': {
        const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.tmpV);
        if (!pt) return;
        const dx = pt.x - this.grabPoint.x;
        this.grabPoint.copy(pt);
        // Only forward motion unrolls; pulling back never rewinds the step.
        if (dx > 0) {
          const before = this.spread;
          this.spread = clamp01(this.spread + dx / (NET_HALF * 2));
          if (this.spread > before + 0.004) ctx.audio.play('netDrag', clamp01(dx * 12));
        }
        this.solver.wakeAll();
        break;
      }
      case 'shadow': {
        const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.tmpV);
        if (!pt) return;
        const a = Math.atan2(pt.z - this.stake.position.z, pt.x - this.stake.position.x);
        let d = a - this.shadowStartAngle;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        this.shadowStartAngle = a;
        // Either direction of swing moves the hour forward: a four year old
        // should not have to discover which way is "correct".
        const step = Math.abs(d) / (Math.PI * 1.35);
        if (step > 0.0004) {
          this.sunT = clamp01(this.sunT + step);
          ctx.audio.play('sunMove', clamp01(step * 24));
        }
        break;
      }
      case 'rim': {
        // Upward screen motion raises the rim; the amount follows the finger.
        const lift = -(p.y - p.downY) / Math.max(120, ctx.viewport.height * 0.42);
        this.bowlTarget = clamp(lift, 0, 1);
        this.solver.wakeAll();
        break;
      }
      case 'fruit': {
        const f = this.grabFruit;
        if (!f) return;
        const pt = ctx.picker.onPlane(p.ndc, ctx.rig.camera, this.grabPlane, this.tmpV);
        if (!pt) return;
        const dx = pt.x - this.grabPoint.x;
        const dz = pt.z - this.grabPoint.z;
        this.grabPoint.copy(pt);
        f.body.vel.x += dx * 12;
        f.body.vel.z += dz * 12;
        f.body.sleeping = false;
        break;
      }
    }
  }

  onPointerUp(_p: Pointer, _ctx: GameContext): void {
    if (this.grab === 'rim') this.bowlTarget = 0;
    this.grab = null;
    this.grabFruit = null;
  }

  onLongPress(p: Pointer, ctx: GameContext): void {
    // A long press on the net simply keeps it lifted -- no hidden mode.
    if (this.grab === 'rim') this.bowlTarget = Math.max(this.bowlTarget, 0.55);
    void p;
    void ctx;
  }

  onQualityChange(ctx: GameContext): void {
    for (const f of this.fruits) f.mesh.castShadow = ctx.quality.shadows;
  }

  /** Scripted actions for automated verification only. */
  debugAct(name: string, amount: number | undefined, ctx: GameContext): void {
    const a = amount ?? 1;
    if (name === 'spread') {
      this.spread = clamp01(this.spread + a * 0.5);
      this.solver.wakeAll();
    } else if (name === 'sun') {
      this.sunT = clamp01(this.sunT + a);
    } else if (name === 'lift') {
      this.bowlTarget = clamp(a, 0, 1);
      this.bowl = this.bowlTarget;
      this.solver.wakeAll();
    } else if (name === 'drop') {
      this.bowlTarget = 0;
    } else if (name === 'basket') {
      this.freeplayTime = 99;
      this.updateBasket(0, ctx);
    }
  }

  debugHotspots(): Record<string, THREE.Vector3> {
    const anchorX = lerp(-NET_HALF, NET_HALF, this.spread);
    const first = this.fruits.find((f) => f.landed);
    return {
      roll: this.roll.position.clone(),
      netEdge: new THREE.Vector3(anchorX * 0.55, this.surfaceHeight(anchorX * 0.55, NET_HALF * 0.8), NET_HALF * 0.8),
      shadow: this.stake.position.clone().add(
        new THREE.Vector3(Math.cos(this.shadowAngle) * 0.16, 0.01, Math.sin(this.shadowAngle) * 0.16),
      ),
      stake: this.stake.position.clone().setY(this.stake.position.y + 0.3),
      basket: this.basket.position.clone().setY(this.basket.position.y + 0.1),
      fruit: first ? first.body.pos.clone() : new THREE.Vector3(0, 0.05, 0),
      center: new THREE.Vector3(0, this.surfaceHeight(0, 0), 0),
    };
  }

  debugProbe(): Record<string, number> {
    let landed = 0;
    let near = 0;
    for (const f of this.fruits) {
      if (!f.landed) continue;
      landed++;
      if (Math.hypot(f.body.pos.x, f.body.pos.z) < 0.4) near++;
    }
    return { spread: this.spread, sunT: this.sunT, bowl: this.bowl, landed, near };
  }

  private tmpUnused(): void {
    void this.tmpV2;
    void this.hitTargets;
    void this.canopyFruit;
  }

  dispose(): void {
    this.tmpUnused();
    super.dispose();
  }
}
