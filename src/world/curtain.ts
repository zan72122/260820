import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  TorusGeometry,
  type Material,
} from 'three/webgpu';
import { LAYOUT } from '../core/config';
import { Spring, clamp, clamp01, fbm2, smoothstep } from '../core/mathx';
import type { Materials } from '../art/materials';

/**
 * Cloth without a cloth solver.
 *
 * A hanging curtain only ever does three things the eye actually checks:
 * it pleats, it swings from the top like a pendulum, and it bunches up when you
 * gather it. All three are closed-form functions of (u, v, gather, time), so we
 * evaluate them straight into the position buffer. ~1.2k vertices per panel,
 * no solver, no tunnelling, identical on every device - and it still has the
 * weight of a heavy velvet leg because the pleat depth is driven by how much
 * fabric has to go somewhere when the span shrinks.
 */

interface PanelOpts {
  /** X of the fixed (upstage/outer) edge. */
  anchorX: number;
  /** +1 when the panel runs toward +X from its anchor, -1 the other way. */
  dir: 1 | -1;
  /** Flat width of the cloth in metres. */
  width: number;
  z: number;
  topY: number;
  bottomY: number;
  seed: number;
  wseg?: number;
  hseg?: number;
  /** Pleats per metre of hanging cloth. */
  pleatDensity?: number;
}

export class CurtainPanel {
  readonly mesh: Mesh;
  readonly edge: Mesh;
  readonly group = new Group();

  /** Metres the free edge has retreated toward the anchor. */
  gather = 0;
  /** Pendulum swing in Z, driven by how fast the cloth was pulled. */
  sway = 0;
  swayVel = 0;
  /** Local push where a finger is resting on the cloth. */
  bulge = 0;
  bulgeV = 0.5;

  private o: Required<PanelOpts>;
  private pos: Float32Array;
  private nrm: Float32Array;
  private edgePos: Float32Array;
  private edgeNrm: Float32Array;
  private foldNoise: Float32Array;
  private gx: number;
  private gy: number;
  private lastGather = 0;

