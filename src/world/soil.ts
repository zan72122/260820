import * as THREE from 'three';
import { Rng, TAU, clamp01, lerp, smoothstep } from '../core/math';
import type { QualitySettings } from '../core/quality';
import { applyMacroVariation } from '../core/macro';
import {
  SOIL_PALETTES,
  applyMaps,
  cached,
  radialAlpha,
  soilMaps,
  type SoilKind,
} from '../core/textures';
import type { RootSpec } from './root';

/**
 * The worked ground at one plant: a local patch of soil laid out as radial
 * plates, the cracks between them, the crater underneath, and the loose grains
 * that rain off during the lift.
 *
 * Two things are deliberate here. First, the cracks are placed on the root
 * azimuths, so when the ground splits it is splitting where a root is pushing.
 * Second, the crater is sculpted from the same root layout, which is what makes
 * the hole and the lifted cluster read as the same object.
 */

const PLATE_THICKNESS = 0.072;

/**
 * The field mesh is cut open with a circle of this radius at every plot, and
 * the crater's flat collar reaches slightly further so the cut edge is always
 * covered. Both numbers are fixed so the field can be built before any plot.
 */
export const GROUND_HOLE_RADIUS = 0.72;
const CRATER_OUTER = 0.80;
/**
 * Soil texture tiles per metre. The field, the patch plates and the crater
 * collar all use this exact figure, so the cut edge where they meet is
 * invisible.
 */
export const SOIL_UV_SCALE = 2.0;
/** Rows of the crater that form the bowl; the rest is the flat collar. */
const BOWL_ROWS = 11;
const COLLAR_ROWS = 3;
/**
 * Neighbouring plates share their top edge exactly, but their fracture faces
 * are undercut by this angle so no two faces are ever coincident. Coincident
 * faces z-fight, and the speckled radial lines that produces would hand the
 * player the root layout before they had touched anything.
 */
const SEAM = 0.010;
/** Hard ceiling on patch radius, guaranteeing it stays inside the cut. */
const MAX_PATCH_RADIUS = 0.66;

interface Plate {
  mesh: THREE.Mesh;
  /** Mid azimuth of the plate. */
  azimuth: number;
  /** Hinge axis at the outer rim. */
  hinge: THREE.Vector3;
  hingePoint: THREE.Vector3;
  /** 0..1 how far this plate has swung open. */
  open: number;
  target: number;
  /** Plates released in the first lever pull. */
  stage: number;
  /** The one sitting over the thickest root. */
  hero: boolean;
  rest: THREE.Matrix4;
}

export interface SoilPatchParams {
  seed: number;
  /** Soil at this plant. */
  soil: SoilKind;
  /** Soil of the surrounding field, which the patch has to blend back into. */
  fieldSoil: SoilKind;
  layout: RootSpec[];
  /** Azimuth of the thickest root; its crack opens first and widest. */
  heroAzimuth: number;
  /** How much the ground is domed above the cluster before anything happens. */
  mound: number;
}

/**
 * Low-frequency tint written into vertex colours. Two overlapping scales of
 * noise, so the ground varies over metres the way worked earth does, without
 * another texture lookup.
 */
/** Recompute normals for one index range only, leaving the rest untouched. */
function fixWallNormals(geom: THREE.BufferGeometry, start: number, count: number): void {
  const index = geom.getIndex()!;
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const nrm = geom.getAttribute('normal') as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const touched = new Set<number>();
  for (let i = start; i < start + count; i += 3) {
    const ia = index.getX(i);
    const ib = index.getX(i + 1);
    const ic = index.getX(i + 2);
    for (const v of [ia, ib, ic]) {
      if (!touched.has(v)) {
        touched.add(v);
        nrm.setXYZ(v, 0, 0, 0);
      }
    }
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    cb.subVectors(c, b);
    ab.subVectors(a, b);
    cb.cross(ab);
    for (const v of [ia, ib, ic]) {
      nrm.setXYZ(v, nrm.getX(v) + cb.x, nrm.getY(v) + cb.y, nrm.getZ(v) + cb.z);
    }
  }
  const tmp = new THREE.Vector3();
  for (const v of touched) {
    tmp.fromBufferAttribute(nrm, v);
    if (tmp.lengthSq() < 1e-12) tmp.set(0, 1, 0);
    tmp.normalize();
    nrm.setXYZ(v, tmp.x, tmp.y, tmp.z);
  }
  nrm.needsUpdate = true;
}

