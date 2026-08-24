import * as THREE from 'three';
import { clamp01, lerp, smoothstep } from '../util/math';
import { LAYOUT } from './layout';
import type { Materials } from './Materials';
import { armProfile } from './Manikin';

const X0 = LAYOUT.cuffCenterX - LAYOUT.cuffWidth / 2;
const X1 = LAYOUT.cuffCenterX + LAYOUT.cuffWidth / 2;
const SEGS_W = 20;
const SEGS_A = 52;
/** Aperture through the cuff so the training module stays visible mid-cuff. */
const SLOT_HALF_ANGLE = 0.8;
const SLOT_W0 = 0.24;
const SLOT_W1 = 0.76;

const armRadiusAtCuff = (w: number): number => {
  const x = lerp(X0, X1, w);
  return armProfile((x - 0.02) / 1.0);
};

interface BandBuffers {
  geometry: THREE.BufferGeometry;
  ws: Float32Array;
  as: Float32Array;
  /** +1 outer surface, -1 inner surface. */
  side: Float32Array;
}

/**
 * A wrapped band around the arm: outer woven shell and inner bladder face,
 * joined at the edges so the cuff reads as cloth with thickness rather than a
 * rigid plastic sleeve.
 */
const buildBand = (skipSlot: boolean): BandBuffers => {
  const rows = 2; // outer, inner
  const vCount = rows * (SEGS_W + 1) * (SEGS_A + 1);
  const pos = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const ws = new Float32Array(vCount);
  const as = new Float32Array(vCount);
  const side = new Float32Array(vCount);
  const at = (row: number, i: number, j: number) =>
    row * (SEGS_W + 1) * (SEGS_A + 1) + i * (SEGS_A + 1) + j;

  for (let row = 0; row < rows; row++) {
    for (let i = 0; i <= SEGS_W; i++) {
      const w = i / SEGS_W;
      for (let j = 0; j <= SEGS_A; j++) {
        const a = (j / SEGS_A) * Math.PI * 2 - Math.PI;
        const idx = at(row, i, j);
        ws[idx] = w;
        as[idx] = a;
        side[idx] = row === 0 ? 1 : -1;
        uv[idx * 2] = (j / SEGS_A) * 2.6;
        uv[idx * 2 + 1] = w;
      }
    }
  }

  const indices: number[] = [];
  const inSlot = (w: number, a: number) =>
    skipSlot && w > SLOT_W0 && w < SLOT_W1 && Math.abs(a) < SLOT_HALF_ANGLE;

  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < SEGS_W; i++) {
      for (let j = 0; j < SEGS_A; j++) {
        const w = (i + 0.5) / SEGS_W;
        const a = ((j + 0.5) / SEGS_A) * Math.PI * 2 - Math.PI;
        if (inSlot(w, a)) continue;
        const a0 = at(row, i, j);
        const b0 = at(row, i, j + 1);
        const c0 = at(row, i + 1, j);
        const d0 = at(row, i + 1, j + 1);
        if (row === 0) indices.push(a0, b0, c0, b0, d0, c0);
        else indices.push(a0, c0, b0, b0, c0, d0);
      }
    }
  }
  // Edge welt joining outer and inner along both rims.
  for (const i of [0, SEGS_W]) {
    for (let j = 0; j < SEGS_A; j++) {
      const o0 = at(0, i, j);
      const o1 = at(0, i, j + 1);
      const n0 = at(1, i, j);
      const n1 = at(1, i, j + 1);
      if (i === 0) indices.push(o0, n0, o1, o1, n0, n1);
      else indices.push(o0, o1, n0, o1, n1, n0);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(indices);
  return { geometry: g, ws, as, side };
};

/**
 * The blood-pressure cuff. Woven shell, inner bladder, overlap, hook-and-loop
 * closure and a metal D-ring — the parts a child can see being pulled tight.
 */
export class CuffRig {
  readonly group = new THREE.Group();

  private shell!: THREE.Mesh;
  private shellBuf!: BandBuffers;
  private bladder!: THREE.Mesh;
  private bladderBuf!: BandBuffers;
  private overlap!: THREE.Mesh;
  private overlapBase!: Float32Array;
  private overlapWs!: Float32Array;
  private overlapAs!: Float32Array;
  private slotFlap!: THREE.Group;
  private slotPane!: THREE.Mesh;
  private dRing!: THREE.Mesh;
  private tension = 0;
  private appliedTension = -1;

  constructor(private mats: Materials) {
    this.buildShell();
    this.buildOverlap();
    this.buildSlot();
    this.buildHardware();
    this.apply(0);
  }

  private buildShell(): void {
    this.shellBuf = buildBand(true);
    this.shell = new THREE.Mesh(this.shellBuf.geometry, this.mats.fabric);
    this.shell.castShadow = true;
    this.shell.receiveShadow = true;
    this.group.add(this.shell);

    this.bladderBuf = buildBand(true);
    this.bladder = new THREE.Mesh(this.bladderBuf.geometry, this.mats.bladder);
    this.group.add(this.bladder);
  }

  /** The tail of the cuff wrapping past itself, with the hook patch on it. */
  private buildOverlap(): void {
    const nu = 12;
    const nv = 26;
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
    const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
    this.overlapWs = new Float32Array((nu + 1) * (nv + 1));
    this.overlapAs = new Float32Array((nu + 1) * (nv + 1));
    const idxs: number[] = [];
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) {
        const idx = i * (nv + 1) + j;
        this.overlapWs[idx] = 0.04 + (i / nu) * 0.92;
        this.overlapAs[idx] = Math.PI * 0.42 + (j / nv) * Math.PI * 1.02;
        uv[idx * 2] = (j / nv) * 1.4;
        uv[idx * 2 + 1] = i / nu;
      }
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a0 = i * (nv + 1) + j;
        const b0 = a0 + 1;
        const c0 = a0 + nv + 1;
        const d0 = c0 + 1;
        idxs.push(a0, b0, c0, b0, d0, c0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idxs);
    this.overlapBase = pos;
    this.overlap = new THREE.Mesh(g, this.mats.fabric);
    this.overlap.castShadow = true;
    this.group.add(this.overlap);

    // Hook patch, sitting proud of the shell where the tail lands.
    const patch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.066, 0.066, 0.052, 26, 1, true, Math.PI * 1.06, Math.PI * 0.5),
      this.mats.hookLoop,
    );
    patch.rotation.z = Math.PI / 2;
    patch.position.set(LAYOUT.cuffCenterX + 0.012, LAYOUT.armY, LAYOUT.armZ);
    this.group.add(patch);
  }

  /** Teaching aperture: an acrylic slot with a fabric cover that lifts. */
  private buildSlot(): void {
    const cx = lerp(X0, X1, (SLOT_W0 + SLOT_W1) / 2);
    const r = armRadiusAtCuff(0.5);

    this.slotPane = new THREE.Mesh(
      new THREE.CylinderGeometry(
        r + 0.007,
        r + 0.007,
        (SLOT_W1 - SLOT_W0) * LAYOUT.cuffWidth,
        20,
        1,
        true,
        -SLOT_HALF_ANGLE + Math.PI / 2,
        SLOT_HALF_ANGLE * 2,
      ),
      this.mats.acrylic,
    );
    this.slotPane.rotation.z = Math.PI / 2;
    this.slotPane.position.set(cx, LAYOUT.armY, LAYOUT.armZ);
    this.group.add(this.slotPane);

    // Hinged cover: hinge line sits at the far edge of the slot.
    this.slotFlap = new THREE.Group();
    const cover = new THREE.Mesh(
      new THREE.CylinderGeometry(
        r + 0.0095,
        r + 0.0095,
        (SLOT_W1 - SLOT_W0) * LAYOUT.cuffWidth + 0.006,
        20,
        1,
        true,
        -SLOT_HALF_ANGLE - 0.06 + Math.PI / 2,
        (SLOT_HALF_ANGLE + 0.06) * 2,
      ),
      this.mats.fabric,
    );
    cover.rotation.z = Math.PI / 2;
    this.slotFlap.add(cover);
    this.slotFlap.position.set(cx, LAYOUT.armY, LAYOUT.armZ);
    this.group.add(this.slotFlap);
  }

  private buildHardware(): void {
    this.dRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.019, 0.0032, 8, 20),
      this.mats.steelSatin,
    );
    this.dRing.rotation.x = Math.PI / 2;
    this.dRing.position.set(X0 + 0.012, LAYOUT.armY - 0.058, LAYOUT.armZ - 0.052);
    this.group.add(this.dRing);

    // Two ports leaving the bladder: one to the gauge, one to the bulb.
    for (const dz of [-0.016, 0.016]) {
      const port = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0052, 0.006, 0.014, 10),
        this.mats.steelSatin,
      );
      port.position.set(
        LAYOUT.cuffCenterX + dz * 1.5,
        LAYOUT.armY - 0.055,
        LAYOUT.armZ + 0.044,
      );
      port.rotation.x = 1.15;
      this.group.add(port);
    }
  }

  /** Radius of the shell's outer face at a point on the band. */
  private outerRadius(w: number, tension: number): number {
    const arm = armRadiusAtCuff(w);
    // The shell pulls in against the limb as it is tightened,
    const grip = tension * 0.0072;
    // while the bladder swells outward, strongest across the middle.
    const bulge = tension * 0.0155 * Math.sin(Math.PI * clamp01(w)) ** 0.7;
    return arm + 0.0055 - grip + bulge;
  }

  apply(tension: number): void {
    this.tension = tension;
    if (Math.abs(this.appliedTension - tension) < 2e-4) return;
    this.appliedTension = tension;
    this.writeBand(this.shellBuf, tension, 0);
    this.writeBand(this.bladderBuf, tension, -0.0042);
    this.writeOverlap(tension);

    // Hardware follows the band so nothing detaches as the cuff tightens.
    const r = this.outerRadius(0.15, tension);
    this.dRing.position.y = LAYOUT.armY - r * 0.92;
    this.dRing.position.z = LAYOUT.armZ - r * 0.62;
  }

  private writeBand(buf: BandBuffers, tension: number, inset: number): void {
    const attr = buf.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < buf.ws.length; i++) {
      const w = buf.ws[i];
      const a = buf.as[i];
      const thickness = buf.side[i] > 0 ? 0 : -0.0042;
      const r = this.outerRadius(w, tension) + thickness + inset;
      arr[i * 3] = lerp(X0, X1, w);
      arr[i * 3 + 1] = LAYOUT.armY + Math.cos(a) * r;
      arr[i * 3 + 2] = LAYOUT.armZ + Math.sin(a) * r * 0.94;
    }
    attr.needsUpdate = true;
    buf.geometry.computeVertexNormals();
    buf.geometry.computeBoundingSphere();
  }

  private writeOverlap(tension: number): void {
    const arr = this.overlapBase;
    for (let i = 0; i < this.overlapWs.length; i++) {
      const w = this.overlapWs[i];
      const a = this.overlapAs[i];
      // The tail lifts very slightly off the shell where it is not yet pressed.
      const lift = 0.004 * (1 - tension) * smoothstep(Math.PI * 1.1, Math.PI * 1.44, a);
      const r = this.outerRadius(w, tension) + 0.0035 + lift;
      arr[i * 3] = lerp(X0, X1, w);
      arr[i * 3 + 1] = LAYOUT.armY + Math.cos(a) * r;
      arr[i * 3 + 2] = LAYOUT.armZ + Math.sin(a) * r * 0.94;
    }
    (this.overlap.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.overlap.geometry.computeVertexNormals();
    this.overlap.geometry.computeBoundingSphere();
  }

  /** Reveal: the instructor lifts the teaching cover off the slot. */
  setSlotOpen(open: number): void {
    this.slotFlap.rotation.x = -open * 1.15;
    this.slotFlap.position.z = LAYOUT.armZ + open * 0.012;
    (this.slotPane.material as THREE.Material).visible = true;
  }

  get currentTension(): number {
    return this.tension;
  }
}