  constructor(opts: PanelOpts, material: Material, edgeMaterial: Material) {
    this.o = {
      wseg: 40,
      hseg: 20,
      pleatDensity: 2.1,
      ...opts,
    } as Required<PanelOpts>;
    this.gx = this.o.wseg;
    this.gy = this.o.hseg;

    const geo = new PlaneGeometry(1, 1, this.gx, this.gy);
    if (this.o.dir < 0) {
      // Mapping u onto -X mirrors the lattice, which flips this panel's faces.
      // Re-wind it so both cloths present the same side to the wing and take
      // light identically instead of one going flat black.
      const idx = geo.getIndex()!;
      const arr = Array.from(idx.array).reverse();
      geo.setIndex(arr);
    }
    // Bake UVs in material space so the weave stays the size of real velvet
    // however far the cloth is gathered.
    const uv = geo.attributes.uv as BufferAttribute;
    const h = this.o.topY - this.o.bottomY;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (this.o.width / 1.8), uv.getY(i) * (h / 1.8));
    }
    uv.needsUpdate = true;

    this.pos = geo.attributes.position.array as Float32Array;
    this.nrm = geo.attributes.normal.array as Float32Array;

    // Per-panel irregularity: no two lengths of cloth hang the same.
    const n = (this.gx + 1) * (this.gy + 1);
    this.foldNoise = new Float32Array(n);
    for (let j = 0; j <= this.gy; j++) {
      for (let i = 0; i <= this.gx; i++) {
        const u = i / this.gx;
        const v = j / this.gy;
        this.foldNoise[j * (this.gx + 1) + i] =
          fbm2(u * 4.5 + this.o.seed * 13.7, v * 2.2 + this.o.seed * 5.1, 3) - 0.5;
      }
    }

    this.mesh = new Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // A thin extruded strip along the free edge. This is the only place the
    // player can see how thick the cloth is, and it is right next to the gap.
    const edgeGeo = new BufferGeometry();
    this.edgePos = new Float32Array((this.gy + 1) * 2 * 3);
    this.edgeNrm = new Float32Array((this.gy + 1) * 2 * 3);
    const idx: number[] = [];
    for (let j = 0; j < this.gy; j++) {
      const a = j * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const edgeUv = new Float32Array((this.gy + 1) * 2 * 2);
    for (let j = 0; j <= this.gy; j++) {
      const v = 1 - j / this.gy;
      edgeUv[j * 4] = 0;
      edgeUv[j * 4 + 1] = v;
      edgeUv[j * 4 + 2] = 1;
      edgeUv[j * 4 + 3] = v;
    }
    edgeGeo.setAttribute('position', new BufferAttribute(this.edgePos, 3));
    edgeGeo.setAttribute('normal', new BufferAttribute(this.edgeNrm, 3));
    edgeGeo.setAttribute('uv', new BufferAttribute(edgeUv, 2));
    edgeGeo.setIndex(idx);
    this.edge = new Mesh(edgeGeo, edgeMaterial);
    this.edge.frustumCulled = false;
    this.group.add(this.edge);

    this.update(0, 0);
  }

  /** X of the free edge right now. */
  get freeEdgeX(): number {
    return this.o.anchorX + this.o.dir * (this.o.width - this.gather);
  }

  private evaluate(u: number, v: number, time: number, out: [number, number, number]): void {
    const o = this.o;
    const span = Math.max(0.12, o.width - this.gather);
    const compress = clamp01(1 - span / o.width);

    const x = o.anchorX + o.dir * u * span;
    const height = o.topY - o.bottomY;

    // Pleats: fixed count for this cloth, deepening as the span shrinks
    // because the fabric has nowhere else to go.
    const pleats = Math.max(2, Math.round(o.width * o.pleatDensity));
    const restAmp = 0.035;
    // Gathered cloth bunches, but a real curtain cannot fold half a metre deep:
    // cap it, or a fully-flown house curtain swallows the sightline behind it.
    const amp = restAmp + Math.min(0.17, (compress * o.width * 0.58) / pleats);
    // Pinned by rings at the top, free at the hem.
    const ampV = 0.22 + 0.78 * smoothstep(0, 0.42, v);
    const phase = u * pleats * Math.PI * 2 + o.seed * 2.3;
    let z = Math.sin(phase) * amp * ampV;

    // Irregular hand-hung folds.
    const noise = this.foldNoise[
      Math.min(this.foldNoise.length - 1, Math.round(v * this.gy) * (this.gx + 1) + Math.round(u * this.gx))
    ];
    z += noise * (0.045 + compress * 0.1) * ampV;

    // Pendulum swing plus a slow idle breath from the hall's air handling.
    const swing = this.sway * Math.sin(v * 1.9) + Math.sin(time * 0.55 + o.seed) * 0.012 * v;
    z += swing;

    // A finger resting on the cloth pushes it away locally.
    if (this.bulge !== 0) {
      const dv = (v - this.bulgeV) / 0.26;
      z += this.bulge * Math.exp(-dv * dv) * Math.sin(Math.PI * clamp01(u));
    }

    // Gathered cloth rides up: the hem lifts and scallops.
    const hemLift = compress * 0.16 * smoothstep(0.55, 1, v);
    const scallop = Math.cos(phase) * 0.028 * smoothstep(0.82, 1, v);
    const y = o.topY - v * height + hemLift + scallop;

    out[0] = x;
    out[1] = y;
    out[2] = o.z + z;
  }

  update(time: number, dt: number): void {
    // Swing: pulling the cloth sideways throws the hem, then it settles.
    if (dt > 0) {
      const pullSpeed = (this.gather - this.lastGather) / dt;
      this.swayVel += clamp(pullSpeed, -6, 6) * 0.055;
      this.swayVel -= this.sway * 34 * dt;
      this.swayVel *= Math.pow(0.02, dt);
      this.sway += this.swayVel * dt;
      this.sway = clamp(this.sway, -0.24, 0.24);
    }
    this.lastGather = this.gather;

    const gx = this.gx;
    const gy = this.gy;
    const tmp: [number, number, number] = [0, 0, 0];
    const pos = this.pos;

    for (let j = 0; j <= gy; j++) {
      const v = j / gy;
      for (let i = 0; i <= gx; i++) {
        const u = i / gx;
        this.evaluate(u, v, time, tmp);
        const k = (j * (gx + 1) + i) * 3;
        pos[k] = tmp[0];
        pos[k + 1] = tmp[1];
        pos[k + 2] = tmp[2];
      }
    }

    // Grid normals: exact for a regular lattice and cheaper than a rebuild.
    const nrm = this.nrm;
    for (let j = 0; j <= gy; j++) {
      for (let i = 0; i <= gx; i++) {
        const k = (j * (gx + 1) + i) * 3;
        const iu = i < gx ? k + 3 : k - 3;
        const iv = j < gy ? k + (gx + 1) * 3 : k - (gx + 1) * 3;
        const su = i < gx ? 1 : -1;
        const sv = j < gy ? 1 : -1;
        const ax = (pos[iu] - pos[k]) * su;
        const ay = (pos[iu + 1] - pos[k + 1]) * su;
        const az = (pos[iu + 2] - pos[k + 2]) * su;
        const bx = (pos[iv] - pos[k]) * sv;
        const by = (pos[iv + 1] - pos[k + 1]) * sv;
        const bz = (pos[iv + 2] - pos[k + 2]) * sv;
        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        // ...and shade against that same side.
        const s = -this.o.dir;
        nrm[k] = nx * s;
        nrm[k + 1] = ny * s;
        nrm[k + 2] = nz * s;
      }
    }

    const geo = this.mesh.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;

    // Free-edge thickness strip.
    const thickness = 0.026;
    for (let j = 0; j <= gy; j++) {
      const k = (j * (gx + 1) + gx) * 3;
      const e = j * 6;
      this.edgePos[e] = pos[k];
      this.edgePos[e + 1] = pos[k + 1];
      this.edgePos[e + 2] = pos[k + 2] - thickness;
      this.edgePos[e + 3] = pos[k];
      this.edgePos[e + 4] = pos[k + 1];
      this.edgePos[e + 5] = pos[k + 2] + thickness;
      for (let c = 0; c < 2; c++) {
        this.edgeNrm[e + c * 3] = this.o.dir;
        this.edgeNrm[e + c * 3 + 1] = 0;
        this.edgeNrm[e + c * 3 + 2] = 0;
      }
    }
    this.edge.geometry.attributes.position.needsUpdate = true;
    this.edge.geometry.attributes.normal.needsUpdate = true;
  }

  /** World-space position of a point on the cloth, for hanging rings on it. */
  sampleTop(u: number, out: [number, number, number]): void {
    this.evaluate(u, 0, 0, out);
  }
}