/** Colour shift from the field's soil toward this plant's soil. */
function soilTint(soil: SoilKind, fieldSoil: SoilKind): THREE.Color {
  const a = SOIL_PALETTES[soil].dry;
  const b = SOIL_PALETTES[fieldSoil].dry;
  return new THREE.Color(a[0] / b[0], a[1] / b[1], a[2] / b[2]);
}

/**
 * Write the tint into vertex colours, weighted by a falloff in patch radius,
 * so a different soil type arrives as a gradual change in the ground rather
 * than as a circle drawn on it.
 */
function paintSoilTint(
  geom: THREE.BufferGeometry,
  tint: THREE.Color,
  weightAt: (radius: number) => number,
): void {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    const w = clamp01(weightAt(r));
    colors[i * 3] = lerp(1, tint.r, w);
    colors[i * 3 + 1] = lerp(1, tint.g, w);
    colors[i * 3 + 2] = lerp(1, tint.b, w);
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** Radial extent of the buried cluster in a given direction. */
function reachAt(layout: RootSpec[], theta: number): { reach: number; depth: number } {
  let wSum = 0;
  let reach = 0;
  let depth = 0;
  for (const spec of layout) {
    let d = Math.abs(((spec.azimuth - theta + Math.PI * 3) % TAU) - Math.PI);
    d = Math.max(0.0001, d);
    const w = 1 / Math.pow(d, 2.4);
    wSum += w;
    reach += spec.reach * w;
    depth += spec.depth * w;
  }
  return { reach: reach / wSum, depth: depth / wSum };
}

export class SoilPatch {
  readonly group = new THREE.Group();
  readonly radius: number;
  readonly crater: THREE.Mesh;
  /** Exposed so the one short section cutaway can clip only the soil. */
  readonly soilMaterials: THREE.Material[] = [];
  private plates: Plate[] = [];
  private crackMeshes: THREE.Mesh[] = [];
  private crackMat: THREE.MeshStandardMaterial;
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  private stageReached = 0;
  private heroPlateIndex = 0;
  private heroAzimuth = 0;

  constructor(params: SoilPatchParams, q: QualitySettings) {
    const rng = new Rng(params.seed ^ 0x5bf0);
    const layout = params.layout;
    const maxReach = layout.reduce((m, s) => Math.max(m, s.reach), 0.2);
    this.radius = Math.min(MAX_PATCH_RADIUS, maxReach * 1.18 + 0.06);

    // The patch always uses the FIELD's textures, and carries any difference
    // in soil type as a tint that fades out across the crater collar. Swapping
    // the whole palette here instead would stamp a hard-edged pale disc of
    // sand into red ground, which is what a patch of sandy soil never looks
    // like.
    const dry = cached(`soil${q.textureSize}${params.fieldSoil}`, () =>
      soilMaps(q.textureSize, params.fieldSoil),
    );
    const moist = cached(`soilMoist${q.textureSize}${params.fieldSoil}`, () =>
      soilMaps(Math.max(256, q.textureSize / 2), params.fieldSoil),
    );
    const tint = soilTint(params.soil, params.fieldSoil);

    const topMat = new THREE.MeshStandardMaterial({
      roughness: params.soil === 'sandy' ? 0.94 : 0.97,
      metalness: 0,
      vertexColors: true,
    });
    applyMaps(topMat, dry, new THREE.Vector2(1, 1), q.anisotropy);

    // Interior of a broken clod: darker and damper than the dusty surface.
    const innerMat = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, vertexColors: true });
    applyMaps(innerMat, moist, new THREE.Vector2(1.8, 1.8), q.anisotropy);
    innerMat.color.setRGB(0.62, 0.56, 0.52);

    // The seam gets its own material so it can start as ordinary dry ground
    // and darken into damp broken soil only once the split begins. A dark
    // radial line visible from the first frame would hand the player the root
    // layout before they had touched anything.
    this.crackMat = innerMat.clone();
    this.crackMat.vertexColors = false;
    this.crackMat.color.copy(innerMat.color).multiply(tint).multiplyScalar(0.92);

    applyMacroVariation(topMat, 1);
    applyMacroVariation(innerMat, 0.5);
    applyMacroVariation(this.crackMat, 0.5);

    this.disposables.push(topMat, innerMat, this.crackMat);
    this.soilMaterials.push(topMat, innerMat, this.crackMat);

    // One crack per root, so each split sits over something.
    const crackAzimuths = layout.map((s) => s.azimuth).sort((a, b) => a - b);
    const n = crackAzimuths.length;

    // Which cracks open on the first, tentative lever pull. Three of them,
    // spread apart, is what the player is meant to read first.
    // The crack over the thickest root always opens, plus two spread away
    // from it, so the first pull produces three splits and one of them is
    // guaranteed to have a root shoulder under it.
    let heroIndex = 0;
    let heroScore = -Infinity;
    for (let i = 0; i < n; i++) {
      const score = Math.cos(crackAzimuths[i]! - params.heroAzimuth);
      if (score > heroScore) {
        heroScore = score;
        heroIndex = i;
      }
    }
    this.heroPlateIndex = heroIndex;
    const firstWave = new Set<number>();
    if (n >= 3) {
      firstWave.add(heroIndex);
      firstWave.add((heroIndex + Math.floor(n / 3)) % n);
      firstWave.add((heroIndex + Math.floor((2 * n) / 3)) % n);
    } else {
      for (let i = 0; i < n; i++) firstWave.add(i);
    }

    for (let i = 0; i < n; i++) {
      const a0 = crackAzimuths[i]!;
      const a1 = (crackAzimuths[(i + 1) % n] ?? a0 + TAU) + (i === n - 1 ? TAU : 0);
      const span = a1 - a0;
      if (span < 0.02) continue;
      const geom = this.buildPlateGeometry(a0, a1, params.mound);
      // Full local tint under the plant, easing off toward the patch rim.
      paintSoilTint(geom, tint, (r) => 1 - 0.42 * clamp01(r / this.radius));
      this.disposables.push(geom);
      const mesh = new THREE.Mesh(geom, [topMat, innerMat]);
      // A plate lying flush casts nothing; shadows switch on as it tips.
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      const mid = a0 + span / 2;
      const rim = new THREE.Vector3(Math.cos(mid) * this.radius, 0, Math.sin(mid) * this.radius);
      // Hinge along the rim tangent so the plate tips up at the inner edge.
      const hinge = new THREE.Vector3(-Math.sin(mid), 0, Math.cos(mid)).normalize();
      this.group.add(mesh);
      this.plates.push({
        mesh,
        azimuth: mid,
        hinge,
        hingePoint: rim,
        open: 0,
        target: 0,
        stage: firstWave.has(i) ? 1 : 2,
        hero: i === heroIndex,
        rest: mesh.matrix.clone(),
      });

      // Damp, dark seam sitting just under the surface at each crack.
      const crackGeom = this.buildCrackGeometry(a0, rng.range(0, TAU));
      this.disposables.push(crackGeom);
      // A shallow lip of damp soil just under the seam. It never shows while
      // the plates lie flush; as they tip it becomes the wall of the crack,
      // with the crater and whatever is in it visible past it.
      const crackMesh = new THREE.Mesh(crackGeom, this.crackMat);
      crackMesh.receiveShadow = true;
      this.group.add(crackMesh);
      this.crackMeshes.push(crackMesh);
    }

    // Crater: sculpted from the same layout the cluster was built from, with a
    // groove running out under each root.
    const craterGeom = this.buildCraterGeometry(layout, rng);
    // Carries the tint out to nothing where it laps over the field.
    paintSoilTint(craterGeom, tint, (r) => 1 - smoothstep((r - this.radius * 0.7) / (CRATER_OUTER - this.radius * 0.7)));
    this.disposables.push(craterGeom);
    this.crater = new THREE.Mesh(craterGeom, [topMat, innerMat]);
    this.crater.receiveShadow = true;
    this.group.add(this.crater);
  }

  private surfaceHeight(r: number, theta: number, mound: number): number {
    const t = clamp01(r / this.radius);
    // Ground is domed over a buried cluster, and the dome is not axially even.
    const lobe = 1 + Math.sin(theta * 3) * 0.12;
    return mound * (1 - t * t) * lobe;
  }

  /**
   * One plate of the split ground: a wedge of surface with real thickness.
   *
   * The top surface and the fracture faces use separate copies of their shared
   * corner vertices, and the top gets analytic normals from the dome rather
   * than averaged face normals. Without both, the near-vertical wall normals
   * bleed into the surface vertices and every plate boundary shows as a dark
   * crease — which would draw the root layout on the ground before the player
   * had done anything.
   */
  private buildPlateGeometry(a0: number, a1: number, mound: number): THREE.BufferGeometry {
    const A = 5;
    const R = 6;
    const innerR = 0.030;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const topIdx: number[] = [];
    const sideIdx: number[] = [];

    const wobbledRadius = (r: number, theta: number): number =>
      r + Math.sin(theta * 9.3 + r * 21) * 0.006;

    const surfaceY = (rr: number, theta: number): number =>
      this.surfaceHeight(rr, theta, mound) + Math.sin(rr * 37 + theta * 5) * 0.004;

    /** Analytic normal of the domed surface, identical either side of a seam. */
    const surfaceNormal = (rr: number, theta: number): [number, number, number] => {
      const h = 0.004;
      const x = Math.cos(theta) * rr;
      const z = Math.sin(theta) * rr;
      const dr = (surfaceY(rr + h, theta) - surfaceY(rr - h, theta)) / (2 * h);
      const dt = (surfaceY(rr, theta + h) - surfaceY(rr, theta - h)) / (2 * h);
      // gradient in world XZ from the radial/tangential derivatives
      const gx = dr * Math.cos(theta) - (dt / Math.max(rr, 1e-3)) * Math.sin(theta);
      const gz = dr * Math.sin(theta) + (dt / Math.max(rr, 1e-3)) * Math.cos(theta);
      const len = Math.hypot(-gx, 1, -gz);
      void x;
      void z;
      return [-gx / len, 1 / len, -gz / len];
    };

    const push = (
      rr: number,
      theta: number,
      y: number,
      n: [number, number, number],
    ): number => {
      const idx = positions.length / 3;
      positions.push(Math.cos(theta) * rr, y, Math.sin(theta) * rr);
      normals.push(n[0], n[1], n[2]);
      uvs.push(Math.cos(theta) * rr * SOIL_UV_SCALE, Math.sin(theta) * rr * SOIL_UV_SCALE);
      return idx;
    };

    // --- top surface: its own vertices, its own analytic normals ---
    const topGrid: number[][] = [];
    for (let i = 0; i <= A; i++) {
      const theta = lerp(a0, a1, i / A);
      const row: number[] = [];
      for (let j = 0; j <= R; j++) {
        const rr = wobbledRadius(lerp(innerR, this.radius, j / R), theta);
        row.push(push(rr, theta, surfaceY(rr, theta), surfaceNormal(rr, theta)));
      }
      topGrid.push(row);
    }
    for (let i = 0; i < A; i++) {
      for (let j = 0; j < R; j++) {
        const a = topGrid[i]![j]!;
        const b = topGrid[i + 1]![j]!;
        const c = topGrid[i]![j + 1]!;
        const d = topGrid[i + 1]![j + 1]!;
        topIdx.push(a, b, c, b, d, c);
      }
    }

    // --- walls and underside: duplicated corners, face normals of their own.
    // The underside is undercut so no fracture face is ever coincident with a
    // neighbour's.
    const wallTop: number[][] = [];
    const wallBot: number[][] = [];
    const flat: [number, number, number] = [0, 1, 0];
    for (let i = 0; i <= A; i++) {
      const theta = lerp(a0, a1, i / A);
      const thetaBottom = lerp(a0 + SEAM, a1 - SEAM, i / A);
      const rowT: number[] = [];
      const rowB: number[] = [];
      for (let j = 0; j <= R; j++) {
        const r = lerp(innerR, this.radius, j / R);
        const rrTop = wobbledRadius(r, theta);
        rowT.push(push(rrTop, theta, surfaceY(rrTop, theta), flat));
        rowB.push(push(wobbledRadius(r, thetaBottom) * 0.998, thetaBottom, -PLATE_THICKNESS, flat));
      }
      wallTop.push(rowT);
      wallBot.push(rowB);
    }
    for (let i = 0; i < A; i++) {
      for (let j = 0; j < R; j++) {
        const pa = wallBot[i]![j]!;
        const pb = wallBot[i + 1]![j]!;
        const pc = wallBot[i]![j + 1]!;
        const pd = wallBot[i + 1]![j + 1]!;
        sideIdx.push(pa, pc, pb, pb, pc, pd);
      }
      // outer rim
      sideIdx.push(wallTop[i]![R]!, wallBot[i]![R]!, wallTop[i + 1]![R]!);
      sideIdx.push(wallTop[i + 1]![R]!, wallBot[i]![R]!, wallBot[i + 1]![R]!);
      // inner rim
      sideIdx.push(wallTop[i + 1]![0]!, wallBot[i]![0]!, wallTop[i]![0]!);
      sideIdx.push(wallBot[i + 1]![0]!, wallBot[i]![0]!, wallTop[i + 1]![0]!);
    }
    for (let j = 0; j < R; j++) {
      sideIdx.push(wallTop[0]![j]!, wallBot[0]![j]!, wallTop[0]![j + 1]!);
      sideIdx.push(wallTop[0]![j + 1]!, wallBot[0]![j]!, wallBot[0]![j + 1]!);
      sideIdx.push(wallTop[A]![j + 1]!, wallBot[A]![j]!, wallTop[A]![j]!);
      sideIdx.push(wallBot[A]![j + 1]!, wallBot[A]![j]!, wallTop[A]![j + 1]!);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex([...topIdx, ...sideIdx]);
    geom.addGroup(0, topIdx.length, 0);
    geom.addGroup(topIdx.length, sideIdx.length, 1);
    // Only the walls need derived normals; recomputing would undo the
    // analytic surface normals that keep the seams invisible.
    fixWallNormals(geom, topIdx.length, sideIdx.length);
    geom.computeBoundingSphere();
    return geom;
  }

  /** Narrow dark ribbon revealed as a crack opens. */
  private buildCrackGeometry(theta: number, phase: number): THREE.BufferGeometry {
    const segs = 9;
    const positions: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const half = 0.022;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const r = lerp(0.028, this.radius * 0.94, t);
      // A fracture wanders; it never runs as a drawn radius.
      const wob = Math.sin(t * 7.1 + phase) * 0.03;
      const a = theta + wob * 0.35;
      // Narrow where it starts at the stem, wider as it runs outward.
      const w = half * (0.35 + t * 0.75) * (1 + Math.sin(t * 13) * 0.2);
      const nx = -Math.sin(a);
      const nz = Math.cos(a);
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      // Flat when closed; the mesh itself sinks as the crack opens.
      const y = 0;
      positions.push(cx - nx * w, y, cz - nz * w);
      positions.push(cx + nx * w, y, cz + nz * w);
      uvs.push(0, t * 1.6, 1, t * 1.6);
      if (i < segs) {
        const b = i * 2;
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    return geom;
  }

  /**
   * The hole. Its rim follows how far the roots run in each direction, and a
   * groove is pressed into the floor along each one, so the shape the player
   * sees left behind is the negative of the cluster they just pulled out.
   *
   * Past the rim it flattens into a collar carrying the same soil material and
   * the same texture scale as the field, which laps over the cut in the field
   * mesh so the join never shows.
   */
  private buildCraterGeometry(layout: RootSpec[], rng: Rng): THREE.BufferGeometry {
    const A = 60;
    const R = BOWL_ROWS + COLLAR_ROWS;
    const positions: number[] = [];
    const uvs: number[] = [];
    const bowlIdx: number[] = [];
    const collarIdx: number[] = [];

    for (let i = 0; i <= A; i++) {
      const theta = (i / A) * TAU;
      const { reach, depth } = reachAt(layout, theta);
      const rimR = Math.min(CRATER_OUTER * 0.84, reach * 1.10 + 0.07);
      for (let j = 0; j <= R; j++) {
        let r: number;
        let y: number;
        if (j <= BOWL_ROWS) {
          const s2 = j / BOWL_ROWS;
          r = rimR * s2;
          y = -depth * 1.02 * (1 - Math.pow(s2, 1.9));
          for (const spec of layout) {
            const d = Math.abs(((spec.azimuth - theta + Math.PI * 3) % TAU) - Math.PI);
            const along = clamp01(r / Math.max(0.05, spec.reach));
            y -= Math.exp(-Math.pow(d / 0.22, 2)) * spec.maxRadius * 1.5 * smoothstep(1 - along * 0.8);
          }
          y += (rng.next() - 0.5) * 0.006;
        } else {
          const s2 = (j - BOWL_ROWS) / COLLAR_ROWS;
          r = lerp(rimR, CRATER_OUTER, s2);
          y = 0.0015;
        }
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        uvs.push(Math.cos(theta) * r * SOIL_UV_SCALE, Math.sin(theta) * r * SOIL_UV_SCALE);
      }
    }
    for (let i = 0; i < A; i++) {
      for (let j = 0; j < R; j++) {
        const a = i * (R + 1) + j;
        const b = (i + 1) * (R + 1) + j;
        const target = j < BOWL_ROWS ? bowlIdx : collarIdx;
        target.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex([...collarIdx, ...bowlIdx]);
    // group 0 = dry surface collar, group 1 = damp broken interior
    geom.addGroup(0, collarIdx.length, 0);
    geom.addGroup(collarIdx.length, bowlIdx.length, 1);
    geom.computeVertexNormals();
    return geom;
  }

  /**
   * Drive the split. `stage` 1 opens the first three cracks a little; `stage`
   * 2 opens every plate as the cluster comes up.
   */
  setSplit(stage: number, amount: number): void {
    this.stageReached = Math.max(this.stageReached, stage);
    for (const plate of this.plates) {
      if (plate.stage <= stage) {
        let scale = plate.stage === 2 ? 0.92 : 1;
        // The hero plate lifts furthest, so the shoulder under it is exposed.
        if (plate.hero) scale *= 1.5;
        plate.target = Math.max(plate.target, clamp01(clamp01(amount) * scale));
      }
    }
  }

  get openedStage(): number {
    return this.stageReached;
  }

  /** Widest gap currently open, used to decide when a root shoulder shows. */
  get maxOpen(): number {
    return this.plates.reduce((m, p) => Math.max(m, p.open), 0);
  }

  /**
   * Azimuth of the first-wave crack nearest a preferred direction. The
   * grazing shot uses this to look along a split that is not behind the tool.
   */
  /** Azimuth of the crack sitting over the thickest root. */
  firstCrackAzimuth(): number {
    return this.plates[this.heroPlateIndex]?.azimuth ?? this.heroAzimuth;
  }

  update(dt: number): void {
    // The damp seam lies entirely under the closed plates and rises into the
    // gap as they tip, so it appears exactly when the ground splits.
    const open = this.maxOpen;
    for (const crack of this.crackMeshes) {
      crack.visible = open > 0.004;
      crack.position.y = lerp(-0.048, -0.026, clamp01(open * 3));
    }

    for (const plate of this.plates) {
      plate.mesh.castShadow = plate.open > 0.03;
      plate.open += (plate.target - plate.open) * Math.min(1, dt * 4.2);
      const angle = plate.open * 0.21;
      // Hinge at the outer rim: the inner edge lifts, the gap opens inward.
      plate.mesh.position.set(0, 0, 0);
      plate.mesh.quaternion.identity();
      plate.mesh.updateMatrix();
      const m = new THREE.Matrix4();
      const toOrigin = new THREE.Matrix4().makeTranslation(
        -plate.hingePoint.x,
        -plate.hingePoint.y,
        -plate.hingePoint.z,
      );
      const rot = new THREE.Matrix4().makeRotationAxis(plate.hinge, -angle);
      const back = new THREE.Matrix4().makeTranslation(
        plate.hingePoint.x,
        plate.hingePoint.y,
        plate.hingePoint.z,
      );
      // Plates also slide a little away from each other so the seam widens.
      const spread = new THREE.Matrix4().makeRotationY(
        plate.open * 0.030 * Math.sign(Math.sin(plate.azimuth * 3.1) || 1),
      );
      m.multiplyMatrices(back, rot).multiply(toOrigin).multiply(spread);
      plate.mesh.matrixAutoUpdate = false;
      plate.mesh.matrix.copy(m);
      plate.mesh.matrixWorldNeedsUpdate = true;
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}

/* ------------------------------------------------------------------ */
/* loose grains                                                        */
/* ------------------------------------------------------------------ */

/** A small pool of falling soil grains, reused for every burst. */
export class GrainField {
  readonly points: THREE.Points;
  private velocities: Float32Array;
  private lives: Float32Array;
  private cursor = 0;
  private readonly capacity: number;
  private positions: THREE.BufferAttribute;
  private material: THREE.PointsMaterial;
  private alpha: THREE.Texture;

  constructor(q: QualitySettings, soil: SoilKind) {
    this.capacity = q.particleBudget;
    const pos = new Float32Array(this.capacity * 3);
    for (let i = 0; i < this.capacity; i++) pos[i * 3 + 1] = -999;
    this.velocities = new Float32Array(this.capacity * 3);
    this.lives = new Float32Array(this.capacity);
    const geom = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(pos, 3);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', this.positions);
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
    this.alpha = radialAlpha(32, 1.6);
    this.material = new THREE.PointsMaterial({
      size: soil === 'sandy' ? 0.011 : 0.014,
      sizeAttenuation: true,
      color: soil === 'sandy' ? 0xb59a76 : 0x8a5f45,
      transparent: true,
      opacity: 0.95,
      alphaMap: this.alpha,
      depthWrite: false,
    });
    this.points = new THREE.Points(geom, this.material);
    this.points.frustumCulled = false;
  }

  emit(origin: THREE.Vector3, count: number, spread = 0.06, upward = 0.1): void {
    const arr = this.positions.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      arr[idx * 3] = origin.x + (Math.random() - 0.5) * spread;
      arr[idx * 3 + 1] = origin.y + (Math.random() - 0.5) * spread * 0.5;
      arr[idx * 3 + 2] = origin.z + (Math.random() - 0.5) * spread;
      this.velocities[idx * 3] = (Math.random() - 0.5) * 0.24;
      this.velocities[idx * 3 + 1] = Math.random() * upward;
      this.velocities[idx * 3 + 2] = (Math.random() - 0.5) * 0.24;
      this.lives[idx] = 0.85 + Math.random() * 0.6;
    }
    this.positions.needsUpdate = true;
  }

  update(dt: number, groundY: number): void {
    const arr = this.positions.array as Float32Array;
    let dirty = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.lives[i]! <= 0) continue;
      this.lives[i]! -= dt;
      this.velocities[i * 3 + 1]! -= 9.81 * dt;
      arr[i * 3]! += this.velocities[i * 3]! * dt;
      arr[i * 3 + 1]! += this.velocities[i * 3 + 1]! * dt;
      arr[i * 3 + 2]! += this.velocities[i * 3 + 2]! * dt;
      if (arr[i * 3 + 1]! < groundY || this.lives[i]! <= 0) {
        arr[i * 3 + 1] = -999;
        this.lives[i] = 0;
      }
      dirty = true;
    }
    if (dirty) this.positions.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    this.alpha.dispose();
  }
}