/**
 * 袖幕 - the pair of legs the child parts to peek. This is the object the whole
 * game is built around, so it gets the rod, the rings, the thickness and a
 * light leak at the seam.
 */
export class LegCurtain {
  readonly group = new Group();
  readonly left: CurtainPanel;
  readonly right: CurtainPanel;
  /** Total opening between the two free edges, in metres. */
  readonly gapSpring = new Spring(0.028, 9.5, 0.72);
  /**
   * Separate from the peek. When the child actually goes out, the far panel
   * runs right off on its track while the near one only opens enough to let
   * them through - so a wall of velvet sweeps the foreground as the camera
   * follows, instead of both legs politely splitting down the middle.
   */
  readonly exitSpring = new Spring(0, 2.4, 0.95);
  /**
   * A second, later stage: once the child is out and the camera is looking at
   * the house, the near leg runs all the way off its track. That clears the
   * lens for the pull-back without anyone ever seeing it happen.
   */
  readonly flySpring = new Spring(0, 1.7, 0.95);
  private rings: Object3D[] = [];
  private seamGlow: Mesh;
  private prevGap = 0.028;
  gapVelocity = 0;

  constructor(mats: Materials) {
    const L = LAYOUT.legCurtain;
    const height = L.topY - L.bottomY;

    this.left = new CurtainPanel(
      {
        anchorX: L.xMin,
        dir: 1,
        width: L.seamX - L.xMin,
        z: L.z,
        topY: L.topY,
        bottomY: L.bottomY,
        seed: 1.7,
      },
      mats.curtain,
      mats.curtainHem,
    );
    this.right = new CurtainPanel(
      {
        anchorX: L.xMax,
        dir: -1,
        width: L.xMax - L.seamX,
        z: L.z,
        topY: L.topY,
        bottomY: L.bottomY,
        seed: 4.3,
      },
      mats.curtain,
      mats.curtainHem,
    );
    this.group.add(this.left.group, this.right.group);

    // Track and rod.
    const rod = new Mesh(
      new CylinderGeometry(0.026, 0.026, L.xMax - L.xMin + 0.5, 10),
      mats.metal,
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set((L.xMin + L.xMax) / 2, L.topY + 0.075, L.z);
    this.group.add(rod);

    const ringGeo = new TorusGeometry(0.042, 0.008, 5, 12);
    for (let p = 0; p < 2; p++) {
      for (let i = 0; i < 9; i++) {
        const ring = new Mesh(ringGeo, mats.metal);
        ring.rotation.y = Math.PI / 2;
        this.rings.push(ring);
        this.group.add(ring);
      }
    }

    // The light that leaks through the seam is the only invitation the player
    // gets. It has to be visible in a dark wing without blowing out.
    const glowMat = new MeshBasicMaterial({
      map: mats.glowTexture,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0.5,
      toneMapped: false,
      color: 0xffc98a,
    });
    this.seamGlow = new Mesh(new PlaneGeometry(0.42, height * 1.02), glowMat);
    this.seamGlow.position.set(L.seamX, (L.topY + L.bottomY) / 2 - 0.35, L.z + 0.34);
    this.seamGlow.renderOrder = 3;
    this.group.add(this.seamGlow);
  }

  get gap(): number {
    return this.gapSpring.value;
  }

  setTargetGap(metres: number): void {
    this.gapSpring.target = Math.max(0.02, metres);
  }

  /** 0 = as the peek left it, 1 = open for the child to walk through. */
  setExit(t: number): void {
    this.exitSpring.target = clamp01(t);
  }

  /** 0 = legs in place, 1 = fully run off. Only used behind the camera. */
  setFly(t: number): void {
    this.flySpring.target = clamp01(t);
  }

  /** Puts the finger's influence on the cloth without needing to hit it exactly. */
  setBulge(amount: number, v: number): void {
    this.left.bulge = amount;
    this.left.bulgeV = v;
    this.right.bulge = amount;
    this.right.bulgeV = v;
  }

  update(time: number, dt: number): void {
    const gap = this.gapSpring.step(dt);
    this.gapVelocity = dt > 0 ? (gap - this.prevGap) / dt : 0;
    this.prevGap = gap;

    const exit = this.exitSpring.step(dt);
    const fly = this.flySpring.step(dt);
    const half = Math.max(0, gap - 0.02) / 2;
    const leftWidth = LAYOUT.legCurtain.seamX - LAYOUT.legCurtain.xMin;
    // Just wide enough for a four-year-old and the lens behind them. Any more
    // and the room is simply there before they have gone anywhere.
    const leftWalk = half + exit * 0.62;
    this.left.gather = leftWalk + fly * Math.max(0, leftWidth - 0.45 - leftWalk);
    this.right.gather = half + exit * 0.66;
    this.left.update(time, dt);
    this.right.update(time, dt);

    const tmp: [number, number, number] = [0, 0, 0];
    for (let p = 0; p < 2; p++) {
      const panel = p === 0 ? this.left : this.right;
      for (let i = 0; i < 9; i++) {
        const ring = this.rings[p * 9 + i];
        panel.sampleTop(i / 8, tmp);
        ring.position.set(tmp[0], LAYOUT.legCurtain.topY + 0.055, tmp[2]);
      }
    }

    // The leak is a stand-in for light the closed cloth cannot actually pass.
    // Once there is a real gap it has to get out of the way, or it becomes a
    // flat card sitting exactly where the stage should be.
    const g = clamp01((gap - 0.03) / 0.16);
    const mat = this.seamGlow.material as MeshBasicMaterial;
    // A light behind a curtain is never steady: somebody else's number is
    // still running out there.
    const flicker = 0.86 + Math.sin(time * 1.7) * 0.1 + Math.sin(time * 5.3 + 1.2) * 0.04;
    mat.opacity = (0.5 * (1 - g) + 0.04) * flicker;
    this.seamGlow.visible = mat.opacity > 0.04;
    this.seamGlow.scale.x = 0.85 + g * 0.5;
    this.seamGlow.position.x = (this.left.freeEdgeX + this.right.freeEdgeX) / 2;
  }

  setShadows(on: boolean): void {
    this.left.mesh.castShadow = on;
    this.right.mesh.castShadow = on;
  }
}

/** 緞帳 - the big house curtain, seen only through the gap and then opening. */
export class GrandCurtain {
  readonly group = new Group();
  readonly left: CurtainPanel;
  readonly right: CurtainPanel;
  readonly openSpring = new Spring(0, 2.2, 0.9);

  constructor(mats: Materials) {
    const G = LAYOUT.grandCurtain;
    this.left = new CurtainPanel(
      {
        anchorX: -G.halfWidth,
        dir: 1,
        width: G.halfWidth,
        z: G.z,
        topY: G.topY,
        bottomY: G.bottomY,
        seed: 2.9,
        wseg: 26,
        hseg: 14,
        pleatDensity: 1.5,
      },
      mats.grandCurtain,
      mats.curtainHem,
    );
    this.right = new CurtainPanel(
      {
        anchorX: G.halfWidth,
        dir: -1,
        width: G.halfWidth,
        z: G.z,
        topY: G.topY,
        bottomY: G.bottomY,
        seed: 8.1,
        wseg: 26,
        hseg: 14,
        pleatDensity: 1.5,
      },
      mats.grandCurtain,
      mats.curtainHem,
    );
    this.group.add(this.left.group, this.right.group);

    // Pelmet above, so the top of the opening is not a raw edge.
    const pelmet = new Mesh(new PlaneGeometry(G.halfWidth * 2, 0.75, 16, 3), mats.grandCurtain);
    pelmet.position.set(0, G.topY + 0.3, G.z - 0.04);
    this.group.add(pelmet);
  }

  /** 0 = closed, 1 = fully drawn off. */
  setOpen(t: number): void {
    this.openSpring.target = clamp01(t);
  }

  update(time: number, dt: number): void {
    const t = this.openSpring.step(dt);
    const travel = LAYOUT.grandCurtain.halfWidth * 0.955;
    this.left.gather = t * travel;
    this.right.gather = t * travel;
    this.left.update(time, dt);
    this.right.update(time, dt);
  }
}
